import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import {
  parseAikenFormat,
  parseSmartText,
  parseXlsxBuffer,
  generateAikenSampleText,
  generateExcelTemplateBlob,
  getCleanTemplateFilename
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

    it('sanitizes mojibake, Greek letters, and smart quotes in Aiken questions', () => {
      const aikenText = `
Whatâ€™s the temperature in 25Â°C Â± 2Â°C?
A. 273 K
B. 298 K
C. 300 K
ANSWER: B

Which angle represents Î± in right triangle with angles Î± and Î²?
A. 45Â°
B. 90Â°
ANSWER: A
      `.trim();

      const result = parseAikenFormat(aikenText);
      expect(result.questions).toHaveLength(2);
      expect(result.questions[0].question_text).toBe("What's the temperature in 25°C ± 2°C?");
      expect(result.questions[0].correct_answer).toBe('298 K');

      expect(result.questions[1].question_text).toBe('Which angle represents α in right triangle with angles α and β?');
      expect(result.questions[1].options[0]).toBe('45°');
      expect(result.questions[1].options[1]).toBe('90°');
    });

    it('sanitizes replacement characters like babys anterio and degrees in Aiken questions', () => {
      const aikenText = `
What is the baby\uFFFDs anterior fontanelle normal closure time?
A. At 37\uFFFD C body temp
B. 12-18 months
C. Don\uFFFDt close until adulthood
D. At birth
ANSWER: B
      `.trim();

      const result = parseAikenFormat(aikenText);
      expect(result.questions).toHaveLength(1);
      expect(result.questions[0].question_text).toBe("What is the baby's anterior fontanelle normal closure time?");
      expect(result.questions[0].options[0]).toBe("At 37°C body temp");
      expect(result.questions[0].options[1]).toBe("12-18 months");
      expect(result.questions[0].options[2]).toBe("Don't close until adulthood");
      expect(result.questions[0].correct_answer).toBe("12-18 months");
    });

    it('parses compound questions with Roman numeral statement lists without splitting options (e.g. human skeleton)', () => {
      const aikenText = `
Which of the following are functions of the human skeleton?

i. Supports the body
ii. Protects internal organs
iii. Produces food for the body
iv. Helps in movement

A. i and ii only
B. ii and iii only
C. i, ii and iv only
D. i, iii and iv only

Correct Answer: C
      `.trim();

      const result = parseAikenFormat(aikenText);
      expect(result.questions).toHaveLength(1);
      expect(result.questions[0].question_text).toContain('Supports the body');
      expect(result.questions[0].question_text).toContain('Helps in movement');
      expect(result.questions[0].options).toEqual([
        'i and ii only',
        'ii and iii only',
        'i, ii and iv only',
        'i, iii and iv only'
      ]);
      expect(result.questions[0].correct_answer).toBe('i, ii and iv only');
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

    it('sanitizes invisible zero-width spaces, non-breaking spaces, and HTML entities in Smart Text', () => {
      const text = `
\u200B1. What is &quot;encapsulation&quot; in OOP? [Marks: 2]
A.\u00A0Hiding internal data and exposing interface
B.\u00A0Multiple inheritance
C.\u00A0Global variables
Answer: A

\uFEFF2. Is 5 &plusmn; 2 between 3 and 7?
A. True
B. False
Answer: True
      `.trim();

      const result = parseSmartText(text);
      expect(result.questions).toHaveLength(2);

      // Q1: zero-width prefix stripped, &quot; decoded, NBSP normalized
      expect(result.questions[0].question_text).toBe('What is "encapsulation" in OOP?');
      expect(result.questions[0].options[0]).toBe('Hiding internal data and exposing interface');
      expect(result.questions[0].correct_answer).toBe('Hiding internal data and exposing interface');

      // Q2: BOM stripped, &plusmn; decoded to ±
      expect(result.questions[1].question_text).toBe('Is 5 ± 2 between 3 and 7?');
      expect(result.questions[1].question_type).toBe('true_false');
      expect(result.questions[1].correct_answer).toBe('True');
    });

    it('parses numbered questions with Roman numeral statement lists in Smart Text', () => {
      const text = `
1. Which of the following statements about photosynthesis are correct?
I. It takes place in chloroplasts.
II. It produces glucose and oxygen.
III. It requires carbon dioxide and water.
IV. It occurs in all plant cells.

A. I, II and III only
B. I and II only
C. II, III and IV only
D. I, III and IV only
Correct Answer: A
      `.trim();

      const result = parseSmartText(text);
      expect(result.questions).toHaveLength(1);
      expect(result.questions[0].question_text).toContain('It takes place in chloroplasts.');
      expect(result.questions[0].question_text).toContain('It occurs in all plant cells.');
      expect(result.questions[0].options).toEqual([
        'I, II and III only',
        'I and II only',
        'II, III and IV only',
        'I, III and IV only'
      ]);
      expect(result.questions[0].correct_answer).toBe('I, II and III only');
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

    it('generates clean, professional template filenames with course code sanitization', () => {
      // With spaces in course code
      expect(getCleanTemplateFilename('xlsx', 'CSC 201')).toBe('CSC-201_Question_Template.xlsx');
      expect(getCleanTemplateFilename('aiken', 'CSC 201')).toBe('CSC-201_Aiken_Template.txt');
      expect(getCleanTemplateFilename('csv', 'CSC 201')).toBe('CSC-201_Question_Template.csv');

      // With slashes or special characters in course code
      expect(getCleanTemplateFilename('xlsx', 'MTH/101')).toBe('MTH-101_Question_Template.xlsx');
      expect(getCleanTemplateFilename('csv', 'ENG.102 #A')).toBe('ENG102-A_Question_Template.csv');

      // Fallback for undefined, blank, or generic 'Course'
      expect(getCleanTemplateFilename('xlsx')).toBe('Exam_Question_Template.xlsx');
      expect(getCleanTemplateFilename('aiken', '')).toBe('Exam_Aiken_Template.txt');
      expect(getCleanTemplateFilename('csv', 'Course')).toBe('Exam_Question_Template.csv');
      expect(getCleanTemplateFilename('txt', 'General')).toBe('Exam_Aiken_Template.txt');
    });
  });
});
