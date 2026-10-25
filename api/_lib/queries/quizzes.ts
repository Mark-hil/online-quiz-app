import { sql } from '../db.js';

export async function getQuizzes(lecturerId?: string) {
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
    console.error('Error in getQuizzes:', error);
    return [];
  }
}

export async function getQuiz(id: string) {
  const result = await sql`SELECT * FROM quizzes WHERE id = ${id}`;
  return result[0] || null;
}

export async function createQuiz(quiz: any) {
  const topicRules = Array.isArray(quiz.topic_draw_rules)
    ? JSON.stringify(quiz.topic_draw_rules)
    : (typeof quiz.topic_draw_rules === 'string' ? quiz.topic_draw_rules : '[]');

  const result = await sql`
    INSERT INTO quizzes (
      lecturer_id, course_id, title, description, subject, duration_minutes, total_marks, status, deadline,
      randomize_questions, randomize_options, show_results_immediately, allow_review,
      require_seb, enable_camera_proctoring, enable_screen_recording, enable_tab_monitoring, enable_copy_paste_prevention,
      is_dynamic_draw, draw_question_count, has_multiple_sessions,
      category, category_prefix, bank_category_filter, topic_draw_rules
    )
    VALUES (
      ${quiz.lecturer_id},
      ${quiz.course_id || null},
      ${quiz.title},
      ${quiz.description},
      ${quiz.subject},
      ${quiz.duration_minutes},
      ${quiz.total_marks},
      ${quiz.status},
      ${quiz.deadline || null},
      ${quiz.randomize_questions || false},
      ${quiz.randomize_options || false},
      ${quiz.show_results_immediately !== undefined ? quiz.show_results_immediately : true},
      ${quiz.allow_review !== undefined ? quiz.allow_review : true},
      ${quiz.require_seb || false},
      ${quiz.enable_camera_proctoring || false},
      ${quiz.enable_screen_recording || false},
      ${quiz.enable_tab_monitoring !== undefined ? quiz.enable_tab_monitoring : true},
      ${quiz.enable_copy_paste_prevention !== undefined ? quiz.enable_copy_paste_prevention : true},
      ${quiz.is_dynamic_draw || false},
      ${quiz.draw_question_count || 0},
      ${quiz.has_multiple_sessions || false},
      ${quiz.category || 'quiz'},
      ${quiz.category_prefix ? quiz.category_prefix.replace(/[^a-zA-Z0-9_-]/g, '').toUpperCase().trim() : null},
      ${quiz.bank_category_filter || 'all'},
      ${topicRules}
    )
    RETURNING *
  `;
  return result[0];
}

export async function updateQuiz(id: string, updates: any) {
  const fields = Object.keys(updates);
  const values = Object.values(updates).map(v => 
    typeof v === 'object' && v !== null && !(v instanceof Date) ? JSON.stringify(v) : v
  );

  const setClause = fields.map((field, index) => `${field} = $${index + 2}`).join(', ');

  const query = `
    UPDATE quizzes 
    SET ${setClause}, updated_at = NOW()
    WHERE id = $1
    RETURNING *
  `;

  const result = await sql(query, [id, ...values]);
  return result[0];
}

export async function deleteQuiz(id: string) {
  const result = await sql`DELETE FROM quizzes WHERE id = ${id} RETURNING id`;
  return result[0];
}

export async function submitForApproval(quizId: string) {
  const result = await sql`
    UPDATE quizzes 
    SET status = 'pending_approval', updated_at = NOW()
    WHERE id = ${quizId}
    RETURNING *
  `;
  return result[0];
}

export async function getPendingQuizzes() {
  return await sql`
    SELECT q.*, p.name as lecturer_name, p.email as lecturer_email
    FROM quizzes q
    JOIN profiles p ON q.lecturer_id = p.id
    WHERE q.status = 'pending_approval'
    ORDER BY q.created_at DESC
  `;
}

export async function getApprovedQuizzes() {
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
}

