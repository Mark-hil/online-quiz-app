import { describe, it, expect } from 'vitest';
import { computeAttemptScoreSummary, type GradableAttemptQuestion } from '../api/_lib/grading';
import {
  computeDynamicDrawPossibleMarks,
  getEffectiveQuizTotalMarks,
  resolveAttemptQuestionsForGrading,
} from '../src/utils/quizUtils';

function makeBankQuestions(count: number, marks = 1): any[] {
  return Array.from({ length: count }, (_, idx) => ({
    id: `q-${idx + 1}`,
    question_id: `q-${idx + 1}`,
    question_text: `Question ${idx + 1}`,
    question_type: 'mcq',
    options: ['A1', 'B1', 'C1', 'D1'],
    correct_answer: 'A1',
    marks,
    bank_id: `q-${idx + 1}`,
  }));
}

describe('Dynamic Draw Scoring Engine (Backend computeAttemptScoreSummary)', () => {
  it('scores frozen 10-question draw out of 10, never the 50-question bank', () => {
    const drawnQuestions: GradableAttemptQuestion[] = makeBankQuestions(10);
    const answers = new Map<string, string>();
    for (let i = 1; i <= 8; i++) answers.set(`q-${i}`, 'A1');
    answers.set('q-9', 'B1');
    answers.set('q-10', 'C1');

    const summary = computeAttemptScoreSummary(drawnQuestions, answers, {
      isDynamicDraw: true,
      drawQuestionCount: 10,
    });

    expect(summary.totalMarksObtained).toBe(8);
    expect(summary.totalPossibleMarks).toBe(10);
    expect(summary.scorePercentage).toBe(80);
  });

  it('caps denominator at drawQuestionCount when frozen attempt rows are missing and some items were skipped', () => {
    // Only 8 answered questions were recovered from a 10-question draw (2 skipped)
    const recoveredQuestions: GradableAttemptQuestion[] = makeBankQuestions(8);
    const answers = new Map<string, string>();
    for (let i = 1; i <= 8; i++) answers.set(`q-${i}`, 'A1');

    const summary = computeAttemptScoreSummary(recoveredQuestions, answers, {
      isDynamicDraw: true,
      drawQuestionCount: 10,
    });

    expect(summary.totalMarksObtained).toBe(8);
    expect(summary.totalPossibleMarks).toBe(10);
    expect(summary.scorePercentage).toBe(80);
  });

  it('calculates weighted marks accurately across drawn questions', () => {
    const drawnQuestions: GradableAttemptQuestion[] = makeBankQuestions(10, 2);
    const answers = new Map<string, string>();
    for (let i = 1; i <= 7; i++) answers.set(`q-${i}`, 'A1');

    const summary = computeAttemptScoreSummary(drawnQuestions, answers, {
      isDynamicDraw: true,
      drawQuestionCount: 10,
    });

    expect(summary.totalMarksObtained).toBe(14);
    expect(summary.totalPossibleMarks).toBe(20);
    expect(summary.scorePercentage).toBe(70);
  });
});

describe('Dynamic Draw Frontend Resolution (resolveAttemptQuestionsForGrading)', () => {
  it('uses frozen attempt questions first and ignores full bank length', async () => {
    const bank = makeBankQuestions(50);
    const frozen = bank.slice(0, 10).map((q, idx) => ({
      ...q,
      question_bank_id: q.id,
      order_index: idx + 1,
    }));

    const res = await resolveAttemptQuestionsForGrading({
      attemptId: 'att-1',
      quiz: {
        id: 'quiz-1',
        is_dynamic_draw: true,
        draw_question_count: 10,
      },
      studentAnswers: frozen.map((q) => ({ question_id: q.id })),
      fetchAttemptQuestions: async () => frozen,
      fetchQuizQuestions: async () => bank,
    });

    expect(res.usedFrozen).toBe(true);
    expect(res.questions).toHaveLength(10);
    expect(res.totalPossibleMarks).toBe(10);
  });

  it('never uses the 50-question bank as denominator when frozen rows are empty', async () => {
    const bank = makeBankQuestions(50);
    const studentAnswers = bank.slice(0, 10).map((q) => ({ question_id: q.id }));

    const res = await resolveAttemptQuestionsForGrading({
      attemptId: 'att-2',
      quiz: {
        id: 'quiz-1',
        is_dynamic_draw: true,
        draw_question_count: 10,
      },
      studentAnswers,
      fetchAttemptQuestions: async () => [],
      fetchQuizQuestions: async () => bank,
    });

    expect(res.usedFrozen).toBe(false);
    expect(res.questions).toHaveLength(10);
    expect(res.totalPossibleMarks).toBe(10);
  });

  it('floors denominator at draw_question_count when student skipped questions and frozen rows are empty', async () => {
    const matched = makeBankQuestions(6);
    expect(computeDynamicDrawPossibleMarks(matched, 10)).toBe(10);
  });

  it('returns draw_question_count as effective total marks when quiz.total_marks is stale', () => {
    const staleQuiz = {
      is_dynamic_draw: true,
      draw_question_count: 20,
      total_marks: 100,
    };
    expect(getEffectiveQuizTotalMarks(staleQuiz)).toBe(20);
  });
});

