import { useState, useEffect } from 'react';
import { 
  Users, 
  Plus, 
  Trash2, 
  Calendar, 
  Clock, 
  Key, 
  UserCheck, 
  Shuffle, 
  X, 
  CheckCircle2, 
  AlertTriangle, 
  Save, 
  Layers, 
  RefreshCw,
  ShieldCheck,
  Zap,
  Edit2
} from 'lucide-react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Badge from '../ui/Badge';
import { db, Quiz, QuizSession, QuizSessionStudent } from '../../lib/database';

interface QuizSessionManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  quiz: Quiz | null;
}

export default function QuizSessionManagerModal({
  isOpen,
  onClose,
  quiz
}: QuizSessionManagerModalProps) {
  const [sessions, setSessions] = useState<QuizSession[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);

  // Assessment Sizing & Pool Feasibility State
  const [bankCount, setBankCount] = useState<number | null>(null);
  const [drawQuestionCount, setDrawQuestionCount] = useState<number>(quiz?.draw_question_count || 25);
  const [hasMultipleSessions, setHasMultipleSessions] = useState<boolean>(quiz?.has_multiple_sessions ?? true);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState(false);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // New session form state
  const [sessionName, setSessionName] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [accessPin, setAccessPin] = useState('');
  const [creatingSession, setCreatingSession] = useState(false);

  // Edit session form state
  const [editingSession, setEditingSession] = useState<QuizSession | null>(null);
  const [editSessionName, setEditSessionName] = useState('');
  const [editStartTime, setEditStartTime] = useState('');
  const [editEndTime, setEditEndTime] = useState('');
  const [editAccessPin, setEditAccessPin] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Active session roster state
  const [activeSessionRoster, setActiveSessionRoster] = useState<QuizSession | null>(null);
  const [rosterStudents, setRosterStudents] = useState<QuizSessionStudent[]>([]);
  const [allStudents, setAllStudents] = useState<any[]>([]);
  const [selectedStudentToAdd, setSelectedStudentToAdd] = useState('');
  const [loadingRoster, setLoadingRoster] = useState(false);

  useEffect(() => {
    if (isOpen && quiz) {
      loadSessions();
      setDrawQuestionCount(quiz.draw_question_count || 25);
      setHasMultipleSessions(quiz.has_multiple_sessions ?? true);
      if (quiz.course_id) {
        db.getQuestionBankQuestions(quiz.course_id, { status: 'active' })
          .then(res => setBankCount(res.length))
          .catch(e => console.warn('Could not load bank count:', e));
      } else {
        setBankCount(null);
      }
    }
  }, [isOpen, quiz]);

  const loadSessions = async () => {
    if (!quiz) return;
    setLoading(true);
    try {
      const data = await db.getQuizSessions(quiz.id);
      setSessions(data as QuizSession[]);
    } catch (err) {
      console.error('Error loading sessions:', err);
    } finally {
      setLoading(false);
    }
  };

  const generateRandomPin = () => {
    return String(Math.floor(100000 + Math.random() * 900000));
  };

  const formatDateTime = (d: Date) => {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const startEditSession = (sess: QuizSession) => {
    setEditingSession(sess);
    setEditSessionName(sess.session_name);
    setEditStartTime(formatDateTime(new Date(sess.start_time)));
    setEditEndTime(formatDateTime(new Date(sess.end_time)));
    setEditAccessPin(sess.access_pin || '');
  };

  const handleUpdateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSession || !editSessionName.trim() || !editStartTime || !editEndTime) {
      alert('Please fill in session name, start time, and end time.');
      return;
    }

    setIsSavingEdit(true);
    try {
      await db.updateQuizSession(editingSession.id, {
        session_name: editSessionName.trim(),
        start_time: new Date(editStartTime).toISOString(),
        end_time: new Date(editEndTime).toISOString(),
        access_pin: editAccessPin.trim() ? editAccessPin.trim() : (null as any)
      });

      setSuccessToast(`Updated "${editSessionName.trim()}" successfully!`);
      setTimeout(() => setSuccessToast(null), 4000);
      setEditingSession(null);
      await loadSessions();
    } catch (err) {
      console.error('Error updating session:', err);
      alert('Failed to update session.');
    } finally {
      setIsSavingEdit(false);
    }
  };

  const openAddForm = () => {
    const nextNum = sessions.length + 1;
    const nextLetter = String.fromCharCode(64 + nextNum); // A, B, C...
    setSessionName(`Session ${nextNum} - Group ${nextLetter}`);

    const now = new Date();
    now.setMinutes(0, 0, 0);

    const examDurationMinutes = quiz?.duration_minutes ? quiz.duration_minutes + 30 : 120;

    if (sessions.length > 0) {
      const lastSession = sessions[sessions.length - 1];
      const lastEnd = new Date(lastSession.end_time);
      const nextStart = new Date(lastEnd.getTime() + 30 * 60 * 1000); // 30 min break
      const nextEnd = new Date(nextStart.getTime() + examDurationMinutes * 60 * 1000);
      setStartTime(formatDateTime(nextStart));
      setEndTime(formatDateTime(nextEnd));
    } else {
      now.setHours(now.getHours() + 1);
      const end = new Date(now.getTime() + examDurationMinutes * 60 * 1000);
      setStartTime(formatDateTime(now));
      setEndTime(formatDateTime(end));
    }

    setAccessPin(generateRandomPin());
    setShowAddForm(true);
  };

  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quiz || !sessionName.trim() || !startTime || !endTime) {
      alert('Please fill in session name, start time, and end time.');
      return;
    }

    setCreatingSession(true);
    try {
      await db.createQuizSession({
        quiz_id: quiz.id,
        session_name: sessionName.trim(),
        start_time: new Date(startTime).toISOString(),
        end_time: new Date(endTime).toISOString(),
        access_pin: accessPin.trim() || undefined,
        session_pool_index: sessions.length
      });

      setSessionName('');
      setStartTime('');
      setEndTime('');
      setAccessPin('');
      setShowAddForm(false);
      setSuccessToast(`Created "${sessionName.trim()}" successfully!`);
      setTimeout(() => setSuccessToast(null), 4000);
      await loadSessions();
    } catch (err) {
      console.error('Error creating quiz session:', err);
      alert('Failed to create session.');
    } finally {
      setCreatingSession(false);
    }
  };

  const handleQuickCreateTwoSessions = async () => {
    if (!quiz) return;
    setCreatingSession(true);
    try {
      const now = new Date();
      now.setMinutes(0, 0, 0);
      now.setHours(now.getHours() + 1);

      const durationMs = (quiz.duration_minutes ? quiz.duration_minutes + 30 : 120) * 60 * 1000;
      const s1Start = new Date(now);
      const s1End = new Date(s1Start.getTime() + durationMs);

      const s2Start = new Date(s1End.getTime() + 30 * 60 * 1000); // 30 mins interval
      const s2End = new Date(s2Start.getTime() + durationMs);

      await db.createQuizSession({
        quiz_id: quiz.id,
        session_name: 'Session 1 - Group A (Morning Sitting)',
        start_time: s1Start.toISOString(),
        end_time: s1End.toISOString(),
        access_pin: generateRandomPin(),
        session_pool_index: 0
      });

      await db.createQuizSession({
        quiz_id: quiz.id,
        session_name: 'Session 2 - Group B (Afternoon Sitting)',
        start_time: s2Start.toISOString(),
        end_time: s2End.toISOString(),
        access_pin: generateRandomPin(),
        session_pool_index: 1
      });

      setShowAddForm(false);
      setSuccessToast('Successfully generated Session 1 and Session 2 with distinct PINs!');
      setTimeout(() => setSuccessToast(null), 5000);
      await loadSessions();
    } catch (err) {
      console.error('Error quick generating 2 sessions:', err);
      alert('Failed to generate sessions.');
    } finally {
      setCreatingSession(false);
    }
  };

  const handleDeleteSession = async (sessionId: string) => {
    if (!confirm('Are you sure you want to delete this session and remove student assignments?')) return;
    try {
      await db.deleteQuizSession(sessionId);
      if (activeSessionRoster?.id === sessionId) setActiveSessionRoster(null);
      await loadSessions();
    } catch (err) {
      console.error('Error deleting session:', err);
      alert('Failed to delete session.');
    }
  };

  const openRoster = async (session: QuizSession) => {
    setActiveSessionRoster(session);
    setLoadingRoster(true);
    try {
      const [roster, students] = await Promise.all([
        db.getQuizSessionStudents(session.id),
        db.getUsersByRole('student')
      ]);
      setRosterStudents(roster as QuizSessionStudent[]);
      setAllStudents(students as any[]);
    } catch (err) {
      console.error('Error loading session roster:', err);
    } finally {
      setLoadingRoster(false);
    }
  };

  const handleAddStudentToRoster = async (studentId: string) => {
    if (!activeSessionRoster || !studentId) return;
    try {
      await db.assignStudentsToSession(activeSessionRoster.id, [studentId]);
      const updated = await db.getQuizSessionStudents(activeSessionRoster.id);
      setRosterStudents(updated as QuizSessionStudent[]);
      setSelectedStudentToAdd('');
      await loadSessions();
    } catch (err) {
      console.error('Error assigning student:', err);
    }
  };

  const handleRemoveStudentFromRoster = async (studentId: string) => {
    if (!activeSessionRoster) return;
    try {
      await db.removeStudentFromSession(activeSessionRoster.id, studentId);
      const updated = await db.getQuizSessionStudents(activeSessionRoster.id);
      setRosterStudents(updated as QuizSessionStudent[]);
      await loadSessions();
    } catch (err) {
      console.error('Error removing student from roster:', err);
    }
  };

  const handleAutoPartition = async () => {
    if (sessions.length < 2) {
      alert('Please create at least 2 sessions (e.g. Session 1 and Session 2) to auto-partition students.');
      return;
    }

    if (!confirm(`This will distribute all registered students evenly across your ${sessions.length} sessions. Proceed?`)) {
      return;
    }

    setLoading(true);
    try {
      const students = (await db.getUsersByRole('student')) as any[];
      if (students.length === 0) {
        alert('No registered student accounts found to distribute.');
        return;
      }

      // Distribute round-robin
      for (let i = 0; i < sessions.length; i++) {
        const assigned = students.filter((_, idx) => idx % sessions.length === i).map(s => s.id);
        if (assigned.length > 0) {
          await db.assignStudentsToSession(sessions[i].id, assigned);
        }
      }

      setSuccessToast(`Distributed ${students.length} students evenly across all ${sessions.length} sessions!`);
      setTimeout(() => setSuccessToast(null), 5000);
      await loadSessions();
    } catch (err) {
      console.error('Error auto-partitioning students:', err);
      alert('Failed to auto-partition students.');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateCohortSettings = async () => {
    if (!quiz) return;
    setIsSavingSettings(true);
    try {
      await db.updateQuiz(quiz.id, {
        has_multiple_sessions: hasMultipleSessions,
        draw_question_count: Number(drawQuestionCount) || 25,
        is_dynamic_draw: true
      });
      setSaveSuccessMessage(true);
      setTimeout(() => setSaveSuccessMessage(false), 3000);
    } catch (e) {
      console.error('Failed to update quiz settings:', e);
      alert('Failed to update quiz assessment settings.');
    } finally {
      setIsSavingSettings(false);
    }
  };

  if (!quiz) return null;

  const sessionCount = Math.max(1, sessions.length);
  const availablePerSession = bankCount !== null ? Math.floor(bankCount / sessionCount) : null;
  const isSufficient = availablePerSession !== null ? availablePerSession >= drawQuestionCount : true;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Cohort Session & PIN Controller: ${quiz.title}`}
      size="xl"
    >
      <div className="space-y-6">
        {/* Academic Officer Mission Header */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-900 text-white p-5 rounded-2xl shadow-sm border border-indigo-800">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-200 border border-blue-400/30 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                  <ShieldCheck size={14} className="text-blue-300" />
                  Academic Officer Responsibility
                </span>
                <span className="text-xs text-indigo-200">
                  {sessions.length} {sessions.length === 1 ? 'Sitting Scheduled' : 'Sittings Scheduled'}
                </span>
              </div>
              <h4 className="text-xl font-bold tracking-tight">
                Exam Sittings & Invigilator PINs
              </h4>
              <p className="text-xs text-indigo-100/90 mt-1 max-w-xl leading-relaxed">
                As the <strong>Academic Officer</strong>, you schedule candidates into distinct cohorts (Session 1, Session 2...), issue secure 6-digit invigilator PINs, and set the dynamic question count.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {sessions.length >= 2 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAutoPartition}
                  className="bg-white/10 text-white hover:bg-white/20 border-white/20 text-xs flex items-center gap-1.5"
                  title="Evenly distribute all enrolled students across scheduled sessions"
                >
                  <Shuffle size={14} />
                  Auto-Split Students
                </Button>
              )}

              {sessions.length === 0 && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleQuickCreateTwoSessions}
                  disabled={creatingSession}
                  className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold border-0 text-xs flex items-center gap-1.5 shadow"
                >
                  <Zap size={14} />
                  {creatingSession ? 'Generating...' : '⚡ 1-Click: Create Session 1 & 2'}
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Success Toast */}
        {successToast && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center justify-between font-medium animate-fadeIn">
            <span className="flex items-center gap-2">
              <CheckCircle2 size={16} className="text-emerald-600" />
              {successToast}
            </span>
            <button onClick={() => setSuccessToast(null)} className="text-emerald-500 hover:text-emerald-700">
              <X size={14} />
            </button>
          </div>
        )}

        {/* Academic Officer Sizing & Pool Feasibility Settings */}
        <div className="bg-white p-4 rounded-xl border border-indigo-200 shadow-sm space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <Layers className="text-indigo-600" size={18} />
              <h5 className="font-bold text-gray-900 text-sm">Question Sampling & Cohort Partition Settings</h5>
            </div>
            <div className="flex items-center gap-3">
              {saveSuccessMessage && (
                <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1">
                  <CheckCircle2 size={13} /> Saved
                </span>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={handleUpdateCohortSettings}
                disabled={isSavingSettings}
                className="text-xs text-indigo-700 border-indigo-300 hover:bg-indigo-50 flex items-center gap-1 font-semibold"
              >
                <Save size={13} />
                <span>{isSavingSettings ? 'Saving...' : 'Save Question Count'}</span>
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            {/* Multiple Cohort Sessions Switch */}
            <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
              <input
                type="checkbox"
                id="modal_multiple_sessions"
                checked={hasMultipleSessions}
                onChange={(e) => setHasMultipleSessions(e.target.checked)}
                className="mt-0.5 h-4 w-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500 cursor-pointer"
              />
              <label htmlFor="modal_multiple_sessions" className="cursor-pointer">
                <span className="font-semibold text-gray-800 block">Enable Multiple Cohort Sessions</span>
                <span className="text-gray-500 text-[11px] block mt-0.5">
                  Partitions candidates into Session 1, Session 2... with independent timetables and invigilator PINs.
                </span>
              </label>
            </div>

            {/* Question Draw Count Input */}
            <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 space-y-1.5">
              <label className="font-semibold text-gray-800 flex items-center justify-between">
                <span>Questions to Answer per Candidate:</span>
                <span className="text-indigo-600 font-mono font-bold text-sm">{drawQuestionCount}</span>
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="1"
                  max={bankCount ? bankCount : 200}
                  value={drawQuestionCount}
                  onChange={(e) => setDrawQuestionCount(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-24 px-2 py-1 border border-gray-300 rounded text-xs font-mono font-bold bg-white"
                />
                <span className="text-[11px] text-gray-500">questions drawn per student attempt</span>
              </div>
            </div>
          </div>

          {/* Live Pool Feasibility Audit */}
          {bankCount !== null && (
            <div className={`p-3 rounded-lg border text-xs flex items-start gap-2.5 ${
              isSufficient ? 'bg-emerald-50/70 border-emerald-200 text-emerald-800' : 'bg-amber-50 border-amber-300 text-amber-900'
            }`}>
              {isSufficient ? (
                <CheckCircle2 size={16} className="text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
              )}
              <div className="flex-1">
                <div className="font-bold">
                  {isSufficient
                    ? `Pool Feasibility Verified (${sessions.length} Scheduled Sessions · Zero Overlap)`
                    : `Pool Shortfall Warning (${sessions.length} Scheduled Sessions)`}
                </div>
                <p className="mt-0.5 text-[11px] opacity-90">
                  Course Question Bank contains <strong>{bankCount} active questions</strong>. Across {sessionCount} scheduled {sessionCount === 1 ? 'session' : 'sessions'}, each session receives <strong>{availablePerSession} unique questions</strong>. 
                  {isSufficient
                    ? ` Candidates drawing ${drawQuestionCount} questions are 100% leak-proof across cohorts.`
                    : ` Candidates require ${drawQuestionCount} questions, but sessions only have ${availablePerSession} unique questions available.`}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Section Header: Scheduled Sessions with prominent Add Button */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
          <div>
            <h5 className="font-bold text-gray-900 text-base flex items-center gap-2">
              <Users size={18} className="text-indigo-600" />
              Scheduled Cohort Sittings ({sessions.length})
            </h5>
            <p className="text-xs text-gray-500">
              Each session has an independent invigilator access PIN and student roster.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {!showAddForm && (
              <Button
                variant="primary"
                size="sm"
                onClick={openAddForm}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs flex items-center gap-1.5 shadow-sm"
              >
                <Plus size={15} />
                <span>{sessions.length === 0 ? 'Create Session 1' : `+ Add Session ${sessions.length + 1}`}</span>
              </Button>
            )}
          </div>
        </div>

        {/* Create Session Form - Rendered right under the sessions header */}
        {showAddForm && (
          <form 
            onSubmit={handleCreateSession} 
            className="p-5 bg-indigo-50/50 rounded-xl border-2 border-indigo-400 shadow-md space-y-4 animate-fadeIn"
          >
            <div className="flex justify-between items-center pb-2 border-b border-indigo-200">
              <div className="flex items-center gap-2">
                <span className="p-1.5 bg-indigo-600 text-white rounded-lg">
                  <Calendar size={16} />
                </span>
                <div>
                  <h5 className="font-bold text-gray-900 text-sm">
                    Configure Session #{sessions.length + 1}
                  </h5>
                  <p className="text-[11px] text-gray-500">
                    Set the schedule and 6-digit invigilator access PIN for this cohort.
                  </p>
                </div>
              </div>
              <Button 
                type="button" 
                variant="secondary" 
                size="sm" 
                onClick={() => setShowAddForm(false)}
                className="text-xs"
              >
                <X size={14} className="mr-1" />
                Close Form
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Session Name (e.g. Session 1 - Group A)"
                value={sessionName}
                onChange={(e) => setSessionName(e.target.value)}
                placeholder="e.g. Session 1 - Group A"
                required
              />

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Invigilator Access PIN (6 Digits) <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={accessPin}
                    onChange={(e) => setAccessPin(e.target.value)}
                    placeholder="e.g. 849201"
                    maxLength={8}
                    required
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm font-mono tracking-widest font-bold focus:ring-2 focus:ring-indigo-500 bg-white"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => setAccessPin(generateRandomPin())}
                    title="Generate New Random PIN"
                    className="shrink-0 flex items-center gap-1 text-xs"
                  >
                    <RefreshCw size={13} />
                    New PIN
                  </Button>
                </div>
                <span className="text-[11px] text-gray-500 mt-1 block">
                  Students enter this PIN on exam day to unlock the test.
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Session Start Window <span className="text-red-500">*</span>
                </label>
                <input
                  type="datetime-local"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-indigo-500 bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Session End Window <span className="text-red-500">*</span>
                </label>
                <input
                  type="datetime-local"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-indigo-500 bg-white"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-indigo-200">
              <Button type="button" variant="secondary" size="sm" onClick={() => setShowAddForm(false)}>
                Cancel
              </Button>
              <Button 
                type="submit" 
                variant="primary" 
                size="sm" 
                disabled={creatingSession}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold flex items-center gap-1.5 shadow"
              >
                <CheckCircle2 size={15} />
                {creatingSession ? 'Saving Session...' : `✓ Save & Create Session ${sessions.length + 1}`}
              </Button>
            </div>
          </form>
        )}

        {/* Sessions List */}
        {loading ? (
          <div className="text-center py-8 text-gray-500 text-sm">Loading sessions...</div>
        ) : sessions.length === 0 ? (
          <div className="text-center py-10 bg-slate-50 rounded-2xl border-2 border-dashed border-indigo-200 p-6 space-y-3">
            <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mx-auto">
              <Users size={24} />
            </div>
            <div>
              <p className="text-base font-bold text-gray-900">No Cohort Sessions Configured Yet</p>
              <p className="text-xs text-gray-500 max-w-md mx-auto mt-1">
                You can create Session 1 (Group A) and Session 2 (Group B) manually, or use the 1-Click generator below.
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-3 pt-2">
              <Button
                variant="primary"
                size="sm"
                onClick={openAddForm}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs flex items-center gap-1.5"
              >
                <Plus size={15} />
                + Create Session 1 (Group A)
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleQuickCreateTwoSessions}
                disabled={creatingSession}
                className="border-indigo-300 text-indigo-700 hover:bg-indigo-50 font-medium text-xs flex items-center gap-1.5"
              >
                <Zap size={14} className="text-amber-500" />
                ⚡ 1-Click: Create Session 1 & 2
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {sessions.map((sess, idx) => (
              editingSession?.id === sess.id ? (
                /* Inline Edit Session Form */
                <form 
                  key={sess.id}
                  onSubmit={handleUpdateSession} 
                  className="p-4 bg-amber-50/70 rounded-xl border-2 border-amber-400 shadow-sm space-y-3"
                >
                  <div className="flex justify-between items-center pb-2 border-b border-amber-200">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900 uppercase">
                      <Edit2 size={14} className="text-amber-700" />
                      Edit Sitting #{idx + 1}
                    </div>
                    <button 
                      type="button" 
                      onClick={() => setEditingSession(null)}
                      className="text-gray-400 hover:text-gray-600 text-xs font-medium"
                    >
                      Cancel
                    </button>
                  </div>

                  <Input
                    label="Session Name"
                    value={editSessionName}
                    onChange={(e) => setEditSessionName(e.target.value)}
                    required
                    placeholder="e.g. Session 1 - Group A"
                  />

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Invigilator Access PIN
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={editAccessPin}
                        onChange={(e) => setEditAccessPin(e.target.value)}
                        maxLength={8}
                        className="flex-1 px-3 py-1.5 border border-gray-300 rounded text-xs font-mono font-bold tracking-widest bg-white focus:ring-2 focus:ring-amber-500"
                        placeholder="PIN"
                      />
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => setEditAccessPin(generateRandomPin())}
                        className="text-xs shrink-0 flex items-center gap-1"
                      >
                        <RefreshCw size={12} />
                        New PIN
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    <div>
                      <label className="block font-semibold text-gray-700 mb-1">Start Time</label>
                      <input
                        type="datetime-local"
                        value={editStartTime}
                        onChange={(e) => setEditStartTime(e.target.value)}
                        required
                        className="w-full px-2 py-1.5 border border-gray-300 rounded bg-white text-xs focus:ring-2 focus:ring-amber-500"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-gray-700 mb-1">End Time</label>
                      <input
                        type="datetime-local"
                        value={editEndTime}
                        onChange={(e) => setEditEndTime(e.target.value)}
                        required
                        className="w-full px-2 py-1.5 border border-gray-300 rounded bg-white text-xs focus:ring-2 focus:ring-amber-500"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-2 border-t border-amber-200">
                    <Button 
                      type="button" 
                      variant="secondary" 
                      size="sm" 
                      onClick={() => setEditingSession(null)}
                      className="text-xs"
                    >
                      Cancel
                    </Button>
                    <Button 
                      type="submit" 
                      variant="primary" 
                      size="sm" 
                      disabled={isSavingEdit}
                      className="text-xs bg-amber-600 hover:bg-amber-700 text-white font-semibold flex items-center gap-1 shadow-sm"
                    >
                      <CheckCircle2 size={13} />
                      {isSavingEdit ? 'Saving...' : 'Save Changes'}
                    </Button>
                  </div>
                </form>
              ) : (
                /* Read-Only Session Card */
                <div
                  key={sess.id}
                  className={`p-4 rounded-xl border transition-all ${
                    activeSessionRoster?.id === sess.id
                      ? 'border-indigo-500 bg-indigo-50/40 ring-2 ring-indigo-200'
                      : 'border-gray-200 bg-white hover:border-gray-300 shadow-sm'
                  }`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <span className="text-xs font-bold text-indigo-600 tracking-wide uppercase">
                        Cohort Sitting #{idx + 1}
                      </span>
                      <h5 className="font-bold text-gray-900 text-base">{sess.session_name}</h5>
                    </div>
                    {(() => {
                      const now = new Date().getTime();
                      const start = new Date(sess.start_time).getTime();
                      const end = new Date(sess.end_time).getTime();
                      if (now < start) return <Badge variant="outline">Scheduled</Badge>;
                      if (now >= start && now <= end) return <Badge variant="success">Active Now</Badge>;
                      return <Badge variant="secondary">Ended</Badge>;
                    })()}
                  </div>

                  <div className="space-y-2 text-xs text-gray-600 my-3 bg-gray-50 p-2.5 rounded-lg border border-gray-100">
                    <div className="flex items-center gap-1.5">
                      <Clock size={14} className="text-indigo-600 shrink-0" />
                      <span>
                        {new Date(sess.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} -{' '}
                        {new Date(sess.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ({new Date(sess.start_time).toLocaleDateString()})
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Key size={14} className="text-amber-600 shrink-0" />
                      <span>
                        Invigilator PIN: {sess.access_pin ? <strong className="tracking-widest font-mono text-indigo-900 bg-indigo-100 px-2 py-0.5 rounded text-sm">{sess.access_pin}</strong> : <span className="italic text-gray-400">None</span>}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <UserCheck size={14} className="text-emerald-600 shrink-0" />
                      <span>Rostered Candidates: <strong>{sess.student_count || 0} students</strong></span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-gray-100 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openRoster(sess)}
                        className="text-xs inline-flex items-center gap-1 text-indigo-700 border-indigo-200 hover:bg-indigo-50"
                      >
                        <Users size={13} />
                        {activeSessionRoster?.id === sess.id ? 'Viewing Roster' : 'Roster'}
                      </Button>

                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => startEditSession(sess)}
                        className="text-xs inline-flex items-center gap-1 text-gray-700 hover:bg-gray-100"
                        title="Edit Session Name, Times, or PIN"
                      >
                        <Edit2 size={13} />
                        Edit
                      </Button>
                    </div>

                    <button
                      onClick={() => handleDeleteSession(sess.id)}
                      className="text-red-500 hover:text-red-700 p-1.5 rounded-md hover:bg-red-50 transition-colors"
                      title="Delete session"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              )
            ))}
          </div>
        )}

        {/* Active Session Roster Panel */}
        {activeSessionRoster && (
          <div className="p-4 bg-gray-50 rounded-xl border border-indigo-200 space-y-4 animate-fadeIn">
            <div className="flex justify-between items-center">
              <div>
                <h5 className="font-bold text-gray-900 text-sm">
                  Student Roster: {activeSessionRoster.session_name} ({rosterStudents.length} Students)
                </h5>
                <p className="text-xs text-gray-500">
                  Only assigned students in this roster can enter this session window using the PIN.
                </p>
              </div>
              <button
                onClick={() => setActiveSessionRoster(null)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded hover:bg-gray-200"
              >
                <X size={18} />
              </button>
            </div>

            {/* Add Student Dropdown */}
            <div className="flex flex-col sm:flex-row gap-2">
              <select
                value={selectedStudentToAdd}
                onChange={(e) => setSelectedStudentToAdd(e.target.value)}
                className="flex-1 px-3 py-1.5 border border-gray-300 rounded-md text-xs bg-white focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">-- Select Student to Assign to this Cohort --</option>
                {allStudents
                  .filter(st => !rosterStudents.some(r => r.student_id === st.id))
                  .map(st => (
                    <option key={st.id} value={st.id}>
                      {st.name} ({st.index_number || st.email})
                    </option>
                  ))}
              </select>
              <Button
                variant="primary"
                size="sm"
                disabled={!selectedStudentToAdd}
                onClick={() => handleAddStudentToRoster(selectedStudentToAdd)}
                className="text-xs bg-indigo-600 hover:bg-indigo-700"
              >
                Assign Student
              </Button>
            </div>

            {/* Roster Table */}
            {loadingRoster ? (
              <div className="text-center py-4 text-xs text-gray-500">Loading roster...</div>
            ) : rosterStudents.length === 0 ? (
              <p className="text-xs text-gray-400 italic py-2">
                No students currently assigned to this session. Click &quot;Auto-Split Students&quot; at the top, or select from the dropdown above.
              </p>
            ) : (
              <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg bg-white">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 text-gray-600 sticky top-0 border-b border-gray-200">
                    <tr>
                      <th className="text-left py-2 px-3">Student Name</th>
                      <th className="text-left py-2 px-3">Index / ID</th>
                      <th className="text-right py-2 px-3">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {rosterStudents.map((rs) => (
                      <tr key={rs.id} className="hover:bg-gray-50">
                        <td className="py-1.5 px-3 font-medium text-gray-800">{rs.student_name}</td>
                        <td className="py-1.5 px-3 text-gray-500">{rs.index_number || (rs as any).student_index_number || rs.student_email}</td>
                        <td className="py-1.5 px-3 text-right">
                          <button
                            onClick={() => handleRemoveStudentFromRoster(rs.student_id)}
                            className="text-red-500 hover:text-red-700 text-[11px] font-semibold"
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
