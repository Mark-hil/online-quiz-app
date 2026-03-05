/*
  # Add Deadline Field to Quizzes

  ## Overview
  Add optional deadline field to quizzes table for managing quiz availability.

  ## New Columns
  - quizzes.deadline (timestamptz, nullable)
    - Optional deadline for quiz completion
    - When set, students cannot submit after this time

  ## Important Notes
  - This is a backward-compatible change
  - Existing quizzes will have NULL deadline (no deadline)
  - Frontend checks deadline before allowing quiz submission
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quizzes' AND column_name = 'deadline'
  ) THEN
    ALTER TABLE quizzes ADD COLUMN deadline timestamptz;
  END IF;
END $$;
