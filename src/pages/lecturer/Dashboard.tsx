import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Users, CheckCircle, TrendingUp, Plus } from 'lucide-react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { db } from '../../lib/database';
import { useAuth } from '../../contexts/AuthContext';

interface Stats {
  totalQuizzes: number;
  totalStudents: number;
  activeQuizzes: number;
  averageScore: number;
}

export default function LecturerDashboard() {
  const [stats, setStats] = useState<Stats>({
    totalQuizzes: 0,
    totalStudents: 0,
    activeQuizzes: 0,
    averageScore: 0,
  });
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    if (!user) return;

    const quizzes = await db.getQuizzes(user.id);
    
    // Get all attempts for this lecturer's quizzes
    const allAttempts = [];
    for (const quiz of quizzes) {
      const attempts = await db.getQuizAttempts(quiz.id);
      allAttempts.push(...attempts);
    }

    // Get all students (profiles with role 'student')
    const allProfiles = await db.getProfiles();
    const totalStudents = allProfiles.filter(profile => profile.role === 'student').length;

    // Get unique students who attempted this lecturer's quizzes
    const uniqueStudentIds = new Set(allAttempts.map(a => a.student_id));
    const activeStudents = uniqueStudentIds.size;

    const activeQuizzes = quizzes.filter(q => q.status === 'published').length;

    // Calculate average score from attempts with scores
    const scoredAttempts = allAttempts.filter(a => 
      a.status === 'graded' || a.status === 'submitted'
    );
    
    const validScores = scoredAttempts
      .map(a => typeof a.score === 'string' ? parseFloat(a.score) : a.score)
      .filter(score => !isNaN(score) && score !== null && score !== undefined);

    const avgScore = validScores.length > 0
      ? validScores.reduce((sum, score) => sum + score, 0) / validScores.length
      : 0;

    setStats({
      totalQuizzes: quizzes.length,
      totalStudents,
      activeQuizzes,
      averageScore: avgScore,
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <Button onClick={() => navigate('/lecturer/create-quiz')}>
          <Plus size={20} className="mr-2" />
          Create Quiz
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Quizzes</p>
              <p className="text-3xl font-bold text-gray-900">{stats.totalQuizzes}</p>
            </div>
            <div className="p-3 bg-blue-100 rounded-lg">
              <BookOpen className="text-blue-600" size={24} />
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Students</p>
              <p className="text-3xl font-bold text-gray-900">{stats.totalStudents}</p>
            </div>
            <div className="p-3 bg-green-100 rounded-lg">
              <Users className="text-green-600" size={24} />
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Active Quizzes</p>
              <p className="text-3xl font-bold text-gray-900">{stats.activeQuizzes}</p>
            </div>
            <div className="p-3 bg-yellow-100 rounded-lg">
              <CheckCircle className="text-yellow-600" size={24} />
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Average Score</p>
              <p className="text-3xl font-bold text-gray-900">{stats.averageScore.toFixed(1)}%</p>
            </div>
            <div className="p-3 bg-red-100 rounded-lg">
              <TrendingUp className="text-red-600" size={24} />
            </div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <h2 className="text-lg font-bold text-gray-900 mb-4">Quick Actions</h2>
          <div className="space-y-3">
            <Button
              variant="secondary"
              className="w-full justify-start"
              onClick={() => navigate('/lecturer/create-quiz')}
            >
              <Plus size={18} className="mr-2" />
              Create New Quiz
            </Button>
            <Button
              variant="secondary"
              className="w-full justify-start"
              onClick={() => navigate('/lecturer/question-bank')}
            >
              <BookOpen size={18} className="mr-2" />
              View Question Bank
            </Button>
            <Button
              variant="secondary"
              className="w-full justify-start"
              onClick={() => navigate('/lecturer/submissions')}
            >
              <CheckCircle size={18} className="mr-2" />
              Review Submissions
            </Button>
          </div>
        </Card>

        <Card>
          <h2 className="text-lg font-bold text-gray-900 mb-4">Recent Activity</h2>
          <div className="space-y-3 text-sm text-gray-600">
            <p>No recent activity</p>
          </div>
        </Card>
      </div>
    </div>
  );
}
