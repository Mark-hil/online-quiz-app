import { useEffect, useState } from 'react';
import { Users, BookOpen, CheckCircle, TrendingUp, Shield } from 'lucide-react';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import { db } from '../../lib/database';

interface Stats {
  totalUsers: number;
  totalLecturers: number;
  totalStudents: number;
  totalModerators: number;
  totalAdmins: number;
  totalQuizzes: number;
  publishedQuizzes: number;
}

export default function SuperAdminDashboard() {
  const [stats, setStats] = useState<Stats>({
    totalUsers: 0,
    totalLecturers: 0,
    totalStudents: 0,
    totalModerators: 0,
    totalAdmins: 0,
    totalQuizzes: 0,
    publishedQuizzes: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      // Get user counts by role
      const users = await db.getAllUsers();
      
      const lecturers = users.filter(u => u.role === 'lecturer').length;
      const students = users.filter(u => u.role === 'student').length;
      const moderators = users.filter(u => u.role === 'moderator').length;
      const admins = users.filter(u => u.role === 'admin').length;
      const superAdmins = users.filter(u => u.role === 'super_admin').length;

      // Get quiz counts
      const quizzes = await db.getQuizzes();
      const published = quizzes.filter(q => q.status === 'published').length;

      setStats({
        totalUsers: users.length,
        totalLecturers: lecturers,
        totalStudents: students,
        totalModerators: moderators,
        totalAdmins: admins + superAdmins,
        totalQuizzes: quizzes.length,
        publishedQuizzes: published,
      });
    } catch (error) {
      console.error('Error loading stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="text-center py-12">Loading dashboard...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Super Admin Dashboard</h1>
          <p className="text-gray-600">Overview of system users and activities</p>
        </div>
        <Badge variant="primary">
          Super Admin
        </Badge>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Users</p>
              <p className="text-3xl font-bold text-gray-900">{stats.totalUsers}</p>
            </div>
            <Users className="text-blue-600" size={32} />
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Students</p>
              <p className="text-3xl font-bold text-gray-900">{stats.totalStudents}</p>
            </div>
            <Users className="text-green-600" size={32} />
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Lecturers</p>
              <p className="text-3xl font-bold text-gray-900">{stats.totalLecturers}</p>
            </div>
            <Users className="text-purple-600" size={32} />
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Admins/Moderators</p>
              <p className="text-3xl font-bold text-gray-900">{stats.totalAdmins}</p>
            </div>
            <Shield className="text-orange-600" size={32} />
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Quizzes</p>
              <p className="text-3xl font-bold text-gray-900">{stats.totalQuizzes}</p>
            </div>
            <BookOpen className="text-indigo-600" size={32} />
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Published Quizzes</p>
              <p className="text-3xl font-bold text-gray-900">{stats.publishedQuizzes}</p>
            </div>
            <CheckCircle className="text-emerald-600" size={32} />
          </div>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-left">
            <Users className="text-blue-600 mb-2" size={24} />
            <h3 className="font-medium text-gray-900">Manage Users</h3>
            <p className="text-sm text-gray-600">View and manage all system users</p>
          </button>
          
          <button className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-left">
            <Shield className="text-orange-600 mb-2" size={24} />
            <h3 className="font-medium text-gray-900">System Settings</h3>
            <p className="text-sm text-gray-600">Configure system-wide settings</p>
          </button>
          
          <button className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-left">
            <TrendingUp className="text-green-600 mb-2" size={24} />
            <h3 className="font-medium text-gray-900">View Analytics</h3>
            <p className="text-sm text-gray-600">System usage and performance metrics</p>
          </button>
        </div>
      </Card>
    </div>
  );
}
