import * as mammoth from 'mammoth';
import * as XLSX from 'xlsx';
import { AssessmentCategory } from '../lib/database';

export interface ParsedIngestionQuestion {
  id: string; // ephemeral client ID for rendering and editing
  question_text: string;
  question_type: 'mcq' | 'true_false' | 'essay';
  options: string[];
  correct_answer: string;
  marks: number;
  topic: string;
  difficulty: 'easy' | 'medium' | 'hard';
  category?: string;
  category_prefix?: string;
  assessment_tier?: AssessmentCategory;
  warnings: string[];
}

export interface IngestionParseResult {
  success: boolean;
  questions: ParsedIngestionQuestion[];
  warnings: string[];
  format: 'aiken' | 'smart_text' | 'docx' | 'xlsx' | 'csv' | 'unknown';
  totalDetected: number;
}

export interface IngestionDefaults {
  topic?: string;
  defaultTopic?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  defaultDifficulty?: 'easy' | 'medium' | 'hard';
  category?: string;
  category_prefix?: string;
  assessment_tier?: AssessmentCategory;
  defaultMarks?: number;
  marks?: number;
}

const OPTION_LETTER_PREFIX_REGEX = /^\s*(?:\(?([A-Za-z])[\.\)\-\:]\s*|\[([A-Za-z])\]\s*)/;
const ANSWER_LINE_REGEX = /^\s*(?:ANSWER|ANS|CORRECT ANSWER|KEY|CORRECT)\s*[:\-]\s*(.*)$/i;

/**
 * Parses pure Aiken format plain text.
 * Each question is a single or multi-line prompt, followed by lettered options,
 * and terminated by an "ANSWER: X" line.
 */
