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

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">My Attempts</h1>

      <Table
        columns={columns}
        data={attempts}
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
    </div>
  );
}
