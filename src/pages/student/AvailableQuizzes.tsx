import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, BookOpen, Award, Search, AlertCircle, CheckCircle } from 'lucide-react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { db, Quiz } from '../../lib/database';
import { useAuth } from '../../contexts/AuthContext';

export default function AvailableQuizzes() {
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [filteredQuizzes, setFilteredQuizzes] = useState<Quiz[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [attemptedQuizzes, setAttemptedQuizzes] = useState<Set<string>>(new Set());
  const { user } = useAuth();
  const navigate = useNavigate();

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
    } else {
      setFilteredQuizzes(quizzes);
    }
  }, [searchTerm, quizzes]);

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

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Available Quizzes</h1>

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

      {filteredQuizzes.length === 0 ? (
        <Card>
          <div className="text-center py-12">
            <BookOpen className="mx-auto text-gray-400 mb-4" size={48} />
            <p className="text-gray-500">No quizzes available</p>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredQuizzes.map((quiz) => {
            const isAttempted = attemptedQuizzes.has(quiz.id);
            const isDeadlinePassed = quiz.deadline && new Date(quiz.deadline) < new Date();
            
            return (
              <Card key={quiz.id} hover>
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">{quiz.title}</h3>
                    <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                      {quiz.description || 'No description'}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <BookOpen size={16} />
                      <span>{quiz.subject || 'General'}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Clock size={16} />
                      <span>{quiz.duration_minutes} minutes</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Award size={16} />
                      <span>{quiz.total_marks} marks</span>
                    </div>
                    {quiz.deadline && (
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Clock size={16} />
                        <span>Deadline: {new Date(quiz.deadline).toLocaleString()}</span>
                      </div>
                    )}
                  </div>

                  {isAttempted ? (
                    <div className="flex items-center gap-2 text-green-600 bg-green-50 p-2 rounded text-sm">
                      <CheckCircle size={16} />
                      <span>Already attempted</span>
                    </div>
                  ) : isDeadlinePassed ? (
                    <div className="flex items-center gap-2 text-red-600 bg-red-50 p-2 rounded text-sm">
                      <AlertCircle size={16} />
                      <span>Deadline passed</span>
                    </div>
                  ) : (
                    <Button
                      className="w-full"
                      onClick={() => navigate(`/student/quiz/${quiz.id}`)}
                    >
                      Start Quiz
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
