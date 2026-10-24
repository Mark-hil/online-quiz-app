import { sql } from '../db.js';

export async function createQuizAttempt(attempt: any) {
  const result = await sql`
    INSERT INTO quiz_attempts (quiz_id, student_id, started_at, status, user_agent)
    VALUES (${attempt.quiz_id}, ${attempt.student_id}, ${attempt.started_at}, ${attempt.status}, ${attempt.user_agent || null})
    RETURNING *
  `;
  return result[0];
}

export async function updateQuizAttempt(id: string, updates: any) {
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
  if (updates.user_agent !== undefined) {
    fields.push(`user_agent = $${values.length + 1}`);
    values.push(updates.user_agent);
  }
  if (updates.suspicious_activity !== undefined) {
    fields.push(`suspicious_activity = $${values.length + 1}`);
    values.push(
      typeof updates.suspicious_activity === 'string'
        ? updates.suspicious_activity
        : JSON.stringify(updates.suspicious_activity)
    );
  }
  if (updates.last_activity !== undefined) {
    fields.push(`last_activity = $${values.length + 1}`);
    values.push(updates.last_activity);
  }
  if (updates.time_remaining !== undefined) {
    fields.push(`time_remaining = $${values.length + 1}`);
    values.push(updates.time_remaining);
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

  const result = await sql(query, values);
  return result[0];
}

export async function getQuizAttempts(quizId?: string, studentId?: string) {
  if (quizId && studentId) {
    return await sql`SELECT *, CURRENT_TIMESTAMP as current_db_time FROM quiz_attempts WHERE quiz_id = ${quizId} AND student_id = ${studentId}`;
  } else if (quizId) {
    return await sql`SELECT *, CURRENT_TIMESTAMP as current_db_time FROM quiz_attempts WHERE quiz_id = ${quizId}`;
  } else if (studentId) {
    return await sql`SELECT *, CURRENT_TIMESTAMP as current_db_time FROM quiz_attempts WHERE student_id = ${studentId}`;
  }
  throw new Error('Security: Cannot retrieve all quiz attempts without proper filtering.');
}

export async function getLecturerQuizAttempts(lecturerId: string, quizId?: string) {
  if (quizId) {
    const quizCheck = await sql`
      SELECT id FROM quizzes 
      WHERE id = ${quizId} AND lecturer_id = ${lecturerId}
    `;
    if (quizCheck.length === 0) {
      throw new Error('Security: Quiz does not belong to this lecturer');
    }
    return await sql`SELECT *, CURRENT_TIMESTAMP as current_db_time FROM quiz_attempts WHERE quiz_id = ${quizId}`;
  }
  return await sql`
    SELECT qa.*, CURRENT_TIMESTAMP as current_db_time FROM quiz_attempts qa
    JOIN quizzes q ON qa.quiz_id = q.id
    WHERE q.lecturer_id = ${lecturerId}
    ORDER BY qa.started_at DESC
  `;
}

export async function saveAttemptQuestions(
  attemptId: string,
  questions: Array<{
    question_bank_id?: string;
    question_id?: string;
    order_index: number;
  }>
) {
  const saved = [];
  for (const q of questions) {
    const res = await sql`
      INSERT INTO quiz_attempt_questions (
        attempt_id, question_bank_id, question_id, order_index
      )
      VALUES (
        ${attemptId}, ${q.question_bank_id || null}, ${q.question_id || null}, ${q.order_index}
      )
      ON CONFLICT (attempt_id, order_index) DO NOTHING
      RETURNING *
    `;
    if (res.length > 0) saved.push(res[0]);
  }
  return saved;
}

export async function getAttemptQuestions(attemptId: string) {
  try {
    const items = await sql`
      SELECT 
        aq.id as attempt_question_id,
        aq.attempt_id,
        aq.order_index,
        aq.question_bank_id,
        aq.question_id,
        COALESCE(qb.id, q.id) as id,
        COALESCE(qb.question_text, q.question_text) as question_text,
        COALESCE(qb.question_type, q.question_type) as question_type,
        COALESCE(qb.options, q.options) as options,
        COALESCE(qb.correct_answer, q.correct_answer) as correct_answer,
        COALESCE(qb.marks, q.marks) as marks,
        qb.topic,
        qb.difficulty
      FROM quiz_attempt_questions aq
      LEFT JOIN question_bank qb ON aq.question_bank_id = qb.id
      LEFT JOIN questions q ON aq.question_id = q.id
      WHERE aq.attempt_id = ${attemptId}
      ORDER BY aq.order_index ASC
    `;
    return items;
  } catch (error) {
    console.error('Error in getAttemptQuestions:', error);
    return [];
  }
}

export async function createStudentAnswer(answer: any) {
  const result = await sql`
    INSERT INTO student_answers (attempt_id, question_id, answer_text, is_correct, marks_obtained, lecturer_comment, is_flagged)
    VALUES (${answer.attempt_id}, ${answer.question_id}, ${answer.answer_text}, ${answer.is_correct}, ${answer.marks_obtained}, ${answer.lecturer_comment}, ${answer.is_flagged || false})
    RETURNING *
  `;
  return result[0];
}

export async function upsertStudentAnswer(answer: any) {
  const result = await sql`
    INSERT INTO student_answers (attempt_id, question_id, answer_text, is_correct, marks_obtained, lecturer_comment, is_flagged)
    VALUES (${answer.attempt_id}, ${answer.question_id}, ${answer.answer_text}, ${answer.is_correct}, ${answer.marks_obtained}, ${answer.lecturer_comment}, ${answer.is_flagged !== undefined ? answer.is_flagged : false})
    ON CONFLICT (attempt_id, question_id) 
    DO UPDATE SET 
      answer_text = EXCLUDED.answer_text,
      is_correct = EXCLUDED.is_correct,
      marks_obtained = EXCLUDED.marks_obtained,
      lecturer_comment = EXCLUDED.lecturer_comment,
      is_flagged = COALESCE(EXCLUDED.is_flagged, student_answers.is_flagged),
      updated_at = now()
    RETURNING *
  `;
  return result[0];
}

export async function updateStudentAnswer(id: string, updates: any) {
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

  const result = await sql`
    UPDATE student_answers 
    SET answer_text = ${updates.answer_text || ''}
    WHERE id = ${id}
    RETURNING *
  `;
  return result[0];
}

export async function getStudentAnswers(attemptId?: string, questionId?: string) {
  if (attemptId && questionId) {
    return await sql`SELECT * FROM student_answers WHERE attempt_id = ${attemptId} AND question_id = ${questionId}`;
  } else if (attemptId) {
    return await sql`SELECT * FROM student_answers WHERE attempt_id = ${attemptId}`;
  } else if (questionId) {
    return await sql`SELECT * FROM student_answers WHERE question_id = ${questionId}`;
  }
  return await sql`SELECT * FROM student_answers`;
}

export async function getFlaggedAnswersForAdmin() {
  try {
    return await sql`
      SELECT 
        sa.id, 
        sa.answer_text, 
        sa.is_flagged,
        sa.attempt_id,
        q.id as question_id,
        q.question_text,
        q.marks as question_marks,
        qz.title as quiz_title,
        p.name as student_name,
        p.email as student_email,
        p.index_number as student_index
      FROM student_answers sa
      JOIN questions q ON sa.question_id = q.id
      JOIN quiz_attempts qa ON sa.attempt_id = qa.id
      JOIN quizzes qz ON qa.quiz_id = qz.id
      JOIN profiles p ON qa.student_id = p.id
      WHERE sa.is_flagged = true
      ORDER BY sa.updated_at DESC
    `;
  } catch (error) {
    console.error('Error fetching flagged answers:', error);
    return [];
  }
}

export async function getLecturerAnswersForAnalytics(lecturerId: string) {
  try {
    return await sql`
      SELECT 
        a.question_id, 
        a.is_correct, 
        a.attempt_id,
        q.question_text,
        qz.id as quiz_id,
        qz.title as quiz_title
      FROM student_answers a
      JOIN questions q ON a.question_id = q.id
      JOIN quizzes qz ON q.quiz_id = qz.id
      WHERE qz.lecturer_id = ${lecturerId}
    `;
  } catch (error) {
    console.error('Error in getLecturerAnswersForAnalytics:', error);
    return [];
  }
}

export async function getDetailedQuizCandidatesForBroadsheet(quizId: string) {
  try {
    return await sql`
      SELECT 
        qa.id as attempt_id,
        qa.quiz_id,
        qa.student_id,
        qa.score::float as score,
        qa.status,
        qa.started_at,
        qa.submitted_at,
        qa.cheated,
        qa.cheating_reason,
        qa.tab_switch_count,
        qa.copy_attempts,
        qa.right_click_count,
        p.name as student_name,
        p.email as student_email,
        p.index_number,
        q.title as quiz_title,
        q.subject as quiz_subject,
        q.duration_minutes,
        qs.session_name as cohort_session
      FROM quiz_attempts qa
      JOIN profiles p ON qa.student_id = p.id
      JOIN quizzes q ON qa.quiz_id = q.id
      LEFT JOIN quiz_session_students qss ON qss.student_id = qa.student_id
      LEFT JOIN quiz_sessions qs ON qs.id = qss.session_id AND qs.quiz_id = qa.quiz_id
      WHERE qa.quiz_id = ${quizId} AND qa.status IN ('submitted', 'graded', 'expired')
      ORDER BY p.name ASC
    `;
  } catch (error) {
    console.error('Error fetching broadsheet candidates:', error);
    return [];
  }
}
