import { jsonHandler, HttpError, readJsonBody } from '../_lib/http.js';
import { requireUser } from '../_lib/session.js';
import { sql } from '../_lib/db.js';
import type { ApiRequest, ApiResponse } from '../_lib/types.js';

export default jsonHandler(async (req: ApiRequest, _res: ApiResponse) => {
  if (req.method !== 'POST') {
    throw new HttpError(405, 'Method not allowed. Use POST.');
  }

  const user = await requireUser(req);
  const body = await readJsonBody(req);
  const { attempt_id, question_id, answer_text = '', is_flagged } = body || {};

  if (!attempt_id || !question_id) {
    throw new HttpError(400, 'Missing attempt_id or question_id');
  }

  // 1. Verify attempt ownership & status
  const attempts = await sql`
    SELECT qa.*, q.deadline 
    FROM quiz_attempts qa
    JOIN quizzes q ON qa.quiz_id = q.id
    WHERE qa.id = ${attempt_id}
  `;

  if (attempts.length === 0) {
    throw new HttpError(404, 'Attempt not found');
  }

  const attempt = attempts[0] as any;
  if (attempt.student_id !== user.id) {
    throw new HttpError(403, 'Access denied: attempt does not belong to you');
  }

  if (attempt.status !== 'in_progress') {
    throw new HttpError(400, `Cannot save answer: attempt is ${attempt.status}`);
  }

  if (attempt.deadline && new Date(attempt.deadline) < new Date()) {
    throw new HttpError(400, 'Cannot save answer: quiz deadline has passed');
  }

  // 2. Upsert answer
  await sql`
    INSERT INTO student_answers (attempt_id, question_id, answer_text, is_flagged, updated_at)
    VALUES (${attempt_id}, ${question_id}, ${answer_text}, ${is_flagged || false}, NOW())
    ON CONFLICT (attempt_id, question_id)
    DO UPDATE SET
      answer_text = EXCLUDED.answer_text,
      is_flagged = COALESCE(EXCLUDED.is_flagged, student_answers.is_flagged),
      updated_at = NOW()
  `;

  // 3. Touch attempt last_activity
  await sql`
    UPDATE quiz_attempts
    SET last_activity = NOW()
    WHERE id = ${attempt_id}
  `;

  return { success: true, saved_at: new Date().toISOString() };
});
