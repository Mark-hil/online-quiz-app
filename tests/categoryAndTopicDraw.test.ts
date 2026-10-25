import { describe, it, expect } from 'vitest';
import {
  ASSESSMENT_CATEGORIES,
  getCategoryMeta,
  getCategoryLabel,
  getCategoryShortLabel,
  getCategoryBadgeClasses,
  formatTopicDrawSummary,
  parseTopicDrawRules,
} from '../src/utils/categoryUtils';
import { TopicDrawRule } from '../src/lib/database';

describe('Assessment Category Utilities', () => {
  it('defines the standard 5 academic assessment categories', () => {
    const keys = ASSESSMENT_CATEGORIES.map(c => c.key);
    expect(keys).toEqual(['final_exam', 'mid_semester', 'class_test', 'quiz', 'practice']);
  });

  describe('getCategoryMeta & label helpers', () => {
    it('returns exact metadata for valid category keys', () => {
      const finalExam = getCategoryMeta('final_exam');
      expect(finalExam.key).toBe('final_exam');
      expect(finalExam.label).toBe('Final Examination');
      expect(finalExam.shortLabel).toBe('Final Exam');
      expect(getCategoryLabel('final_exam')).toBe('Final Examination');
      expect(getCategoryShortLabel('final_exam')).toBe('Final Exam');
      expect(getCategoryBadgeClasses('final_exam')).toContain('purple');

      const midSem = getCategoryMeta('mid_semester');
      expect(midSem.shortLabel).toBe('Mid-Semester');
      expect(getCategoryBadgeClasses('mid_semester')).toContain('blue');

      const classTest = getCategoryMeta('class_test');
      expect(classTest.shortLabel).toBe('Class Test');
      expect(getCategoryBadgeClasses('class_test')).toContain('amber');

      const quiz = getCategoryMeta('quiz');
      expect(quiz.shortLabel).toBe('Quiz');
      expect(getCategoryBadgeClasses('quiz')).toContain('emerald');

      const practice = getCategoryMeta('practice');
      expect(practice.shortLabel).toBe('Practice');
      expect(getCategoryBadgeClasses('practice')).toContain('slate');
    });

    it('falls back to quiz category on null, undefined, or unknown key', () => {
      expect(getCategoryLabel(null)).toBe('Class Quiz');
      expect(getCategoryLabel(undefined)).toBe('Class Quiz');
      expect(getCategoryLabel('unknown_category')).toBe('Class Quiz');
      expect(getCategoryShortLabel('')).toBe('Quiz');
    });
  });

  describe('parseTopicDrawRules', () => {
    it('returns empty array on falsy inputs', () => {
      expect(parseTopicDrawRules(null)).toEqual([]);
      expect(parseTopicDrawRules(undefined)).toEqual([]);
      expect(parseTopicDrawRules('')).toEqual([]);
    });

    it('returns the same array if already an array', () => {
      const rules: TopicDrawRule[] = [
        { topic: 'Calculus', count: 10 },
        { topic: 'Linear Algebra', count: 5 },
      ];
      expect(parseTopicDrawRules(rules)).toEqual(rules);
    });

    it('parses valid JSON string representation of rules', () => {
      const json = JSON.stringify([
        { topic: 'Data Structures', count: 15 },
        { topic: 'Algorithms', count: 20 },
      ]);
      const result = parseTopicDrawRules(json);
      expect(result).toEqual([
        { topic: 'Data Structures', count: 15 },
        { topic: 'Algorithms', count: 20 },
      ]);
    });

    it('handles malformed JSON string gracefully', () => {
      expect(parseTopicDrawRules('{ bad json')).toEqual([]);
      expect(parseTopicDrawRules('{"not": "an array"}')).toEqual([]);
      expect(parseTopicDrawRules(12345)).toEqual([]);
    });
  });

  describe('formatTopicDrawSummary', () => {
    it('summarizes stratified topic rules and aggregates total count', () => {
      const rules: TopicDrawRule[] = [
        { topic: 'Kinematics', count: 10 },
        { topic: 'Dynamics', count: 15 },
        { topic: 'Optics', count: 5 },
      ];
      const summary = formatTopicDrawSummary(rules, 30);
      expect(summary).toBe('30 items: Kinematics (10), Dynamics (15), Optics (5)');
    });

    it('filters out rules with 0 or negative quota', () => {
      const rules: TopicDrawRule[] = [
        { topic: 'Algebra', count: 8 },
        { topic: 'Geometry', count: 0 },
        { topic: 'Trigonometry', count: 4 },
      ];
      const summary = formatTopicDrawSummary(rules);
      expect(summary).toBe('12 items: Algebra (8), Trigonometry (4)');
    });

    it('returns uniform draw fallback when rules array is empty or all zero', () => {
      expect(formatTopicDrawSummary([], 20)).toBe('Draw 20 items from Course Bank');
      expect(formatTopicDrawSummary(null, 15)).toBe('Draw 15 items from Course Bank');
      expect(formatTopicDrawSummary(undefined, 0)).toBe('Uniform Course Bank Draw');
      expect(formatTopicDrawSummary([{ topic: 'Empty', count: 0 }], 10)).toBe('Draw 10 items from Course Bank');
    });
  });
});
