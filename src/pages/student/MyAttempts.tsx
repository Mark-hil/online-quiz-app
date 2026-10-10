import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Archive, Clock, Layers, Search, ChevronRight } from 'lucide-react';
import Table from '../../components/ui/Table';
import Badge from '../../components/ui/Badge';
import { db, QuizAttempt } from '../../lib/database';
import { useAuth } from '../../contexts/AuthContext';

interface AttemptRow extends QuizAttempt {
  quiz_title: string;
  quiz_subject?: string;
  quiz_status?: string;
  show_results_immediately?: boolean;
}

export default function MyAttempts() {
  const [attempts, setAttempts] = useState<AttemptRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'current' | 'archived' | 'all'>('current');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    loadAttempts();
  }, []);

  const loadAttempts = async () => {
    if (!user) return;
    setLoading(true);

    try {
      const rawAttempts = await db.getQuizAttempts(undefined, user.id);
      
      // Preload quiz details for each unique quizId (supports both published and archived exams)
      const uniqueQuizIds = [...new Set(rawAttempts.map((a: any) => a.quiz_id))];
      const quizMap = new Map();
      await Promise.all(
        uniqueQuizIds.map(async (qId) => {
          try {
            const q = await db.getQuiz(qId);
            if (q) quizMap.set(qId, q);
          } catch (e) {
            console.warn('Could not fetch quiz info for:', qId, e);
          }
        })
      );

      // Format attempts with quiz title, subject, status and calculated score
      const formatted = await Promise.all(
        rawAttempts.map(async (attempt: any) => {
          const quiz = quizMap.get(attempt.quiz_id);

          let score = attempt.score;
          // compute fallback score if missing or NaN and not in progress
          if ((score === null || score === undefined || isNaN(score)) && attempt.status !== 'in_progress') {
            const answers = await db.getStudentAnswers(attempt.id);
            const questions = await db.getQuestions(attempt.quiz_id);
            let marksObtained = 0;
            let total = 0;

            answers.forEach((a: any) => {
              const q = questions.find((q: any) => q.id === a.question_id);
              if (q) {
                total += q.marks || 0;
                if (a.marks_obtained !== null && a.marks_obtained !== undefined) {
                  marksObtained += a.marks_obtained;
                } else if (q.question_type !== 'essay' && a.answer_text === q.correct_answer) {
                  marksObtained += q.marks;
                }
              }
            });

            score = total > 0 ? (marksObtained / total) * 100 : 0;
          }

          return {
            ...attempt,
            quiz_title: quiz?.title || 'Unknown',
            quiz_subject: quiz?.subject || 'General',
            quiz_status: quiz?.status || 'published',
            score,
            show_results_immediately: quiz?.show_results_immediately !== false,
          };
        })
      );
      
      // Filter out old abandoned in_progress attempts (> 24 hours old)
      const oneDayMs = 24 * 60 * 60 * 1000;
      const activeAttempts = formatted.filter(attempt => {
        if (attempt.status === 'in_progress') {
          const ageMs = Date.now() - new Date(attempt.started_at).getTime();
          return ageMs <= oneDayMs;
        }
        return true;
      });
      
      // Deduplicate in_progress attempts if a completed (submitted/graded) version exists
      const quizAttempts = new Map<string, any>();
      for (const attempt of activeAttempts) {
        const key = attempt.quiz_id;
        const existing = quizAttempts.get(key);
        
        if (!existing) {
          quizAttempts.set(key, attempt);
        } else {
          const attemptPriority = (att: any) => {
            if (att.status === 'graded') return 3;
            if (att.status === 'submitted') return 2;
            return 1;
          };
          
          if (attemptPriority(attempt) > attemptPriority(existing)) {
            quizAttempts.set(key, attempt);
          }
        }
      }
      
      setAttempts(Array.from(quizAttempts.values()));
    } catch (err) {
      console.error('Failed to load student attempts:', err);
    } finally {
      setLoading(false);
    }
  };

  // Tab counts
  const currentCount = useMemo(
    () => attempts.filter((a) => a.quiz_status !== 'archived').length,
    [attempts]
  );
  const archivedCount = useMemo(
    () => attempts.filter((a) => a.quiz_status === 'archived').length,
    [attempts]
  );
  const totalCount = attempts.length;

  // Filtered dataset according to active tab & search query
  const filteredAttempts = useMemo(() => {
    let result = attempts;
    if (activeTab === 'current') {
      result = result.filter((a) => a.quiz_status !== 'archived');
    } else if (activeTab === 'archived') {
      result = result.filter((a) => a.quiz_status === 'archived');
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (a) =>
          a.quiz_title.toLowerCase().includes(q) ||
          (a.quiz_subject && a.quiz_subject.toLowerCase().includes(q))
      );
    }
    return result;
  }, [attempts, activeTab, searchQuery]);

  // Reset page whenever tab or search filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, searchQuery]);

  const columns = [
    {
      key: 'quiz_title',
      header: 'Quiz / Examination',
      render: (_: any, row: AttemptRow) => (
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-gray-900">{row.quiz_title}</span>
            {row.quiz_status === 'archived' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                <Archive size={10} />
                Archived Term
              </span>
            )}
          </div>
          {row.quiz_subject && (
            <span className="text-xs text-gray-500">{row.quiz_subject}</span>
          )}
        </div>
      ),
    },
    {
      key: 'started_at',
      header: 'Attempt Date',
      render: (value: string) => new Date(value).toLocaleString(),
    },
    {
      key: 'score',
      header: 'Score',
      render: (value: number | null | string, row: any) => {
        if (row.status === 'in_progress') {
          return '-';
        }
        
        if (row.show_results_immediately === false) {
          return 'Hidden';
        }
        
        if (value === null || value === undefined) return '-';
        
        const numValue = typeof value === 'string' ? parseFloat(value) : value;
        
        if (isNaN(numValue)) {
          return '-';
        }
        
        return (
          <span className="font-bold text-gray-900">
            {numValue.toFixed(1)}%
          </span>
        );
      },
    },
    {
      key: 'status',
      header: 'Status',
      render: (value: string) => {
        const variants: any = {
          in_progress: 'warning',
          submitted: 'secondary',
          graded: 'success',
          expired: 'danger',
        };
        return <Badge variant={variants[value] || 'secondary'}>{value}</Badge>;
      },
    },
  ];

  // Pagination calculations
  const totalPages = Math.ceil(filteredAttempts.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedData = filteredAttempts.slice(startIndex, endIndex);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleItemsPerPageChange = (newItemsPerPage: number) => {
    setItemsPerPage(newItemsPerPage);
    setCurrentPage(1);
  };

  const getPaginationNumbers = () => {
    const pages = [];
    const maxVisiblePages = 5;
    
    if (totalPages <= maxVisiblePages) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      const start = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
      const end = Math.min(totalPages, start + maxVisiblePages - 1);
      
      for (let i = start; i <= end; i++) {
        pages.push(i);
      }
    }
    
    return pages;
  };

  const emptyMessages = {
    current:
      archivedCount > 0
        ? 'No active term attempts. Your past semester records are safely stored in the "Past / Archived Terms" tab.'
        : 'No active term attempts found.',
    archived: 'No archived semester attempts found.',
    all: 'No quiz attempts found.',
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Attempts</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Track your performance across current courses and historical semesters
          </p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <label className="text-sm text-gray-600 font-medium">Items per page:</label>
          <select
            value={itemsPerPage}
            onChange={(e) => handleItemsPerPageChange(Number(e.target.value))}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value={5}>5</option>
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
          </select>
        </div>
      </div>

      {/* Term Filter Tabs & Search Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-200 pb-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('current')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeTab === 'current'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <Clock size={16} />
            <span>Current Term</span>
            <span
              className={`px-1.5 py-0.5 rounded-full text-xs font-bold ${
                activeTab === 'current' ? 'bg-blue-700 text-white' : 'bg-gray-200 text-gray-800'
              }`}
            >
              {currentCount}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('archived')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeTab === 'archived'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <Archive size={16} />
            <span>Past / Archived Terms</span>
            <span
              className={`px-1.5 py-0.5 rounded-full text-xs font-bold ${
                activeTab === 'archived' ? 'bg-amber-700 text-white' : 'bg-gray-200 text-gray-800'
              }`}
            >
              {archivedCount}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('all')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeTab === 'all'
                ? 'bg-slate-800 text-white shadow-sm'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <Layers size={16} />
            <span>All Terms</span>
            <span
              className={`px-1.5 py-0.5 rounded-full text-xs font-bold ${
                activeTab === 'all' ? 'bg-slate-700 text-white' : 'bg-gray-200 text-gray-800'
              }`}
            >
              {totalCount}
            </span>
          </button>
        </div>

        <div className="relative w-full sm:w-64">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search quiz or subject..."
            className="w-full pl-9 pr-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Helpful Banner when on Current Term but student has archived attempts */}
      {activeTab === 'current' && currentCount === 0 && archivedCount > 0 && (
        <div className="p-4 bg-amber-50/90 border border-amber-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-amber-950 shadow-xs">
          <div className="flex items-start sm:items-center gap-3">
            <div className="p-2 bg-amber-100 rounded-lg text-amber-800 shrink-0 mt-0.5 sm:mt-0">
              <Archive className="w-5 h-5" />
            </div>
            <div>
              <p className="font-semibold text-sm">
                Active term view clean: Your previous semester records ({archivedCount}) are safely archived.
              </p>
              <p className="text-xs text-amber-700 mt-0.5">
                Past examinations concluded and were archived by administration. You can view all past scores and review questions anytime.
              </p>
            </div>
          </div>
          <button
            onClick={() => setActiveTab('archived')}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-amber-700 hover:bg-amber-800 text-white rounded-lg text-xs font-bold shrink-0 transition"
          >
            <span>View Archived Records</span>
            <ChevronRight size={14} />
          </button>
        </div>
      )}

      {/* Results Count Summary */}
      <div className="text-sm text-gray-600">
        Showing {filteredAttempts.length > 0 ? startIndex + 1 : 0} to{' '}
        {Math.min(endIndex, filteredAttempts.length)} of {filteredAttempts.length} attempts
        {activeTab !== 'all' && (
          <span className="ml-1 text-gray-400">
            ({activeTab === 'current' ? 'Current Term' : 'Archived Terms'})
          </span>
        )}
      </div>

      {/* Attempts Table */}
      <Table
        columns={columns}
        data={paginatedData}
        onRowClick={(row) => {
          if (row.status === 'in_progress') {
            navigate(`/student/quiz/${row.quiz_id}`);
          } else if (row.show_results_immediately !== false) {
            navigate(`/student/result/${row.id}`);
          } else {
            alert('Results for this quiz are currently hidden by the lecturer.');
          }
        }}
        emptyMessage={loading ? 'Loading attempts...' : emptyMessages[activeTab]}
      />

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 bg-gray-50 rounded-lg">
          <div className="text-sm text-gray-600">
            Page {currentPage} of {totalPages}
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="px-3 py-1 text-sm bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            
            <div className="flex gap-1">
              {getPaginationNumbers().map((page) => (
                <button
                  key={page}
                  onClick={() => handlePageChange(page)}
                  className={`px-3 py-1 text-sm rounded-md transition-colors ${
                    page === currentPage
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
                  }`}
                >
                  {page}
                </button>
              ))}
            </div>
            
            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="px-3 py-1 text-sm bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
