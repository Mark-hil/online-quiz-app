import { jsonHandler, HttpError, readJsonBody } from '../../http.js';
import { requireUser } from '../../session.js';
import { sql } from '../../db.js';
import type { ApiRequest, ApiResponse } from '../../types.js';

export default jsonHandler(async (req: ApiRequest, _res: ApiResponse) => {
  if (req.method !== 'POST') {
    throw new HttpError(405, 'Method not allowed. Use POST.');
  }

  const user = await requireUser(req);
  const body = await readJsonBody(req);
  const { attempt_id, reason = 'Academic integrity violation detected' } = body || {};

  if (!attempt_id) {
    throw new HttpError(400, 'Missing attempt_id');
  }

  const rows = await sql`
    SELECT * FROM quiz_attempts WHERE id = ${attempt_id}
  `;

  if (rows.length === 0) {
    throw new HttpError(404, 'Attempt not found');
  }

  const attempt = rows[0] as any;
  // Either student self-triggering violation trap or staff terminating
  if (user.role === 'student' && attempt.student_id !== user.id) {
    throw new HttpError(403, 'Access denied: attempt does not belong to you');
  }

  const [updated] = await sql`
    UPDATE quiz_attempts
    SET
      cheated = true,
      cheating_reason = ${reason},
      status = 'submitted',
      submitted_at = NOW(),
      last_activity = NOW()
    WHERE id = ${attempt_id}
    RETURNING *
  `;

  await sql`
    INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
    VALUES (
      ${user.id},
      'EXAM_TERMINATED_FOR_VIOLATION',
      'quiz_attempt',
      ${attempt_id},
      ${JSON.stringify({
        student_id: attempt.student_id,
        reason,
        terminated_by: user.id,
      })}
    )
  `;

  return {
    success: true,
    terminated: true,
    attempt: updated,
  };
});
