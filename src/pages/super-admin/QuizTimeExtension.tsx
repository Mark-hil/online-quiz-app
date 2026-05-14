import { useEffect, useState } from 'react';
import { Clock, AlertCircle, CheckCircle, Search, Plus, RefreshCw } from 'lucide-react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Badge from '../../components/ui/Badge';
import Select from '../../components/ui/Select';
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
  deadline: string;
  duration_minutes: number;
  time_remaining: number;
  status: 'in_progress' | 'submitted' | 'expired' | 'disconnected';
  original_duration: number;
  extensions_applied: number;
  last_activity: string;
  network_issues: boolean;
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
  student_name?: string;
}

export default function QuizTimeExtension() {
  const { user } = useAuth();
  const [quizAttempts, setQuizAttempts] = useState<QuizAttempt[]>([]);
  const [extensionRequests, setExtensionRequests] = useState<ExtensionRequest[]>([]);
  const [selectedAttempts, setSelectedAttempts] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [quizFilter, setQuizFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [activeQuizzes, setActiveQuizzes] = useState<any[]>([]);
  const [extensionMinutes, setExtensionMinutes] = useState(15);
  const [extensionReason, setExtensionReason] = useState('Network connectivity issues');
  const [showBulkExtension, setShowBulkExtension] = useState(false);

  useEffect(() => {
    loadQuizAttempts();
    loadExtensionRequests();
    loadActiveQuizzes();
  }, []);

  const loadQuizAttempts = async () => {
    try {
      const attempts = await db.getQuizAttemptsForExtension(50); // Limit to 50 for better performance
      
      // Calculate network issues based on last activity
      const processedAttempts = attempts.map((attempt: any) => ({
        ...attempt,
        network_issues: attempt.last_activity && 
          new Date(attempt.last_activity) < new Date(Date.now() - 5 * 60 * 1000), // No activity for 5 minutes
        time_remaining: Math.max(0, attempt.time_remaining || 0),
      }));

      setQuizAttempts(processedAttempts);
    } catch (error) {
      console.error('Error loading quiz attempts:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadExtensionRequests = async () => {
    try {
      const requests = await db.getExtensionRequests(25); // Limit to 25 for better performance
      setExtensionRequests(requests as ExtensionRequest[]);
    } catch (error) {
      console.error('Error loading extension requests:', error);
    }
  };

  const loadActiveQuizzes = async () => {
    try {
      const quizzes = await db.getQuizzes();
      setActiveQuizzes(quizzes.slice(0, 50)); // Limit to 50 for better performance
    } catch (error) {
      console.error('Error loading active quizzes:', error);
    }
  };

  const handleExtendTime = async (attemptId: string, minutes: number, reason: string) => {
    try {
      // Get current attempt details
      const attempt = quizAttempts.find(a => a.id === attemptId);
      if (!attempt) return;

      // Update deadline in database
      await db.extendQuizTime(attemptId, minutes, user?.id || '');

      // Log the extension
      await db.createAuditLog(
        user?.id || '',
        'extend_time',
        'quiz_attempt',
        attemptId,
        JSON.stringify({ extended_minutes: minutes, reason })
      );

      // Create extension request record
      await db.createExtensionRequest(attemptId, user?.id || '', minutes, reason);

      alert(`Time extended by ${minutes} minutes successfully`);
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

    try {
      for (const attemptId of selectedAttempts) {
        await handleExtendTime(attemptId, extensionMinutes, extensionReason);
      }
      
      setSelectedAttempts([]);
      setShowBulkExtension(false);
      alert(`Time extended for ${selectedAttempts.length} students`);
    } catch (error) {
      console.error('Error in bulk extension:', error);
    }
  };

  const handleApproveRequest = async (requestId: string) => {
    try {
      const request = extensionRequests.find(r => r.id === requestId);
      if (!request) return;

      // Update the request status
      await db.updateExtensionRequestStatus(requestId, 'approved', user?.id || '');

      // Apply the time extension
      await handleExtendTime(request.attempt_id, request.extension_minutes, request.reason);
      
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

  const filteredAttempts = quizAttempts.filter(attempt => {
    const matchesSearch = attempt.student_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         attempt.student_email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         attempt.quiz_title.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || attempt.status === statusFilter;
    const matchesQuiz = quizFilter === 'all' || attempt.quiz_id === quizFilter;
    
    return matchesSearch && matchesStatus && matchesQuiz;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'in_progress': return <Badge variant="success">In Progress</Badge>;
      case 'expired': return <Badge variant="danger">Expired</Badge>;
      case 'submitted': return <Badge variant="primary">Submitted</Badge>;
      case 'disconnected': return <Badge variant="warning">Disconnected</Badge>;
      default: return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const formatTimeRemaining = (minutes: number) => {
    if (minutes <= 0) return 'Expired';
    const hours = Math.floor(minutes / 60);
    const mins = Math.floor(minutes % 60);
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  if (loading) {
    return <div className="text-center py-12">Loading quiz attempts...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Quiz Time Extension</h1>
          <p className="text-gray-600">Manage and extend quiz time for students affected by network issues</p>
        </div>
        <Badge variant="primary">
          Super Admin
        </Badge>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Active Quizzes</p>
              <p className="text-2xl font-bold text-gray-900">
                {quizAttempts.filter(a => a.status === 'in_progress').length}
              </p>
            </div>
            <Clock className="text-blue-600" size={24} />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Expired</p>
              <p className="text-2xl font-bold text-gray-900">
                {quizAttempts.filter(a => a.status === 'expired').length}
              </p>
            </div>
            <AlertCircle className="text-red-600" size={24} />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Network Issues</p>
              <p className="text-2xl font-bold text-gray-900">
                {quizAttempts.filter(a => a.network_issues).length}
              </p>
            </div>
            <AlertCircle className="text-orange-600" size={24} />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Pending Requests</p>
              <p className="text-2xl font-bold text-gray-900">
                {extensionRequests.filter(r => r.status === 'pending').length}
              </p>
            </div>
            <Clock className="text-purple-600" size={24} />
          </div>
        </Card>
      </div>

      {/* Filters and Search */}
      <Card className="p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <Input
                placeholder="Search by student name, email, or quiz title..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            options={[
              { value: 'all', label: 'All Status' },
              { value: 'in_progress', label: 'In Progress' },
              { value: 'expired', label: 'Expired' },
              { value: 'disconnected', label: 'Disconnected' },
            ]}
          />
          <Select
            value={quizFilter}
            onChange={(e) => setQuizFilter(e.target.value)}
            options={[
              { value: 'all', label: 'All Quizzes' },
              ...activeQuizzes.map((quiz) => ({
                value: quiz.id,
                label: quiz.title,
              })),
            ]}
          />
          <Button onClick={loadQuizAttempts} variant="secondary">
            <RefreshCw size={16} className="mr-2" />
            Refresh
          </Button>
        </div>
      </Card>

      {/* Bulk Extension */}
      {selectedAttempts.length > 0 && (
        <Card className="p-4 bg-blue-50 border-blue-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-blue-900">
                {selectedAttempts.length} student(s) selected
              </p>
              <p className="text-sm text-blue-700">
                Extend time for all selected students
              </p>
            </div>
            <Button onClick={() => setShowBulkExtension(true)}>
              <Plus size={16} className="mr-2" />
              Extend Time for Selected
            </Button>
          </div>
        </Card>
      )}

      {/* Quiz Attempts Table */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Active Quiz Attempts</h2>
          <div className="text-sm text-gray-600">
            {filteredAttempts.length} of {quizAttempts.length} attempts
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4">
                  <input
                    type="checkbox"
                    checked={selectedAttempts.length === filteredAttempts.length}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedAttempts(filteredAttempts.map(a => a.id));
                      } else {
                        setSelectedAttempts([]);
                      }
                    }}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                </th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Student</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Quiz</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Status</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Time Remaining</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Extensions</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Network Issues</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredAttempts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-gray-500">
                    No quiz attempts found
                  </td>
                </tr>
              ) : (
                filteredAttempts.map((attempt) => (
                  <tr key={attempt.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4">
                      <input
                        type="checkbox"
                        checked={selectedAttempts.includes(attempt.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedAttempts([...selectedAttempts, attempt.id]);
                          } else {
                            setSelectedAttempts(selectedAttempts.filter(id => id !== attempt.id));
                          }
                        }}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                    </td>
                    <td className="py-3 px-4">
                      <div>
                        <div className="font-medium text-gray-900">{attempt.student_name}</div>
                        <div className="text-sm text-gray-600">{attempt.student_email}</div>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-gray-900">{attempt.quiz_title}</td>
                    <td className="py-3 px-4">{getStatusBadge(attempt.status)}</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <Clock size={16} className="text-gray-400" />
                        <span className={`font-medium ${
                          attempt.time_remaining <= 5 ? 'text-red-600' : 
                          attempt.time_remaining <= 15 ? 'text-orange-600' : 'text-gray-900'
                        }`}>
                          {formatTimeRemaining(attempt.time_remaining)}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant={attempt.extensions_applied > 0 ? 'warning' : 'secondary'}>
                        {attempt.extensions_applied}
                      </Badge>
                    </td>
                    <td className="py-3 px-4">
                      {attempt.network_issues ? (
                        <Badge variant="danger">
                          <AlertCircle size={12} className="mr-1" />
                          Yes
                        </Badge>
                      ) : (
                        <Badge variant="success">
                          <CheckCircle size={12} className="mr-1" />
                          No
                        </Badge>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => handleExtendTime(attempt.id, 15, 'Network connectivity issues')}
                        >
                          +15m
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => handleExtendTime(attempt.id, 30, 'Extended time due to technical issues')}
                        >
                          +30m
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Extension Requests */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Extension Requests</h2>
          <Badge variant="primary">
            {extensionRequests.filter(r => r.status === 'pending').length} Pending
          </Badge>
        </div>
        <div className="space-y-4">
          {extensionRequests.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No extension requests found
            </div>
          ) : (
            extensionRequests.map((request) => (
              <div key={request.id} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-medium text-gray-900">
                        Extension Request for {request.student_name}
                      </h3>
                      <Badge variant={
                        request.status === 'pending' ? 'warning' :
                        request.status === 'approved' ? 'success' : 'danger'
                      }>
                        {request.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-600 mb-2">
                      Quiz: {request.quiz_title}
                    </p>
                    <p className="text-sm text-gray-600 mb-2">
                      Requested by: {request.requested_by_name}
                    </p>
                    <p className="text-sm text-gray-600 mb-2">
                      Extension: {request.extension_minutes} minutes
                    </p>
                    <p className="text-sm text-gray-600 mb-2">
                      Reason: {request.reason}
                    </p>
                    <p className="text-xs text-gray-500">
                      Requested: {new Date(request.created_at).toLocaleString()}
                    </p>
                  </div>
                  {request.status === 'pending' && (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleApproveRequest(request.id)}
                      >
                        <CheckCircle size={16} className="mr-1" />
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => handleRejectRequest(request.id)}
                      >
                        <AlertCircle size={16} className="mr-1" />
                        Reject
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </Card>

      {/* Bulk Extension Modal */}
      {showBulkExtension && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Extend Time for {selectedAttempts.length} Students
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Extension Minutes
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
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Reason
                </label>
                <Input
                  value={extensionReason}
                  onChange={(e) => setExtensionReason(e.target.value)}
                  placeholder="Reason for extension"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <Button
                onClick={handleBulkExtendTime}
                className="flex-1"
              >
                Extend Time
              </Button>
              <Button
                variant="secondary"
                onClick={() => setShowBulkExtension(false)}
                className="flex-1"
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
