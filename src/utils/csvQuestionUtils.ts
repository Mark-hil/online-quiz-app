/**
 * Universal CSV Question Parser & Exporter
 * 
 * Standardized 10-column format:
 * Topic,Difficulty,Question Type,Question Text,Option A,Option B,Option C,Option D,Correct Answer,Marks
 * 
 * Also backwards-compatible with:
 * - Legacy 8-column format: Question Type,Question Text,Option A,Option B,Option C,Option D,Correct Answer,Marks
 * - Bank 14-column export format with metadata comments starting with '#'
 */

export interface ParsedCSVQuestion {
  topic: string;
  category?: string;
  category_prefix?: string;
  difficulty: 'easy' | 'medium' | 'hard';
  question_type: 'mcq' | 'true_false' | 'essay';
  question_text: string;
  options: string[];
  correct_answer: string;
  marks: number;
}

export interface CSVParseResult {
  success: boolean;
  questions: ParsedCSVQuestion[];
  errors: string[];
  totalRows: number;
}

export const CSV_OFFICIAL_HEADER = 'Topic,Difficulty,Question Type,Question Text,Option A,Option B,Option C,Option D,Correct Answer,Marks';

export const CSV_SAMPLE_ROWS = [
  'Loops,medium,mcq,"What is the output of while(count < 5) if count starts at 0?","0 to 4","1 to 5","Infinite loop","Syntax Error","A",1',
  'Recursion,hard,mcq,"What happens when a base case is omitted in recursion?","Fast execution","Stack Overflow Error","Memory Optimization","Compiles successfully","B",2',
  'SQL,easy,mcq,"Which SQL statement extracts data from a database table?","OPEN","EXTRACT","SELECT","GET","C",1',
  'Fundamentals,easy,true_false,"Boolean variables in JavaScript can only hold true or false values.","TRUE","FALSE","","","A",1',
  'Software Architecture,medium,essay,"Explain the primary differences between monolithic and microservice architectures.",,,,,"A monolith combines all components in one codebase, whereas microservices separate domains into independent services.",5'
];

/**
 * Escapes a cell value for RFC 4180 CSV compliance
 */
export function escapeCSVCell(value: any): string {
  const str = String(value ?? '');
  if (str.includes('"') || str.includes(',') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Generates the official standardized CSV template content
 */
export function generateQuestionCSVTemplate(courseCode?: string): string {
  const headerComments = [
    `# Institutional Question Import Template${courseCode ? ` for ${courseCode}` : ''}`,
    `# Instructions: Fill in question details below. Leave unused options blank for True/False and Essay questions.`,
    `# Supported Types: mcq, true_false, essay`,
    `# Supported Difficulties: easy, medium, hard`,
    `# Correct Answer for MCQ: letter (A, B, C, D) or exact option text; for True/False: A (TRUE) or B (FALSE)`,
    CSV_OFFICIAL_HEADER,
    ...CSV_SAMPLE_ROWS
  ];
  return headerComments.join('\n');
}

/**
 * Low-level RFC 4180 CSV tokenizer supporting quotes, newlines in quotes, and escaped quotes
 */
export function tokenizeCSV(csvText: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;

  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i];
    const nextChar = csvText[i + 1];

    if (inQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          // Escaped double quote ("")
          currentField += '"';
          i++;
        } else {
          // End of quoted field
          inQuotes = false;
        }
      } else {
        currentField += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        currentRow.push(currentField);
        currentField = '';
      } else if (char === '\n' || char === '\r') {
        currentRow.push(currentField);
        currentField = '';
        if (currentRow.some(col => col.trim() !== '')) {
          rows.push(currentRow);
        }
        currentRow = [];
        if (char === '\r' && nextChar === '\n') {
          i++; // skip \n in CRLF
        }
      } else {
        currentField += char;
      }
    }
  }

  // Push final field/row if any remaining
  if (currentField !== '' || currentRow.length > 0) {
    currentRow.push(currentField);
    if (currentRow.some(col => col.trim() !== '')) {
      rows.push(currentRow);
    }
  }

  return rows;
}

