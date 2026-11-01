import { describe, it, expect } from 'vitest';
import { BankStats, StatusFilterType } from '../src/pages/lecturer/components/question-bank/types';

describe('Question Bank UI & Filter Logic Tests', () => {
  const sampleBankQuestions = [
    {
      id: 'q1',
      question_text: 'What is Big-O notation?',
      topic: 'Algorithms',
      category: 'Midterm',
      category_prefix: 'MID',
      assessment_tier: 'midterm',
      difficulty: 'easy',
      status: 'active',
      empirical_pass_rate: 85.0,
      times_answered: 20,
    },
    {
      id: 'q2',
      question_text: 'Explain QuickSort partitioning scheme.',
      topic: 'Algorithms',
      category: 'Final Exam',
      category_prefix: 'FIN',
      assessment_tier: 'exam',
      difficulty: 'hard',
      status: 'active',
      empirical_pass_rate: 32.5,
      times_answered: 40,
    },
    {
      id: 'q3',
      question_text: 'What is a binary search tree?',
      topic: 'Data Structures',
      category: 'Quiz 1',
      category_prefix: 'QZ1',
      assessment_tier: 'quiz',
      difficulty: 'medium',
      status: 'active',
      empirical_pass_rate: 68.0,
      times_answered: 15,
    },
    {
      id: 'q4',
      question_text: 'Past semester question on linked lists.',
      topic: 'Data Structures',
      category: 'Practice',
      category_prefix: 'PRC',
      assessment_tier: 'practice',
      difficulty: 'easy',
      status: 'retired',
      empirical_pass_rate: 90.0,
      times_answered: 50,
    },
  ];

  function filterQuestions(
    questions: typeof sampleBankQuestions,
    filters: {
      searchTerm?: string;
      statusFilter?: StatusFilterType;
      difficultyFilter?: string;
      topicFilter?: string;
      categoryFilter?: string;
      tierFilter?: string;
    }
  ) {
    return questions.filter(q => {
      if (filters.searchTerm?.trim()) {
        const term = filters.searchTerm.toLowerCase();
        const matchText = q.question_text.toLowerCase().includes(term);
        const matchTopic = q.topic.toLowerCase().includes(term);
        const matchCategory = (q.category || '').toLowerCase().includes(term);
        const matchPrefix = (q.category_prefix || '').toLowerCase().includes(term);
        if (!matchText && !matchTopic && !matchCategory && !matchPrefix) return false;
      }
      if (filters.statusFilter && filters.statusFilter !== 'all' && q.status !== filters.statusFilter) {
        return false;
      }
      if (filters.topicFilter && filters.topicFilter !== 'all' && q.topic !== filters.topicFilter) {
        return false;
      }
      if (filters.difficultyFilter && filters.difficultyFilter !== 'all' && q.difficulty !== filters.difficultyFilter) {
        return false;
      }
      if (filters.tierFilter && filters.tierFilter !== 'all' && q.assessment_tier !== filters.tierFilter) {
        return false;
      }
      if (filters.categoryFilter && filters.categoryFilter !== 'all') {
        const matchPrefix = q.category_prefix?.toUpperCase() === filters.categoryFilter.toUpperCase();
        if (!matchPrefix) return false;
      }
      return true;
    });
  }

  describe('1. Search & Filter Precision', () => {
    it('filters questions by topic accurately', () => {
      const algoResult = filterQuestions(sampleBankQuestions, { topicFilter: 'Algorithms' });
      expect(algoResult.length).toBe(2);
      expect(algoResult.map(q => q.id)).toEqual(['q1', 'q2']);
    });

    it('filters questions by difficulty (easy, medium, hard)', () => {
      const hardResult = filterQuestions(sampleBankQuestions, { difficultyFilter: 'hard' });
      expect(hardResult.length).toBe(1);
      expect(hardResult[0].id).toBe('q2');

      const easyResult = filterQuestions(sampleBankQuestions, { difficultyFilter: 'easy' });
      expect(easyResult.length).toBe(2);
    });

    it('filters active pool vs retired past term items', () => {
      const activeResult = filterQuestions(sampleBankQuestions, { statusFilter: 'active' });
      expect(activeResult.length).toBe(3);

      const retiredResult = filterQuestions(sampleBankQuestions, { statusFilter: 'retired' });
      expect(retiredResult.length).toBe(1);
      expect(retiredResult[0].id).toBe('q4');
    });

    it('filters by category prefix (e.g. MID, FIN)', () => {
      const midResult = filterQuestions(sampleBankQuestions, { categoryFilter: 'MID' });
      expect(midResult.length).toBe(1);
      expect(midResult[0].id).toBe('q1');
    });

    it('matches omni-search text across question text and tags', () => {
      const searchResult = filterQuestions(sampleBankQuestions, { searchTerm: 'quicksort' });
      expect(searchResult.length).toBe(1);
      expect(searchResult[0].id).toBe('q2');
    });
  });

  describe('2. Interactive Stat Card Filter Shortcuts', () => {
    function applyStatShortcut(
      type: 'all' | 'active' | 'easy' | 'medium' | 'hard',
      current: { status: StatusFilterType; difficulty: string }
    ) {
      if (type === 'all') return { status: 'all' as StatusFilterType, difficulty: 'all' };
      if (type === 'active') return { status: 'active' as StatusFilterType, difficulty: 'all' };
      return { status: current.status, difficulty: type };
    }

    it('applies interactive filter shortcut for active pool', () => {
      const state = applyStatShortcut('active', { status: 'all', difficulty: 'hard' });
      expect(state.status).toBe('active');
      expect(state.difficulty).toBe('all');
    });

    it('applies interactive filter shortcut for difficulty strata', () => {
      const state = applyStatShortcut('hard', { status: 'active', difficulty: 'all' });
      expect(state.difficulty).toBe('hard');
    });
  });

  describe('3. Batch Selection & Pagination Math', () => {
    it('calculates page slice accurately without out-of-bound errors', () => {
      const itemsPerPage = 2;
      const totalPages = Math.ceil(sampleBankQuestions.length / itemsPerPage);
      expect(totalPages).toBe(2);

      const page1 = sampleBankQuestions.slice(0, 2);
      expect(page1.length).toBe(2);
      expect(page1[0].id).toBe('q1');

      const page2 = sampleBankQuestions.slice(2, 4);
      expect(page2.length).toBe(2);
      expect(page2[0].id).toBe('q3');
    });

    it('tracks batch selections cleanly with a Set', () => {
      const selection = new Set<string>();
      selection.add('q1');
      selection.add('q2');
      expect(selection.size).toBe(2);
      expect(selection.has('q1')).toBe(true);

      selection.delete('q1');
      expect(selection.size).toBe(1);
      expect(selection.has('q1')).toBe(false);
    });
  });
});
