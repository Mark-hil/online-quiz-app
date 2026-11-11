import { jsonHandler, HttpError, readJsonBody } from '../../http.js';
import { requireUser } from '../../session.js';
import { sql } from '../../db.js';
import { gradeAttemptFromDb } from './gradeAttempt.js';
import type { ApiRequest, ApiResponse } from '../../types.js';

export default jsonHandler(async (req: ApiRequest, _res: ApiResponse) => {
  if (req.method !== 'POST') {
    throw new HttpError(405, 'Method not allowed. Use POST.');
  }

  const user = await requireUser(req);
  const body = await readJsonBody(req);
  const { attempt_id, final_answers } = body || {};

  if (!attempt_id) {
    throw new HttpError(400, 'Missing attempt_id');
  }

  // 1. Fetch attempt and quiz
  const rows = await sql`
    SELECT qa.*, q.title as quiz_title, q.is_dynamic_draw, q.draw_question_count, q.show_results_immediately
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

  // If already submitted/graded, return existing result
  if (attempt.status === 'submitted' || attempt.status === 'graded') {
    return {
      success: true,
      already_submitted: true,
      attempt,
      score: attempt.score,
    };
  }

  // 2. Upsert any final answers sent in payload in a single batched array query
  if (final_answers && typeof final_answers === 'object') {
    const answerEntries = Object.entries(final_answers).filter(([_, ans]) => typeof ans === 'string');
    if (answerEntries.length > 0) {
      const qIds = answerEntries.map(([qId]) => qId);
      const ansTexts = answerEntries.map(([_, ans]) => ans as string);

      await sql`
        INSERT INTO student_answers (attempt_id, question_id, answer_text, updated_at)
        SELECT ${attempt_id}, unnest(${qIds}::uuid[]), unnest(${ansTexts}::text[]), NOW()
        ON CONFLICT (attempt_id, question_id)
        DO UPDATE SET answer_text = EXCLUDED.answer_text, updated_at = NOW()
      `;
    }
  }

  // 3. Server-Side Grading (authoritative frozen attempt questions + dynamic draw denominator safety)
  const {
    totalMarksObtained,
    totalPossibleMarks,
    scorePercentage,
    hasEssayQuestions,
  } = await gradeAttemptFromDb(attempt_id, attempt.quiz_id, {
    isDynamicDraw: attempt.is_dynamic_draw,
    drawQuestionCount: attempt.draw_question_count,
    runCalibration: true,
  });

  const finalStatus = hasEssayQuestions ? 'submitted' : 'graded';

  const [updatedAttempt] = await sql`
    UPDATE quiz_attempts
    SET
      status = ${finalStatus},
      score = ${scorePercentage},
      submitted_at = NOW(),
      graded_at = ${!hasEssayQuestions ? new Date().toISOString() : null},
      last_activity = NOW()
    WHERE id = ${attempt_id}
    RETURNING *
  `;

  // Create audit log
  await sql`
    INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
    VALUES (
      ${user.id},
      'QUIZ_SUBMITTED',
      'quiz_attempt',
      ${attempt_id},
      ${JSON.stringify({
        quiz_id: attempt.quiz_id,
        score: scorePercentage,
        total_marks: totalMarksObtained,
        possible_marks: totalPossibleMarks,
        has_essay: hasEssayQuestions,
      })}
    )
  `;

  return {
    success: true,
    attempt: updatedAttempt,
    score: scorePercentage,
    total_marks: totalMarksObtained,
    possible_marks: totalPossibleMarks,
    show_results_immediately: attempt.show_results_immediately,
  };
});
