import dns from 'node:dns';
import { neon } from '@neondatabase/serverless';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { isAnswerCorrect } from '../src/utils/quizUtils';

try {
  dns.setDefaultResultOrder('ipv4first');
} catch {}

function loadLocalEnv() {
  const envPath = path.resolve(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const idx = trimmed.indexOf('=');
      if (idx !== -1) {
        const key = trimmed.slice(0, idx).trim();
        const val = trimmed.slice(idx + 1).trim();
        if (process.env[key] === undefined) {
          process.env[key] = val;
        }
      }
    }
  }
}

loadLocalEnv();

const dbUrl = process.env.DATABASE_URL || process.env.VITE_NEON_DATABASE_URL;
if (!dbUrl) {
  console.error('DATABASE_URL not set.');
  process.exit(1);
}

const sql = neon(dbUrl);

async function runHistoricalRegrade() {
  console.log('--- Starting Historical Student Answers Regrade ---');

  // Query candidate answers that might have letter <-> text mismatch or missing evaluation
  const answers = await sql`
    SELECT 
      sa.id as answer_id,
      sa.attempt_id,
      sa.question_id,
      sa.answer_text,
      sa.is_correct as current_is_correct,
      sa.marks_obtained as current_marks,
      COALESCE(qb.marks, q.marks, 1) as q_marks,
      COALESCE(qb.question_type, q.question_type) as q_type,
      COALESCE(qb.correct_answer, q.correct_answer) as q_correct,
      COALESCE(qb.options, q.options) as q_options
    FROM student_answers sa
    JOIN quiz_attempts qa ON sa.attempt_id = qa.id
    LEFT JOIN questions q ON sa.question_id = q.id
    LEFT JOIN question_bank qb ON sa.question_id = qb.id
    WHERE qa.created_at >= NOW() - INTERVAL '60 days'
      AND (sa.is_correct = false OR sa.is_correct IS NULL)
      AND sa.answer_text IS NOT NULL AND sa.answer_text != ''
  `;

  console.log(`Analyzing ${answers.length} target student answers...`);

  let updatedAnswersCount = 0;
  const affectedAttemptIds = new Set<string>();

  for (const a of answers) {
    if (!a.q_type || a.q_type === 'essay') {
      continue;
    }

    const calculatedCorrect = isAnswerCorrect(
      a.answer_text,
      a.q_correct,
      a.q_options,
      a.q_type
    );

    const questionMarks = Number(a.q_marks || 1);
    const expectedMarks = calculatedCorrect ? questionMarks : 0;

    const hasDiscrepancy = 
      a.current_is_correct !== calculatedCorrect || 
      a.current_marks !== expectedMarks;

    if (hasDiscrepancy) {
      console.log(`Fixing answer ${a.answer_id}: text="${a.answer_text}", key="${a.q_correct}", was=${a.current_is_correct} (${a.current_marks}m) -> now=${calculatedCorrect} (${expectedMarks}m)`);
      await sql`
        UPDATE student_answers
        SET 
          is_correct = ${calculatedCorrect},
          marks_obtained = ${expectedMarks}
        WHERE id = ${a.answer_id}
      `;
      updatedAnswersCount++;
      affectedAttemptIds.add(a.attempt_id);
    }
  }

  console.log(`Regraded ${updatedAnswersCount} student answers across ${affectedAttemptIds.size} attempts.`);

  // Recalculate scores for all affected attempts
  let updatedAttemptsCount = 0;
  for (const attemptId of affectedAttemptIds) {
    const answersForAttempt = await sql`
      SELECT 
        sa.marks_obtained,
        COALESCE(qb.marks, q.marks, 1) as q_marks
      FROM student_answers sa
      LEFT JOIN questions q ON sa.question_id = q.id
      LEFT JOIN question_bank qb ON sa.question_id = qb.id
      WHERE sa.attempt_id = ${attemptId}
    `;

    const totalPossible = answersForAttempt.reduce((s: number, a: any) => s + Number(a.q_marks || 1), 0);
    const totalMarks = answersForAttempt.reduce((s: number, a: any) => s + Number(a.marks_obtained || 0), 0);

    if (totalPossible <= 0) continue;

    const newScore = Number(((totalMarks / totalPossible) * 100).toFixed(2));

    await sql`
      UPDATE quiz_attempts
      SET score = ${newScore}
      WHERE id = ${attemptId}
    `;
    console.log(`Attempt ${attemptId}: score updated to ${newScore}% (${totalMarks}/${totalPossible})`);
    updatedAttemptsCount++;
  }

  console.log(`Updated scores for ${updatedAttemptsCount} attempts.`);
  console.log('--- Historical Regrade Complete ---');
}

runHistoricalRegrade().catch((err) => {
  console.error('Historical regrade error:', err);
  process.exit(1);
});