export async function getAllQuizzesDebug() {
  return await sql`
    SELECT q.*, p.name as lecturer_name, p.email as lecturer_email
    FROM quizzes q
    JOIN profiles p ON q.lecturer_id = p.id
    ORDER BY q.created_at DESC
  `;
}

export async function fixQuizStatuses() {
  const result = await sql`
    UPDATE quizzes 
    SET status = 'pending_approval' 
    WHERE status = 'pending'
    RETURNING id, status
  `;
  return result;
}

export async function moderateQuiz(
  quizId: string,
  moderatorId: string,
  status: 'approved' | 'rejected',
  notes?: string
) {
  const [result] = await Promise.all([
    sql`
      INSERT INTO quiz_moderations (quiz_id, moderator_id, status, notes)
      VALUES (${quizId}, ${moderatorId}, ${status}, ${notes || null})
      ON CONFLICT (quiz_id, moderator_id) 
      DO UPDATE SET 
        status = EXCLUDED.status,
        notes = EXCLUDED.notes,
        reviewed_at = NOW(),
        updated_at = NOW()
      RETURNING *
    `,
    sql`
      UPDATE quizzes 
      SET status = ${status}, 
          moderator_id = ${moderatorId}, 
          reviewed_at = NOW(),
          updated_at = NOW()
      WHERE id = ${quizId}
    `,
  ]);
  return result[0];
}

export async function getQuizModerations(quizId: string) {
  return await sql`
    SELECT qm.*, p.name as moderator_name, p.email as moderator_email
    FROM quiz_moderations qm
    JOIN profiles p ON qm.moderator_id = p.id
    WHERE qm.quiz_id = ${quizId}
    ORDER BY qm.created_at DESC
  `;
}

export async function publishQuiz(quizId: string, adminId: string) {
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
}

export async function unpublishQuiz(quizId: string, _adminId?: string) {
  const result = await sql`
    UPDATE quizzes 
    SET status = 'approved', 
        updated_at = NOW()
    WHERE id = ${quizId} AND status = 'published'
    RETURNING *
  `;
  return result[0];
}

export async function getPublishedQuizzes() {
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
}

export async function getArchivedQuizzes() {
  try {
    return await sql`
      SELECT q.*, 
             p.name as lecturer_name,
             p.email as lecturer_email,
             m.name as moderator_name,
             a.name as admin_name,
             (SELECT COUNT(*)::int FROM quiz_attempts qa WHERE qa.quiz_id = q.id) as attempts_count,
             (SELECT ROUND(AVG(score), 1)::numeric FROM quiz_attempts qa WHERE qa.quiz_id = q.id AND qa.score IS NOT NULL) as average_score
      FROM quizzes q
      LEFT JOIN profiles p ON q.lecturer_id = p.id
      LEFT JOIN profiles m ON q.moderator_id = m.id
      LEFT JOIN profiles a ON q.admin_id = a.id
      WHERE q.status = 'archived'
      ORDER BY q.updated_at DESC
    `;
  } catch (error) {
    console.error('Error fetching archived quizzes:', error);
    return [];
  }
}

export async function archiveQuizzes(options?: { quizIds?: string[]; includeDrafts?: boolean } | string[]) {
  const quizIds = Array.isArray(options) ? options : options?.quizIds;
  const includeDrafts = !Array.isArray(options) && options?.includeDrafts;

  if (quizIds && quizIds.length > 0) {
    return await sql`
      UPDATE quizzes
      SET status = 'archived', updated_at = now()
      WHERE id = ANY(${quizIds})
      RETURNING id, title, status
    `;
  }
  if (includeDrafts) {
    return await sql`
      UPDATE quizzes
      SET status = 'archived', updated_at = now()
      WHERE status IN ('published', 'draft', 'approved')
      RETURNING id, title, status
    `;
  }
  return await sql`
    UPDATE quizzes
    SET status = 'archived', updated_at = now()
    WHERE status = 'published'
    RETURNING id, title, status
  `;
}
