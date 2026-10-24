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
    tab_switch_count,
    copy_attempts,
    right_click_count,
    suspicious_activity,
  } = body || {};

  if (!attempt_id) {
    throw new HttpError(400, 'Missing attempt_id');
  }

  const rows = await sql`
    SELECT qa.*, q.duration_minutes, q.deadline, CURRENT_TIMESTAMP as current_db_time
    FROM quiz_attempts qa
    JOIN quizzes q ON qa.quiz_id = q.id
    WHERE qa.id = ${attempt_id}
  `;

  if (rows.length === 0) {
    throw new HttpError(404, 'Attempt not found');
  }

  const attempt = rows[0] as any;
  if (attempt.student_id !== user.id) {
    throw new HttpError(403, 'Access denied: attempt does not belong to you');
  }

  if (attempt.status !== 'in_progress') {
    return {
      status: attempt.status,
      time_remaining: 0,
      cheated: attempt.cheated,
    };
  }

  // Calculate elapsed and remaining time
  const serverNow = new Date(attempt.current_db_time || Date.now()).getTime();
  const startedAt = new Date(attempt.started_at).getTime();
  const elapsedSeconds = Math.floor((serverNow - startedAt) / 1000);
  const extensionSeconds = Math.round((attempt.time_remaining || 0) * 60);
  const totalSeconds = (attempt.duration_minutes * 60) + extensionSeconds;
  let remainingSeconds = Math.max(0, totalSeconds - elapsedSeconds);

  if (attempt.deadline) {
    const secondsToDeadline = Math.floor((new Date(attempt.deadline).getTime() - serverNow) / 1000);
    if (secondsToDeadline >= 0) {
      remainingSeconds = Math.min(remainingSeconds, secondsToDeadline);
    }
  }

  // Check if expired
  if (remainingSeconds <= 0) {
    await sql`
      UPDATE quiz_attempts
      SET status = 'graded', submitted_at = NOW(), graded_at = NOW(), last_activity = NOW()
      WHERE id = ${attempt_id}
    `;
    return {
      status: 'expired',
      time_remaining: 0,
    };
  }

  // Update telemetry and touch last_activity
  const updates: any = {};
  if (tab_switch_count !== undefined) updates.tab_switch_count = tab_switch_count;
  if (copy_attempts !== undefined) updates.copy_attempts = copy_attempts;
  if (right_click_count !== undefined) updates.right_click_count = right_click_count;

  await sql`
    UPDATE quiz_attempts
    SET 
      tab_switch_count = COALESCE(${updates.tab_switch_count !== undefined ? updates.tab_switch_count : null}, tab_switch_count),
      copy_attempts = COALESCE(${updates.copy_attempts !== undefined ? updates.copy_attempts : null}, copy_attempts),
      right_click_count = COALESCE(${updates.right_click_count !== undefined ? updates.right_click_count : null}, right_click_count),
      suspicious_activity = COALESCE(${suspicious_activity ? JSON.stringify(suspicious_activity) : null}, suspicious_activity),
      last_activity = NOW()
    WHERE id = ${attempt_id}
  `;

  return {
    status: 'in_progress',
    server_time: new Date().toISOString(),
    time_remaining: remainingSeconds,
  };
});
