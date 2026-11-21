import { describe, it, expect } from 'vitest';
import { 
  parseQuestionsCSV, 
  generateQuestionCSVTemplate, 
  exportQuestionsToCSVString,
  tokenizeCSV 
} from '../src/utils/csvQuestionUtils';
import { decodeTextBuffer } from '../src/utils/textSanitizer';

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

  it('parses explicit Category and Prefix columns in CSV', () => {
    const csv = [
      'Category,Prefix,Topic,Difficulty,Question Type,Question Text,Option A,Option B,Option C,Option D,Correct Answer,Marks',
      '"Mid-Semester Exam 2025",MID25,Sorting,hard,mcq,"What is quicksort time complexity?","O(n)","O(n log n)","O(n^2)","O(1)","B",2',
      '"Final Exam 2024",FE24,Graphs,medium,true_false,"A tree is a connected acyclic graph.","TRUE","FALSE","","","A",1'
    ].join('\n');

    const result = parseQuestionsCSV(csv);
    expect(result.success).toBe(true);
    expect(result.questions).toHaveLength(2);
    expect(result.questions[0].category).toBe('Mid-Semester Exam 2025');
    expect(result.questions[0].category_prefix).toBe('MID25');
    expect(result.questions[1].category).toBe('Final Exam 2024');
    expect(result.questions[1].category_prefix).toBe('FE24');
  });

  it('extracts bracket prefixes like [MID25] from question text or topic automatically', () => {
    const csv = [
      'Topic,Difficulty,Question Type,Question Text,Option A,Option B,Option C,Option D,Correct Answer,Marks',
      'Algorithms,medium,mcq,"[MID25] What is binary search complexity?","O(1)","O(log n)","O(n)","O(n^2)","B",1',
      '[FE25] Networking,easy,true_false,"TCP is connection-oriented.","TRUE","FALSE","","","A",1'
    ].join('\n');

    const result = parseQuestionsCSV(csv);
    expect(result.success).toBe(true);
    expect(result.questions).toHaveLength(2);
    expect(result.questions[0].category_prefix).toBe('MID25');
    expect(result.questions[1].category_prefix).toBe('FE25');
  });

  it('uses default category and prefix when not provided in CSV', () => {
    const csv = [
      'Topic,Difficulty,Question Type,Question Text,Option A,Option B,Option C,Option D,Correct Answer,Marks',
      'General,easy,true_false,"1 < 2","TRUE","FALSE","","","A",1'
    ].join('\n');

    const result = parseQuestionsCSV(csv, 'CS101', 'Class Test 1', 'CT1');
    expect(result.success).toBe(true);
    expect(result.questions[0].category).toBe('Class Test 1');
    expect(result.questions[0].category_prefix).toBe('CT1');
  });

  it('sanitizes special characters, mojibake, and HTML entities in CSV imports', () => {
    const csv = [
      'Topic,Difficulty,Question Type,Question Text,Option A,Option B,Option C,Option D,Correct Answer,Marks',
      'Physics,medium,mcq,"What is 25Â°C Â± 2Â°C in Kelvin?","298.15 K","300 K","273.15 K","0 K","A",2',
      'Math,easy,mcq,"Solve: x &le; 10 &amp;&amp; x &ge; 5","5 &le; x &le; 10","x &lt; 5","x &gt; 10","None","5 ≤ x ≤ 10",1',
      'Software,hard,mcq,"Whatâ€™s &quot;inheritance&quot;?","Donâ€™t know","Reusing code","OOP concept","None of these","Don\'t know",2'
    ].join('\n');

    const result = parseQuestionsCSV(csv);
    expect(result.success).toBe(true);
    expect(result.questions).toHaveLength(3);

    // Q1: Degree and Plus-Minus mojibake repaired
    expect(result.questions[0].question_text).toBe('What is 25°C ± 2°C in Kelvin?');

    // Q2: HTML entities decoded and math comparison preserved
    expect(result.questions[1].question_text).toBe('Solve: x ≤ 10 && x ≥ 5');
    expect(result.questions[1].options[0]).toBe('5 ≤ x ≤ 10');
    expect(result.questions[1].correct_answer).toBe('5 ≤ x ≤ 10');

    // Q3: Mojibake quotes repaired and curly vs straight quotes match answer
    expect(result.questions[2].question_text).toBe('What\'s "inheritance"?');
    expect(result.questions[2].options[0]).toBe("Don't know");
    expect(result.questions[2].correct_answer).toBe("Don't know");
  });

  it('preserves RFC 4180 CSV column boundaries when decodeTextBuffer decodes Windows-1252 smart quotes or &quot;', () => {
    const header = 'Topic,Difficulty,Question Type,Question Text,Option A,Option B,Option C,Option D,Correct Answer,Marks\n';
    // 0x93 = “, 0x94 = ” in Windows-1252 around a comma-separated phrase inside a quoted CSV cell
    const win1252Row = 'English,medium,mcq,"She said, \x93Hello, world!\x94","OptA","OptB","OptC","OptD","A",1';
    const rawWin1252 = header + win1252Row;
    const winBytes = new Uint8Array(Array.from(rawWin1252, c => c.charCodeAt(0)));

    const decodedWin = decodeTextBuffer(winBytes.buffer);
    const parsedWin = parseQuestionsCSV(decodedWin);
    expect(parsedWin.success).toBe(true);
    expect(parsedWin.questions).toHaveLength(1);
    expect(parsedWin.questions[0].question_text).toBe('She said, "Hello, world!"');
    expect(parsedWin.questions[0].options).toEqual(['OptA', 'OptB', 'OptC', 'OptD']);
    expect(parsedWin.questions[0].correct_answer).toBe('OptA');

    // UTF-8 CSV with &quot; inside quoted cell
    const utf8Csv = header + 'Software,hard,mcq,"What is &quot;inheritance&quot;?","OptA","OptB","OptC","OptD","A",1';
    const utf8Bytes = new TextEncoder().encode(utf8Csv);
    const decodedUtf8 = decodeTextBuffer(utf8Bytes.buffer);
    const parsedUtf8 = parseQuestionsCSV(decodedUtf8);
    expect(parsedUtf8.success).toBe(true);
    expect(parsedUtf8.questions[0].question_text).toBe('What is "inheritance"?');
    expect(parsedUtf8.questions[0].options).toEqual(['OptA', 'OptB', 'OptC', 'OptD']);
    expect(parsedUtf8.questions[0].correct_answer).toBe('OptA');
  });
});
