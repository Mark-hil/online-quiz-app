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
  const { quiz_id, session_pin } = body || {};

  if (!quiz_id) {
    throw new HttpError(400, 'Missing quiz_id');
  }

  // 1. Fetch quiz
  const quizzes = await sql`SELECT * FROM quizzes WHERE id = ${quiz_id}`;
  if (quizzes.length === 0) {
    throw new HttpError(404, 'Quiz not found');
  }
  const quiz = quizzes[0] as any;

  if (user.role === 'student' && quiz.status !== 'published') {
    throw new HttpError(403, 'Quiz is not published');
  }

  const now = new Date();
  if (quiz.deadline && new Date(quiz.deadline) < now) {
    throw new HttpError(403, 'Quiz deadline has expired');
  }

  // 2. Multi-session gatekeeper check
  let assignedSession: any = null;
  if (quiz.has_multiple_sessions) {
    const studentSessions = await sql`
      SELECT qs.* 
      FROM quiz_session_students qss
      JOIN quiz_sessions qs ON qss.session_id = qs.id
      WHERE qs.quiz_id = ${quiz_id} AND qss.student_id = ${user.id}
      LIMIT 1
    `;
    assignedSession = studentSessions[0] || null;

    if (!assignedSession) {
      throw new HttpError(403, 'You are not assigned to any active session cohort for this exam.');
    }

    const startTime = new Date(assignedSession.start_time).getTime();
    const endTime = new Date(assignedSession.end_time).getTime();
    const nowMs = now.getTime();

    if (nowMs < startTime) {
      throw new HttpError(403, `Session cohort has not started yet. Starts at ${assignedSession.start_time}`);
    }

    if (assignedSession.access_pin) {
      if (!session_pin || session_pin.trim() !== assignedSession.access_pin.trim()) {
        throw new HttpError(401, 'Invalid session PIN required to access this exam room');
      }
    }
  }

  // 3. Check for existing attempts
  const existingAttempts = await sql`
    SELECT qa.*, CURRENT_TIMESTAMP as current_db_time 
    FROM quiz_attempts qa
    WHERE qa.quiz_id = ${quiz_id} AND qa.student_id = ${user.id}
    ORDER BY qa.started_at DESC
  `;

  const completedAttempt = existingAttempts.find((a: any) =>
    a.status === 'submitted' || a.status === 'graded'
  );
  if (completedAttempt) {
    return {
      status: 'completed',
      attempt: completedAttempt,
    };
  }

  const inProgressAttempt = existingAttempts.find((a: any) => a.status === 'in_progress');

  if (inProgressAttempt) {
    const serverNow = new Date(inProgressAttempt.current_db_time || Date.now()).getTime();
    const attemptAgeMs = serverNow - new Date(inProgressAttempt.started_at).getTime();
    const extensionSeconds = Math.round((inProgressAttempt.time_remaining || 0) * 60);
    const totalSeconds = (quiz.duration_minutes * 60) + extensionSeconds;
    const elapsedSeconds = Math.floor(attemptAgeMs / 1000);
    let remainingSeconds = Math.max(0, totalSeconds - elapsedSeconds);

    if (quiz.deadline) {
      const secondsToDeadline = Math.floor((new Date(quiz.deadline).getTime() - serverNow) / 1000);
      if (secondsToDeadline >= 0) {
        remainingSeconds = Math.min(remainingSeconds, secondsToDeadline);
      }
    }

    if (remainingSeconds <= 0) {
      // Auto-finalize expired attempt
      const [finalized] = await sql`
        UPDATE quiz_attempts
        SET status = 'graded', submitted_at = NOW(), graded_at = NOW()
        WHERE id = ${inProgressAttempt.id}
        RETURNING *
      `;
      return {
        status: 'completed',
        attempt: finalized,
      };
    }

    // Load attempt questions and existing answers
    const questions = await sql`
      SELECT 
        aq.id as attempt_question_id,
        aq.order_index,
        COALESCE(qb.id, q.id) as id,
        COALESCE(qb.question_text, q.question_text) as question_text,
        COALESCE(qb.question_type, q.question_type) as question_type,
        COALESCE(qb.options, q.options) as options,
        COALESCE(qb.marks, q.marks) as marks,
        qb.topic,
        qb.difficulty
      FROM quiz_attempt_questions aq
      LEFT JOIN question_bank qb ON aq.question_bank_id = qb.id
      LEFT JOIN questions q ON aq.question_id = q.id
      WHERE aq.attempt_id = ${inProgressAttempt.id}
      ORDER BY aq.order_index ASC
    `;

    const savedAnswers = await sql`
      SELECT question_id, answer_text, is_flagged 
      FROM student_answers 
      WHERE attempt_id = ${inProgressAttempt.id}
    `;

    const answerMap: Record<string, string> = {};
    savedAnswers.forEach((a: any) => {
      if (a.answer_text) answerMap[a.question_id] = a.answer_text;
    });

    return {
      status: 'in_progress',
      attempt: inProgressAttempt,
      questions,
      answers: answerMap,
      time_remaining: remainingSeconds,
    };
  }

  // 4. Create new attempt
  const [newAttempt] = await sql`
    INSERT INTO quiz_attempts (quiz_id, student_id, started_at, status, user_agent)
    VALUES (${quiz_id}, ${user.id}, NOW(), 'in_progress', ${req.headers['user-agent'] || null})
    RETURNING *
  `;

  // 5. Select or draw questions
  let rawQuestions: any[] = [];
  if (quiz.is_dynamic_draw && quiz.course_id) {
    let topicRules: Array<{ topic: string; count: number }> = [];
    if (quiz.topic_draw_rules) {
      if (Array.isArray(quiz.topic_draw_rules)) {
        topicRules = quiz.topic_draw_rules;
      } else if (typeof quiz.topic_draw_rules === 'string') {
        try {
          topicRules = JSON.parse(quiz.topic_draw_rules);
        } catch {
          topicRules = [];
        }
      }
    }

    // Filter valid rules with positive count
    topicRules = topicRules.filter(
      (r) => r && typeof r.topic === 'string' && r.topic.trim().length > 0 && typeof r.count === 'number' && r.count > 0
    );

    if (topicRules.length > 0) {
      // Stratified Topic-based draw
      const selectedIds: string[] = [];
      for (const rule of topicRules) {
        const topicRows = await sql`
          SELECT id, question_text, question_type, options, marks, topic, difficulty
          FROM question_bank
          WHERE course_id = ${quiz.course_id}
            AND status = 'active'
            AND LOWER(TRIM(topic)) = LOWER(TRIM(${rule.topic}))
            ${selectedIds.length > 0 ? sql`AND NOT (id = ANY(${selectedIds}))` : sql``}
          ORDER BY RANDOM()
          LIMIT ${rule.count}
        `;
        for (const row of topicRows) {
          selectedIds.push(row.id);
          rawQuestions.push(row);
        }
      }

      // Check if deficit exists compared to quiz.draw_question_count or total planned
      const totalPlanned = quiz.draw_question_count || topicRules.reduce((acc, r) => acc + (Number(r.count) || 0), 0);
      const deficit = totalPlanned - rawQuestions.length;
      if (deficit > 0) {
        const topUpRows = await sql`
          SELECT id, question_text, question_type, options, marks, topic, difficulty
          FROM question_bank
          WHERE course_id = ${quiz.course_id}
            AND status = 'active'
            ${selectedIds.length > 0 ? sql`AND NOT (id = ANY(${selectedIds}))` : sql``}
          ORDER BY RANDOM()
          LIMIT ${deficit}
        `;
        rawQuestions.push(...topUpRows);
      }
    } else {
      // Standard Flat Random Pool Draw
      const drawCount = quiz.draw_question_count || 10;
      rawQuestions = await sql`
        SELECT id, question_text, question_type, options, marks, topic, difficulty
        FROM question_bank
        WHERE course_id = ${quiz.course_id} AND status = 'active'
        ORDER BY RANDOM()
        LIMIT ${drawCount}
      `;
    }

    // If randomize_questions is enabled, shuffle the gathered questions
    if (quiz.randomize_questions) {
      for (let i = rawQuestions.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [rawQuestions[i], rawQuestions[j]] = [rawQuestions[j], rawQuestions[i]];
      }
    }
  } else {
    rawQuestions = await sql`
      SELECT id, question_text, question_type, options, marks
      FROM questions
      WHERE quiz_id = ${quiz_id}
      ORDER BY ${quiz.randomize_questions ? sql`RANDOM()` : sql`id ASC`}
    `;
  }

  // Save question ordering into quiz_attempt_questions
  const questionsToReturn = [];
  for (let i = 0; i < rawQuestions.length; i++) {
    const q = rawQuestions[i];
    const isBank = quiz.is_dynamic_draw;
    await sql`
      INSERT INTO quiz_attempt_questions (attempt_id, question_bank_id, question_id, order_index)
      VALUES (${newAttempt.id}, ${isBank ? q.id : null}, ${!isBank ? q.id : null}, ${i})
      ON CONFLICT DO NOTHING
    `;
    questionsToReturn.push({
      id: q.id,
      order_index: i,
      question_text: q.question_text,
      question_type: q.question_type,
      options: q.options,
      marks: q.marks,
      topic: q.topic,
      difficulty: q.difficulty,
    });
  }

  return {
    status: 'started',
    attempt: newAttempt,
    questions: questionsToReturn,
    answers: {},
    time_remaining: quiz.duration_minutes * 60,
  };
});
