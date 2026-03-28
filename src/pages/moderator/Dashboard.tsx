import { useState, useEffect } from 'react';
import { Eye, CheckCircle, XCircle, Clock, FileText, User, ChevronLeft, ChevronRight, AlertCircle, TrendingUp, Users, BookOpen } from 'lucide-react';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import { db, Quiz, QuizModeration } from '../../lib/database';
import { useAuth } from '../../contexts/AuthContext';

interface QuizWithDetails extends Quiz {
  lecturer_name: string;
  lecturer_email: string;
}

export default function ModeratorDashboard() {
  const [pendingQuizzes, setPendingQuizzes] = useState<QuizWithDetails[]>([]);
  const [approvedQuizzes, setApprovedQuizzes] = useState<QuizWithDetails[]>([]);
  const [selectedQuiz, setSelectedQuiz] = useState<QuizWithDetails | null>(null);
  const [quizQuestions, setQuizQuestions] = useState<any[]>([]);
  const [moderationNotes, setModerationNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [questionsLoading, setQuestionsLoading] = useState(false);
  
  // Pagination states
  const [pendingPage, setPendingPage] = useState(1);
  const [approvedPage, setApprovedPage] = useState(1);
  const [itemsPerPage] = useState(5);
  
  const { user } = useAuth();

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (selectedQuiz) {
      loadQuizQuestions(selectedQuiz.id);
    } else {
      setQuizQuestions([]);
    }
  }, [selectedQuiz]);

  // Pagination helpers
  const paginate = (items: any[], page: number) => {
    const startIndex = (page - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return items.slice(startIndex, endIndex);
  };

  const getTotalPages = (items: any[]) => Math.ceil(items.length / itemsPerPage);

  const pendingQuizzesPaginated = paginate(pendingQuizzes, pendingPage);
  const approvedQuizzesPaginated = paginate(approvedQuizzes, approvedPage);
  const pendingTotalPages = getTotalPages(pendingQuizzes);
  const approvedTotalPages = getTotalPages(approvedQuizzes);

  const loadData = async () => {
    try {
      console.log('Loading moderator data...');
      
      // Debug: Check all quizzes first (without fixing statuses for now)
      const allQuizzes = await db.getAllQuizzesDebug();
      console.log('All quizzes in database (moderator view):', allQuizzes);
      
      const [pending, approved] = await Promise.all([
        db.getPendingQuizzes(),
        db.getApprovedQuizzes()
      ]);
      
      console.log('Pending quizzes:', pending);
      console.log('Approved quizzes:', approved);
      
      setPendingQuizzes(pending as QuizWithDetails[]);
      setApprovedQuizzes(approved as QuizWithDetails[]);
    } catch (error) {
      console.error('Error loading moderator data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadQuizQuestions = async (quizId: string) => {
    setQuestionsLoading(true);
    try {
      const questions = await db.getQuestions(quizId);
      console.log('Loaded questions for quiz:', questions);
      setQuizQuestions(questions);
    } catch (error) {
      console.error('Error loading quiz questions:', error);
    } finally {
      setQuestionsLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!selectedQuiz || !user) return;

    try {
      await db.moderateQuiz(selectedQuiz.id, user.id, 'approved', moderationNotes);
      setSelectedQuiz(null);
      setQuizQuestions([]);
      setModerationNotes('');
      loadData();
    } catch (error) {
      console.error('Error approving quiz:', error);
      alert('Error approving quiz. Please try again.');
    }
  };

  const handleReject = async () => {
    if (!selectedQuiz || !user) return;

    try {
      await db.moderateQuiz(selectedQuiz.id, user.id, 'rejected', moderationNotes);
      setSelectedQuiz(null);
      setModerationNotes('');
      loadData();
    } catch (error) {
      console.error('Error rejecting quiz:', error);
      alert('Error rejecting quiz. Please try again.');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending_approval':
        return <Badge variant="warning">Pending Approval</Badge>;
      case 'approved':
        return <Badge variant="success">Approved</Badge>;
      case 'rejected':
        return <Badge variant="danger">Rejected</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading moderator dashboard...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Moderator Dashboard</h1>
        <div className="flex items-center gap-2">
          <User size={20} className="text-gray-600" />
          <span className="text-gray-700">Moderator: {user?.name}</span>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Pending Review</p>
              <p className="text-2xl font-bold text-orange-600">{pendingQuizzes.length}</p>
            </div>
            <Clock size={24} className="text-orange-600" />
          </div>
        </Card>
        
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Approved Today</p>
              <p className="text-2xl font-bold text-green-600">
                {approvedQuizzes.filter(q => 
                  new Date(q.reviewed_at || '').toDateString() === new Date().toDateString()
                ).length}
              </p>
            </div>
            <CheckCircle size={24} className="text-green-600" />
          </div>
        </Card>
        
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Approved</p>
              <p className="text-2xl font-bold text-blue-600">{approvedQuizzes.length}</p>
            </div>
            <FileText size={24} className="text-blue-600" />
          </div>
        </Card>
      </div>

      {/* Pending Quizzes */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Quizzes Pending Review</h2>
          <div className="flex items-center gap-2">
            <AlertCircle className="text-orange-500" size={20} />
            <span className="text-sm text-gray-600">
              {pendingQuizzes.length} {pendingQuizzes.length === 1 ? 'Quiz' : 'Quizzes'}
            </span>
          </div>
        </div>
        {pendingQuizzes.length === 0 ? (
          <div className="text-center py-8">
            <AlertCircle className="text-gray-400 mx-auto mb-4" size={48} />
            <p className="text-gray-500">No quizzes pending review</p>
          </div>
        ) : (
          <>
            <div className="space-y-4">
              {pendingQuizzesPaginated.map((quiz) => (
                <div key={quiz.id} className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 transition-colors shadow-sm">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-semibold text-gray-900">{quiz.title}</h3>
                        {getStatusBadge(quiz.status)}
                      </div>
                      <p className="text-gray-600 mb-2 line-clamp-2">{quiz.description}</p>
                      <div className="grid grid-cols-2 gap-2 text-sm text-gray-500">
                        <div><strong>Subject:</strong> {quiz.subject}</div>
                        <div><strong>Duration:</strong> {quiz.duration_minutes} min</div>
                        <div><strong>Total Marks:</strong> {quiz.total_marks}</div>
                        <div><strong>Created:</strong> {new Date(quiz.created_at).toLocaleDateString()}</div>
                        <div className="col-span-2"><strong>Lecturer:</strong> {quiz.lecturer_name}</div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={() => setSelectedQuiz(quiz)}
                        variant="secondary"
                        size="sm"
                        className="shadow-sm"
                      >
                        <Eye size={16} />
                        Review
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            {/* Pagination for Pending Quizzes */}
            {pendingTotalPages > 1 && (
              <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-200">
                <div className="text-sm text-gray-600">
                  Showing {((pendingPage - 1) * itemsPerPage) + 1} to {Math.min(pendingPage * itemsPerPage, pendingQuizzes.length)} of {pendingQuizzes.length}
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={() => setPendingPage(pendingPage - 1)}
                    variant="secondary"
                    size="sm"
                    disabled={pendingPage === 1}
                  >
                    <ChevronLeft size={16} />
                    Previous
                  </Button>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: pendingTotalPages }, (_, i) => i + 1).map((page) => (
                      <Button
                        key={page}
                        onClick={() => setPendingPage(page)}
                        variant={page === pendingPage ? "primary" : "secondary"}
                        size="sm"
                        className="w-8 h-8 p-0"
                      >
                        {page}
                      </Button>
                    ))}
                  </div>
                  <Button
                    onClick={() => setPendingPage(pendingPage + 1)}
                    variant="secondary"
                    size="sm"
                    disabled={pendingPage === pendingTotalPages}
                  >
                    Next
                    <ChevronRight size={16} />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </Card>

      {/* Recently Approved Quizzes */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Recently Approved</h2>
          <div className="flex items-center gap-2">
            <CheckCircle className="text-green-500" size={20} />
            <span className="text-sm text-gray-600">
              {approvedQuizzes.length} {approvedQuizzes.length === 1 ? 'Quiz' : 'Quizzes'}
            </span>
          </div>
        </div>
        {approvedQuizzes.length === 0 ? (
          <div className="text-center py-8">
            <CheckCircle className="text-gray-400 mx-auto mb-4" size={48} />
            <p className="text-gray-500">No quizzes approved yet</p>
          </div>
        ) : (
          <>
            <div className="space-y-4">
              {approvedQuizzesPaginated.map((quiz) => (
                <div key={quiz.id} className="border border-gray-200 rounded-lg p-4 hover:border-green-300 transition-colors shadow-sm">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-semibold text-gray-900">{quiz.title}</h3>
                        {getStatusBadge(quiz.status)}
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm text-gray-500">
                        <div><strong>Subject:</strong> {quiz.subject}</div>
                        <div><strong>Duration:</strong> {quiz.duration_minutes} min</div>
                        <div><strong>Total Marks:</strong> {quiz.total_marks}</div>
                        <div><strong>Reviewed:</strong> {new Date(quiz.reviewed_at || '').toLocaleDateString()}</div>
                        <div className="col-span-2"><strong>Lecturer:</strong> {quiz.lecturer_name}</div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={() => setSelectedQuiz(quiz)}
                        variant="secondary"
                        size="sm"
                        className="shadow-sm"
                      >
                        <Eye size={16} />
                        View
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            {/* Pagination for Approved Quizzes */}
            {approvedTotalPages > 1 && (
              <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-200">
                <div className="text-sm text-gray-600">
                  Showing {((approvedPage - 1) * itemsPerPage) + 1} to {Math.min(approvedPage * itemsPerPage, approvedQuizzes.length)} of {approvedQuizzes.length}
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={() => setApprovedPage(approvedPage - 1)}
                    variant="secondary"
                    size="sm"
                    disabled={approvedPage === 1}
                  >
                    <ChevronLeft size={16} />
                    Previous
                  </Button>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: approvedTotalPages }, (_, i) => i + 1).map((page) => (
                      <Button
                        key={page}
                        onClick={() => setApprovedPage(page)}
                        variant={page === approvedPage ? "primary" : "secondary"}
                        size="sm"
                        className="w-8 h-8 p-0"
                      >
                        {page}
                      </Button>
                    ))}
                  </div>
                  <Button
                    onClick={() => setApprovedPage(approvedPage + 1)}
                    variant="secondary"
                    size="sm"
                    disabled={approvedPage === approvedTotalPages}
                  >
                    Next
                    <ChevronRight size={16} />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </Card>

      {/* Review Modal */}
      {selectedQuiz && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">Review Quiz: {selectedQuiz.title}</h2>
              <Button
                onClick={() => {
                  setSelectedQuiz(null);
                  setModerationNotes('');
                }}
                variant="secondary"
                size="sm"
              >
                ×
              </Button>
            </div>

            <div className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">Quiz Details</h3>
                <div className="text-sm text-gray-600 space-y-1">
                  <div><strong>Subject:</strong> {selectedQuiz.subject}</div>
                  <div><strong>Duration:</strong> {selectedQuiz.duration_minutes} minutes</div>
                  <div><strong>Total Marks:</strong> {selectedQuiz.total_marks}</div>
                  <div><strong>Deadline:</strong> {selectedQuiz.deadline ? new Date(selectedQuiz.deadline).toLocaleString() : 'No deadline'}</div>
                  <div><strong>Lecturer:</strong> {selectedQuiz.lecturer_name} ({selectedQuiz.lecturer_email})</div>
                  <div><strong>Created:</strong> {new Date(selectedQuiz.created_at).toLocaleString()}</div>
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Description</h3>
                <p className="text-gray-600">{selectedQuiz.description}</p>
              </div>

              <div>
                <h3 className="font-semibold mb-2">
                  Questions ({questionsLoading ? 'Loading...' : quizQuestions.length})
                </h3>
                {questionsLoading ? (
                  <div className="flex items-center justify-center py-4">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  </div>
                ) : quizQuestions.length > 0 ? (
                  <div className="space-y-3 max-h-60 overflow-y-auto">
                    {quizQuestions.map((question, index) => (
                      <div key={question.id} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex items-start gap-2 mb-2">
                          <span className="font-medium text-gray-900">Q{index + 1}.</span>
                          <span className="text-gray-700 flex-1">{question.question_text}</span>
                          <span className="text-sm text-gray-500">({question.marks} marks)</span>
                        </div>
                        
                        {question.question_type === 'mcq' && (
                          <div className="ml-6 space-y-2">
                            <div className="text-sm font-medium text-gray-700">Options:</div>
                            {(() => {
                              try {
                                const options = question.options ? JSON.parse(question.options) : [];
                                return options.map((option: string, optIndex: number) => (
                                  <div key={optIndex} className="flex items-center gap-2">
                                    <span className={`w-4 h-4 rounded-full border-2 ${
                                      option === question.correct_answer 
                                        ? 'bg-green-500 border-green-500' 
                                        : 'bg-gray-200 border-gray-300'
                                    }`}></span>
                                    <span className="text-sm">{option}</span>
                                    {option === question.correct_answer && (
                                      <span className="text-xs text-green-600 font-medium">(Correct)</span>
                                    )}
                                  </div>
                                ));
                              } catch (error) {
                                return (
                                  <div className="text-sm text-red-600">
                                    Error parsing options: Invalid JSON data
                                  </div>
                                );
                              }
                            })()}
                          </div>
                        )}
                        
                        <div className="mt-3 pt-3 border-t border-gray-200">
                          <div className="text-sm font-medium text-gray-700">Correct Answer:</div>
                          <div className="text-sm text-green-600 font-medium">{question.correct_answer}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-center py-4">No questions found for this quiz</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Moderation Notes
                </label>
                <textarea
                  value={moderationNotes}
                  onChange={(e) => setModerationNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={4}
                  placeholder="Add your moderation notes here..."
                />
              </div>

              <div className="flex gap-3 justify-end">
                <Button
                  onClick={handleReject}
                  variant="danger"
                  disabled={!selectedQuiz}
                >
                  <XCircle size={16} />
                  Reject
                </Button>
                <Button
                  onClick={handleApprove}
                  variant="success"
                  disabled={!selectedQuiz}
                >
                  <CheckCircle size={16} />
                  Approve
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
