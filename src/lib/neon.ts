import { neon } from '@neondatabase/serverless';

const neonUrl = import.meta.env.VITE_NEON_DATABASE_URL;

if (!neonUrl) {
  throw new Error('Missing Neon database URL');
}

export const sql = neon(neonUrl);

// Re-export the same interfaces for consistency
export interface Profile {
  id: string;
  name: string;
  role: 'lecturer' | 'student';
  created_at: string;
}

export interface Quiz {
  id: string;
  lecturer_id: string;
  title: string;
  description: string;
  subject: string;
  duration_minutes: number;
  total_marks: number;
  status: 'draft' | 'published';
  created_at: string;
  updated_at: string;
}

export interface Question {
  id: string;
  quiz_id: string | null;
  lecturer_id: string;
  question_text: string;
  question_type: 'mcq' | 'true_false' | 'essay';
  options: any;
  correct_answer: string;
  marks: number;
  created_at: string;
}

export interface QuizAttempt {
  id: string;
  quiz_id: string;
  student_id: string;
  started_at: string;
  submitted_at: string | null;
  score: number | null;
  status: 'in_progress' | 'submitted' | 'graded';
  created_at: string;
}

export interface StudentAnswer {
  id: string;
  attempt_id: string;
  question_id: string;
  answer_text: string;
  is_correct: boolean | null;
  marks_obtained: number | null;
  lecturer_comment: string;
  created_at: string;
}