export function parseAikenFormat(
  rawText: string,
  defaults: IngestionDefaults = {}
): IngestionParseResult {
  const lines = rawText.split(/\r?\n/);
  const questions: ParsedIngestionQuestion[] = [];
  const globalWarnings: string[] = [];

  let currentQuestionTextLines: string[] = [];
  let currentOptions: { letter: string; text: string }[] = [];
  let questionIndex = 0;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    if (!trimmed) {
      continue;
    }

    // Check for ANSWER line
    const answerMatch = trimmed.match(ANSWER_LINE_REGEX);
    if (answerMatch) {
      const answerVal = answerMatch[1].trim();
      const qText = currentQuestionTextLines.join(' ').trim();

      if (qText && currentOptions.length >= 2) {
        questionIndex++;
        const itemWarnings: string[] = [];

        // Match answerVal to option letter or option content
        let resolvedCorrect = '';
        const targetLetter = answerVal.toUpperCase();
        const matchedByLetter = currentOptions.find(o => o.letter.toUpperCase() === targetLetter);

        if (matchedByLetter) {
          resolvedCorrect = matchedByLetter.text;
        } else {
          // Check if answerVal matches option text directly
          const matchedByText = currentOptions.find(o => o.text.toLowerCase() === answerVal.toLowerCase());
          if (matchedByText) {
            resolvedCorrect = matchedByText.text;
          } else {
            resolvedCorrect = answerVal;
            itemWarnings.push(`Answer "${answerVal}" did not match any of options A-${String.fromCharCode(64 + currentOptions.length)}.`);
          }
        }

        const isTrueFalse = currentOptions.length === 2 &&
          currentOptions.some(o => o.text.toLowerCase() === 'true') &&
          currentOptions.some(o => o.text.toLowerCase() === 'false');

        const targetTopic = defaults.topic || defaults.defaultTopic || 'General';
        const targetDiff = defaults.difficulty || defaults.defaultDifficulty || 'medium';
        const targetMarks = defaults.defaultMarks || defaults.marks || 1;

        questions.push({
          id: `aiken_${questionIndex}_${Date.now()}`,
          question_text: qText,
          question_type: isTrueFalse ? 'true_false' : 'mcq',
          options: currentOptions.map(o => o.text),
          correct_answer: resolvedCorrect,
          marks: targetMarks,
          topic: targetTopic,
          difficulty: targetDiff,
          category: defaults.category || 'General',
          category_prefix: defaults.category_prefix,
          assessment_tier: defaults.assessment_tier || 'quiz',
          warnings: itemWarnings,
        });
      } else if (qText) {
        globalWarnings.push(`Question "${qText.slice(0, 40)}..." had fewer than 2 options before ANSWER line.`);
      }

      currentQuestionTextLines = [];
      currentOptions = [];
      continue;
    }

    // Check for option line (A. text, B) text, etc.)
    const optionMatch = trimmed.match(OPTION_LETTER_PREFIX_REGEX);
    if (optionMatch && currentQuestionTextLines.length > 0) {
      const letter = (optionMatch[1] || optionMatch[2] || '').toUpperCase();
      const optText = trimmed.replace(OPTION_LETTER_PREFIX_REGEX, '').trim();
      currentOptions.push({ letter, text: optText });
    } else {
      // If we already started collecting options, a non-option/non-answer line might indicate missing answer
      if (currentOptions.length > 0) {
        // Assume previous question was missing an ANSWER line
        questionIndex++;
        const targetTopic = defaults.topic || defaults.defaultTopic || 'General';
        const targetDiff = defaults.difficulty || defaults.defaultDifficulty || 'medium';
        const targetMarks = defaults.defaultMarks || defaults.marks || 1;
        const missingWarn = `Question "${currentQuestionTextLines[0]?.slice(0, 40) || 'Question'}..." is missing an "ANSWER:" line.`;
        globalWarnings.push(missingWarn);

        questions.push({
          id: `aiken_${questionIndex}_${Date.now()}`,
          question_text: currentQuestionTextLines.join(' ').trim(),
          question_type: currentOptions.length === 2 ? 'true_false' : 'mcq',
          options: currentOptions.map(o => o.text),
          correct_answer: '',
          marks: targetMarks,
          topic: targetTopic,
          difficulty: targetDiff,
          category: defaults.category || 'General',
          category_prefix: defaults.category_prefix,
          assessment_tier: defaults.assessment_tier || 'quiz',
          warnings: [missingWarn],
        });
        currentQuestionTextLines = [trimmed];
        currentOptions = [];
      } else {
        currentQuestionTextLines.push(trimmed);
      }
    }
  }

  // Handle trailing question if file didn't end with ANSWER line
  if (currentQuestionTextLines.length > 0 && currentOptions.length >= 2) {
    questionIndex++;
    const targetTopic = defaults.topic || defaults.defaultTopic || 'General';
    const targetDiff = defaults.difficulty || defaults.defaultDifficulty || 'medium';
    const targetMarks = defaults.defaultMarks || defaults.marks || 1;
    const trailingWarn = `Question "${currentQuestionTextLines[0]?.slice(0, 40) || 'Question'}..." ended without an "ANSWER:" line.`;
    globalWarnings.push(trailingWarn);

    questions.push({
      id: `aiken_${questionIndex}_${Date.now()}`,
      question_text: currentQuestionTextLines.join(' ').trim(),
      question_type: currentOptions.length === 2 ? 'true_false' : 'mcq',
      options: currentOptions.map(o => o.text),
      correct_answer: '',
      marks: targetMarks,
      topic: targetTopic,
      difficulty: targetDiff,
      category: defaults.category || 'General',
      category_prefix: defaults.category_prefix,
      assessment_tier: defaults.assessment_tier || 'quiz',
      warnings: [trailingWarn],
    });
  }

  return {
    success: questions.length > 0,
    questions,
    warnings: globalWarnings,
    format: 'aiken',
    totalDetected: questions.length,
  };
}

/**
 * Smart Text Parser:
 * Capable of parsing messy exam questions copied from Word, PDFs, or websites.
 * Detects numbered questions (1., Q1, Question 1:), letters (A., B., C., D.),
 * answer keys (Answer: B, Ans: C, Key: A, *A), marks tags ([2 Marks], (3 pts)),
 * and topic tags ([Topic: Loops]).
 */
