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
  const {
    attempt_id,
    pin,
    compensation_minutes = 0,
    reason = 'Technical Interruption',
  } = body || {};

  if (!attempt_id || !pin) {
    throw new HttpError(400, 'Missing attempt_id or pin');
  }

  // 1. Fetch attempt and associated session
  const rows = await sql`
    SELECT 
      qa.*, 
      q.id as quiz_id,
      qs.access_pin as session_pin,
      qs.id as session_id
    FROM quiz_attempts qa
    JOIN quizzes q ON qa.quiz_id = q.id
    LEFT JOIN quiz_session_students qss ON qss.student_id = qa.student_id
    LEFT JOIN quiz_sessions qs ON qs.id = qss.session_id AND qs.quiz_id = qa.quiz_id
    WHERE qa.id = ${attempt_id}
  `;

  if (rows.length === 0) {
    throw new HttpError(404, 'Attempt not found');
  }

  const attempt = rows[0] as any;
  if (user.role === 'student' && attempt.student_id !== user.id) {
    throw new HttpError(403, 'Access denied: attempt does not belong to you');
  }

  // 2. Validate PIN: Match session PIN or master override setting
  const cleanPin = pin.trim();
  const sessionPin = (attempt.session_pin || '').trim();

  const [masterPinSetting] = await sql`
    SELECT value FROM system_settings WHERE key = 'proctor_master_pin'
  `;
  const masterPin = masterPinSetting?.value ? String(masterPinSetting.value).trim() : null;

  const isValidPin =
    (sessionPin && cleanPin === sessionPin) ||
    (masterPin && cleanPin === masterPin);

  if (!isValidPin) {
    throw new HttpError(401, 'Invalid Invigilator Authorization PIN');
  }

  // 3. Apply compensation minutes if authorized (max 15 mins)
  const comp = Math.min(15, Math.max(0, Number(compensation_minutes) || 0));

  const [updated] = await sql`
    UPDATE quiz_attempts
    SET
      status = 'in_progress',
      time_remaining = COALESCE(time_remaining, 0) + ${comp},
      extensions_applied = COALESCE(extensions_applied, 0) + (CASE WHEN ${comp} > 0 THEN 1 ELSE 0 END),
      last_activity = NOW()
    WHERE id = ${attempt_id}
    RETURNING *
  `;

  // Log to extension_requests
  if (comp > 0) {
    await sql`
      INSERT INTO extension_requests (attempt_id, requested_by, extension_minutes, reason, status, processed_at)
      VALUES (${attempt_id}, ${user.id}, ${comp}, ${reason}, 'approved', NOW())
    `;
  }

  return {
    success: true,
    authorized: true,
    compensation_minutes: comp,
    new_time_remaining: updated.time_remaining,
    attempt: updated,
  };
});
