import { useState, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  PieChart, Pie, Cell, ResponsiveContainer, Legend,
} from 'recharts';
import {
  TrendingUp, Users, Target, Award, BookOpen, AlertTriangle,
  CheckCircle, XCircle, Clock, BarChart2, Trophy, Flag,
} from 'lucide-react';
import Card from '../../components/ui/Card';
import { db } from '../../lib/database';
import { useAuth } from '../../contexts/AuthContext';

// ─── Types ───────────────────────────────────────────────────────────────────

interface QuizStats {
  id: string;
  title: string;
  attempts: number;
  avgScore: number;
  passRate: number;
  highestScore: number;
  lowestScore: number;
  completionRate: number;   // submitted / (submitted + in_progress)
}

interface QuestionStats {
  questionText: string;
  correctRate: number;      // % who got it right
  attempts: number;
  quizTitle: string;
}

interface StudentRow {
  name: string;
  indexNumber: string;
  avgScore: number;
  attempts: number;
  bestScore: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const toNum = (v: any): number => {
  const n = typeof v === 'string' ? parseFloat(v) : Number(v);
  return isNaN(n) ? 0 : n;
};

const avg = (arr: number[]) =>
  arr.length === 0 ? 0 : arr.reduce((s, v) => s + v, 0) / arr.length;

const SCORE_BANDS = [
  { label: '0–20%',  min: 0,  max: 20,  color: '#ef4444' },
  { label: '21–40%', min: 21, max: 40,  color: '#f97316' },
  { label: '41–60%', min: 41, max: 60,  color: '#eab308' },
  { label: '61–80%', min: 61, max: 80,  color: '#22c55e' },
  { label: '81–100%',min: 81, max: 100, color: '#10b981' },
];

const PIE_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#8b5cf6'];

// ─── Stat Card ───────────────────────────────────────────────────────────────

function StatCard({
  label, value, sub, gradient, icon: Icon,
}: {
  label: string; value: string; sub: string;
  gradient: string; icon: any;
}) {
  return (
    <Card className={`${gradient} text-white border-0 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-white/80 text-sm font-medium">{label}</p>
          <p className="text-3xl font-bold text-white mt-1">{value}</p>
          <p className="text-white/70 text-xs mt-2">{sub}</p>
        </div>
        <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
          <Icon className="text-white" size={24} />
        </div>
      </div>
    </Card>
  );
}

// ─── Section Header ──────────────────────────────────────────────────────────

function SectionHeader({ icon: Icon, color, title, sub }: {
  icon: any; color: string; title: string; sub: string;
}) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <div className={`p-2 ${color} rounded-lg`}>
        <Icon className="text-white" size={20} />
      </div>
      <div>
        <h2 className="text-lg font-bold text-gray-900">{title}</h2>
        <p className="text-sm text-gray-500">{sub}</p>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function Analytics() {
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);

  // Summary stats
  const [totalAttempts, setTotalAttempts]   = useState(0);
  const [avgScore, setAvgScore]             = useState(0);
  const [passRate, setPassRate]             = useState(0);
  const [totalQuizzes, setTotalQuizzes]     = useState(0);
  const [activeStudents, setActiveStudents] = useState(0);
  const [cheatingFlags, setCheatingFlags]   = useState(0);

  // Chart data
  const [scoreDistribution, setScoreDistribution] = useState<any[]>([]);
  const [quizStats, setQuizStats]                 = useState<QuizStats[]>([]);
  const [hardestQuestions, setHardestQuestions]   = useState<QuestionStats[]>([]);
  const [studentLeaderboard, setStudentLeaderboard] = useState<StudentRow[]>([]);
  const [statusBreakdown, setStatusBreakdown]     = useState<any[]>([]);
  const [filterQuizId, setFilterQuizId]           = useState<string>('all');

  useEffect(() => { loadAnalytics(); }, []);

  const loadAnalytics = async () => {
    if (!user) return;
    setLoading(true);
    console.log('[Analytics] Starting loadAnalytics for user', user.id);

    try {
      console.log('[Analytics] Fetching quizzes and attempts...');
      // Fetch quizzes + all attempts in parallel
      const [quizzes, allAttempts] = await Promise.all([
        db.getQuizzes(user.id),
        db.getLecturerQuizAttempts(user.id),
      ]);
      console.log('[Analytics] Fetched', quizzes.length, 'quizzes and', allAttempts.length, 'attempts');

      setTotalQuizzes(quizzes.length);

      if (allAttempts.length === 0) { 
        console.log('[Analytics] No attempts found, stopping early.');
        setLoading(false); 
        return; 
      }

      // ── Unique students ──
      const studentIds = [...new Set(allAttempts.map((a: any) => a.student_id))];
      setActiveStudents(studentIds.length);

      // ── Cheating flags ──
      const flagged = allAttempts.filter((a: any) => a.cheated).length;
      setCheatingFlags(flagged);

      // ── Attempts with scores ──
      const scored = allAttempts.filter((a: any) =>
        a.status === 'graded' || a.status === 'submitted'
      );
      const scores = scored.map((a: any) => toNum(a.score));

      setTotalAttempts(scored.length);
      setAvgScore(avg(scores));
      setPassRate(scores.length ? (scores.filter(s => s >= 50).length / scores.length) * 100 : 0);

      // ── Score distribution ──
      setScoreDistribution(
        SCORE_BANDS.map(band => ({
          label: band.label,
          count: scores.filter(s => s >= band.min && s <= band.max).length,
          color: band.color,
        }))
      );

      // ── Status breakdown (pie) ──
      const statusCounts: Record<string, number> = {};
      for (const a of allAttempts as any[]) {
        statusCounts[a.status] = (statusCounts[a.status] || 0) + 1;
      }
      setStatusBreakdown(
        Object.entries(statusCounts).map(([status, count]) => ({
          name: status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' '),
          value: count,
        }))
      );

      // ── Per-quiz stats ──
      const quizMap = new Map(quizzes.map((q: any) => [q.id, q]));
      const quizStatsArr: QuizStats[] = quizzes.map((quiz: any) => {
        const qAttempts = (allAttempts as any[]).filter(a => a.quiz_id === quiz.id);
        const qScored   = qAttempts.filter(a => a.status === 'graded' || a.status === 'submitted');
        const qScores   = qScored.map(a => toNum(a.score));
        const completed = qAttempts.filter(a => a.submitted_at).length;
        const total     = qAttempts.length;

        return {
          id: quiz.id,
          title: quiz.title.length > 22 ? quiz.title.slice(0, 22) + '…' : quiz.title,
          attempts: total,
          avgScore: avg(qScores),
          passRate: qScores.length
            ? (qScores.filter(s => s >= 50).length / qScores.length) * 100
            : 0,
          highestScore: qScores.length ? Math.max(...qScores) : 0,
          lowestScore:  qScores.length ? Math.min(...qScores) : 0,
          completionRate: total > 0 ? (completed / total) * 100 : 0,
        };
      }).filter((qs: QuizStats) => qs.attempts > 0);

      setQuizStats(quizStatsArr.sort((a, b) => b.attempts - a.attempts));

      console.log('[Analytics] Fetching profiles for', studentIds.length, 'students...');
      // ── Student leaderboard (fetch profiles for names) ──
      const profiles = await db.getProfilesByIds(studentIds);
      console.log('[Analytics] Fetched', profiles.length, 'profiles');
      
      const profileMap = new Map((profiles as any[]).map(p => [p.id, p]));

      const leaderboard: StudentRow[] = studentIds.map(sid => {
        const sAttempts = (allAttempts as any[]).filter(
          a => a.student_id === sid && (a.status === 'graded' || a.status === 'submitted')
        );
        const sScores = sAttempts.map(a => toNum(a.score));
        const profile = profileMap.get(sid) as any;
        return {
          name: profile?.name || 'Unknown',
          indexNumber: profile?.index_number || '—',
          avgScore: avg(sScores),
          attempts: sAttempts.length,
          bestScore: sScores.length ? Math.max(...sScores) : 0,
        };
      }).filter(s => s.attempts > 0)
        .sort((a, b) => b.avgScore - a.avgScore)
        .slice(0, 10);

      setStudentLeaderboard(leaderboard);

      console.log('[Analytics] Fetching answers for hardest questions analysis...');
      // ── Hardest questions (lowest correct rate) ──
      // Use the new single bulk query for all student answers
      const allAnswers = await db.getLecturerAnswersForAnalytics(user.id);
      console.log('[Analytics] Fetched', allAnswers.length, 'answers');

      // Group answers by question_id using the joined data directly
      const questionMap = new Map<string, { correct: number; total: number; text: string; quizTitle: string }>();
      
      const validAttemptIds = new Set(
        scored.map((a: any) => a.id)
      );

      for (const ans of allAnswers as any[]) {
        if (!ans.question_id || ans.is_correct === null) continue;
        if (!validAttemptIds.has(ans.attempt_id)) continue;
        
        if (!questionMap.has(ans.question_id)) {
          questionMap.set(ans.question_id, { 
            correct: 0, 
            total: 0, 
            text: ans.question_text.length > 60 ? ans.question_text.slice(0, 60) + '…' : ans.question_text, 
            quizTitle: ans.quiz_title 
          });
        }
        
        const entry = questionMap.get(ans.question_id)!;
        entry.total++;
        if (ans.is_correct) entry.correct++;
      }

      const hardest: QuestionStats[] = [];
      for (const [qid, data] of questionMap.entries()) {
        if (data.total < 2) continue; // skip questions with very few answers
        hardest.push({
          questionText: data.text || `Question ${qid.slice(0, 8)}…`,
          correctRate: (data.correct / data.total) * 100,
          attempts: data.total,
          quizTitle: data.quizTitle || '—',
        });
      }
      setHardestQuestions(
        hardest.sort((a, b) => a.correctRate - b.correctRate).slice(0, 8)
      );

      console.log('[Analytics] Done computing all stats.');

    } catch (err) {
      console.error('[Analytics] load error:', err);
    } finally {
      setLoading(false);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
          <p className="text-gray-500">Loading analytics…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Analytics</h1>
          <p className="text-gray-500 mt-1">Performance insights across all your quizzes</p>
        </div>
        <button
          onClick={loadAnalytics}
          className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <TrendingUp size={16} />
          Refresh
        </button>
      </div>

      {/* ── Summary KPIs ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard label="Total Quizzes"    value={totalQuizzes.toString()}        sub="Published & draft"    gradient="bg-gradient-to-br from-purple-500 to-purple-700"  icon={BookOpen} />
        <StatCard label="Active Students"  value={activeStudents.toString()}       sub="Unique participants"  gradient="bg-gradient-to-br from-indigo-500 to-indigo-700"  icon={Users} />
        <StatCard label="Total Submissions" value={totalAttempts.toString()}       sub="Graded attempts"     gradient="bg-gradient-to-br from-blue-500 to-blue-700"      icon={Target} />
        <StatCard label="Average Score"    value={`${avgScore.toFixed(1)}%`}      sub="Class average"       gradient="bg-gradient-to-br from-emerald-500 to-emerald-700" icon={TrendingUp} />
        <StatCard label="Pass Rate"        value={`${passRate.toFixed(1)}%`}      sub="Score ≥ 50%"         gradient="bg-gradient-to-br from-amber-500 to-amber-700"    icon={Award} />
        <StatCard label="Integrity Flags"  value={cheatingFlags.toString()}        sub="Cheating detected"   gradient="bg-gradient-to-br from-red-500 to-red-700"        icon={Flag} />
      </div>

      {/* ── Score Distribution + Status Breakdown ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="shadow-sm">
          <SectionHeader icon={BarChart2} color="bg-blue-600" title="Score Distribution" sub="How students are performing across all quizzes" />
          {scoreDistribution.some(d => d.count > 0) ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={scoreDistribution} barSize={40}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="label" tick={{ fill: '#6b7280', fontSize: 12 }} />
                <YAxis tick={{ fill: '#6b7280', fontSize: 12 }} allowDecimals={false} />
                <Tooltip
                  formatter={(v: any) => [`${v} student${v !== 1 ? 's' : ''}`, 'Count']}
                  contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb' }}
                />
                <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                  {scoreDistribution.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-center py-12 text-gray-400">
              <BarChart2 size={40} className="mx-auto mb-2 opacity-40" />
              <p>No scored submissions yet</p>
            </div>
          )}
        </Card>

        <Card className="shadow-sm">
          <SectionHeader icon={CheckCircle} color="bg-emerald-600" title="Submission Status Breakdown" sub="Overall distribution of attempt outcomes" />
          {statusBreakdown.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={statusBreakdown}
                  cx="50%" cy="50%"
                  outerRadius={90}
                  dataKey="value"
                  label={({ name, percent }) =>
                    `${name} ${((percent || 0) * 100).toFixed(0)}%`
                  }
                  labelLine={false}
                >
                  {statusBreakdown.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb' }} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-center py-12 text-gray-400">
              <CheckCircle size={40} className="mx-auto mb-2 opacity-40" />
              <p>No attempt data yet</p>
            </div>
          )}
        </Card>
      </div>

      {/* ── Per-Quiz Performance ── */}
      {quizStats.length > 0 && (
        <Card className="shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between">
            <SectionHeader icon={BookOpen} color="bg-purple-600" title="Per-Quiz Performance" sub="Average score and pass rate for each quiz" />
            <select
              value={filterQuizId}
              onChange={(e) => setFilterQuizId(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-purple-500 focus:border-purple-500 bg-white shadow-sm mb-5 sm:mb-0"
            >
              <option value="all">All Quizzes</option>
              {quizStats.map(q => (
                <option key={q.id} value={q.id}>{q.title}</option>
              ))}
            </select>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={filterQuizId === 'all' ? quizStats : quizStats.filter(q => q.id === filterQuizId)} margin={{ top: 5, right: 20, left: 0, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                dataKey="title"
                tick={{ fill: '#6b7280', fontSize: 11 }}
                angle={-35}
                textAnchor="end"
                interval={0}
              />
              <YAxis domain={[0, 100]} tick={{ fill: '#6b7280', fontSize: 12 }} unit="%" />
              <Tooltip
                formatter={(v: any, name: string) => [`${Number(v).toFixed(1)}%`, name]}
                contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb' }}
              />
              <Legend verticalAlign="top" />
              <Bar dataKey="avgScore"  name="Avg Score"  fill="#6366f1" radius={[4,4,0,0]} />
              <Bar dataKey="passRate"  name="Pass Rate"  fill="#10b981" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>

          {/* Quiz table */}
          <div className="mt-6 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b border-gray-100">
                  <th className="pb-2 font-medium">Quiz</th>
                  <th className="pb-2 font-medium text-right">Attempts</th>
                  <th className="pb-2 font-medium text-right">Avg Score</th>
                  <th className="pb-2 font-medium text-right">Pass Rate</th>
                  <th className="pb-2 font-medium text-right">Highest</th>
                  <th className="pb-2 font-medium text-right">Lowest</th>
                  <th className="pb-2 font-medium text-right">Completion</th>
                </tr>
              </thead>
              <tbody>
                {(filterQuizId === 'all' ? quizStats : quizStats.filter(q => q.id === filterQuizId)).map((q, i) => (
                  <tr key={q.id} className={`border-b border-gray-50 ${i % 2 === 0 ? 'bg-gray-50/50' : ''}`}>
                    <td className="py-2 pr-4 font-medium text-gray-800">{q.title}</td>
                    <td className="py-2 text-right text-gray-600">{q.attempts}</td>
                    <td className="py-2 text-right">
                      <span className={`font-semibold ${q.avgScore >= 50 ? 'text-emerald-600' : 'text-red-500'}`}>
                        {q.avgScore.toFixed(1)}%
                      </span>
                    </td>
                    <td className="py-2 text-right">
                      <span className={`font-semibold ${q.passRate >= 50 ? 'text-emerald-600' : 'text-amber-500'}`}>
                        {q.passRate.toFixed(1)}%
                      </span>
                    </td>
                    <td className="py-2 text-right text-gray-600">{q.highestScore.toFixed(1)}%</td>
                    <td className="py-2 text-right text-gray-600">{q.lowestScore.toFixed(1)}%</td>
                    <td className="py-2 text-right text-gray-600">{q.completionRate.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* ── Hardest Questions ── */}
      {hardestQuestions.length > 0 && (
        <Card className="shadow-sm">
          <SectionHeader icon={XCircle} color="bg-red-500" title="Hardest Questions" sub="Questions with the lowest correct-answer rate — consider reviewing these in class" />
          <div className="space-y-3">
            {hardestQuestions.map((q, i) => (
              <div key={i} className="flex items-start gap-4 p-3 bg-gray-50 rounded-lg">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-red-100 text-red-600 font-bold text-sm flex items-center justify-center">
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{q.questionText}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{q.quizTitle} · {q.attempts} attempts</p>
                </div>
                <div className="flex-shrink-0 text-right">
                  <p className={`text-lg font-bold ${q.correctRate < 30 ? 'text-red-500' : q.correctRate < 60 ? 'text-amber-500' : 'text-emerald-600'}`}>
                    {q.correctRate.toFixed(0)}%
                  </p>
                  <p className="text-xs text-gray-400">correct</p>
                </div>
                <div className="flex-shrink-0 w-24">
                  <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${q.correctRate < 30 ? 'bg-red-500' : q.correctRate < 60 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                      style={{ width: `${q.correctRate}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* ── Student Leaderboard ── */}
      {studentLeaderboard.length > 0 && (
        <Card className="shadow-sm">
          <SectionHeader icon={Trophy} color="bg-amber-500" title="Top Students" sub="Ranked by average score across your quizzes" />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b border-gray-100">
                  <th className="pb-2 font-medium w-10">Rank</th>
                  <th className="pb-2 font-medium">Student</th>
                  <th className="pb-2 font-medium">Index No.</th>
                  <th className="pb-2 font-medium text-right">Attempts</th>
                  <th className="pb-2 font-medium text-right">Avg Score</th>
                  <th className="pb-2 font-medium text-right">Best Score</th>
                </tr>
              </thead>
              <tbody>
                {studentLeaderboard.map((s, i) => (
                  <tr key={i} className={`border-b border-gray-50 ${i < 3 ? 'bg-amber-50/40' : i % 2 === 0 ? 'bg-gray-50/50' : ''}`}>
                    <td className="py-2">
                      {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : (
                        <span className="text-gray-400 font-medium ml-1">{i + 1}</span>
                      )}
                    </td>
                    <td className="py-2 font-medium text-gray-800">{s.name}</td>
                    <td className="py-2 text-gray-500">{s.indexNumber}</td>
                    <td className="py-2 text-right text-gray-600">{s.attempts}</td>
                    <td className="py-2 text-right">
                      <span className={`font-semibold ${s.avgScore >= 70 ? 'text-emerald-600' : s.avgScore >= 50 ? 'text-amber-500' : 'text-red-500'}`}>
                        {s.avgScore.toFixed(1)}%
                      </span>
                    </td>
                    <td className="py-2 text-right text-gray-600">{s.bestScore.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* ── Academic Integrity ── */}
      <Card className="shadow-sm border-l-4 border-l-red-400">
        <SectionHeader icon={AlertTriangle} color="bg-red-500" title="Academic Integrity Summary" sub="Students flagged for suspicious behaviour during quizzes" />
        {cheatingFlags === 0 ? (
          <div className="flex items-center gap-3 text-emerald-600 bg-emerald-50 p-4 rounded-lg">
            <CheckCircle size={20} />
            <p className="font-medium">No integrity violations detected across all submissions.</p>
          </div>
        ) : (
          <div className="flex items-center gap-3 text-red-600 bg-red-50 p-4 rounded-lg">
            <AlertTriangle size={20} />
            <p className="font-medium">
              {cheatingFlags} attempt{cheatingFlags !== 1 ? 's' : ''} were flagged for potential academic dishonesty.
              Review these in the <span className="underline">Submissions</span> tab.
            </p>
          </div>
        )}
      </Card>
    </div>
  );
}
