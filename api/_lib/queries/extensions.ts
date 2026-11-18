import { sql } from '../db.js';

/**
 * Computes the total `time_remaining` (extension minutes column) to store on `quiz_attempts`
 * when an Admin extends an active attempt OR reopens an expired/auto-submitted attempt:
 * - If the attempt is still active (`elapsedMinutes <= durationMinutes + currentExtensionMinutes`),
 *   adds `addedMinutes` on top of `currentExtensionMinutes`.
 * - If the attempt has already expired or was auto-submitted (`elapsedMinutes > durationMinutes + currentExtensionMinutes`),
 *   bridges the expired dead time `(elapsedMinutes - durationMinutes)` AND adds `addedMinutes`
 *   so the student receives the full `addedMinutes` on their countdown clock starting from `NOW()`.
 */
export function computeBridgedExtensionMinutes({
  durationMinutes,
  currentExtensionMinutes = 0,
  elapsedMinutes,
  addedMinutes,
}: {
  durationMinutes: number;
  currentExtensionMinutes?: number;
  elapsedMinutes: number;
  addedMinutes: number;
}): number {
  const base = Math.max(0, Number(durationMinutes) || 0);
  const currentExt = Math.max(0, Number(currentExtensionMinutes) || 0);
  const elapsed = Math.max(0, Math.ceil(Number(elapsedMinutes) || 0));
  const add = Math.max(0, Number(addedMinutes) || 0);

  const deficitFromBase = Math.max(0, elapsed - base);
  const effectiveBaseExtension = Math.max(currentExt, deficitFromBase);
  return effectiveBaseExtension + add;
}

export async function getQuizAttemptsForExtension(limit: number = 150) {
  return await sql`
    SELECT 
      qa.id,
      qa.quiz_id,
      qa.student_id,
      qa.started_at,
      qa.submitted_at,
      qa.score,
      q.deadline,
      q.duration_minutes,
      qa.status,
      qa.last_activity,
      qa.time_remaining,
      qa.original_duration,
      qa.extensions_applied,
      qa.cheated,
      qa.cheating_reason,
      p.name as student_name,
      p.email as student_email,
      q.title as quiz_title
    FROM quiz_attempts qa
    JOIN profiles p ON qa.student_id = p.id
    JOIN quizzes q ON qa.quiz_id = q.id
    WHERE qa.status IN ('in_progress', 'expired', 'submitted', 'graded')
    ORDER BY COALESCE(qa.last_activity, qa.submitted_at, qa.started_at) DESC
    LIMIT ${limit}
  `;
}

export async function extendQuizTime(attemptId: string, minutes: number, _userId?: string) {
  const rows = await sql`
    SELECT qa.id, qa.started_at, qa.time_remaining, q.duration_minutes, CURRENT_TIMESTAMP as current_db_time
    FROM quiz_attempts qa
    JOIN quizzes q ON qa.quiz_id = q.id
    WHERE qa.id = ${attemptId}
    LIMIT 1
  `;

  const row = rows[0];
  const serverNowMs = row?.current_db_time ? new Date(row.current_db_time).getTime() : Date.now();
  const startedAtMs = row?.started_at ? new Date(row.started_at).getTime() : serverNowMs;
  const elapsedMinutes = Math.max(0, Math.ceil((serverNowMs - startedAtMs) / (60 * 1000)));

  const newTimeRemaining = row
    ? computeBridgedExtensionMinutes({
        durationMinutes: Number(row.duration_minutes) || 0,
        currentExtensionMinutes: Number(row.time_remaining) || 0,
        elapsedMinutes,
        addedMinutes: Number(minutes) || 0,
      })
    : Math.max(0, Number(minutes) || 0);

  return await sql`
    UPDATE quiz_attempts 
    SET 
      status = 'in_progress',
      submitted_at = NULL,
      graded_at = NULL,
      score = NULL,
      time_remaining = ${newTimeRemaining},
      extensions_applied = COALESCE(extensions_applied, 0) + 1,
      last_activity = NOW()
    WHERE id = ${attemptId}
      AND (cheated IS NOT TRUE)
    RETURNING *
  `;
}

export async function getAttemptExtensionRequests(attemptId: string) {
  return await sql`
    SELECT er.*, p.name as processor_name
    FROM extension_requests er
    LEFT JOIN profiles p ON er.processed_by = p.id
    WHERE er.attempt_id = ${attemptId}
    ORDER BY er.created_at DESC
    LIMIT 1
  `;
}

export async function createExtensionRequest(
  attemptId: string,
  requestedBy: string,
  minutes: number,
  reason: string,
  status: string = 'pending',
  processedBy?: string
) {
  if (status === 'approved' && processedBy) {
    return await sql`
      INSERT INTO extension_requests (attempt_id, requested_by, extension_minutes, reason, status, processed_by, processed_at)
      VALUES (${attemptId}, ${requestedBy}, ${minutes}, ${reason}, 'approved', ${processedBy}, NOW())
      RETURNING *
    `;
  }
  return await sql`
    INSERT INTO extension_requests (attempt_id, requested_by, extension_minutes, reason, status)
    VALUES (${attemptId}, ${requestedBy}, ${minutes}, ${reason}, ${status})
    RETURNING *
  `;
}

export async function getExtensionRequests(limit: number = 50) {
  return await sql`
    SELECT 
      er.*,
      p.name as requested_by_name,
      qa.quiz_id,
      q.title as quiz_title,
      q.deadline as quiz_deadline,
      p2.name as student_name
    FROM extension_requests er
    JOIN profiles p ON er.requested_by = p.id
    JOIN quiz_attempts qa ON er.attempt_id = qa.id
    JOIN quizzes q ON qa.quiz_id = q.id
    JOIN profiles p2 ON qa.student_id = p2.id
    ORDER BY er.created_at DESC
    LIMIT ${limit}
  `;
}

export async function updateExtensionRequestStatus(requestId: string, status: string, processedBy: string) {
  return await sql`
    UPDATE extension_requests 
    SET status = ${status}, processed_at = NOW(), processed_by = ${processedBy}
    WHERE id = ${requestId}
    RETURNING *
  `;
}
