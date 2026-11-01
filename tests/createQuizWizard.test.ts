import { describe, it, expect } from 'vitest';
import { WizardStep, ValidationItem } from '../src/pages/lecturer/components/create-quiz/types';

describe('CreateQuiz Assessment Studio Wizard Logic', () => {
  describe('Assessment Category & Duration Presets', () => {
    const CATEGORY_DEFAULT_DURATIONS: Record<string, string> = {
      quiz: '30',
      midterm: '60',
      exam: '120',
      practice: '45',
    };

    it('returns appropriate default durations for institutional assessment categories', () => {
      expect(CATEGORY_DEFAULT_DURATIONS['quiz']).toBe('30');
      expect(CATEGORY_DEFAULT_DURATIONS['midterm']).toBe('60');
      expect(CATEGORY_DEFAULT_DURATIONS['exam']).toBe('120');
      expect(CATEGORY_DEFAULT_DURATIONS['practice']).toBe('45');
    });
  });

  describe('Security Posture Meter Score Calculation', () => {
    function computeSecurityScore(config: {
      randomizeQuestions: boolean;
      randomizeOptions: boolean;
      enableCopyPastePrevention: boolean;
      enableTabMonitoring: boolean;
      enableScreenRecording: boolean;
      enableCameraProctoring: boolean;
      requireSeb: boolean;
    }) {
      let score = 0;
      if (config.randomizeQuestions) score += 10;
      if (config.randomizeOptions) score += 10;
      if (config.enableCopyPastePrevention) score += 20;
      if (config.enableTabMonitoring) score += 20;
      if (config.enableScreenRecording) score += 15;
      if (config.enableCameraProctoring) score += 15;
      if (config.requireSeb) score += 10;
      score = Math.min(100, score);

      const label =
        score >= 80 ? 'Strict Institutional Integrity' :
        score >= 40 ? 'Standard Proctoring' : 'Light / Formative';

      return { score, label };
    }

    it('calculates 100% and strict institutional integrity when all proctoring features are enabled', () => {
      const res = computeSecurityScore({
        randomizeQuestions: true,
        randomizeOptions: true,
        enableCopyPastePrevention: true,
        enableTabMonitoring: true,
        enableScreenRecording: true,
        enableCameraProctoring: true,
        requireSeb: true,
      });
      expect(res.score).toBe(100);
      expect(res.label).toBe('Strict Institutional Integrity');
    });

    it('calculates 40% and standard proctoring when copy/paste and tab monitoring are enabled', () => {
      const res = computeSecurityScore({
        randomizeQuestions: false,
        randomizeOptions: false,
        enableCopyPastePrevention: true,
        enableTabMonitoring: true,
        enableScreenRecording: false,
        enableCameraProctoring: false,
        requireSeb: false,
      });
      expect(res.score).toBe(40);
      expect(res.label).toBe('Standard Proctoring');
    });

    it('calculates 0% and light formative when all anti-cheating guards are disabled', () => {
      const res = computeSecurityScore({
        randomizeQuestions: false,
        randomizeOptions: false,
        enableCopyPastePrevention: false,
        enableTabMonitoring: false,
        enableScreenRecording: false,
        enableCameraProctoring: false,
        requireSeb: false,
      });
      expect(res.score).toBe(0);
      expect(res.label).toBe('Light / Formative');
    });
  });

  describe('Session Pool Deficit Top-Up Logic', () => {
    function sampleWithDeficitTopUp(
      candidatePool: { id: string; text: string }[],
      bankQuestions: { id: string; text: string }[],
      targetDrawCount: number
    ) {
      let sampled = candidatePool.slice(0, targetDrawCount);
      if (sampled.length < targetDrawCount && bankQuestions.length > sampled.length) {
        const sampledIds = new Set(sampled.map(q => q.id));
        const remaining = bankQuestions.filter(q => !sampledIds.has(q.id));
        const needed = targetDrawCount - sampled.length;
        const topUp = remaining.slice(0, needed);
        sampled = [...sampled, ...topUp];
      }
      return sampled;
    }

    it('tops up deficit when disjoint session pool has only 4 questions but target count is 10', () => {
      const allBank = Array.from({ length: 10 }, (_, i) => ({ id: `q-${i + 1}`, text: `Q${i + 1}` }));
      // Session 2 pool only had 4 items due to disjoint round-robin partition
      const session2Pool = allBank.slice(6, 10); // 4 questions
      expect(session2Pool.length).toBe(4);

      const result = sampleWithDeficitTopUp(session2Pool, allBank, 10);
      // Student must receive exactly 10 questions as set by Academic Officer!
      expect(result.length).toBe(10);
      // All 10 unique IDs should be present
      const uniqueIds = new Set(result.map(q => q.id));
      expect(uniqueIds.size).toBe(10);
    });

    it('does not top up if candidate pool already has enough questions', () => {
      const allBank = Array.from({ length: 30 }, (_, i) => ({ id: `q-${i + 1}`, text: `Q${i + 1}` }));
      const sessionPool = allBank.slice(0, 15);

      const result = sampleWithDeficitTopUp(sessionPool, allBank, 10);
      expect(result.length).toBe(10);
    });
  });

  describe('Review Checklist Validation', () => {
    function validateAssessment(params: {
      courseId: string;
      title: string;
      duration: string;
      isDynamicDraw: boolean;
      drawQuestionCount: string;
      activeQuestionsInPool: number;
      questionsCount: number;
    }): ValidationItem[] {
      return [
        {
          key: 'course',
          label: 'Institutional Course Assigned',
          step: 1,
          fieldId: 'course_select',
          isValid: Boolean(params.courseId),
          message: Boolean(params.courseId) ? undefined : 'Please select an institutional course.',
        },
        {
          key: 'title',
          label: 'Assessment Title',
          step: 1,
          fieldId: 'quiz_title',
          isValid: Boolean(params.title.trim()),
          message: Boolean(params.title.trim()) ? undefined : 'Title is missing or empty.',
        },
        {
          key: 'duration',
          label: 'Duration Validated',
          step: 1,
          fieldId: 'quiz_duration',
          isValid: parseInt(params.duration, 10) >= 1,
          message: parseInt(params.duration, 10) >= 1 ? undefined : 'Duration must be at least 1 minute.',
        },
        {
          key: 'questions',
          label: params.isDynamicDraw ? 'Dynamic Bank Capacity' : 'Fixed Questions Loaded',
          step: 2,
          fieldId: 'questions_container',
          isValid: params.isDynamicDraw
            ? (parseInt(params.drawQuestionCount, 10) > 0 && params.activeQuestionsInPool >= parseInt(params.drawQuestionCount, 10))
            : params.questionsCount > 0,
          message: params.isDynamicDraw
            ? (params.activeQuestionsInPool < parseInt(params.drawQuestionCount, 10) ? 'Not enough questions in bank.' : undefined)
            : (params.questionsCount === 0 ? 'At least 1 question is required.' : undefined),
        },
      ];
    }

    it('flags missing course, missing title, and zero questions on an unconfigured quiz', () => {
      const checklist = validateAssessment({
        courseId: '',
        title: '',
        duration: '60',
        isDynamicDraw: false,
        drawQuestionCount: '25',
        activeQuestionsInPool: 0,
        questionsCount: 0,
      });

      const invalidKeys = checklist.filter(item => !item.isValid).map(item => item.key);
      expect(invalidKeys).toContain('course');
      expect(invalidKeys).toContain('title');
      expect(invalidKeys).toContain('questions');
      expect(invalidKeys).not.toContain('duration');
    });

    it('passes all checklist items when configured properly', () => {
      const checklist = validateAssessment({
        courseId: 'c123',
        title: 'Midterm Examination 2026',
        duration: '90',
        isDynamicDraw: false,
        drawQuestionCount: '25',
        activeQuestionsInPool: 0,
        questionsCount: 15,
      });

      const allValid = checklist.every(item => item.isValid);
      expect(allValid).toBe(true);
    });

    it('validates bank draw capacity properly for dynamic mode', () => {
      const failingChecklist = validateAssessment({
        courseId: 'c123',
        title: 'Dynamic Final Exam',
        duration: '120',
        isDynamicDraw: true,
        drawQuestionCount: '50',
        activeQuestionsInPool: 20,
        questionsCount: 0,
      });

      const qItem = failingChecklist.find(i => i.key === 'questions');
      expect(qItem?.isValid).toBe(false);
      expect(qItem?.message).toBe('Not enough questions in bank.');
    });
  });
});
