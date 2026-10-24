import { sql } from '../db.js';

export async function getQuizAttemptsForExtension(limit: number = 100) {
  return await sql`
    SELECT 
      qa.id,
      qa.quiz_id,
      qa.student_id,
      qa.started_at,
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
    WHERE qa.status IN ('in_progress', 'expired')
    ORDER BY qa.last_activity DESC
    LIMIT ${limit}
  `;
}

export async function extendQuizTime(attemptId: string, minutes: number, _userId?: string) {
  return await sql`
    UPDATE quiz_attempts 
    SET 
      status = 'in_progress',
      submitted_at = NULL,
      graded_at = NULL,
      time_remaining = COALESCE(time_remaining, 0) + ${minutes},
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
