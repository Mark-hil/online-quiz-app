/*
  # Add Lecturer Access to Student Profiles

  ## Overview
  Add RLS policy to allow lecturers to view student profiles when grading submissions.

  ## Security Changes
  - New SELECT policy on profiles table
  - Lecturers can view profiles of students who have submitted to their quizzes
  - This enables proper display of student names in submissions and grading views
*/

CREATE POLICY "Lecturers can view student profiles for grading"
  ON profiles FOR SELECT
  TO authenticated
  USING (
    auth.uid() = id OR
    (role = 'student' AND EXISTS (
      SELECT 1 FROM quiz_attempts qa
      JOIN quizzes q ON qa.quiz_id = q.id
      WHERE qa.student_id = profiles.id AND q.lecturer_id = auth.uid()
    ))
  );
