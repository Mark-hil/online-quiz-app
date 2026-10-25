import { describe, it, expect } from 'vitest';
import { 
  QuestionBankItem, 
  ExamBlueprint, 
  BlueprintStratum 
} from '../src/lib/database';

/**
 * Pure simulation sampler replicating the multi-dimensional blueprint sampling logic
 * from api/_lib/handlers/exam/start.ts and QuizPreviewModal.tsx
 */
function sampleBlueprintQuestions(
  blueprint: ExamBlueprint,
  allAvailableQuestions: QuestionBankItem[],
  targetTotalQuestions: number
): {
  drawnQuestions: Array<{ question: QuestionBankItem; stratumId: string; sourceCourseId: string }>;
  deficits: Array<{ stratumId: string; target: number; actual: number }>;
} {
  const drawnQuestionIds = new Set<string>();
  const drawn: Array<{ question: QuestionBankItem; stratumId: string; sourceCourseId: string }> = [];
  const deficits: Array<{ stratumId: string; target: number; actual: number }> = [];

  // Sort strata by priority descending
  const sortedStrata = [...blueprint.strata].sort((a, b) => (b.priority || 0) - (a.priority || 0));

  for (const stratum of sortedStrata) {
    // Filter matching candidate questions
    const eligible = allAvailableQuestions.filter(q => {
      if (drawnQuestionIds.has(q.id)) return false;
      if (q.status && q.status !== 'active') return false;

      // Filter by course_ids
      if (stratum.course_ids && stratum.course_ids.length > 0) {
        if (!stratum.course_ids.includes(q.course_id)) return false;
      }

      // Filter by assessment tiers
      if (stratum.assessment_tiers && stratum.assessment_tiers.length > 0) {
        const itemTier = q.assessment_tier || 'quiz';
        if (!stratum.assessment_tiers.includes(itemTier)) return false;
      }

      // Filter by category prefixes
      if (stratum.category_prefixes && stratum.category_prefixes.length > 0) {
        const prefix = (q.category_prefix || '').toUpperCase();
        const matchesPrefix = stratum.category_prefixes.some(p => p.toUpperCase() === prefix);
        if (!matchesPrefix) return false;
      }

      // Filter by topics
      if (stratum.topics && stratum.topics.length > 0) {
        if (!stratum.topics.includes(q.topic)) return false;
      }

      // Filter by difficulty
      if (stratum.difficulty && stratum.difficulty.length > 0) {
        if (!stratum.difficulty.includes(q.difficulty)) return false;
      }

      return true;
    });

    const targetCount = Math.min(stratum.count, eligible.length);
    const stratumSelected = eligible.slice(0, targetCount);

    for (const q of stratumSelected) {
      drawnQuestionIds.add(q.id);
      drawn.push({
        question: q,
        stratumId: stratum.id,
        sourceCourseId: q.course_id,
      });
    }

    if (stratumSelected.length < stratum.count) {
      deficits.push({
        stratumId: stratum.id,
        target: stratum.count,
        actual: stratumSelected.length,
      });
    }
  }

  // Handle fallback top up if deficit policy is top_up_pool
  const deficitPolicy = blueprint.deficit_policy || 'top_up_pool';
  if (deficitPolicy === 'top_up_pool' && drawn.length < targetTotalQuestions) {
    const remainingNeeded = targetTotalQuestions - drawn.length;
    const remainingEligible = allAvailableQuestions.filter(
      q => !drawnQuestionIds.has(q.id) && q.status === 'active'
    );
    const topUp = remainingEligible.slice(0, remainingNeeded);
    for (const q of topUp) {
      drawnQuestionIds.add(q.id);
      drawn.push({
        question: q,
        stratumId: 'fallback_pool',
        sourceCourseId: q.course_id,
      });
    }
  }

  return { drawnQuestions: drawn, deficits };
}

