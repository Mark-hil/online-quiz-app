import { sql } from '../db.js';

export async function requestBankAccess(data: {
  course_id: string;
  requester_id: string;
  reason: string;
  access_level?: 'read_only' | 'contributor';
  duration_days?: number;
}) {
  const accessLevel = data.access_level || 'read_only';
  const durationDays = data.duration_days || 7;
  const result = await sql`
    INSERT INTO question_bank_access_requests (
      course_id, requester_id, reason, access_level, duration_days, status, created_at
    )
    VALUES (
      ${data.course_id}, ${data.requester_id}, ${data.reason}, ${accessLevel}, ${durationDays}, 'pending', now()
    )
    RETURNING *
  `;
  return result[0];
}

export async function getBankAccessRequests(filters?: {
  course_id?: string;
  requester_id?: string;
  status?: string;
  reviewer_id?: string;
}) {
  try {
    let query = `
      SELECT 
        r.*,
        c.code as course_code,
        c.title as course_title,
        p.name as requester_name,
        p.email as requester_email,
        rev.name as reviewer_name
      FROM question_bank_access_requests r
      JOIN courses c ON r.course_id = c.id
      JOIN profiles p ON r.requester_id = p.id
      LEFT JOIN profiles rev ON r.reviewed_by = rev.id
      WHERE 1=1
    `;
    const values: any[] = [];

    if (filters?.course_id) {
      values.push(filters.course_id);
      query += ` AND r.course_id = $${values.length}`;
    }
    if (filters?.requester_id) {
      values.push(filters.requester_id);
      query += ` AND r.requester_id = $${values.length}`;
    }
    if (filters?.status) {
      values.push(filters.status);
      query += ` AND r.status = $${values.length}`;
    }
    if (filters?.reviewer_id) {
      values.push(filters.reviewer_id);
      query += ` AND (c.assigned_lecturer_id = $${values.length} OR r.reviewed_by = $${values.length})`;
    }

    query += ` ORDER BY r.created_at DESC`;
    return await sql(query, values);
  } catch (error) {
    console.error('Error in getBankAccessRequests:', error);
    return [];
  }
}

export async function reviewBankAccessRequest(
  id: string,
  reviewerId: string,
  decision: 'approved' | 'rejected',
  notes?: string
) {
  let expiresAt: string | null = null;
  if (decision === 'approved') {
    const req = await sql`SELECT duration_days FROM question_bank_access_requests WHERE id = ${id}`;
    const days = req[0]?.duration_days || 7;
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + days);
    expiresAt = expiryDate.toISOString();
  }

  const result = await sql`
    UPDATE question_bank_access_requests
    SET 
      status = ${decision},
      reviewed_by = ${reviewerId},
      reviewed_at = now(),
      expires_at = ${expiresAt},
      review_notes = ${notes || null}
    WHERE id = ${id}
    RETURNING *
  `;
  return result[0];
}

export async function getQuestionBankQuestions(
  courseId: string,
  filters?: {
    status?: string;
    topic?: string;
    difficulty?: string;
  }
) {
  try {
    let query = `
      SELECT * FROM question_bank
      WHERE course_id = $1
    `;
    const values: any[] = [courseId];

    if (filters?.status && filters.status !== 'all') {
      values.push(filters.status);
      query += ` AND status = $${values.length}`;
    }
    if (filters?.topic && filters.topic !== 'all') {
      values.push(filters.topic);
      query += ` AND topic = $${values.length}`;
    }
    if (filters?.difficulty && filters.difficulty !== 'all') {
      values.push(filters.difficulty);
      query += ` AND difficulty = $${values.length}`;
    }

    query += ` ORDER BY created_at DESC`;
    return await sql(query, values);
  } catch (error) {
    console.error('Error in getQuestionBankQuestions:', error);
    return [];
  }
}

export async function getQuestionBankItem(id: string) {
  try {
    const result = await sql`SELECT * FROM question_bank WHERE id = ${id}`;
    return result[0] || null;
  } catch (error) {
    console.error('Error in getQuestionBankItem:', error);
    return null;
  }
}

export async function createQuestionBankItem(item: any) {
  const topic = item.topic?.trim() || 'General';
  const difficulty = item.difficulty || 'medium';
  const status = item.status || 'active';
  const questionType = item.question_type || 'mcq';
  const options = typeof item.options === 'string' ? item.options : JSON.stringify(item.options || []);
  const marks = item.marks ?? 1;

  const result = await sql`
    INSERT INTO question_bank (
      course_id, topic, difficulty, status, question_text, question_type, options, correct_answer, marks, updated_at
    )
    VALUES (
      ${item.course_id}, ${topic}, ${difficulty}, ${status}, ${item.question_text}, ${questionType}, ${options}, ${item.correct_answer}, ${marks}, now()
    )
    RETURNING *
  `;
  return result[0];
}

