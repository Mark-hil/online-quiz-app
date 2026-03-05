/*
  # Quiz Management System Database Schema

  ## Overview
  Complete database schema for a quiz management system with lecturer and student roles.

  ## New Tables

  ### 1. profiles
  - `id` (uuid, primary key, references auth.users)
  - `name` (text, user's full name)
  - `role` (text, either 'lecturer' or 'student')
  - `created_at` (timestamptz, auto-generated)
  
  ### 2. quizzes
  - `id` (uuid, primary key)
  - `lecturer_id` (uuid, references profiles)
  - `title` (text, quiz title)
  - `description` (text, quiz description)
  - `subject` (text, subject/topic)
  - `duration_minutes` (integer, time allowed)
  - `total_marks` (integer, maximum marks)
  - `status` (text, 'draft' or 'published')
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### 3. questions
  - `id` (uuid, primary key)
  - `quiz_id` (uuid, references quizzes, nullable for question bank)
  - `lecturer_id` (uuid, references profiles)
  - `question_text` (text, the question)
  - `question_type` (text, 'mcq', 'true_false', or 'essay')
  - `options` (jsonb, stores MCQ options)
  - `correct_answer` (text, correct answer)
  - `marks` (integer, marks for this question)
  - `created_at` (timestamptz)

  ### 4. quiz_attempts
  - `id` (uuid, primary key)
  - `quiz_id` (uuid, references quizzes)
  - `student_id` (uuid, references profiles)
  - `started_at` (timestamptz)
  - `submitted_at` (timestamptz, nullable)
  - `score` (numeric, nullable)
  - `status` (text, 'in_progress', 'submitted', or 'graded')
  - `created_at` (timestamptz)

  ### 5. student_answers
  - `id` (uuid, primary key)
  - `attempt_id` (uuid, references quiz_attempts)
  - `question_id` (uuid, references questions)
  - `answer_text` (text, student's answer)
  - `is_correct` (boolean, nullable)
  - `marks_obtained` (numeric, nullable)
  - `lecturer_comment` (text, nullable)
  - `created_at` (timestamptz)

  ## Security
  - Enable RLS on all tables
  - Lecturers can only manage their own quizzes and questions
  - Students can only view published quizzes and their own attempts
  - Students cannot see correct answers until graded
*/

-- Create profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  role text NOT NULL CHECK (role IN ('lecturer', 'student')),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Create quizzes table
CREATE TABLE IF NOT EXISTS quizzes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lecturer_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text DEFAULT '',
  subject text DEFAULT '',
  duration_minutes integer NOT NULL DEFAULT 60,
  total_marks integer NOT NULL DEFAULT 100,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE quizzes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lecturers can view own quizzes"
  ON quizzes FOR SELECT
  TO authenticated
  USING (
    lecturer_id = auth.uid() OR
    (status = 'published' AND EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'student'
    ))
  );

CREATE POLICY "Lecturers can create quizzes"
  ON quizzes FOR INSERT
  TO authenticated
  WITH CHECK (
    lecturer_id = auth.uid() AND
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'lecturer')
  );

CREATE POLICY "Lecturers can update own quizzes"
  ON quizzes FOR UPDATE
  TO authenticated
  USING (lecturer_id = auth.uid())
  WITH CHECK (lecturer_id = auth.uid());

CREATE POLICY "Lecturers can delete own quizzes"
  ON quizzes FOR DELETE
  TO authenticated
  USING (lecturer_id = auth.uid());

-- Create questions table
CREATE TABLE IF NOT EXISTS questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id uuid REFERENCES quizzes(id) ON DELETE CASCADE,
  lecturer_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  question_text text NOT NULL,
  question_type text NOT NULL CHECK (question_type IN ('mcq', 'true_false', 'essay')),
  options jsonb DEFAULT '[]'::jsonb,
  correct_answer text DEFAULT '',
  marks integer NOT NULL DEFAULT 1,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lecturers can view own questions"
  ON questions FOR SELECT
  TO authenticated
  USING (
    lecturer_id = auth.uid() OR
    (quiz_id IN (SELECT id FROM quizzes WHERE status = 'published') AND
     EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'student'))
  );

CREATE POLICY "Lecturers can create questions"
  ON questions FOR INSERT
  TO authenticated
  WITH CHECK (
    lecturer_id = auth.uid() AND
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'lecturer')
  );

CREATE POLICY "Lecturers can update own questions"
  ON questions FOR UPDATE
  TO authenticated
  USING (lecturer_id = auth.uid())
  WITH CHECK (lecturer_id = auth.uid());

CREATE POLICY "Lecturers can delete own questions"
  ON questions FOR DELETE
  TO authenticated
  USING (lecturer_id = auth.uid());

-- Create quiz_attempts table
CREATE TABLE IF NOT EXISTS quiz_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id uuid NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  started_at timestamptz DEFAULT now(),
  submitted_at timestamptz,
  score numeric,
  status text NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'submitted', 'graded')),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE quiz_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students can view own attempts"
  ON quiz_attempts FOR SELECT
  TO authenticated
  USING (
    student_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM quizzes WHERE id = quiz_id AND lecturer_id = auth.uid()
    )
  );

CREATE POLICY "Students can create attempts"
  ON quiz_attempts FOR INSERT
  TO authenticated
  WITH CHECK (
    student_id = auth.uid() AND
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'student')
  );

CREATE POLICY "Students can update own attempts"
  ON quiz_attempts FOR UPDATE
  TO authenticated
  USING (student_id = auth.uid())
  WITH CHECK (student_id = auth.uid());

-- Create student_answers table
CREATE TABLE IF NOT EXISTS student_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id uuid NOT NULL REFERENCES quiz_attempts(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  answer_text text DEFAULT '',
  is_correct boolean,
  marks_obtained numeric,
  lecturer_comment text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE student_answers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students can view own answers"
  ON student_answers FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM quiz_attempts WHERE id = attempt_id AND student_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM quiz_attempts qa
      JOIN quizzes q ON qa.quiz_id = q.id
      WHERE qa.id = attempt_id AND q.lecturer_id = auth.uid()
    )
  );

CREATE POLICY "Students can create answers"
  ON student_answers FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM quiz_attempts WHERE id = attempt_id AND student_id = auth.uid()
    )
  );

CREATE POLICY "Students can update own answers"
  ON student_answers FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM quiz_attempts WHERE id = attempt_id AND student_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM quiz_attempts WHERE id = attempt_id AND student_id = auth.uid()
    )
  );

CREATE POLICY "Lecturers can update student answers for grading"
  ON student_answers FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM quiz_attempts qa
      JOIN quizzes q ON qa.quiz_id = q.id
      WHERE qa.id = attempt_id AND q.lecturer_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM quiz_attempts qa
      JOIN quizzes q ON qa.quiz_id = q.id
      WHERE qa.id = attempt_id AND q.lecturer_id = auth.uid()
    )
  );

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_quizzes_lecturer ON quizzes(lecturer_id);
CREATE INDEX IF NOT EXISTS idx_quizzes_status ON quizzes(status);
CREATE INDEX IF NOT EXISTS idx_questions_quiz ON questions(quiz_id);
CREATE INDEX IF NOT EXISTS idx_questions_lecturer ON questions(lecturer_id);
CREATE INDEX IF NOT EXISTS idx_attempts_quiz ON quiz_attempts(quiz_id);
CREATE INDEX IF NOT EXISTS idx_attempts_student ON quiz_attempts(student_id);
CREATE INDEX IF NOT EXISTS idx_answers_attempt ON student_answers(attempt_id);
CREATE INDEX IF NOT EXISTS idx_answers_question ON student_answers(question_id);