export function parseSmartText(
  rawText: string,
  defaults: IngestionDefaults = {}
): IngestionParseResult {
  // Pure Aiken format requires standard capital "ANSWER: [A-Z]" and no numbered prefixes like "1." or brackets like "[Marks:"
  const hasPureAikenFormat = 
    /^ANSWER\s*:\s*[A-Z]/m.test(rawText) &&
    !/^\s*(?:\d+[\.\)]|Q\d+[:\.])/m.test(rawText) &&
    !/\[(?:Marks|Topic|Difficulty)/i.test(rawText);

  if (hasPureAikenFormat) {
    const aikenResult = parseAikenFormat(rawText, defaults);
    if (aikenResult.success && aikenResult.questions.length > 0 && aikenResult.warnings.length === 0) {
      return aikenResult;
    }
  }

  const lines = rawText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const questions: ParsedIngestionQuestion[] = [];
  const warnings: string[] = [];

  const QUESTION_START_REGEX = /^(?:(?:Q|Question|Item)\s*(\d+)[\.\:\-]|(\d+)[\.\)\:\-])\s*(.*)$/i;

  const defaultMarksVal = defaults.defaultMarks || defaults.marks || 1;
  const defaultTopicVal = defaults.topic || defaults.defaultTopic || 'General';
  const defaultDiffVal = defaults.difficulty || defaults.defaultDifficulty || 'medium';

  let currentPrompt = '';
  let currentOptions: string[] = [];
  let currentAnswer = '';
  let currentMarks = defaultMarksVal;
  let currentTopic = defaultTopicVal;
  let currentDifficulty = defaultDiffVal;
  let itemWarnings: string[] = [];

  const commitCurrentQuestion = () => {
    if (!currentPrompt) return;

    // Clean prompt: strip leading question numbers and bracketed metadata tags
    let cleanPrompt = currentPrompt
      .replace(/(?:\[|\()\s*(?:marks?|pts?|points?)\s*[:\-]?\s*(\d+)\s*(?:marks?|pts?|points?)?\s*(?:\]|\))/gi, '')
      .replace(/(?:\[|\()\s*(\d+)\s*(?:marks?|pts?|points?)\s*(?:\]|\))/gi, '')
      .replace(/(?:\[|\()\s*(?:topic|module)\s*:\s*([^\]\)]+)\s*(?:\]|\))/gi, '')
      .replace(/(?:\[|\()\s*(?:difficulty|level)?\s*[:\-]?\s*(easy|medium|hard)\s*(?:\]|\))/gi, '')
      .replace(/(?:\[|\()\s*(?:category)\s*:\s*([^\]\)]+)\s*(?:\]|\))/gi, '')
      .replace(/^(?:(?:Q|Question|Item)\s*\d+[\.\:\-]?|\d+[\.\)\:\-])\s*/i, '')
      .trim();

    // Detect if True/False
    const isTF = currentOptions.length === 2 &&
      currentOptions.some(o => o.toLowerCase() === 'true') &&
      currentOptions.some(o => o.toLowerCase() === 'false');

    const isEssay = currentOptions.length < 2;

    if (currentOptions.length > 0 && !currentAnswer) {
      itemWarnings.push('Answer key not detected. Please select the correct option.');
      currentAnswer = currentOptions[0] || '';
    }

    questions.push({
      id: `smart_${questions.length + 1}_${Date.now()}`,
      question_text: cleanPrompt || currentPrompt,
      question_type: isEssay ? 'essay' : isTF ? 'true_false' : 'mcq',
      options: currentOptions,
      correct_answer: currentAnswer,
      marks: currentMarks,
      topic: currentTopic,
      difficulty: currentDifficulty,
      category: defaults.category || 'General',
      category_prefix: defaults.category_prefix,
      assessment_tier: defaults.assessment_tier || 'quiz',
      warnings: [...itemWarnings],
    });

    currentPrompt = '';
    currentOptions = [];
    currentAnswer = '';
    currentMarks = defaultMarksVal;
    currentTopic = defaultTopicVal;
    currentDifficulty = defaultDiffVal;
    itemWarnings = [];
  };

  // Helper to extract metadata tags from a line
  const extractTags = (targetLine: string) => {
    const marksMatch = targetLine.match(/(?:\[|\()\s*(?:marks?|pts?|points?)\s*[:\-]?\s*(\d+)\s*(?:marks?|pts?|points?)?\s*(?:\]|\))/i) ||
      targetLine.match(/(?:\[|\()\s*(\d+)\s*(?:marks?|pts?|points?)(?:\]|\))/i);
    if (marksMatch) {
      currentMarks = parseInt(marksMatch[1], 10);
    }
    const topicMatch = targetLine.match(/(?:\[|\()(?:topic|module)\s*:\s*([^\]\)]+)(?:\]|\))/i);
    if (topicMatch) {
      currentTopic = topicMatch[1].trim();
    }
    const diffMatch = targetLine.match(/(?:\[|\()\s*(?:difficulty|level)?\s*[:\-]?\s*(easy|medium|hard)\s*(?:\]|\))/i);
    if (diffMatch) {
      currentDifficulty = diffMatch[1].toLowerCase() as any;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Check for Answer line
    const ansMatch = line.match(ANSWER_LINE_REGEX);
    if (ansMatch) {
      const val = ansMatch[1].trim();
      const letterMatch = val.match(/^[A-Fa-f0-9]/);
      if (letterMatch && currentOptions.length > 0) {
        const letterIdx = letterMatch[0].toUpperCase().charCodeAt(0) - 65;
        if (letterIdx >= 0 && letterIdx < currentOptions.length) {
          currentAnswer = currentOptions[letterIdx];
        } else {
          currentAnswer = val;
        }
      } else {
        currentAnswer = val;
      }
      continue;
    }

    // Check for new question start (e.g. "1. ", "2) ", "Q3: ")
    const qMatch = line.match(QUESTION_START_REGEX);
    if (qMatch) {
      commitCurrentQuestion();
      currentPrompt = (qMatch[3] || '').trim();
      extractTags(line);
      continue;
    }

    // Check for option line (A. B) C- etc., or *A for asterisk correct answer)
    let isAsteriskCorrect = false;
    let cleanLine = line;
    if (cleanLine.startsWith('*')) {
      isAsteriskCorrect = true;
      cleanLine = cleanLine.substring(1).trim();
    }

    const optMatch = cleanLine.match(OPTION_LETTER_PREFIX_REGEX);
    if (optMatch && currentPrompt) {
      const optText = cleanLine.replace(OPTION_LETTER_PREFIX_REGEX, '').trim();
      currentOptions.push(optText);
      if (isAsteriskCorrect) {
        currentAnswer = optText;
      }
      continue;
    }

    // Otherwise, append to prompt or previous option
    if (currentOptions.length > 0) {
      // Append to the last option
      currentOptions[currentOptions.length - 1] += ' ' + line;
    } else if (currentPrompt) {
      currentPrompt += ' ' + line;
      extractTags(line);
    } else {
      // First unnumbered prompt
      currentPrompt = line;
      extractTags(line);
    }
  }

  commitCurrentQuestion();

  return {
    success: questions.length > 0,
    questions,
    warnings,
    format: 'smart_text',
    totalDetected: questions.length,
  };
}

