import { jsonHandler, HttpError, readJsonBody } from '../../http.js';
import { requireUser } from '../../session.js';
import { sql } from '../../db.js';
import { isAnswerCorrect } from '../../grading.js';
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
    SELECT qa.*, q.title as quiz_title, q.is_dynamic_draw, q.show_results_immediately
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

  // 3. Fetch questions with correct_answers and options for this attempt
  const questions = await sql`
    SELECT 
      aq.order_index,
      COALESCE(qb.id, q.id) as question_id,
      COALESCE(qb.question_type, q.question_type) as question_type,
      COALESCE(qb.correct_answer, q.correct_answer) as correct_answer,
      COALESCE(qb.options, q.options) as options,
      COALESCE(qb.marks, q.marks) as marks,
      qb.id as bank_id
    FROM quiz_attempt_questions aq
    LEFT JOIN question_bank qb ON aq.question_bank_id = qb.id
    LEFT JOIN questions q ON aq.question_id = q.id
    WHERE aq.attempt_id = ${attempt_id}
    ORDER BY aq.order_index ASC
  `;

  // Fetch current saved student answers
  const studentAnswers = await sql`
    SELECT id, question_id, answer_text
    FROM student_answers
    WHERE attempt_id = ${attempt_id}
  `;

  const answersMap = new Map<string, string>();
  studentAnswers.forEach((a: any) => {
    answersMap.set(a.question_id, a.answer_text || '');
  });

  // 4. Server-Side Grading (Multi-Row Batched Execution for 1,000+ Concurrent Students)
  let totalMarksObtained = 0;
  let totalPossibleMarks = 0;
  let hasEssayQuestions = false;

  const essayQIds: string[] = [];
  const gradedQIds: string[] = [];
  const gradedIsCorrect: boolean[] = [];
  const gradedMarksObtained: number[] = [];
  const calibrationBankIds: string[] = [];
  const calibrationAddCorrect: number[] = [];

  for (const q of questions) {
    const marks = Number(q.marks || 1);
    totalPossibleMarks += marks;

    const studentAnswer = (answersMap.get(q.question_id) || '').trim();

    if (q.question_type === 'essay') {
      hasEssayQuestions = true;
      essayQIds.push(q.question_id);
    } else {
      const isCorrect = isAnswerCorrect(studentAnswer, q.correct_answer, q.options, q.question_type);
      const marksObtained = isCorrect ? marks : 0;
      totalMarksObtained += marksObtained;

      gradedQIds.push(q.question_id);
      gradedIsCorrect.push(isCorrect);
      gradedMarksObtained.push(marksObtained);

      if (q.bank_id) {
        calibrationBankIds.push(q.bank_id);
        calibrationAddCorrect.push(isCorrect ? 1 : 0);
      }
    }
  }

  // A. Execute all objective question grades in a SINGLE batched SQL statement
  if (gradedQIds.length > 0) {
    await sql`
      UPDATE student_answers AS sa
      SET 
        is_correct = v.is_correct,
        marks_obtained = v.marks_obtained
      FROM (
        SELECT 
          unnest(${gradedQIds}::uuid[]) AS q_id,
          unnest(${gradedIsCorrect}::boolean[]) AS is_correct,
          unnest(${gradedMarksObtained}::int[]) AS marks_obtained
      ) AS v
      WHERE sa.attempt_id = ${attempt_id} AND sa.question_id = v.q_id
    `;
  }

  // B. Execute essay reset in a single statement
  if (essayQIds.length > 0) {
    await sql`
      UPDATE student_answers
      SET is_correct = NULL, marks_obtained = NULL
      WHERE attempt_id = ${attempt_id} AND question_id = ANY(${essayQIds}::uuid[])
    `;
  }

  // C. Execute psychometric calibration in a single background batched query
  if (calibrationBankIds.length > 0) {
    Promise.resolve(
      sql`
        UPDATE question_bank AS qb
        SET 
          times_answered = qb.times_answered + 1,
          times_correct = qb.times_correct + v.add_correct,
          empirical_pass_rate = ROUND(((qb.times_correct + v.add_correct)::numeric / (qb.times_answered + 1)::numeric) * 100, 1),
          updated_at = NOW()
        FROM (
          SELECT 
            unnest(${calibrationBankIds}::uuid[]) AS b_id,
            unnest(${calibrationAddCorrect}::int[]) AS add_correct
        ) AS v
        WHERE qb.id = v.b_id
      `
    ).catch(calibErr => console.warn('Non-blocking calibration update notice:', calibErr));
  }

  const scorePercentage = totalPossibleMarks > 0
    ? Math.round((totalMarksObtained / totalPossibleMarks) * 1000) / 10
    : 0;

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
