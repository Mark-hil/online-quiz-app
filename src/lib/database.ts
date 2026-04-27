import { neon } from '@neondatabase/serverless';

const neonUrl = import.meta.env.VITE_NEON_DATABASE_URL;

if (!neonUrl) {
  throw new Error('Missing Neon database URL. Please set VITE_NEON_DATABASE_URL in your .env file');
}

export const sql = neon(neonUrl, {
  fetchOptions: {
    retries: 5,
    retryDelay: 2000,
    timeout: 30000,
  },
  connectionTimeoutMillis: 15000,
});

// Test database connection
export async function testConnection() {
  try {
    const result = await sql`SELECT 1 as test`;
    console.log('✓ Database connection successful');
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    return false;
  }
}

// Database migration function with retry logic
export async function runMigrations() {
  const maxRetries = 3;
  const retryDelay = 2000;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Starting database migrations (attempt ${attempt}/${maxRetries})...`);
      
      // Test connection first
      const isConnected = await testConnection();
      if (!isConnected) {
        throw new Error('Database connection test failed');
      }
    
    // 1. Enable UUID extension
    await sql`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`;
    console.log('✓ UUID extension enabled');
    
    // 2. Create profiles table with all required columns
    await sql`
      CREATE TABLE IF NOT EXISTS profiles (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        email text UNIQUE NOT NULL,
        password_hash text NOT NULL,
        name text NOT NULL,
        index_number text UNIQUE,
        role text NOT NULL CHECK (role IN ('lecturer', 'student', 'moderator', 'admin', 'super_admin')),
        created_at timestamptz DEFAULT now(),
        updated_at timestamptz DEFAULT now()
      )
    `;
    console.log('✓ Profiles table created/verified');
    
    // 3. Add index_number column if it doesn't exist (for existing databases)
    await sql`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS index_number text UNIQUE`;
    console.log('✓ Index number column added/verified');
    
    // 5. Create audit logs table
    await sql`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id uuid REFERENCES profiles(id),
        action text NOT NULL,
        entity_type text,
        entity_id text,
        details jsonb,
        ip_address text,
        user_agent text,
        created_at timestamptz DEFAULT now()
      )
    `;
    console.log('✓ Audit logs table created/verified');

    // 6. Create login attempts table
    await sql`
      CREATE TABLE IF NOT EXISTS login_attempts (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        email text NOT NULL,
        success boolean NOT NULL,
        ip_address text,
        user_agent text,
        error_message text,
        created_at timestamptz DEFAULT now()
      )
    `;
    console.log('✓ Login attempts table created/verified');

    // 7. Create system settings table
    await sql`
      CREATE TABLE IF NOT EXISTS system_settings (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        setting_key text UNIQUE NOT NULL,
        setting_value jsonb NOT NULL,
        description text,
        updated_by uuid REFERENCES profiles(id),
        updated_at timestamptz DEFAULT now()
      )
    `;
    console.log('✓ System settings table created/verified');

    // 8. Create system health table
    await sql`
      CREATE TABLE IF NOT EXISTS system_health (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        metric_name text NOT NULL,
        metric_value text NOT NULL,
        status text NOT NULL,
        checked_at timestamptz DEFAULT now()
      )
    `;
    console.log('✓ System health table created/verified');

    // 4. Update role check constraint to include moderator and admin
    try {
      // Check if the constraint exists
      const constraints = await sql`
        SELECT conname 
        FROM pg_constraint 
        WHERE conrelid = 'profiles'::regclass 
        AND contype = 'c' 
        AND conname = 'profiles_role_check'
      `;
      
      if (constraints.length > 0) {
        console.log('Role constraint exists, checking if it needs update...');
        
        // First, update any existing invalid roles to 'lecturer' as a fallback
        await sql`
          UPDATE profiles
          SET role = 'lecturer'
          WHERE role NOT IN ('lecturer', 'student', 'moderator', 'admin', 'super_admin')
        `;

        // Try to drop and recreate the constraint
        try {
          await sql`ALTER TABLE profiles DROP CONSTRAINT profiles_role_check`;
          console.log('✓ Old role constraint dropped');
        } catch (dropError) {
          console.log('Could not drop role constraint, continuing...');
        }
      }

      // Create the new constraint with all roles
      try {
        await sql`ALTER TABLE profiles ADD CONSTRAINT profiles_role_check CHECK (role IN ('lecturer', 'student', 'moderator', 'admin', 'super_admin'))`;
        console.log('✓ New role constraint added successfully');
      } catch (addError) {
        console.log('Could not add role constraint, using application-level validation');
      }
      
    } catch (error) {
      console.log('Role constraint update failed, using application-level validation:', error);
      console.log('⚠️  Using application-level validation for roles instead of database constraint');
    }
    
    // 5. Update quiz status check constraint to include new statuses
    try {
      // Check if the constraint exists
      const quizConstraints = await sql`
        SELECT conname 
        FROM pg_constraint 
        WHERE conrelid = 'quizzes'::regclass 
        AND contype = 'c' 
        AND conname = 'quizzes_status_check'
      `;
      
      if (quizConstraints.length > 0) {
        console.log('Quiz status constraint exists, checking if it needs update...');
        
        // First, update any existing invalid statuses to 'draft' as a fallback
        await sql`
          UPDATE quizzes 
          SET status = 'draft' 
          WHERE status NOT IN ('draft', 'pending_approval', 'approved', 'rejected', 'published')
        `;
        
        // Try to drop and recreate the constraint
        try {
          await sql`ALTER TABLE quizzes DROP CONSTRAINT quizzes_status_check`;
          console.log('✓ Old quiz status constraint dropped');
        } catch (dropError) {
          console.log('Could not drop quiz status constraint, continuing...');
        }
      }
      
      // Create the new constraint with all statuses
      try {
        await sql`ALTER TABLE quizzes ADD CONSTRAINT quizzes_status_check CHECK (status IN ('draft', 'pending_approval', 'approved', 'rejected', 'published'))`;
        console.log('✓ New quiz status constraint added successfully');
      } catch (addError) {
        console.log('Could not add quiz status constraint, using application-level validation');
      }
      
    } catch (error) {
      console.log('Quiz status constraint update failed, using application-level validation:', error);
      console.log('⚠️  Using application-level validation for quiz statuses instead of database constraint');
    }
    
    // 6. Create quizzes table
    await sql`
      CREATE TABLE IF NOT EXISTS quizzes (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        lecturer_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
        title text NOT NULL,
        description text DEFAULT '',
        subject text DEFAULT '',
        duration_minutes integer NOT NULL DEFAULT 60,
        total_marks integer NOT NULL DEFAULT 100,
        status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending_approval', 'approved', 'rejected', 'published')),
        deadline timestamptz,
        created_at timestamptz DEFAULT now(),
        updated_at timestamptz DEFAULT now()
      )
    `;
    console.log('✓ Quizzes table created/verified');
    
    // 7. Add deadline column to quizzes table if it doesn't exist
    await sql`ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS deadline timestamptz`;
    console.log('✓ Deadline column added/verified');
    
    // 8. Create questions table
    await sql`
      CREATE TABLE IF NOT EXISTS questions (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        quiz_id uuid NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
        question_text text NOT NULL,
        question_type text NOT NULL CHECK (question_type IN ('mcq', 'true_false', 'short_answer')),
        options text, -- JSON string for MCQ options
        correct_answer text,
        marks integer NOT NULL DEFAULT 1,
        created_at timestamptz DEFAULT now(),
        updated_at timestamptz DEFAULT now()
      )
    `;
    console.log('✓ Questions table created/verified');
    
    // 9. Create quiz_attempts table with cheating tracking
    await sql`
      CREATE TABLE IF NOT EXISTS quiz_attempts (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        quiz_id uuid NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
        student_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
        status text NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'submitted', 'graded')),
        score integer, -- Percentage score
        started_at timestamptz DEFAULT now(),
        submitted_at timestamptz,
        graded_at timestamptz,
        cheated boolean DEFAULT false,
        cheating_reason text,
        tab_switch_count integer DEFAULT 0,
        copy_attempts integer DEFAULT 0,
        right_click_count integer DEFAULT 0,
        created_at timestamptz DEFAULT now(),
        updated_at timestamptz DEFAULT now()
      )
    `;
    console.log('✓ Quiz attempts table created/verified');
    
    // 10. Add cheating columns to quiz_attempts if they don't exist
    await sql`ALTER TABLE quiz_attempts ADD COLUMN IF NOT EXISTS cheated boolean DEFAULT false`;
    await sql`ALTER TABLE quiz_attempts ADD COLUMN IF NOT EXISTS cheating_reason text`;
    await sql`ALTER TABLE quiz_attempts ADD COLUMN IF NOT EXISTS tab_switch_count integer DEFAULT 0`;
    await sql`ALTER TABLE quiz_attempts ADD COLUMN IF NOT EXISTS copy_attempts integer DEFAULT 0`;
    await sql`ALTER TABLE quiz_attempts ADD COLUMN IF NOT EXISTS right_click_count integer DEFAULT 0`;
    console.log('✓ Cheating tracking columns added/verified');
    
    // 11. Create student_answers table
    await sql`
      CREATE TABLE IF NOT EXISTS student_answers (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        attempt_id uuid NOT NULL REFERENCES quiz_attempts(id) ON DELETE CASCADE,
        question_id uuid NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
        answer_text text,
        is_correct boolean,
        marks_obtained integer DEFAULT 0,
        created_at timestamptz DEFAULT now(),
        updated_at timestamptz DEFAULT now(),
        UNIQUE(attempt_id, question_id)
      )
    `;
    console.log('✓ Student answers table created/verified');
    
    // 12. Create quiz_moderations table for approval workflow
    await sql`
      CREATE TABLE IF NOT EXISTS quiz_moderations (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        quiz_id uuid NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
        moderator_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
        status text NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')),
        notes text,
        reviewed_at timestamptz DEFAULT now(),
        created_at timestamptz DEFAULT now(),
        updated_at timestamptz DEFAULT now(),
        UNIQUE(quiz_id, moderator_id)
      )
    `;
    console.log('✓ Quiz moderations table created/verified');
    
    // 13. Add moderator_id and admin_id columns to quizzes table if they don't exist
    await sql`ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS moderator_id uuid REFERENCES profiles(id)`;
    await sql`ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS admin_id uuid REFERENCES profiles(id)`;
    await sql`ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS reviewed_at timestamptz`;
    await sql`ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS published_at timestamptz`;
    console.log('✓ Workflow columns added/verified');
    
    console.log('🎉 Database migrations completed successfully!');
      return; // Success, exit the retry loop
      
    } catch (error) {
      console.error(`❌ Database migration failed (attempt ${attempt}/${maxRetries}):`, error);
      
      if (attempt === maxRetries) {
        console.error('❌ All migration attempts failed. Please check your database connection.');
        throw error; // Re-throw to let the calling code handle it
      }
      
      console.log(`⏳ Retrying in ${retryDelay / 1000} seconds...`);
      await new Promise(resolve => setTimeout(resolve, retryDelay));
    }
  }
}

// Database interfaces
export interface Profile {
  id: string;
  email: string;
  name: string;
  index_number?: string;
  role: 'lecturer' | 'student' | 'moderator' | 'admin';
  created_at: string;
  updated_at: string;
}

export interface Quiz {
  id: string;
  lecturer_id: string;
  title: string;
  description: string;
  subject: string;
  duration_minutes: number;
  total_marks: number;
  status: 'draft' | 'pending_approval' | 'approved' | 'rejected' | 'published';
  deadline?: string;
  moderator_id?: string;
  admin_id?: string;
  reviewed_at?: string;
  published_at?: string;
  randomize_questions?: boolean;
  randomize_options?: boolean;
  show_results_immediately?: boolean;
  allow_review?: boolean;
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
  graded_at: string | null;
  tab_switches: number;
  time_paused: number;
  suspicious_activity: any;
  ip_address?: string;
  user_agent?: string;
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

export interface QuizModeration {
  id: string;
  quiz_id: string;
  moderator_id: string;
  status: 'pending' | 'approved' | 'rejected';
  notes?: string;
  reviewed_at: string;
  created_at: string;
  updated_at: string;
}

// Database functions
export const db = {
  // Profiles
  async getProfile(id: string) {
    try {
      const result = await sql`SELECT * FROM profiles WHERE id = ${id}`;
      return result[0] || null;
    } catch (error) {
      console.error('Database connection error in getProfile:', error);
      // Return a fallback profile to prevent app crash
      return {
        id,
        email: 'unknown@example.com',
        name: 'Unknown User',
        index_number: 'N/A',
        role: 'student',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    }
  },

  async getProfiles() {
    return await sql`SELECT * FROM profiles ORDER BY created_at DESC`;
  },

  // Password Reset
  async createPasswordResetToken(email: string, token: string, expiresAt: Date) {
    const result = await sql`
      INSERT INTO password_reset_tokens (email, token, expires_at, created_at)
      VALUES (${email}, ${token}, ${expiresAt}, NOW())
      RETURNING *
    `;
    return result[0];
  },

  async getPasswordResetToken(token: string) {
    const result = await sql`
      SELECT * FROM password_reset_tokens 
      WHERE token = ${token} AND expires_at > NOW()
      ORDER BY created_at DESC
      LIMIT 1
    `;
    return result[0] || null;
  },

  async deletePasswordResetToken(token: string) {
    await sql`DELETE FROM password_reset_tokens WHERE token = ${token}`;
  },

  async updatePassword(email: string, hashedPassword: string) {
    const result = await sql`
      UPDATE profiles 
      SET password = ${hashedPassword}, updated_at = NOW()
      WHERE email = ${email}
      RETURNING *
    `;
    return result[0];
  },

  async createProfile(id: string, name: string, role: 'lecturer' | 'student') {
    const result = await sql`
      INSERT INTO profiles (id, name, role)
      VALUES (${id}, ${name}, ${role})
      RETURNING *
    `;
    return result[0];
  },

  // Quizzes
  async getQuizzes(lecturerId?: string) {
    try {
      if (lecturerId) {
        return await sql`SELECT * FROM quizzes WHERE lecturer_id = ${lecturerId} ORDER BY created_at DESC`;
      }
      return await sql`
        SELECT q.*, 
          p.name as lecturer_name,
          mp.name as moderator_name,
          a.name as admin_name
        FROM quizzes q
        JOIN profiles p ON q.lecturer_id = p.id
        LEFT JOIN profiles mp ON q.moderator_id = mp.id
        LEFT JOIN profiles a ON q.admin_id = a.id
        WHERE q.status = 'published'
        ORDER BY q.published_at DESC
      `;
    } catch (error) {
      console.error('Database connection error in getQuizzes:', error);
      // Return empty array to prevent app crash
      return [];
    }
  },

  async getQuiz(id: string) {
    const result = await sql`SELECT * FROM quizzes WHERE id = ${id}`;
    return result[0] || null;
  },

  async createQuiz(quiz: any) {
    const result = await sql`
      INSERT INTO quizzes (lecturer_id, title, description, subject, duration_minutes, total_marks, status, deadline)
      VALUES (${quiz.lecturer_id}, ${quiz.title}, ${quiz.description}, ${quiz.subject}, ${quiz.duration_minutes}, ${quiz.total_marks}, ${quiz.status}, ${quiz.deadline || null})
      RETURNING *
    `;
    return result[0];
  },

  // Questions
  async getQuestions(quizId?: string, lecturerId?: string) {
    if (quizId) {
      return await sql`SELECT * FROM questions WHERE quiz_id = ${quizId} ORDER BY created_at`;
    }
    if (lecturerId) {
      return await sql`SELECT * FROM questions WHERE lecturer_id = ${lecturerId} ORDER BY created_at`;
    }
    return await sql`SELECT * FROM questions ORDER BY created_at`;
  },

  async createQuestion(question: any) {
    const result = await sql`
      INSERT INTO questions (quiz_id, lecturer_id, question_text, question_type, options, correct_answer, marks)
      VALUES (${question.quiz_id}, ${question.lecturer_id}, ${question.question_text}, ${question.question_type}, ${JSON.stringify(question.options)}, ${question.correct_answer}, ${question.marks})
      RETURNING *
    `;
    return result[0];
  },

  // Quiz Attempts
  async createQuizAttempt(attempt: any) {
    const result = await sql`
      INSERT INTO quiz_attempts (quiz_id, student_id, started_at, status)
      VALUES (${attempt.quiz_id}, ${attempt.student_id}, ${attempt.started_at}, ${attempt.status})
      RETURNING *
    `;
    return result[0];
  },

  async updateQuizAttempt(id: string, updates: any) {
    // Build the update query dynamically based on provided fields
    const fields: string[] = [];
    const values: any[] = [id];

    if (updates.submitted_at !== undefined) {
      fields.push(`submitted_at = $${values.length + 1}`);
      values.push(updates.submitted_at);
    }
    
    if (updates.status !== undefined) {
      fields.push(`status = $${values.length + 1}`);
      values.push(updates.status);
    }
    
    if (updates.score !== undefined) {
      fields.push(`score = $${values.length + 1}`);
      values.push(updates.score);
    }
    
    if (updates.graded_at !== undefined) {
      fields.push(`graded_at = $${values.length + 1}`);
      values.push(updates.graded_at);
    }
    
    // Add cheating tracking fields
    if (updates.cheated !== undefined) {
      fields.push(`cheated = $${values.length + 1}`);
      values.push(updates.cheated);
    }
    
    if (updates.cheating_reason !== undefined) {
      fields.push(`cheating_reason = $${values.length + 1}`);
      values.push(updates.cheating_reason);
    }
    
    if (updates.tab_switch_count !== undefined) {
      fields.push(`tab_switch_count = $${values.length + 1}`);
      values.push(updates.tab_switch_count);
    }
    
    if (updates.copy_attempts !== undefined) {
      fields.push(`copy_attempts = $${values.length + 1}`);
      values.push(updates.copy_attempts);
    }
    
    if (updates.right_click_count !== undefined) {
      fields.push(`right_click_count = $${values.length + 1}`);
      values.push(updates.right_click_count);
    }

    if (fields.length === 0) {
      return null;
    }

    const query = `
      UPDATE quiz_attempts 
      SET ${fields.join(', ')}
      WHERE id = $1
      RETURNING *
    `;
    
    console.log('updateQuizAttempt query:', query);
    console.log('updateQuizAttempt values:', values);
    
    try {
      const result = await sql(query, values);
      console.log('updateQuizAttempt result:', result[0]);
      return result[0];
    } catch (error) {
      console.error('Error updating quiz attempt:', error);
      throw error;
    }
  },

  async getQuizAttempts(quizId?: string, studentId?: string) {
    if (quizId && studentId) {
      return await sql`SELECT * FROM quiz_attempts WHERE quiz_id = ${quizId} AND student_id = ${studentId}`;
    } else if (quizId) {
      return await sql`SELECT * FROM quiz_attempts WHERE quiz_id = ${quizId}`;
    } else if (studentId) {
      return await sql`SELECT * FROM quiz_attempts WHERE student_id = ${studentId}`;
    }
    // Security: Never return all quiz attempts without proper filtering
    // This prevents accidental data leakage across lecturers
    throw new Error('Security: Cannot retrieve all quiz attempts without proper filtering. Please specify quizId or studentId.');
  },

  // Lecturer-specific function to get quiz attempts for their own quizzes only
  async getLecturerQuizAttempts(lecturerId: string, quizId?: string) {
    if (quizId) {
      // Verify the quiz belongs to this lecturer before getting attempts
      const quizCheck = await sql`
        SELECT id FROM quizzes 
        WHERE id = ${quizId} AND lecturer_id = ${lecturerId}
      `;
      
      if (quizCheck.length === 0) {
        throw new Error('Security: Quiz does not belong to this lecturer');
      }
      
      return await sql`SELECT * FROM quiz_attempts WHERE quiz_id = ${quizId}`;
    } else {
      // Get attempts for all quizzes belonging to this lecturer
      return await sql`
        SELECT qa.* FROM quiz_attempts qa
        JOIN quizzes q ON qa.quiz_id = q.id
        WHERE q.lecturer_id = ${lecturerId}
        ORDER BY qa.started_at DESC
      `;
    }
  },

  // Student Answers
  async createStudentAnswer(answer: any) {
    const result = await sql`
      INSERT INTO student_answers (attempt_id, question_id, answer_text, is_correct, marks_obtained, lecturer_comment)
      VALUES (${answer.attempt_id}, ${answer.question_id}, ${answer.answer_text}, ${answer.is_correct}, ${answer.marks_obtained}, ${answer.lecturer_comment})
      RETURNING *
    `;
    return result[0];
  },

  async updateStudentAnswer(id: string, updates: any) {
    // Handle specific update cases for student answers
    if (updates.answer_text) {
      const result = await sql`
        UPDATE student_answers 
        SET answer_text = ${updates.answer_text}
        WHERE id = ${id}
        RETURNING *
      `;
      return result[0];
    }
    
    if (updates.is_correct !== undefined && updates.marks_obtained !== undefined && updates.lecturer_comment !== undefined) {
      const result = await sql`
        UPDATE student_answers 
        SET is_correct = ${updates.is_correct}, marks_obtained = ${updates.marks_obtained}, lecturer_comment = ${updates.lecturer_comment}
        WHERE id = ${id}
        RETURNING *
      `;
      return result[0];
    }
    
    if (updates.is_correct !== undefined && updates.marks_obtained !== undefined) {
      const result = await sql`
        UPDATE student_answers 
        SET is_correct = ${updates.is_correct}, marks_obtained = ${updates.marks_obtained}
        WHERE id = ${id}
        RETURNING *
      `;
      return result[0];
    }
    
    // Fallback
    const result = await sql`
      UPDATE student_answers 
      SET answer_text = ${updates.answer_text || ''}
      WHERE id = ${id}
      RETURNING *
    `;
    return result[0];
  },

  async getStudentAnswers(attemptId?: string, questionId?: string) {
    if (attemptId && questionId) {
      return await sql`SELECT * FROM student_answers WHERE attempt_id = ${attemptId} AND question_id = ${questionId}`;
    } else if (attemptId) {
      return await sql`SELECT * FROM student_answers WHERE attempt_id = ${attemptId}`;
    } else if (questionId) {
      return await sql`SELECT * FROM student_answers WHERE question_id = ${questionId}`;
    }
    return await sql`SELECT * FROM student_answers`;
  },

  // Delete functions
  async deleteQuiz(id: string) {
    await sql`DELETE FROM quizzes WHERE id = ${id}`;
  },

  async deleteQuestion(id: string) {
    await sql`DELETE FROM questions WHERE id = ${id}`;
  },

  async updateQuiz(id: string, updates: any) {
    const fields = Object.keys(updates);
    const values = Object.values(updates);
    
    // Build the SET clause with proper parameter placeholders
    const setClause = fields.map((field, index) => `${field} = $${index + 2}`).join(', ');
    
    // Construct the full query with all parameters
    const query = `
      UPDATE quizzes 
      SET ${setClause}, updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;
    
    try {
      const result = await sql(query, [id, ...values]);
      return result[0];
    } catch (error) {
      console.error('Update quiz error:', error);
      throw error;
    }
  },

  // Moderation workflow functions
  async submitForApproval(quizId: string) {
    const result = await sql`
      UPDATE quizzes 
      SET status = 'pending_approval', updated_at = NOW()
      WHERE id = ${quizId}
      RETURNING *
    `;
    return result[0];
  },

  async getPendingQuizzes() {
    return await sql`
      SELECT q.*, p.name as lecturer_name, p.email as lecturer_email
      FROM quizzes q
      JOIN profiles p ON q.lecturer_id = p.id
      WHERE q.status = 'pending_approval'
      ORDER BY q.created_at DESC
    `;
  },

  async getApprovedQuizzes() {
    return await sql`
      SELECT q.*, 
        p.name as lecturer_name, 
        p.email as lecturer_email,
        mp.name as moderator_name,
        mp.email as moderator_email
      FROM quizzes q
      JOIN profiles p ON q.lecturer_id = p.id
      LEFT JOIN profiles mp ON q.moderator_id = mp.id
      WHERE q.status = 'approved'
      ORDER BY q.reviewed_at DESC NULLS LAST
    `;
  },

  // Debug function to check all quiz statuses
  async getAllQuizzesDebug() {
    return await sql`
      SELECT q.*, p.name as lecturer_name, p.email as lecturer_email
      FROM quizzes q
      JOIN profiles p ON q.lecturer_id = p.id
      ORDER BY q.created_at DESC
    `;
  },

  // Function to fix quiz statuses
  async fixQuizStatuses() {
    try {
      console.log('🔧 Fixing quiz statuses...');
      
      // Check current statuses first
      const currentStatuses = await sql`
        SELECT status, COUNT(*) as count 
        FROM quizzes 
        GROUP BY status
      `;
      console.log('Current quiz statuses:', currentStatuses);
      
      // Update any old status values to new ones
      const result1 = await sql`
        UPDATE quizzes 
        SET status = 'pending_approval' 
        WHERE status = 'pending'
        RETURNING id, status
      `;
      console.log('Updated pending → pending_approval:', result1);
      
      const result2 = await sql`
        UPDATE quizzes 
        SET status = 'draft' 
        WHERE status NOT IN ('draft', 'pending_approval', 'approved', 'rejected', 'published')
        RETURNING id, status
      `;
      console.log('Updated invalid → draft:', result2);
      
      // For testing: Set a few quizzes to pending_approval and approved
      const testResult1 = await sql`
        UPDATE quizzes 
        SET status = 'pending_approval' 
        WHERE id IN (
          SELECT id FROM quizzes WHERE status = 'draft' LIMIT 3
        )
        RETURNING id, status
      `;
      console.log('Set 3 quizzes to pending_approval for testing:', testResult1);
      
      const testResult2 = await sql`
        UPDATE quizzes 
        SET status = 'approved', reviewed_at = NOW()
        WHERE id IN (
          SELECT id FROM quizzes WHERE status = 'draft' LIMIT 2
        )
        RETURNING id, status
      `;
      console.log('Set 2 quizzes to approved for testing:', testResult2);
      
      // Check final statuses
      const finalStatuses = await sql`
        SELECT status, COUNT(*) as count 
        FROM quizzes 
        GROUP BY status
      `;
      console.log('Final quiz statuses:', finalStatuses);
      
      console.log('✓ Quiz statuses fixed');
    } catch (error) {
      console.error('Error fixing quiz statuses:', error);
    }
  },

  async moderateQuiz(quizId: string, moderatorId: string, status: 'approved' | 'rejected', notes?: string) {
    const result = await sql`
      INSERT INTO quiz_moderations (quiz_id, moderator_id, status, notes)
      VALUES (${quizId}, ${moderatorId}, ${status}, ${notes || null})
      ON CONFLICT (quiz_id, moderator_id) 
      DO UPDATE SET 
        status = EXCLUDED.status,
        notes = EXCLUDED.notes,
        reviewed_at = NOW(),
        updated_at = NOW()
      RETURNING *
    `;

    // Update quiz status
    await sql`
      UPDATE quizzes 
      SET status = ${status}, 
          moderator_id = ${moderatorId}, 
          reviewed_at = NOW(),
          updated_at = NOW()
      WHERE id = ${quizId}
    `;

    return result[0];
  },

  async getQuizModerations(quizId: string) {
    return await sql`
      SELECT qm.*, p.name as moderator_name, p.email as moderator_email
      FROM quiz_moderations qm
      JOIN profiles p ON qm.moderator_id = p.id
      WHERE qm.quiz_id = ${quizId}
      ORDER BY qm.created_at DESC
    `;
  },

  async publishQuiz(quizId: string, adminId: string) {
    const result = await sql`
      UPDATE quizzes 
      SET status = 'published', 
          admin_id = ${adminId}, 
          published_at = NOW(),
          updated_at = NOW()
      WHERE id = ${quizId} AND status = 'approved'
      RETURNING *
    `;
    return result[0];
  },

  async getPublishedQuizzes() {
    return await sql`
      SELECT q.*, 
             p.name as lecturer_name,
             m.name as moderator_name,
             a.name as admin_name
      FROM quizzes q
      LEFT JOIN profiles p ON q.lecturer_id = p.id
      LEFT JOIN profiles m ON q.moderator_id = m.id
      LEFT JOIN profiles a ON q.admin_id = a.id
      WHERE q.status = 'published'
      ORDER BY q.published_at DESC
    `;
  },

  async getUsersByRole(role: 'lecturer' | 'student' | 'moderator' | 'admin') {
    return await sql`
      SELECT id, name, email, index_number, created_at
      FROM profiles
      WHERE role = ${role}
      ORDER BY created_at DESC
    `;
  },

  async getAllUsers() {
    return await sql`
      SELECT id, name, email, index_number, role, created_at
      FROM profiles
      ORDER BY created_at DESC
    `;
  },

  async updateUserRole(userId: string, newRole: 'lecturer' | 'student' | 'moderator' | 'admin' | 'super_admin') {
    return await sql`
      UPDATE profiles
      SET role = ${newRole}
      WHERE id = ${userId}
      RETURNING id, name, email, role
    `;
  },

  async deleteUser(userId: string) {
    return await sql`
      DELETE FROM profiles
      WHERE id = ${userId}
      RETURNING id
    `;
  },

  // Audit log functions
  async createAuditLog(userId: string, action: string, entityType: string, entityId: string, details: any, ipAddress?: string, userAgent?: string) {
    return await sql`
      INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip_address, user_agent)
      VALUES (${userId}, ${action}, ${entityType}, ${entityId}, ${JSON.stringify(details)}, ${ipAddress || null}, ${userAgent || null})
      RETURNING id
    `;
  },

  async getAuditLogs(limit: number = 100, offset: number = 0) {
    return await sql`
      SELECT al.*, p.name, p.email, p.role
      FROM audit_logs al
      LEFT JOIN profiles p ON al.user_id = p.id
      ORDER BY al.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;
  },

  async getLoginAttempts(limit: number = 100, offset: number = 0) {
    return await sql`
      SELECT * FROM login_attempts
      ORDER BY created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;
  },

  async getFailedLoginAttempts(limit: number = 50) {
    return await sql`
      SELECT * FROM login_attempts
      WHERE success = false
      ORDER BY created_at DESC
      LIMIT ${limit}
    `;
  },

  // System settings functions
  async getSystemSetting(key: string) {
    const result = await sql`
      SELECT setting_value FROM system_settings
      WHERE setting_key = ${key}
    `;
    return result[0]?.setting_value || null;
  },

  async setSystemSetting(key: string, value: any, description?: string, updatedBy?: string) {
    return await sql`
      INSERT INTO system_settings (setting_key, setting_value, description, updated_by)
      VALUES (${key}, ${JSON.stringify(value)}, ${description || null}, ${updatedBy || null})
      ON CONFLICT (setting_key)
      DO UPDATE SET
        setting_value = ${JSON.stringify(value)},
        description = ${description || null},
        updated_by = ${updatedBy || null},
        updated_at = now()
      RETURNING id
    `;
  },

  async getAllSystemSettings() {
    return await sql`
      SELECT ss.*, p.name as updated_by_name
      FROM system_settings ss
      LEFT JOIN profiles p ON ss.updated_by = p.id
      ORDER BY ss.setting_key
    `;
  },

  // System health functions
  async recordHealthMetric(metricName: string, metricValue: string, status: string) {
    return await sql`
      INSERT INTO system_health (metric_name, metric_value, status)
      VALUES (${metricName}, ${metricValue}, ${status})
      RETURNING id
    `;
  },

  async getRecentHealthMetrics(metricName?: string, limit: number = 50) {
    if (metricName) {
      return await sql`
        SELECT * FROM system_health
        WHERE metric_name = ${metricName}
        ORDER BY checked_at DESC
        LIMIT ${limit}
      `;
    }
    return await sql`
      SELECT * FROM system_health
      ORDER BY checked_at DESC
      LIMIT ${limit}
    `;
  },

  // Analytics functions
  async getUserActivityStats(days: number = 30) {
    return await sql`
      SELECT
        DATE(created_at) as date,
        COUNT(DISTINCT user_id) as active_users,
        COUNT(*) as total_actions
      FROM audit_logs
      WHERE created_at >= NOW() - INTERVAL '${days} days'
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `;
  },

  async getQuizStats() {
    return await sql`
      SELECT
        COUNT(*) as total_quizzes,
        COUNT(CASE WHEN status = 'published' THEN 1 END) as published_quizzes,
        COUNT(CASE WHEN status = 'draft' THEN 1 END) as draft_quizzes,
        COUNT(CASE WHEN status = 'archived' THEN 1 END) as archived_quizzes
      FROM quizzes
    `;
  },

  async getQuizAttemptStats(days: number = 30) {
    return await sql`
      SELECT
        DATE(started_at) as date,
        COUNT(*) as total_attempts,
        COUNT(CASE WHEN status = 'submitted' THEN 1 END) as submitted,
        COUNT(CASE WHEN status = 'graded' THEN 1 END) as graded,
        AVG(score) as avg_score
      FROM quiz_attempts
      WHERE started_at >= NOW() - INTERVAL '${days} days'
      GROUP BY DATE(started_at)
      ORDER BY date DESC
    `;
  }
};
