import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Plus, BookOpen, Users, CheckCircle, Edit2, AlertCircle, TrendingUp, Clock, Award, Target, BarChart3, Calendar, FileText, Eye, ChevronLeft, ChevronRight } from 'lucide-react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import { db } from '../../lib/database';
import { useAuth } from '../../contexts/AuthContext';

interface Stats {
  totalQuizzes: number;
  totalStudents: number;
  activeQuizzes: number;
  averageScore: number;
  totalAttempts: number;
  activeStudents: number;
}

interface Quiz {
  id: string;
  status: string;
  title: string;
  description?: string;
  subject?: string;
  created_at: string;
}

export default function Dashboard() {
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const id = queryParams.get('id');
  console.log('URL ID parameter:', id);
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isEditMode, setIsEditMode] = useState(false);
  
  // Pagination states
  const [publishedCurrentPage, setPublishedCurrentPage] = useState(1);
  const [rejectedCurrentPage, setRejectedCurrentPage] = useState(1);
  const itemsPerPage = 5; // Items per page for both sections
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [rejectedQuizzes, setRejectedQuizzes] = useState<Quiz[]>([]);
  const [selectedRejectedQuiz, setSelectedRejectedQuiz] = useState<Quiz | null>(null);
  const [rejectionReasons, setRejectionReasons] = useState<{[key: string]: string}>({});
  const [showRejectionModal, setShowRejectionModal] = useState(false);
  const [stats, setStats] = useState<Stats>({
    totalQuizzes: 0,
    totalStudents: 0,
    activeQuizzes: 0,
    averageScore: 0,
    totalAttempts: 0,
    activeStudents: 0,
  });

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    if (!user) return;

    const quizzes = await db.getQuizzes(user.id);
    console.log('All quizzes loaded:', quizzes);
    setQuizzes(quizzes);
    
    // Separate published and rejected quizzes
    const publishedQuizzes = quizzes.filter(q => q.status === 'published');
    const rejectedQuizzesList = quizzes.filter(q => q.status === 'rejected');
    console.log('Published quizzes:', publishedQuizzes);
    console.log('Rejected quizzes:', rejectedQuizzesList);
    setRejectedQuizzes(rejectedQuizzesList);
    
    // Get rejection reasons for rejected quizzes
    const reasons: {[key: string]: string} = {};
    for (const quiz of rejectedQuizzesList) {
      try {
        const moderations = await db.getQuizModerations(quiz.id);
        if (moderations.length > 0) {
          const latestModeration = moderations[0]; // Get the most recent moderation
          if (latestModeration.status === 'rejected' && latestModeration.notes) {
            reasons[quiz.id] = latestModeration.notes;
          }
        }
      } catch (error) {
        console.error('Error loading moderation for quiz:', quiz.id, error);
        reasons[quiz.id] = 'Error loading rejection reason';
      }
    }
    setRejectionReasons(reasons);
    
    // Get all attempts for this lecturer's quizzes (only published ones for stats)
    const allAttempts = [];
    for (const quiz of publishedQuizzes) {
      const attempts = await db.getQuizAttempts(quiz.id);
      allAttempts.push(...attempts);
    }

    // Get all students (profiles with role 'student')
    const allProfiles = await db.getProfiles();
    const totalStudents = allProfiles.filter(profile => profile.role === 'student').length;

    // Get unique students who attempted this lecturer's quizzes
    const uniqueStudentIds = new Set(allAttempts.map(a => a.student_id));
    const activeStudents = uniqueStudentIds.size;

    const activeQuizzes = publishedQuizzes.length;

    // Calculate average score from attempts with scores
    const scoredAttempts = allAttempts
      .map(a => typeof a.score === 'string' ? parseFloat(a.score) : a.score)
      .filter(score => !isNaN(score) && score !== null && score !== undefined);

    const avgScore = scoredAttempts.length > 0
      ? scoredAttempts.reduce((sum: number, score: number) => sum + score, 0) / scoredAttempts.length
      : 0;

    setStats({
      totalQuizzes: quizzes.length,
      totalStudents,
      activeQuizzes,
      averageScore: avgScore,
      totalAttempts: allAttempts.length,
      activeStudents,
    });

    console.log('Dashboard stats loaded:', {
      totalQuizzes: quizzes.length,
      totalStudents,
      activeQuizzes,
      averageScore: avgScore,
      totalAttempts: allAttempts.length,
      activeStudents
    });
  };

  // Pagination helper functions
  const getPaginatedItems = <T,>(items: T[], currentPage: number, perPage: number) => {
    const startIndex = (currentPage - 1) * perPage;
    const endIndex = startIndex + perPage;
    return items.slice(startIndex, endIndex);
  };

  const getTotalPages = (items: any[], perPage: number) => {
    return Math.ceil(items.length / perPage);
  };

  const renderPagination = (currentPage: number, setCurrentPage: (page: number) => void, totalItems: number, section: string) => {
    const totalPages = getTotalPages(totalItems, itemsPerPage);
    
    if (totalPages <= 1) return null;

    return (
      <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200">
        <div className="text-sm text-gray-600">
          Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, totalItems)} of {totalItems} {section}
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setCurrentPage(currentPage - 1)}
            disabled={currentPage === 1}
            className="flex items-center"
          >
            <ChevronLeft size={16} />
            Previous
          </Button>
          
          <div className="flex items-center space-x-1">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
              <button
                key={page}
                onClick={() => setCurrentPage(page)}
                className={`w-8 h-8 rounded-md flex items-center justify-center text-sm font-medium transition-colors ${
                  currentPage === page
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {page}
              </button>
            ))}
          </div>
          
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setCurrentPage(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="flex items-center"
          >
            Next
            <ChevronRight size={16} />
          </Button>
        </div>
      </div>
    );
  };

  // Get paginated data
  const publishedQuizzes = quizzes.filter(q => q.status === 'published');
  const paginatedPublishedQuizzes = getPaginatedItems(publishedQuizzes, publishedCurrentPage, itemsPerPage);
  const paginatedRejectedQuizzes = getPaginatedItems(rejectedQuizzes, rejectedCurrentPage, itemsPerPage);
  const handleViewRejectionDetails = (quiz: Quiz) => {
    console.log('Viewing rejection details for quiz:', quiz);
    console.log('Current rejection reasons:', rejectionReasons);
    console.log('Rejection reason for this quiz:', rejectionReasons[quiz.id]);
    setSelectedRejectedQuiz(quiz);
    setShowRejectionModal(true);
  };

  const handleCloseRejectionModal = () => {
    setSelectedRejectedQuiz(null);
    setShowRejectionModal(false);
  };

  const handleEditAndResubmit = async (quiz: Quiz) => {
    if (!user) return;
    
    try {
      // Navigate to create quiz page with the rejected quiz ID
      navigate(`/lecturer/create-quiz?id=${quiz.id}`);
    } catch (error) {
      console.error('Error navigating to edit quiz:', error);
      alert('Error opening quiz for editing. Please try again.');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Header Section */}
      <div className="bg-white shadow-sm border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl shadow-lg">
                <BarChart3 className="text-white" size={28} />
              </div>
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  Dashboard
                </h1>
                <p className="text-gray-600 mt-1">Welcome back, {user?.name || 'Lecturer'}!</p>
              </div>
            </div>
            <Button 
              onClick={() => navigate('/lecturer/create-quiz')}
              className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white shadow-lg transform transition-all duration-200 hover:scale-105"
            >
              <Plus size={20} className="mr-2" />
              Create Quiz
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Total Quizzes Card */}
          <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white border-0 shadow-xl transform transition-all duration-300 hover:scale-105 hover:shadow-2xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-100 text-sm font-medium">Total Quizzes</p>
                <p className="text-4xl font-bold mt-2">{stats.totalQuizzes}</p>
                <div className="flex items-center mt-2 text-blue-100 text-sm">
                  <TrendingUp size={16} className="mr-1" />
                  <span>All time</span>
                </div>
              </div>
              <div className="p-4 bg-white/20 rounded-xl backdrop-blur-sm">
                <BookOpen className="text-white" size={32} />
              </div>
            </div>
          </Card>

          {/* Total Students Card */}
          <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white border-0 shadow-xl transform transition-all duration-300 hover:scale-105 hover:shadow-2xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-green-100 text-sm font-medium">Total Students</p>
                <p className="text-4xl font-bold mt-2">{stats.totalStudents}</p>
                <div className="flex items-center mt-2 text-green-100 text-sm">
                  <Users size={16} className="mr-1" />
                  <span>Active learners</span>
                </div>
              </div>
              <div className="p-4 bg-white/20 rounded-xl backdrop-blur-sm">
                <Users className="text-white" size={32} />
              </div>
            </div>
          </Card>

          {/* Active Quizzes Card */}
          <Card className="bg-gradient-to-br from-yellow-500 to-orange-500 text-white border-0 shadow-xl transform transition-all duration-300 hover:scale-105 hover:shadow-2xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-yellow-100 text-sm font-medium">Active Quizzes</p>
                <p className="text-4xl font-bold mt-2">{stats.activeQuizzes}</p>
                <div className="flex items-center mt-2 text-yellow-100 text-sm">
                  <Clock size={16} className="mr-1" />
                  <span>Currently running</span>
                </div>
              </div>
              <div className="p-4 bg-white/20 rounded-xl backdrop-blur-sm">
                <Target className="text-white" size={32} />
              </div>
            </div>
          </Card>

          {/* Average Score Card */}
          <Card className="bg-gradient-to-br from-purple-500 to-pink-500 text-white border-0 shadow-xl transform transition-all duration-300 hover:scale-105 hover:shadow-2xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-purple-100 text-sm font-medium">Average Score</p>
                <p className="text-4xl font-bold mt-2">{stats.averageScore.toFixed(1)}%</p>
                <div className="flex items-center mt-2 text-purple-100 text-sm">
                  <Award size={16} className="mr-1" />
                  <span>Performance</span>
                </div>
              </div>
              <div className="p-4 bg-white/20 rounded-xl backdrop-blur-sm">
                <BarChart3 className="text-white" size={32} />
              </div>
            </div>
          </Card>
        </div>

      {/* Quiz Sections Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Published Quizzes Section */}
          <Card className="bg-white shadow-xl border-0 overflow-hidden">
            <div className="bg-gradient-to-r from-green-500 to-green-600 px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                    <CheckCircle className="text-white" size={24} />
                  </div>
                  <h2 className="text-xl font-bold text-white">Published Quizzes</h2>
                </div>
                <div className="bg-white/20 px-3 py-1 rounded-full backdrop-blur-sm">
                  <span className="text-white font-semibold">{quizzes.filter(q => q.status === 'published').length}</span>
                </div>
              </div>
            </div>
            <div className="p-6">
              {publishedQuizzes.length === 0 ? (
                <div className="text-center py-8">
                  <div className="p-4 bg-gray-100 rounded-full inline-flex mb-4">
                    <CheckCircle className="text-gray-400" size={32} />
                  </div>
                  <p className="text-gray-500">No published quizzes yet</p>
                  <p className="text-gray-400 text-sm mt-2">Create and submit quizzes for review</p>
                </div>
              ) : (
                <>
                  <div className="space-y-4">
                    {paginatedPublishedQuizzes.map((quiz, index) => (
                      <div key={index} className="bg-gradient-to-r from-gray-50 to-white border border-gray-200 rounded-xl p-4 hover:shadow-lg transition-all duration-300 hover:scale-[1.02]">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="flex items-center space-x-2 mb-2">
                              <h3 className="font-bold text-gray-900 text-lg">{quiz.title}</h3>
                              <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-semibold rounded-full">Published</span>
                            </div>
                            <p className="text-gray-600 mb-2">{quiz.subject}</p>
                            <div className="flex items-center space-x-4 text-sm text-gray-500">
                              <div className="flex items-center">
                                <Calendar size={14} className="mr-1" />
                                <span>{new Date(quiz.created_at).toLocaleDateString()}</span>
                              </div>
                              <div className="flex items-center">
                                <Eye size={14} className="mr-1" />
                                <span>Active</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => navigate(`/lecturer/create-quiz?id=${quiz.id}`)}
                              className="bg-gray-100 hover:bg-gray-200 text-gray-700 border-0"
                            >
                              <Edit2 size={16} />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  {renderPagination(publishedCurrentPage, setPublishedCurrentPage, publishedQuizzes.length, 'published quizzes')}
                </>
              )}
            </div>
          </Card>

          {/* Rejected Quizzes Section */}
          <Card className="bg-white shadow-xl border-0 overflow-hidden">
            <div className="bg-gradient-to-r from-red-500 to-red-600 px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                    <AlertCircle className="text-white" size={24} />
                  </div>
                  <h2 className="text-xl font-bold text-white">Rejected Quizzes</h2>
                </div>
                <div className="bg-white/20 px-3 py-1 rounded-full backdrop-blur-sm">
                  <span className="text-white font-semibold">{rejectedQuizzes.length}</span>
                </div>
              </div>
            </div>
            <div className="p-6">
              {rejectedQuizzes.length === 0 ? (
                <div className="text-center py-8">
                  <div className="p-4 bg-gray-100 rounded-full inline-flex mb-4">
                    <AlertCircle className="text-gray-400" size={32} />
                  </div>
                  <p className="text-gray-500">No rejected quizzes</p>
                  <p className="text-gray-400 text-sm mt-2">All your quizzes are in good standing</p>
                </div>
              ) : (
                <>
                  <div className="space-y-4">
                    {paginatedRejectedQuizzes.map((quiz, index) => (
                      <div key={index} className="bg-gradient-to-r from-red-50 to-white border border-red-200 rounded-xl p-4 hover:shadow-lg transition-all duration-300 hover:scale-[1.02]">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="flex items-center space-x-2 mb-2">
                              <h3 className="font-bold text-red-900 text-lg">{quiz.title}</h3>
                              <span className="px-2 py-1 bg-red-100 text-red-800 text-xs font-semibold rounded-full">Rejected</span>
                            </div>
                            <p className="text-gray-600 mb-2">{quiz.subject}</p>
                            <div className="flex items-center space-x-4 text-sm text-gray-500 mb-3">
                              <div className="flex items-center">
                                <Calendar size={14} className="mr-1" />
                                <span>{new Date(quiz.created_at).toLocaleDateString()}</span>
                              </div>
                            </div>
                            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                              <p className="text-sm font-medium text-red-800 mb-1">Rejection Reason:</p>
                              <p className="text-sm text-red-600">
                                {rejectionReasons[quiz.id] || 'Loading rejection reason...'}
                              </p>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => handleViewRejectionDetails(quiz)}
                              className="bg-red-100 hover:bg-red-200 text-red-700 border-0"
                            >
                              <AlertCircle size={16} />
                            </Button>
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => handleEditAndResubmit(quiz)}
                              className="bg-orange-100 hover:bg-orange-200 text-orange-700 border-0"
                            >
                              <Edit2 size={16} />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  {renderPagination(rejectedCurrentPage, setRejectedCurrentPage, rejectedQuizzes.length, 'rejected quizzes')}
                </>
              )}
            </div>
          </Card>
        </div>

        {/* Rejection Details Modal */}
        {showRejectionModal && selectedRejectedQuiz && (
          <Modal
            isOpen={showRejectionModal}
            onClose={handleCloseRejectionModal}
            title="Rejection Details"
            size="lg"
          >
            <div className="space-y-4">
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <h3 className="font-semibold text-red-800 mb-2">Quiz Rejected</h3>
                <div className="space-y-2">
                  <div>
                    <p className="text-sm font-medium text-red-800">Quiz Title:</p>
                    <p className="text-lg font-bold text-red-900">{selectedRejectedQuiz.title}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-red-800">Subject:</p>
                    <p className="text-lg text-red-900">{selectedRejectedQuiz.subject}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-red-800">Created Date:</p>
                    <p className="text-lg text-red-900">{new Date(selectedRejectedQuiz.created_at).toLocaleDateString()}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-red-800">Rejection Reason:</p>
                    <div className="bg-white p-3 rounded border border-red-200">
                      <p className="text-red-700 whitespace-pre-wrap">
                        {rejectionReasons[selectedRejectedQuiz.id] || 'No rejection reason provided'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="flex justify-end gap-3 mt-6">
                <Button
                  variant="secondary"
                  onClick={handleCloseRejectionModal}
                >
                  Close
                </Button>
                <Button
                  variant="primary"
                  onClick={() => handleEditAndResubmit(selectedRejectedQuiz)}
                  className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700"
                >
                  <Edit2 size={16} />
                  Edit & Resubmit
                </Button>
              </div>
            </div>
          </Modal>
        )}
      </div>
    </div>
  );
}
                                                                
                                                                  
                          
