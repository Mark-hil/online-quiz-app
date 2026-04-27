import { useEffect, useState } from 'react';
import { Download, Users, BookOpen, TrendingUp, Activity, FileText } from 'lucide-react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Select from '../../components/ui/Select';
import Badge from '../../components/ui/Badge';
import { db } from '../../lib/database';

export default function AnalyticsReporting() {
  const [timeRange, setTimeRange] = useState('30');
  const [userActivityStats, setUserActivityStats] = useState<any[]>([]);
  const [quizStats, setQuizStats] = useState<any>(null);
  const [quizAttemptStats, setQuizAttemptStats] = useState<any[]>([]);
  const [totalUsers, setTotalUsers] = useState(0);
  const [totalQuizzes, setTotalQuizzes] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAnalytics();
  }, [timeRange]);

  const loadAnalytics = async () => {
    setLoading(true);
    try {
      const days = parseInt(timeRange);
      const [activity, quiz, attempts, users, allQuizzes] = await Promise.all([
        db.getUserActivityStats(days),
        db.getQuizStats(),
        db.getQuizAttemptStats(days),
        db.getAllUsers(),
        db.getQuizzes(),
      ]);
      setUserActivityStats(activity as any[]);
      setQuizStats(quiz[0]);
      setQuizAttemptStats(attempts as any[]);
      setTotalUsers(users.length);
      setTotalQuizzes(allQuizzes.length);
    } catch (error) {
      console.error('Error loading analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = (type: string) => {
    alert(`Exporting ${type} data... This will download a CSV/Excel file.`);
  };

  if (loading) {
    return <div className="text-center py-12">Loading analytics...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analytics & Reporting</h1>
          <p className="text-gray-600">View system usage, generate reports, and export data</p>
        </div>
        <Badge variant="primary">
          Super Admin
        </Badge>
      </div>

      {/* Time Range Selector */}
      <Card className="p-4">
        <div className="flex items-center gap-4">
          <label className="text-sm font-medium text-gray-700">Time Range:</label>
          <Select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            options={[
              { value: '7', label: 'Last 7 days' },
              { value: '30', label: 'Last 30 days' },
              { value: '90', label: 'Last 90 days' },
              { value: '365', label: 'Last year' },
            ]}
          />
          <Button onClick={loadAnalytics} size="sm">
            Refresh
          </Button>
        </div>
      </Card>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Users</p>
              <p className="text-3xl font-bold text-gray-900">{totalUsers}</p>
            </div>
            <Users className="text-blue-600" size={32} />
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Quizzes</p>
              <p className="text-3xl font-bold text-gray-900">{totalQuizzes}</p>
            </div>
            <BookOpen className="text-blue-600" size={32} />
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Published</p>
              <p className="text-3xl font-bold text-gray-900">{quizStats?.published_quizzes || 0}</p>
            </div>
            <TrendingUp className="text-green-600" size={32} />
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Attempts</p>
              <p className="text-3xl font-bold text-gray-900">
                {quizAttemptStats.reduce((sum, stat) => sum + parseInt(stat.total_attempts), 0)}
              </p>
            </div>
            <Activity className="text-purple-600" size={32} />
          </div>
        </Card>
      </div>

      {/* User Activity */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Users className="text-blue-600" size={24} />
            <h2 className="text-lg font-semibold text-gray-900">User Activity</h2>
          </div>
          <Button onClick={() => handleExport('user activity')} size="sm">
            <Download size={16} className="mr-2" />
            Export
          </Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Date</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Active Users</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Total Actions</th>
              </tr>
            </thead>
            <tbody>
              {userActivityStats.length === 0 ? (
                <tr>
                  <td colSpan={3} className="text-center py-8 text-gray-500">
                    No activity data available
                  </td>
                </tr>
              ) : (
                userActivityStats.map((stat) => (
                  <tr key={stat.date} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4 text-gray-900">{stat.date}</td>
                    <td className="py-3 px-4 text-gray-600">{stat.active_users}</td>
                    <td className="py-3 px-4 text-gray-600">{stat.total_actions}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Quiz Attempts */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <FileText className="text-green-600" size={24} />
            <h2 className="text-lg font-semibold text-gray-900">Quiz Attempts</h2>
          </div>
          <Button onClick={() => handleExport('quiz attempts')} size="sm">
            <Download size={16} className="mr-2" />
            Export
          </Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Date</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Total Attempts</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Submitted</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Graded</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Avg Score</th>
              </tr>
            </thead>
            <tbody>
              {quizAttemptStats.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-8 text-gray-500">
                    No quiz attempt data available
                  </td>
                </tr>
              ) : (
                quizAttemptStats.map((stat) => (
                  <tr key={stat.date} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4 text-gray-900">{stat.date}</td>
                    <td className="py-3 px-4 text-gray-600">{stat.total_attempts}</td>
                    <td className="py-3 px-4 text-gray-600">{stat.submitted}</td>
                    <td className="py-3 px-4 text-gray-600">{stat.graded}</td>
                    <td className="py-3 px-4 text-gray-600">{Math.round(parseFloat(stat.avg_score || 0))}%</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Quiz Status Breakdown */}
      <Card>
        <div className="flex items-center gap-2 mb-4">
          <BookOpen className="text-purple-600" size={24} />
          <h2 className="text-lg font-semibold text-gray-900">Quiz Status Breakdown</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 border border-gray-200 rounded-lg">
            <div className="text-sm text-gray-600 mb-1">Total Quizzes</div>
            <div className="text-2xl font-bold text-gray-900">{quizStats?.total_quizzes || 0}</div>
          </div>
          <div className="p-4 border border-green-200 rounded-lg bg-green-50">
            <div className="text-sm text-green-700 mb-1">Published</div>
            <div className="text-2xl font-bold text-green-900">{quizStats?.published_quizzes || 0}</div>
          </div>
          <div className="p-4 border border-yellow-200 rounded-lg bg-yellow-50">
            <div className="text-sm text-yellow-700 mb-1">Drafts</div>
            <div className="text-2xl font-bold text-yellow-900">{quizStats?.draft_quizzes || 0}</div>
          </div>
        </div>
      </Card>

      {/* Export Options */}
      <Card>
        <div className="flex items-center gap-2 mb-4">
          <Download className="text-blue-600" size={24} />
          <h2 className="text-lg font-semibold text-gray-900">Export Data</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Button onClick={() => handleExport('users')} variant="secondary" className="flex items-center justify-center gap-2">
            <Users size={18} />
            Export Users
          </Button>
          <Button onClick={() => handleExport('quizzes')} variant="secondary" className="flex items-center justify-center gap-2">
            <BookOpen size={18} />
            Export Quizzes
          </Button>
          <Button onClick={() => handleExport('attempts')} variant="secondary" className="flex items-center justify-center gap-2">
            <FileText size={18} />
            Export Attempts
          </Button>
          <Button onClick={() => handleExport('activity')} variant="secondary" className="flex items-center justify-center gap-2">
            <Activity size={18} />
            Export Activity
          </Button>
        </div>
      </Card>
    </div>
  );
}
