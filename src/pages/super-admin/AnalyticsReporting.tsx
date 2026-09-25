import { useEffect, useState, useMemo } from 'react';
import {
  Download,
  Users,
  BookOpen,
  Activity,
  FileText,
  Calendar,
  RefreshCw,
  Search,
  PieChart as PieIcon,
  BarChart3,
  TrendingUp,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Input from '../../components/ui/Input';
import { db } from '../../lib/database';

// ─── Formatters & Helpers ───────────────────────────────────────────────────

const formatDate = (dateVal: any): string => {
  if (!dateVal) return '-';
  const d = dateVal instanceof Date ? dateVal : new Date(dateVal);
  if (isNaN(d.getTime())) return String(dateVal);
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

const formatShortDate = (dateVal: any): string => {
  if (!dateVal) return '';
  const d = dateVal instanceof Date ? dateVal : new Date(dateVal);
  if (isNaN(d.getTime())) return String(dateVal);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

const getDateKey = (dateVal: any, index: number): string => {
  if (!dateVal) return `row-${index}`;
  if (dateVal instanceof Date) return dateVal.toISOString();
  return String(dateVal);
};

// ─── Real CSV Exporter ──────────────────────────────────────────────────────

function exportToCSV(filename: string, headers: string[], rows: (string | number)[][]) {
  const csvContent =
    'data:text/csv;charset=utf-8,' +
    [
      headers.join(','),
      ...rows.map((row) =>
        row
          .map((cell) => {
            const str = String(cell ?? '');
            return `"${str.replace(/"/g, '""')}"`;
          })
          .join(',')
      ),
    ].join('\n');

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute(
    'download',
    `${filename}_${new Date().toISOString().split('T')[0]}.csv`
  );
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// ─── Custom Recharts Tooltip ────────────────────────────────────────────────

const CustomChartTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white/95 backdrop-blur-md p-3 rounded-lg shadow-lg border border-gray-200 text-xs">
        <p className="font-semibold text-gray-800 mb-1.5">{label}</p>
        <div className="space-y-1">
          {payload.map((entry: any, i: number) => (
            <div key={i} className="flex items-center gap-2">
              <span
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-gray-600">{entry.name}:</span>
              <span className="font-bold text-gray-900">
                {entry.value.toLocaleString()}
                {entry.unit || ''}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return null;
};

// ─── Component ──────────────────────────────────────────────────────────────

export default function AnalyticsReporting() {
  const [timeRange, setTimeRange] = useState<'7' | '30' | '90' | '365'>('30');
  const [activeTab, setActiveTab] = useState<'overview' | 'activity' | 'attempts'>(
    'overview'
  );
  const [searchQuery, setSearchQuery] = useState('');

  // Data states
  const [userActivityStats, setUserActivityStats] = useState<any[]>([]);
  const [quizStats, setQuizStats] = useState<any>(null);
  const [quizAttemptStats, setQuizAttemptStats] = useState<any[]>([]);
  const [usersList, setUsersList] = useState<any[]>([]);
  const [quizzesList, setQuizzesList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadAnalytics = async () => {
    setIsRefreshing(true);
    try {
      const days = parseInt(timeRange, 10);
      const [activity, quiz, attempts, users, allQuizzes] = await Promise.all([
        db.getUserActivityStats(days),
        db.getQuizStats(),
        db.getQuizAttemptStats(days),
        db.getAllUsers(),
        db.getQuizzes(),
      ]);

      setUserActivityStats((activity as any[]) || []);
      setQuizStats(quiz?.[0] || null);
      setQuizAttemptStats((attempts as any[]) || []);
      setUsersList((users as any[]) || []);
      setQuizzesList((allQuizzes as any[]) || []);
    } catch (error) {
      console.error('Error loading analytics:', error);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadAnalytics();
  }, [timeRange]);

  // Computed KPI Metrics
  const totalUsers = usersList.length;
  const totalQuizzes = quizzesList.length;
  const totalAttempts = useMemo(() => {
    return quizAttemptStats.reduce(
      (sum, stat) => sum + (parseInt(stat.total_attempts, 10) || 0),
      0
    );
  }, [quizAttemptStats]);

  const totalSubmitted = useMemo(() => {
    return quizAttemptStats.reduce(
      (sum, stat) => sum + (parseInt(stat.submitted, 10) || 0),
      0
    );
  }, [quizAttemptStats]);

  const completionRate = useMemo(() => {
    if (totalAttempts === 0) return 0;
    return Math.round((totalSubmitted / totalAttempts) * 100);
  }, [totalAttempts, totalSubmitted]);

  const overallAvgScore = useMemo(() => {
    if (quizAttemptStats.length === 0) return 0;
    const scores = quizAttemptStats
      .map((s) => parseFloat(s.avg_score || '0'))
      .filter((s) => !isNaN(s) && s > 0);
    if (scores.length === 0) return 0;
    return (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1);
  }, [quizAttemptStats]);

  // Chart Data Preparation (Chronological)
  const activityChartData = useMemo(() => {
    return [...userActivityStats]
      .reverse()
      .map((item) => ({
        date: formatShortDate(item.date),
        'Active Users': Number(item.active_users || 0),
        'Total Actions': Number(item.total_actions || 0),
      }));
  }, [userActivityStats]);

  const attemptsChartData = useMemo(() => {
    return [...quizAttemptStats]
      .reverse()
      .map((item) => ({
        date: formatShortDate(item.date),
        Attempts: Number(item.total_attempts || 0),
        Completed: Number(item.submitted || 0),
        'Avg Score': parseFloat(item.avg_score || '0'),
      }));
  }, [quizAttemptStats]);

  // Role Distribution
  const roleDistribution = useMemo(() => {
    const counts = { student: 0, lecturer: 0, moderator: 0, admin: 0 };
    usersList.forEach((u) => {
      if (u.role === 'student') counts.student++;
      else if (u.role === 'lecturer') counts.lecturer++;
      else if (u.role === 'moderator') counts.moderator++;
      else counts.admin++;
    });

    return [
      { name: 'Students', value: counts.student, color: '#3b82f6' },
      { name: 'Faculty', value: counts.lecturer, color: '#8b5cf6' },
      { name: 'Moderators', value: counts.moderator, color: '#f59e0b' },
      { name: 'Administrators', value: counts.admin, color: '#ec4899' },
    ].filter((item) => item.value > 0);
  }, [usersList]);

  // Quiz Status Distribution
  const quizDistribution = useMemo(() => {
    return [
      {
        name: 'Published',
        value: Number(quizStats?.published_quizzes || 0),
        color: '#10b981',
      },
      {
        name: 'Drafts',
        value: Number(quizStats?.draft_quizzes || 0),
        color: '#f59e0b',
      },
      {
        name: 'Archived',
        value: Number(quizStats?.archived_quizzes || 0),
        color: '#6b7280',
      },
    ].filter((item) => item.value > 0);
  }, [quizStats]);

  // Filtered Tables
  const filteredActivity = useMemo(() => {
    if (!searchQuery.trim()) return userActivityStats;
    const query = searchQuery.toLowerCase();
    return userActivityStats.filter((row) =>
      formatDate(row.date).toLowerCase().includes(query)
    );
  }, [userActivityStats, searchQuery]);

  const filteredAttempts = useMemo(() => {
    if (!searchQuery.trim()) return quizAttemptStats;
    const query = searchQuery.toLowerCase();
    return quizAttemptStats.filter((row) =>
      formatDate(row.date).toLowerCase().includes(query)
    );
  }, [quizAttemptStats, searchQuery]);

  // Export handlers
  const handleExportActivity = () => {
    const headers = ['Date', 'Active Users', 'Total Actions'];
    const rows = userActivityStats.map((r) => [
      formatDate(r.date),
      r.active_users,
      r.total_actions,
    ]);
    exportToCSV('user_activity_report', headers, rows);
  };

  const handleExportAttempts = () => {
    const headers = ['Date', 'Total Attempts', 'Submitted', 'Graded', 'Average Score'];
    const rows = quizAttemptStats.map((r) => [
      formatDate(r.date),
      r.total_attempts,
      r.submitted,
      r.graded,
      `${parseFloat(r.avg_score || 0).toFixed(2)}%`,
    ]);
    exportToCSV('quiz_attempts_report', headers, rows);
  };

  const handleExportFullSummary = () => {
    const headers = ['Metric', 'Value', 'Reporting Window'];
    const rows = [
      ['Total Platform Users', totalUsers, `Last ${timeRange} Days`],
      ['Total Quizzes In System', totalQuizzes, 'All Time'],
      ['Published Quizzes', quizStats?.published_quizzes || 0, 'All Time'],
      ['Draft Quizzes', quizStats?.draft_quizzes || 0, 'All Time'],
      ['Total Quiz Attempts', totalAttempts, `Last ${timeRange} Days`],
      ['Completed Submissions', totalSubmitted, `Last ${timeRange} Days`],
      ['Completion Rate', `${completionRate}%`, `Last ${timeRange} Days`],
      ['Overall Average Score', `${overallAvgScore}%`, `Last ${timeRange} Days`],
    ];
    exportToCSV('executive_system_summary', headers, rows);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-28 space-y-4">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-medium text-gray-500 animate-pulse">
          Synthesizing real-time analytics & reporting...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* ─── Header & System Banner ───────────────────────────────────────── */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-900 rounded-2xl p-6 text-white shadow-xl relative overflow-hidden">
        {/* Subtle background glow */}
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-72 h-72 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-10 w-72 h-72 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5">
              <span className="flex h-2.5 w-2.5 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
              </span>
              <span className="text-xs uppercase font-bold tracking-widest text-blue-300/90">
                Live System Intelligence
              </span>
              <Badge variant="primary" className="bg-blue-500/20 text-blue-200 border-blue-400/30">
                Root Governance
              </Badge>
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-white">
              Analytics & Executive Reporting
            </h1>
            <p className="text-sm text-blue-200/80 max-w-xl">
              Real-time platform throughput, assessment metrics, user engagement trends, and data export.
            </p>
          </div>

          {/* Time Filter Controls & Refresh */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex p-1 bg-white/10 backdrop-blur-md rounded-xl border border-white/10">
              {(
                [
                  { id: '7', label: '7D' },
                  { id: '30', label: '30D' },
                  { id: '90', label: '90D' },
                  { id: '365', label: '1Y' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setTimeRange(tab.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 ${
                    timeRange === tab.id
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'text-blue-200 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <Button
              variant="secondary"
              size="sm"
              onClick={loadAnalytics}
              disabled={isRefreshing}
              className="bg-white/10 text-white hover:bg-white/20 border-white/20 backdrop-blur-md"
            >
              <RefreshCw
                size={14}
                className={`mr-1.5 ${isRefreshing ? 'animate-spin' : ''}`}
              />
              Sync
            </Button>

            <Button
              size="sm"
              onClick={handleExportFullSummary}
              className="bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/20"
            >
              <Download size={14} className="mr-1.5" />
              Export Report
            </Button>
          </div>
        </div>
      </div>

      {/* ─── Executive KPI Cards ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Users */}
        <Card className="border border-slate-200 shadow-sm hover:shadow-md transition-all duration-200 relative overflow-hidden group">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 to-indigo-600" />
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                Total Accounts
              </span>
              <p className="text-3xl font-bold text-gray-900">{totalUsers.toLocaleString()}</p>
              <p className="text-xs text-blue-600 font-medium pt-1">
                {usersList.filter((u) => u.role === 'student').length} Students •{' '}
                {usersList.filter((u) => u.role === 'lecturer').length} Faculty
              </p>
            </div>
            <div className="p-3 bg-blue-50 text-blue-600 rounded-xl group-hover:scale-110 transition-transform">
              <Users size={22} />
            </div>
          </div>
        </Card>

        {/* Card 2: Quizzes */}
        <Card className="border border-slate-200 shadow-sm hover:shadow-md transition-all duration-200 relative overflow-hidden group">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 to-teal-600" />
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                Quiz Bank
              </span>
              <p className="text-3xl font-bold text-gray-900">{totalQuizzes.toLocaleString()}</p>
              <p className="text-xs text-emerald-600 font-medium pt-1">
                {quizStats?.published_quizzes || 0} Published •{' '}
                {quizStats?.draft_quizzes || 0} Drafts
              </p>
            </div>
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl group-hover:scale-110 transition-transform">
              <BookOpen size={22} />
            </div>
          </div>
        </Card>

        {/* Card 3: Attempts & Submissions */}
        <Card className="border border-slate-200 shadow-sm hover:shadow-md transition-all duration-200 relative overflow-hidden group">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-500 to-pink-600" />
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                Attempts Window
              </span>
              <p className="text-3xl font-bold text-gray-900">{totalAttempts.toLocaleString()}</p>
              <p className="text-xs text-purple-600 font-medium pt-1">
                {completionRate}% Completion Rate
              </p>
            </div>
            <div className="p-3 bg-purple-50 text-purple-600 rounded-xl group-hover:scale-110 transition-transform">
              <Activity size={22} />
            </div>
          </div>
        </Card>

        {/* Card 4: Mean Performance */}
        <Card className="border border-slate-200 shadow-sm hover:shadow-md transition-all duration-200 relative overflow-hidden group">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 to-orange-600" />
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                Mean Score
              </span>
              <p className="text-3xl font-bold text-gray-900">{overallAvgScore}%</p>
              <p className="text-xs text-amber-600 font-medium pt-1">
                Across {quizAttemptStats.length} reporting days
              </p>
            </div>
            <div className="p-3 bg-amber-50 text-amber-600 rounded-xl group-hover:scale-110 transition-transform">
              <TrendingUp size={22} />
            </div>
          </div>
        </Card>
      </div>

      {/* ─── Navigation Tabs ──────────────────────────────────────────────── */}
      <div className="flex items-center justify-between border-b border-gray-200 pb-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('overview')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeTab === 'overview'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            }`}
          >
            <BarChart3 size={16} />
            Executive Charts & Breakdown
          </button>
          <button
            onClick={() => setActiveTab('activity')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeTab === 'activity'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            }`}
          >
            <Users size={16} />
            User Activity Log ({userActivityStats.length})
          </button>
          <button
            onClick={() => setActiveTab('attempts')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeTab === 'attempts'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            }`}
          >
            <FileText size={16} />
            Quiz Attempts Detail ({quizAttemptStats.length})
          </button>
        </div>

        {activeTab !== 'overview' && (
          <div className="relative w-64">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <Input
              type="text"
              placeholder="Search by date..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 py-1.5 text-xs"
            />
          </div>
        )}
      </div>

      {/* ─── Tab Content: Overview (Charts & Intelligence) ────────────────── */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Main Visual Charts Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Chart 1: Activity Area Spline */}
            <Card className="border border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-bold text-gray-900 text-base">User Activity & Actions</h3>
                  <p className="text-xs text-gray-500">
                    Daily unique active users and overall platform actions
                  </p>
                </div>
                <Badge variant="secondary">Area Trend</Badge>
              </div>

              <div className="h-72 w-full">
                {activityChartData.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-gray-400 text-sm">
                    <Activity size={32} className="text-gray-300 mb-2" />
                    No activity records found for this period.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={activityChartData}
                      margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
                        </linearGradient>
                        <linearGradient id="colorActions" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                      <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#64748b' }} />
                      <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                      <Tooltip content={<CustomChartTooltip />} />
                      <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                      <Area
                        type="monotone"
                        dataKey="Total Actions"
                        stroke="#8b5cf6"
                        strokeWidth={2}
                        fillOpacity={1}
                        fill="url(#colorActions)"
                      />
                      <Area
                        type="monotone"
                        dataKey="Active Users"
                        stroke="#3b82f6"
                        strokeWidth={2.5}
                        fillOpacity={1}
                        fill="url(#colorUsers)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            </Card>

            {/* Chart 2: Quiz Attempts & Submissions Bar Chart */}
            <Card className="border border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-bold text-gray-900 text-base">
                    Assessment Volume & Completion
                  </h3>
                  <p className="text-xs text-gray-500">
                    Total started attempts compared against completed submissions
                  </p>
                </div>
                <Badge variant="secondary">Bar Comparison</Badge>
              </div>

              <div className="h-72 w-full">
                {attemptsChartData.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-gray-400 text-sm">
                    <FileText size={32} className="text-gray-300 mb-2" />
                    No quiz attempts found for this period.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={attemptsChartData}
                      margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                      <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#64748b' }} />
                      <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                      <Tooltip content={<CustomChartTooltip />} />
                      <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                      <Bar dataKey="Attempts" fill="#93c5fd" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Completed" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </Card>
          </div>

          {/* Secondary Charts: Distributions */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Donut Chart: User Roles */}
            <Card className="border border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-bold text-gray-900 text-base">User Community Distribution</h3>
                  <p className="text-xs text-gray-500">Breakdown of registered accounts across roles</p>
                </div>
                <PieIcon size={18} className="text-gray-400" />
              </div>

              <div className="h-64 w-full flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={roleDistribution}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={85}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {roleDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomChartTooltip />} />
                    <Legend wrapperStyle={{ fontSize: '12px' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </Card>

            {/* Donut Chart: Quiz Repositories */}
            <Card className="border border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-bold text-gray-900 text-base">Quiz Catalog Composition</h3>
                  <p className="text-xs text-gray-500">Publication status of active assessment banks</p>
                </div>
                <BookOpen size={18} className="text-gray-400" />
              </div>

              <div className="h-64 w-full flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={quizDistribution}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={85}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {quizDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomChartTooltip />} />
                    <Legend wrapperStyle={{ fontSize: '12px' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* ─── Tab Content: User Activity Log ───────────────────────────────── */}
      {activeTab === 'activity' && (
        <Card className="border border-gray-200 p-0 overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
            <div>
              <h3 className="font-bold text-gray-900">User Activity Aggregations</h3>
              <p className="text-xs text-gray-500">
                Showing daily unique active users and logged system actions
              </p>
            </div>
            <Button size="sm" variant="secondary" onClick={handleExportActivity}>
              <Download size={14} className="mr-1.5" />
              Export CSV
            </Button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Active Users</th>
                  <th className="py-3 px-4">Total System Actions</th>
                  <th className="py-3 px-4 text-right">Actions / User</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm">
                {filteredActivity.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-gray-500">
                      No matching activity logs found.
                    </td>
                  </tr>
                ) : (
                  filteredActivity.map((stat, index) => {
                    const ratio =
                      stat.active_users > 0
                        ? (stat.total_actions / stat.active_users).toFixed(1)
                        : '0';

                    return (
                      <tr
                        key={getDateKey(stat.date, index)}
                        className="hover:bg-blue-50/30 transition-colors"
                      >
                        <td className="py-3 px-4 font-medium text-gray-900 flex items-center gap-2">
                          <Calendar size={14} className="text-gray-400" />
                          {formatDate(stat.date)}
                        </td>
                        <td className="py-3 px-4">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-100">
                            {Number(stat.active_users).toLocaleString()} active
                          </span>
                        </td>
                        <td className="py-3 px-4 font-semibold text-gray-700">
                          {Number(stat.total_actions).toLocaleString()}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-xs text-gray-500">
                          {ratio} actions/user
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* ─── Tab Content: Quiz Attempts Breakdown ─────────────────────────── */}
      {activeTab === 'attempts' && (
        <Card className="border border-gray-200 p-0 overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
            <div>
              <h3 className="font-bold text-gray-900">Quiz Assessment Attempts Breakdown</h3>
              <p className="text-xs text-gray-500">
                Detailed record of attempt volume, completions, and mean scoring
              </p>
            </div>
            <Button size="sm" variant="secondary" onClick={handleExportAttempts}>
              <Download size={14} className="mr-1.5" />
              Export CSV
            </Button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Attempts</th>
                  <th className="py-3 px-4">Submitted</th>
                  <th className="py-3 px-4">Graded</th>
                  <th className="py-3 px-4">Completion %</th>
                  <th className="py-3 px-4 text-right">Avg Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm">
                {filteredAttempts.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-gray-500">
                      No matching quiz attempts found.
                    </td>
                  </tr>
                ) : (
                  filteredAttempts.map((stat, index) => {
                    const attempts = parseInt(stat.total_attempts, 10) || 0;
                    const submitted = parseInt(stat.submitted, 10) || 0;
                    const compPct =
                      attempts > 0 ? Math.round((submitted / attempts) * 100) : 0;
                    const score = parseFloat(stat.avg_score || 0);

                    return (
                      <tr
                        key={getDateKey(stat.date, index)}
                        className="hover:bg-blue-50/30 transition-colors"
                      >
                        <td className="py-3 px-4 font-medium text-gray-900 flex items-center gap-2">
                          <Calendar size={14} className="text-gray-400" />
                          {formatDate(stat.date)}
                        </td>
                        <td className="py-3 px-4 font-semibold text-gray-800">
                          {attempts.toLocaleString()}
                        </td>
                        <td className="py-3 px-4 text-gray-600">{submitted.toLocaleString()}</td>
                        <td className="py-3 px-4 text-gray-600">
                          {Number(stat.graded || 0).toLocaleString()}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <div className="w-16 bg-gray-200 rounded-full h-2 overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  compPct >= 70
                                    ? 'bg-emerald-500'
                                    : compPct >= 40
                                    ? 'bg-amber-500'
                                    : 'bg-red-500'
                                }`}
                                style={{ width: `${compPct}%` }}
                              />
                            </div>
                            <span className="text-xs font-medium text-gray-600">{compPct}%</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${
                              score >= 70
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : score >= 50
                                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                : 'bg-amber-50 text-amber-700 border border-amber-200'
                            }`}
                          >
                            {score.toFixed(1)}%
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
