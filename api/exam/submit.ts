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

  // 2. Upsert any final answers sent in payload
  if (final_answers && typeof final_answers === 'object') {
    for (const [qId, ansText] of Object.entries(final_answers)) {
      if (typeof ansText === 'string') {
        await sql`
          INSERT INTO student_answers (attempt_id, question_id, answer_text, updated_at)
          VALUES (${attempt_id}, ${qId}, ${ansText}, NOW())
          ON CONFLICT (attempt_id, question_id)
          DO UPDATE SET answer_text = EXCLUDED.answer_text, updated_at = NOW()
        `;
      }
    }
  }

  // 3. Fetch questions with correct_answers for this attempt
  const questions = await sql`
    SELECT 
      aq.order_index,
      COALESCE(qb.id, q.id) as question_id,
      COALESCE(qb.question_type, q.question_type) as question_type,
      COALESCE(qb.correct_answer, q.correct_answer) as correct_answer,
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

  // 4. Server-Side Grading
  let totalMarksObtained = 0;
  let totalPossibleMarks = 0;
  let hasEssayQuestions = false;

  for (const q of questions) {
    const marks = Number(q.marks || 1);
    totalPossibleMarks += marks;

    const studentAnswer = (answersMap.get(q.question_id) || '').trim();

    if (q.question_type === 'essay') {
      hasEssayQuestions = true;
      // Essay questions marked null until lecturer review
      await sql`
        UPDATE student_answers
        SET is_correct = NULL, marks_obtained = NULL
        WHERE attempt_id = ${attempt_id} AND question_id = ${q.question_id}
      `;
    } else {
      // Objective MCQ / True-False
      const isCorrect = !!studentAnswer && studentAnswer.toLowerCase() === (q.correct_answer || '').trim().toLowerCase();
      const marksObtained = isCorrect ? marks : 0;
      totalMarksObtained += marksObtained;

      await sql`
        UPDATE student_answers
        SET is_correct = ${isCorrect}, marks_obtained = ${marksObtained}
        WHERE attempt_id = ${attempt_id} AND question_id = ${q.question_id}
      `;

      // Calibration update for question bank
      if (q.bank_id) {
        try {
          await sql`
            UPDATE question_bank
            SET 
              times_answered = times_answered + 1,
              times_correct = times_correct + (CASE WHEN ${isCorrect} THEN 1 ELSE 0 END),
              empirical_pass_rate = ROUND(((times_correct + (CASE WHEN ${isCorrect} THEN 1 ELSE 0 END))::numeric / (times_answered + 1)::numeric) * 100, 1),
              updated_at = NOW()
            WHERE id = ${q.bank_id}
          `;
        } catch (calibErr) {
          console.warn('Calibration update error:', calibErr);
        }
      }
    }
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
      graded_at = ${!hasEssayQuestions ? sql`NOW()` : null},
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