describe('Multi-Dimensional Question Pooling Engine', () => {
  const mockCourseBank: QuestionBankItem[] = [
    // Course A (CS101) questions
    {
      id: 'q-a1',
      course_id: 'course-cs101',
      topic: 'Algorithms',
      category: 'Final Exam',
      category_prefix: 'FE-26',
      assessment_tier: 'final_exam',
      difficulty: 'hard',
      question_type: 'mcq',
      question_text: 'What is the time complexity of QuickSort average case?',
      options: ['O(N)', 'O(N log N)', 'O(N^2)', 'O(1)'],
      correct_answer: 'O(N log N)',
      marks: 2,
      status: 'active',
      times_answered: 10,
      times_correct: 8,
      created_at: '2026-01-01',
      updated_at: '2026-01-01',
    },
    {
      id: 'q-a2',
      course_id: 'course-cs101',
      topic: 'Data Structures',
      category: 'Midterm',
      category_prefix: 'MID-26',
      assessment_tier: 'mid_semester',
      difficulty: 'medium',
      question_type: 'mcq',
      question_text: 'Which data structure follows LIFO?',
      options: ['Queue', 'Stack', 'Tree', 'Graph'],
      correct_answer: 'Stack',
      marks: 1,
      status: 'active',
      times_answered: 20,
      times_correct: 18,
      created_at: '2026-01-01',
      updated_at: '2026-01-01',
    },
    {
      id: 'q-a3',
      course_id: 'course-cs101',
      topic: 'Loops',
      category: 'Weekly Quiz',
      category_prefix: 'QZ-01',
      assessment_tier: 'quiz',
      difficulty: 'easy',
      question_type: 'mcq',
      question_text: 'Which loop runs at least once?',
      options: ['for', 'while', 'do-while', 'foreach'],
      correct_answer: 'do-while',
      marks: 1,
      status: 'active',
      times_answered: 30,
      times_correct: 28,
      created_at: '2026-01-01',
      updated_at: '2026-01-01',
    },
    // Course B (MATH201) partner course questions
    {
      id: 'q-b1',
      course_id: 'course-math201',
      topic: 'Linear Algebra',
      category: 'Final Exam',
      category_prefix: 'FE-26',
      assessment_tier: 'final_exam',
      difficulty: 'hard',
      question_type: 'mcq',
      question_text: 'What is the determinant of an identity matrix?',
      options: ['0', '1', '-1', 'Infinity'],
      correct_answer: '1',
      marks: 2,
      status: 'active',
      times_answered: 15,
      times_correct: 14,
      created_at: '2026-01-01',
      updated_at: '2026-01-01',
    },
    {
      id: 'q-b2',
      course_id: 'course-math201',
      topic: 'Probability',
      category: 'Midterm',
      category_prefix: 'MID-26',
      assessment_tier: 'mid_semester',
      difficulty: 'medium',
      question_type: 'mcq',
      question_text: 'Probability of rolling an even number on a 6-sided die?',
      options: ['1/6', '1/3', '1/2', '2/3'],
      correct_answer: '1/2',
      marks: 1,
      status: 'active',
      times_answered: 25,
      times_correct: 20,
      created_at: '2026-01-01',
      updated_at: '2026-01-01',
    },
    // Retired item (should never be drawn)
    {
      id: 'q-retired',
      course_id: 'course-cs101',
      topic: 'Algorithms',
      category: 'Final Exam',
      category_prefix: 'FE-26',
      assessment_tier: 'final_exam',
      difficulty: 'hard',
      question_type: 'mcq',
      question_text: 'Retired question about obsolete sorting algorithm',
      options: ['A', 'B', 'C', 'D'],
      correct_answer: 'A',
      marks: 1,
      status: 'retired',
      times_answered: 50,
      times_correct: 40,
      created_at: '2025-01-01',
      updated_at: '2025-01-01',
    },
  ];

  it('samples across multiple courses using pool_course_ids', () => {
    const blueprint: ExamBlueprint = {
      version: '1.0',
      total_draw: 2,
      strata: [
        {
          id: 'cs_stratum',
          course_ids: ['course-cs101'],
          count: 1,
        },
        {
          id: 'math_stratum',
          course_ids: ['course-math201'],
          count: 1,
        },
      ],
      deficit_policy: 'top_up_pool',
    };

    const { drawnQuestions, deficits } = sampleBlueprintQuestions(blueprint, mockCourseBank, 2);

    expect(drawnQuestions).toHaveLength(2);
    expect(deficits).toHaveLength(0);

    const csDrawn = drawnQuestions.find(d => d.stratumId === 'cs_stratum');
    expect(csDrawn).toBeDefined();
    expect(csDrawn?.sourceCourseId).toBe('course-cs101');

    const mathDrawn = drawnQuestions.find(d => d.stratumId === 'math_stratum');
    expect(mathDrawn).toBeDefined();
    expect(mathDrawn?.sourceCourseId).toBe('course-math201');
  });

  it('filters questions strictly by Assessment Classification Tier', () => {
    const blueprint: ExamBlueprint = {
      version: '1.0',
      total_draw: 2,
      strata: [
        {
          id: 'final_exam_tier',
          assessment_tiers: ['final_exam'],
          count: 2,
        },
      ],
      deficit_policy: 'strict',
    };

    const { drawnQuestions } = sampleBlueprintQuestions(blueprint, mockCourseBank, 2);

    expect(drawnQuestions).toHaveLength(2);
    for (const d of drawnQuestions) {
      expect(d.question.assessment_tier).toBe('final_exam');
    }

    const questionIds = drawnQuestions.map(d => d.question.id);
    expect(questionIds).toContain('q-a1');
    expect(questionIds).toContain('q-b1');
    // Retired item must be excluded
    expect(questionIds).not.toContain('q-retired');
  });

  it('filters questions by category prefix', () => {
    const blueprint: ExamBlueprint = {
      version: '1.0',
      total_draw: 2,
      strata: [
        {
          id: 'midterm_prefix_stratum',
          category_prefixes: ['MID-26'],
          count: 2,
        },
      ],
      deficit_policy: 'strict',
    };

    const { drawnQuestions } = sampleBlueprintQuestions(blueprint, mockCourseBank, 2);

    expect(drawnQuestions).toHaveLength(2);
    expect(drawnQuestions.map(d => d.question.id)).toEqual(['q-a2', 'q-b2']);
  });

  it('filters multi-dimensionally by course, tier, topic, and difficulty simultaneously', () => {
    const blueprint: ExamBlueprint = {
      version: '1.0',
      total_draw: 1,
      strata: [
        {
          id: 'precise_stratum',
          course_ids: ['course-cs101'],
          assessment_tiers: ['quiz'],
          topics: ['Loops'],
          difficulty: ['easy'],
          count: 1,
        },
      ],
      deficit_policy: 'strict',
    };

    const { drawnQuestions } = sampleBlueprintQuestions(blueprint, mockCourseBank, 1);

    expect(drawnQuestions).toHaveLength(1);
    expect(drawnQuestions[0].question.id).toBe('q-a3');
    expect(drawnQuestions[0].sourceCourseId).toBe('course-cs101');
    expect(drawnQuestions[0].stratumId).toBe('precise_stratum');
  });

  it('handles deficit with fallback top_up_pool policy without drawing duplicates or retired items', () => {
    const blueprint: ExamBlueprint = {
      version: '1.0',
      total_draw: 3,
      strata: [
        {
          id: 'shortage_stratum',
          topics: ['NonExistentTopic'],
          count: 2,
        },
      ],
      deficit_policy: 'top_up_pool',
    };

    const { drawnQuestions, deficits } = sampleBlueprintQuestions(blueprint, mockCourseBank, 3);

    // Deficit reported for the stratum
    expect(deficits).toHaveLength(1);
    expect(deficits[0].target).toBe(2);
    expect(deficits[0].actual).toBe(0);

    // But total questions topped up to 3 from active bank
    expect(drawnQuestions).toHaveLength(3);
    for (const d of drawnQuestions) {
      expect(d.question.status).toBe('active');
      expect(d.stratumId).toBe('fallback_pool');
    }

    // Unique IDs only
    const uniqueIds = new Set(drawnQuestions.map(d => d.question.id));
    expect(uniqueIds.size).toBe(3);
  });
});
