import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, ShieldAlert, ShieldCheck, Eye, 
  Video, Smartphone, Laptop, Search, RefreshCw, 
  User, CheckCircle, Copy, ExternalLink, Cloud, Database
} from 'lucide-react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { db, Quiz, QuizAttempt } from '../../lib/database';
import { useAuth } from '../../contexts/AuthContext';
import { getCloudinaryConfig, getOptimizedCloudinaryUrl } from '../../lib/cloudinary';

interface StudentAttemptItem extends QuizAttempt {
  student_name: string;
  index_number: string;
  answered_count?: number;
  total_questions?: number;
  latest_snapshot?: string | null;
}

export default function LiveProctoring() {
  const { quizId } = useParams<{ quizId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [attempts, setAttempts] = useState<StudentAttemptItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRisk, setFilterRisk] = useState<'all' | 'flagged' | 'active' | 'completed'>('all');
  const [selectedStudent, setSelectedStudent] = useState<StudentAttemptItem | null>(null);
  const [isInspectorOpen, setIsInspectorOpen] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [expandedSnapshot, setExpandedSnapshot] = useState<{ url: string; title: string; studentName?: string; time?: string } | null>(null);

  const cloudinaryConfig = getCloudinaryConfig();

  useEffect(() => {
    loadData();
  }, [quizId]);

  // Real-time polling every 5 seconds
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      loadData(false);
    }, 5000);
    return () => clearInterval(interval);
  }, [quizId, autoRefresh]);

  const loadData = async (showLoadingSpinner = true) => {
    if (!quizId || !user) return;
    if (showLoadingSpinner) setLoading(true);

    try {
      const [quizData, attemptsData, questionsData] = await Promise.all([
        db.getQuiz(quizId),
        db.getQuizAttempts(quizId),
        db.getQuestions(quizId),
      ]);

      if (quizData) {
        setQuiz(quizData as Quiz);
      }

      // Fetch student profiles for all attempt student IDs
      const studentIds = [...new Set(attemptsData.map((a: any) => a.student_id))];
      const profiles = studentIds.length > 0 ? await db.getProfilesByIds(studentIds) : [];
      const profileMap = new Map(profiles.map((p: any) => [p.id, p]));

      // Format attempts with telemetry
      const formatted: StudentAttemptItem[] = await Promise.all(
        attemptsData.map(async (a: any) => {
          const profile = profileMap.get(a.student_id);
          let parsedLogs: any[] = [];
          let latestSnap: string | null = null;

          if (a.suspicious_activity) {
            try {
              parsedLogs = typeof a.suspicious_activity === 'string'
                ? JSON.parse(a.suspicious_activity)
                : a.suspicious_activity;

              // Find the most recent snapshot in logs
              if (Array.isArray(parsedLogs)) {
                for (let i = parsedLogs.length - 1; i >= 0; i--) {
                  if (parsedLogs[i].snapshot) {
                    latestSnap = parsedLogs[i].snapshot;
                    break;
                  }
                }
              }
            } catch (e) {
              // ignore parse errors
            }
          }

          // Count answered questions
          const answers = await db.getStudentAnswers(a.id);
          const answeredCount = answers.filter((ans: any) => ans.answer_text && ans.answer_text.trim() !== '').length;

          return {
            ...a,
            student_name: profile?.name || 'Unknown Student',
            index_number: profile?.index_number || 'N/A',
            answered_count: answeredCount,
            total_questions: questionsData.length,
            latest_snapshot: latestSnap,
          };
        })
      );

      // Prioritize high-risk students at the top
      formatted.sort((a, b) => {
        const getRiskScore = (item: StudentAttemptItem) => {
          if (item.cheated) return 100;
          let score = 0;
          score += (item.tab_switch_count || 0) * 10;
          score += (item.copy_attempts || 0) * 15;
          score += (item.right_click_count || 0) * 5;
          if (item.status === 'in_progress') score += 1;
          return score;
        };
        return getRiskScore(b) - getRiskScore(a);
      });

      setAttempts(formatted);
      setLastRefreshed(new Date());

      // Update currently selected student in inspector if open
      if (selectedStudent) {
        const updated = formatted.find(s => s.id === selectedStudent.id);
        if (updated) setSelectedStudent(updated);
      }
    } catch (err) {
      console.error('Failed to load live proctoring data:', err);
    } finally {
      if (showLoadingSpinner) setLoading(false);
    }
  };

  const handleForceSubmit = async (attempt: StudentAttemptItem) => {
    if (!confirm(`Force submit exam for ${attempt.student_name}? This will grade their currently saved answers.`)) return;

    try {
      const questions = await db.getQuestions(attempt.quiz_id);
      const studentAnswers = await db.getStudentAnswers(attempt.id);
      const answerMap = new Map(studentAnswers.map((a: any) => [a.question_id, a]));

      let totalMarks = 0;
      let marksObtained = 0;

      for (const question of questions) {
        totalMarks += question.marks;
        if (question.question_type === 'essay') continue;
        const sa = answerMap.get(question.id) as any;
        if (sa) {
          const isCorrect = sa.answer_text === question.correct_answer;
          marksObtained += isCorrect ? question.marks : 0;
        }
      }

      const scorePercentage = totalMarks > 0 ? (marksObtained / totalMarks) * 100 : 0;
      const hasEssay = questions.some((q: any) => q.question_type === 'essay');

      await db.updateQuizAttempt(attempt.id, {
        status: hasEssay ? 'submitted' : 'graded',
        score: Number(scorePercentage.toFixed(2)),
        submitted_at: new Date().toISOString(),
        graded_at: hasEssay ? null : new Date().toISOString(),
      });

      alert(`Submitted! ${attempt.student_name} received ${scorePercentage.toFixed(1)}%`);
      await loadData(false);
    } catch (err) {
      console.error('Force submit failed:', err);
      alert('Failed to force submit attempt.');
    }
  };

  const handleToggleCheating = async (attempt: StudentAttemptItem) => {
    const isCurrentlyFlagged = attempt.cheated;
    const promptMsg = isCurrentlyFlagged
      ? `Clear the cheating flag for ${attempt.student_name}?`
      : `Flag ${attempt.student_name} for academic integrity violation?`;

    if (!confirm(promptMsg)) return;

    let reason = attempt.cheating_reason || '';
    if (!isCurrentlyFlagged) {
      const entered = prompt('Reason for flagging (e.g. Tab switching during invigilation):', 'Flagged during live invigilation');
      if (entered === null) return;
      reason = entered.trim() || 'Flagged during live invigilation';
    }

    try {
      await db.updateQuizAttempt(attempt.id, {
        cheated: !isCurrentlyFlagged,
        cheating_reason: !isCurrentlyFlagged ? reason : null,
      });
      await loadData(false);
    } catch (err) {
      console.error('Failed to update flag:', err);
      alert('Failed to update flag.');
    }
  };

  // Filter students
  const filteredAttempts = attempts.filter((item) => {
    const matchesSearch = 
      item.student_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.index_number.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (filterRisk === 'flagged') {
      return item.cheated || (item.tab_switch_count || 0) > 0 || (item.copy_attempts || 0) > 0;
    }
    if (filterRisk === 'active') {
      return item.status === 'in_progress';
    }
    if (filterRisk === 'completed') {
      return item.status === 'submitted' || item.status === 'graded';
    }
    return true;
  });

  // Calculate statistics
  const totalStudents = attempts.length;
  const activeCount = attempts.filter(a => a.status === 'in_progress').length;
  const flaggedCount = attempts.filter(a => a.cheated || (a.tab_switch_count || 0) > 1 || (a.copy_attempts || 0) > 0).length;
  const submittedCount = attempts.filter(a => a.status === 'submitted' || a.status === 'graded').length;

  if (loading && !quiz) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-3">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-gray-600 font-medium">Connecting to Live Exam Proctoring Feed...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Header & Navigation */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
        <div className="flex items-center gap-3">
          <Button variant="secondary" size="sm" onClick={() => navigate('/lecturer/my-quizzes')}>
            <ArrowLeft size={16} />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping"></span>
              <h1 className="text-xl font-bold text-gray-900">{quiz?.title || 'Exam'} - Live Invigilation</h1>
              {cloudinaryConfig.isConfigured ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-sky-50 text-sky-700 border border-sky-200" title={`Cloudinary Cloud: ${cloudinaryConfig.cloudName}`}>
                  <Cloud size={12} className="text-sky-600" /> Cloudinary CDN
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200" title="Add VITE_CLOUDINARY_CLOUD_NAME and VITE_CLOUDINARY_UPLOAD_PRESET to .env to offload images from DB">
                  <Database size={12} className="text-amber-600" /> DB Storage
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              Subject: {quiz?.subject} • Duration: {quiz?.duration_minutes} mins • 
              Security: {quiz?.require_seb ? '🔒 SEB' : '📱 Mobile/Browser Allowed'} • 
              {quiz?.enable_camera_proctoring ? '📹 Cam On' : 'Cam Off'} • 
              {quiz?.enable_screen_recording ? '🖥️ Screen Rec On' : 'Screen Rec Off'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 self-end md:self-auto">
          <div className="text-right text-xs text-gray-500">
            <div>Last updated: <span className="font-mono font-medium">{lastRefreshed.toLocaleTimeString()}</span></div>
            <div className="text-[10px] text-emerald-600 font-semibold">{autoRefresh ? '● Auto-refreshing every 5s' : '⏸ Auto-refresh paused'}</div>
          </div>
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
              autoRefresh ? 'bg-emerald-50 text-emerald-700 border-emerald-300' : 'bg-gray-100 text-gray-700 border-gray-300'
            }`}
          >
            {autoRefresh ? 'Pause' : 'Resume'}
          </button>
          <Button size="sm" variant="secondary" onClick={() => loadData(false)}>
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </Button>
        </div>
      </div>

      {/* Real-time Status Counters */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div 
          onClick={() => setFilterRisk('all')}
          className={`p-4 rounded-xl border cursor-pointer transition-all ${
            filterRisk === 'all' ? 'bg-blue-50 border-blue-500 shadow-md ring-2 ring-blue-200' : 'bg-white border-gray-200 hover:border-gray-300 shadow-sm'
          }`}
        >
          <div className="flex items-center justify-between text-xs font-semibold text-gray-500 uppercase">
            <span>Total Students</span>
            <User size={16} className="text-blue-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-gray-900">{totalStudents}</div>
          <p className="text-xs text-gray-500 mt-0.5">Enrolled / Writing</p>
        </div>

        <div 
          onClick={() => setFilterRisk('active')}
          className={`p-4 rounded-xl border cursor-pointer transition-all ${
            filterRisk === 'active' ? 'bg-emerald-50 border-emerald-500 shadow-md ring-2 ring-emerald-200' : 'bg-white border-gray-200 hover:border-gray-300 shadow-sm'
          }`}
        >
          <div className="flex items-center justify-between text-xs font-semibold text-emerald-700 uppercase">
            <span>Live / In-Progress</span>
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          </div>
          <div className="mt-2 text-2xl font-bold text-emerald-700">{activeCount}</div>
          <p className="text-xs text-emerald-600 mt-0.5">Currently active in test</p>
        </div>

        <div 
          onClick={() => setFilterRisk('flagged')}
          className={`p-4 rounded-xl border cursor-pointer transition-all ${
            filterRisk === 'flagged' ? 'bg-red-50 border-red-500 shadow-md ring-2 ring-red-200' : 'bg-white border-gray-200 hover:border-gray-300 shadow-sm'
          }`}
        >
          <div className="flex items-center justify-between text-xs font-semibold text-red-700 uppercase">
            <span>Flagged / High Risk</span>
            <ShieldAlert size={16} className="text-red-500 animate-bounce" />
          </div>
          <div className="mt-2 text-2xl font-bold text-red-700">{flaggedCount}</div>
          <p className="text-xs text-red-600 mt-0.5">Tab switches or violations</p>
        </div>

        <div 
          onClick={() => setFilterRisk('completed')}
          className={`p-4 rounded-xl border cursor-pointer transition-all ${
            filterRisk === 'completed' ? 'bg-purple-50 border-purple-500 shadow-md ring-2 ring-purple-200' : 'bg-white border-gray-200 hover:border-gray-300 shadow-sm'
          }`}
        >
          <div className="flex items-center justify-between text-xs font-semibold text-purple-700 uppercase">
            <span>Finished / Graded</span>
            <CheckCircle size={16} className="text-purple-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-purple-700">{submittedCount}</div>
          <p className="text-xs text-purple-600 mt-0.5">Submissions completed</p>
        </div>
      </div>

      {/* Search and Filters Toolbar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
        <div className="relative w-full sm:w-80">
          <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search by student name or index #..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto text-xs font-medium text-gray-600">
          <span>Sort: High-Risk Students Auto-Ranked First</span>
        </div>
      </div>

      {/* Live Monitoring Student Grid */}
      {filteredAttempts.length === 0 ? (
        <Card>
          <div className="text-center py-12">
            <Eye size={40} className="mx-auto text-gray-300 mb-2" />
            <p className="text-gray-500 font-medium">No students match this filter criteria</p>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredAttempts.map((student) => {
            const isCheated = student.cheated;
            const tabCount = student.tab_switch_count || 0;
            const copyCount = student.copy_attempts || 0;
            const hasActivity = tabCount > 0 || copyCount > 0;
            const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(student.user_agent || '');
            const progressPercent = student.total_questions && student.total_questions > 0 
              ? Math.round(((student.answered_count || 0) / student.total_questions) * 100) 
              : 0;

            return (
              <div
                key={student.id}
                onClick={() => {
                  setSelectedStudent(student);
                  setIsInspectorOpen(true);
                }}
                className={`bg-white rounded-xl border-2 p-4 shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col justify-between ${
                  isCheated 
                    ? 'border-red-400 bg-red-50/20' 
                    : hasActivity 
                    ? 'border-amber-400 bg-amber-50/20' 
                    : 'border-gray-200 hover:border-blue-400'
                }`}
              >
                <div>
                  {/* Card Header: Student & Device Type */}
                  <div className="flex items-start justify-between gap-2 pb-2 border-b border-gray-100">
                    <div className="min-w-0">
                      <h3 className="font-bold text-sm text-gray-900 truncate" title={student.student_name}>
                        {student.student_name}
                      </h3>
                      <p className="text-xs text-gray-500 font-mono truncate">{student.index_number}</p>
                    </div>

                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <Badge variant={
                        isCheated ? 'danger' :
                        student.status === 'in_progress' ? 'success' : 'secondary'
                      } className="text-[10px] px-1.5 py-0.5">
                        {isCheated ? 'Flagged' : student.status === 'in_progress' ? '● Active' : 'Submitted'}
                      </Badge>
                      <span className="text-[10px] text-gray-400 flex items-center gap-0.5">
                        {isMobile ? <Smartphone size={11} /> : <Laptop size={11} />}
                        {isMobile ? 'Mobile' : 'Desktop'}
                      </span>
                    </div>
                  </div>

                  {/* Live Webcam Snapshot or Placeholder */}
                  <div className="my-2.5 relative aspect-video bg-gray-900 rounded-lg overflow-hidden flex items-center justify-center group">
                    {student.latest_snapshot ? (
                      <>
                        <img 
                          src={getOptimizedCloudinaryUrl(student.latest_snapshot, { width: 360, height: 240 })} 
                          alt="Live Student Snapshot" 
                          className="w-full h-full object-cover transition-transform group-hover:scale-105"
                        />
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setExpandedSnapshot({
                              url: student.latest_snapshot!,
                              title: `Live Snapshot - ${student.student_name}`,
                              studentName: student.student_name,
                            });
                          }}
                          className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-1.5 text-white text-xs font-medium transition-opacity"
                        >
                          <Eye size={15} /> Expand View
                        </button>
                      </>
                    ) : (
                      <div className="flex flex-col items-center justify-center text-gray-500 text-xs gap-1">
                        <Video size={20} className={quiz?.enable_camera_proctoring ? 'text-gray-600' : 'text-gray-700'} />
                        <span className="text-[10px]">{quiz?.enable_camera_proctoring ? 'Waiting for frame...' : 'Camera Off'}</span>
                      </div>
                    )}

                    {/* Progress Badge Overlay */}
                    <div className="absolute bottom-1 right-1 bg-black/70 text-white text-[10px] px-1.5 py-0.5 rounded font-mono pointer-events-none">
                      Q {student.answered_count || 0}/{student.total_questions || 0} ({progressPercent}%)
                    </div>
                  </div>

                  {/* Violation Badges */}
                  <div className="flex flex-wrap gap-1 mb-2">
                    {tabCount > 0 && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-700 bg-red-100 px-2 py-0.5 rounded-full">
                        <Eye size={12} /> {tabCount} tab {tabCount === 1 ? 'switch' : 'switches'}
                      </span>
                    )}
                    {copyCount > 0 && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-orange-700 bg-orange-100 px-2 py-0.5 rounded-full">
                        <Copy size={12} /> {copyCount} copy
                      </span>
                    )}
                    {!hasActivity && (
                      <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                        <ShieldCheck size={12} /> Clean Focus
                      </span>
                    )}
                  </div>
                </div>

                {/* Bottom Actions */}
                <div className="pt-2 border-t border-gray-100 flex items-center justify-between text-xs">
                  <span className="text-gray-400 text-[10px]">
                    {student.started_at ? `Started ${new Date(student.started_at).toLocaleTimeString()}` : ''}
                  </span>
                  <span className="text-blue-600 font-semibold flex items-center gap-1 hover:underline">
                    Inspect <ExternalLink size={12} />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Student Live Inspector Modal */}
      {selectedStudent && (
        <Modal
          isOpen={isInspectorOpen}
          onClose={() => setIsInspectorOpen(false)}
          title={`Student Live Monitor: ${selectedStudent.student_name}`}
        >
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-gray-50 rounded-lg border">
              <div>
                <p className="font-bold text-gray-900">{selectedStudent.student_name}</p>
                <p className="text-xs text-gray-500 font-mono">Index: {selectedStudent.index_number} • Status: <span className="capitalize font-semibold">{selectedStudent.status}</span></p>
              </div>
              <div className="flex items-center gap-2">
                <Button 
                  size="sm" 
                  variant={selectedStudent.cheated ? 'secondary' : 'danger'}
                  onClick={() => handleToggleCheating(selectedStudent)}
                >
                  {selectedStudent.cheated ? 'Clear Cheating Flag' : 'Flag for Cheating'}
                </Button>
                {selectedStudent.status === 'in_progress' && (
                  <Button 
                    size="sm" 
                    variant="danger"
                    onClick={() => handleForceSubmit(selectedStudent)}
                  >
                    ⚡ Force Submit
                  </Button>
                )}
              </div>
            </div>

            {/* Snapshot & Telemetry View */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="bg-gray-900 rounded-lg overflow-hidden aspect-video flex items-center justify-center">
                {selectedStudent.latest_snapshot ? (
                  <img src={selectedStudent.latest_snapshot} alt="Webcam" className="w-full h-full object-cover" />
                ) : (
                  <div className="text-gray-500 text-xs flex flex-col items-center gap-1">
                    <Video size={24} />
                    <span>No snapshot frame received</span>
                  </div>
                )}
              </div>

              <div className="space-y-2 text-xs">
                <div className="p-2 bg-gray-50 rounded border">
                  <span className="text-gray-500">Progress:</span>{' '}
                  <span className="font-bold text-gray-900">{selectedStudent.answered_count} of {selectedStudent.total_questions} questions answered</span>
                </div>
                <div className="p-2 bg-gray-50 rounded border">
                  <span className="text-gray-500">Tab Switches:</span>{' '}
                  <span className={`font-bold ${(selectedStudent.tab_switch_count || 0) > 0 ? 'text-red-600' : 'text-gray-900'}`}>
                    {selectedStudent.tab_switch_count || 0} times
                  </span>
                </div>
                <div className="p-2 bg-gray-50 rounded border">
                  <span className="text-gray-500">Copy Attempts:</span>{' '}
                  <span className={`font-bold ${(selectedStudent.copy_attempts || 0) > 0 ? 'text-orange-600' : 'text-gray-900'}`}>
                    {selectedStudent.copy_attempts || 0} times
                  </span>
                </div>
                <div className="p-2 bg-gray-50 rounded border truncate">
                  <span className="text-gray-500">User Agent:</span>{' '}
                  <span className="font-mono text-gray-700" title={selectedStudent.user_agent}>{selectedStudent.user_agent || 'Unknown'}</span>
                </div>
              </div>
            </div>

            {/* Incident Log Timeline */}
            <div>
              <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Live Session Incident Feed</h4>
              <div className="bg-white border rounded-lg p-3 max-h-48 overflow-y-auto space-y-1.5 text-xs">
                {(() => {
                  let logs: any[] = [];
                  if (selectedStudent.suspicious_activity) {
                    try {
                      logs = typeof selectedStudent.suspicious_activity === 'string'
                        ? JSON.parse(selectedStudent.suspicious_activity)
                        : selectedStudent.suspicious_activity;
                    } catch (e) {}
                  }

                  if (!Array.isArray(logs) || logs.length === 0) {
                    return <p className="text-gray-400 italic">No suspicious events or warnings recorded.</p>;
                  }

                  return logs.map((log: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between border-b pb-1 last:border-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-gray-400 font-mono text-[10px]">{log.timestamp ? new Date(log.timestamp).toLocaleTimeString() : ''}</span>
                        <span className="font-semibold text-gray-700">[{log.type}]:</span>
                        <span className="text-gray-600">{log.details}</span>
                      </div>
                      {log.snapshot && (
                        <button
                          type="button"
                          onClick={() => setExpandedSnapshot({
                            url: log.snapshot,
                            title: `Incident: [${log.type}] - ${selectedStudent.student_name}`,
                            studentName: selectedStudent.student_name,
                            time: log.timestamp ? new Date(log.timestamp).toLocaleTimeString() : undefined,
                          })}
                          className="shrink-0 group relative cursor-pointer"
                          title="Click to expand snapshot"
                        >
                          <img 
                            src={getOptimizedCloudinaryUrl(log.snapshot, { width: 120, height: 90 })} 
                            alt="Log capture" 
                            className="w-10 h-7 object-cover rounded border border-gray-300 group-hover:border-blue-500 transition-colors" 
                          />
                        </button>
                      )}
                    </div>
                  ));
                })()}
              </div>
            </div>

            <div className="flex justify-between items-center pt-3 border-t">
              <Button 
                variant="secondary" 
                size="sm"
                onClick={() => navigate(`/lecturer/submission/${selectedStudent.id}`)}
              >
                Open Full Submission Report
              </Button>
              <Button size="sm" onClick={() => setIsInspectorOpen(false)}>Close</Button>
            </div>
          </div>
        </Modal>
      )}

      {/* High-Resolution Snapshot Lightbox Modal */}
      {expandedSnapshot && (
        <Modal
          isOpen={true}
          onClose={() => setExpandedSnapshot(null)}
          title={expandedSnapshot.title}
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs text-gray-500 pb-2 border-b">
              <span>Student: <strong className="text-gray-900">{expandedSnapshot.studentName || 'Student'}</strong></span>
              {expandedSnapshot.time && <span>Captured at: <strong className="font-mono text-gray-900">{expandedSnapshot.time}</strong></span>}
            </div>

            <div className="relative bg-gray-950 rounded-xl overflow-hidden max-h-[70vh] flex items-center justify-center border border-gray-800 shadow-inner">
              <img
                src={expandedSnapshot.url}
                alt={expandedSnapshot.title}
                className="max-h-[65vh] w-auto max-w-full object-contain"
              />
            </div>

            <div className="flex items-center justify-between pt-2">
              {expandedSnapshot.url.startsWith('http') ? (
                <a
                  href={expandedSnapshot.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-800"
                >
                  <ExternalLink size={13} /> View Original on Cloudinary CDN
                </a>
              ) : (
                <span className="text-xs text-gray-400">Database Base64 snapshot</span>
              )}
              <Button size="sm" onClick={() => setExpandedSnapshot(null)}>Close</Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
