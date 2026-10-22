import { useState, useEffect } from 'react';
import { 
  Users, 
  KeyRound, 
  BookOpen, 
  Search, 
  Filter, 
  Layers, 
  HelpCircle,
  Clock,
  ShieldCheck
} from 'lucide-react';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import { db, Quiz } from '../../lib/database';
import QuizSessionManagerModal from '../../components/lecturer/QuizSessionManagerModal';

interface QuizWithDetails extends Quiz {
  lecturer_name?: string;
  lecturer_email?: string;
  course_name?: string;
  course_code?: string;
  sessions_count?: number;
}

export default function CohortSessions() {
  const [quizzes, setQuizzes] = useState<QuizWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'published' | 'approved' | 'pending_approval'>('all');
  const [selectedQuizForSessions, setSelectedQuizForSessions] = useState<Quiz | null>(null);

  useEffect(() => {
    loadQuizzes();
  }, []);

  const loadQuizzes = async () => {
    setLoading(true);
    try {
      // Load all quizzes to ensure Academic Officer has full oversight
      const allQuizzes = await db.getAllQuizzesDebug();
      
      // Also fetch session counts for each quiz
      const quizzesWithDetails = await Promise.all(
        (allQuizzes || []).map(async (q: any) => {
          try {
            const sessions = await db.getQuizSessions(q.id);
            return {
              ...q,
              sessions_count: sessions?.length || 0
            };
          } catch {
            return {
              ...q,
              sessions_count: 0
            };
          }
        })
      );

      setQuizzes(quizzesWithDetails);
    } catch (err) {
      console.error('Error loading cohort session quizzes:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredQuizzes = quizzes.filter(quiz => {
    const query = searchQuery.toLowerCase();
    const matchesSearch = 
      quiz.title?.toLowerCase().includes(query) ||
      quiz.subject?.toLowerCase().includes(query) ||
      (quiz.course_name && quiz.course_name.toLowerCase().includes(query)) ||
      (quiz.course_code && quiz.course_code.toLowerCase().includes(query));

    if (!matchesSearch) return false;

    if (filterStatus === 'all') return true;
    return quiz.status === filterStatus;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'published':
        return <Badge variant="success">Published / Live</Badge>;
      case 'approved':
        return <Badge variant="info">Approved by Moderator</Badge>;
      case 'pending_approval':
        return <Badge variant="warning">Pending Moderation</Badge>;
      case 'draft':
        return <Badge variant="secondary">Draft</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-purple-800 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-2">
            <span className="p-2 bg-white/10 rounded-lg backdrop-blur-md">
              <Users className="w-6 h-6 text-blue-200" />
            </span>
            <span className="text-xs uppercase tracking-wider font-semibold text-blue-200 bg-blue-900/40 px-2.5 py-1 rounded-full border border-blue-400/30">
              Academic Officer Operations Hub
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
            Cohort Sessions & Invigilator PINs
          </h1>
          <p className="text-blue-100 text-sm md:text-base max-w-2xl mt-1">
            Configure multi-cohort exam schedules, set invigilator access PINs, control question sampling counts, and manage session-by-session student sittings.
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
            <div className="bg-white/10 backdrop-blur-md rounded-xl p-3 border border-white/10">
              <div className="text-xs text-blue-200">Total Exams</div>
              <div className="text-xl font-bold">{quizzes.length}</div>
            </div>
            <div className="bg-white/10 backdrop-blur-md rounded-xl p-3 border border-white/10">
              <div className="text-xs text-blue-200">Published / Live</div>
              <div className="text-xl font-bold">
                {quizzes.filter(q => q.status === 'published').length}
              </div>
            </div>
            <div className="bg-white/10 backdrop-blur-md rounded-xl p-3 border border-white/10">
              <div className="text-xs text-blue-200">Approved (Ready)</div>
              <div className="text-xl font-bold">
                {quizzes.filter(q => q.status === 'approved').length}
              </div>
            </div>
            <div className="bg-white/10 backdrop-blur-md rounded-xl p-3 border border-white/10">
              <div className="text-xs text-blue-200">Configured Sessions</div>
              <div className="text-xl font-bold">
                {quizzes.reduce((acc, q) => acc + (q.sessions_count || 0), 0)}
              </div>
            </div>
          </div>
        </div>

        <div className="absolute right-0 bottom-0 opacity-10 pointer-events-none transform translate-x-8 translate-y-8">
          <KeyRound size={220} />
        </div>
      </div>

      {/* Control Bar: Search & Status Filter */}
      <Card className="p-4 shadow-sm">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="relative w-full md:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Search by exam title or subject..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
            <Filter size={16} className="text-gray-500 ml-1" />
            <span className="text-xs font-semibold text-gray-500 uppercase mr-1">Status:</span>
            
            {(['all', 'published', 'approved', 'pending_approval'] as const).map(status => (
              <button
                key={status}
                onClick={() => setFilterStatus(status)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  filterStatus === status
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {status === 'all' && 'All Quizzes'}
                {status === 'published' && 'Published'}
                {status === 'approved' && 'Approved'}
                {status === 'pending_approval' && 'Pending Review'}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* Main Quizzes List */}
      {loading ? (
        <div className="flex flex-col items-center justify-center p-12 bg-white rounded-xl border border-gray-200">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-gray-500 text-sm">Loading course quizzes and session profiles...</p>
        </div>
      ) : filteredQuizzes.length === 0 ? (
        <Card className="text-center py-12">
          <Layers className="mx-auto text-gray-300 mb-3" size={48} />
          <h3 className="text-lg font-semibold text-gray-800">No quizzes match your filter</h3>
          <p className="text-gray-500 text-sm mt-1 max-w-md mx-auto">
            {searchQuery 
              ? `No quizzes found matching "${searchQuery}". Try a different keyword.` 
              : 'There are currently no quizzes under the selected status filter.'}
          </p>
          <Button 
            variant="secondary" 
            size="sm" 
            className="mt-4"
            onClick={() => { setSearchQuery(''); setFilterStatus('all'); }}
          >
            Reset Filters
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredQuizzes.map(quiz => {
            const hasSessions = (quiz.sessions_count || 0) > 0;
            return (
              <Card 
                key={quiz.id} 
                className="hover:shadow-md transition-shadow border-l-4 border-l-blue-600"
              >
                <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-1.5">
                      <h3 className="text-lg font-bold text-gray-900">{quiz.title}</h3>
                      {getStatusBadge(quiz.status)}
                    </div>

                    <p className="text-gray-600 text-sm mb-3 line-clamp-1">
                      {quiz.description || 'No description provided.'}
                    </p>

                    <div className="flex flex-wrap items-center gap-y-2 gap-x-4 text-xs text-gray-500">
                      <div className="flex items-center gap-1">
                        <BookOpen size={14} className="text-gray-400" />
                        <span>Subject: <strong className="text-gray-700">{quiz.subject}</strong></span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock size={14} className="text-gray-400" />
                        <span>Duration: <strong className="text-gray-700">{quiz.duration_minutes}m</strong></span>
                      </div>
                      <div className="flex items-center gap-1">
                        <HelpCircle size={14} className="text-gray-400" />
                        <span>Questions to Answer: <strong className="text-gray-700">{quiz.draw_question_count || 'All questions'}</strong></span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Users size={14} className={hasSessions ? "text-indigo-600" : "text-gray-400"} />
                        <span>Active Cohort Sessions: <strong className={hasSessions ? "text-indigo-700 font-bold" : "text-gray-700"}>{quiz.sessions_count || 0}</strong></span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto pt-3 lg:pt-0 border-t lg:border-t-0 border-gray-100">
                    <Button
                      onClick={() => setSelectedQuizForSessions(quiz)}
                      variant="primary"
                      className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium shadow-sm"
                    >
                      <Users size={16} />
                      <span>Manage Cohort Sessions & PINs</span>
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Best Practices Explanatory Info Card */}
      <Card className="bg-gradient-to-r from-slate-50 to-blue-50 border-blue-200">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-blue-100 text-blue-700 rounded-xl mt-1">
            <ShieldCheck size={24} />
          </div>
          <div>
            <h4 className="font-bold text-gray-900 text-base">
              Academic Officer Multi-Cohort Best Practices
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-3 text-xs text-gray-600">
              <div className="bg-white p-3 rounded-lg border border-blue-100">
                <span className="font-semibold text-blue-900 block mb-1">1. Separate Session PINs</span>
                Each sitting group (e.g. Session 1: 09:00, Session 2: 11:00) receives a unique 6-digit access PIN provided to on-ground invigilators at exam start.
              </div>
              <div className="bg-white p-3 rounded-lg border border-blue-100">
                <span className="font-semibold text-blue-900 block mb-1">2. Dynamic Bank Sampling</span>
                If the Course Bank has 100 questions and each student answers 40, each cohort receives a unique randomized sample to eliminate collusion.
              </div>
              <div className="bg-white p-3 rounded-lg border border-blue-100">
                <span className="font-semibold text-blue-900 block mb-1">3. In-Flight Disruption Recovery</span>
                If internet drops or a lab PC crashes, the student's timer and answers remain safely persisted. The invigilator simply re-enters the active session PIN to resume.
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Cohort Session Manager Modal */}
      {selectedQuizForSessions && (
        <QuizSessionManagerModal
          isOpen={Boolean(selectedQuizForSessions)}
          onClose={() => {
            setSelectedQuizForSessions(null);
            loadQuizzes();
          }}
          quiz={selectedQuizForSessions}
        />
      )}
    </div>
  );
}
