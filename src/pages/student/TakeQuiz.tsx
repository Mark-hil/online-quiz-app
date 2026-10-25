import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Clock, ChevronLeft, ChevronRight, Flag, AlertCircle, Video, Monitor, Key, Shield, Calendar, RefreshCw, LogIn, Loader2, WifiOff, CheckCircle2, Lock, Server, Send, Timer } from 'lucide-react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import Textarea from '../../components/ui/Textarea';
import { db, Quiz, Question, QuestionBankItem } from '../../lib/database';
import { api } from '../../lib/apiClient';
import { useAuth } from '../../contexts/AuthContext';
import { parseOptions, prepareQuizQuestions } from '../../utils/quizUtils';
import { uploadProctoringSnapshot } from '../../lib/cloudinary';
import { generateBalancedSessionPools, sampleStudentQuestions } from '../../utils/sessionPoolUtils';

export default function TakeQuiz() {
  const { id } = useParams<{ id: string }>();
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<{ [key: string]: string }>({});
  const [markedForReview, setMarkedForReview] = useState<Set<number>>(new Set());
  const [showFlaggedOnly, setShowFlaggedOnly] = useState(false);
  const [navPage, setNavPage] = useState(0);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingQuiz, setLoadingQuiz] = useState(true);
  const [quizLoadError, setQuizLoadError] = useState<string | null>(null);
  const [joiningSessionId, setJoiningSessionId] = useState<string | null>(null);

  // Offline Resilience & Live Network Sync State
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [hasUnsyncedAnswers, setHasUnsyncedAnswers] = useState(false);
  const [, setLastSyncTime] = useState<Date | null>(null);
  const pendingSyncQueueRef = useRef<{ [questionId: string]: string }>({});
  const [tabSwitchCount, setTabSwitchCount] = useState(0);
  const [copyAttempts, setCopyAttempts] = useState(0);
  const [rightClickCount, setRightClickCount] = useState(0);
  const [quizTerminated, setQuizTerminated] = useState(false);
  const [terminationReason, setTerminationReason] = useState('');
  const [showResults, setShowResults] = useState(false);
  const [completedAttemptData, setCompletedAttemptData] = useState<any>(null);
  const [timesUp, setTimesUp] = useState(false);

  // Cohort Gatekeeper State
  const [sessionGateStatus, setSessionGateStatus] = useState<{
    blocked: boolean;
    reason?: 'unassigned' | 'early' | 'late' | 'pin_required';
    session?: any;
    availableSessions?: any[];
  } | null>(null);
  const [enteredPin, setEnteredPin] = useState('');
  const [pinError, setPinError] = useState('');

  // Interrupted / Terminal Change Security Gate State
  const [interruptedGate, setInterruptedGate] = useState<{
    attempt: any;
    assignedSession?: any;
    downtimeMinutes: number;
    downtimeSeconds: number;
    maxAllowedComp: number;
    pendingRequest?: any;
  } | null>(null);

  const [resumeMode, setResumeMode] = useState<'onscreen' | 'remote'>('onscreen');
  const [resumePin, setResumePin] = useState('');
  const [resumePinError, setResumePinError] = useState('');
  const [selectedCompMinutes, setSelectedCompMinutes] = useState<number>(0);
  const [customCompMinutes, setCustomCompMinutes] = useState<string>('');
  const [resumeReason, setResumeReason] = useState<string>('Hardware / PC Crash');
  const [isResumingAttempt, setIsResumingAttempt] = useState(false);
  const [remoteRequestSent, setRemoteRequestSent] = useState(false);
  const [isRequestingRemote, setIsRequestingRemote] = useState(false);
  const inProgressAttemptRef = useRef<any>(null);

  // Proctoring States
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [screenError, setScreenError] = useState<string | null>(null);
  const [isScreenRecording, setIsScreenRecording] = useState(false);
  const [isCameraMinimized, setIsCameraMinimized] = useState(false);
  const [showProctoringSetup, setShowProctoringSetup] = useState(false);
  const cameraVideoRef = useRef<HTMLVideoElement | null>(null);

  // Proctoring & Academic Integrity Event Logs
  const activityLogsRef = useRef<Array<{ timestamp: string; type: string; details: string; snapshot?: string }>>([]);
  const logProctoringEvent = (type: string, details: string, snapshot?: string | null) => {
    activityLogsRef.current.push({
      timestamp: new Date().toISOString(),
      type,
      details,
      snapshot: snapshot || undefined,
    });
  };

  // Capture snapshot for proctoring audit (streamlined to upload to Cloudinary CDN)
  const captureSnapshot = (): string | null => {
    if (!cameraVideoRef.current || !cameraStream) return null;
    try {
      const video = cameraVideoRef.current;
      if (video.videoWidth > 0 && video.videoHeight > 0) {
        const canvas = document.createElement('canvas');
        canvas.width = 320;
        canvas.height = 240;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0, 320, 240);
          return canvas.toDataURL('image/jpeg', 0.6);
        }
      }
    } catch (e) {
      console.warn('Snapshot capture failed', e);
    }
    return null;
  };

  // Interactive Camera Initializer
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 320 }, height: { ideal: 240 } },
        audio: false
      });
      setCameraStream(stream);
      setCameraError(null);
      logProctoringEvent('camera_started', 'Webcam stream initialized');
      if (cameraVideoRef.current) {
        cameraVideoRef.current.srcObject = stream;
      }
      return stream;
    } catch (err: any) {
      console.warn('Camera access denied or unavailable:', err);
      logProctoringEvent('camera_error', `Camera access denied: ${err?.message || err}`);
      setCameraError('Camera access is required for proctoring. Please allow webcam permissions in your browser.');
      return null;
    }
  };

  // Interactive Screen Recording Initializer (requires user gesture)
  const startScreenRecording = async () => {
    if (!navigator.mediaDevices?.getDisplayMedia) {
      const err = 'Screen recording is not supported on mobile browsers. Please use a laptop or desktop computer.';
      setScreenError(err);
      logProctoringEvent('screen_recording_unsupported', err);
      return null;
    }

    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      setScreenStream(stream);
      setIsScreenRecording(true);
      setScreenError(null);
      logProctoringEvent('screen_share_started', 'Screen recording stream active');

      const track = stream.getVideoTracks()[0];
      if (track) {
        track.onended = () => {
          setIsScreenRecording(false);
          logProctoringEvent('screen_share_stopped', 'Screen sharing was stopped by user');
          alert('⚠️ Warning: Screen sharing was stopped! Please click "Resume Screen Share" to continue.');
        };
      }
      return stream;
    } catch (err: any) {
      console.warn('Screen recording error:', err);
      logProctoringEvent('screen_recording_error', `Screen recording denied: ${err?.message || err}`);
      setScreenError('Screen recording was cancelled. Please click "Share Screen" to enable it.');
      return null;
    }
  };

  const { user } = useAuth();
  const navigate = useNavigate();

  // Always keep a ref pointing to the latest handleSubmit so the timer
  // never calls a stale closure version
  const handleSubmitRef = useRef<() => void>(() => {});
  const debounceTimerRef = useRef<{ [key: string]: NodeJS.Timeout }>({});

  // Sync navPage with currentIndex
  useEffect(() => {
    setNavPage(Math.floor(currentIndex / 30));
  }, [currentIndex]);

  // Get flagged questions for navigation
  const getFlaggedQuestions = () => {
    return Array.from(markedForReview).sort((a, b) => a - b);
  };

  // Navigate to next/previous flagged question
  const navigateToNextFlagged = () => {
    const flagged = getFlaggedQuestions();
    const currentIndexInFlagged = flagged.indexOf(currentIndex);
    if (currentIndexInFlagged < flagged.length - 1) {
      setCurrentIndex(flagged[currentIndexInFlagged + 1]);
    }
  };

  const navigateToPreviousFlagged = () => {
    const flagged = getFlaggedQuestions();
    const currentIndexInFlagged = flagged.indexOf(currentIndex);
    if (currentIndexInFlagged > 0) {
      setCurrentIndex(flagged[currentIndexInFlagged - 1]);
    }
  };

  // Function to terminate quiz for violations
  const terminateQuiz = async (reason: string) => {
    setQuizTerminated(true);
    setTerminationReason(reason);
    
    // Stop camera and screen tracks
    cameraStream?.getTracks().forEach(t => t.stop());
    screenStream?.getTracks().forEach(t => t.stop());
    
    if (attemptId) {
      try {
        logProctoringEvent('quiz_terminated', `Quiz terminated: ${reason}`);

        await api.post('/api/exam/terminate', {
          attempt_id: attemptId,
          reason,
        });

        // Clean up terminal session tokens and local backup
        try {
          sessionStorage.removeItem(`cbt_terminal_active_${attemptId}`);
          localStorage.removeItem(`cbt_backup_${attemptId}`);
        } catch (e) {
          console.warn('Storage cleanup failed on termination:', e);
        }

      } catch (error) {
        console.error('Error auto-submitting terminated quiz:', error);
      }
    }
    
    // Redirect after showing termination message
    setTimeout(() => {
      navigate('/student/attempts');
    }, 5000);
  };


  // Anti-cheating measures (respects quiz settings and device type)
  useEffect(() => {
    if (!quiz || quizTerminated || showResults) return;

    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

    const handleContextMenu = (e: MouseEvent) => {
      if (quiz.enable_copy_paste_prevention === false) return;
      e.preventDefault();
      logProctoringEvent('right_click', 'Right-click context menu triggered');
      alert('Right-click is disabled during this assessment to protect exam content.');
      setRightClickCount(prev => prev + 1);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (quiz.enable_copy_paste_prevention === false) return;
      if (e.ctrlKey || e.metaKey) {
        switch (e.key.toLowerCase()) {
          case 'c':
            if (e.shiftKey || e.ctrlKey) {
              e.preventDefault();
              logProctoringEvent('copy_attempt', `Copy shortcut Ctrl+C pressed (attempt #${copyAttempts + 1})`);
              setCopyAttempts(prev => prev + 1);
              if (copyAttempts >= 3) {
                terminateQuiz('Excessive copy attempts detected. Quiz terminated for academic integrity violation.');
              } else {
                alert(`Warning: Copy attempt detected (${copyAttempts + 1}/4). Multiple copy attempts will result in quiz termination.`);
              }
            }
            break;
          case 'a':
            if (e.shiftKey) {
              e.preventDefault();
              logProctoringEvent('select_all', 'Select All keyboard shortcut blocked');
              alert('Select All is disabled during the quiz.');
            }
            break;
          case 'f':
            if (e.shiftKey) {
              e.preventDefault();
              logProctoringEvent('find', 'Find shortcut blocked');
              alert('Find is disabled during the quiz.');
            }
            break;
          case 'p':
            e.preventDefault();
            logProctoringEvent('print', 'Print shortcut blocked');
            alert('Print is disabled during the quiz.');
            break;
        }
      }
    };

    const handleTabSwitch = () => {
      if (quiz.enable_tab_monitoring === false) return;
      setTabSwitchCount(prev => prev + 1);
      const snapshot = captureSnapshot();
      const eventIndex = activityLogsRef.current.length;
      logProctoringEvent('tab_switch', `Window/tab lost focus or minimized (count #${tabSwitchCount + 1})`, snapshot);

      // Offload snapshot to Cloudinary CDN in background so DB only stores lightweight URLs
      if (snapshot) {
        uploadProctoringSnapshot(snapshot, quiz.id, user?.id)
          .then((cdnUrl) => {
            if (cdnUrl && activityLogsRef.current[eventIndex]) {
              activityLogsRef.current[eventIndex].snapshot = cdnUrl;
            }
          })
          .catch((err) => console.warn('Cloudinary snapshot upload failed:', err));
      }

      // On mobile devices, tolerate up to 10 switches due to calls/notifications/system UI
      const switchLimit = isMobile ? 10 : 3;
      if (tabSwitchCount >= switchLimit) {
        terminateQuiz('Excessive tab switching or window defocusing detected. Quiz terminated for academic integrity violation.');
      } else {
        alert(`Warning: Tab switching/window minimization detected (${tabSwitchCount + 1}/${switchLimit + 1}). Multiple tab switches will result in quiz termination.`);
      }
    };

    if (quiz.enable_copy_paste_prevention !== false) {
      document.addEventListener('contextmenu', handleContextMenu);
      document.addEventListener('keydown', handleKeyDown);
    }
    if (quiz.enable_tab_monitoring !== false) {
      document.addEventListener('visibilitychange', handleTabSwitch);
    }

    return () => {
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('visibilitychange', handleTabSwitch);
    };
  }, [quiz, copyAttempts, tabSwitchCount, quizTerminated, showResults]);

  // Auto-prompt camera on mount if enabled
  useEffect(() => {
    if (!quiz?.enable_camera_proctoring || showResults || quizTerminated) return;
    startCamera();

    return () => {
      cameraStream?.getTracks().forEach(t => t.stop());
    };
  }, [quiz?.enable_camera_proctoring, showResults, quizTerminated]);

  useEffect(() => {
    if (cameraVideoRef.current && cameraStream) {
      cameraVideoRef.current.srcObject = cameraStream;
    }
  }, [cameraStream, isCameraMinimized]);

  // Prompt proctoring setup modal if screen recording or camera is required
  useEffect(() => {
    if ((quiz?.enable_camera_proctoring || quiz?.enable_screen_recording) && !showResults && !quizTerminated) {
      setShowProctoringSetup(true);
    }
  }, [quiz?.id]);

  // Periodic Proctoring Heartbeat (every 15s) to sync live snapshot and activity to DB for Live Invigilation
  useEffect(() => {
    if (!attemptId || quizTerminated || showResults || timeLeft <= 0) return;

    const interval = setInterval(async () => {
      try {
        const snap = captureSnapshot();
        if (snap) {
          // Offload to Cloudinary CDN so PostgreSQL receives lightweight HTTPS URLs instead of large base64 strings
          const mediaUrl = await uploadProctoringSnapshot(snap, quiz?.id, user?.id);
          logProctoringEvent('heartbeat_snapshot', 'Routine live snapshot', mediaUrl);
        }
        const payload: any = {
          tab_switch_count: tabSwitchCount,
          copy_attempts: copyAttempts,
          right_click_count: rightClickCount,
          suspicious_activity: activityLogsRef.current,
          last_activity: new Date().toISOString(),
        };
        const updated = await db.updateQuizAttempt(attemptId, payload);
        if (updated && updated.time_remaining !== undefined) {
          const currentRecorded = inProgressAttemptRef.current?.time_remaining || 0;
          if (updated.time_remaining > currentRecorded) {
            const addedMinutes = updated.time_remaining - currentRecorded;
            inProgressAttemptRef.current = updated;
            setTimeLeft(prev => prev + (addedMinutes * 60));
          }
        }
      } catch (e) {
        // silent heartbeat error
      }
    }, 15000);

    return () => clearInterval(interval);
  }, [attemptId, quizTerminated, showResults, timeLeft > 0, tabSwitchCount, copyAttempts, rightClickCount]);

  // Live refs so the long-lived online listener reads current values (avoids stale closure)
  const timesUpRef = useRef(timesUp);
  const showResultsRef = useRef(showResults);
  useEffect(() => {
    timesUpRef.current = timesUp;
    showResultsRef.current = showResults;
  }, [timesUp, showResults]);

  // Online / Offline live network detector & background auto-sync
  useEffect(() => {
    const handleOnline = async () => {
      setIsOnline(true);
      await syncPendingAnswers();
      if (timesUpRef.current && !showResultsRef.current) {
        handleSubmitRef.current();
      }
    };
    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Periodic sync heartbeat every 10s if answers are waiting to be saved
    const syncInterval = setInterval(() => {
      if (navigator.onLine && Object.keys(pendingSyncQueueRef.current).length > 0) {
        syncPendingAnswers();
      }
    }, 10000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(syncInterval);
    };
  }, [attemptId]);

  const syncPendingAnswers = async () => {
    if (!attemptId || !navigator.onLine) return;
    const pending = { ...pendingSyncQueueRef.current };
    const entries = Object.entries(pending);
    if (entries.length === 0) {
      setHasUnsyncedAnswers(false);
      return;
    }

    for (const [qId, ans] of entries) {
      try {
        await db.upsertStudentAnswer({
          attempt_id: attemptId,
          question_id: qId,
          answer_text: ans,
          is_correct: null,
          marks_obtained: null,
          lecturer_comment: '',
        });
        delete pendingSyncQueueRef.current[qId];
      } catch (e) {
        console.warn(`Background resync retry failed for question ${qId}:`, e);
      }
    }

    setLastSyncTime(new Date());
    if (Object.keys(pendingSyncQueueRef.current).length === 0) {
      setHasUnsyncedAnswers(false);
    }
  };

  // Progressive Cohort Session Visibility Helper:
  // - Group 1: Sees ONLY Session 1 (future sessions like Session 2, 3 remain hidden)
  // - Subsequent groups (Group 2, etc.): Can see past sessions (e.g. Session 1 marked Concluded), but must use their own active session (Session 2, etc.)
  const getFilteredSessionsForStudent = (allSessions: any[], assignedSession: any) => {
    if (!allSessions || allSessions.length === 0) return [];
    const sorted = [...allSessions].sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());

    if (assignedSession) {
      const assignedIndex = sorted.findIndex(s => s.id === assignedSession.id);
      if (assignedIndex <= 0) {
        // First group: Show ONLY the first session!
        return [sorted[0]];
      } else {
        // Subsequent groups: Can see prior sessions up to their assigned group!
        return sorted.slice(0, assignedIndex + 1);
      }
    }

    // Unassigned student:
    const now = Date.now();
    const activeIndex = sorted.findIndex(s => {
      const sStart = new Date(s.start_time).getTime();
      const sEnd = new Date(s.end_time).getTime();
      return now >= sStart && now <= sEnd;
    });

    if (activeIndex === 0 || (activeIndex === -1 && now < new Date(sorted[0].end_time).getTime())) {
      // First session timeframe: show ONLY Session 1!
      return [sorted[0]];
    }

    if (activeIndex > 0) {
      // Session 2+ timeframe: show past sessions up to the active one!
      return sorted.slice(0, activeIndex + 1);
    }

    return sorted;
  };

  useEffect(() => {
    loadQuiz();
  }, [id]);

  useEffect(() => {
    // Only run timer if quiz is loaded and time is remaining
    if (!quiz || quizTerminated || showResults || timeLeft <= 0) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setTimesUp(true);          // Lock the UI immediately
          handleSubmitRef.current(); // Call the always-current handleSubmit
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [quiz?.id, quizTerminated, showResults, timeLeft > 0]);

  // Option B: Real-time Poller for Remote Approval from Central Academic Officer
  useEffect(() => {
    if (!interruptedGate?.attempt?.id) return;
    if (!interruptedGate.pendingRequest && !remoteRequestSent) return;

    const pollInterval = setInterval(async () => {
      try {
        const requests = await db.getAttemptExtensionRequests(interruptedGate.attempt.id);
        const req = requests?.[0];
        if (req && req.status === 'approved') {
          sessionStorage.setItem(`cbt_terminal_active_${interruptedGate.attempt.id}`, 'true');
          const grantedMins = req.extension_minutes || 0;
          setInterruptedGate(null);
          setRemoteRequestSent(false);
          alert(`✅ Remote Authorization Granted by Academic Officer!\n\n${grantedMins} minutes technical downtime compensation applied. Resuming exam...`);
          await loadQuiz();
        } else if (req && req.status === 'rejected') {
          alert('⚠️ Remote resumption request was rejected by the Academic Officer. Please ask your room invigilator for on-screen authorization.');
          setInterruptedGate(prev => prev ? { ...prev, pendingRequest: null } : null);
          setRemoteRequestSent(false);
        }
      } catch (e) {
        console.warn('Error polling for extension approval:', e);
      }
    }, 3000);

    return () => clearInterval(pollInterval);
  }, [interruptedGate?.attempt?.id, interruptedGate?.pendingRequest, remoteRequestSent]);

  const loadQuiz = async () => {
    if (!id || !user) return;
    setLoadingQuiz(true);
    setQuizLoadError(null);

    try {
      // Fetch quiz, questions, and existing attempts in parallel
      const [quizData, existingAttempts] = await Promise.all([
        db.getQuiz(id),
        db.getQuizAttempts(id, user.id),
      ]);

      if (!quizData) {
        setQuizLoadError('Quiz not found or has been removed by the instructor.');
        return;
      }

      setQuiz(quizData as Quiz);

      const inProgressAttempt = existingAttempts.find((a: any) => a.status === 'in_progress');
      const completedAttempt = existingAttempts.find((a: any) =>
        a.status === 'submitted' || a.status === 'graded'
      );

      // Student already submitted (legitimately or via auto-submit for cheating) — show results
      if (completedAttempt?.submitted_at) {
        setCompletedAttemptData(completedAttempt);
        setShowResults(true);
        return;
      }

      // Strict Institutional Deadline Enforcement:
      // Once the quiz deadline date and time has passed, no student can take or resume the quiz.
      if (quizData.deadline && new Date(quizData.deadline) < new Date()) {
        if (inProgressAttempt) {
          try {
            await db.updateQuizAttempt(inProgressAttempt.id, {
              status: 'graded',
              submitted_at: inProgressAttempt.submitted_at || new Date().toISOString(),
              graded_at: new Date().toISOString(),
            });
          } catch (e) {
            console.warn('Auto-finalizing expired in-progress attempt failed:', e);
          }
          setCompletedAttemptData(inProgressAttempt);
          setShowResults(true);
          setLoadingQuiz(false);
          return;
        }
        setQuizLoadError('This quiz deadline has expired and is no longer available.');
        setLoadingQuiz(false);
        return;
      }

      // Cohort Gatekeeper Check
      let assignedSession: any = null;
      if (quizData.has_multiple_sessions) {
        const [studentSession, allSessions] = await Promise.all([
          db.getStudentAssignedSession(id, user.id),
          db.getQuizSessions(id),
        ]);
        assignedSession = studentSession;
        const filteredSessions = getFilteredSessionsForStudent(allSessions || [], studentSession);

        if (!assignedSession) {
          const now = Date.now();
          const targetSession = (filteredSessions || []).find((s: any) => {
            const start = new Date(s.start_time).getTime();
            const end = new Date(s.end_time).getTime();
            return now >= start && now <= end;
          }) || (filteredSessions || [])[0];

          setSessionGateStatus({
            blocked: true,
            reason: 'unassigned',
            session: targetSession,
            availableSessions: filteredSessions,
          });
          return;
        }

        const now = Date.now();
        const startTime = new Date(assignedSession.start_time).getTime();
        const endTime = new Date(assignedSession.end_time).getTime();

        if (now < startTime) {
          setSessionGateStatus({
            blocked: true,
            reason: 'early',
            session: assignedSession,
            availableSessions: filteredSessions,
          });
          return;
        }

        // Only block for late if the student has NOT already started an attempt.
        // If a student already has an active in_progress attempt, allow them to finish their attempt time
        // even if the entry window closed while they were rebooting or changing computers!
        if (now > endTime && !inProgressAttempt) {
          setSessionGateStatus({
            blocked: true,
            reason: 'late',
            session: assignedSession,
            availableSessions: filteredSessions,
          });
          return;
        }

        if (assignedSession.access_pin && !inProgressAttempt) {
          const storedPin = sessionStorage.getItem(`session_pin_${assignedSession.id}`);
          if (storedPin !== assignedSession.access_pin) {
            setSessionGateStatus({
              blocked: true,
              reason: 'pin_required',
              session: assignedSession,
              availableSessions: filteredSessions,
            });
            return;
          }
        }

        // Passed all session gatekeeper checks
        setSessionGateStatus(null);
      }

      let currentAttemptId = '';
      const answerMap: { [key: string]: string } = {};
      let loadedAnswers: any[] = [];

      if (inProgressAttempt) {
        const serverNow = inProgressAttempt.current_db_time ? new Date(inProgressAttempt.current_db_time).getTime() : Date.now();
        const attemptAgeMs = serverNow - new Date(inProgressAttempt.started_at).getTime();
        const extensionSeconds = Math.round((inProgressAttempt.time_remaining || 0) * 60);
        const totalSeconds = (quizData.duration_minutes * 60) + extensionSeconds;
        const elapsedSeconds = Math.floor(attemptAgeMs / 1000);
        let remainingSeconds = Math.max(0, totalSeconds - elapsedSeconds);
        // Strict boundary: timer can never exceed remaining time until quiz deadline
        if (quizData.deadline) {
          const secondsToDeadline = Math.floor((new Date(quizData.deadline).getTime() - serverNow) / 1000);
          if (secondsToDeadline >= 0) {
            remainingSeconds = Math.min(remainingSeconds, secondsToDeadline);
          }
        }
        if (assignedSession?.end_time) {
          const secondsToSessionEnd = Math.floor((new Date(assignedSession.end_time).getTime() - serverNow) / 1000);
          if (secondsToSessionEnd >= 0) {
            remainingSeconds = Math.min(remainingSeconds, secondsToSessionEnd);
          }
        }

        // 1. Permanent Expiration Check:
        // If elapsed time exceeds total allotted time by more than the 15-minute emergency grace window,
        // or if the hard room session / quiz deadline has passed:
        const isPermanentlyExpired = (totalSeconds + (15 * 60)) <= elapsedSeconds;
        const hasSessionClosed = assignedSession?.end_time 
          ? new Date(assignedSession.end_time).getTime() < serverNow
          : false;
        const hasDeadlinePassed = quizData.deadline
          ? new Date(quizData.deadline).getTime() < serverNow
          : false;

        if (isPermanentlyExpired || hasSessionClosed || hasDeadlinePassed) {
          // Attempt is permanently closed — auto-finalize and show results
          try {
            await db.updateQuizAttempt(inProgressAttempt.id, {
              status: 'graded',
              submitted_at: inProgressAttempt.submitted_at || new Date().toISOString(),
              graded_at: new Date().toISOString(),
            });
          } catch (e) {
            console.warn('Auto-finalizing expired attempt failed:', e);
          }
          setCompletedAttemptData(inProgressAttempt);
          setShowResults(true);
          setLoadingQuiz(false);
          return;
        }

        // Security Guard: Check if terminal/browser session is already verified
        const isTerminalActive = sessionStorage.getItem(`cbt_terminal_active_${inProgressAttempt.id}`) === 'true';

          if (!isTerminalActive) {
            // Check if Academic Officer approved a remote extension request
            let remoteApproved = false;
            let pendingRequest: any = null;
            try {
              const reqs = await db.getAttemptExtensionRequests(inProgressAttempt.id);
              if (reqs && reqs.length > 0) {
                if (reqs[0].status === 'approved') {
                  remoteApproved = true;
                } else if (reqs[0].status === 'pending') {
                  pendingRequest = reqs[0];
                }
              }
            } catch (err) {
              console.warn('Could not check extension requests:', err);
            }

            if (remoteApproved) {
              sessionStorage.setItem(`cbt_terminal_active_${inProgressAttempt.id}`, 'true');
            } else {
              // Interrupted / Terminal Change Guard Triggered!
              const lastActive = inProgressAttempt.last_activity
                ? new Date(inProgressAttempt.last_activity).getTime()
                : new Date(inProgressAttempt.started_at).getTime();
              const downtimeSeconds = Math.max(0, Math.floor((serverNow - lastActive) / 1000));
              const downtimeMinutes = Math.ceil(downtimeSeconds / 60);
              // Max allowed compensation: calculated downtime + 2 min buffer, capped at 15 min institutional limit
              const maxAllowedComp = Math.min(15, downtimeMinutes > 0 ? downtimeMinutes + 2 : 5);

              setInterruptedGate({
                attempt: inProgressAttempt,
                assignedSession,
                downtimeMinutes,
                downtimeSeconds,
                maxAllowedComp,
                pendingRequest,
              });
              setSelectedCompMinutes(downtimeMinutes);
              setLoadingQuiz(false);
              return;
            }
          }

          // Resume existing attempt — restore timer and saved answers
          currentAttemptId = inProgressAttempt.id;
          inProgressAttemptRef.current = inProgressAttempt;
          sessionStorage.setItem(`cbt_terminal_active_${currentAttemptId}`, 'true');
          setTimeLeft(remainingSeconds);

          // Load all previously saved answers from database and restore them into state
          loadedAnswers = await db.getStudentAnswers(currentAttemptId);
          loadedAnswers.forEach((a: any) => {
            if (a.answer_text) answerMap[a.question_id] = a.answer_text;
          });

          // Also check localStorage on this machine for any offline backup (e.g. if reloaded after brief disconnect)
          try {
            const localBackup = localStorage.getItem(`cbt_backup_${currentAttemptId}`);
            if (localBackup) {
              const parsed = JSON.parse(localBackup);
              Object.assign(answerMap, parsed);
            }
          } catch (e) {
            console.warn('Could not read local backup:', e);
          }

          if (remainingSeconds === 0) {
            // Time already expired while they were away — auto-submit
            setTimesUp(true);
            setTimeout(() => handleSubmitRef.current(), 500);
          }
      } else {
        // Brand new attempt
        const newAttempt = await db.createQuizAttempt({
          quiz_id: id,
          student_id: user.id,
          started_at: new Date().toISOString(),
          status: 'in_progress',
        });
        currentAttemptId = newAttempt.id;
        inProgressAttemptRef.current = newAttempt;
        sessionStorage.setItem(`cbt_terminal_active_${currentAttemptId}`, 'true');

        let initialSeconds = quizData.duration_minutes * 60;
        if (quizData.deadline) {
          const secondsToDeadline = Math.floor((new Date(quizData.deadline).getTime() - Date.now()) / 1000);
          if (secondsToDeadline > 0) {
            initialSeconds = Math.min(initialSeconds, secondsToDeadline);
          }
        }
        if (assignedSession?.end_time) {
          const secondsToSessionEnd = Math.floor((new Date(assignedSession.end_time).getTime() - Date.now()) / 1000);
          if (secondsToSessionEnd > 0) {
            initialSeconds = Math.min(initialSeconds, secondsToSessionEnd);
          }
        }
        setTimeLeft(initialSeconds);
      }

      setAttemptId(currentAttemptId);
      setAnswers(answerMap);

      // Fetch and prepare questions
      let preparedQuestions: Question[] = [];

      if (quizData.is_dynamic_draw && quizData.course_id) {
        // 1. Check if attempt already has frozen questions
        const frozen = await db.getAttemptQuestions(currentAttemptId);
        if (frozen && frozen.length > 0) {
          preparedQuestions = frozen.map((f: any) => ({
            id: f.question_bank_id || f.id,
            quiz_id: id,
            lecturer_id: quizData.lecturer_id || '',
            question_text: f.question_text,
            question_type: f.question_type,
            options: typeof f.options === 'string' ? f.options : JSON.stringify(f.options || []),
            correct_answer: f.correct_answer,
            marks: f.marks || 1,
            created_at: f.created_at || new Date().toISOString()
          }));
        } else {
          // 2. Fresh attempt: sample questions from the course bank or session pool
          const bankQuestions = (await db.getQuestionBankQuestions(quizData.course_id, { status: 'active' })) as unknown as QuestionBankItem[];
          let candidatePool: QuestionBankItem[] = bankQuestions;

          if (quizData.has_multiple_sessions) {
            const sessions = await db.getQuizSessions(id);
            if (sessions.length > 1) {
              const pools = generateBalancedSessionPools(bankQuestions, sessions.length);
              const poolKey = (assignedSession?.session_pool_index !== undefined ? assignedSession.session_pool_index + 1 : 1);
              candidatePool = pools[poolKey] || pools[1] || bankQuestions;
            }
          }

          const sampledItems = sampleStudentQuestions(
            candidatePool,
            quizData.draw_question_count || 25,
            currentAttemptId
          );

          // Freeze into database
          const toSave = sampledItems.map((item, idx) => ({
            question_bank_id: item.id,
            order_index: idx + 1
          }));
          await db.saveAttemptQuestions(currentAttemptId, toSave);

          preparedQuestions = sampledItems.map(item => ({
            id: item.id,
            quiz_id: id,
            lecturer_id: quizData.lecturer_id || '',
            question_text: item.question_text,
            question_type: item.question_type,
            options: typeof item.options === 'string' ? item.options : JSON.stringify(item.options || []),
            correct_answer: item.correct_answer,
            marks: item.marks || 1,
            created_at: item.created_at || new Date().toISOString()
          }));
        }
      } else {
        const questionsData = await db.getQuestions(id);
        preparedQuestions = prepareQuizQuestions(
          questionsData as Question[],
          quizData?.randomize_questions || false,
          quizData?.randomize_options || false,
          currentAttemptId
        );
      }
      setQuestions(preparedQuestions);

      if (loadedAnswers.length > 0) {
        const initialMarked = new Set<number>();
        preparedQuestions.forEach((q, index) => {
          const ans = loadedAnswers.find((a: any) => a.question_id === q.id);
          if (ans?.is_flagged) {
            initialMarked.add(index);
          }
        });
        setMarkedForReview(initialMarked);
      }

      // Jump to the first unanswered question when resuming
      if (Object.keys(answerMap).length > 0) {
        const firstUnansweredIndex = preparedQuestions.findIndex((q: Question) => !answerMap[q.id]);
        setCurrentIndex(firstUnansweredIndex !== -1 ? firstUnansweredIndex : preparedQuestions.length - 1);
      } else {
        setCurrentIndex(0);
      }
    } catch (err: any) {
      console.error('Error loading quiz:', err);
      setQuizLoadError(err?.message || 'Failed to load exam. Please try again.');
    } finally {
      setLoadingQuiz(false);
    }
  };

  const handleJoinSession = async (sessionToJoin: any, pin?: string) => {
    if (!user || !sessionToJoin) return;
    if (sessionToJoin.access_pin && (!pin || pin.trim() !== sessionToJoin.access_pin)) {
      setPinError('Invalid session PIN. Please verify with your invigilator.');
      return;
    }

    setJoiningSessionId(sessionToJoin.id);
    try {
      // If student was already assigned to another session, remove from previous session first
      if (sessionGateStatus?.session?.id && sessionGateStatus.session.id !== sessionToJoin.id) {
        await db.removeStudentFromSession(sessionGateStatus.session.id, user.id);
      }
      await db.assignStudentsToSession(sessionToJoin.id, [user.id]);
      if (pin) {
        sessionStorage.setItem(`session_pin_${sessionToJoin.id}`, pin.trim());
      }
      setSessionGateStatus(null);
      setPinError('');
      setEnteredPin('');
      await loadQuiz();
    } catch (err) {
      console.error('Error joining session:', err);
      alert('Failed to join session. Please contact your invigilator.');
    } finally {
      setJoiningSessionId(null);
    }
  };

  // Option A: On-Screen Room Invigilator Authorization with Measured Downtime Cap
  const handleOnScreenResume = async () => {
    if (!interruptedGate) return;
    setResumePinError('');

    const targetPin = interruptedGate.assignedSession?.access_pin;
    if (targetPin) {
      if (resumePin.trim() !== targetPin) {
        setResumePinError('Invalid Invigilator Authorization PIN. Verification failed.');
        return;
      }
    } else if (!resumePin.trim()) {
      setResumePinError('Please have your room invigilator confirm authorization.');
      return;
    }

    const compMins = customCompMinutes !== '' ? parseInt(customCompMinutes, 10) : selectedCompMinutes;
    if (isNaN(compMins) || compMins < 0) {
      setResumePinError('Please enter a valid non-negative number for minutes.');
      return;
    }
    if (compMins > interruptedGate.maxAllowedComp) {
      setResumePinError(`Compensation exceeds system-calculated cap of ${interruptedGate.maxAllowedComp} minutes.`);
      return;
    }

    setIsResumingAttempt(true);
    try {
      if (compMins > 0) {
        await db.extendQuizTime(interruptedGate.attempt.id, compMins, user?.id || '');
        await db.createAuditLog(
          user?.id || '',
          'invigilator_terminal_resume',
          'quiz_attempt',
          interruptedGate.attempt.id,
          JSON.stringify({
            downtime_seconds: interruptedGate.downtimeSeconds,
            compensation_minutes: compMins,
            reason: resumeReason,
            resumed_at: new Date().toISOString(),
          })
        );
      }

      sessionStorage.setItem(`cbt_terminal_active_${interruptedGate.attempt.id}`, 'true');
      if (targetPin) {
        sessionStorage.setItem(`session_pin_${interruptedGate.assignedSession.id}`, resumePin.trim());
      }
      setInterruptedGate(null);
      setResumePin('');
      setResumePinError('');
      setCustomCompMinutes('');
      await loadQuiz();
    } catch (e: any) {
      console.error('Error during on-screen resume:', e);
      setResumePinError(e?.message || 'Failed to authorize resumption.');
    } finally {
      setIsResumingAttempt(false);
    }
  };

  // Option B: Central Academic Officer Remote Authorization Request
  const handleSendRemoteRequest = async () => {
    if (!interruptedGate || !user) return;
    setIsRequestingRemote(true);
    try {
      const compMins = interruptedGate.downtimeMinutes > 0 ? interruptedGate.downtimeMinutes : 5;
      await db.createExtensionRequest(
        interruptedGate.attempt.id,
        user.id,
        compMins,
        `Terminal swap / PC downtime (${interruptedGate.downtimeMinutes}m measured) - ${resumeReason}`
      );
      setRemoteRequestSent(true);
      setInterruptedGate(prev => prev ? {
        ...prev,
        pendingRequest: {
          id: 'temp',
          status: 'pending',
          extension_minutes: compMins,
          reason: resumeReason,
          created_at: new Date().toISOString()
        }
      } : null);
    } catch (e: any) {
      alert('Failed to send remote request: ' + (e?.message || 'Network error'));
    } finally {
      setIsRequestingRemote(false);
    }
  };

  const handleAnswerChange = async (questionId: string, answer: string) => {
    const updatedAnswers = { ...answers, [questionId]: answer };
    setAnswers(updatedAnswers);

    if (!attemptId) return;

    // 1. Instant Synchronous Local Storage Persistence (Zero data loss if computer crashes or network drops)
    try {
      localStorage.setItem(`cbt_backup_${attemptId}`, JSON.stringify(updatedAnswers));
    } catch (e) {
      console.warn('LocalStorage save failed:', e);
    }

    // 2. Track in unsynced queue
    pendingSyncQueueRef.current[questionId] = answer;
    setHasUnsyncedAnswers(true);

    if (debounceTimerRef.current[questionId]) {
      clearTimeout(debounceTimerRef.current[questionId]);
    }

    debounceTimerRef.current[questionId] = setTimeout(async () => {
      if (!navigator.onLine) {
        // Kept in pendingSyncQueueRef and will be synced upon network reconnection
        return;
      }

      try {
        await db.upsertStudentAnswer({
          attempt_id: attemptId,
          question_id: questionId,
          answer_text: answer,
          is_correct: null,
          marks_obtained: null,
          lecturer_comment: '',
        });
        delete pendingSyncQueueRef.current[questionId];
        if (Object.keys(pendingSyncQueueRef.current).length === 0) {
          setHasUnsyncedAnswers(false);
        }
        setLastSyncTime(new Date());
      } catch (error) {
        console.error('Failed to auto-save answer to server:', error);
      }
    }, 1000);
  };

  const handleFlagChange = async (index: number, isFlagged: boolean) => {
    const newMarked = new Set(markedForReview);
    if (isFlagged) {
      newMarked.add(index);
    } else {
      newMarked.delete(index);
    }
    setMarkedForReview(newMarked);

    if (!attemptId) return;

    const questionId = questions[index].id;
    const currentAnswer = answers[questionId] || '';

    try {
      await db.upsertStudentAnswer({
        attempt_id: attemptId,
        question_id: questionId,
        answer_text: currentAnswer,
        is_correct: null,
        marks_obtained: null,
        lecturer_comment: '',
        is_flagged: isFlagged,
      });
    } catch (error) {
      console.error('Failed to auto-save flag state:', error);
    }
  };

  const handleSubmit = async () => {
    if (!attemptId) return;

    // 1. Network Guard: Prevent submitting into a void when disconnected
    if (!navigator.onLine) {
      alert('⚠️ Internet Connection Interrupted\n\nYour answers are safely preserved on this computer in offline storage, but you cannot submit to the examination server while offline.\n\nPlease notify your invigilator or reconnect to the network.');
      return;
    }

    // 2. If quiz deadline has reached during the session, proceed to auto-finalize and grade whatever answers were submitted
    if (quiz?.deadline && new Date(quiz.deadline) < new Date()) {
      console.log('Quiz deadline reached: final score and submitted answers are being auto-finalized and graded.');
    }

    // 3. Flush any pending unsynced answers before final score tally
    if (Object.keys(pendingSyncQueueRef.current).length > 0) {
      await syncPendingAnswers();
    }

    setLoading(true);

    try {
      const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      const isSuspicious = tabSwitchCount > (isMobileDevice ? 6 : 2) || copyAttempts > 2;

      // Submit attempt and answers to server for objective grading
      const submitResult = await api.post('/api/exam/submit', {
        attempt_id: attemptId,
        final_answers: answers,
      });

      console.log('Submission result:', submitResult);

      if (isSuspicious) {
        await db.updateQuizAttempt(attemptId, {
          cheated: true,
          cheating_reason: `Flagged for lecturer review: ${tabSwitchCount} tab switch(es), ${copyAttempts} copy attempt(s).`,
          tab_switch_count: tabSwitchCount,
          copy_attempts: copyAttempts,
          right_click_count: rightClickCount,
          user_agent: navigator.userAgent,
          suspicious_activity: activityLogsRef.current,
        });
      }

      // Stop camera and screen recording streams
      cameraStream?.getTracks().forEach(t => t.stop());
      screenStream?.getTracks().forEach(t => t.stop());

      // Clear offline backup and terminal session token now that submission is safely recorded on server
      try {
        localStorage.removeItem(`cbt_backup_${attemptId}`);
        sessionStorage.removeItem(`cbt_terminal_active_${attemptId}`);
      } catch (_) {}

      navigate('/student/attempts');
    } catch (error) {
      console.error('Error submitting quiz:', error);
      alert('Failed to submit quiz');
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Keep ref in sync with the latest handleSubmit on every render
  // This prevents the timer from calling a stale version
  handleSubmitRef.current = handleSubmit;

  // 1. Show results screen if quiz has been completed
  if (showResults && completedAttemptData) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <Card>
          <div className="text-center space-y-6">
            <div className="text-green-600 text-6xl">✅</div>
            <h1 className="text-3xl font-bold text-gray-900">Quiz Completed</h1>
            <div className="bg-gray-50 rounded-lg p-6">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">{quiz?.title || 'Assessment'}</h2>
              <div className="grid grid-cols-2 gap-4 text-left">
                <div>
                  <p className="text-sm text-gray-600">Status</p>
                  <p className="font-medium capitalize">{completedAttemptData.status}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Score</p>
                  <p className="font-medium text-2xl text-blue-600">
                    {quiz?.show_results_immediately === false ? 'Hidden' : (completedAttemptData.score !== null ? `${Number(completedAttemptData.score).toFixed(2)}%` : 'Pending')}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Submitted</p>
                  <p className="font-medium">
                    {completedAttemptData.submitted_at 
                      ? new Date(completedAttemptData.submitted_at).toLocaleString()
                      : 'N/A'
                    }
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Time Taken</p>
                  <p className="font-medium">
                    {completedAttemptData.started_at && completedAttemptData.submitted_at
                      ? Math.round((new Date(completedAttemptData.submitted_at).getTime() - new Date(completedAttemptData.started_at).getTime()) / 60000)
                      : 'N/A'
                    } minutes
                  </p>
                </div>
              </div>
            </div>
            
            {completedAttemptData.cheated && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-red-800 font-medium">⚠️ Academic Integrity Violation</p>
                <p className="text-red-700 text-sm mt-1">{completedAttemptData.cheating_reason}</p>
              </div>
            )}
            
            <div className="flex justify-center gap-4">
              <Button variant="secondary" onClick={() => navigate('/student/quizzes')}>
                Back to Quizzes
              </Button>
              <Button onClick={() => navigate('/student/attempts')}>
                View All Attempts
              </Button>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  // 2. Show termination screen if quiz was terminated for violations
  if (quizTerminated) {
    return (
      <div className="max-w-2xl mx-auto mt-20">
        <Card className="border-red-200 bg-red-50">
          <div className="text-center space-y-4">
            <div className="text-red-600 text-6xl">⚠️</div>
            <h1 className="text-2xl font-bold text-red-800">Quiz Terminated Due to Violations</h1>
            <p className="text-red-700">
              {terminationReason}
            </p>
            <div className="bg-red-100 border border-red-200 rounded-lg p-4 text-left">
              <h3 className="font-semibold text-red-800 mb-2">What happened:</h3>
              <p className="text-red-700 text-sm">
                Your quiz has been automatically terminated due to multiple academic integrity violations.
                Your quiz is being auto-submitted with your current answers and flagged for instructor review.
              </p>
            </div>
            <div className="bg-yellow-100 border border-yellow-200 rounded-lg p-4 text-left">
              <h3 className="font-semibold text-yellow-800 mb-2">Quiz Status:</h3>
              <ul className="text-yellow-700 text-sm space-y-1">
                <li>✅ Quiz automatically submitted</li>
                <li>✅ Current answers saved</li>
                <li>✅ Score calculated based on answered questions</li>
                <li>⚠️ Flagged as cheating violation</li>
                <li>📝 Incident logged for instructor review</li>
              </ul>
            </div>
            <div className="bg-gray-100 border border-gray-200 rounded-lg p-4 text-left">
              <h3 className="font-semibold text-gray-800 mb-2">Violation Details:</h3>
              <ul className="text-gray-700 text-sm space-y-1">
                <li>Tab switches: {tabSwitchCount}</li>
                <li>Copy attempts: {copyAttempts}</li>
                <li>Right clicks: {rightClickCount}</li>
                <li>Reason: {terminationReason}</li>
              </ul>
            </div>
            <p className="text-gray-600 text-sm">
              You will be redirected to your attempts page in 5 seconds...
            </p>
          </div>
        </Card>
      </div>
    );
  }

  // 3. Show full-screen lock when time is up
  if (timesUp && !showResults) {
    return (
      <div className="fixed inset-0 bg-gray-900 bg-opacity-95 flex items-center justify-center z-50">
        <div className="text-center space-y-4 p-8">
          <div className="text-red-400 text-7xl">⏰</div>
          <h1 className="text-3xl font-bold text-white">Time's Up!</h1>
          <p className="text-gray-300 text-lg">Your answers are being submitted automatically...</p>
          <div className="flex items-center justify-center gap-2 text-gray-400">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
            <span>Please wait</span>
          </div>
        </div>
      </div>
    );
  }

  // 3.5. Security Guard: Interrupted Exam / Terminal Change Detected
  if (interruptedGate) {
    const { attempt, downtimeMinutes, downtimeSeconds, maxAllowedComp, pendingRequest } = interruptedGate;

    return (
      <div className="max-w-2xl mx-auto py-10 px-4">
        <Card className="border-amber-300 shadow-2xl overflow-hidden p-6 md:p-8 space-y-6 bg-gradient-to-b from-amber-50/40 to-white">
          {/* Header Icon & Warning */}
          <div className="text-center space-y-2">
            <div className="w-16 h-16 bg-amber-100 text-amber-700 rounded-2xl flex items-center justify-center mx-auto shadow-inner border border-amber-200">
              <Lock size={32} />
            </div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-100 text-amber-800 text-xs font-bold rounded-full uppercase tracking-wider">
              <AlertCircle size={14} /> Terminal Interruption Detected
            </div>
            <h2 className="text-2xl font-bold text-gray-900">
              Exam In-Progress – Re-Authorization Required
            </h2>
            <p className="text-sm text-gray-600 max-w-lg mx-auto">
              This exam was in progress on another computer or was interrupted by a browser restart. To prevent surrogate test-taking, an invigilator or academic officer must authorize this terminal before resumption.
            </p>
          </div>

          {/* Measured Downtime Technical Dossier */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-white p-4 rounded-xl border border-amber-200 shadow-sm text-center">
            <div className="p-2 border-b sm:border-b-0 sm:border-r border-gray-100">
              <span className="text-xs text-gray-500 font-medium">Last Active Heartbeat</span>
              <p className="text-sm font-bold text-gray-800 mt-0.5">
                {attempt.last_activity ? new Date(attempt.last_activity).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'Unknown'}
              </p>
            </div>
            <div className="p-2 border-b sm:border-b-0 sm:border-r border-gray-100">
              <span className="text-xs text-amber-700 font-medium flex items-center justify-center gap-1">
                <Timer size={13} /> Measured Outage
              </span>
              <p className="text-base font-extrabold text-amber-900 mt-0.5">
                {downtimeMinutes > 0 ? `${downtimeMinutes} min${downtimeMinutes > 1 ? 's' : ''}` : `${downtimeSeconds}s`}
              </p>
              <span className="text-[10px] text-gray-400">System-Calculated</span>
            </div>
            <div className="p-2">
              <span className="text-xs text-purple-700 font-medium">Max Compensation Cap</span>
              <p className="text-base font-extrabold text-purple-900 mt-0.5">
                +{maxAllowedComp} min
              </p>
              <span className="text-[10px] text-gray-400">Anti-Favoritism Cap</span>
            </div>
          </div>

          {/* Two Authorization Tabs: Option A (In-Person) vs Option B (Remote) */}
          <div className="border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm">
            <div className="grid grid-cols-2 text-center text-sm font-semibold border-b border-gray-200">
              <button
                type="button"
                className={`py-3 px-4 transition-all flex items-center justify-center gap-1.5 ${
                  resumeMode === 'onscreen'
                    ? 'bg-purple-600 text-white font-bold'
                    : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                }`}
                onClick={() => setResumeMode('onscreen')}
              >
                <Key size={16} /> Option A: Invigilator PIN
              </button>
              <button
                type="button"
                className={`py-3 px-4 transition-all flex items-center justify-center gap-1.5 ${
                  resumeMode === 'remote'
                    ? 'bg-purple-600 text-white font-bold'
                    : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                }`}
                onClick={() => setResumeMode('remote')}
              >
                <Server size={16} /> Option B: Remote Approval
              </button>
            </div>

            <div className="p-5">
              {/* Option A: On-Screen Room Invigilator PIN Form */}
              {resumeMode === 'onscreen' && (
                <div className="space-y-4">
                  <div className="bg-purple-50/70 p-3 rounded-lg border border-purple-100 text-xs text-purple-800 text-left">
                    ℹ️ <strong>Room Invigilator Action:</strong> Please physically enter your Invigilator PIN to unlock this student's sitting. Time compensation is strictly capped at the measured downtime.
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1 text-left">
                      Invigilator Authorization PIN
                    </label>
                    <input
                      type="password"
                      placeholder="Enter Invigilator PIN"
                      value={resumePin}
                      onChange={(e) => {
                        setResumePin(e.target.value);
                        setResumePinError('');
                      }}
                      className="w-full text-center text-xl tracking-widest font-mono py-2.5 px-4 border-2 border-purple-300 rounded-xl focus:border-purple-600 focus:outline-none bg-white shadow-sm"
                      maxLength={12}
                      autoFocus
                    />
                    {resumePinError && (
                      <p className="text-xs text-red-600 mt-1.5 text-center font-medium">{resumePinError}</p>
                    )}
                  </div>

                  {/* Downtime Compensation Selector (Capped to Measured Downtime) */}
                  <div className="text-left space-y-2 pt-2 border-t border-gray-100">
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
                      Technical Downtime Compensation:
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => { setSelectedCompMinutes(0); setCustomCompMinutes(''); }}
                        className={`py-2 px-3 rounded-lg border text-xs font-semibold transition-all ${
                          selectedCompMinutes === 0 && customCompMinutes === ''
                            ? 'border-purple-600 bg-purple-50 text-purple-700 shadow-sm'
                            : 'border-gray-200 hover:bg-gray-50 text-gray-600'
                        }`}
                      >
                        0 min (No Extra)
                      </button>
                      <button
                        type="button"
                        onClick={() => { setSelectedCompMinutes(downtimeMinutes); setCustomCompMinutes(''); }}
                        className={`py-2 px-3 rounded-lg border text-xs font-semibold transition-all ${
                          selectedCompMinutes === downtimeMinutes && customCompMinutes === ''
                            ? 'border-purple-600 bg-purple-50 text-purple-700 shadow-sm'
                            : 'border-gray-200 hover:bg-gray-50 text-gray-600'
                        }`}
                      >
                        +{downtimeMinutes} min (Exact)
                      </button>
                      <button
                        type="button"
                        onClick={() => { setSelectedCompMinutes(maxAllowedComp); setCustomCompMinutes(''); }}
                        className={`py-2 px-3 rounded-lg border text-xs font-semibold transition-all ${
                          selectedCompMinutes === maxAllowedComp && customCompMinutes === ''
                            ? 'border-purple-600 bg-purple-50 text-purple-700 shadow-sm'
                            : 'border-gray-200 hover:bg-gray-50 text-gray-600'
                        }`}
                      >
                        +{maxAllowedComp} min (Max Cap)
                      </button>
                    </div>

                    <div className="pt-2">
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Technical Incident Reason:
                      </label>
                      <select
                        value={resumeReason}
                        onChange={(e) => setResumeReason(e.target.value)}
                        className="w-full text-xs py-2 px-3 border border-gray-300 rounded-lg focus:outline-none focus:border-purple-600 bg-white"
                      >
                        <option value="Hardware / PC Crash">Hardware / PC Crash (Moved to spare computer)</option>
                        <option value="Network / Connection Interruption">Network / Connection Interruption</option>
                        <option value="Power Blink / UPS Failure">Power Blink / Lab UPS Failure</option>
                        <option value="Browser Frozen / System Glitch">Browser Frozen / System Glitch</option>
                      </select>
                    </div>
                  </div>

                  <Button
                    variant="primary"
                    className="w-full py-2.5 font-bold shadow-md bg-purple-600 hover:bg-purple-700 text-white mt-3"
                    disabled={isResumingAttempt}
                    onClick={handleOnScreenResume}
                  >
                    {isResumingAttempt ? (
                      <span className="flex items-center justify-center gap-1.5">
                        <Loader2 size={16} className="animate-spin" /> Authorizing Terminal...
                      </span>
                    ) : (
                      <span className="flex items-center justify-center gap-1.5">
                        <CheckCircle2 size={16} /> Authorize Sitting & Resume Exam (+{customCompMinutes !== '' ? customCompMinutes : selectedCompMinutes}m)
                      </span>
                    )}
                  </Button>
                </div>
              )}

              {/* Option B: Central Academic Officer Remote Authorization Form */}
              {resumeMode === 'remote' && (
                <div className="space-y-4 text-left">
                  <div className="bg-blue-50/70 p-3.5 rounded-lg border border-blue-200 text-xs text-blue-900 leading-relaxed">
                    📡 <strong>Central Command Authorization:</strong> If your institution requires approval from the Chief Invigilator or Academic Officer desk, submit a remote ticket below. The central dashboard will review and authorize your machine instantly.
                  </div>

                  {pendingRequest || remoteRequestSent ? (
                    <div className="p-4 bg-amber-50 rounded-xl border border-amber-200 text-center space-y-3">
                      <div className="flex items-center justify-center gap-2 text-amber-800 font-bold text-sm">
                        <Loader2 size={18} className="animate-spin text-amber-600" />
                        Waiting for Central Academic Officer Approval...
                      </div>
                      <p className="text-xs text-gray-600 max-w-md mx-auto">
                        Your request for <strong>+{downtimeMinutes > 0 ? downtimeMinutes : 5} minutes</strong> compensation has been transmitted to the Academic Officer's console.
                      </p>
                      <div className="text-[11px] text-gray-500 bg-white/80 p-2 rounded-lg border border-amber-100">
                        ⚡ Live listener active. As soon as the officer clicks <em>"Approve"</em>, this screen will automatically unlock.
                      </div>
                      <button
                        type="button"
                        onClick={() => setResumeMode('onscreen')}
                        className="text-xs text-purple-700 font-semibold underline hover:text-purple-900"
                      >
                        Invigilator arrived at your desk? Use Option A Invigilator PIN instead
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                          Reason for Terminal Change:
                        </label>
                        <input
                          type="text"
                          value={resumeReason}
                          onChange={(e) => setResumeReason(e.target.value)}
                          placeholder="e.g. Lab PC blue screen, moved to PC-24"
                          className="w-full text-xs py-2 px-3 border border-gray-300 rounded-lg focus:outline-none focus:border-purple-600"
                        />
                      </div>
                      <div className="text-xs text-gray-500">
                        Requested compensation: <strong>+{downtimeMinutes > 0 ? downtimeMinutes : 5} minutes</strong> (based on system-measured technical downtime).
                      </div>
                      <Button
                        variant="primary"
                        className="w-full py-2.5 font-bold shadow-md bg-blue-600 hover:bg-blue-700 text-white"
                        disabled={isRequestingRemote}
                        onClick={handleSendRemoteRequest}
                      >
                        {isRequestingRemote ? (
                          <span className="flex items-center justify-center gap-1.5">
                            <Loader2 size={16} className="animate-spin" /> Transmitting Request...
                          </span>
                        ) : (
                          <span className="flex items-center justify-center gap-1.5">
                            <Send size={16} /> Request Remote Approval (+{downtimeMinutes > 0 ? downtimeMinutes : 5}m)
                          </span>
                        )}
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Footer note */}
          <div className="text-center text-xs text-gray-400">
            🔒 Protected by CBT Academic Integrity Security • Attempt ID: <span className="font-mono">{attempt.id.substring(0, 8)}...</span>
          </div>
        </Card>
      </div>
    );
  }

  // 4. Gatekeeper View (Multi-Session Cohort Verification)
  if (sessionGateStatus?.blocked) {
    const hasAvailableSessions = sessionGateStatus.availableSessions && sessionGateStatus.availableSessions.length > 0;

    return (
      <div className="max-w-2xl mx-auto py-12 px-4">
        <Card className="border-purple-200 shadow-xl overflow-hidden text-center p-8 space-y-6">
          <div className="w-16 h-16 bg-purple-100 text-purple-600 rounded-2xl flex items-center justify-center mx-auto shadow-inner">
            {sessionGateStatus.reason === 'pin_required' ? (
              <Key size={32} />
            ) : (
              <Shield size={32} />
            )}
          </div>

          <div>
            <span className="text-xs font-bold text-purple-600 uppercase tracking-widest">
              Cohort Gatekeeper
            </span>
            <h2 className="text-2xl font-bold text-gray-900 mt-1">
              {sessionGateStatus.reason === 'pin_required' && 'Invigilator PIN Required'}
              {sessionGateStatus.reason === 'early' && 'Session Window Not Started'}
              {sessionGateStatus.reason === 'late' && 'Session Window Concluded'}
              {sessionGateStatus.reason === 'unassigned' && (
                sessionGateStatus.session 
                  ? 'Enter Invigilator PIN to Start Exam' 
                  : 'No Active Exam Session'
              )}
            </h2>
            <p className="text-sm text-gray-600 mt-2 max-w-lg mx-auto">
              {sessionGateStatus.reason === 'pin_required' &&
                `Please request the entry PIN from your lab invigilator for '${sessionGateStatus.session?.session_name || 'this session'}'.`}
              {sessionGateStatus.reason === 'early' &&
                `Your scheduled session '${sessionGateStatus.session?.session_name}' begins on ${new Date(sessionGateStatus.session?.start_time).toLocaleString()}. Please wait until your start window.`}
              {sessionGateStatus.reason === 'late' &&
                `Your scheduled session window '${sessionGateStatus.session?.session_name}' closed on ${new Date(sessionGateStatus.session?.end_time).toLocaleString()}.`}
              {sessionGateStatus.reason === 'unassigned' && (
                sessionGateStatus.session
                  ? `Please enter the Invigilator PIN announced in your lab room for '${sessionGateStatus.session.session_name}'. Entering this PIN will lock your account into this sitting and start your assessment.`
                  : 'There are currently no active sessions scheduled for this exam. Please contact your invigilator.'
              )}
            </p>
          </div>

          {(sessionGateStatus.reason === 'pin_required' || (sessionGateStatus.reason === 'unassigned' && sessionGateStatus.session)) && (
            <div className="max-w-md mx-auto space-y-4 bg-purple-50/60 p-5 rounded-2xl border border-purple-200">
              <div className="text-center">
                <span className="text-xs uppercase font-bold text-purple-700 tracking-wider">
                  Target Sitting:
                </span>
                <h3 className="text-lg font-bold text-gray-900 mt-0.5">
                  {sessionGateStatus.session?.session_name || 'Active Session'}
                </h3>
              </div>

              <div className="max-w-xs mx-auto space-y-3">
                <div>
                  <input
                    type="password"
                    placeholder="Enter PIN"
                    value={enteredPin}
                    onChange={(e) => {
                      setEnteredPin(e.target.value);
                      setPinError('');
                    }}
                    className="w-full text-center text-2xl tracking-widest font-mono py-2.5 px-4 border-2 border-purple-300 rounded-xl focus:border-purple-600 focus:outline-none bg-white shadow-sm"
                    maxLength={12}
                    autoFocus
                  />
                  {pinError && <p className="text-xs text-red-600 mt-1.5 text-center font-medium">{pinError}</p>}
                </div>

                <Button
                  variant="primary"
                  className="w-full py-2.5 font-bold shadow-md bg-purple-600 hover:bg-purple-700 text-white"
                  disabled={joiningSessionId !== null}
                  onClick={() => {
                    if (!enteredPin.trim()) {
                      setPinError('Please enter the session PIN from your invigilator.');
                      return;
                    }
                    if (sessionGateStatus.reason === 'unassigned') {
                      if (sessionGateStatus.session.access_pin) {
                        if (enteredPin.trim() === sessionGateStatus.session.access_pin) {
                          handleJoinSession(sessionGateStatus.session, enteredPin.trim());
                        } else {
                          setPinError('Invalid Invigilator PIN. Please verify with your proctor.');
                        }
                      } else {
                        handleJoinSession(sessionGateStatus.session);
                      }
                    } else {
                      if (enteredPin.trim() === sessionGateStatus.session?.access_pin) {
                        sessionStorage.setItem(`session_pin_${sessionGateStatus.session.id}`, enteredPin.trim());
                        setSessionGateStatus(null);
                        loadQuiz();
                      } else {
                        setPinError('Invalid PIN code. Please verify with your proctor.');
                      }
                    }
                  }}
                >
                  {joiningSessionId ? (
                    <span className="flex items-center justify-center gap-1.5">
                      <Loader2 size={16} className="animate-spin" /> Locking Sitting & Starting...
                    </span>
                  ) : (
                    <span className="flex items-center justify-center gap-1.5">
                      <Key size={16} />
                      {sessionGateStatus.reason === 'unassigned' ? 'Unlock Exam & Lock Into This Sitting' : 'Verify PIN & Start Exam'}
                    </span>
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* List of Available Cohort Sessions for Unassigned, Missed, or Early Students wanting to switch */}
          {(sessionGateStatus.reason === 'unassigned' || sessionGateStatus.reason === 'late' || sessionGateStatus.reason === 'early') && hasAvailableSessions && (
            <div className="text-left space-y-3 mt-4 border-t border-purple-100 pt-5">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
                  <Calendar size={16} className="text-purple-600" />
                  {sessionGateStatus.reason === 'early'
                    ? 'Switch to Currently Active Session (Invigilator Authorization Required):'
                    : sessionGateStatus.reason === 'unassigned'
                    ? 'Writing in a Different Lab or Sitting? Select Below:'
                    : 'Scheduled Exam Sessions for this Assessment:'}
                </h4>
              </div>

              {sessionGateStatus.reason === 'early' && (
                <p className="text-xs text-amber-700 bg-amber-50 p-2.5 rounded-lg border border-amber-200">
                  ℹ️ If you arrived early to write with another group (e.g. Group A), your room invigilator can authorize an immediate cohort switch by entering their room PIN below.
                </p>
              )}

              <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
                {sessionGateStatus.availableSessions!.map((sess: any) => {
                  const now = Date.now();
                  const sStart = new Date(sess.start_time).getTime();
                  const sEnd = new Date(sess.end_time).getTime();
                  const isActive = now >= sStart && now <= sEnd;
                  const isUpcoming = now < sStart;
                  const isEnded = now > sEnd;

                  return (
                    <div
                      key={sess.id}
                      className={`p-3.5 rounded-xl border text-sm transition-all ${
                        isActive
                          ? 'border-green-300 bg-green-50/70 shadow-sm'
                          : isUpcoming
                          ? 'border-blue-200 bg-blue-50/40'
                          : 'border-gray-200 bg-gray-50 opacity-60'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <span className="font-bold text-gray-900">{sess.session_name}</span>
                          <div className="text-xs text-gray-500 mt-0.5">
                            {new Date(sess.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            {' – '}
                            {new Date(sess.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            {' · '}
                            {new Date(sess.start_time).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                          </div>
                        </div>
                        <div>
                          {isActive && (
                            <Badge variant="success">Active Now</Badge>
                          )}
                          {isUpcoming && (
                            <Badge variant="primary">Upcoming</Badge>
                          )}
                          {isEnded && (
                            <Badge variant="secondary">Concluded</Badge>
                          )}
                        </div>
                      </div>

                      {!isEnded && (
                        <div className="mt-3 pt-2.5 border-t border-gray-100 flex items-center justify-between gap-2">
                          <span className="text-xs text-gray-500">
                            {sess.access_pin ? '🔒 Invigilator PIN required' : 'Open session'}
                          </span>
                          <Button
                            size="sm"
                            variant={isActive ? 'primary' : 'outline'}
                            disabled={joiningSessionId === sess.id || (sessionGateStatus.reason === 'early' && !isActive)}
                            onClick={() => {
                              if (sess.access_pin) {
                                const pin = prompt(`Invigilator Authorization Required:\nEnter Invigilator PIN for ${sess.session_name} to authorize sitting:`);
                                if (pin !== null) {
                                  handleJoinSession(sess, pin);
                                }
                              } else {
                                handleJoinSession(sess);
                              }
                            }}
                          >
                            {joiningSessionId === sess.id ? (
                              <span className="flex items-center gap-1">
                                <Loader2 size={12} className="animate-spin" /> Joining...
                              </span>
                            ) : isActive ? (
                              <span className="flex items-center gap-1">
                                <LogIn size={13} /> {sessionGateStatus.reason === 'early' ? 'Switch Cohort & Start Exam' : 'Join & Start Exam'}
                              </span>
                            ) : (
                              'Select Session'
                            )}
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="pt-4 border-t border-gray-100 flex justify-center gap-3">
            <Button variant="secondary" onClick={() => navigate('/student/quizzes')}>
              Return to Available Quizzes
            </Button>
            {sessionGateStatus.reason !== 'pin_required' && (
              <Button variant="outline" onClick={() => loadQuiz()}>
                <RefreshCw size={14} className="mr-1.5" />
                Check Again
              </Button>
            )}
          </div>
        </Card>
      </div>
    );
  }

  // 5. SEB Enforcement - only when quiz.require_seb is true
  const isSEB = navigator.userAgent.includes('SEB');
  if (quiz?.require_seb && !isSEB && !showResults) {
    return (
      <div className="fixed inset-0 bg-gray-900 bg-opacity-95 flex items-center justify-center z-50">
        <div className="text-center space-y-6 p-8 max-w-md">
          <div className="text-red-500 flex justify-center"><AlertCircle size={64} /></div>
          <h1 className="text-2xl font-bold text-white">Safe Exam Browser Required</h1>
          <p className="text-gray-300">
            This assessment requires the Safe Exam Browser. Please go back to the available exams list and launch it properly with SEB.
          </p>
          <Button onClick={() => navigate('/student/quizzes')} className="mt-4 w-full justify-center">
            Back to Available Exams
          </Button>
        </div>
      </div>
    );
  }

  // 6. Polished Loading View while quiz and questions are being fetched
  if (loadingQuiz) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center">
        <div className="relative mb-6">
          <div className="w-16 h-16 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <Clock className="w-6 h-6 text-indigo-600 animate-pulse" />
          </div>
        </div>
        <h3 className="text-xl font-bold text-gray-900">Loading Assessment</h3>
        <p className="text-sm text-gray-500 mt-2 max-w-sm">
          Preparing your examination questions and securing the session environment...
        </p>
      </div>
    );
  }

  // 7. Error View if quiz failed to load or deadline expired
  if (quizLoadError) {
    return (
      <div className="max-w-xl mx-auto py-12 px-4">
        <Card className="text-center p-8 space-y-4 border-red-200 bg-red-50/50">
          <div className="w-16 h-16 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center mx-auto">
            <AlertCircle size={32} />
          </div>
          <h2 className="text-2xl font-bold text-gray-900">Unable to Start Assessment</h2>
          <p className="text-sm text-gray-600">{quizLoadError}</p>
          <div className="pt-4 flex justify-center gap-3">
            <Button variant="secondary" onClick={() => navigate('/student/quizzes')}>
              Back to Quizzes
            </Button>
            <Button variant="primary" onClick={() => loadQuiz()}>
              Try Again
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  // 8. Empty Questions View (Never hang indefinitely on Loading...)
  if (!quiz || !Array.isArray(questions) || questions.length === 0) {
    return (
      <div className="max-w-xl mx-auto py-12 px-4">
        <Card className="text-center p-8 space-y-4 border-amber-200">
          <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center mx-auto">
            <AlertCircle size={32} />
          </div>
          <h2 className="text-2xl font-bold text-gray-900">No Questions Available</h2>
          <p className="text-sm text-gray-600">
            This examination does not have any questions ready at this time. Please contact your instructor.
          </p>
          <div className="pt-4 flex justify-center gap-3">
            <Button variant="secondary" onClick={() => navigate('/student/quizzes')}>
              Back to Available Quizzes
            </Button>
            <Button variant="outline" onClick={() => loadQuiz()}>
              Refresh
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  const currentQuestion = questions[currentIndex];

  return (
    <div className="max-w-6xl mx-auto flex flex-col gap-4 h-[calc(100vh-120px)]">
      {/* Offline Resiliency Banner */}
      {!isOnline && (
        <div className="bg-amber-600 text-white px-4 py-3 rounded-2xl shadow-md flex items-center justify-between text-sm font-semibold shrink-0 animate-pulse">
          <div className="flex items-center gap-2.5">
            <WifiOff size={20} className="shrink-0" />
            <div>
              <p className="font-bold">Internet Connection Interrupted — Offline Protection Active</p>
              <p className="text-xs text-amber-100 font-normal">
                You can keep answering questions without interruption. All your answers are saved securely on this computer and will automatically sync to the server once reconnected.
              </p>
            </div>
          </div>
          <span className="text-xs bg-amber-750 bg-amber-800 text-amber-100 px-3 py-1.5 rounded-lg shrink-0 font-mono">
            Local Mode
          </span>
        </div>
      )}

      {/* Only show quiz interface if not terminated */}
      {!quizTerminated && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
          {quiz.deadline && (
            <Card className="bg-orange-50 border-orange-200 flex-1">
              <div className="flex items-center gap-2 text-orange-800">
                <AlertCircle size={20} />
                <span className="font-medium">
                  Deadline: {new Date(quiz.deadline).toLocaleString()}
                </span>
              </div>
            </Card>
          )}

          {/* Active Proctoring Indicators & Quick Reconnects */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Live Sync Status Pill */}
            <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold shadow-sm bg-white border-gray-200">
              {isOnline ? (
                hasUnsyncedAnswers ? (
                  <div className="flex items-center gap-1.5 text-amber-600">
                    <RefreshCw size={14} className="animate-spin" />
                    <span>Syncing...</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 text-emerald-600">
                    <CheckCircle2 size={14} />
                    <span>Cloud Synced</span>
                  </div>
                )
              ) : (
                <div className="flex items-center gap-1.5 text-amber-700">
                  <WifiOff size={14} />
                  <span>Saved Locally</span>
                </div>
              )}
            </div>

            {quiz.enable_camera_proctoring && (
              cameraStream ? (
                <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold shadow-sm bg-emerald-50 border-emerald-300 text-emerald-800">
                  <Video size={15} />
                  <span>Camera Active</span>
                </div>
              ) : (
                <button
                  onClick={startCamera}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold shadow-sm bg-red-50 border-red-300 text-red-700 hover:bg-red-100 transition-colors animate-pulse"
                >
                  <Video size={15} />
                  <span>Enable Camera</span>
                </button>
              )
            )}

            {quiz.enable_screen_recording && (
              isScreenRecording ? (
                <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold shadow-sm bg-purple-50 border-purple-300 text-purple-800">
                  <Monitor size={15} />
                  <span>Screen Recorded</span>
                </div>
              ) : (
                <button
                  onClick={startScreenRecording}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold shadow-sm bg-red-50 border-red-300 text-red-700 hover:bg-red-100 transition-colors animate-pulse"
                >
                  <Monitor size={15} />
                  <span>Resume Screen Share</span>
                </button>
              )
            )}
          </div>
          
          <Card className={`flex-1 border-2 ${timeLeft < 300 ? 'border-red-400 bg-red-50' : 'border-blue-400 bg-blue-50'}`}>
            <div className={`flex items-center justify-center gap-3 ${timeLeft < 300 ? 'text-red-700' : 'text-blue-700'}`}>
              <Clock size={24} className={timeLeft < 60 ? 'animate-pulse' : ''} />
              <div className="text-center">
                <p className="text-sm font-semibold uppercase tracking-wider opacity-80">Time Remaining</p>
                <p className="text-3xl font-bold font-mono tracking-widest">{formatTime(timeLeft)}</p>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Only show quiz interface if not terminated */}
      {!quizTerminated && (
        <div className="flex-1 min-h-0 flex flex-col lg:flex-row gap-6 items-start">
          {/* Left Column: Question Content & Actions */}
          <div className="flex-1 w-full flex flex-col h-full space-y-4 min-h-0">
            <Card className="flex-1 min-h-0 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent pr-2">
              <div className="space-y-6">
                <div>
                  <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-bold text-gray-900">
                        Question {currentIndex + 1}
                      </h2>
                      {currentQuestion.topic && (
                        <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
                          {currentQuestion.topic}
                        </span>
                      )}
                    </div>
                    <span className="text-sm text-gray-600 font-semibold">{currentQuestion.marks} marks</span>
                  </div>
                  <p className="text-gray-900">{currentQuestion.question_text}</p>
                </div>

                {currentQuestion.question_type === 'mcq' && (
                  <div className="space-y-3">
                    {(() => {
                      const options = parseOptions(currentQuestion.options);

                      return options.map((option, index) => (
                        <label key={index} className="flex items-center space-x-3 cursor-pointer">
                          <input
                            type="radio"
                            name={`question-${currentQuestion.id}`}
                            value={option}
                            checked={answers[currentQuestion.id] === option}
                            onChange={(e) => handleAnswerChange(currentQuestion.id, e.target.value)}
                            className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="text-gray-700">{option}</span>
                        </label>
                      ));
                    })()}
                  </div>
                )}

                {currentQuestion.question_type === 'true_false' && (
                  <div className="space-y-3">
                    <label className="flex items-center space-x-3 cursor-pointer">
                      <input
                        type="radio"
                        name={`question-${currentQuestion.id}`}
                        value="true"
                        checked={answers[currentQuestion.id] === 'true'}
                        onChange={(e) => handleAnswerChange(currentQuestion.id, e.target.value)}
                        className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-gray-700">True</span>
                    </label>
                    <label className="flex items-center space-x-3 cursor-pointer">
                      <input
                        type="radio"
                        name={`question-${currentQuestion.id}`}
                        value="false"
                        checked={answers[currentQuestion.id] === 'false'}
                        onChange={(e) => handleAnswerChange(currentQuestion.id, e.target.value)}
                        className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-gray-700">False</span>
                    </label>
                  </div>
                )}

                {currentQuestion.question_type === 'essay' && (
                  <Textarea
                    value={answers[currentQuestion.id] || ''}
                    onChange={(e) => handleAnswerChange(currentQuestion.id, e.target.value)}
                    placeholder="Enter your answer here..."
                    rows={4}
                  />
                )}

                <div className="flex flex-col sm:flex-row sm:items-center justify-between mt-8 pt-6 border-t border-gray-100 gap-4">
                  <div className="flex items-center space-x-2">
                    <label className="flex items-center cursor-pointer group">
                      <div className="relative">
                        <input
                          type="checkbox"
                          className="sr-only"
                          checked={markedForReview.has(currentIndex)}
                          onChange={(e) => handleFlagChange(currentIndex, e.target.checked)}
                        />
                        <div className={`block w-11 h-6 rounded-full transition-colors ${markedForReview.has(currentIndex) ? 'bg-orange-500' : 'bg-gray-200 group-hover:bg-gray-300'}`}></div>
                        <div className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${markedForReview.has(currentIndex) ? 'transform translate-x-5' : ''} shadow-sm`}></div>
                      </div>
                      <span className="ml-3 text-sm font-medium text-gray-700 group-hover:text-gray-900 transition-colors">
                        Mark for review
                      </span>
                    </label>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setShowFlaggedOnly(!showFlaggedOnly)}
                      className={`text-xs ${
                        showFlaggedOnly 
                          ? 'bg-orange-500 text-white hover:bg-orange-600 border-orange-500' 
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      <Flag size={14} className="mr-1" />
                      {showFlaggedOnly ? 'Show All' : 'Flagged Only'}
                    </Button>
                    <span className="text-xs text-gray-500 font-medium bg-gray-100 px-2 py-1 rounded-full">
                      {markedForReview.size} flagged
                    </span>
                  </div>
                </div>
              </div>
            </Card>

            {/* Prev/Next Navigation Under Question */}
            <div className="shrink-0 flex items-center justify-between bg-white p-4 rounded-xl shadow-sm border border-gray-200">
              <Button
                variant="secondary"
                onClick={() => showFlaggedOnly ? navigateToPreviousFlagged() : setCurrentIndex(Math.max(0, currentIndex - 1))}
                disabled={showFlaggedOnly ? getFlaggedQuestions().indexOf(currentIndex) <= 0 : currentIndex === 0}
                className="w-auto justify-center"
              >
                <ChevronLeft size={18} className="mr-1" />
                {showFlaggedOnly ? 'Previous Flagged' : 'Previous'}
              </Button>

              {showFlaggedOnly ? (
                getFlaggedQuestions().indexOf(currentIndex) === getFlaggedQuestions().length - 1 ? (
                  <Button onClick={() => setShowSubmitModal(true)} className="w-auto justify-center">
                    Submit Quiz
                  </Button>
                ) : (
                  <Button onClick={() => navigateToNextFlagged()} className="w-auto justify-center">
                    Next Flagged
                    <ChevronRight size={18} className="ml-1" />
                  </Button>
                )
              ) : currentIndex === questions.length - 1 ? (
                <Button onClick={() => setShowSubmitModal(true)} className="w-auto justify-center">
                  Submit Quiz
                </Button>
              ) : (
                <Button onClick={() => setCurrentIndex(Math.min(questions.length - 1, currentIndex + 1))} className="w-auto justify-center">
                  Next
                  <ChevronRight size={18} className="ml-1" />
                </Button>
              )}
            </div>
          </div>

          {/* Right Column: Quiz Navigation Numbers */}
          <div className="w-full lg:w-72 shrink-0 h-full flex flex-col min-h-0">
            <Card className="flex flex-col h-full min-h-0">
              <h3 className="text-sm font-semibold text-gray-800 mb-4 uppercase tracking-wider shrink-0 flex items-center gap-2">
                <Flag size={16} className="text-blue-600" />
                Quiz Navigation
              </h3>

              {/* Legend for question statuses */}
              <div className="mb-4 pb-4 border-b border-gray-100 shrink-0 grid grid-cols-2 gap-2">
                <div className="flex items-center gap-2 text-xs text-gray-600">
                  <div className="w-3 h-3 rounded bg-blue-600 shrink-0"></div> Current
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-600">
                  <div className="w-3 h-3 rounded bg-green-100 border border-green-500 shrink-0"></div> Answered
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-600">
                  <div className="w-3 h-3 rounded bg-orange-500 shrink-0"></div> Flagged
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-600">
                  <div className="w-3 h-3 rounded bg-gray-100 border border-gray-300 shrink-0"></div> Not Visited
                </div>
              </div>

              <div className="flex flex-wrap gap-2 overflow-y-auto flex-1 content-start pr-1 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent min-h-0">
                {(() => {
                  const itemsPerPage = 30;
                  const navItems = showFlaggedOnly ? getFlaggedQuestions() : questions.map((_, index) => index);
                  const totalNavPages = Math.ceil(navItems.length / itemsPerPage);
                  const currentNavItems = navItems.slice(navPage * itemsPerPage, (navPage + 1) * itemsPerPage);

                  return (
                    <>
                      {currentNavItems.map((index) => {
                        const isCurrent = index === currentIndex;
                        const isFlagged = markedForReview.has(index);
                        const isAnswered = answers[questions[index]?.id] !== undefined && answers[questions[index]?.id] !== '';

                        let statusClasses = '';
                        if (isCurrent) {
                          statusClasses = 'bg-blue-600 text-white ring-2 ring-blue-400 ring-offset-1 shadow-sm';
                        } else if (isFlagged) {
                          statusClasses = 'bg-orange-500 text-white shadow-sm';
                        } else if (isAnswered) {
                          statusClasses = 'bg-green-100 text-green-800 border border-green-500 font-semibold';
                        } else {
                          statusClasses = 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-300';
                        }

                        return (
                          <button
                            key={index}
                            onClick={() => setCurrentIndex(index)}
                            className={`w-9 h-9 rounded-lg text-sm font-medium transition-all flex items-center justify-center ${statusClasses}`}
                          >
                            {index + 1}
                          </button>
                        );
                      })}
                      
                      {totalNavPages > 1 && (
                        <div className="w-full flex items-center justify-between mt-6 border-t border-gray-100 pt-4 shrink-0">
                          <button
                            disabled={navPage === 0}
                            onClick={() => setNavPage(p => Math.max(0, p - 1))}
                            className={`flex items-center justify-center w-8 h-8 rounded-full transition-all ${
                              navPage === 0 
                                ? 'text-gray-300 bg-gray-50 cursor-not-allowed' 
                                : 'text-gray-700 bg-white hover:bg-gray-50 border border-gray-200 shadow-sm'
                            }`}
                            title="Previous Questions"
                          >
                            <ChevronLeft size={16} />
                          </button>
                          
                          <div className="text-xs font-semibold text-gray-600 bg-gray-50/80 px-3 py-1.5 rounded-full border border-gray-100/80 shadow-[inset_0_1px_2px_rgba(0,0,0,0.03)] flex items-center gap-1.5 tracking-wide">
                            <span className="text-gray-800">{navPage * itemsPerPage + 1}-{Math.min((navPage + 1) * itemsPerPage, navItems.length)}</span>
                            <span className="font-medium text-gray-400 uppercase text-[10px]">of</span>
                            <span className="text-gray-800">{navItems.length}</span>
                          </div>

                          <button
                            disabled={navPage === totalNavPages - 1}
                            onClick={() => setNavPage(p => Math.min(totalNavPages - 1, p + 1))}
                            className={`flex items-center justify-center w-8 h-8 rounded-full transition-all ${
                              navPage === totalNavPages - 1 
                                ? 'text-gray-300 bg-gray-50 cursor-not-allowed' 
                                : 'text-gray-700 bg-white hover:bg-gray-50 border border-gray-200 shadow-sm'
                            }`}
                            title="Next Questions"
                          >
                            <ChevronRight size={16} />
                          </button>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* Only show submit modal if not terminated */}
      {!quizTerminated && (
        <Modal
          isOpen={showSubmitModal}
          onClose={() => setShowSubmitModal(false)}
          title="Submit Quiz"
        >
          <p className="text-gray-700">
            Are you sure you want to submit your quiz? You won't be able to change your answers after submission.
          </p>
          <p className="text-sm text-gray-600 mt-2">
            Answered: {Object.keys(answers).length} of {questions.length}
          </p>

          <div className="flex justify-end gap-3 mt-6">
            <Button variant="secondary" onClick={() => setShowSubmitModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={loading}>
              {loading ? 'Submitting...' : 'Submit'}
            </Button>
          </div>
        </Modal>
      )}

      {/* Floating Webcam Proctoring Widget */}
      {quiz.enable_camera_proctoring && !quizTerminated && !showResults && (
        <div className={`fixed bottom-4 right-4 z-40 bg-gray-900 border-2 ${cameraStream ? 'border-emerald-500' : 'border-red-500'} rounded-2xl shadow-2xl p-2.5 transition-all duration-300 ${isCameraMinimized ? 'w-48' : 'w-64'}`}>
          <div className="flex items-center justify-between text-white text-xs px-1 pb-1.5 mb-1.5 border-b border-gray-700">
            <div className="flex items-center gap-2 font-medium">
              <span className={`w-2.5 h-2.5 rounded-full ${cameraStream ? 'bg-emerald-400 animate-ping' : 'bg-red-500'}`}></span>
              <span>Proctoring Cam</span>
            </div>
            <button
              onClick={() => setIsCameraMinimized(!isCameraMinimized)}
              className="text-gray-400 hover:text-white text-xs px-1.5 py-0.5 rounded bg-gray-800 hover:bg-gray-700"
              title={isCameraMinimized ? "Expand preview" : "Minimize preview"}
            >
              {isCameraMinimized ? '▲ Expand' : '▼ Minimize'}
            </button>
          </div>
          {!isCameraMinimized ? (
            <div className="relative rounded-xl overflow-hidden bg-black aspect-video flex items-center justify-center">
              {cameraStream ? (
                <video
                  ref={cameraVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover transform scale-x-[-1]"
                />
              ) : (
                <div className="text-center p-3 text-red-400 text-xs flex flex-col items-center gap-1.5">
                  <AlertCircle size={24} />
                  <span className="font-semibold">Camera Inactive</span>
                  <span className="text-[10px] text-gray-400">{cameraError || 'Please allow webcam permission'}</span>
                </div>
              )}
            </div>
          ) : (
            <div className="text-[11px] text-emerald-400 text-center py-1 font-mono">
              ● Monitoring Active
            </div>
          )}
        </div>
      )}

      {/* Screen Recording Warning Modal if permission denied or unsupported */}
      {quiz.enable_screen_recording && screenError && !quizTerminated && !showResults && (
        <Modal
          isOpen={!!screenError}
          onClose={() => setScreenError(null)}
          title="Screen Recording Required"
        >
          <div className="space-y-4">
            <div className="flex items-center gap-3 text-amber-600 bg-amber-50 p-3 rounded-lg border border-amber-200">
              <Monitor size={24} className="shrink-0" />
              <p className="text-sm">{screenError}</p>
            </div>
            <p className="text-xs text-gray-600">
              This assessment requires screen recording. If you are taking this on a mobile device, please open this assessment on a laptop or desktop computer.
            </p>
            <div className="flex justify-end gap-2">
              <Button onClick={() => setScreenError(null)}>Dismiss</Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Proctoring Readiness & Setup Modal */}
      {(quiz.enable_camera_proctoring || quiz.enable_screen_recording) && !quizTerminated && !showResults && (
        <Modal
          isOpen={showProctoringSetup}
          onClose={() => setShowProctoringSetup(false)}
          title="Proctoring & Device Readiness"
        >
          <div className="space-y-4">
            <p className="text-sm text-gray-700">
              This assessment includes real-time proctoring configured by your lecturer. Please ensure your device permissions are enabled before proceeding:
            </p>

            <div className="space-y-3">
              {quiz.enable_camera_proctoring && (
                <div className="flex items-center justify-between p-3 rounded-lg border bg-gray-50">
                  <div className="flex items-center gap-2.5">
                    <Video size={18} className={cameraStream ? 'text-emerald-600' : 'text-blue-600'} />
                    <div>
                      <div className="text-sm font-semibold text-gray-900">Webcam Proctoring</div>
                      <div className="text-xs text-gray-500">
                        {cameraStream ? 'Active and streaming' : cameraError || 'Webcam permission required'}
                      </div>
                    </div>
                  </div>
                  {cameraStream ? (
                    <span className="text-xs font-semibold text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-full">
                      ✓ Ready
                    </span>
                  ) : (
                    <Button size="sm" onClick={startCamera}>
                      Enable Camera
                    </Button>
                  )}
                </div>
              )}

              {quiz.enable_screen_recording && (
                <div className="flex items-center justify-between p-3 rounded-lg border bg-gray-50">
                  <div className="flex items-center gap-2.5">
                    <Monitor size={18} className={isScreenRecording ? 'text-purple-600' : 'text-indigo-600'} />
                    <div>
                      <div className="text-sm font-semibold text-gray-900">Screen Recording</div>
                      <div className="text-xs text-gray-500">
                        {isScreenRecording ? 'Screen share active' : screenError || 'Click to select screen (Desktop/Laptop)'}
                      </div>
                    </div>
                  </div>
                  {isScreenRecording ? (
                    <span className="text-xs font-semibold text-purple-700 bg-purple-100 px-2.5 py-1 rounded-full">
                      ✓ Sharing
                    </span>
                  ) : (
                    <Button size="sm" onClick={startScreenRecording}>
                      Share Screen
                    </Button>
                  )}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t">
              <Button onClick={() => setShowProctoringSetup(false)}>
                I'm Ready - Begin Assessment
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
