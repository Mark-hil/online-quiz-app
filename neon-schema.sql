-- Neon Database Schema for Quiz Management System
-- Run this in your Neon database SQL editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create profiles table with authentication fields
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  email text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  name text NOT NULL,
  index_number text UNIQUE,  -- Added for student identification
  role text NOT NULL CHECK (role IN ('lecturer', 'student')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add deadline column to quizzes table if it doesn't exist
ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS deadline timestamptz;

-- Add index_number column to profiles table if it doesn't exist
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS index_number text UNIQUE;

-- Create quizzes table
CREATE TABLE IF NOT EXISTS quizzes (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  lecturer_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text DEFAULT '',
  subject text DEFAULT '',
  duration_minutes integer NOT NULL DEFAULT 60,
  total_marks integer NOT NULL DEFAULT 100,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  deadline timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create questions table
CREATE TABLE IF NOT EXISTS questions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  quiz_id uuid REFERENCES quizzes(id) ON DELETE CASCADE,
  lecturer_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  question_text text NOT NULL,
  question_type text NOT NULL CHECK (question_type IN ('mcq', 'true_false', 'essay')),
  options jsonb DEFAULT '[]'::jsonb,
  correct_answer text DEFAULT '',
  marks integer NOT NULL DEFAULT 1,
  created_at timestamptz DEFAULT now()
);

-- Create quiz_attempts table
CREATE TABLE IF NOT EXISTS quiz_attempts (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  quiz_id uuid NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  started_at timestamptz DEFAULT now(),
  submitted_at timestamptz,
  score numeric,
  status text NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'submitted', 'graded')),
  created_at timestamptz DEFAULT now()
);

-- Create student_answers table
CREATE TABLE IF NOT EXISTS student_answers (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  attempt_id uuid NOT NULL REFERENCES quiz_attempts(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  answer_text text NOT NULL,
  is_correct boolean,
  marks_obtained numeric,
  lecturer_comment text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE quiz_attempts ADD COLUMN graded_at timestamptz;

-- Add randomization and anti-cheating columns to quizzes table
ALTER TABLE quizzes ADD COLUMN randomize_questions boolean DEFAULT false;
ALTER TABLE quizzes ADD COLUMN randomize_options boolean DEFAULT false;
ALTER TABLE quizzes ADD COLUMN show_results_immediately boolean DEFAULT true;
ALTER TABLE quizzes ADD COLUMN allow_review boolean DEFAULT true;

-- Add anti-cheating columns to quiz_attempts table
ALTER TABLE quiz_attempts ADD COLUMN tab_switches integer DEFAULT 0;
ALTER TABLE quiz_attempts ADD COLUMN time_paused integer DEFAULT 0;
ALTER TABLE quiz_attempts ADD COLUMN suspicious_activity jsonb DEFAULT '{}'::jsonb;
ALTER TABLE quiz_attempts ADD COLUMN ip_address text;
ALTER TABLE quiz_attempts ADD COLUMN user_agent text;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_quizzes_lecturer_id ON quizzes(lecturer_id);
CREATE INDEX IF NOT EXISTS idx_quizzes_status ON quizzes(status);
CREATE INDEX IF NOT EXISTS idx_questions_quiz_id ON questions(quiz_id);
CREATE INDEX IF NOT EXISTS idx_questions_lecturer_id ON questions(lecturer_id);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_quiz_id ON quiz_attempts(quiz_id);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_student_id ON quiz_attempts(student_id);
CREATE INDEX IF NOT EXISTS idx_student_answers_attempt_id ON student_answers(attempt_id);
CREATE INDEX IF NOT EXISTS idx_student_answers_question_id ON student_answers(question_id);
