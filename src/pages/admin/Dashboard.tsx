import { useState, useEffect } from 'react';
import { Eye, CheckCircle, XCircle, Clock, FileText, User, Users, BookOpen, TrendingUp, ChevronLeft, ChevronRight, AlertCircle, Settings, Shield } from 'lucide-react';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import { db, Quiz } from '../../lib/database';
import { useAuth } from '../../contexts/AuthContext';

interface QuizWithDetails extends Quiz {
  lecturer_name: string;
  lecturer_email: string;
  moderator_name?: string;
  moderator_email?: string;
  admin_name?: string;
  admin_email?: string;
}

export default function AdminDashboard() {
  const [approvedQuizzes, setApprovedQuizzes] = useState<QuizWithDetails[]>([]);
  const [publishedQuizzes, setPublishedQuizzes] = useState<QuizWithDetails[]>([]);
  const [selectedQuiz, setSelectedQuiz] = useState<QuizWithDetails | null>(null);
  const [quizQuestions, setQuizQuestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [questionsLoading, setQuestionsLoading] = useState(false);
  
  // Pagination states
  const [approvedPage, setApprovedPage] = useState(1);
  const [publishedPage, setPublishedPage] = useState(1);
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

  const approvedQuizzesPaginated = paginate(approvedQuizzes, approvedPage);
  const publishedQuizzesPaginated = paginate(publishedQuizzes, publishedPage);
  const approvedTotalPages = getTotalPages(approvedQuizzes);
  const publishedTotalPages = getTotalPages(publishedQuizzes);

  const loadData = async () => {
    try {
      console.log('Loading admin data...');
      
      // Debug: Check all quizzes first
      const allQuizzes = await db.getAllQuizzesDebug();
      console.log('All quizzes in database (admin view):', allQuizzes);
      
      const [approved, published] = await Promise.all([
        db.getApprovedQuizzes(),
        db.getPublishedQuizzes()
      ]);
      
      console.log('Approved quizzes for admin:', approved);
      console.log('Published quizzes for admin:', published);
      
      setApprovedQuizzes(approved as QuizWithDetails[]);
      setPublishedQuizzes(published as QuizWithDetails[]);
    } catch (error) {
      console.error('Error loading admin data:', error);
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

  const handlePublish = async () => {
    if (!selectedQuiz || !user) return;

    try {
      await db.publishQuiz(selectedQuiz.id, user.id);
      setSelectedQuiz(null);
      setQuizQuestions([]);
      loadData();
    } catch (error) {
      console.error('Error publishing quiz:', error);
      alert('Error publishing quiz. Please try again.');
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
      case 'published':
        return <Badge variant="primary">Published</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading admin dashboard...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
          <p className="text-gray-600 mt-1">Manage quiz publications and system overview</p>
        </div>
        <div className="flex items-center gap-2">
          <Shield className="text-blue-600" size={20} />
          <span className="text-gray-700 font-medium">Administrator: {user?.name}</span>
        </div>
      </div>

      {/* Enhanced Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Ready to Publish</p>
              <p className="text-2xl font-bold text-green-600">{approvedQuizzes.length}</p>
              <p className="text-xs text-gray-500 mt-1">Awaiting publication</p>
            </div>
            <CheckCircle size={24} className="text-green-600" />
          </div>
        </Card>
        
        <Card className="hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Published Quizzes</p>
              <p className="text-2xl font-bold text-blue-600">{publishedQuizzes.length}</p>
              <p className="text-xs text-gray-500 mt-1">Live for students</p>
            </div>
            <BookOpen size={24} className="text-blue-600" />
          </div>
        </Card>
        
        <Card className="hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Published Today</p>
              <p className="text-2xl font-bold text-purple-600">
                {publishedQuizzes.filter(q => 
                  new Date(q.published_at || '').toDateString() === new Date().toDateString()
                ).length}
              </p>
              <p className="text-xs text-gray-500 mt-1">Today's activity</p>
            </div>
            <TrendingUp size={24} className="text-purple-600" />
          </div>
        </Card>
        
        <Card className="hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">System Status</p>
              <p className="text-2xl font-bold text-orange-600">Active</p>
              <p className="text-xs text-gray-500 mt-1">All systems operational</p>
            </div>
            <Settings size={24} className="text-orange-600" />
          </div>
        </Card>
      </div>

      {/* Approved Quizzes (Ready to Publish) */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Approved Quizzes (Ready to Publish)</h2>
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
            <p className="text-gray-500">No quizzes ready to publish</p>
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
                      <p className="text-gray-600 mb-2 line-clamp-2">{quiz.description}</p>
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
                        Review
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

      {/* Published Quizzes */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Published Quizzes</h2>
          <div className="flex items-center gap-2">
            <BookOpen className="text-blue-500" size={20} />
            <span className="text-sm text-gray-600">
              {publishedQuizzes.length} {publishedQuizzes.length === 1 ? 'Quiz' : 'Quizzes'}
            </span>
          </div>
        </div>
        {publishedQuizzes.length === 0 ? (
          <div className="text-center py-8">
            <BookOpen className="text-gray-400 mx-auto mb-4" size={48} />
            <p className="text-gray-500">No quizzes published yet</p>
          </div>
        ) : (
          <>
            <div className="space-y-4">
              {publishedQuizzesPaginated.map((quiz) => (
                <div key={quiz.id} className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 transition-colors shadow-sm">
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
                        <div><strong>Published:</strong> {new Date(quiz.published_at || '').toLocaleDateString()}</div>
                        <div className="col-span-2"><strong>Lecturer:</strong> {quiz.lecturer_name}</div>
                        {quiz.moderator_name && (
                          <div className="col-span-2"><strong>Moderator:</strong> {quiz.moderator_name}</div>
                        )}
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
            
            {/* Pagination for Published Quizzes */}
            {publishedTotalPages > 1 && (
              <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-200">
                <div className="text-sm text-gray-600">
                  Showing {((publishedPage - 1) * itemsPerPage) + 1} to {Math.min(publishedPage * itemsPerPage, publishedQuizzes.length)} of {publishedQuizzes.length}
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={() => setPublishedPage(publishedPage - 1)}
                    variant="secondary"
                    size="sm"
                    disabled={publishedPage === 1}
                  >
                    <ChevronLeft size={16} />
                    Previous
                  </Button>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: publishedTotalPages }, (_, i) => i + 1).map((page) => (
                      <Button
                        key={page}
                        onClick={() => setPublishedPage(page)}
                        variant={page === publishedPage ? "primary" : "secondary"}
                        size="sm"
                        className="w-8 h-8 p-0"
                      >
                        {page}
                      </Button>
                    ))}
                  </div>
                  <Button
                    onClick={() => setPublishedPage(publishedPage + 1)}
                    variant="secondary"
                    size="sm"
                    disabled={publishedPage === publishedTotalPages}
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

      {/* Publish Modal */}
      {selectedQuiz && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">Publish Quiz: {selectedQuiz.title}</h2>
              <Button
                onClick={() => setSelectedQuiz(null)}
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
                  <div><strong>Reviewed:</strong> {new Date(selectedQuiz.reviewed_at || '').toLocaleString()}</div>
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
                  <p className="text-gray-500 text-center py-4">No questions found for this Quiz</p>
                )}
              </div>

              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h4 className="font-semibold text-green-800 mb-2">Ready to Publish</h4>
                <p className="text-green-700 text-sm">
                  This quiz has been approved by a moderator and is ready to be published. 
                  Once published, students will be able to take this quiz.
                </p>
              </div>

              <div className="flex gap-3 justify-end">
                <Button
                  onClick={() => setSelectedQuiz(null)}
                  variant="secondary"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handlePublish}
                  variant="success"
                >
                  <CheckCircle size={16} />
                  Publish Quiz
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
