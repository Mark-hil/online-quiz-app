import { useState, useEffect } from 'react';
import { Eye, CheckCircle, XCircle, Clock, AlertCircle, ChevronLeft, ChevronRight, User } from 'lucide-react';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import { db, Quiz } from '../../lib/database';
import { useAuth } from '../../contexts/AuthContext';

interface QuizWithDetails extends Quiz {
  lecturer_name: string;
  lecturer_email: string;
}

export default function PendingQuizzes() {
  const [pendingQuizzes, setPendingQuizzes] = useState<QuizWithDetails[]>([]);
  const [selectedQuiz, setSelectedQuiz] = useState<QuizWithDetails | null>(null);
  const [quizQuestions, setQuizQuestions] = useState<any[]>([]);
  const [moderationNotes, setModerationNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [questionsLoading, setQuestionsLoading] = useState(false);
  
  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  
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

  const pendingQuizzesPaginated = paginate(pendingQuizzes, currentPage);
  const totalPages = getTotalPages(pendingQuizzes);

  const loadData = async () => {
    try {
      console.log('Loading pending quizzes...');
      const pending = await db.getPendingQuizzes();
      console.log('Pending quizzes:', pending);
      setPendingQuizzes(pending);
    } catch (error) {
      console.error('Error loading pending quizzes:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadQuizQuestions = async (quizId: string) => {
    setQuestionsLoading(true);
    try {
      console.log('Loading questions for quiz:', quizId);
      const questions = await db.getQuestions(quizId);
      console.log('Quiz questions:', questions);
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
        <div className="text-lg">Loading pending quizzes...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Quizzes Pending Review</h1>
          <p className="text-gray-600 mt-1">Review and moderate quizzes submitted by lecturers</p>
        </div>
        <div className="flex items-center gap-2">
          <AlertCircle className="text-orange-500" size={20} />
          <span className="text-gray-700 font-medium">
            {pendingQuizzes.length} {pendingQuizzes.length === 1 ? 'Quiz' : 'Quizzes'}
          </span>
        </div>
      </div>

      {/* Pending Quizzes List */}
      <Card>
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
            
            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-200">
                <div className="text-sm text-gray-600">
                  Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, pendingQuizzes.length)} of {pendingQuizzes.length}
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={() => setCurrentPage(currentPage - 1)}
                    variant="secondary"
                    size="sm"
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft size={16} />
                    Previous
                  </Button>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                      <Button
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        variant={page === currentPage ? "primary" : "secondary"}
                        size="sm"
                        className="w-8 h-8 p-0"
                      >
                        {page}
                      </Button>
                    ))}
                  </div>
                  <Button
                    onClick={() => setCurrentPage(currentPage + 1)}
                    variant="secondary"
                    size="sm"
                    disabled={currentPage === totalPages}
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
                onClick={() => setSelectedQuiz(null)}
                variant="secondary"
                size="sm"
              >
                ×
              </Button>
            </div>

            {/* Quiz Details */}
            <div className="mb-6">
              <h3 className="font-semibold text-gray-900 mb-2">Quiz Information</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium">Subject:</span> {selectedQuiz.subject}
                </div>
                <div>
                  <span className="font-medium">Duration:</span> {selectedQuiz.duration_minutes} minutes
                </div>
                <div>
                  <span className="font-medium">Total Marks:</span> {selectedQuiz.total_marks}
                </div>
                <div>
                  <span className="font-medium">Lecturer:</span> {selectedQuiz.lecturer_name} ({selectedQuiz.lecturer_email})
                </div>
                <div className="col-span-2">
                  <span className="font-medium">Description:</span> {selectedQuiz.description}
                </div>
              </div>
            </div>

            {/* Questions */}
            <div className="mb-6">
              <h3 className="font-semibold text-gray-900 mb-2">Questions</h3>
              {questionsLoading ? (
                <div className="text-center py-4">
                  <div className="text-gray-500">Loading questions...</div>
                </div>
              ) : (
                <div className="space-y-4">
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
              )}
            </div>

            {/* Moderation Notes */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Moderation Notes (Required for rejection)
              </label>
              <textarea
                value={moderationNotes}
                onChange={(e) => setModerationNotes(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                rows={4}
                placeholder="Add your notes about this quiz..."
              />
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <Button
                onClick={handleApprove}
                variant="primary"
                className="flex-1"
              >
                <CheckCircle size={16} className="mr-2" />
                Approve Quiz
              </Button>
              <Button
                onClick={handleReject}
                variant="danger"
                className="flex-1"
              >
                <XCircle size={16} className="mr-2" />
                Reject Quiz
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
