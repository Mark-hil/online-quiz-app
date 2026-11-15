import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  BookOpen,
  CheckCircle,
  TrendingUp,
  Shield,
  Activity,
  AlertTriangle,
  RefreshCw,
  FileText,
  Settings,
  ArrowRight,
  Clock,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import { db } from '../../lib/database';

interface DashboardStats {
  totalUsers: number;
  totalLecturers: number;
  totalStudents: number;
  totalModerators: number;
  totalAdmins: number;
  totalQuizzes: number;
  publishedQuizzes: number;
  draftQuizzes: number;
  archivedQuizzes: number;
}

export default function SuperAdminDashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats>({
    totalUsers: 0,
    totalLecturers: 0,
    totalStudents: 0,
    totalModerators: 0,
    totalAdmins: 0,
    totalQuizzes: 0,
    publishedQuizzes: 0,
    draftQuizzes: 0,
    archivedQuizzes: 0,
  });
  const [attemptTrend, setAttemptTrend] = useState<any[]>([]);
  const [activityTrend, setActivityTrend] = useState<any[]>([]);
  const [healthMetrics, setHealthMetrics] = useState<any[]>([]);
  const [recentAudits, setRecentAudits] = useState<any[]>([]);
  const [failedLogins, setFailedLogins] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadDashboard = async () => {
    setRefreshing(true);
    try {
      const [
        roleStats,
        quizStatsRows,
        attempts7d,
        activity7d,
        healthRows,
        auditRows,
        failedRows,
      ] = await Promise.all([
        db.getUserRoleStats(),
        db.getQuizStats(),
        db.getQuizAttemptStats(7),
        db.getUserActivityStats(7),
        db.getRecentHealthMetrics(undefined, 4),
        db.getAuditLogs(5, 0),
        db.getFailedLoginAttempts(5),
      ]);

      const quizRow = Array.isArray(quizStatsRows) ? quizStatsRows[0] : quizStatsRows;

      setStats({
        totalUsers: Number(roleStats?.total || 0),
        totalLecturers: Number(roleStats?.lecturers || 0),
        totalStudents: Number(roleStats?.students || 0),
        totalModerators: Number(roleStats?.moderators || 0),
        totalAdmins: Number(roleStats?.admins || 0) + Number(roleStats?.super_admins || 0),
        totalQuizzes: Number(quizRow?.total_quizzes || 0),
        publishedQuizzes: Number(quizRow?.published_quizzes || 0),
        draftQuizzes: Number(quizRow?.draft_quizzes || 0),
        archivedQuizzes: Number(quizRow?.archived_quizzes || 0),
      });

      setAttemptTrend(Array.isArray(attempts7d) ? attempts7d : []);
      setActivityTrend(Array.isArray(activity7d) ? activity7d : []);
      setHealthMetrics(Array.isArray(healthRows) ? healthRows : []);
      setRecentAudits(Array.isArray(auditRows) ? auditRows : []);
      setFailedLogins(Array.isArray(failedRows) ? failedRows : []);
    } catch (error) {
      console.error('Error loading Super Admin dashboard:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  const sevenDayAttempts = useMemo(
    () => attemptTrend.reduce((sum, r) => sum + (parseInt(r.total_attempts, 10) || 0), 0),
    [attemptTrend]
  );

  const chartData = useMemo(() => {
    const byDate = new Map<string, { date: string; attempts: number; actions: number }>();
    for (const row of attemptTrend) {
      const key = String(row.date || '').slice(0, 10);
      if (!key) continue;
      byDate.set(key, {
        date: new Date(key).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        attempts: parseInt(row.total_attempts, 10) || 0,
        actions: 0,
      });
    }
    for (const row of activityTrend) {
      const key = String(row.date || '').slice(0, 10);
      if (!key) continue;
      const existing = byDate.get(key) || {
        date: new Date(key).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        attempts: 0,
        actions: 0,
      };
      existing.actions = parseInt(row.total_actions, 10) || 0;
      byDate.set(key, existing);
    }
    return Array.from(byDate.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, val]) => val);
  }, [attemptTrend, activityTrend]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 space-y-3">
        <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-medium text-gray-500">Loading Super Admin dashboard...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Super Admin Dashboard</h1>
          <p className="text-sm text-gray-600 mt-0.5">
            Real-time overview of platform users, assessments, security alerts, and system health.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={loadDashboard}
            disabled={refreshing}
          >
            <RefreshCw size={14} className={`mr-1.5 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Badge variant="primary">Super Admin</Badge>
        </div>
      </div>

      {/* Primary KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase">Total Users</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{stats.totalUsers.toLocaleString()}</p>
            </div>
            <Users className="text-blue-600" size={26} />
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase">Students</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{stats.totalStudents.toLocaleString()}</p>
            </div>
            <Users className="text-emerald-600" size={26} />
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase">Lecturers</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{stats.totalLecturers.toLocaleString()}</p>
            </div>
            <Users className="text-purple-600" size={26} />
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase">Admins & Mods</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {(stats.totalAdmins + stats.totalModerators).toLocaleString()}
              </p>
            </div>
            <Shield className="text-orange-600" size={26} />
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase">Total Quizzes</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{stats.totalQuizzes.toLocaleString()}</p>
              <p className="text-[11px] text-gray-500 mt-0.5">
                {stats.publishedQuizzes} live • {stats.draftQuizzes} draft
              </p>
            </div>
            <BookOpen className="text-indigo-600" size={26} />
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase">7-Day Attempts</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{sevenDayAttempts.toLocaleString()}</p>
            </div>
            <TrendingUp className="text-cyan-600" size={26} />
          </div>
        </Card>
      </div>

      {/* Trend Chart & System Health */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="p-6 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold text-gray-900">7-Day Platform Activity & Quiz Attempts</h2>
              <p className="text-xs text-gray-500">Daily audit actions vs. student quiz attempts</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => navigate('/super-admin/analytics')}>
              Full Analytics
              <ArrowRight size={14} className="ml-1.5" />
            </Button>
          </div>
          {chartData.length === 0 ? (
            <div className="h-56 flex items-center justify-center text-sm text-gray-400">
              No activity recorded in the last 7 days.
            </div>
          ) : (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Area
                    type="monotone"
                    dataKey="attempts"
                    name="Quiz Attempts"
                    stroke="#2563eb"
                    fill="#dbeafe"
                    strokeWidth={2}
                  />
                  <Area
                    type="monotone"
                    dataKey="actions"
                    name="Audit Actions"
                    stroke="#10b981"
                    fill="#d1fae5"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-gray-900">System Health Pulse</h2>
            <button
              onClick={() => navigate('/super-admin/maintenance')}
              className="text-xs font-medium text-blue-600 hover:underline"
            >
              Details
            </button>
          </div>
          <div className="space-y-3">
            {healthMetrics.length === 0 ? (
              <p className="text-xs text-gray-500 py-6 text-center">
                No recent health checks recorded. Run a check in System Maintenance.
              </p>
            ) : (
              healthMetrics.map((m, i) => (
                <div
                  key={m.id || i}
                  className="flex items-center justify-between p-2.5 rounded-lg bg-gray-50 border border-gray-100"
                >
                  <div className="flex items-center gap-2.5">
                    <CheckCircle
                      size={16}
                      className={
                        String(m.status).toLowerCase() === 'healthy'
                          ? 'text-green-600'
                          : 'text-amber-600'
                      }
                    />
                    <div>
                      <p className="text-xs font-semibold text-gray-800 capitalize">{m.metric_name}</p>
                      <p className="text-[11px] text-gray-500">{m.metric_value}</p>
                    </div>
                  </div>
                  <Badge variant={String(m.status).toLowerCase() === 'healthy' ? 'success' : 'warning'}>
                    {m.status}
                  </Badge>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      {/* Recent Audit Trail & Security Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Activity size={18} className="text-blue-600" />
              <h2 className="text-base font-semibold text-gray-900">Recent Audit Activity</h2>
            </div>
            <button
              onClick={() => navigate('/super-admin/audit-logs')}
              className="text-xs font-medium text-blue-600 hover:underline"
            >
              View All
            </button>
          </div>
          <div className="space-y-2.5">
            {recentAudits.length === 0 ? (
              <p className="text-xs text-gray-500 py-4 text-center">No recent audit events.</p>
            ) : (
              recentAudits.map((log, i) => (
                <div
                  key={log.id || i}
                  className="flex items-center justify-between text-xs p-2.5 rounded-lg border border-gray-100 hover:bg-gray-50"
                >
                  <div>
                    <p className="font-semibold text-gray-800">{log.action}</p>
                    <p className="text-gray-500">
                      {log.name || log.email || 'System'} • {log.entity_type}
                    </p>
                  </div>
                  <span className="text-[11px] text-gray-400">
                    {log.created_at ? new Date(log.created_at).toLocaleString() : '-'}
                  </span>
                </div>
              ))
            )}
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <AlertTriangle size={18} className="text-amber-600" />
              <h2 className="text-base font-semibold text-gray-900">Recent Failed Logins</h2>
            </div>
            <button
              onClick={() => navigate('/super-admin/audit-logs')}
              className="text-xs font-medium text-blue-600 hover:underline"
            >
              Investigate
            </button>
          </div>
          <div className="space-y-2.5">
            {failedLogins.length === 0 ? (
              <p className="text-xs text-gray-500 py-4 text-center">No recent failed login attempts.</p>
            ) : (
              failedLogins.map((attempt, i) => (
                <div
                  key={attempt.id || i}
                  className="flex items-center justify-between text-xs p-2.5 rounded-lg border border-red-100 bg-red-50/40"
                >
                  <div>
                    <p className="font-semibold text-gray-800">{attempt.email}</p>
                    <p className="text-red-700">{attempt.error_message || 'Invalid credentials'}</p>
                  </div>
                  <span className="text-[11px] text-gray-500">
                    {attempt.ip_address || '-'}
                  </span>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card className="p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <button
            onClick={() => navigate('/super-admin/users')}
            className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-blue-300 transition-colors text-left"
          >
            <Users className="text-blue-600 mb-2" size={22} />
            <h3 className="font-medium text-gray-900 text-sm">Manage Users</h3>
            <p className="text-xs text-gray-600 mt-0.5">Provision staff, manage roles, and audit accounts</p>
          </button>

          <button
            onClick={() => navigate('/super-admin/quizzes')}
            className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-blue-300 transition-colors text-left"
          >
            <FileText className="text-indigo-600 mb-2" size={22} />
            <h3 className="font-medium text-gray-900 text-sm">Quizzes & Submissions</h3>
            <p className="text-xs text-gray-600 mt-0.5">Read-only oversight of exams and student attempts</p>
          </button>

          <button
            onClick={() => navigate('/super-admin/analytics')}
            className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-blue-300 transition-colors text-left"
          >
            <TrendingUp className="text-emerald-600 mb-2" size={22} />
            <h3 className="font-medium text-gray-900 text-sm">Analytics & Reports</h3>
            <p className="text-xs text-gray-600 mt-0.5">Executive KPIs, item diagnostics, and cohort exports</p>
          </button>

          <button
            onClick={() => navigate('/super-admin/configuration')}
            className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-blue-300 transition-colors text-left"
          >
            <Settings className="text-orange-600 mb-2" size={22} />
            <h3 className="font-medium text-gray-900 text-sm">System Configuration</h3>
            <p className="text-xs text-gray-600 mt-0.5">Persist quiz, anti-cheat, and notification settings</p>
          </button>

          <button
            onClick={() => navigate('/super-admin/audit-logs')}
            className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-blue-300 transition-colors text-left"
          >
            <Shield className="text-purple-600 mb-2" size={22} />
            <h3 className="font-medium text-gray-900 text-sm">Audit & Security Logs</h3>
            <p className="text-xs text-gray-600 mt-0.5">Inspect role changes, logins, and failed attempts</p>
          </button>

          <button
            onClick={() => navigate('/super-admin/time-extension')}
            className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-blue-300 transition-colors text-left"
          >
            <Clock className="text-cyan-600 mb-2" size={22} />
            <h3 className="font-medium text-gray-900 text-sm">Quiz Time Extensions</h3>
            <p className="text-xs text-gray-600 mt-0.5">Approve extensions and recover disconnected sessions</p>
          </button>
        </div>
      </Card>
    </div>
  );
}
