import { describe, it, expect } from 'vitest';
import { parseOptions } from '../src/utils/quizUtils';

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