/**
 * Parses CSV text into standardized ParsedCSVQuestion array
 * Auto-detects 10-column, 8-column, and 14-column schemas
 */
export function parseQuestionsCSV(
  csvText: string,
  defaultTopic = 'General',
  defaultCategory = 'General',
  defaultPrefix?: string
): CSVParseResult {
  const errors: string[] = [];
  const questions: ParsedCSVQuestion[] = [];

  if (!csvText || !csvText.trim()) {
    return {
      success: false,
      questions: [],
      errors: ['CSV file is empty.'],
      totalRows: 0
    };
  }

  // Filter out pure comment lines (lines starting with # outside quotes)
  const allRows = tokenizeCSV(csvText);
  const dataRows = allRows.filter(row => {
    if (row.length === 0) return false;
    const firstCell = (row[0] || '').trim();
    return !firstCell.startsWith('#');
  });

  if (dataRows.length === 0) {
    return {
      success: false,
      questions: [],
      errors: ['No valid data rows found in CSV.'],
      totalRows: 0
    };
  }

  // Determine header mapping
  const firstRow = dataRows[0].map(c => c.trim().toLowerCase());
  let startIndex = 0;
  
  // Detection indices
  let topicIdx = -1;
  let categoryIdx = -1;
  let prefixIdx = -1;
  let difficultyIdx = -1;
  let typeIdx = -1;
  let textIdx = -1;
  let optAIdx = -1;
  let optBIdx = -1;
  let optCIdx = -1;
  let optDIdx = -1;
  let answerIdx = -1;
  let marksIdx = -1;

  // Check if first row is a header
  const isHeaderRow = firstRow.some(col => 
    col.includes('question') || col.includes('topic') || col.includes('type')
  );

  if (isHeaderRow) {
    startIndex = 1;
    // Dynamic column index lookup
    topicIdx = firstRow.findIndex(c => c === 'topic');
    categoryIdx = firstRow.findIndex(c => c === 'category' || c.includes('assessment category'));
    prefixIdx = firstRow.findIndex(c => c === 'prefix' || c === 'category prefix' || c === 'code');
    difficultyIdx = firstRow.findIndex(c => c.includes('difficulty'));
    typeIdx = firstRow.findIndex(c => c === 'question type' || c === 'type');
    textIdx = firstRow.findIndex(c => c === 'question text' || c === 'text' || c === 'question');
    optAIdx = firstRow.findIndex(c => c === 'option a' || c === 'a');
    optBIdx = firstRow.findIndex(c => c === 'option b' || c === 'b');
    optCIdx = firstRow.findIndex(c => c === 'option c' || c === 'c');
    optDIdx = firstRow.findIndex(c => c === 'option d' || c === 'd');
    answerIdx = firstRow.findIndex(c => c.includes('correct') || c.includes('answer') || c === 'key');
    marksIdx = firstRow.findIndex(c => c.includes('mark') || c.includes('point'));
  }

  // Fallback defaults if not found by name
  if (typeIdx === -1 || textIdx === -1) {
    if (firstRow.length >= 10 && (firstRow[2] === 'mcq' || firstRow[2] === 'true_false' || firstRow[2] === 'essay')) {
      // 10-column format without recognizable header
      topicIdx = 0;
      difficultyIdx = 1;
      typeIdx = 2;
      textIdx = 3;
      optAIdx = 4;
      optBIdx = 5;
      optCIdx = 6;
      optDIdx = 7;
      answerIdx = 8;
      marksIdx = 9;
    } else {
      // Legacy 8-column format: Question Type, Question Text, A, B, C, D, Answer, Marks
      topicIdx = -1;
      difficultyIdx = -1;
      typeIdx = 0;
      textIdx = 1;
      optAIdx = 2;
      optBIdx = 3;
      optCIdx = 4;
      optDIdx = 5;
      answerIdx = 6;
      marksIdx = 7;
    }
  }

  for (let i = startIndex; i < dataRows.length; i++) {
    const rowNum = i + 1;
    const row = dataRows[i];
    if (row.length === 0 || row.every(c => !c.trim())) continue;

    const rawType = (row[typeIdx] || '').trim().toLowerCase();
    let qType: 'mcq' | 'true_false' | 'essay' = 'mcq';
    if (rawType.includes('true') || rawType === 'tf' || rawType === 'true_false') {
      qType = 'true_false';
    } else if (rawType.includes('essay') || rawType.includes('text')) {
      qType = 'essay';
    } else if (rawType.includes('mcq') || rawType.includes('choice')) {
      qType = 'mcq';
    } else if (rawType) {
      errors.push(`Row ${rowNum}: Unknown question type "${row[typeIdx]}". Must be mcq, true_false, or essay.`);
      continue;
    }

    const qText = (row[textIdx] || '').trim();
    if (!qText) {
      errors.push(`Row ${rowNum}: Missing question text.`);
      continue;
    }

    const rawTopic = topicIdx >= 0 ? (row[topicIdx] || '').trim() : '';
    let topic = rawTopic || defaultTopic;

    const rawCategory = categoryIdx >= 0 ? (row[categoryIdx] || '').trim() : '';
    let category = rawCategory || defaultCategory;

    const rawPrefix = prefixIdx >= 0 ? (row[prefixIdx] || '').replace(/[^a-zA-Z0-9_-]/g, '').toUpperCase().trim() : '';
    let categoryPrefix = rawPrefix || defaultPrefix || undefined;

    // Detect bracket prefix in topic or question_text e.g. "[MID25] Functions"
    const topicMatch = rawTopic ? rawTopic.match(/^\[([a-zA-Z0-9_-]{2,12})\]\s*(.*)/) : null;
    const textMatch = qText ? qText.match(/^\[([a-zA-Z0-9_-]{2,12})\]\s*(.*)/) : null;
    const bracketMatch = topicMatch || textMatch;
    if (bracketMatch) {
      if (!categoryPrefix) {
        categoryPrefix = bracketMatch[1].toUpperCase();
      }
      if (topicMatch) {
        topic = topicMatch[2].trim() || defaultTopic;
      }
    }

    const rawDiff = difficultyIdx >= 0 ? (row[difficultyIdx] || '').trim().toLowerCase() : '';
    let difficulty: 'easy' | 'medium' | 'hard' = 'medium';
    if (rawDiff === 'easy' || rawDiff === 'medium' || rawDiff === 'hard') {
      difficulty = rawDiff;
    }

    const optA = (row[optAIdx] || '').trim();
    const optB = (row[optBIdx] || '').trim();
    const optC = (row[optCIdx] || '').trim();
    const optD = (row[optDIdx] || '').trim();
    const rawAnswer = (row[answerIdx] || '').trim();
    const rawMarks = marksIdx >= 0 ? parseInt(row[marksIdx], 10) : 1;
    const marks = isNaN(rawMarks) || rawMarks < 1 ? 1 : rawMarks;

    let finalOptions: string[] = [];
    let finalAnswer = rawAnswer;

    if (qType === 'mcq') {
      finalOptions = [optA, optB, optC, optD].filter(Boolean);
      if (finalOptions.length < 2) {
        errors.push(`Row ${rowNum}: Multiple choice questions require at least 2 options (Option A and Option B).`);
        continue;
      }

      // Normalize letter answers: A -> optA, B -> optB, etc.
      const upperAns = rawAnswer.toUpperCase();
      const letterMap: Record<string, string> = {
        'A': optA,
        'B': optB,
        'C': optC,
        'D': optD,
        '1': optA,
        '2': optB,
        '3': optC,
        '4': optD
      };

      if (letterMap[upperAns]) {
        finalAnswer = letterMap[upperAns];
      } else {
        // If it's already option text, verify it exists
        const matchedOpt = finalOptions.find(o => o.toLowerCase() === rawAnswer.toLowerCase());
        if (matchedOpt) {
          finalAnswer = matchedOpt;
        } else if (finalOptions.length > 0) {
          // Default to first option if empty or unresolvable
          finalAnswer = finalOptions[0];
        }
      }
    } else if (qType === 'true_false') {
      finalOptions = ['TRUE', 'FALSE'];
      const norm = rawAnswer.toUpperCase();
      if (norm === 'A' || norm === 'TRUE' || norm === 'T' || norm === '1') {
        finalAnswer = 'TRUE';
      } else if (norm === 'B' || norm === 'FALSE' || norm === 'F' || norm === '0') {
        finalAnswer = 'FALSE';
      } else {
        finalAnswer = 'TRUE';
      }
    } else {
      // essay
      finalOptions = [];
      finalAnswer = rawAnswer;
    }

    questions.push({
      topic,
      category,
      category_prefix: categoryPrefix,
      difficulty,
      question_type: qType,
      question_text: qText,
      options: finalOptions,
      correct_answer: finalAnswer,
      marks
    });
  }

  return {
    success: questions.length > 0,
    questions,
    errors,
    totalRows: dataRows.length - startIndex
  };
}

