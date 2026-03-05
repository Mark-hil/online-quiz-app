import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Clock, Award, TrendingUp } from 'lucide-react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import { db, Quiz, QuizAttempt } from '../../lib/database';
import { useAuth } from '../../contexts/AuthContext';

export default function StudentDashboard() {
  const [upcomingQuizzes, setUpcomingQuizzes] = useState<Quiz[]>([]);
  const [recentAttempts, setRecentAttempts] = useState<(QuizAttempt & { quiz_title: string })[]>([]);
  const [stats, setStats] = useState({
    totalAttempts: 0,
    averageScore: 0,
  });
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    if (!user) return;

    // Get published quizzes
    const quizzes = await db.getQuizzes();
    const limitedQuizzes = quizzes.slice(0, 5);
    setUpcomingQuizzes(limitedQuizzes as Quiz[]);

    // Get student's attempts
    const allAttempts = [];
    const studentQuizzes = await db.getQuizzes();
    
    for (const quiz of studentQuizzes) {
      const attempts = await db.getQuizAttempts(quiz.id, user.id);
      allAttempts.push(...attempts);
    }
    
    // Sort by creation date and limit to 5
    const sortedAttempts = allAttempts
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 5);
    
    // Get quiz titles for each attempt
    const formattedAttempts = await Promise.all(
      sortedAttempts.map(async (attempt: any) => {
        const quiz = studentQuizzes.find(q => q.id === attempt.quiz_id);
        return {
          ...attempt,
          quiz_title: quiz?.title || 'Unknown',
        };
      })
    );
    
    setRecentAttempts(formattedAttempts);

    // Calculate average score from all submitted/graded attempts (not just graded)
    const scoredAttempts = formattedAttempts.filter(a => 
      a.status === 'graded' || a.status === 'submitted'
    );
    
    console.log('All attempts:', formattedAttempts);
    console.log('Scored attempts:', scoredAttempts);
    
    if (scoredAttempts.length > 0) {
      const validScores = scoredAttempts
        .map(a => typeof a.score === 'string' ? parseFloat(a.score) : a.score)
        .filter(score => !isNaN(score) && score !== null);
      
      console.log('Valid scores:', validScores);
      
      if (validScores.length > 0) {
        const avgScore = validScores.reduce((sum, score) => sum + score, 0) / validScores.length;
        console.log('Calculated average:', avgScore);
        
        setStats({
          totalAttempts: formattedAttempts.length,
          averageScore: avgScore,
        });
      } else {
        setStats({
          totalAttempts: formattedAttempts.length,
          averageScore: 0,
        });
      }
    } else {
      setStats({
        totalAttempts: formattedAttempts.length,
        averageScore: 0,
      });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Welcome, {user?.name}!</h1>
        <p className="text-gray-600">Here's your quiz overview</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Attempts</p>
              <p className="text-3xl font-bold text-gray-900">{stats.totalAttempts}</p>
            </div>
            <div className="p-3 bg-blue-100 rounded-lg">
              <BookOpen className="text-blue-600" size={24} />
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Average Score</p>
              <p className="text-3xl font-bold text-gray-900">
                {typeof stats.averageScore === 'number' ? stats.averageScore.toFixed(1) : '0.0'}%
              </p>
            </div>
            <div className="p-3 bg-green-100 rounded-lg">
              <TrendingUp className="text-green-600" size={24} />
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Available Quizzes</p>
              <p className="text-3xl font-bold text-gray-900">{upcomingQuizzes.length}</p>
            </div>
            <div className="p-3 bg-yellow-100 rounded-lg">
              <Award className="text-yellow-600" size={24} />
            </div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900">Available Quizzes</h2>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => navigate('/student/quizzes')}
            >
              View All
            </Button>
          </div>

          {upcomingQuizzes.length === 0 ? (
            <p className="text-gray-500 text-center py-4">No quizzes available</p>
          ) : (
            <div className="space-y-3">
              {upcomingQuizzes.map((quiz) => (
                <div
                  key={quiz.id}
                  className="border border-gray-200 rounded-lg p-3 hover:border-blue-300 transition-colors cursor-pointer"
                  onClick={() => navigate(`/student/quiz/${quiz.id}`)}
                >
                  <h3 className="font-medium text-gray-900">{quiz.title}</h3>
                  <div className="flex items-center gap-3 mt-2 text-sm text-gray-600">
                    <span className="flex items-center gap-1">
                      <Clock size={14} />
                      {quiz.duration_minutes} min
                    </span>
                    <span>{quiz.total_marks} marks</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900">Recent Attempts</h2>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => navigate('/student/attempts')}
            >
              View All
            </Button>
          </div>

          {recentAttempts.length === 0 ? (
            <p className="text-gray-500 text-center py-4">No attempts yet</p>
          ) : (
            <div className="space-y-3">
              {recentAttempts.map((attempt) => (
                <div
                  key={attempt.id}
                  className="border border-gray-200 rounded-lg p-3"
                >
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-medium text-gray-900">{attempt.quiz_title}</h3>
                    <Badge variant={attempt.status === 'graded' ? 'success' : 'warning'}>
                      {attempt.status}
                    </Badge>
                  </div>
                  {attempt.score !== null && attempt.score !== undefined && (
                    <p className="text-sm text-gray-600">
                      Score: {typeof attempt.score === 'string' ? parseFloat(attempt.score).toFixed(1) : attempt.score.toFixed(1)}%
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
