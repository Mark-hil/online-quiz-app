import { describe, it, expect } from 'vitest';
import { parseOptions, isAnswerCorrect, formatDisplayCorrectAnswer, isOptionMatch } from '../src/utils/quizUtils';

describe('parseOptions', () => {
  it('unwraps array where item 0 is a JSON-stringified array with blank trailing options', () => {
    const raw = ['["3","4","5","6"]', '', '', ''];
    const result = parseOptions(raw);
    expect(result).toEqual(['3', '4', '5', '6']);
  });

  it('unwraps single-item array wrapping a JSON string', () => {
    const raw = ['["Paris", "London", "Tokyo", "Berlin"]'];
    const result = parseOptions(raw);
    expect(result).toEqual(['Paris', 'London', 'Tokyo', 'Berlin']);
  });

  it('unwraps double-stringified JSON string', () => {
    const raw = '"[\\"3\\",\\"4\\",\\"5\\",\\"6\\"]"';
    const result = parseOptions(raw);
    expect(result).toEqual(['3', '4', '5', '6']);
  });

  it('unwraps standard JSON string', () => {
    const raw = '["3", "4", "5", "6"]';
    const result = parseOptions(raw);
    expect(result).toEqual(['3', '4', '5', '6']);
  });

  it('preserves clean array of options', () => {
    const raw = ['Alpha', 'Beta', 'Gamma', 'Delta'];
    const result = parseOptions(raw);
    expect(result).toEqual(['Alpha', 'Beta', 'Gamma', 'Delta']);
  });

  it('handles object key-value options', () => {
    const raw = { a: 'Apple', b: 'Banana' };
    const result = parseOptions(raw);
    expect(result).toEqual(['Apple', 'Banana']);
  });

  it('handles null and undefined gracefully', () => {
    expect(parseOptions(null)).toEqual([]);
    expect(parseOptions(undefined)).toEqual([]);
    expect(parseOptions('')).toEqual([]);
  });
});

describe('isAnswerCorrect', () => {
  const planetOptions = ['Mars', 'Jupiter', 'Saturn', 'Earth'];

  it('matches option text when correct answer is a letter key ("B")', () => {
    expect(isAnswerCorrect('Jupiter', 'B', planetOptions, 'mcq')).toBe(true);
    expect(isAnswerCorrect('jupiter', 'b', planetOptions, 'mcq')).toBe(true);
    expect(isAnswerCorrect('Mars', 'B', planetOptions, 'mcq')).toBe(false);
  });

  it('matches letter key when correct answer is option text ("Jupiter")', () => {
    expect(isAnswerCorrect('B', 'Jupiter', planetOptions, 'mcq')).toBe(true);
    expect(isAnswerCorrect('b', 'jupiter', planetOptions, 'mcq')).toBe(true);
    expect(isAnswerCorrect('A', 'Jupiter', planetOptions, 'mcq')).toBe(false);
  });

  it('matches option text when correct answer is numeric index ("1")', () => {
    expect(isAnswerCorrect('Jupiter', '1', planetOptions, 'mcq')).toBe(true);
    expect(isAnswerCorrect('Mars', '1', planetOptions, 'mcq')).toBe(false);
  });

  it('handles True/False variants robustly', () => {
    expect(isAnswerCorrect('True', 'A', [], 'true_false')).toBe(true);
    expect(isAnswerCorrect('true', 'TRUE', [], 'true_false')).toBe(true);
    expect(isAnswerCorrect('1', 'true', [], 'true_false')).toBe(true);
    expect(isAnswerCorrect('False', 'B', [], 'true_false')).toBe(true);
    expect(isAnswerCorrect('false', 'FALSE', [], 'true_false')).toBe(true);
    expect(isAnswerCorrect('0', 'false', [], 'true_false')).toBe(true);
    expect(isAnswerCorrect('False', 'A', [], 'true_false')).toBe(false);
  });

  it('handles option prefix strings like "B. Jupiter"', () => {
    expect(isAnswerCorrect('B. Jupiter', 'Jupiter', planetOptions, 'mcq')).toBe(true);
    expect(isAnswerCorrect('Jupiter', 'B. Jupiter', planetOptions, 'mcq')).toBe(true);
    expect(isAnswerCorrect('(B) Jupiter', 'Jupiter', planetOptions, 'mcq')).toBe(true);
  });

  it('returns false for empty or null answers', () => {
    expect(isAnswerCorrect('', 'B', planetOptions, 'mcq')).toBe(false);
    expect(isAnswerCorrect(null, 'B', planetOptions, 'mcq')).toBe(false);
    expect(isAnswerCorrect('Jupiter', null, planetOptions, 'mcq')).toBe(false);
  });
});

describe('formatDisplayCorrectAnswer', () => {
  const planetOptions = ['Mars', 'Jupiter', 'Saturn', 'Earth'];

  it('formats letter key with its full option text', () => {
    expect(formatDisplayCorrectAnswer('B', planetOptions, 'mcq')).toBe('B. Jupiter');
    expect(formatDisplayCorrectAnswer('A', planetOptions, 'mcq')).toBe('A. Mars');
  });

  it('formats numeric index with letter and full option text', () => {
    expect(formatDisplayCorrectAnswer('1', planetOptions, 'mcq')).toBe('B. Jupiter');
  });

  it('formats literal option text with its letter key prefix', () => {
    expect(formatDisplayCorrectAnswer('Jupiter', planetOptions, 'mcq')).toBe('B. Jupiter');
  });

  it('formats True/False cleanly', () => {
    expect(formatDisplayCorrectAnswer('A', [], 'true_false')).toBe('True');
    expect(formatDisplayCorrectAnswer('B', [], 'true_false')).toBe('False');
    expect(formatDisplayCorrectAnswer('true', [], 'true_false')).toBe('True');
    expect(formatDisplayCorrectAnswer('false', [], 'true_false')).toBe('False');
  });
});

describe('isOptionMatch', () => {
  it('detects option match with letter key', () => {
    expect(isOptionMatch('Jupiter', 1, 'B')).toBe(true);
    expect(isOptionMatch('Mars', 0, 'B')).toBe(false);
  });

  it('detects option match with literal text', () => {
    expect(isOptionMatch('Jupiter', 1, 'Jupiter')).toBe(true);
    expect(isOptionMatch('Mars', 0, 'Jupiter')).toBe(false);
  });

  it('detects option match with numeric index', () => {
    expect(isOptionMatch('Jupiter', 1, '1')).toBe(true);
    expect(isOptionMatch('Mars', 0, '1')).toBe(false);
  });
});

