import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, AlertCircle, CheckCircle, Search, Plus, RefreshCw, Calendar, ShieldAlert, KeyRound } from 'lucide-react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Badge from '../../components/ui/Badge';
import Select from '../../components/ui/Select';
import Pagination from '../../components/ui/Pagination';
import Modal from '../../components/ui/Modal';
import { db } from '../../lib/database';
import { useAuth } from '../../contexts/AuthContext';

interface QuizAttempt {
  id: string;
  quiz_id: string;
  student_id: string;
  student_name: string;
  student_email: string;
  quiz_title: string;
  started_at: string;
  deadline?: string;
  duration_minutes: number;
  time_remaining: number;
  status: 'in_progress' | 'submitted' | 'graded' | 'expired' | 'disconnected';
  original_duration: number;
  extensions_applied: number;
  last_activity: string;
  network_issues: boolean;
  cheated?: boolean;
  cheating_reason?: string;
  bonus_minutes_applied?: number;
}

interface ExtensionRequest {
  id: string;
  attempt_id: string;
  requested_by: string;
  extension_minutes: number;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  processed_at?: string;
  processed_by?: string;
  requested_by_name?: string;
  quiz_title?: string;
  quiz_deadline?: string;
  student_name?: string;
}

export default function QuizTimeExtension() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [quizAttempts, setQuizAttempts] = useState<QuizAttempt[]>([]);
  const [extensionRequests, setExtensionRequests] = useState<ExtensionRequest[]>([]);
  const [selectedAttempts, setSelectedAttempts] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [quizFilter, setQuizFilter] = useState('all');
  const [scopeFilter, setScopeFilter] = useState<'active' | 'all'>('active');
  const [loading, setLoading] = useState(true);
  const [activeQuizzes, setActiveQuizzes] = useState<any[]>([]);
  const [extensionMinutes, setExtensionMinutes] = useState(15);
  const [extensionReason, setExtensionReason] = useState('Network connectivity issues');
  const [showBulkExtension, setShowBulkExtension] = useState(false);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [requestsPage, setRequestsPage] = useState(1);
  const [requestsPerPage, setRequestsPerPage] = useState(5);

  useEffect(() => {
    loadQuizAttempts();
    loadExtensionRequests();
    loadActiveQuizzes();

    // Auto-refresh every 8 seconds so incoming remote requests appear in real time
    const pollInterval = setInterval(() => {
      loadQuizAttempts();
      loadExtensionRequests();
    }, 8000);
    return () => clearInterval(pollInterval);
  }, []);

  // Reset pagination on filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, quizFilter, scopeFilter]);

  useEffect(() => {
    setRequestsPage(1);
  }, [scopeFilter]);

  // Treat exams within a 12-hour post-deadline recovery window as active so Admins can reopen auto-submitted attempts
  const isQuizDeadlinePassed = (deadline?: string) => {
    if (!deadline) return false;
    return new Date(deadline).getTime() + 12 * 60 * 60 * 1000 < Date.now();
  };

  const loadQuizAttempts = async () => {
    try {
      const attempts = await db.getQuizAttemptsForExtension(150);
      const now = Date.now();
      
      // Calculate true live countdown clock and network issues
      const processedAttempts = attempts.map((attempt: any) => {
        const isFinished = attempt.status === 'submitted' || attempt.status === 'graded' || attempt.status === 'expired';
        const attemptAgeMinutes = (now - new Date(attempt.started_at).getTime()) / (60 * 1000);
        const totalDurationMinutes = (attempt.duration_minutes || 0) + (attempt.time_remaining || 0);
        const actualRemaining = isFinished ? 0 : Math.max(0, Math.floor(totalDurationMinutes - attemptAgeMinutes));

        return {
          ...attempt,
          network_issues: !isFinished && attempt.last_activity && 
            new Date(attempt.last_activity) < new Date(now - 5 * 60 * 1000), // No activity for 5 minutes
          time_remaining: actualRemaining,
          bonus_minutes_applied: attempt.time_remaining || 0,
        };
      });

      setQuizAttempts(processedAttempts);
    } catch (error) {
      console.error('Error loading quiz attempts:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadExtensionRequests = async () => {
    try {
      const requests = await db.getExtensionRequests(50);
      setExtensionRequests(requests as ExtensionRequest[]);
    } catch (error) {
      console.error('Error loading extension requests:', error);
    }
  };

  const loadActiveQuizzes = async () => {
    try {
      const quizzes = await db.getQuizzes();
      const sorted = (quizzes || []).sort((a: any, b: any) => {
        const dateA = new Date(a.published_at || a.created_at).getTime();
        const dateB = new Date(b.published_at || b.created_at).getTime();
        return dateB - dateA;
      });
      setActiveQuizzes(sorted);
    } catch (error) {
      console.error('Error loading active quizzes:', error);
    }
  };

  const handleExtendTime = async (attemptId: string, minutes: number, reason: string, skipCreateRequest = false) => {
    try {
      const attempt = quizAttempts.find(a => a.id === attemptId);
      if (!attempt) return;

      // Security Guard: Prohibit extensions for candidates terminated for cheating
      if (attempt.cheated) {
        alert('⛔ Cannot Extend Attempt:\n\nThis student attempt was terminated for academic dishonesty / cheating. Time extensions are restricted.');
        return;
      }

      const wasSubmittedOrExpired = attempt.status === 'submitted' || attempt.status === 'graded' || attempt.status === 'expired' || attempt.time_remaining <= 0;

      // Update attempt status to in_progress and bridge elapsed dead time + added minutes in database
      await db.extendQuizTime(attemptId, minutes, user?.id || '');

      // Log the extension / reopen action
      await db.createAuditLog(
        user?.id || '',
        wasSubmittedOrExpired ? 'reopen_and_extend_time' : 'extend_time',
        'quiz_attempt',
        attemptId,
        JSON.stringify({ extended_minutes: minutes, reason, previous_status: attempt.status })
      );

      // Create extension request record if not approving an existing request
      if (!skipCreateRequest) {
        await db.createExtensionRequest(attemptId, user?.id || '', minutes, reason, 'approved', user?.id || '');
      }

      alert(
        wasSubmittedOrExpired
          ? `✅ Attempt reopened for ${attempt.student_name} with a fresh ${minutes} minutes starting right now (all previously saved answers preserved).`
          : `✅ Time successfully extended by ${minutes} minutes for ${attempt.student_name}.`
      );
      loadQuizAttempts();
      loadExtensionRequests();
    } catch (error) {
      console.error('Error extending time:', error);
      alert('Failed to extend time');
    }
  };

  const handleBulkExtendTime = async () => {
    if (selectedAttempts.length === 0) {
      alert('Please select at least one attempt to extend time');
      return;
    }

    // Filter out attempts whose quiz deadline has expired
    const validAttempts = selectedAttempts.filter(id => {
      const att = quizAttempts.find(a => a.id === id);
      return att && !isQuizDeadlinePassed(att.deadline);
    });

    if (validAttempts.length === 0) {
      alert('⛔ Cannot Extend Selected Attempts:\n\nAll selected attempts belong to quizzes whose institutional deadline has already passed. Quizzes must be open to receive attempt extensions.');
      return;
    }

    const skippedCount = selectedAttempts.length - validAttempts.length;

    try {
      for (const attemptId of validAttempts) {
        await handleExtendTime(attemptId, extensionMinutes, extensionReason);
      }
      
      setSelectedAttempts([]);
      setShowBulkExtension(false);
      
      let message = `✅ Time extended by ${extensionMinutes} minutes for ${validAttempts.length} student(s).`;
      if (skippedCount > 0) {
        message += `\n\n⚠️ ${skippedCount} attempt(s) were skipped because their quiz deadline has already passed.`;
      }
      alert(message);
    } catch (error) {
      console.error('Error in bulk extension:', error);
    }
  };

  const handleApproveRequest = async (requestId: string) => {
    try {
      const request = extensionRequests.find(r => r.id === requestId);
      if (!request) return;

      if (isQuizDeadlinePassed(request.quiz_deadline)) {
        alert('⛔ Cannot Approve Request:\n\nThe overall quiz deadline for this exam has already passed. Students cannot take or continue closed exams.\n\nAn administrator or lecturer must first adjust the quiz deadline before time extensions can be granted.');
        return;
      }

      // Update the request status
      await db.updateExtensionRequestStatus(requestId, 'approved', user?.id || '');

      // Apply the time extension
      await handleExtendTime(request.attempt_id, request.extension_minutes, request.reason, true);
      
      loadExtensionRequests();
    } catch (error) {
      console.error('Error approving request:', error);
    }
  };

  const handleRejectRequest = async (requestId: string) => {
    try {
      await db.updateExtensionRequestStatus(requestId, 'rejected', user?.id || '');
      loadExtensionRequests();
    } catch (error) {
      console.error('Error rejecting request:', error);
    }
  };

  // Filter attempts based on search, status, quiz, and active vs all scope - newest first
  const filteredAttempts = quizAttempts
    .filter(attempt => {
      const isExpired = isQuizDeadlinePassed(attempt.deadline);

      // Scope filter: In 'active' mode, hide past/closed quizzes
      if (scopeFilter === 'active' && isExpired) {
        return false;
      }

      const matchesSearch = attempt.student_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           attempt.student_email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           attempt.quiz_title.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'submitted_or_graded'
          ? attempt.status === 'submitted' || attempt.status === 'graded'
          : attempt.status === statusFilter);
      const matchesQuiz = quizFilter === 'all' || attempt.quiz_id === quizFilter;
      
      return matchesSearch && matchesStatus && matchesQuiz;
    })
    .sort((a, b) => new Date(b.started_at || b.last_activity).getTime() - new Date(a.started_at || a.last_activity).getTime());

  // Paginated attempts
  const totalAttemptPages = Math.ceil(filteredAttempts.length / itemsPerPage);
  const paginatedAttempts = filteredAttempts.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Filter extension requests based on scope, prioritized with pending & newest at the very top
  const filteredRequests = extensionRequests
    .filter(req => {
      if (scopeFilter === 'all') return true;
      // In active mode, show pending requests or requests for active quizzes
      return req.status === 'pending' || !isQuizDeadlinePassed(req.quiz_deadline);
    })
    .sort((a, b) => {
      // Pending requests always at the very top
      if (a.status === 'pending' && b.status !== 'pending') return -1;
      if (a.status !== 'pending' && b.status === 'pending') return 1;
      // Most recent first
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

  // Paginated requests
  const totalRequestPages = Math.ceil(filteredRequests.length / requestsPerPage);
  const paginatedRequests = filteredRequests.slice(
    (requestsPage - 1) * requestsPerPage,
    requestsPage * requestsPerPage
  );

  // Page select-all helpers
  const pageSelectableAttempts = paginatedAttempts.filter(a => !isQuizDeadlinePassed(a.deadline));
  const isAllPageSelected = pageSelectableAttempts.length > 0 && pageSelectableAttempts.every(a => selectedAttempts.includes(a.id));

  const getStatusBadge = (status: string, expiredQuiz: boolean = false, cheated?: boolean) => {
    if (cheated) {
      return <Badge variant="danger" className="bg-red-100 text-red-800 border border-red-300">Cheating Locked</Badge>;
    }
    if (expiredQuiz) {
      return <Badge variant="secondary" className="bg-gray-100 text-gray-700 border border-gray-300">Exam Closed</Badge>;
    }
    switch (status) {
      case 'in_progress': return <Badge variant="success">In Progress</Badge>;
      case 'expired': return <Badge variant="warning">Timer Expired</Badge>;
      case 'submitted':
      case 'graded':
        return <Badge variant="primary">Submitted (Reopenable)</Badge>;
      case 'disconnected': return <Badge variant="danger">Disconnected</Badge>;
      default: return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const formatTimeRemaining = (minutes: number) => {
    if (minutes <= 0) return '0m (Expired)';
    const hours = Math.floor(minutes / 60);
    const mins = Math.floor(minutes % 60);
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  // Metrics calculations
  const activeInProgressCount = quizAttempts.filter(a => a.status === 'in_progress' && !isQuizDeadlinePassed(a.deadline)).length;
  const timerExpiredOngoingCount = quizAttempts.filter(a => a.status === 'expired' && !isQuizDeadlinePassed(a.deadline)).length;
  const networkIssuesCount = quizAttempts.filter(a => a.network_issues && !isQuizDeadlinePassed(a.deadline)).length;
  const pendingRequestsCount = extensionRequests.filter(r => r.status === 'pending').length;
  const closedExamsCount = quizAttempts.filter(a => isQuizDeadlinePassed(a.deadline)).length;

  if (loading) {
    return <div className="text-center py-12 text-gray-600 font-medium">Loading live examination attempts...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Quiz Time Extension & Resumption</h1>
          <p className="text-gray-600">Centralized academic authorization for network downtime, power outages, and student session compensation.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => navigate(user?.role === 'super_admin' ? '/super-admin/users' : '/admin/users')}
            className="border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100 font-semibold"
          >
            <KeyRound size={15} className="mr-1.5" />
            Reset Student Password
          </Button>
          <Badge variant="primary" className="px-3 py-1 text-sm font-semibold">
            Academic Officer
          </Badge>
        </div>
      </div>

      {/* Quick Stats - Focused on Live Monitoring */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4 border-l-4 border-blue-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-wider text-gray-500 font-semibold">Active In-Progress</p>
              <p className="text-2xl font-bold text-blue-900 mt-1">
                {activeInProgressCount}
              </p>
              <p className="text-xs text-gray-500 mt-1">Students actively writing</p>
            </div>
            <Clock className="text-blue-500" size={28} />
          </div>
        </Card>

        <Card className="p-4 border-l-4 border-amber-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-wider text-gray-500 font-semibold">Timer Expired (Live)</p>
              <p className="text-2xl font-bold text-amber-900 mt-1">
                {timerExpiredOngoingCount}
              </p>
              <p className="text-xs text-gray-500 mt-1">Eligible for outage compensation</p>
            </div>
            <AlertCircle className="text-amber-500" size={28} />
          </div>
        </Card>

        <Card className="p-4 border-l-4 border-orange-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-wider text-gray-500 font-semibold">Network Inactive</p>
              <p className="text-2xl font-bold text-orange-900 mt-1">
                {networkIssuesCount}
              </p>
              <p className="text-xs text-gray-500 mt-1">&gt;5 min client silence</p>
            </div>
            <ShieldAlert className="text-orange-500" size={28} />
          </div>
        </Card>

        <Card className="p-4 border-l-4 border-purple-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-wider text-gray-500 font-semibold">Pending Requests</p>
              <p className="text-2xl font-bold text-purple-900 mt-1">
                {pendingRequestsCount}
              </p>
              <p className="text-xs text-gray-500 mt-1">Invigilator requests</p>
            </div>
            <Clock className="text-purple-500" size={28} />
          </div>
        </Card>
      </div>

      {/* Scope, Filters & Search */}
      <Card className="p-4 space-y-4">
        {/* Institutional Scope Toggle */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-gray-100 gap-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-gray-700">Exam Scope:</span>
            <div className="inline-flex rounded-lg shadow-sm border border-gray-200 p-0.5 bg-gray-50" role="group">
              <button
                type="button"
                onClick={() => setScopeFilter('active')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                  scopeFilter === 'active'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-gray-700 hover:text-gray-900 hover:bg-gray-200'
                }`}
              >
                🟢 Active Ongoing Exams Only
              </button>
              <button
                type="button"
                onClick={() => setScopeFilter('all')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                  scopeFilter === 'all'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-gray-700 hover:text-gray-900 hover:bg-gray-200'
                }`}
              >
                📁 All Exams (Including Closed: {closedExamsCount})
              </button>
            </div>
          </div>
          {scopeFilter === 'active' ? (
            <span className="text-xs text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 font-medium inline-flex items-center gap-1.5 self-start sm:self-auto">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              Showing active quizzes only; past expired exams hidden
            </span>
          ) : (
            <span className="text-xs text-amber-800 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200 font-medium inline-flex items-center gap-1 self-start sm:self-auto">
              <AlertCircle size={12} />
              Viewing all historical attempts (extensions locked on closed quizzes)
            </span>
          )}
        </div>

        {/* Filter Selectors */}
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <Input
                placeholder="Search by student name, email, or quiz title..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 text-sm"
              />
            </div>
          </div>
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            options={[
              { value: 'all', label: 'All Attempt Statuses' },
              { value: 'in_progress', label: 'In Progress' },
              { value: 'submitted_or_graded', label: 'Submitted / Auto-Submitted (Reopenable)' },
              { value: 'expired', label: 'Timer Expired' },
              { value: 'disconnected', label: 'Disconnected' },
            ]}
          />
          <Select
            value={quizFilter}
            onChange={(e) => setQuizFilter(e.target.value)}
            options={[
              { value: 'all', label: scopeFilter === 'active' ? 'All Active Quizzes' : 'All Quizzes (Active & Closed)' },
              ...activeQuizzes
                .filter(quiz => scopeFilter === 'all' || !isQuizDeadlinePassed(quiz.deadline))
                .map((quiz) => ({
                  value: quiz.id,
                  label: `${quiz.title}${isQuizDeadlinePassed(quiz.deadline) ? ' (Closed)' : ''}`,
                })),
            ]}
          />
          <Button onClick={() => { loadQuizAttempts(); loadExtensionRequests(); }} variant="secondary">
            <RefreshCw size={15} className="mr-1.5" />
            Refresh
          </Button>
        </div>
      </Card>

      {/* Bulk Extension Action Bar */}
      {selectedAttempts.length > 0 && (
        <Card className="p-4 bg-blue-50 border-blue-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <p className="font-semibold text-blue-900">
                {selectedAttempts.length} student attempt(s) selected
              </p>
              <p className="text-xs text-blue-700 mt-0.5">
                Bulk technical downtime compensation will apply to all selected open exam attempts.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={() => setShowBulkExtension(true)}>
                <Plus size={16} className="mr-1.5" />
                Extend Selected ({selectedAttempts.length})
              </Button>
              <Button variant="secondary" onClick={() => setSelectedAttempts([])} className="text-xs">
                Clear Selection
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Extension Requests Received from Invigilators (Shown at the Top, Newest First) */}
      <Card className={`overflow-hidden transition-all shadow-sm ${pendingRequestsCount > 0 ? 'border-2 border-amber-400 bg-amber-50/15' : ''}`}>
        <div className="p-4 flex items-center justify-between border-b border-gray-100">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-gray-900">Invigilator & Terminal Extension Requests</h2>
              {pendingRequestsCount > 0 && (
                <span className="flex h-2.5 w-2.5 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500">Live requests logged from exam hall computers requesting remote academic authorization (newest shown first).</p>
          </div>
          <Badge variant={pendingRequestsCount > 0 ? 'warning' : 'primary'} className="font-semibold">
            {pendingRequestsCount} Pending Review
          </Badge>
        </div>

        <div className="p-4 space-y-3">
          {paginatedRequests.length === 0 ? (
            <div className="text-center py-6 text-gray-500">
              <CheckCircle size={28} className="mx-auto text-emerald-400 mb-1.5" />
              <p className="font-medium text-sm">No pending extension requests</p>
              <p className="text-xs text-gray-400 mt-0.5">All incoming room authorization requests have been handled.</p>
            </div>
          ) : (
            paginatedRequests.map((request) => {
              const isClosed = isQuizDeadlinePassed(request.quiz_deadline);

              return (
                <div key={request.id} className={`border rounded-lg p-4 transition-colors ${request.status === 'pending' ? 'border-amber-300 bg-amber-50/40 shadow-sm' : isClosed ? 'border-gray-200 bg-gray-50/60' : 'border-gray-200 bg-white'}`}>
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <h3 className="font-bold text-gray-900">
                          {request.student_name}
                        </h3>
                        <Badge variant={
                          request.status === 'pending' ? 'warning' :
                          request.status === 'approved' ? 'success' : 'danger'
                        }>
                          {request.status.toUpperCase()}
                        </Badge>
                        {isClosed && (
                          <Badge variant="danger" className="text-xs">
                            Exam Closed
                          </Badge>
                        )}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-600 mt-2">
                        <p><span className="font-semibold text-gray-700">Quiz:</span> {request.quiz_title}</p>
                        <p><span className="font-semibold text-gray-700">Requested By:</span> {request.requested_by_name || 'Invigilator'}</p>
                        <p><span className="font-semibold text-gray-700">Compensation:</span> <span className="font-bold text-blue-700">+{request.extension_minutes} minutes</span></p>
                        <p><span className="font-semibold text-gray-700">Reason:</span> {request.reason}</p>
                        <p className="text-gray-400 sm:col-span-2 mt-1">Logged: {new Date(request.created_at).toLocaleString()}</p>
                      </div>
                    </div>
                    {request.status === 'pending' && (
                      <div className="flex items-center gap-2 sm:self-center">
                        <Button
                          size="sm"
                          disabled={isClosed}
                          onClick={() => handleApproveRequest(request.id)}
                          className={isClosed ? 'opacity-50 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-sm'}
                        >
                          <CheckCircle size={15} className="mr-1" />
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() => handleRejectRequest(request.id)}
                        >
                          <AlertCircle size={15} className="mr-1" />
                          Reject
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Requests Pagination */}
        {filteredRequests.length > requestsPerPage && (
          <Pagination
            currentPage={requestsPage}
            totalPages={totalRequestPages}
            totalItems={filteredRequests.length}
            itemsPerPage={requestsPerPage}
            onPageChange={setRequestsPage}
            onItemsPerPageChange={(newSize) => {
              setRequestsPerPage(newSize);
              setRequestsPage(1);
            }}
            pageSizeOptions={[5, 10, 25]}
          />
        )}
      </Card>

      {/* Quiz Attempts Table */}
      <Card className="overflow-hidden">
        <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-bold text-gray-900">
              {scopeFilter === 'active' ? 'Live Examination Attempts (Active Quizzes)' : 'All Examination Attempts (Active & Closed Quizzes)'}
            </h2>
            <p className="text-xs text-gray-500">
              Authorized academic officers can grant supplementary time for students affected by computer lab or network failures.
            </p>
          </div>
          <div className="text-xs font-semibold px-2.5 py-1 bg-gray-100 rounded-md text-gray-700">
            {filteredAttempts.length} total attempt(s)
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-gray-200 text-xs font-semibold text-gray-600 uppercase tracking-wider bg-gray-50/50">
                <th className="py-3 px-4 w-10">
                  <input
                    type="checkbox"
                    checked={isAllPageSelected}
                    onChange={(e) => {
                      if (e.target.checked) {
                        const pageSelectableIds = pageSelectableAttempts.map(a => a.id);
                        setSelectedAttempts(prev => Array.from(new Set([...prev, ...pageSelectableIds])));
                      } else {
                        const pageIds = new Set(paginatedAttempts.map(a => a.id));
                        setSelectedAttempts(prev => prev.filter(id => !pageIds.has(id)));
                      }
                    }}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded cursor-pointer"
                  />
                </th>
                <th className="py-3 px-4">Student</th>
                <th className="py-3 px-4">Quiz & Schedule</th>
                <th className="py-3 px-4">Attempt Status</th>
                <th className="py-3 px-4">Time Remaining</th>
                <th className="py-3 px-4">Extensions</th>
                <th className="py-3 px-4">Network Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm">
              {paginatedAttempts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-10 text-gray-500">
                    <Clock size={36} className="mx-auto text-gray-300 mb-2" />
                    <p className="font-medium">No quiz attempts match the selected criteria</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {scopeFilter === 'active'
                        ? 'There are currently no active in-progress attempts on open quizzes.'
                        : 'No attempts found across all active or historical quizzes.'}
                    </p>
                  </td>
                </tr>
              ) : (
                paginatedAttempts.map((attempt) => {
                  const isClosed = isQuizDeadlinePassed(attempt.deadline);

                  return (
                    <tr key={attempt.id} className={`hover:bg-gray-50/80 transition-colors ${isClosed ? 'bg-gray-50/40 opacity-75' : ''}`}>
                      <td className="py-3 px-4">
                        <input
                          type="checkbox"
                          disabled={isClosed}
                          checked={selectedAttempts.includes(attempt.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedAttempts([...selectedAttempts, attempt.id]);
                            } else {
                              setSelectedAttempts(selectedAttempts.filter(id => id !== attempt.id));
                            }
                          }}
                          className={`h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded ${
                            isClosed ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'
                          }`}
                        />
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-gray-900">{attempt.student_name}</div>
                        <div className="text-xs text-gray-500">{attempt.student_email}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-gray-900">{attempt.quiz_title}</div>
                        <div className="text-xs mt-0.5">
                          {attempt.deadline ? (
                            isClosed ? (
                              <span className="text-red-700 font-semibold inline-flex items-center gap-1">
                                <AlertCircle size={12} /> Deadline Closed ({new Date(attempt.deadline).toLocaleDateString()})
                              </span>
                            ) : (
                              <span className="text-emerald-700 font-medium inline-flex items-center gap-1">
                                <Calendar size={12} /> Closes: {new Date(attempt.deadline).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            )
                          ) : (
                            <span className="text-gray-400">Open-ended quiz</span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4">{getStatusBadge(attempt.status, isClosed, attempt.cheated)}</td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5">
                          <Clock size={15} className="text-gray-400" />
                          <span className={`font-mono text-xs font-semibold ${
                            isClosed ? 'text-gray-400' :
                            attempt.time_remaining <= 5 ? 'text-red-600' : 
                            attempt.time_remaining <= 15 ? 'text-amber-600' : 'text-gray-900'
                          }`}>
                            {formatTimeRemaining(attempt.time_remaining)}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        {attempt.extensions_applied > 0 ? (
                          <Badge variant="warning">
                            {attempt.extensions_applied} applied (+{attempt.bonus_minutes_applied || 0}m)
                          </Badge>
                        ) : (
                          <span className="text-xs text-gray-400">None</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {attempt.network_issues ? (
                          <Badge variant="danger" className="inline-flex items-center">
                            <AlertCircle size={11} className="mr-1" />
                            Silence &gt;5m
                          </Badge>
                        ) : (
                          <Badge variant="success" className="inline-flex items-center">
                            <CheckCircle size={11} className="mr-1" />
                            Active
                          </Badge>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {attempt.cheated ? (
                          <span className="text-xs text-red-700 font-semibold italic bg-red-50 px-2 py-1 rounded border border-red-200">
                            Cheating Terminated
                          </span>
                        ) : isClosed ? (
                          <span className="text-xs text-gray-500 font-medium italic bg-gray-100 px-2 py-1 rounded border border-gray-200">
                            Quiz Closed
                          </span>
                        ) : attempt.status === 'submitted' || attempt.status === 'graded' || attempt.status === 'expired' || attempt.time_remaining <= 0 ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              size="sm"
                              onClick={() => handleExtendTime(attempt.id, 15, 'Reopened after technical issue / timer expired')}
                              className="text-xs font-semibold py-1 px-2.5 bg-indigo-600 hover:bg-indigo-700 text-white"
                            >
                              Reopen +15m
                            </Button>
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => handleExtendTime(attempt.id, 30, 'Reopened after extended technical downtime')}
                              className="text-xs font-semibold py-1 px-2.5"
                            >
                              Reopen +30m
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              size="sm"
                              onClick={() => handleExtendTime(attempt.id, 15, 'Network / Lab Outage')}
                              className="text-xs font-semibold py-1 px-2.5"
                            >
                              +15m
                            </Button>
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => handleExtendTime(attempt.id, 30, 'Extended System Technical Downtime')}
                              className="text-xs font-semibold py-1 px-2.5"
                            >
                              +30m
                            </Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Attempts Table Pagination */}
        {filteredAttempts.length > 0 && (
          <Pagination
            currentPage={currentPage}
            totalPages={totalAttemptPages}
            totalItems={filteredAttempts.length}
            itemsPerPage={itemsPerPage}
            onPageChange={setCurrentPage}
            onItemsPerPageChange={(newSize) => {
              setItemsPerPage(newSize);
              setCurrentPage(1);
            }}
            pageSizeOptions={[10, 20, 50, 100]}
          />
        )}
      </Card>

      {/* Bulk Extension Modal */}
      <Modal
        isOpen={showBulkExtension}
        onClose={() => setShowBulkExtension(false)}
        title={`Extend Time for ${selectedAttempts.length} Student(s)`}
        size="sm"
        footer={
          <div className="flex gap-2 w-full">
            <Button
              onClick={handleBulkExtendTime}
              className="flex-1"
            >
              Apply Extension
            </Button>
            <Button
              variant="secondary"
              onClick={() => setShowBulkExtension(false)}
              className="flex-1"
            >
              Cancel
            </Button>
          </div>
        }
      >
        <div>
          <p className="text-xs text-slate-500 mb-4">
            Extra minutes will be added to the remaining attempt time of each selected active candidate.
          </p>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Extension Duration (Minutes)
              </label>
              <Input
                type="number"
                value={extensionMinutes}
                onChange={(e) => setExtensionMinutes(parseInt(e.target.value) || 0)}
                min="1"
                max="120"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Institutional Reason
              </label>
              <Input
                value={extensionReason}
                onChange={(e) => setExtensionReason(e.target.value)}
                placeholder="e.g. Lab 3 Power Fluctuation Downtime"
              />
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
