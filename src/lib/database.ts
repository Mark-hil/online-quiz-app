import { neon } from '@neondatabase/serverless';

const neonUrl = import.meta.env.VITE_NEON_DATABASE_URL;

if (!neonUrl) {
  throw new Error('Missing Neon database URL. Please set VITE_NEON_DATABASE_URL in your .env file');
}

export const sql = neon(neonUrl, {
  fetchOptions: {
    retries: 3,
    retryDelay: 1000,
  },
  connectionTimeoutMillis: 10000,
});

// Database migration function
export async function runMigrations() {
  try {
    console.log('Starting database migrations...');
    
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
        role text NOT NULL CHECK (role IN ('lecturer', 'student')),
        created_at timestamptz DEFAULT now(),
        updated_at timestamptz DEFAULT now()
      )
    `;
    console.log('✓ Profiles table created/verified');
    
    // 3. Add index_number column if it doesn't exist (for existing databases)
    await sql`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS index_number text UNIQUE`;
    console.log('✓ Index number column added/verified');
    
    // 4. Create quizzes table
    await sql`
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
      )
    `;
    console.log('✓ Quizzes table created/verified');
    
    // 5. Add deadline column to quizzes table if it doesn't exist
    await sql`ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS deadline timestamptz`;
    console.log('✓ Deadline column added/verified');
    
    // 6. Create questions table
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
    
    // 7. Create quiz_attempts table with cheating tracking
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
    
    // 8. Add cheating columns to quiz_attempts if they don't exist
    await sql`ALTER TABLE quiz_attempts ADD COLUMN IF NOT EXISTS cheated boolean DEFAULT false`;
    await sql`ALTER TABLE quiz_attempts ADD COLUMN IF NOT EXISTS cheating_reason text`;
    await sql`ALTER TABLE quiz_attempts ADD COLUMN IF NOT EXISTS tab_switch_count integer DEFAULT 0`;
    await sql`ALTER TABLE quiz_attempts ADD COLUMN IF NOT EXISTS copy_attempts integer DEFAULT 0`;
    await sql`ALTER TABLE quiz_attempts ADD COLUMN IF NOT EXISTS right_click_count integer DEFAULT 0`;
    console.log('✓ Cheating tracking columns added/verified');
    
    // 9. Create student_answers table
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
    
    console.log('🎉 Database migrations completed successfully!');
    
  } catch (error) {
    console.error('❌ Database migration failed:', error);
    throw error; // Re-throw to let the calling code handle it
  }
}

// Database interfaces
export interface Profile {
  id: string;
  email: string;
  name: string;
  index_number?: string;
  role: 'lecturer' | 'student';
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
  status: 'draft' | 'published';
  deadline?: string;
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
      return await sql`SELECT * FROM quizzes WHERE status = 'published' ORDER BY created_at DESC`;
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
    return await sql`SELECT * FROM quiz_attempts`;
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
  }
};
