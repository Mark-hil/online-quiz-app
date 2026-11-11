import { sql } from '../../db.js';
import { computeAttemptScoreSummary, type GradableAttemptQuestion, type AttemptScoreSummary } from '../../grading.js';

/**
 * Loads the authoritative question list for an attempt (quiz_attempt_questions first,
 * with safe fallback for non-dynamic quizzes or dynamic quizzes missing frozen rows),
 * computes grades, persists student_answers marks, and runs psychometric calibration.
 */
export async function gradeAttemptFromDb(
  attemptId: string,
  quizId: string,
  options: {
    isDynamicDraw?: boolean;
    drawQuestionCount?: number | null;
    runCalibration?: boolean;
  }
): Promise<AttemptScoreSummary> {
  // 1. Fetch frozen questions assigned to this attempt
  let questions: GradableAttemptQuestion[] = (await sql`
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
    WHERE aq.attempt_id = ${attemptId}
    ORDER BY aq.order_index ASC
  `) as GradableAttemptQuestion[];

  // 2. Fetch current saved student answers
  const studentAnswers = await sql`
    SELECT id, question_id, answer_text
    FROM student_answers
    WHERE attempt_id = ${attemptId}
  `;

  const answersMap = new Map<string, string>();
  studentAnswers.forEach((a: any) => {
    answersMap.set(a.question_id, a.answer_text || '');
  });

  // 3. Safe fallback if quiz_attempt_questions had 0 rows
  if (questions.length === 0) {
    if (!options.isDynamicDraw) {
      questions = (await sql`
        SELECT
          id as question_id,
          question_type,
          correct_answer,
          options,
          marks,
          NULL::uuid as bank_id
        FROM questions
        WHERE quiz_id = ${quizId}
        ORDER BY created_at ASC
      `) as GradableAttemptQuestion[];
    } else if (studentAnswers.length > 0) {
      // Dynamic draw attempt missing frozen rows: recover only the questions the student answered
      // rather than dividing by the entire question_bank.
      const answeredIds = studentAnswers.map((a: any) => a.question_id).filter(Boolean);
      if (answeredIds.length > 0) {
        const bankMatches = (await sql`
          SELECT
            id as question_id,
            question_type,
            correct_answer,
            options,
            marks,
            id as bank_id
          FROM question_bank
          WHERE id = ANY(${answeredIds}::uuid[])
        `) as GradableAttemptQuestion[];

        const fixedMatches =
          bankMatches.length < answeredIds.length
            ? ((await sql`
                SELECT
                  id as question_id,
                  question_type,
                  correct_answer,
                  options,
                  marks,
                  NULL::uuid as bank_id
                FROM questions
                WHERE id = ANY(${answeredIds}::uuid[])
              `) as GradableAttemptQuestion[])
            : [];

        const seen = new Set<string>();
        questions = [...bankMatches, ...fixedMatches].filter((q) => {
          if (!q.question_id || seen.has(q.question_id)) return false;
          seen.add(q.question_id);
          return true;
        });
      }
    }
  }

  // 4. Compute grades with drawQuestionCount denominator protection
  const summary = computeAttemptScoreSummary(questions, answersMap, {
    isDynamicDraw: options.isDynamicDraw,
    drawQuestionCount: options.drawQuestionCount,
  });

  // 5. Persist objective question grades in a single batched statement
  if (summary.gradedQIds.length > 0) {
    await sql`
      UPDATE student_answers AS sa
      SET 
        is_correct = v.is_correct,
        marks_obtained = v.marks_obtained
      FROM (
        SELECT 
          unnest(${summary.gradedQIds}::uuid[]) AS q_id,
          unnest(${summary.gradedIsCorrect}::boolean[]) AS is_correct,
          unnest(${summary.gradedMarksObtained}::int[]) AS marks_obtained
      ) AS v
      WHERE sa.attempt_id = ${attemptId} AND sa.question_id = v.q_id
    `;
  }

  // 6. Reset essay marks pending manual review
  if (summary.essayQIds.length > 0) {
    await sql`
      UPDATE student_answers
      SET is_correct = NULL, marks_obtained = NULL
      WHERE attempt_id = ${attemptId} AND question_id = ANY(${summary.essayQIds}::uuid[])
    `;
  }

  // 7. Non-blocking psychometric calibration
  if (options.runCalibration && summary.calibrationBankIds.length > 0) {
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
            unnest(${summary.calibrationBankIds}::uuid[]) AS b_id,
            unnest(${summary.calibrationAddCorrect}::int[]) AS add_correct
        ) AS v
        WHERE qb.id = v.b_id
      `
    ).catch((calibErr) => console.warn('Non-blocking calibration update notice:', calibErr));
  }

  return summary;
}