/**
 * Microsoft Word (.docx) Document Ingestion:
 * Extracts clean raw text and structure from a Word document ArrayBuffer using mammoth,
 * then parses it with the Smart Text Parser.
 */
export async function parseDocxBuffer(
  arrayBuffer: ArrayBuffer,
  defaults: IngestionDefaults = {}
): Promise<IngestionParseResult> {
  try {
    const result = await mammoth.extractRawText({ arrayBuffer });
    const rawText = result.value;

    if (!rawText || !rawText.trim()) {
      return {
        success: false,
        questions: [],
        warnings: ['The uploaded Word document contains no readable text.'],
        format: 'docx',
        totalDetected: 0,
      };
    }

    const parseResult = parseSmartText(rawText, defaults);
    return {
      ...parseResult,
      format: 'docx',
    };
  } catch (error: any) {
    return {
      success: false,
      questions: [],
      warnings: [`Error reading Word document: ${error.message || String(error)}`],
      format: 'docx',
      totalDetected: 0,
    };
  }
}

/**
 * Excel (.xlsx) Ingestion:
 * Reads workbook sheets. If workbook has multiple sheets, each sheet name
 * is mapped as the Question Topic!
 */
export function parseXlsxBuffer(
  arrayBuffer: ArrayBuffer,
  defaults: IngestionDefaults = {}
): IngestionParseResult {
  try {
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    const questions: ParsedIngestionQuestion[] = [];
    const warnings: string[] = [];

    if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
      return {
        success: false,
        questions: [],
        warnings: ['The Excel workbook has no sheets.'],
        format: 'xlsx',
        totalDetected: 0,
      };
    }

    let globalIndex = 0;

    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const rows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });

      const sheetTopic = sheetName !== 'Sheet1' && sheetName !== 'Questions' 
        ? sheetName 
        : (defaults.topic || 'General');

      for (const row of rows) {
        // Flexible key search
        const qText = row['Question Text'] || row['Question'] || row['question_text'] || row['Prompt'] || row['Text'];
        if (!qText || !String(qText).trim()) {
          continue;
        }

        globalIndex++;
        const itemWarnings: string[] = [];

        // Collect options
        const optA = String(row['Option A'] || row['A'] || row['option_a'] || '').trim();
        const optB = String(row['Option B'] || row['B'] || row['option_b'] || '').trim();
        const optC = String(row['Option C'] || row['C'] || row['option_c'] || '').trim();
        const optD = String(row['Option D'] || row['D'] || row['option_d'] || '').trim();
        const optE = String(row['Option E'] || row['E'] || row['option_e'] || '').trim();

        const options = [optA, optB, optC, optD, optE].filter(Boolean);

        // Correct answer
        const rawAns = String(row['Correct Answer'] || row['Answer'] || row['correct_answer'] || row['Ans'] || row['Key'] || '').trim();
        let resolvedAnswer = rawAns;

        // If letter, map to option
        const letterIdx = ['A', 'B', 'C', 'D', 'E'].indexOf(rawAns.toUpperCase());
        if (letterIdx >= 0 && letterIdx < options.length) {
          resolvedAnswer = options[letterIdx];
        } else if (!rawAns && options.length > 0) {
          resolvedAnswer = options[0];
          itemWarnings.push('Answer not provided. First option selected as default.');
        }

        const rawType = String(row['Question Type'] || row['Type'] || '').toLowerCase().trim();
        const qType: 'mcq' | 'true_false' | 'essay' = 
          rawType.includes('true') || rawType.includes('tf')
            ? 'true_false'
            : rawType.includes('essay') || options.length === 0
              ? 'essay'
              : 'mcq';

        const rowTopic = String(row['Topic'] || row['topic'] || sheetTopic).trim();
        const rowDiff = String(row['Difficulty'] || row['difficulty'] || defaults.difficulty || 'medium').toLowerCase().trim() as any;
        const validDiff = ['easy', 'medium', 'hard'].includes(rowDiff) ? rowDiff : 'medium';
        const marks = Number(row['Marks'] || row['Points'] || defaults.defaultMarks || 1) || 1;

        questions.push({
          id: `xlsx_${globalIndex}_${Date.now()}`,
          question_text: String(qText).trim(),
          question_type: qType,
          options,
          correct_answer: resolvedAnswer,
          marks,
          topic: rowTopic || 'General',
          difficulty: validDiff,
          category: defaults.category || 'General',
          category_prefix: defaults.category_prefix,
          assessment_tier: defaults.assessment_tier || 'quiz',
          warnings: itemWarnings,
        });
      }
    }

    return {
      success: questions.length > 0,
      questions,
      warnings,
      format: 'xlsx',
      totalDetected: questions.length,
    };
  } catch (error: any) {
    return {
      success: false,
      questions: [],
      warnings: [`Error reading Excel file: ${error.message || String(error)}`],
      format: 'xlsx',
      totalDetected: 0,
    };
  }
}