export async function updateQuestionBankItem(id: string, updates: any) {
  const fields: string[] = ['updated_at = now()'];
  const values: any[] = [id];

  if (updates.topic !== undefined) {
    fields.push(`topic = $${values.length + 1}`);
    values.push(updates.topic.trim() || 'General');
  }
  if (updates.difficulty !== undefined) {
    fields.push(`difficulty = $${values.length + 1}`);
    values.push(updates.difficulty);
  }
  if (updates.status !== undefined) {
    fields.push(`status = $${values.length + 1}`);
    values.push(updates.status);
  }
  if (updates.question_text !== undefined) {
    fields.push(`question_text = $${values.length + 1}`);
    values.push(updates.question_text);
  }
  if (updates.question_type !== undefined) {
    fields.push(`question_type = $${values.length + 1}`);
    values.push(updates.question_type);
  }
  if (updates.options !== undefined) {
    fields.push(`options = $${values.length + 1}`);
    values.push(typeof updates.options === 'string' ? updates.options : JSON.stringify(updates.options));
  }
  if (updates.correct_answer !== undefined) {
    fields.push(`correct_answer = $${values.length + 1}`);
    values.push(updates.correct_answer);
  }
  if (updates.marks !== undefined) {
    fields.push(`marks = $${values.length + 1}`);
    values.push(updates.marks);
  }

  const query = `UPDATE question_bank SET ${fields.join(', ')} WHERE id = $1 RETURNING *`;
  const result = await sql(query, values);
  return result[0];
}

export async function deleteQuestionBankItem(id: string) {
  const result = await sql`DELETE FROM question_bank WHERE id = ${id} RETURNING id`;
  return result[0];
}

export async function bulkInsertQuestionBank(courseId: string, items: any[]) {
  const inserted = [];
  for (const item of items) {
    const topic = item.topic?.trim() || 'General';
    const difficulty = item.difficulty || 'medium';
    const status = item.status || 'active';
    const questionType = item.question_type || 'mcq';
    const options = typeof item.options === 'string' ? item.options : JSON.stringify(item.options || []);
    const marks = item.marks ?? 1;

    const res = await sql`
      INSERT INTO question_bank (
        course_id, topic, difficulty, status, question_text, question_type, options, correct_answer, marks, updated_at
      )
      VALUES (
        ${courseId}, ${topic}, ${difficulty}, ${status}, ${item.question_text}, ${questionType}, ${options}, ${item.correct_answer}, ${marks}, now()
      )
      RETURNING *
    `;
    inserted.push(res[0]);
  }
  return inserted;
}

export async function syncQuizQuestionsToBank(courseId: string, questions: any[]) {
  try {
    const existing = await sql`
      SELECT question_text FROM question_bank WHERE course_id = ${courseId}
    `;
    const existingTexts = new Set(existing.map((e: any) => e.question_text.trim().toLowerCase()));

    let count = 0;
    for (const q of questions) {
      if (!q.question_text || existingTexts.has(q.question_text.trim().toLowerCase())) {
        continue;
      }

      const topic = q.topic?.trim() || 'General';
      const difficulty = q.difficulty || 'medium';
      const status = 'active';
      const questionType = q.question_type || 'mcq';
      const options = typeof q.options === 'string' ? q.options : JSON.stringify(q.options || []);
      const marks = q.marks ?? 1;

      await sql`
        INSERT INTO question_bank (
          course_id, topic, difficulty, status, question_text, question_type, options, correct_answer, marks, updated_at
        )
        VALUES (
          ${courseId}, ${topic}, ${difficulty}, ${status}, ${q.question_text}, ${questionType}, ${options}, ${q.correct_answer || ''}, ${marks}, now()
        )
      `;
      existingTexts.add(q.question_text.trim().toLowerCase());
      count++;
    }
    return count;
  } catch (err) {
    console.error('Error in syncQuizQuestionsToBank:', err);
    return 0;
  }
}

export async function retirePreviousTermQuestions(courseId: string) {
  const result = await sql`
    UPDATE question_bank 
    SET status = 'retired', updated_at = now()
    WHERE course_id = ${courseId} AND status = 'active'
    RETURNING id
  `;
  return result;
}