/**
 * Exports any question list to a unified 10-column CSV string
 */
export function exportQuestionsToCSVString(
  questions: Array<{
    topic?: string;
    difficulty?: 'easy' | 'medium' | 'hard';
    question_type: string;
    question_text: string;
    options: any;
    correct_answer: string;
    marks: number;
  }>,
  headerTitle?: string
): string {
  const rows: string[] = [];

  if (headerTitle) {
    rows.push(`# ${headerTitle}`);
    rows.push(`# Exported: ${new Date().toISOString()}`);
  }

  rows.push(CSV_OFFICIAL_HEADER);

  for (const q of questions) {
    let opts: string[] = [];
    if (Array.isArray(q.options)) {
      opts = q.options;
    } else if (typeof q.options === 'string') {
      try {
        const parsed = JSON.parse(q.options);
        opts = Array.isArray(parsed) ? parsed : [];
      } catch {
        opts = [];
      }
    }

    const topic = escapeCSVCell(q.topic || 'General');
    const diff = escapeCSVCell(q.difficulty || 'medium');
    const type = escapeCSVCell(q.question_type || 'mcq');
    const text = escapeCSVCell(q.question_text || '');
    const optA = escapeCSVCell(opts[0] || (q.question_type === 'true_false' ? 'TRUE' : ''));
    const optB = escapeCSVCell(opts[1] || (q.question_type === 'true_false' ? 'FALSE' : ''));
    const optC = escapeCSVCell(opts[2] || '');
    const optD = escapeCSVCell(opts[3] || '');
    
    // Determine letter answer key if possible for standard readability
    let answerDisplay = q.correct_answer || '';
    if (q.question_type === 'mcq' && opts.length > 0) {
      const idx = opts.findIndex(o => o === q.correct_answer);
      if (idx >= 0) {
        answerDisplay = String.fromCharCode(65 + idx); // 'A', 'B', 'C', 'D'
      }
    } else if (q.question_type === 'true_false') {
      answerDisplay = q.correct_answer?.toUpperCase() === 'FALSE' ? 'B' : 'A';
    }

    const answer = escapeCSVCell(answerDisplay);
    const marks = escapeCSVCell(q.marks || 1);

    rows.push(`${topic},${diff},${type},${text},${optA},${optB},${optC},${optD},${answer},${marks}`);
  }

  return rows.join('\n');
}

/**
 * Triggers a browser file download of CSV content
 */
export function downloadCSVFile(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
