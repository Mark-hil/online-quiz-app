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
  ShieldAlert,
  AlertTriangle,
  Award,
  Clock,
  Lock,
  CheckCircle2,
  XCircle,
  GraduationCap,
  HelpCircle,
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

const formatDateTime = (dateVal: any): string => {
  if (!dateVal) return '-';
  const d = dateVal instanceof Date ? dateVal : new Date(dateVal);
  if (isNaN(d.getTime())) return String(dateVal);
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const getDateKey = (dateVal: any, index: number): string => {
  if (!dateVal) return `row-${index}`;
  if (dateVal instanceof Date) return dateVal.toISOString();
  return String(dateVal);
};

// ─── Universal CSV Exporter ─────────────────────────────────────────────────

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
                style={{ backgroundColor: entry.color || entry.fill }}
              />
              <span className="text-gray-600">{entry.name}:</span>
              <span className="font-bold text-gray-900">
                {typeof entry.value === 'number' ? entry.value.toLocaleString() : entry.value}
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

// ─── Types ──────────────────────────────────────────────────────────────────

type DashboardTab =
  | 'overview'
  | 'academic'
  | 'questions'
  | 'security'
  | 'cohorts'
  | 'activity';

export default function AnalyticsReporting() {
  const [timeRange, setTimeRange] = useState<'7' | '30' | '90' | '365'>('30');
  const [activeTab, setActiveTab] = useState<DashboardTab>('overview');
  const [searchQuery, setSearchQuery] = useState('');

  // Core Data States
  const [userActivityStats, setUserActivityStats] = useState<any[]>([]);
  const [quizStats, setQuizStats] = useState<any>(null);
  const [quizAttemptStats, setQuizAttemptStats] = useState<any[]>([]);
  const [usersList, setUsersList] = useState<any[]>([]);
  const [quizzesList, setQuizzesList] = useState<any[]>([]);

  // Executive Deep-Dive States
  const [academicStats, setAcademicStats] = useState<any>({
    benchmarks: [],
    gradeTiers: [],
    totalGraded: 0,
    passCount: 0,
    failCount: 0,
    passRate: 0,
  });
  const [itemDiagnostics, setItemDiagnostics] = useState<any>({
    itemFailureRates: [],
    completionOutliers: [],
  });
  const [securityStats, setSecurityStats] = useState<any>({
    violations: [],
    failedLogins: [],
    extensionRequests: [],
    totalTabSwitches: 0,
    totalCopyAttempts: 0,
    totalRightClicks: 0,
    totalFlaggedCheated: 0,
  });
  const [cohortStats, setCohortStats] = useState<any>({
    allStudents: [],
    atRisk: [],
    honorRoll: [],
    totalEvaluated: 0,
    atRiskCount: 0,
    honorRollCount: 0,
  });
  const [flaggedAnswers, setFlaggedAnswers] = useState<any[]>([]);

  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadAnalytics = async () => {
    setIsRefreshing(true);
    try {
      const days = parseInt(timeRange, 10);
      const [
        activity,
        quiz,
        attempts,
        users,
        allQuizzes,
        academic,
        items,
        security,
        cohorts,
        flagged,
      ] = await Promise.all([
        db.getUserActivityStats(days),
        db.getQuizStats(),
        db.getQuizAttemptStats(days),
        db.getAllUsers(),
        db.getQuizzes(),
        db.getExecutiveAcademicStats(),
        db.getExecutiveItemDiagnostics(),
        db.getExecutiveSecurityStats(),
        db.getExecutiveCohortStats(),
        db.getFlaggedAnswersForAdmin(),
      ]);

      setUserActivityStats((activity as any[]) || []);
      setQuizStats(quiz?.[0] || null);
      setQuizAttemptStats((attempts as any[]) || []);
      setUsersList((users as any[]) || []);
      setQuizzesList((allQuizzes as any[]) || []);
      setAcademicStats(academic);
      setItemDiagnostics(items);
      setSecurityStats(security);
      setCohortStats(cohorts);
      setFlaggedAnswers(flagged || []);
    } catch (error) {
      console.error('Error loading executive analytics:', error);
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

  // Quiz Catalog Distribution
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

  // Pass vs Fail Distribution
  const passFailDistribution = useMemo(() => {
    return [
      { name: 'Passing (≥50%)', value: academicStats.passCount || 0, color: '#10b981' },
      { name: 'Failing (<50%)', value: academicStats.failCount || 0, color: '#ef4444' },
    ].filter((item) => item.value > 0);
  }, [academicStats]);

  // Filtered Lists for Searching
  const filteredBenchmarks = useMemo(() => {
    if (!searchQuery.trim()) return academicStats.benchmarks;
    const q = searchQuery.toLowerCase();
    return academicStats.benchmarks.filter(
      (b: any) =>
        (b.title || '').toLowerCase().includes(q) ||
        (b.subject || '').toLowerCase().includes(q)
    );
  }, [academicStats.benchmarks, searchQuery]);

  const filteredQuestions = useMemo(() => {
    if (!searchQuery.trim()) return itemDiagnostics.itemFailureRates;
    const q = searchQuery.toLowerCase();
    return itemDiagnostics.itemFailureRates.filter(
      (item: any) =>
        (item.question_text || '').toLowerCase().includes(q) ||
        (item.quiz_title || '').toLowerCase().includes(q) ||
        (item.subject || '').toLowerCase().includes(q)
    );
  }, [itemDiagnostics.itemFailureRates, searchQuery]);

  const filteredViolations = useMemo(() => {
    if (!searchQuery.trim()) return securityStats.violations;
    const q = searchQuery.toLowerCase();
    return securityStats.violations.filter(
      (v: any) =>
        (v.student_name || '').toLowerCase().includes(q) ||
        (v.student_email || '').toLowerCase().includes(q) ||
        (v.quiz_title || '').toLowerCase().includes(q)
    );
  }, [securityStats.violations, searchQuery]);

  const filteredAtRisk = useMemo(() => {
    if (!searchQuery.trim()) return cohortStats.atRisk;
    const q = searchQuery.toLowerCase();
    return cohortStats.atRisk.filter(
      (s: any) =>
        (s.student_name || '').toLowerCase().includes(q) ||
        (s.student_email || '').toLowerCase().includes(q) ||
        (s.index_number || '').toLowerCase().includes(q)
    );
  }, [cohortStats.atRisk, searchQuery]);

  const filteredHonorRoll = useMemo(() => {
    if (!searchQuery.trim()) return cohortStats.honorRoll;
    const q = searchQuery.toLowerCase();
    return cohortStats.honorRoll.filter(
      (s: any) =>
        (s.student_name || '').toLowerCase().includes(q) ||
        (s.student_email || '').toLowerCase().includes(q) ||
        (s.index_number || '').toLowerCase().includes(q)
    );
  }, [cohortStats.honorRoll, searchQuery]);

  const filteredActivity = useMemo(() => {
    if (!searchQuery.trim()) return userActivityStats;
    const q = searchQuery.toLowerCase();
    return userActivityStats.filter((row) =>
      formatDate(row.date).toLowerCase().includes(q)
    );
  }, [userActivityStats, searchQuery]);

  // ─── Export Routines ────────────────────────────────────────────────────────

  const handleExportFullSummary = () => {
    const headers = ['Metric', 'Value', 'Reporting Scope'];
    const rows = [
      ['Total Platform Users', totalUsers, `Last ${timeRange} Days`],
      ['Total Quizzes in System', totalQuizzes, 'All Time'],
      ['Published Assessments', quizStats?.published_quizzes || 0, 'All Time'],
      ['Draft Quizzes', quizStats?.draft_quizzes || 0, 'All Time'],
      ['Total Attempt Volume', totalAttempts, `Last ${timeRange} Days`],
      ['Completed Submissions', totalSubmitted, `Last ${timeRange} Days`],
      ['Completion Rate', `${completionRate}%`, `Last ${timeRange} Days`],
      ['Platform Mean Score', `${overallAvgScore}%`, `Last ${timeRange} Days`],
      ['Total Graded Submissions', academicStats.totalGraded, 'All Time'],
      ['Overall Pass Rate', `${academicStats.passRate}%`, 'All Time'],
      ['At-Risk Students Identified', cohortStats.atRiskCount, 'All Time'],
      ['Honor Roll Students', cohortStats.honorRollCount, 'All Time'],
      ['Proctoring Tab Violations', securityStats.totalTabSwitches, 'All Time'],
      ['Proctoring Copy Violations', securityStats.totalCopyAttempts, 'All Time'],
      ['Proctoring Right-Click Violations', securityStats.totalRightClicks, 'All Time'],
      ['Flagged Cheating Incidents', securityStats.totalFlaggedCheated, 'All Time'],
    ];
    exportToCSV('executive_intelligence_brief', headers, rows);
  };

  const handleExportAcademicBenchmarks = () => {
    const headers = [
      'Course / Assessment',
      'Subject',
      'Attempts',
      'Completed',
      'Avg Score %',
      'Passed',
      'Failed',
      'Highest Score',
      'Lowest Score',
    ];
    const rows = academicStats.benchmarks.map((b: any) => [
      b.title,
      b.subject || 'General',
      b.total_attempts,
      b.completed_attempts,
      b.avg_score !== null ? `${b.avg_score}%` : 'N/A',
      b.pass_count,
      b.fail_count,
      b.highest_score !== null ? `${b.highest_score}%` : 'N/A',
      b.lowest_score !== null ? `${b.lowest_score}%` : 'N/A',
    ]);
    exportToCSV('course_academic_benchmarks', headers, rows);
  };

  const handleExportQuestionDiagnostics = () => {
    const headers = [
      'Question Text',
      'Assessment Title',
      'Subject',
      'Question Type',
      'Total Responses',
      'Correct Responses',
      'Failure Rate %',
      'Success Rate %',
    ];
    const rows = itemDiagnostics.itemFailureRates.map((q: any) => [
      q.question_text,
      q.quiz_title,
      q.subject || 'General',
      q.question_type,
      q.total_responses,
      q.correct_count,
      `${q.failure_rate}%`,
      `${q.success_rate}%`,
    ]);
    exportToCSV('question_item_diagnostics', headers, rows);
  };

  const handleExportSecurityTelemetry = () => {
    const headers = [
      'Student Name',
      'Student Email',
      'Assessment Title',
      'Tab Switches',
      'Copy Attempts',
      'Right Clicks',
      'Cheated Flag',
      'Cheating Reason',
      'Started Date',
    ];
    const rows = securityStats.violations.map((v: any) => [
      v.student_name,
      v.student_email,
      v.quiz_title,
      v.tab_switch_count,
      v.copy_attempts,
      v.right_click_count,
      v.cheated ? 'YES' : 'NO',
      v.cheating_reason || 'N/A',
      formatDateTime(v.started_at),
    ]);
    exportToCSV('proctoring_security_telemetry', headers, rows);
  };

  const handleExportCohorts = () => {
    const headers = [
      'Cohort Type',
      'Student Name',
      'Student Email',
      'Index Number',
      'Total Quizzes Taken',
      'Average Score %',
      'Failed Quizzes',
      'Last Active Date',
    ];
    const atRiskRows = cohortStats.atRisk.map((s: any) => [
      'At-Risk',
      s.student_name,
      s.student_email,
      s.index_number || 'N/A',
      s.attempts_count,
      `${s.avg_score}%`,
      s.failed_attempts,
      formatDate(s.last_attempt_date),
    ]);
    const honorRows = cohortStats.honorRoll.map((s: any) => [
      'Honor Roll',
      s.student_name,
      s.student_email,
      s.index_number || 'N/A',
      s.attempts_count,
      `${s.avg_score}%`,
      s.failed_attempts,
      formatDate(s.last_attempt_date),
    ]);
    exportToCSV('student_cohort_analysis', headers, [...atRiskRows, ...honorRows]);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-28 space-y-4">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-semibold text-gray-600 animate-pulse">
          Synthesizing real-time executive analytics & reporting suite...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-14">
      {/* ─── Header & System Banner ───────────────────────────────────────── */}
      <div className="bg-gradient-to-r from-slate-950 via-indigo-950 to-blue-950 rounded-2xl p-6 text-white shadow-2xl relative overflow-hidden border border-slate-800">
        {/* Glow ambient effects */}
        <div className="absolute top-0 right-0 -mt-12 -mr-12 w-80 h-80 bg-blue-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/4 -mb-12 w-80 h-80 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="flex h-2.5 w-2.5 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
              </span>
              <span className="text-xs uppercase font-bold tracking-widest text-blue-300">
                Live Executive Intelligence
              </span>
              <Badge variant="primary" className="bg-blue-500/25 text-blue-200 border-blue-400/30 text-[11px]">
                Multi-Dimensional Governance
              </Badge>
              {securityStats.totalFlaggedCheated > 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                  <ShieldAlert size={12} />
                  {securityStats.totalFlaggedCheated} Proctoring Alerts
                </span>
              )}
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              Executive Analytics & Governance Command Center
            </h1>
            <p className="text-sm text-blue-200/80 max-w-2xl">
              Unified cross-system monitoring: operational throughput, academic curves, item diagnostics, proctoring security, and student cohort trajectories.
            </p>
          </div>

          {/* Time Filter Controls & Global Export */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex p-1 bg-white/10 backdrop-blur-md rounded-xl border border-white/15 shadow-inner">
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
              className="bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-950/30"
            >
              <Download size={14} className="mr-1.5" />
              Executive Brief
            </Button>
          </div>
        </div>
      </div>

      {/* ─── Top-Level High-Altitude KPI Cards ────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Metric 1: Total Users */}
        <Card className="border border-slate-200/80 shadow-sm hover:shadow-md transition-all duration-200 relative overflow-hidden group">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 to-indigo-600" />
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                Total Accounts
              </span>
              <p className="text-2xl font-bold text-gray-900">{totalUsers.toLocaleString()}</p>
              <p className="text-xs text-blue-600 font-medium pt-0.5">
                {usersList.filter((u) => u.role === 'student').length} Students •{' '}
                {usersList.filter((u) => u.role === 'lecturer').length} Faculty
              </p>
            </div>
            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl group-hover:scale-105 transition-transform">
              <Users size={20} />
            </div>
          </div>
        </Card>

        {/* Metric 2: Academic Pass Rate */}
        <Card className="border border-slate-200/80 shadow-sm hover:shadow-md transition-all duration-200 relative overflow-hidden group">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 to-teal-600" />
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                Academic Pass Rate
              </span>
              <p className="text-2xl font-bold text-gray-900">{academicStats.passRate}%</p>
              <p className="text-xs text-emerald-600 font-medium pt-0.5">
                {academicStats.passCount} passed • {academicStats.failCount} failed
              </p>
            </div>
            <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl group-hover:scale-105 transition-transform">
              <GraduationCap size={20} />
            </div>
          </div>
        </Card>

        {/* Metric 3: Assessment Volume */}
        <Card className="border border-slate-200/80 shadow-sm hover:shadow-md transition-all duration-200 relative overflow-hidden group">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-500 to-pink-600" />
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                Attempts Window
              </span>
              <p className="text-2xl font-bold text-gray-900">{totalAttempts.toLocaleString()}</p>
              <p className="text-xs text-purple-600 font-medium pt-0.5">
                {completionRate}% Completion Rate
              </p>
            </div>
            <div className="p-2.5 bg-purple-50 text-purple-600 rounded-xl group-hover:scale-105 transition-transform">
              <Activity size={20} />
            </div>
          </div>
        </Card>

        {/* Metric 4: Proctoring & Integrity */}
        <Card className="border border-slate-200/80 shadow-sm hover:shadow-md transition-all duration-200 relative overflow-hidden group">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-rose-500 to-red-600" />
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                Proctoring Flags
              </span>
              <p className="text-2xl font-bold text-gray-900">
                {(securityStats.totalTabSwitches + securityStats.totalCopyAttempts + securityStats.totalRightClicks).toLocaleString()}
              </p>
              <p className="text-xs text-rose-600 font-medium pt-0.5">
                {securityStats.totalFlaggedCheated} flagged cheaters
              </p>
            </div>
            <div className="p-2.5 bg-rose-50 text-rose-600 rounded-xl group-hover:scale-105 transition-transform">
              <ShieldAlert size={20} />
            </div>
          </div>
        </Card>

        {/* Metric 5: At-Risk Students */}
        <Card className="border border-slate-200/80 shadow-sm hover:shadow-md transition-all duration-200 relative overflow-hidden group">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 to-orange-600" />
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                At-Risk Cohort
              </span>
              <p className="text-2xl font-bold text-gray-900">{cohortStats.atRiskCount}</p>
              <p className="text-xs text-amber-600 font-medium pt-0.5">
                {cohortStats.honorRollCount} Honor Roll Students
              </p>
            </div>
            <div className="p-2.5 bg-amber-50 text-amber-600 rounded-xl group-hover:scale-105 transition-transform">
              <AlertTriangle size={20} />
            </div>
          </div>
        </Card>
      </div>

      {/* ─── Multi-Tab Executive Navigation Bar ────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-gray-200 gap-4 pb-2">
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          <button
            onClick={() => {
              setActiveTab('overview');
              setSearchQuery('');
            }}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
              activeTab === 'overview'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            }`}
          >
            <BarChart3 size={16} />
            Command Center
          </button>

          <button
            onClick={() => {
              setActiveTab('academic');
              setSearchQuery('');
            }}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
              activeTab === 'academic'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            }`}
          >
            <GraduationCap size={16} />
            Academic & Grade Curves
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                activeTab === 'academic' ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-700'
              }`}
            >
              {academicStats.benchmarks.length}
            </span>
          </button>

          <button
            onClick={() => {
              setActiveTab('questions');
              setSearchQuery('');
            }}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
              activeTab === 'questions'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            }`}
          >
            <HelpCircle size={16} />
            Item Diagnostics
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                activeTab === 'questions' ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-700'
              }`}
            >
              {itemDiagnostics.itemFailureRates.length}
            </span>
          </button>

          <button
            onClick={() => {
              setActiveTab('security');
              setSearchQuery('');
            }}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
              activeTab === 'security'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            }`}
          >
            <ShieldAlert size={16} />
            Security & Proctoring
            {securityStats.violations.length > 0 && (
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                  activeTab === 'security' ? 'bg-rose-500 text-white' : 'bg-rose-100 text-rose-700'
                }`}
              >
                {securityStats.violations.length}
              </span>
            )}
          </button>

          <button
            onClick={() => {
              setActiveTab('cohorts');
              setSearchQuery('');
            }}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
              activeTab === 'cohorts'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            }`}
          >
            <Users size={16} />
            Cohort & At-Risk
            {cohortStats.atRiskCount > 0 && (
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                  activeTab === 'cohorts' ? 'bg-amber-400 text-amber-950' : 'bg-amber-100 text-amber-800'
                }`}
              >
                {cohortStats.atRiskCount}
              </span>
            )}
          </button>

          <button
            onClick={() => {
              setActiveTab('activity');
              setSearchQuery('');
            }}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
              activeTab === 'activity'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            }`}
          >
            <Calendar size={16} />
            Activity Log
          </button>
        </div>

        {/* Tab Contextual Search */}
        {activeTab !== 'overview' && (
          <div className="relative w-full md:w-64">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
            />
            <Input
              type="text"
              placeholder={`Filter ${activeTab} data...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 py-1.5 text-xs"
            />
          </div>
        )}
      </div>

      {/* ═════════════════════════════════════════════════════════════════════ */}
      {/* TAB 1: COMMAND CENTER & OPERATIONAL INTELLIGENCE                     */}
      {/* ═════════════════════════════════════════════════════════════════════ */}
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

      {/* ═════════════════════════════════════════════════════════════════════ */}
      {/* TAB 2: ACADEMIC PERFORMANCE & GRADE CURVES                           */}
      {/* ═════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'academic' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Grade Tier Bell Curve Bar Chart (2 cols) */}
            <Card className="lg:col-span-2 border border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-bold text-gray-900 text-base">
                    Academic Grade Curve Distribution
                  </h3>
                  <p className="text-xs text-gray-500">
                    Graded submissions categorized into standard tier bands (A to F)
                  </p>
                </div>
                <Badge variant="primary" className="bg-indigo-50 text-indigo-700 border-indigo-200">
                  {academicStats.totalGraded} Graded Exams
                </Badge>
              </div>

              <div className="h-72 w-full">
                {academicStats.gradeTiers.every((t: any) => t.count === 0) ? (
                  <div className="h-full flex flex-col items-center justify-center text-gray-400 text-sm">
                    <GraduationCap size={32} className="text-gray-300 mb-2" />
                    No graded assessments recorded in system yet.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={academicStats.gradeTiers}
                      margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                      <XAxis dataKey="grade" tick={{ fontSize: 11, fill: '#64748b' }} />
                      <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                      <Tooltip content={<CustomChartTooltip />} />
                      <Bar dataKey="count" name="Students in Tier" radius={[6, 6, 0, 0]}>
                        {academicStats.gradeTiers.map((entry: any, index: number) => (
                          <Cell key={`grade-cell-${index}`} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </Card>

            {/* Pass vs Fail Donut Chart (1 col) */}
            <Card className="border border-gray-200 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-bold text-gray-900 text-base">Pass vs. Fail Ratio</h3>
                  <PieIcon size={18} className="text-gray-400" />
                </div>
                <p className="text-xs text-gray-500">Passing benchmark defined at ≥ 50% score</p>
              </div>

              <div className="h-56 w-full flex items-center justify-center my-2">
                {passFailDistribution.length === 0 ? (
                  <div className="text-xs text-gray-400 text-center">
                    No graded exam records found
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={passFailDistribution}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={75}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {passFailDistribution.map((entry, index) => (
                          <Cell key={`pf-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomChartTooltip />} />
                      <Legend wrapperStyle={{ fontSize: '11px' }} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2 pt-3 border-t border-gray-100 text-center">
                <div className="p-2 rounded-lg bg-emerald-50">
                  <span className="text-[10px] uppercase font-bold text-emerald-700">Pass Rate</span>
                  <p className="text-xl font-extrabold text-emerald-800">{academicStats.passRate}%</p>
                </div>
                <div className="p-2 rounded-lg bg-rose-50">
                  <span className="text-[10px] uppercase font-bold text-rose-700">Fail Rate</span>
                  <p className="text-xl font-extrabold text-rose-800">
                    {academicStats.totalGraded > 0 ? 100 - academicStats.passRate : 0}%
                  </p>
                </div>
              </div>
            </Card>
          </div>

          {/* Course-by-Course Academic Benchmarking Table */}
          <Card className="border border-gray-200 p-0 overflow-hidden">
            <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gray-50/50">
              <div>
                <h3 className="font-bold text-gray-900">Course & Assessment Academic Benchmarks</h3>
                <p className="text-xs text-gray-500">
                  Comparative performance benchmarks across all institutional quiz banks
                </p>
              </div>
              <Button size="sm" variant="secondary" onClick={handleExportAcademicBenchmarks}>
                <Download size={14} className="mr-1.5" />
                Export Benchmarks CSV
              </Button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    <th className="py-3 px-4">Assessment / Course</th>
                    <th className="py-3 px-4">Subject</th>
                    <th className="py-3 px-4">Total Attempts</th>
                    <th className="py-3 px-4">Completed</th>
                    <th className="py-3 px-4">Mean Score</th>
                    <th className="py-3 px-4">Pass / Fail Ratio</th>
                    <th className="py-3 px-4 text-right">Score Range</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-sm">
                  {filteredBenchmarks.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-gray-500">
                        No course benchmark data available.
                      </td>
                    </tr>
                  ) : (
                    filteredBenchmarks.map((b: any, index: number) => {
                      const avg = b.avg_score !== null ? parseFloat(b.avg_score) : null;
                      const completedPct =
                        b.total_attempts > 0
                          ? Math.round((b.completed_attempts / b.total_attempts) * 100)
                          : 0;

                      return (
                        <tr
                          key={b.quiz_id || index}
                          className="hover:bg-blue-50/30 transition-colors"
                        >
                          <td className="py-3 px-4 font-semibold text-gray-900 max-w-xs truncate">
                            {b.title}
                          </td>
                          <td className="py-3 px-4">
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700">
                              {b.subject || 'General'}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-semibold text-gray-800">
                            {Number(b.total_attempts).toLocaleString()}
                          </td>
                          <td className="py-3 px-4 text-gray-600">
                            <span className="text-xs font-medium">
                              {b.completed_attempts} ({completedPct}%)
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            {avg !== null ? (
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${
                                  avg >= 70
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                    : avg >= 50
                                    ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                    : 'bg-rose-50 text-rose-700 border border-rose-200'
                                }`}
                              >
                                {avg.toFixed(1)}%
                              </span>
                            ) : (
                              <span className="text-xs text-gray-400">Ungraded</span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-1.5 text-xs">
                              <span className="text-emerald-700 font-semibold">{b.pass_count}P</span>
                              <span className="text-gray-300">/</span>
                              <span className="text-rose-700 font-semibold">{b.fail_count}F</span>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-right font-mono text-xs text-gray-600">
                            {b.lowest_score !== null && b.highest_score !== null ? (
                              `${b.lowest_score}% – ${b.highest_score}%`
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════════════ */}
      {/* TAB 3: ASSESSMENT QUALITY & QUESTION ITEM DIAGNOSTICS                */}
      {/* ═════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'questions' && (
        <div className="space-y-6">
          {/* Question Item Failure Rate Table */}
          <Card className="border border-gray-200 p-0 overflow-hidden">
            <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gray-50/50">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-gray-900">Question Item Difficulty & Failure Diagnostics</h3>
                  <Badge variant="warning" className="bg-amber-100 text-amber-800 text-[10px]">
                    Item Analysis
                  </Badge>
                </div>
                <p className="text-xs text-gray-500">
                  Questions ranked by student failure rate. Items with &gt;70% failure indicate potential ambiguity or syllabus gaps.
                </p>
              </div>
              <Button size="sm" variant="secondary" onClick={handleExportQuestionDiagnostics}>
                <Download size={14} className="mr-1.5" />
                Export Items CSV
              </Button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    <th className="py-3 px-4">Question Text</th>
                    <th className="py-3 px-4">Assessment Title</th>
                    <th className="py-3 px-4">Type</th>
                    <th className="py-3 px-4">Total Responses</th>
                    <th className="py-3 px-4">Success Rate</th>
                    <th className="py-3 px-4 text-right">Failure Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-sm">
                  {filteredQuestions.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-gray-500">
                        No answered questions found in the diagnostic records.
                      </td>
                    </tr>
                  ) : (
                    filteredQuestions.map((q: any, idx: number) => {
                      const failRate = parseFloat(q.failure_rate || 0);
                      const isHighDifficulty = failRate >= 70;

                      return (
                        <tr
                          key={q.question_id || idx}
                          className="hover:bg-blue-50/30 transition-colors"
                        >
                          <td className="py-3 px-4 font-medium text-gray-900 max-w-md">
                            <p className="line-clamp-2">{q.question_text}</p>
                          </td>
                          <td className="py-3 px-4 text-gray-600 max-w-xs truncate text-xs">
                            {q.quiz_title}
                          </td>
                          <td className="py-3 px-4">
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono uppercase bg-slate-100 text-slate-700">
                              {q.question_type}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-semibold text-gray-700 text-xs">
                            {Number(q.total_responses).toLocaleString()} answers
                          </td>
                          <td className="py-3 px-4">
                            <span className="text-xs text-emerald-700 font-semibold">
                              {q.success_rate}%
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                                isHighDifficulty
                                  ? 'bg-rose-100 text-rose-800 border border-rose-300'
                                  : failRate >= 40
                                  ? 'bg-amber-100 text-amber-800 border border-amber-300'
                                  : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                              }`}
                            >
                              {isHighDifficulty && <AlertTriangle size={12} />}
                              {failRate}%
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

          {/* Suspicious / Fast Completion Outliers Table */}
          <Card className="border border-gray-200 p-0 overflow-hidden">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-gray-900">Completion Duration Outliers</h3>
                  <Badge variant="secondary" className="text-[10px]">
                    Speed Anomaly Detection
                  </Badge>
                </div>
                <p className="text-xs text-gray-500">
                  Assessments completed in under 5 minutes or disproportionately fast relative to allowed time.
                </p>
              </div>
              <Clock size={18} className="text-gray-400" />
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    <th className="py-3 px-4">Student</th>
                    <th className="py-3 px-4">Assessment Title</th>
                    <th className="py-3 px-4">Allowed Duration</th>
                    <th className="py-3 px-4">Time Spent</th>
                    <th className="py-3 px-4">Score</th>
                    <th className="py-3 px-4 text-right">Submission Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-sm">
                  {itemDiagnostics.completionOutliers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-gray-500">
                        No duration outlier records found.
                      </td>
                    </tr>
                  ) : (
                    itemDiagnostics.completionOutliers.map((row: any, idx: number) => {
                      const timeSpent = parseFloat(row.time_spent_minutes || 0);
                      const isSuspicious = timeSpent > 0 && timeSpent <= 5;

                      return (
                        <tr
                          key={row.attempt_id || idx}
                          className="hover:bg-blue-50/30 transition-colors"
                        >
                          <td className="py-3 px-4">
                            <div className="font-semibold text-gray-900">{row.student_name}</div>
                            <div className="text-xs text-gray-500">{row.student_email}</div>
                          </td>
                          <td className="py-3 px-4 text-gray-800 text-xs max-w-xs truncate">
                            {row.quiz_title}
                          </td>
                          <td className="py-3 px-4 text-xs text-gray-600">
                            {row.allowed_duration} mins
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold ${
                                isSuspicious
                                  ? 'bg-rose-100 text-rose-800 border border-rose-300'
                                  : 'bg-slate-100 text-slate-800'
                              }`}
                            >
                              {isSuspicious && <Clock size={12} />}
                              {timeSpent.toFixed(1)} mins
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <span className="font-semibold text-gray-800 text-xs">
                              {row.score !== null ? `${row.score}%` : 'N/A'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right text-xs text-gray-500">
                            {formatDateTime(row.submitted_at)}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════════════ */}
      {/* TAB 4: SECURITY, INTEGRITY & PROCTORING INTELLIGENCE                 */}
      {/* ═════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'security' && (
        <div className="space-y-6">
          {/* Security KPI Summary Banner */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="border border-rose-200 bg-rose-50/30">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-rose-700">
                    Tab Switch Violations
                  </span>
                  <p className="text-2xl font-extrabold text-rose-900 mt-1">
                    {securityStats.totalTabSwitches.toLocaleString()}
                  </p>
                  <p className="text-xs text-rose-600">Off-screen focus events</p>
                </div>
                <div className="p-3 bg-rose-100 text-rose-600 rounded-xl">
                  <ShieldAlert size={22} />
                </div>
              </div>
            </Card>

            <Card className="border border-amber-200 bg-amber-50/30">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700">
                    Clipboard & Copy Interceptions
                  </span>
                  <p className="text-2xl font-extrabold text-amber-900 mt-1">
                    {securityStats.totalCopyAttempts.toLocaleString()}
                  </p>
                  <p className="text-xs text-amber-600">Blocked copy attempts</p>
                </div>
                <div className="p-3 bg-amber-100 text-amber-600 rounded-xl">
                  <Lock size={22} />
                </div>
              </div>
            </Card>

            <Card className="border border-indigo-200 bg-indigo-50/30">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-700">
                    Context Menu / Right-Clicks
                  </span>
                  <p className="text-2xl font-extrabold text-indigo-900 mt-1">
                    {securityStats.totalRightClicks.toLocaleString()}
                  </p>
                  <p className="text-xs text-indigo-600">Blocked inspect attempts</p>
                </div>
                <div className="p-3 bg-indigo-100 text-indigo-600 rounded-xl">
                  <Activity size={22} />
                </div>
              </div>
            </Card>

            <Card className="border border-red-200 bg-red-50/30">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-red-700">
                    Confirmed Cheated Flags
                  </span>
                  <p className="text-2xl font-extrabold text-red-900 mt-1">
                    {securityStats.totalFlaggedCheated.toLocaleString()}
                  </p>
                  <p className="text-xs text-red-600">Automatic / proctor revoked</p>
                </div>
                <div className="p-3 bg-red-100 text-red-600 rounded-xl">
                  <XCircle size={22} />
                </div>
              </div>
            </Card>
          </div>

          {/* Proctoring Incident Log */}
          <Card className="border border-gray-200 p-0 overflow-hidden">
            <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gray-50/50">
              <div>
                <h3 className="font-bold text-gray-900">Proctoring Telemetry & Infraction Log</h3>
                <p className="text-xs text-gray-500">
                  Real-time client telemetry capturing tab switches, copy events, and security violations
                </p>
              </div>
              <Button size="sm" variant="secondary" onClick={handleExportSecurityTelemetry}>
                <Download size={14} className="mr-1.5" />
                Export Telemetry CSV
              </Button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    <th className="py-3 px-4">Student</th>
                    <th className="py-3 px-4">Assessment Title</th>
                    <th className="py-3 px-4">Tab Switches</th>
                    <th className="py-3 px-4">Copy Attempts</th>
                    <th className="py-3 px-4">Right Clicks</th>
                    <th className="py-3 px-4">Status & Reason</th>
                    <th className="py-3 px-4 text-right">Attempt Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-sm">
                  {filteredViolations.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-gray-500">
                        <CheckCircle2 size={32} className="text-emerald-500 mx-auto mb-2" />
                        No proctoring violations recorded. Clean assessment environment.
                      </td>
                    </tr>
                  ) : (
                    filteredViolations.map((v: any, idx: number) => {
                      const tabCount = Number(v.tab_switch_count || 0);
                      const copyCount = Number(v.copy_attempts || 0);
                      const rightClickCount = Number(v.right_click_count || 0);

                      return (
                        <tr
                          key={v.attempt_id || idx}
                          className="hover:bg-rose-50/30 transition-colors"
                        >
                          <td className="py-3 px-4">
                            <div className="font-semibold text-gray-900">{v.student_name}</div>
                            <div className="text-xs text-gray-500">{v.student_email}</div>
                          </td>
                          <td className="py-3 px-4 text-xs text-gray-700 max-w-xs truncate">
                            {v.quiz_title}
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${
                                tabCount >= 3
                                  ? 'bg-rose-100 text-rose-800 border border-rose-300'
                                  : tabCount > 0
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'text-gray-400'
                              }`}
                            >
                              {tabCount}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${
                                copyCount > 0
                                  ? 'bg-rose-100 text-rose-800 border border-rose-300'
                                  : 'text-gray-400'
                              }`}
                            >
                              {copyCount}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${
                                rightClickCount > 0
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'text-gray-400'
                              }`}
                            >
                              {rightClickCount}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            {v.cheated ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-600 text-white shadow-sm">
                                <XCircle size={12} />
                                CHEATED
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                                Monitored
                              </span>
                            )}
                            {v.cheating_reason && (
                              <p className="text-[11px] text-rose-600 mt-1 italic max-w-xs">
                                {v.cheating_reason}
                              </p>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right text-xs text-gray-500">
                            {formatDateTime(v.started_at)}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Authentication & Failed Login Log */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="border border-gray-200 p-0 overflow-hidden">
              <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                <div>
                  <h3 className="font-bold text-gray-900">Failed Authentication Attempts</h3>
                  <p className="text-xs text-gray-500">
                    Suspicious login failures and credential denial events
                  </p>
                </div>
                <Lock size={18} className="text-gray-400" />
              </div>

              <div className="overflow-x-auto max-h-72">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-50 sticky top-0 border-b border-gray-200 text-gray-600">
                    <tr>
                      <th className="py-2.5 px-3">Email Address</th>
                      <th className="py-2.5 px-3">IP Address</th>
                      <th className="py-2.5 px-3">Reason</th>
                      <th className="py-2.5 px-3 text-right">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {securityStats.failedLogins.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-6 text-center text-gray-500">
                          No failed logins recorded.
                        </td>
                      </tr>
                    ) : (
                      securityStats.failedLogins.map((fl: any, idx: number) => (
                        <tr key={fl.id || idx} className="hover:bg-gray-50">
                          <td className="py-2 px-3 font-medium text-gray-800">{fl.email}</td>
                          <td className="py-2 px-3 font-mono text-gray-500">
                            {fl.ip_address || 'Unknown'}
                          </td>
                          <td className="py-2 px-3 text-rose-600 font-medium">
                            {fl.error_message || 'Invalid Credentials'}
                          </td>
                          <td className="py-2 px-3 text-right text-gray-400">
                            {formatDateTime(fl.created_at)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </Card>

            {/* Time Extension Requests Table */}
            <Card className="border border-gray-200 p-0 overflow-hidden">
              <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                <div>
                  <h3 className="font-bold text-gray-900">Time Extension Audit</h3>
                  <p className="text-xs text-gray-500">
                    Audit trail of special accommodation extension requests
                  </p>
                </div>
                <Clock size={18} className="text-gray-400" />
              </div>

              <div className="overflow-x-auto max-h-72">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-50 sticky top-0 border-b border-gray-200 text-gray-600">
                    <tr>
                      <th className="py-2.5 px-3">Student & Quiz</th>
                      <th className="py-2.5 px-3">Duration</th>
                      <th className="py-2.5 px-3">Reason</th>
                      <th className="py-2.5 px-3 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {securityStats.extensionRequests.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-6 text-center text-gray-500">
                          No extension requests on file.
                        </td>
                      </tr>
                    ) : (
                      securityStats.extensionRequests.map((er: any, idx: number) => (
                        <tr key={er.id || idx} className="hover:bg-gray-50">
                          <td className="py-2 px-3">
                            <span className="font-medium text-gray-800">{er.student_name}</span>
                            <span className="block text-gray-400 truncate max-w-xs">
                              {er.quiz_title}
                            </span>
                          </td>
                          <td className="py-2 px-3 font-semibold text-gray-700">
                            +{er.extension_minutes} mins
                          </td>
                          <td className="py-2 px-3 text-gray-600 italic truncate max-w-[120px]">
                            {er.reason || 'Medical / Technical'}
                          </td>
                          <td className="py-2 px-3 text-right">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                er.status === 'approved'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : er.status === 'rejected'
                                  ? 'bg-rose-100 text-rose-800'
                                  : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {er.status}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════════════ */}
      {/* TAB 5: COHORT & AT-RISK STUDENT MONITORING                           */}
      {/* ═════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'cohorts' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Student Cohort Trajectories</h2>
              <p className="text-xs text-gray-500">
                Automated identification of students requiring academic intervention vs. distinguished high achievers.
              </p>
            </div>
            <Button size="sm" variant="secondary" onClick={handleExportCohorts}>
              <Download size={14} className="mr-1.5" />
              Export Cohort Rosters
            </Button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* At-Risk Watchlist */}
            <Card className="border border-rose-200 p-0 overflow-hidden shadow-sm">
              <div className="p-4 border-b border-rose-100 bg-rose-50/40 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-rose-950">At-Risk Intervention Watchlist</h3>
                    <Badge variant="danger" className="bg-rose-600 text-white text-[10px]">
                      {filteredAtRisk.length} Students
                    </Badge>
                  </div>
                  <p className="text-xs text-rose-700">
                    Criteria: Overall mean score &lt; 50% or ≥ 2 failed assessment attempts
                  </p>
                </div>
                <AlertTriangle size={20} className="text-rose-600" />
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-rose-50/20 border-b border-rose-100 text-rose-900 font-semibold uppercase tracking-wider">
                    <tr>
                      <th className="py-2.5 px-3">Student Name</th>
                      <th className="py-2.5 px-3">Index / ID</th>
                      <th className="py-2.5 px-3">Attempts</th>
                      <th className="py-2.5 px-3">Failures</th>
                      <th className="py-2.5 px-3 text-right">Avg Score</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredAtRisk.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-gray-500">
                          <CheckCircle2 size={24} className="text-emerald-500 mx-auto mb-1" />
                          No students currently meet the at-risk criteria.
                        </td>
                      </tr>
                    ) : (
                      filteredAtRisk.map((s: any, idx: number) => {
                        const score = parseFloat(s.avg_score || 0);

                        return (
                          <tr key={s.student_id || idx} className="hover:bg-rose-50/20">
                            <td className="py-2.5 px-3">
                              <div className="font-semibold text-gray-900">{s.student_name}</div>
                              <div className="text-[11px] text-gray-500">{s.student_email}</div>
                            </td>
                            <td className="py-2.5 px-3 font-mono text-gray-600">
                              {s.index_number || 'N/A'}
                            </td>
                            <td className="py-2.5 px-3 text-gray-700 font-medium">
                              {s.attempts_count} taken
                            </td>
                            <td className="py-2.5 px-3">
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-rose-100 text-rose-800">
                                {s.failed_attempts} fails
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-rose-50 text-rose-700 border border-rose-200">
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

            {/* High-Achiever Honor Roll */}
            <Card className="border border-emerald-200 p-0 overflow-hidden shadow-sm">
              <div className="p-4 border-b border-emerald-100 bg-emerald-50/40 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-emerald-950">High-Achiever Honor Roll</h3>
                    <Badge variant="primary" className="bg-emerald-600 text-white text-[10px]">
                      {filteredHonorRoll.length} Students
                    </Badge>
                  </div>
                  <p className="text-xs text-emerald-700">
                    Criteria: Cumulative assessment average ≥ 80% with verified completed attempts
                  </p>
                </div>
                <Award size={20} className="text-emerald-600" />
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-emerald-50/20 border-b border-emerald-100 text-emerald-900 font-semibold uppercase tracking-wider">
                    <tr>
                      <th className="py-2.5 px-3">Student Name</th>
                      <th className="py-2.5 px-3">Index / ID</th>
                      <th className="py-2.5 px-3">Attempts</th>
                      <th className="py-2.5 px-3">A-Grades</th>
                      <th className="py-2.5 px-3 text-right">Avg Score</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredHonorRoll.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-gray-500">
                          No students currently meet the honor roll threshold.
                        </td>
                      </tr>
                    ) : (
                      filteredHonorRoll.map((s: any, idx: number) => {
                        const score = parseFloat(s.avg_score || 0);

                        return (
                          <tr key={s.student_id || idx} className="hover:bg-emerald-50/20">
                            <td className="py-2.5 px-3">
                              <div className="font-semibold text-gray-900 flex items-center gap-1.5">
                                {idx < 3 && (
                                  <Award size={14} className="text-amber-500 inline-block" />
                                )}
                                {s.student_name}
                              </div>
                              <div className="text-[11px] text-gray-500">{s.student_email}</div>
                            </td>
                            <td className="py-2.5 px-3 font-mono text-gray-600">
                              {s.index_number || 'N/A'}
                            </td>
                            <td className="py-2.5 px-3 text-gray-700 font-medium">
                              {s.attempts_count} taken
                            </td>
                            <td className="py-2.5 px-3">
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-emerald-100 text-emerald-800">
                                {s.high_scores} scores ≥ 80%
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200">
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
          </div>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════════════ */}
      {/* TAB 6: ACTIVITY TIMELINE & LOGS                                      */}
      {/* ═════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'activity' && (
        <Card className="border border-gray-200 p-0 overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
            <div>
              <h3 className="font-bold text-gray-900">User Activity Aggregations</h3>
              <p className="text-xs text-gray-500">
                Daily unique active users and logged system actions over selected window
              </p>
            </div>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                const headers = ['Date', 'Active Users', 'Total Actions'];
                const rows = userActivityStats.map((r) => [
                  formatDate(r.date),
                  r.active_users,
                  r.total_actions,
                ]);
                exportToCSV('user_activity_report', headers, rows);
              }}
            >
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
    </div>
  );
}