export async function getQuestionBankStats(courseId: string) {
  try {
    const questions = await sql`
      SELECT topic, difficulty, status, empirical_pass_rate, times_answered
      FROM question_bank
      WHERE course_id = ${courseId}
    `;

    return {
      total: questions.length,
      active: questions.filter((q: any) => q.status === 'active').length,
      retired: questions.filter((q: any) => q.status === 'retired').length,
      draft: questions.filter((q: any) => q.status === 'draft').length,
      easy: questions.filter((q: any) => q.difficulty === 'easy' && q.status === 'active').length,
      medium: questions.filter((q: any) => q.difficulty === 'medium' && q.status === 'active').length,
      hard: questions.filter((q: any) => q.difficulty === 'hard' && q.status === 'active').length,
      topics: Array.from(new Set(questions.map((q: any) => q.topic))).filter(Boolean),
      calibratedCount: questions.filter((q: any) => (q.times_answered || 0) >= 5).length,
    };
  } catch (error) {
    console.error('Error in getQuestionBankStats:', error);
    return {
      total: 0,
      active: 0,
      retired: 0,
      draft: 0,
      easy: 0,
      medium: 0,
      hard: 0,
      topics: [],
      calibratedCount: 0,
    };
  }
}

export async function recordQuestionAnswerResult(questionBankId: string, isCorrect: boolean) {
  try {
    const current = await sql`
      SELECT times_answered, times_correct 
      FROM question_bank 
      WHERE id = ${questionBankId}
    `;
    if (current.length === 0) return;

    const answered = (current[0].times_answered || 0) + 1;
    const correct = (current[0].times_correct || 0) + (isCorrect ? 1 : 0);
    const passRate = parseFloat(((correct / answered) * 100).toFixed(2));

    let autoDifficulty = undefined;
    if (answered >= 5) {
      if (passRate >= 80.0) {
        autoDifficulty = 'easy';
      } else if (passRate < 40.0) {
        autoDifficulty = 'hard';
      } else {
        autoDifficulty = 'medium';
      }
    }

    if (autoDifficulty) {
      await sql`
        UPDATE question_bank
        SET 
          times_answered = ${answered},
          times_correct = ${correct},
          empirical_pass_rate = ${passRate},
          difficulty = ${autoDifficulty},
          updated_at = now()
        WHERE id = ${questionBankId}
      `;
    } else {
      await sql`
        UPDATE question_bank
        SET 
          times_answered = ${answered},
          times_correct = ${correct},
          empirical_pass_rate = ${passRate},
          updated_at = now()
        WHERE id = ${questionBankId}
      `;
    }
  } catch (error) {
    console.error('Error updating question bank calibration:', error);
  }
}

export async function getQuestions(quizId?: string, lecturerId?: string) {
  if (quizId) {
    const regularQuestions = await sql`SELECT * FROM questions WHERE quiz_id = ${quizId} ORDER BY created_at`;
    if (regularQuestions.length > 0) {
      return regularQuestions;
    }

    try {
      const quizList = await sql`SELECT id, course_id, lecturer_id, is_dynamic_draw FROM quizzes WHERE id = ${quizId}`;
      if (quizList.length > 0 && quizList[0].course_id) {
        const bankQuestions = await sql`
          SELECT 
            id,
            ${quizId} as quiz_id,
            ${quizList[0].lecturer_id} as lecturer_id,
            question_text,
            question_type,
            options,
            correct_answer,
            marks,
            created_at
          FROM question_bank
          WHERE course_id = ${quizList[0].course_id} AND status = 'active'
          ORDER BY created_at
        `;
        if (bankQuestions.length > 0) {
          return bankQuestions;
        }
      }
    } catch (bankErr) {
      console.error('Error fetching course bank questions for quiz:', bankErr);
    }

    return regularQuestions;
  }
  if (lecturerId) {
    return await sql`SELECT * FROM questions WHERE lecturer_id = ${lecturerId} ORDER BY created_at`;
  }
  return await sql`SELECT * FROM questions ORDER BY created_at`;
}

export async function createQuestion(question: any) {
  const result = await sql`
    INSERT INTO questions (quiz_id, lecturer_id, question_text, question_type, options, correct_answer, marks)
    VALUES (
      ${question.quiz_id},
      ${question.lecturer_id},
      ${question.question_text},
      ${question.question_type},
      ${JSON.stringify(question.options)},
      ${question.correct_answer},
      ${question.marks}
    )
    RETURNING *
  `;
  return result[0];
}

export async function deleteQuestion(id: string) {
  const result = await sql`DELETE FROM questions WHERE id = ${id} RETURNING id`;
  return result[0];
}