/**
 * Returns a copy-pasteable sample of Aiken format text
 */
export function generateAikenSampleText(): string {
  return `What is the primary function of a CPU cache?
A. Permanent data storage
B. High-speed temporary storage for frequent instructions
C. Cooling the processor
D. Rendering 3D graphics
ANSWER: B

Which SQL command is used to remove a table structure permanently?
A. DELETE
B. REMOVE
C. DROP
D. TRUNCATE
ANSWER: C

HTTP operates at which layer of the OSI model?
A. Transport Layer
B. Network Layer
C. Application Layer
D. Data Link Layer
ANSWER: C

Boolean algebra was introduced by George Boole in 1854.
A. True
B. False
ANSWER: A
`.trim();
}

/**
 * Generates an Excel (.xlsx) template file as a downloadable Blob with styled column widths
 */
export function generateExcelTemplateBlob(courseCode?: string): Blob {
  const wsData = [
    ['Topic', 'Difficulty', 'Question Type', 'Question Text', 'Option A', 'Option B', 'Option C', 'Option D', 'Correct Answer', 'Marks'],
    ['Algorithms', 'medium', 'mcq', `What is the average time complexity of QuickSort in ${courseCode || 'Computing'}?`, 'O(N)', 'O(N log N)', 'O(N^2)', 'O(1)', 'B', 2],
    ['Data Structures', 'easy', 'mcq', 'Which data structure follows First-In, First-Out (FIFO)?', 'Stack', 'Queue', 'Binary Tree', 'Priority Queue', 'B', 1],
    ['Web Security', 'medium', 'true_false', 'HTTPS encrypts communication between the browser and web server.', 'TRUE', 'FALSE', '', '', 'A', 1],
    ['Architecture', 'hard', 'essay', 'Describe the key architectural differences between Monolithic and Microservices architectures.', '', '', '', '', 'Monoliths bundle all components into one codebase, while microservices isolate domains.', 5]
  ];

  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Set proportional column widths for comfortable spreadsheet viewing
  ws['!cols'] = [
    { wch: 18 }, // Topic
    { wch: 12 }, // Difficulty
    { wch: 15 }, // Question Type
    { wch: 50 }, // Question Text
    { wch: 22 }, // Option A
    { wch: 22 }, // Option B
    { wch: 22 }, // Option C
    { wch: 22 }, // Option D
    { wch: 16 }, // Correct Answer
    { wch: 8 },  // Marks
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Questions');

  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  return new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

/**
 * Generates clean, professional institutional filenames for question and exam templates.
 * 
 * Examples:
 * - courseCode="CSC 201" -> "CSC-201_Question_Template.xlsx"
 * - courseCode="MTH/101" -> "MTH-101_Question_Template.xlsx"
 * - courseCode undefined or "Course" -> "Exam_Question_Template.xlsx"
 * - format="aiken" or "txt" -> "CSC-201_Aiken_Template.txt"
 * - format="csv" -> "CSC-201_Question_Template.csv"
 * - format="xlsx" -> "CSC-201_Question_Template.xlsx"
 */
export function getCleanTemplateFilename(
  format: 'xlsx' | 'aiken' | 'txt' | 'csv',
  courseCode?: string
): string {
  const raw = (courseCode || '').trim();
  const isGeneric = !raw || raw.toLowerCase() === 'course' || raw.toLowerCase() === 'general';

  // Sanitize: replace slashes and whitespace with hyphens, strip non-alphanumeric except hyphen/underscore
  const cleanPrefix = isGeneric
    ? 'Exam'
    : raw
        .replace(/[\/\\]+/g, '-')
        .replace(/\s+/g, '-')
        .replace(/[^a-zA-Z0-9_-]/g, '')
        .replace(/-+/g, '-')
        .replace(/^[-_]+|[-_]+$/g, '') || 'Exam';

  if (format === 'aiken' || format === 'txt') {
    return `${cleanPrefix}_Aiken_Template.txt`;
  }
  if (format === 'xlsx') {
    return `${cleanPrefix}_Question_Template.xlsx`;
  }
  return `${cleanPrefix}_Question_Template.csv`;
}

