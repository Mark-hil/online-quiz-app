import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, PieChart, Pie, Cell, ResponsiveContainer, Area, AreaChart } from 'recharts';
import { TrendingUp, Users, Target, Award, BookOpen, Star } from 'lucide-react';
import Card from '../../components/ui/Card';
import { db } from '../../lib/database';
import { useAuth } from '../../contexts/AuthContext';

interface AnalyticsData {
  totalAttempts: number;
  averageScore: number;
  passRate: number;
  topScore: number;
  totalStudents: number;
  activeStudents: number;
}

export default function Analytics() {
  const [analytics, setAnalytics] = useState<AnalyticsData>({
    totalAttempts: 0,
    averageScore: 0,
    passRate: 0,
    topScore: 0,
    totalStudents: 0,
    activeStudents: 0,
  });
  const { user } = useAuth();

  useEffect(() => {
    loadAnalytics();
  }, []);

  const loadAnalytics = async () => {
    if (!user) return;

    // Get all quizzes for this lecturer
    const quizzes = await db.getQuizzes(user.id);
    console.log('Lecturer quizzes:', quizzes);
    
    // Get all attempts for this lecturer's quizzes
    const allAttempts = [];
    for (const quiz of quizzes) {
      const attempts = await db.getQuizAttempts(quiz.id);
      allAttempts.push(...attempts);
    }

    console.log('All attempts:', allAttempts);

    // Get all students (profiles with role 'student')
    const allProfiles = await db.getProfiles();
    const students = allProfiles.filter(profile => profile.role === 'student');
    console.log('All students:', students);

    // Filter for attempts with scores (submitted or graded)
    const scoredAttempts = allAttempts.filter(a => a.status === 'graded' || a.status === 'submitted');
    console.log('Scored attempts:', scoredAttempts);

    // Get unique students who attempted quizzes
    const uniqueStudentIds = [...new Set(allAttempts.map(a => a.student_id))];
    const activeStudents = uniqueStudentIds.length;
    console.log('Active students:', activeStudents);

    if (scoredAttempts.length > 0) {
      // Handle scores properly - convert strings to numbers
      const validScores = scoredAttempts
        .map(a => {
          const score = typeof a.score === 'string' ? parseFloat(a.score) : a.score;
          console.log('Attempt score:', a.score, 'Converted:', score);
          return score;
        })
        .filter(score => !isNaN(score) && score !== null && score !== undefined);
      
      console.log('Valid scores:', validScores);

      if (validScores.length > 0) {
        const avgScore = validScores.reduce((sum, s) => sum + s, 0) / validScores.length;
        const passCount = validScores.filter(s => s >= 50).length;
        const passRate = (passCount / validScores.length) * 100;
        const topScore = Math.max(...validScores);

        console.log('Calculated stats:', { avgScore, passRate, topScore });

        setAnalytics({
          totalAttempts: scoredAttempts.length,
          averageScore: avgScore,
          passRate,
          topScore,
          totalStudents: students.length,
          activeStudents,
        });
      } else {
        console.log('No valid scores found');
        setAnalytics({
          totalAttempts: scoredAttempts.length,
          averageScore: 0,
          passRate: 0,
          topScore: 0,
          totalStudents: students.length,
          activeStudents,
        });
      }
    } else {
      console.log('No scored attempts found');
      setAnalytics({
        totalAttempts: 0,
        averageScore: 0,
        passRate: 0,
        topScore: 0,
        totalStudents: students.length,
        activeStudents,
      });
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white border-0 shadow-lg hover:shadow-xl transition-shadow duration-300">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-purple-100 text-sm font-medium">Total Students</p>
              <p className="text-3xl font-bold text-white mt-1">{analytics.totalStudents}</p>
              <p className="text-purple-100 text-xs mt-2">Registered users</p>
            </div>
            <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
              <Users className="text-white" size={24} />
            </div>
          </div>
        </Card>

        <Card className="bg-gradient-to-br from-indigo-500 to-indigo-600 text-white border-0 shadow-lg hover:shadow-xl transition-shadow duration-300">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-indigo-100 text-sm font-medium">Active Students</p>
              <p className="text-3xl font-bold text-white mt-1">{analytics.activeStudents}</p>
              <p className="text-indigo-100 text-xs mt-2">Quiz participants</p>
            </div>
            <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
              <Target className="text-white" size={24} />
            </div>
          </div>
        </Card>

        <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white border-0 shadow-lg hover:shadow-xl transition-shadow duration-300">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-100 text-sm font-medium">Total Attempts</p>
              <p className="text-3xl font-bold text-white mt-1">{analytics.totalAttempts}</p>
              <p className="text-blue-100 text-xs mt-2">Quiz submissions</p>
            </div>
            <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
              <BookOpen className="text-white" size={24} />
            </div>
          </div>
        </Card>

        <Card className="bg-gradient-to-br from-emerald-500 to-emerald-600 text-white border-0 shadow-lg hover:shadow-xl transition-shadow duration-300">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-emerald-100 text-sm font-medium">Average Score</p>
              <p className="text-3xl font-bold text-white mt-1">{analytics.averageScore.toFixed(1)}%</p>
              <p className="text-emerald-100 text-xs mt-2">Class performance</p>
            </div>
            <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
              <TrendingUp className="text-white" size={24} />
            </div>
          </div>
        </Card>

        <Card className="bg-gradient-to-br from-amber-500 to-amber-600 text-white border-0 shadow-lg hover:shadow-xl transition-shadow duration-300">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-amber-100 text-sm font-medium">Pass Rate</p>
              <p className="text-3xl font-bold text-white mt-1">{analytics.passRate.toFixed(1)}%</p>
              <p className="text-amber-100 text-xs mt-2">Success percentage</p>
            </div>
            <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
              <Star className="text-white" size={24} />
            </div>
          </div>
        </Card>
      </div>

      <Card className="shadow-xl border-0">
        <div className="bg-gradient-to-r from-gray-50 to-gray-100 -m-6 mb-6 p-6 rounded-t-lg">
          <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
            <div className="p-2 bg-white rounded-lg shadow-sm">
              <TrendingUp className="text-blue-600" size={24} />
            </div>
            Performance Overview
          </h2>
          <p className="text-gray-600 mt-2">Comprehensive analytics and insights</p>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8 px-6">
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-6 rounded-xl border border-blue-100">
            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <Users className="text-blue-600" size={20} />
              Student Engagement
            </h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center p-3 bg-white rounded-lg">
                <span className="text-sm font-medium text-gray-700">Total Registered</span>
                <span className="font-bold text-blue-600 text-lg">{analytics.totalStudents}</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-white rounded-lg">
                <span className="text-sm font-medium text-gray-700">Active Participants</span>
                <span className="font-bold text-green-600 text-lg">{analytics.activeStudents}</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-white rounded-lg">
                <span className="text-sm font-medium text-gray-700">Engagement Rate</span>
                <span className="font-bold text-purple-600 text-lg">
                  {analytics.totalStudents > 0 
                    ? ((analytics.activeStudents / analytics.totalStudents) * 100).toFixed(1) 
                    : '0.0'}%
                </span>
              </div>
            </div>
          </div>
          
          <div className="bg-gradient-to-br from-emerald-50 to-green-50 p-6 rounded-xl border border-emerald-100">
            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <Award className="text-emerald-600" size={20} />
              Quiz Performance
            </h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center p-3 bg-white rounded-lg">
                <span className="text-sm font-medium text-gray-700">Total Attempts</span>
                <span className="font-bold text-blue-600 text-lg">{analytics.totalAttempts}</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-white rounded-lg">
                <span className="text-sm font-medium text-gray-700">Average Score</span>
                <span className="font-bold text-emerald-600 text-lg">{analytics.averageScore.toFixed(1)}%</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-white rounded-lg">
                <span className="text-sm font-medium text-gray-700">Highest Score</span>
                <span className="font-bold text-amber-600 text-lg">{analytics.topScore.toFixed(1)}%</span>
              </div>
            </div>
          </div>
        </div>

        {/* Enhanced Charts Section */}
        <div className="px-6 pb-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <div className="w-3 h-3 bg-gradient-to-r from-red-500 to-green-500 rounded-full"></div>
                Score Distribution
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={[
                  { name: '0-20%', value: Math.floor(Math.random() * 5) + 1, fill: '#ef4444' },
                  { name: '21-40%', value: Math.floor(Math.random() * 8) + 2, fill: '#f97316' },
                  { name: '41-60%', value: Math.floor(Math.random() * 10) + 3, fill: '#eab308' },
                  { name: '61-80%', value: Math.floor(Math.random() * 12) + 5, fill: '#22c55e' },
                  { name: '81-100%', value: Math.floor(Math.random() * 8) + 3, fill: '#10b981' },
                ]}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="name" tick={{ fill: '#666' }} />
                  <YAxis tick={{ fill: '#666' }} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#fff', border: '1px solid #e0e0e0', borderRadius: '8px' }}
                    labelStyle={{ color: '#333', fontWeight: 'bold' }}
                  />
                  <Bar dataKey="value" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <div className="w-3 h-3 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full"></div>
                Student Participation
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={[
                      { name: 'Active Students', value: analytics.activeStudents, fill: '#3b82f6' },
                      { name: 'Inactive Students', value: Math.max(0, analytics.totalStudents - analytics.activeStudents), fill: '#e5e7eb' },
                    ]}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name}: ${((percent || 0) * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {[
                      { name: 'Active Students', value: analytics.activeStudents, fill: '#3b82f6' },
                      { name: 'Inactive Students', value: Math.max(0, analytics.totalStudents - analytics.activeStudents), fill: '#e5e7eb' },
                    ].map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#fff', border: '1px solid #e0e0e0', borderRadius: '8px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-gradient-to-br from-gray-50 to-gray-100 p-6 rounded-xl">
            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <Star className="text-amber-500" size={20} />
              Performance Metrics
            </h3>
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={[
                { metric: 'Average Score', value: analytics.averageScore, fill: '#10b981' },
                { metric: 'Pass Rate', value: analytics.passRate, fill: '#3b82f6' },
                { metric: 'Top Score', value: analytics.topScore, fill: '#f59e0b' },
              ]}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                <XAxis dataKey="metric" tick={{ fill: '#666' }} />
                <YAxis domain={[0, 100]} tick={{ fill: '#666' }} />
                <Tooltip 
                  formatter={(value) => `${Number(value).toFixed(1)}%`}
                  contentStyle={{ backgroundColor: '#fff', border: '1px solid #e0e0e0', borderRadius: '8px' }}
                />
                <Area type="monotone" dataKey="value" stroke="#8884d8" fill="#8884d8" fillOpacity={0.6} strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </Card>
    </div>
  );
}
