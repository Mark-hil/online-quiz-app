import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Clock, ChevronLeft, ChevronRight, Flag, AlertCircle, Video, Monitor } from 'lucide-react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import Textarea from '../../components/ui/Textarea';
import { db, Quiz, Question } from '../../lib/database';
import { useAuth } from '../../contexts/AuthContext';
import { parseOptions, prepareQuizQuestions } from '../../utils/quizUtils';
import { uploadProctoringSnapshot } from '../../lib/cloudinary';

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
  const [tabSwitchCount, setTabSwitchCount] = useState(0);
  const [copyAttempts, setCopyAttempts] = useState(0);
  const [rightClickCount, setRightClickCount] = useState(0);
  const [quizTerminated, setQuizTerminated] = useState(false);
  const [terminationReason, setTerminationReason] = useState('');
  const [showResults, setShowResults] = useState(false);
  const [completedAttemptData, setCompletedAttemptData] = useState<any>(null);
  const [timesUp, setTimesUp] = useState(false);

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
        let totalMarksObtained = 0;
        const totalPossibleMarks = questions.reduce((sum, q) => sum + q.marks, 0);
        const ops: (() => Promise<any>)[] = [];

        for (const question of questions) {
          const studentAnswer = answers[question.id];
          if (!studentAnswer) continue;

          const isCorrect =
            question.question_type === 'mcq' || question.question_type === 'true_false'
              ? studentAnswer === question.correct_answer
              : studentAnswer.toLowerCase().trim() === question.correct_answer?.toLowerCase().trim();

          if (isCorrect) totalMarksObtained += question.marks;

          ops.push(() => db.upsertStudentAnswer({
            attempt_id: attemptId,
            question_id: question.id,
            answer_text: studentAnswer,
            is_correct: isCorrect,
            marks_obtained: isCorrect ? question.marks : 0,
            lecturer_comment: '',
          }));
        }

        // Run all DB ops in parallel chunks of 10
        const chunkSize = 10;
        for (let i = 0; i < ops.length; i += chunkSize) {
          await Promise.all(ops.slice(i, i + chunkSize).map(fn => fn()));
        }

        const scorePercentage = totalPossibleMarks > 0 ? (totalMarksObtained / totalPossibleMarks) * 100 : 0;

        logProctoringEvent('quiz_terminated', `Quiz terminated: ${reason}`);

        await db.updateQuizAttempt(attemptId, {
          status: 'graded' as const,
          score: Number(scorePercentage.toFixed(2)),
          submitted_at: new Date().toISOString(),
          graded_at: new Date().toISOString(),
          cheated: true,
          cheating_reason: reason,
          tab_switch_count: tabSwitchCount,
          copy_attempts: copyAttempts,
          right_click_count: rightClickCount,
          user_agent: navigator.userAgent,
          suspicious_activity: activityLogsRef.current,
        });

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
        };
        await db.updateQuizAttempt(attemptId, payload);
      } catch (e) {
        // silent heartbeat error
      }
    }, 15000);

    return () => clearInterval(interval);
  }, [attemptId, quizTerminated, showResults, timeLeft > 0, tabSwitchCount, copyAttempts, rightClickCount]);

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

  const loadQuiz = async () => {
    if (!id || !user) return;

    // Fetch quiz, questions, and existing attempts in parallel
    const [quizData, existingAttempts] = await Promise.all([
      db.getQuiz(id),
      db.getQuizAttempts(id, user.id),
    ]);

    if (!quizData) return;

    // Check if deadline has passed
    if (quizData.deadline && new Date(quizData.deadline) < new Date()) {
      alert('This quiz has expired and is no longer available.');
      navigate('/student/available-quizzes');
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

    let currentAttemptId = '';
    const answerMap: { [key: string]: string } = {};
    let loadedAnswers: any[] = [];

    if (inProgressAttempt) {
      const serverNow = inProgressAttempt.current_db_time ? new Date(inProgressAttempt.current_db_time).getTime() : Date.now();
      const attemptAgeMs = serverNow - new Date(inProgressAttempt.started_at).getTime();
      const totalSeconds = quizData.duration_minutes * 60;
      const elapsedSeconds = Math.floor(attemptAgeMs / 1000);
      const remainingSeconds = Math.max(0, totalSeconds - elapsedSeconds);
      const oneDayMs = 24 * 60 * 60 * 1000;

      if (attemptAgeMs > oneDayMs) {
        // Stale attempt — create a fresh one
        const newAttempt = await db.createQuizAttempt({
          quiz_id: id,
          student_id: user.id,
          started_at: new Date().toISOString(),
          status: 'in_progress',
        });
        currentAttemptId = newAttempt.id;
        setTimeLeft(totalSeconds);
      } else {
        // Resume existing attempt — restore timer and saved answers
        currentAttemptId = inProgressAttempt.id;
        setTimeLeft(remainingSeconds);

        // Load all previously saved answers and restore them into state
        loadedAnswers = await db.getStudentAnswers(currentAttemptId);
        loadedAnswers.forEach((a: any) => {
          if (a.answer_text) answerMap[a.question_id] = a.answer_text;
        });

        if (remainingSeconds === 0) {
          // Time already expired while they were away — auto-submit
          setTimesUp(true);
          setTimeout(() => handleSubmitRef.current(), 500);
        }
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
      setTimeLeft(quizData.duration_minutes * 60);
    }

    setAttemptId(currentAttemptId);
    setAnswers(answerMap);

    // Fetch and prepare questions — use attemptId as randomisation seed
    // so the order is always identical when resuming
    const questionsData = await db.getQuestions(id);
    const preparedQuestions = prepareQuizQuestions(
      questionsData as Question[],
      quizData?.randomize_questions || false,
      quizData?.randomize_options || false,
      currentAttemptId
    );
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
  };

  const handleAnswerChange = async (questionId: string, answer: string) => {
    setAnswers({ ...answers, [questionId]: answer });

    if (!attemptId) return;

    if (debounceTimerRef.current[questionId]) {
      clearTimeout(debounceTimerRef.current[questionId]);
    }

    debounceTimerRef.current[questionId] = setTimeout(async () => {
      try {
        await db.upsertStudentAnswer({
          attempt_id: attemptId,
          question_id: questionId,
          answer_text: answer,
          is_correct: null,
          marks_obtained: null,
          lecturer_comment: '',
        });
      } catch (error) {
        console.error('Failed to auto-save answer:', error);
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

    // Check if deadline has passed before submitting
    if (quiz?.deadline && new Date(quiz.deadline) < new Date()) {
      alert('The deadline for this quiz has passed. Your submission cannot be accepted.');
      navigate('/student/available-quizzes');
      return;
    }

    setLoading(true);

    try {
      let totalMarksObtained = 0;

      const updatePromises = [];

      for (const question of questions) {
        const answer = answers[question.id];
        if (answer === undefined) continue;

        let isCorrect = null;
        let marksObtained = null;

        if (question.question_type !== 'essay') {
          isCorrect = answer === question.correct_answer;
          marksObtained = isCorrect ? question.marks : 0;
          totalMarksObtained += marksObtained;
        }

        updatePromises.push(() => db.upsertStudentAnswer({
          attempt_id: attemptId,
          question_id: question.id,
          answer_text: answer,
          is_correct: isCorrect,
          marks_obtained: marksObtained,
          lecturer_comment: '',
        }));
      }

      // Execute updates in chunks of 10 to avoid connection pool exhaustion while being fast
      const chunkSize = 10;
      for (let i = 0; i < updatePromises.length; i += chunkSize) {
        const chunk = updatePromises.slice(i, i + chunkSize);
        await Promise.all(chunk.map(fn => fn()));
      }

      // Calculate and save the total score as percentage
      const totalPossibleMarks = questions.reduce((sum, q) => sum + q.marks, 0);
      const scorePercentage = totalPossibleMarks > 0 ? (totalMarksObtained / totalPossibleMarks) * 100 : 0;
      
      console.log('Submitting quiz with:', {
        attemptId,
        totalMarksObtained,
        totalPossibleMarks,
        scorePercentage,
      });
      
      // determine if any essay questions need manual grading
      const hasEssay = questions.some(q => q.question_type === 'essay');
      const newStatus: 'submitted' | 'graded' = hasEssay ? 'submitted' : 'graded';

      const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      const isSuspicious = tabSwitchCount > (isMobileDevice ? 6 : 2) || copyAttempts > 2;

      const updateData: any = {
        submitted_at: new Date().toISOString(),
        status: newStatus,
        score: Number(scorePercentage.toFixed(2)),
        tab_switch_count: tabSwitchCount,
        copy_attempts: copyAttempts,
        right_click_count: rightClickCount,
        user_agent: navigator.userAgent,
        suspicious_activity: activityLogsRef.current,
        cheated: isSuspicious,
        cheating_reason: isSuspicious
          ? `Flagged for lecturer review: ${tabSwitchCount} tab switch(es), ${copyAttempts} copy attempt(s).`
          : undefined,
      };
      if (!hasEssay) {
        // auto-graded; mark graded_at timestamp immediately
        updateData.graded_at = new Date().toISOString();
      }

      const updateResult = await db.updateQuizAttempt(attemptId, updateData);
      console.log('Update result:', updateResult);

      // Stop camera and screen recording streams
      cameraStream?.getTracks().forEach(t => t.stop());
      screenStream?.getTracks().forEach(t => t.stop());

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

  if (!quiz || !Array.isArray(questions) || questions.length === 0) {
    return <div>Loading...</div>;
  }

  // SEB Enforcement - only when quiz.require_seb is true
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

  // Show a full-screen lock when time is up — prevents any further interaction
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

  // Show results screen if quiz has been completed
  if (showResults && completedAttemptData) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <Card>
          <div className="text-center space-y-6">
            <div className="text-green-600 text-6xl">✅</div>
            <h1 className="text-3xl font-bold text-gray-900">Quiz Completed</h1>
            <div className="bg-gray-50 rounded-lg p-6">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">{quiz.title}</h2>
              <div className="grid grid-cols-2 gap-4 text-left">
                <div>
                  <p className="text-sm text-gray-600">Status</p>
                  <p className="font-medium capitalize">{completedAttemptData.status}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Score</p>
                  <p className="font-medium text-2xl text-blue-600">
                    {quiz.show_results_immediately === false ? 'Hidden' : (completedAttemptData.score !== null ? `${Number(completedAttemptData.score).toFixed(2)}%` : 'Pending')}
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

  // Show termination screen if quiz was terminated
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

  const currentQuestion = questions[currentIndex];

  return (
    <div className="max-w-6xl mx-auto flex flex-col gap-4 h-[calc(100vh-120px)]">
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
          {(quiz.enable_camera_proctoring || quiz.enable_screen_recording) && (
            <div className="flex flex-wrap items-center gap-2">
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
          )}
          
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
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-bold text-gray-900">
                      Question {currentIndex + 1}
                    </h2>
                    <span className="text-sm text-gray-600">{currentQuestion.marks} marks</span>
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
