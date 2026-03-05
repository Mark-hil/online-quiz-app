import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileSpreadsheet, FileText } from 'lucide-react';
import Table from '../../components/ui/Table';
import Badge from '../../components/ui/Badge';
import Select from '../../components/ui/Select';
import Button from '../../components/ui/Button';
import { db, QuizAttempt, Quiz } from '../../lib/database';
import { useAuth } from '../../contexts/AuthContext';
import { csvExporter, StudentResult } from '../../utils/csvExport';
import { pdfExporter, StudentResultPDF } from '../../utils/pdfExport';

interface SubmissionRow extends QuizAttempt {
  student_name: string;
  quiz_title: string;
}

export default function Submissions() {
  const [submissions, setSubmissions] = useState<SubmissionRow[]>([]);
  const [filteredSubmissions, setFilteredSubmissions] = useState<SubmissionRow[]>([]);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [filterQuiz, setFilterQuiz] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    let filtered = submissions;

    if (filterQuiz !== 'all') {
      filtered = filtered.filter(s => s.quiz_id === filterQuiz);
    }

    if (filterStatus !== 'all') {
      filtered = filtered.filter(s => s.status === filterStatus);
    }

    setFilteredSubmissions(filtered);
  }, [filterQuiz, filterStatus, submissions]);

  const loadData = async () => {
    if (!user) return;

    const quizzesData = await db.getQuizzes(user.id);
    setQuizzes(quizzesData as Quiz[]);

    // Get all attempts for this lecturer's quizzes
    const allAttempts = [];
    for (const quiz of quizzesData) {
      const attempts = await db.getQuizAttempts(quiz.id);
      allAttempts.push(...attempts);
    }

    // Get student names for each attempt
    const formatted = await Promise.all(
      allAttempts.map(async (attempt: any) => {
        // Get student profile
        const studentProfile = await db.getProfile(attempt.student_id);
        // Get quiz info
        const quiz = quizzesData.find(q => q.id === attempt.quiz_id);
        
        return {
          ...attempt,
          student_name: studentProfile?.name || 'Unknown',
          quiz_title: quiz?.title || 'Unknown',
        };
      })
    );

    // Filter out old abandoned in_progress attempts (> 24 hours old)
    const oneDayMs = 24 * 60 * 60 * 1000;
    const activeSubmissions = formatted.filter(sub => {
      if (sub.status === 'in_progress') {
        const ageMs = Date.now() - new Date(sub.started_at).getTime();
        return ageMs <= oneDayMs; // keep only recent in_progress attempts
      }
      return true; // keep all submitted/graded
    });

    // Remove in_progress attempts if a completed (submitted/graded) version exists for the same quiz+student
    const submissionMap = new Map<string, any>();
    for (const sub of activeSubmissions) {
      const key = `${sub.quiz_id}:${sub.student_id}`;
      const existing = submissionMap.get(key);
      
      if (!existing) {
        submissionMap.set(key, sub);
      } else {
        // Prefer submitted/graded over in_progress; prefer graded over submitted
        const subPriority = (s: any) => {
          if (s.status === 'graded') return 3;
          if (s.status === 'submitted') return 2;
          return 1;
        };
        
        if (subPriority(sub) > subPriority(existing)) {
          submissionMap.set(key, sub);
        }
      }
    }

    setSubmissions(Array.from(submissionMap.values()));
    setFilteredSubmissions(Array.from(submissionMap.values()));
  };

  // Export to CSV
  const exportToCSV = () => {
    const results: StudentResult[] = filteredSubmissions.map(submission => {
      const quiz = quizzes.find(q => q.id === submission.quiz_id);
      
      // Score is already stored as a percentage
      const percentage = submission.score ?? 0;

      return {
        studentName: submission.student_name || 'Unknown',
        studentEmail: submission.student_id || 'Unknown',
        quizTitle: submission.quiz_title || 'Unknown',
        subject: quiz?.subject || 'Unknown',
        score: percentage,
        totalMarks: percentage,
        percentage: percentage,
        status: submission.status || 'Unknown',
        submittedAt: submission.submitted_at || '',
        gradedAt: submission.graded_at || undefined,
        timeTaken: undefined // Calculate if needed
      };
    });

    const selectedQuiz = quizzes.find(q => q.id === filterQuiz);
    csvExporter.exportStudentResults(results, selectedQuiz?.title);
  };

  // Export single student result to PDF
  const exportStudentResultPDF = async (submission: SubmissionRow) => {
    try {
      // Get detailed answers for this submission
      const answers = await db.getStudentAnswers(submission.id);
      const quiz = quizzes.find(q => q.id === submission.quiz_id);
      
      if (!quiz) {
        alert('Quiz not found');
        return;
      }

      // Get questions for this quiz
      const questions = await db.getQuestions(submission.quiz_id);

      // Format answers for PDF
      const formattedAnswers = answers.map(answer => {
        const question = questions.find(q => q.id === answer.question_id);
        return {
          questionText: question?.question_text || 'Unknown question',
          studentAnswer: answer.answer_text,
          correctAnswer: question?.correct_answer,
          marks: question?.marks || 0,
          obtainedMarks: answer.marks_obtained || 0,
          isCorrect: answer.is_correct || false
        };
      });

      // Score is already stored as a percentage
      const percentage = submission.score ?? 0;

      const resultData: StudentResultPDF = {
        studentName: submission.student_name || 'Unknown',
        studentEmail: submission.student_id || 'Unknown',
        quizTitle: submission.quiz_title || 'Unknown',
        subject: quiz?.subject || 'Unknown',
        score: percentage,
        totalMarks: percentage,
        percentage: percentage,
        status: submission.status || 'Unknown',
        submittedAt: submission.submitted_at || '',
        gradedAt: submission.graded_at || undefined,
        answers: formattedAnswers
      };

      pdfExporter.exportStudentResult(resultData);
    } catch (error) {
      console.error('Error exporting PDF:', error);
      alert('Error exporting PDF. Please try again.');
    }
  };

  const columns = [
    {
      key: 'student_name',
      header: 'Student Name',
    },
    {
      key: 'quiz_title',
      header: 'Quiz Name',
    },
    {
      key: 'submitted_at',
      header: 'Submission Date',
      render: (value: string) => value ? new Date(value).toLocaleString() : 'In Progress',
    },
    {
      key: 'score',
      header: 'Score',
      render: (value: number | null) => {
        if (value === null) return '-';
        return `${value}%`;
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
    {
      key: 'actions',
      header: 'Actions',
      render: (_: any, row: SubmissionRow) => (
        <div className="flex gap-2">
          <Button
            size="sm"
            onClick={() => exportStudentResultPDF(row)}
            className="flex items-center gap-1"
          >
            <FileText size={16} />
            PDF
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Student Submissions</h1>
        <Button
          onClick={exportToCSV}
          disabled={filteredSubmissions.length === 0}
          className="flex items-center gap-2"
        >
          <FileSpreadsheet size={18} />
          Export CSV
        </Button>
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        <Select
          value={filterQuiz}
          onChange={(e) => setFilterQuiz(e.target.value)}
          options={[
            { value: 'all', label: 'All Quizzes' },
            ...quizzes.map(q => ({ value: q.id, label: q.title })),
          ]}
        />
        <Select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          options={[
            { value: 'all', label: 'All Status' },
            { value: 'in_progress', label: 'In Progress' },
            { value: 'submitted', label: 'Submitted' },
            { value: 'graded', label: 'Graded' },
          ]}
        />
      </div>

      <Table
        columns={columns}
        data={filteredSubmissions}
        onRowClick={(row) => navigate(`/lecturer/submission/${row.id}`)}
        emptyMessage="No submissions yet"
      />
    </div>
  );
}
