import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, BookOpen, Award, Search, AlertCircle, CheckCircle, Calendar, TrendingUp, ChevronLeft, ChevronRight } from 'lucide-react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { db, Quiz } from '../../lib/database';
import { useAuth } from '../../contexts/AuthContext';

export default function AvailableQuizzes() {
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [filteredQuizzes, setFilteredQuizzes] = useState<Quiz[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [attemptedQuizzes, setAttemptedQuizzes] = useState<Set<string>>(new Set());
  const { user } = useAuth;
  const navigate = useNavigate();

  // Pagination states
  const [recentPage, setRecentPage] = useState(1);
  const [mainPage, setMainPage] = useState(1);
  const [itemsPerPage] = useState(6);

  useEffect(() => {
    loadQuizzes();
  }, []);

  useEffect(() => {
    if (searchTerm) {
      const filtered = quizzes.filter(
        q =>
          q.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
          q.subject.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredQuizzes(filtered);
      // Reset pagination when searching
      setMainPage(1);
    } else {
      setFilteredQuizzes(quizzes);
    }
  }, [searchTerm, quizzes]);

  // Pagination helpers
  const paginate = (items: any[], page: number) => {
    const startIndex = (page - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return items.slice(startIndex, endIndex);
  };

  const getTotalPages = (items: any[]) => Math.ceil(items.length / itemsPerPage);

  const loadQuizzes = async () => {
    const data = await db.getQuizzes(); // Gets published quizzes
    setQuizzes(data as Quiz[]);
    setFilteredQuizzes(data as Quiz[]);
    
    // Check which quizzes have been attempted
    if (user) {
      const attempted = new Set<string>();
      for (const quiz of data) {
        const attempts = await db.getQuizAttempts(quiz.id, user.id);
        const submittedAttempt = attempts.find(a => a.status === 'submitted' || a.status === 'graded');
        if (submittedAttempt) {
          attempted.add(quiz.id);
        }
      }
      setAttemptedQuizzes(attempted);
    }
  };

  // Get recently published quizzes (last 7 days)
  const recentlyPublished = filteredQuizzes
    .filter(quiz => {
      const publishedDate = new Date(quiz.published_at || quiz.created_at);
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      return publishedDate > sevenDaysAgo;
    });

  const recentlyPublishedPaginated = paginate(recentlyPublished, recentPage);
  const recentTotalPages = getTotalPages(recentlyPublished);

  const otherQuizzes = filteredQuizzes.filter(quiz => !recentlyPublished.includes(quiz));
  const otherQuizzesPaginated = paginate(otherQuizzes, mainPage);
  const mainTotalPages = getTotalPages(otherQuizzes);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Available Quizzes</h1>

      {/* Recently Published Section */}
      {recentlyPublished.length > 0 && !searchTerm && (
        <Card className="mb-6 border-2 border-green-200 bg-green-50">
          <div className="flex items-center gap-3 mb-4">
            <TrendingUp className="text-green-600" size={24} />
            <div>
              <h2 className="text-lg font-semibold text-green-800">Recently Published</h2>
              <p className="text-sm text-green-600">New quizzes available this week ({recentlyPublished.length} total)</p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {recentlyPublishedPaginated.map((quiz) => {
              const isAttempted = attemptedQuizzes.has(quiz.id);
              const isDeadlinePassed = quiz.deadline && new Date(quiz.deadline) < new Date();
              
              return (
                <div key={quiz.id} className="relative">
                  <Card className={`h-full transition-all duration-200 ${
                    isAttempted 
                      ? 'border-green-400 bg-green-50' 
                      : isDeadlinePassed 
                      ? 'border-red-400 bg-red-50' 
                      : 'border-gray-200 hover:border-green-300 hover:shadow-lg'
                  }`}>
                    <div className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-900 mb-1 line-clamp-2">{quiz.title}</h3>
                          <p className="text-sm text-gray-600 mb-2 line-clamp-2">{quiz.description}</p>
                        </div>
                        {quiz.published_at && (
                          <div className="text-xs text-green-600 bg-green-100 px-2 py-1 rounded-full">
                            New
                          </div>
                        )}
                      </div>
                      
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center gap-2">
                          <Calendar className="text-gray-400" size={14} />
                          <span className="text-gray-600">
                            {quiz.published_at 
                              ? `Published: ${new Date(quiz.published_at).toLocaleDateString()}`
                              : `Created: ${new Date(quiz.created_at).toLocaleDateString()}`
                            }
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <Clock className="text-gray-400" size={14} />
                          <span className="text-gray-600">
                            {quiz.duration_minutes} minutes
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <Award className="text-gray-400" size={14} />
                          <span className="text-gray-600">
                            {quiz.total_marks} marks
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <BookOpen className="text-gray-400" size={14} />
                          <span className="text-gray-600">
                            {quiz.subject}
                          </span>
                        </div>
                        
                        {quiz.deadline && (
                          <div className="flex items-center gap-2">
                            <AlertCircle className={`${
                              isDeadlinePassed ? 'text-red-500' : 'text-orange-500'
                            }`} size={14} />
                            <span className={`${
                              isDeadlinePassed ? 'text-red-600' : 'text-orange-600'
                            }`}>
                              Deadline: {new Date(quiz.deadline).toLocaleDateString()}
                            </span>
                          </div>
                        )}
                        
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <span>By: {quiz.lecturer_name}</span>
                          {quiz.moderator_name && <span>• Reviewed by: {quiz.moderator_name}</span>}
                          {quiz.admin_name && <span>• Published by: {quiz.admin_name}</span>}
                        </div>
                      </div>
                      
                      <div className="mt-4 pt-3 border-t border-gray-200">
                        <Button
                          onClick={() => navigate(`/student/quiz/${quiz.id}`)}
                          disabled={isDeadlinePassed}
                          className={`w-full flex items-center justify-center gap-2 ${
                            isAttempted 
                              ? 'bg-green-600 hover:bg-green-700' 
                              : isDeadlinePassed 
                              ? 'bg-gray-400 cursor-not-allowed' 
                              : 'bg-blue-600 hover:bg-blue-700'
                          }`}
                        >
                          {isAttempted ? (
                            <>
                              <CheckCircle size={16} />
                              <span>View Attempt</span>
                            </>
                          ) : isDeadlinePassed ? (
                            <>
                              <AlertCircle size={16} />
                              <span>Deadline Passed</span>
                            </>
                          ) : (
                            <>
                              <BookOpen size={16} />
                              <span>Start Quiz</span>
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </Card>
                </div>
              );
            })}
          </div>
          
          {/* Pagination for Recently Published */}
          {recentTotalPages > 1 && (
            <div className="flex items-center justify-between mt-6 pt-4 border-t border-green-200">
              <div className="text-sm text-green-600">
                Showing {((recentPage - 1) * itemsPerPage) + 1} to {Math.min(recentPage * itemsPerPage, recentlyPublished.length)} of {recentlyPublished.length}
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={() => setRecentPage(recentPage - 1)}
                  variant="secondary"
                  size="sm"
                  disabled={recentPage === 1}
                  className="border-green-300 text-green-700 hover:bg-green-100"
                >
                  <ChevronLeft size={16} />
                  Previous
                </Button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: recentTotalPages }, (_, i) => i + 1).map((page) => (
                    <Button
                      key={page}
                      onClick={() => setRecentPage(page)}
                      variant={page === recentPage ? "primary" : "secondary"}
                      size="sm"
                      className={`w-8 h-8 p-0 ${
                        page === recentPage 
                          ? 'bg-green-600 hover:bg-green-700' 
                          : 'border-green-300 text-green-700 hover:bg-green-100'
                      }`}
                    >
                      {page}
                    </Button>
                  ))}
                </div>
                <Button
                  onClick={() => setRecentPage(recentPage + 1)}
                  variant="secondary"
                  size="sm"
                  disabled={recentPage === recentTotalPages}
                  className="border-green-300 text-green-700 hover:bg-green-100"
                >
                  Next
                  <ChevronRight size={16} />
                </Button>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
        <input
          type="text"
          placeholder="Search quizzes..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* All Other Quizzes */}
      {filteredQuizzes.length === 0 ? (
        <Card>
          <div className="text-center py-12">
            <BookOpen className="mx-auto text-gray-400 mb-4" size={48} />
            <p className="text-gray-500">No quizzes available</p>
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          {searchTerm && (
            <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-blue-800">
                Found {filteredQuizzes.length} quiz{filteredQuizzes.length === 1 ? '' : 'zes'} matching "{searchTerm}"
              </p>
            </div>
          )}
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {otherQuizzesPaginated.map((quiz) => {
              const isAttempted = attemptedQuizzes.has(quiz.id);
              const isDeadlinePassed = quiz.deadline && new Date(quiz.deadline) < new Date();
              
              return (
                <div key={quiz.id} className="relative">
                  <Card className={`h-full transition-all duration-200 ${
                    isAttempted 
                      ? 'border-green-400 bg-green-50' 
                      : isDeadlinePassed 
                      ? 'border-red-400 bg-red-50' 
                      : 'border-gray-200 hover:border-blue-300 hover:shadow-lg'
                  }`}>
                    <div className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-900 mb-1 line-clamp-2">{quiz.title}</h3>
                          <p className="text-sm text-gray-600 mb-2 line-clamp-2">{quiz.description}</p>
                        </div>
                      </div>
                      
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center gap-2">
                          <Calendar className="text-gray-400" size={14} />
                          <span className="text-gray-600">
                            {quiz.published_at 
                              ? `Published: ${new Date(quiz.published_at).toLocaleDateString()}`
                              : `Created: ${new Date(quiz.created_at).toLocaleDateString()}`
                            }
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <Clock className="text-gray-400" size={14} />
                          <span className="text-gray-600">
                            {quiz.duration_minutes} minutes
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <Award className="text-gray-400" size={14} />
                          <span className="text-gray-600">
                            {quiz.total_marks} marks
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <BookOpen className="text-gray-400" size={14} />
                          <span className="text-gray-600">
                            {quiz.subject}
                          </span>
                        </div>
                        
                        {quiz.deadline && (
                          <div className="flex items-center gap-2">
                            <AlertCircle className={`${
                              isDeadlinePassed ? 'text-red-500' : 'text-orange-500'
                            }`} size={14} />
                            <span className={`${
                              isDeadlinePassed ? 'text-red-600' : 'text-orange-600'
                            }`}>
                              Deadline: {new Date(quiz.deadline).toLocaleDateString()}
                            </span>
                          </div>
                        )}
                        
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <span>By: {quiz.lecturer_name}</span>
                          {quiz.moderator_name && <span>• Reviewed by: {quiz.moderator_name}</span>}
                          {quiz.admin_name && <span>• Published by: {quiz.admin_name}</span>}
                        </div>
                      </div>
                      
                      <div className="mt-4 pt-3 border-t border-gray-200">
                        <Button
                          onClick={() => navigate(`/student/quiz/${quiz.id}`)}
                          disabled={isDeadlinePassed}
                          className={`w-full flex items-center justify-center gap-2 ${
                            isAttempted 
                              ? 'bg-green-600 hover:bg-green-700' 
                              : isDeadlinePassed 
                              ? 'bg-gray-400 cursor-not-allowed' 
                              : 'bg-blue-600 hover:bg-blue-700'
                          }`}
                        >
                          {isAttempted ? (
                            <>
                              <CheckCircle size={16} />
                              <span>View Attempt</span>
                            </>
                          ) : isDeadlinePassed ? (
                            <>
                              <AlertCircle size={16} />
                              <span>Deadline Passed</span>
                            </>
                          ) : (
                            <>
                              <BookOpen size={16} />
                              <span>Start Quiz</span>
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </Card>
                </div>
              );
            })}
          </div>
          
          {/* Pagination for Main Quiz List */}
          {mainTotalPages > 1 && (
            <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-200">
              <div className="text-sm text-gray-600">
                Showing {((mainPage - 1) * itemsPerPage) + 1} to {Math.min(mainPage * itemsPerPage, otherQuizzes.length)} of {otherQuizzes.length}
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={() => setMainPage(mainPage - 1)}
                  variant="secondary"
                  size="sm"
                  disabled={mainPage === 1}
                >
                  <ChevronLeft size={16} />
                  Previous
                </Button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: mainTotalPages }, (_, i) => i + 1).map((page) => (
                    <Button
                      key={page}
                      onClick={() => setMainPage(page)}
                      variant={page === mainPage ? "primary" : "secondary"}
                      size="sm"
                      className="w-8 h-8 p-0"
                    >
                      {page}
                    </Button>
                  ))}
                </div>
                <Button
                  onClick={() => setMainPage(mainPage + 1)}
                  variant="secondary"
                  size="sm"
                  disabled={mainPage === mainTotalPages}
                >
                  Next
                  <ChevronRight size={16} />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
