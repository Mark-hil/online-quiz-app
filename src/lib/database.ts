import { neon } from '@neondatabase/serverless';

const neonUrl = import.meta.env.VITE_NEON_DATABASE_URL;

if (!neonUrl) {
  throw new Error('Missing Neon database URL. Please set VITE_NEON_DATABASE_URL in your .env file');
}

export const sql = neon(neonUrl);

// Database interfaces
export interface Profile {
  id: string;
  email: string;
  name: string;
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
    const result = await sql`SELECT * FROM profiles WHERE id = ${id}`;
    return result[0] || null;
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
    if (lecturerId) {
      return await sql`SELECT * FROM quizzes WHERE lecturer_id = ${lecturerId} ORDER BY created_at DESC`;
    }
    return await sql`SELECT * FROM quizzes WHERE status = 'published' ORDER BY created_at DESC`;
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
