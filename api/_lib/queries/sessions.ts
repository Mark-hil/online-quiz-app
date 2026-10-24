import { sql } from '../db.js';

export async function getQuizSessions(quizId: string) {
  try {
    const sessions = await sql`
      SELECT 
        s.*,
        COUNT(ss.student_id) as student_count
      FROM quiz_sessions s
      LEFT JOIN quiz_session_students ss ON s.id = ss.session_id
      WHERE s.quiz_id = ${quizId}
      GROUP BY s.id
      ORDER BY s.session_pool_index ASC, s.start_time ASC
    `;
    return sessions;
  } catch (error) {
    console.error('Error in getQuizSessions:', error);
    return [];
  }
}

export async function createQuizSession(session: {
  quiz_id: string;
  session_name: string;
  start_time: string;
  end_time: string;
  access_pin?: string;
  session_pool_index?: number;
}) {
  const result = await sql`
    INSERT INTO quiz_sessions (
      quiz_id, session_name, start_time, end_time, access_pin, session_pool_index
    )
    VALUES (
      ${session.quiz_id},
      ${session.session_name},
      ${session.start_time},
      ${session.end_time},
      ${session.access_pin || null},
      ${session.session_pool_index || 1}
    )
    RETURNING *
  `;
  return result[0];
}

export async function updateQuizSession(id: string, updates: any) {
  const fields: string[] = [];
  const values: any[] = [id];

  if (updates.session_name !== undefined) {
    fields.push(`session_name = $${values.length + 1}`);
    values.push(updates.session_name);
  }
  if (updates.start_time !== undefined) {
    fields.push(`start_time = $${values.length + 1}`);
    values.push(updates.start_time);
  }
  if (updates.end_time !== undefined) {
    fields.push(`end_time = $${values.length + 1}`);
    values.push(updates.end_time);
  }
  if (updates.access_pin !== undefined) {
    fields.push(`access_pin = $${values.length + 1}`);
    values.push(updates.access_pin || null);
  }
  if (updates.session_pool_index !== undefined) {
    fields.push(`session_pool_index = $${values.length + 1}`);
    values.push(updates.session_pool_index);
  }

  if (fields.length === 0) return null;
  const query = `UPDATE quiz_sessions SET ${fields.join(', ')} WHERE id = $1 RETURNING *`;
  const result = await sql(query, values);
  return result[0];
}

export async function deleteQuizSession(id: string) {
  const result = await sql`DELETE FROM quiz_sessions WHERE id = ${id} RETURNING id`;
  return result[0];
}

export async function getQuizSessionStudents(sessionId: string) {
  try {
    return await sql`
      SELECT 
        ss.*,
        p.name as student_name,
        p.email as student_email,
        p.index_number
      FROM quiz_session_students ss
      JOIN profiles p ON ss.student_id = p.id
      WHERE ss.session_id = ${sessionId}
      ORDER BY p.name ASC
    `;
  } catch (error) {
    console.error('Error in getQuizSessionStudents:', error);
    return [];
  }
}

export async function assignStudentsToSession(sessionId: string, studentIds: string[]) {
  if (!studentIds || studentIds.length === 0) return [];
  const inserted = [];
  for (const studentId of studentIds) {
    const res = await sql`
      INSERT INTO quiz_session_students (session_id, student_id)
      VALUES (${sessionId}, ${studentId})
      ON CONFLICT (session_id, student_id) DO NOTHING
      RETURNING *
    `;
    if (res.length > 0) inserted.push(res[0]);
  }
  return inserted;
}

export async function removeStudentFromSession(sessionId: string, studentId: string) {
  return await sql`
    DELETE FROM quiz_session_students 
    WHERE session_id = ${sessionId} AND student_id = ${studentId}
    RETURNING id
  `;
}

export async function getStudentAssignedSession(quizId: string, studentId: string) {
  try {
    const result = await sql`
      SELECT 
        s.*
      FROM quiz_sessions s
      JOIN quiz_session_students ss ON s.id = ss.session_id
      WHERE s.quiz_id = ${quizId} AND ss.student_id = ${studentId}
      LIMIT 1
    `;
    return result[0] || null;
  } catch (error) {
    console.error('Error in getStudentAssignedSession:', error);
    return null;
  }
}
