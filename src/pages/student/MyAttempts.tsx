import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Table from '../../components/ui/Table';
import Badge from '../../components/ui/Badge';
import { db, QuizAttempt } from '../../lib/database';
import { useAuth } from '../../contexts/AuthContext';

interface AttemptRow extends QuizAttempt {
  quiz_title: string;
}

export default function MyAttempts() {
  const [attempts, setAttempts] = useState<AttemptRow[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    loadAttempts();
  }, []);

  const loadAttempts = async () => {
    if (!user) return;

    const attempts = await db.getQuizAttempts(undefined, user.id);
    
    // Debug: Log the raw attempts data
    console.log('Raw attempts from DB:', attempts);
    
    // Get quiz titles for each attempt
    const formatted = await Promise.all(
      attempts.map(async (attempt: any) => {
        const quizzes = await db.getQuizzes();
        const quiz = quizzes.find(q => q.id === attempt.quiz_id);

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
          score,
        };
      })
    );
    
    // Debug: Log the formatted attempts
    console.log('Formatted attempts:', formatted);
    
    // Filter out old abandoned in_progress attempts (> 24 hours old)
    const oneDayMs = 24 * 60 * 60 * 1000;
    const activeAttempts = formatted.filter(attempt => {
      if (attempt.status === 'in_progress') {
        const ageMs = Date.now() - new Date(attempt.started_at).getTime();
        return ageMs <= oneDayMs; // keep only recent in_progress attempts
      }
      return true; // keep all submitted/graded
    });
    
    // Remove in_progress attempts if a completed (submitted/graded) version exists for the same quiz
    const quizAttempts = new Map<string, any>();
    for (const attempt of activeAttempts) {
      const key = attempt.quiz_id;
      const existing = quizAttempts.get(key);
      
      if (!existing) {
        quizAttempts.set(key, attempt);
      } else {
        // Prefer submitted/graded over in_progress; prefer graded over submitted
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
  };

  const columns = [
    {
      key: 'quiz_title',
      header: 'Quiz Name',
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
        // Show score for submitted or graded attempts
        if (row.status === 'in_progress') {
          return '-';
        }
        
        if (value === null || value === undefined) return '-';
        
        const numValue = typeof value === 'string' ? parseFloat(value) : value;
        
        if (isNaN(numValue)) {
          return '-';
        }
        
        return `${numValue.toFixed(1)}%`;
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
        };
        return <Badge variant={variants[value] || 'secondary'}>{value}</Badge>;
      },
    },
  ];

  // Pagination calculations
  const totalPages = Math.ceil(attempts.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedData = attempts.slice(startIndex, endIndex);

  // Pagination controls
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleItemsPerPageChange = (newItemsPerPage: number) => {
    setItemsPerPage(newItemsPerPage);
    setCurrentPage(1); // Reset to first page when changing items per page
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">My Attempts</h1>
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600">Items per page:</label>
          <select
            value={itemsPerPage}
            onChange={(e) => handleItemsPerPageChange(Number(e.target.value))}
            className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value={5}>5</option>
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </div>
      </div>

      <div className="text-sm text-gray-600">
        Showing {startIndex + 1} to {Math.min(endIndex, attempts.length)} of {attempts.length} attempts
      </div>

      <Table
        columns={columns}
        data={paginatedData}
        onRowClick={(row) => {
          if (row.status === 'in_progress') {
            navigate(`/student/quiz/${row.quiz_id}`);
          } else {
            // allow viewing results whether the attempt was merely submitted or graded
            navigate(`/student/result/${row.id}`);
          }
        }}
        emptyMessage="No quiz attempts yet"
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
