import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import {
  parseAikenFormat,
  parseSmartText,
  parseXlsxBuffer,
  generateAikenSampleText,
  generateExcelTemplateBlob
} from '../src/utils/questionIngestionParsers';

describe('Question Ingestion Parsers', () => {
  describe('Aiken Format Parser (parseAikenFormat)', () => {
    it('parses standard Aiken format questions with ANSWER keys', () => {
      const aikenText = `
What is the capital of France?
A. London
B. Paris
C. Berlin
D. Madrid
ANSWER: B

Which data structure uses LIFO?
A) Queue
B) Stack
C) Linked List
D) Hash Table
ANSWER: B
      `.trim();

      const result = parseAikenFormat(aikenText, {
        defaultTopic: 'General Knowledge',
        defaultDifficulty: 'easy',
        defaultMarks: 2
      });

      expect(result.questions).toHaveLength(2);
      expect(result.questions[0].question_text).toBe('What is the capital of France?');
      expect(result.questions[0].options).toEqual(['London', 'Paris', 'Berlin', 'Madrid']);
      expect(result.questions[0].correct_answer).toBe('Paris');
      expect(result.questions[0].marks).toBe(2);
      expect(result.questions[0].topic).toBe('General Knowledge');

      expect(result.questions[1].question_text).toBe('Which data structure uses LIFO?');
      expect(result.questions[1].correct_answer).toBe('Stack');
    });

    it('handles multi-line question prompts in Aiken format', () => {
      const aikenText = `
Consider the following recursive function:
int fib(int n) {
  if (n <= 1) return n;
  return fib(n-1) + fib(n-2);
}
What is the time complexity without memoization?
A. O(1)
B. O(n)
C. O(2^n)
D. O(n log n)
ANSWER: C
      `.trim();

      const result = parseAikenFormat(aikenText);
      expect(result.questions).toHaveLength(1);
      expect(result.questions[0].question_text).toContain('Consider the following recursive function:');
      expect(result.questions[0].question_text).toContain('What is the time complexity without memoization?');
      expect(result.questions[0].correct_answer).toBe('O(2^n)');
    });

    it('flags warnings when an ANSWER line is missing in Aiken format', () => {
      const aikenText = `
What is 5 * 5?
A. 20
B. 25
C. 30
      `.trim();

      const result = parseAikenFormat(aikenText);
      expect(result.questions).toHaveLength(1);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.questions[0].correct_answer).toBe('');
    });
  });

  describe('Smart Text Parser (parseSmartText)', () => {
    it('parses numbered questions, explicit answer lines, and tag metadata', () => {
      const text = `
1. What is the primary function of DNS? [Marks: 3] [Difficulty: hard] [Topic: Networking]
A. Translates domain names to IP addresses
B. Encrypts network traffic
C. Routes packets between subnets
D. Assigns DHCP leases
Answer: A

2. Which protocol operates at the Transport Layer? [Marks: 1]
a) HTTP
b) TCP
c) IP
d) Ethernet
Ans: B
      `.trim();

      const result = parseSmartText(text, {
        defaultTopic: 'Default Topic',
        defaultDifficulty: 'medium',
        defaultMarks: 1
      });

      expect(result.questions).toHaveLength(2);

      // Question 1
      expect(result.questions[0].question_text).toBe('What is the primary function of DNS?');
      expect(result.questions[0].marks).toBe(3);
      expect(result.questions[0].difficulty).toBe('hard');
      expect(result.questions[0].topic).toBe('Networking');
      expect(result.questions[0].options[0]).toBe('Translates domain names to IP addresses');
      expect(result.questions[0].correct_answer).toBe('Translates domain names to IP addresses');

      // Question 2
      expect(result.questions[1].question_text).toBe('Which protocol operates at the Transport Layer?');
      expect(result.questions[1].marks).toBe(1);
      expect(result.questions[1].correct_answer).toBe('TCP');
    });

    it('detects correct answer marked with an asterisk (*)', () => {
      const text = `
What is the boiling point of water at sea level?
A. 50°C
*B. 100°C
C. 150°C
D. 200°C
      `.trim();

      const result = parseSmartText(text);
      expect(result.questions).toHaveLength(1);
      expect(result.questions[0].options).toEqual(['50°C', '100°C', '150°C', '200°C']);
      expect(result.questions[0].correct_answer).toBe('100°C');
    });

    it('parses True / False questions automatically', () => {
      const text = `
1. Python is an interpreted programming language.
A. True
B. False
Answer: True
      `.trim();

      const result = parseSmartText(text);
      expect(result.questions).toHaveLength(1);
      expect(result.questions[0].question_type).toBe('true_false');
      expect(result.questions[0].correct_answer).toBe('True');
    });
  });

  describe('Excel (.xlsx) Parser (parseXlsxBuffer)', () => {
    it('parses multi-sheet Excel workbooks and assigns sheet name as topic when not specified', () => {
      const wb = XLSX.utils.book_new();

      const sheet1Data = [
        ['Topic', 'Difficulty', 'Question Type', 'Question Text', 'Option A', 'Option B', 'Option C', 'Option D', 'Correct Answer', 'Marks'],
        ['Calculus', 'medium', 'mcq', 'What is derivative of x^2?', 'x', '2x', 'x^2', '2', 'B', 2],
        ['Algebra', 'easy', 'true_false', 'Is 2 an even number?', 'TRUE', 'FALSE', '', '', 'A', 1]
      ];

      const sheet2Data = [
        ['Question Text', 'Option A', 'Option B', 'Option C', 'Option D', 'Correct Answer'],
        ['What is 10 / 2?', '2', '3', '4', '5', 'D']
      ];

      const ws1 = XLSX.utils.aoa_to_sheet(sheet1Data);
      const ws2 = XLSX.utils.aoa_to_sheet(sheet2Data);

      XLSX.utils.book_append_sheet(wb, ws1, 'Math Fundamentals');
      XLSX.utils.book_append_sheet(wb, ws2, 'Arithmetic');

      const buffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });

      const result = parseXlsxBuffer(buffer, {
        defaultTopic: 'Default Math'
      });

      expect(result.questions).toHaveLength(3);

      // Sheet 1 Question 1
      expect(result.questions[0].topic).toBe('Calculus');
      expect(result.questions[0].question_text).toBe('What is derivative of x^2?');
      expect(result.questions[0].correct_answer).toBe('2x');
      expect(result.questions[0].marks).toBe(2);

      // Sheet 1 Question 2
      expect(result.questions[1].question_type).toBe('true_false');
      expect(result.questions[1].correct_answer).toBe('TRUE');

      // Sheet 2 Question 1 (sheet name "Arithmetic" used as topic)
      expect(result.questions[2].topic).toBe('Arithmetic');
      expect(result.questions[2].question_text).toBe('What is 10 / 2?');
      expect(result.questions[2].correct_answer).toBe('5');
    });
  });

  describe('Template Generators', () => {
    it('generates Aiken sample text', () => {
      const sample = generateAikenSampleText();
      expect(sample).toContain('ANSWER:');
      expect(sample).toContain('A.');
      expect(sample).toContain('B.');
    });

    it('generates Excel template binary Blob', () => {
      const blob = generateExcelTemplateBlob('CS101');
      expect(blob).toBeInstanceOf(Blob);
      expect(blob.size).toBeGreaterThan(100);
    });
  });
});
