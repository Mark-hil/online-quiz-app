import { describe, it, expect } from 'vitest';
import { 
  parseQuestionsCSV, 
  generateQuestionCSVTemplate, 
  exportQuestionsToCSVString,
  tokenizeCSV 
} from '../src/utils/csvQuestionUtils';

describe('csvQuestionUtils', () => {
  it('parses standard 10-column CSV format with MCQ, True/False, and Essay', () => {
    const csv = `
Topic,Difficulty,Question Type,Question Text,Option A,Option B,Option C,Option D,Correct Answer,Marks
Loops,medium,mcq,"What is 2 + 2, really?","3","4","5","6","B",2
Logic,easy,true_false,"The sky is blue on a clear day.","TRUE","FALSE","","","A",1
Writing,hard,essay,"Describe recursion.",,,,,"Recursion is a function calling itself",5
    `.trim();

    const result = parseQuestionsCSV(csv);
    expect(result.success).toBe(true);
    expect(result.questions).toHaveLength(3);

    // Q1 MCQ
    expect(result.questions[0].topic).toBe('Loops');
    expect(result.questions[0].difficulty).toBe('medium');
    expect(result.questions[0].question_type).toBe('mcq');
    expect(result.questions[0].question_text).toBe('What is 2 + 2, really?');
    expect(result.questions[0].options).toEqual(['3', '4', '5', '6']);
    expect(result.questions[0].correct_answer).toBe('4'); // Mapped B to option 4
    expect(result.questions[0].marks).toBe(2);

    // Q2 True/False
    expect(result.questions[1].question_type).toBe('true_false');
    expect(result.questions[1].options).toEqual(['TRUE', 'FALSE']);
    expect(result.questions[1].correct_answer).toBe('TRUE');

    // Q3 Essay
    expect(result.questions[2].question_type).toBe('essay');
    expect(result.questions[2].marks).toBe(5);
  });

  it('parses legacy 8-column CSV format backwards-compatibly', () => {
    const csv = `
Question Type,Question Text,Option A,Option B,Option C,Option D,Correct Answer,Marks
mcq,"What is capital of France?","London","Paris","Berlin","Madrid","B",1
true_false,"Earth is flat.","TRUE","FALSE","","","B",1
    `.trim();

    const result = parseQuestionsCSV(csv, 'Geography');
    expect(result.success).toBe(true);
    expect(result.questions).toHaveLength(2);
    expect(result.questions[0].topic).toBe('Geography');
    expect(result.questions[0].difficulty).toBe('medium');
    expect(result.questions[0].correct_answer).toBe('Paris');
    expect(result.questions[1].correct_answer).toBe('FALSE');
  });

  it('handles quotes with commas and escaped quotes correctly', () => {
    const csv = `
Topic,Difficulty,Question Type,Question Text,Option A,Option B,Option C,Option D,Correct Answer,Marks
Quotes,easy,mcq,"He said, ""Hello, world!""","Option, with comma","Simple","Third","Fourth","A",1
    `.trim();

    const result = parseQuestionsCSV(csv);
    expect(result.success).toBe(true);
    expect(result.questions[0].question_text).toBe('He said, "Hello, world!"');
    expect(result.questions[0].options[0]).toBe('Option, with comma');
    expect(result.questions[0].correct_answer).toBe('Option, with comma');
  });

  it('ignores comments starting with #', () => {
    const template = generateQuestionCSVTemplate('CS101');
    const result = parseQuestionsCSV(template);
    expect(result.success).toBe(true);
    expect(result.questions.length).toBeGreaterThan(0);
  });

  it('exports questions to a valid RFC 4180 CSV string', () => {
    const questions = [
      {
        topic: 'Math',
        difficulty: 'easy' as const,
        question_type: 'mcq',
        question_text: 'What is 5 x 5?',
        options: ['10', '20', '25', '30'],
        correct_answer: '25',
        marks: 2
      }
    ];

    const exported = exportQuestionsToCSVString(questions, 'Math Exam');
    expect(exported).toContain('Math,easy,mcq,What is 5 x 5?,10,20,25,30,C,2');

    // Parse it back to test round-trip fidelity
    const parsed = parseQuestionsCSV(exported);
    expect(parsed.success).toBe(true);
    expect(parsed.questions[0].question_text).toBe('What is 5 x 5?');
    expect(parsed.questions[0].correct_answer).toBe('25');
  });

  it('parses the exact legacy CreateQuiz template filled by lecturers', () => {
    const legacyTemplate = [
      'Question Type,Question Text,Option A,Option B,Option C,Option D,Correct Answer,Marks',
      'mcq,"What is 2+2?","3","4","5","6","B",1',
      'mcq,"What is the capital of France?","London","Berlin","Paris","Madrid","C",2',
      'true_false,"The Earth is round.","TRUE","FALSE","TRUE","FALSE","A",1',
      'essay,"Explain the importance of photosynthesis.",,,,,,"Write your answer here",5',
      'mcq,"What is the largest planet?","Mars","Jupiter","Saturn","Earth","B",1'
    ].join('\n');

    const result = parseQuestionsCSV(legacyTemplate, 'CS101');
    expect(result.success).toBe(true);
    expect(result.questions).toHaveLength(5);
    expect(result.questions[0].correct_answer).toBe('4');
    expect(result.questions[1].correct_answer).toBe('Paris');
    expect(result.questions[2].correct_answer).toBe('TRUE');
    expect(result.questions[3].question_type).toBe('essay');
    expect(result.questions[4].correct_answer).toBe('Jupiter');
  });
});
