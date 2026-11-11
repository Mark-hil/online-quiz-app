import { Question, QuizAttempt } from '../lib/database';

export interface QuizAttemptWithTracking extends QuizAttempt {
  startTime: number;
  lastActiveTime: number;
  isFullscreen: boolean;
}

export interface SuspiciousActivity {
  tabSwitches: Array<{ timestamp: number; duration?: number }>;
  timePaused: number;
  fullscreenExits: Array<{ timestamp: number }>;
  copyAttempts: Array<{ timestamp: number }>;
  pasteAttempts: Array<{ timestamp: number }>;
}

// Seeded PRNG (Mulberry32)
function mulberry32(a: number) {
  return function () {
    var t = a += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
}

// Simple string hasher to generate a seed number
function hashString(str: string) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = Math.imul(31, hash) + str.charCodeAt(i) | 0;
  }
  return hash;
}

// Fisher-Yates shuffle algorithm for unbiased randomization with optional seed
export function shuffleArray<T>(array: T[], seed?: string): T[] {
  const shuffled = [...array];
  const random = seed ? mulberry32(hashString(seed)) : Math.random;

  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// Randomize questions and options based on Exams Settings
export function prepareQuizQuestions(
  questions: Question[],
  randomizeQuestions: boolean = false,
  randomizeOptions: boolean = false,
  seed?: string
): Question[] {
  let processedQuestions = [...questions];

  // Randomize question order if enabled
  if (randomizeQuestions) {
    processedQuestions = shuffleArray(processedQuestions, seed ? `${seed}-q` : undefined);
  }

  // Randomize options for each question if enabled
  if (randomizeOptions) {
    processedQuestions = processedQuestions.map(question => {
      if (question.question_type === 'mcq' && question.options) {
        const options = parseOptions(question.options);

        if (options.length > 0) {
          // Keep track of original correct answer index
          const originalCorrectIndex = options.findIndex(
            option => option === question.correct_answer
          );

          // Shuffle options with a question-specific seed
          const shuffledOptions = shuffleArray(options, seed ? `${seed}-opt-${question.id}` : undefined);

          // Find new index of correct answer
          const newCorrectIndex = shuffledOptions.findIndex(
            option => option === question.correct_answer
          );

          return {
            ...question,
            options: shuffledOptions,
            // Store the original correct answer for grading
            correct_answer: question.correct_answer,
            // Add metadata for option mapping
            originalOptionIndex: originalCorrectIndex,
            shuffledOptionIndex: newCorrectIndex
          };
        }
      }
      return question;
    });
  }

  return processedQuestions;
}

// Anti-cheating monitoring class
export class AntiCheatMonitor {
  private suspiciousActivity: SuspiciousActivity;
  private lastActiveTime: number;
  private tabSwitchCount: number = 0;

  constructor(_attemptId: string) {
    this.lastActiveTime = Date.now();
    this.suspiciousActivity = {
      tabSwitches: [],
      timePaused: 0,
      fullscreenExits: [],
      copyAttempts: [],
      pasteAttempts: []
    };
  }

  // Track tab switching
  onTabSwitch() {
    this.tabSwitchCount++;
    const timestamp = Date.now();
    this.suspiciousActivity.tabSwitches.push({
      timestamp,
      duration: timestamp - this.lastActiveTime
    });
    this.lastActiveTime = timestamp;
  }

  // Track fullscreen exit
  onFullscreenExit() {
    this.suspiciousActivity.fullscreenExits.push({
      timestamp: Date.now()
    });
  }

  // Track copy attempts
  onCopyAttempt() {
    this.suspiciousActivity.copyAttempts.push({
      timestamp: Date.now()
    });
  }

  // Track paste attempts
  onPasteAttempt() {
    this.suspiciousActivity.pasteAttempts.push({
      timestamp: Date.now()
    });
  }

  // Update pause time
  addPauseTime(duration: number) {
    this.suspiciousActivity.timePaused += duration;
  }

  // Get suspicious activity summary
  getSuspiciousActivity(): SuspiciousActivity {
    return { ...this.suspiciousActivity };
  }

  // Get risk score (0-100, higher = more suspicious)
  getRiskScore(): number {
    let score = 0;

    // Tab switches (10 points each)
    score += Math.min(this.suspiciousActivity.tabSwitches.length * 10, 30);

    // Fullscreen exits (15 points each)
    score += Math.min(this.suspiciousActivity.fullscreenExits.length * 15, 30);

    // Copy/paste attempts (5 points each)
    score += Math.min((this.suspiciousActivity.copyAttempts.length +
      this.suspiciousActivity.pasteAttempts.length) * 5, 20);

    // Excessive pause time (1 point per 30 seconds, max 20)
    const pauseMinutes = this.suspiciousActivity.timePaused / 60000;
    score += Math.min(Math.floor(pauseMinutes / 0.5), 20);

    return Math.min(score, 100);
  }

  // Get formatted activity report
  getActivityReport(): string {
    const report = [
      `Tab Switches: ${this.suspiciousActivity.tabSwitches.length}`,
      `Fullscreen Exits: ${this.suspiciousActivity.fullscreenExits.length}`,
      `Copy Attempts: ${this.suspiciousActivity.copyAttempts.length}`,
      `Paste Attempts: ${this.suspiciousActivity.pasteAttempts.length}`,
      `Total Pause Time: ${Math.floor(this.suspiciousActivity.timePaused / 60000)} minutes`,
      `Risk Score: ${this.getRiskScore()}/100`
    ];

    return report.join('\n');
  }
}

// Setup anti-cheating event listeners
export function setupAntiCheatMonitoring(monitor: AntiCheatMonitor): () => void {
  const handleVisibilityChange = () => {
    if (document.hidden) {
      monitor.onTabSwitch();
    }
  };

  const handleFullscreenChange = () => {
    if (!document.fullscreenElement) {
      monitor.onFullscreenExit();
    }
  };

  const handleCopy = (_e: ClipboardEvent) => {
    monitor.onCopyAttempt();
    // Optionally prevent copy
    // _e.preventDefault();
  };

  const handlePaste = (_e: ClipboardEvent) => {
    monitor.onPasteAttempt();
    // Optionally prevent paste
    // _e.preventDefault();
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    // Detect common cheating shortcuts
    if (e.ctrlKey || e.metaKey) {
      switch (e.key) {
        case 'c':
        case 'v':
        case 'x':
          // These are handled by copy/paste events
          break;
        case 'r':
          // Prevent refresh
          e.preventDefault();
          break;
        case 'f':
          // Prevent find
          e.preventDefault();
          break;
      }
    }

    // Prevent F12 (developer tools)
    if (e.key === 'F12') {
      e.preventDefault();
    }
  };

  // Add event listeners
  document.addEventListener('visibilitychange', handleVisibilityChange);
  document.addEventListener('fullscreenchange', handleFullscreenChange);
  document.addEventListener('copy', handleCopy);
  document.addEventListener('paste', handlePaste);
  document.addEventListener('keydown', handleKeyDown);

  // Disable right click
  const handleContextMenu = (e: MouseEvent) => {
    e.preventDefault();
  };
  document.addEventListener('contextmenu', handleContextMenu);

  // Return cleanup function
  return () => {
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    document.removeEventListener('fullscreenchange', handleFullscreenChange);
    document.removeEventListener('copy', handleCopy);
    document.removeEventListener('paste', handlePaste);
    document.removeEventListener('keydown', handleKeyDown);
    document.removeEventListener('contextmenu', handleContextMenu);
  };
}

// Request fullscreen mode
export function requestFullscreen(): Promise<void> {
  const element = document.documentElement;

  if (element.requestFullscreen) {
    return element.requestFullscreen();
  } else if ((element as any).mozRequestFullScreen) {
    return (element as any).mozRequestFullScreen();
  } else if ((element as any).webkitRequestFullscreen) {
    return (element as any).webkitRequestFullscreen();
  } else if ((element as any).msRequestFullscreen) {
    return (element as any).msRequestFullscreen();
  } else {
    return Promise.reject(new Error('Fullscreen not supported'));
  }
}

// Get client IP address (requires server-side implementation)
export async function getClientIPAddress(): Promise<string> {
  try {
    // This is a placeholder - you'd need to implement a server endpoint
    // For now, return a placeholder
    const response = await fetch('/api/client-ip');
    const data = await response.json();
    return data.ip || 'unknown';
  } catch {
    return 'unknown';
  }
}

// Get user agent string
export function getUserAgent(): string {
  return navigator.userAgent;
}

// Safely parse question options from various database, export, and legacy formats
export function parseOptions(rawOptions: any): string[] {
  if (!rawOptions) return [];

  // Helper to recursively unwrap JSON strings or nested representations
  const unwrapValue = (val: any, depth = 0): any => {
    if (depth > 6 || val === null || val === undefined) return val;

    if (typeof val === 'string') {
      const trimmed = val.trim();
      // If it looks like a JSON array, object, or string
      if (
        (trimmed.startsWith('[') && trimmed.endsWith(']')) ||
        (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
        (trimmed.startsWith('"') && trimmed.endsWith('"'))
      ) {
        try {
          const parsed = JSON.parse(trimmed);
          return unwrapValue(parsed, depth + 1);
        } catch {
          return trimmed;
        }
      }
      return trimmed;
    }

    if (Array.isArray(val)) {
      // Check if this array is effectively wrapping a stringified array in its first item
      // e.g.: ['["3","4","5","6"]', '', '', ''] or ['["3","4","5","6"]']
      const nonBlank = val.filter(item => item !== '' && item !== null && item !== undefined);
      if (nonBlank.length === 1 && typeof nonBlank[0] === 'string') {
        const candidate = unwrapValue(nonBlank[0], depth + 1);
        if (Array.isArray(candidate)) {
          return candidate;
        }
      }

      // Check if any element inside is a JSON-stringified array or needs individual unwrapping
      return val.map(item => {
        const unwrappedItem = unwrapValue(item, depth + 1);
        return typeof unwrappedItem === 'string' || typeof unwrappedItem === 'number'
          ? String(unwrappedItem)
          : Array.isArray(unwrappedItem)
            ? unwrappedItem.join(', ')
            : JSON.stringify(unwrappedItem);
      });
    }

    if (typeof val === 'object') {
      return Object.values(val).map(String);
    }

    return val;
  };

  const parsed = unwrapValue(rawOptions);

  if (Array.isArray(parsed)) {
    return parsed.map(item => String(item ?? '').trim());
  }

  if (parsed && typeof parsed === 'object') {
    return Object.values(parsed).map(item => String(item ?? '').trim());
  }

  const str = String(parsed ?? '').trim();
  return str ? [str] : [];
}

// Determines if student's answer matches the correct answer across multiple conventions (letter vs text vs true/false)
export function isAnswerCorrect(
  studentAnswer: string | undefined | null,
  correctAnswer: string | undefined | null,
  rawOptions?: any,
  questionType?: string
): boolean {
  if (studentAnswer === undefined || studentAnswer === null || correctAnswer === undefined || correctAnswer === null) {
    return false;
  }

  const sAns = String(studentAnswer).trim();
  const cAns = String(correctAnswer).trim();

  if (!sAns || !cAns) return false;

  // 1. Direct case-insensitive match
  if (sAns.toLowerCase() === cAns.toLowerCase()) {
    return true;
  }

  // 2. True / False normalization
  if (questionType === 'true_false') {
    const normalizeTf = (val: string) => {
      const v = val.toLowerCase().trim();
      if (['true', 't', '1', 'a'].includes(v)) return 'true';
      if (['false', 'f', '0', 'b'].includes(v)) return 'false';
      return v;
    };
    return normalizeTf(sAns) === normalizeTf(cAns);
  }

  // 3. Option letter <-> option text matching
  const options = parseOptions(rawOptions);
  if (options.length > 0) {
    // If correct answer is a letter (e.g. 'A', 'B', 'C', 'D'...)
    if (/^[A-Za-z]$/.test(cAns)) {
      const optIndex = cAns.toUpperCase().charCodeAt(0) - 65;
      if (optIndex >= 0 && optIndex < options.length) {
        const expectedOptionText = options[optIndex];
        if (sAns.toLowerCase() === expectedOptionText.toLowerCase()) {
          return true;
        }
      }
    }

    // If correct answer is a numeric index (e.g. '0', '1', '2'...)
    if (/^\d+$/.test(cAns)) {
      const optIndex = parseInt(cAns, 10);
      if (optIndex >= 0 && optIndex < options.length) {
        const expectedOptionText = options[optIndex];
        if (sAns.toLowerCase() === expectedOptionText.toLowerCase()) {
          return true;
        }
      }
    }

    // If student answer is a letter (e.g. 'B') and correct answer is option text (e.g. '4')
    if (/^[A-Za-z]$/.test(sAns)) {
      const optIndex = sAns.toUpperCase().charCodeAt(0) - 65;
      if (optIndex >= 0 && optIndex < options.length) {
        const studentOptionText = options[optIndex];
        if (studentOptionText.toLowerCase() === cAns.toLowerCase()) {
          return true;
        }
      }
    }

    // Strip common option prefixes like "A. ", "B) ", "(C) "
    const stripPrefix = (val: string) => val.replace(/^(\([A-Za-z]\)|[A-Za-z][.)])\s*/, '').trim().toLowerCase();
    if (stripPrefix(sAns) === stripPrefix(cAns)) {
      return true;
    }
  }

  return false;
}

// Formats the correct answer for presentation (e.g. "B. 4" or "True" or "C. Paris")
export function formatDisplayCorrectAnswer(
  correctAnswer: string | undefined | null,
  rawOptions?: any,
  questionType?: string
): string {
  if (!correctAnswer) return 'Not available';
  const cAns = String(correctAnswer).trim();

  if (questionType === 'true_false') {
    const upper = cAns.toUpperCase();
    if (upper === 'A' || upper === 'TRUE' || upper === 'T' || upper === '1') return 'True';
    if (upper === 'B' || upper === 'FALSE' || upper === 'F' || upper === '0') return 'False';
    return cAns.charAt(0).toUpperCase() + cAns.slice(1).toLowerCase();
  }

  const options = parseOptions(rawOptions);
  if (options.length > 0) {
    if (/^[A-Za-z]$/.test(cAns)) {
      const idx = cAns.toUpperCase().charCodeAt(0) - 65;
      if (idx >= 0 && idx < options.length) {
        return `${cAns.toUpperCase()}. ${options[idx]}`;
      }
    }
    if (/^\d+$/.test(cAns)) {
      const idx = parseInt(cAns, 10);
      if (idx >= 0 && idx < options.length) {
        const letter = String.fromCharCode(65 + idx);
        return `${letter}. ${options[idx]}`;
      }
    }
    // If cAns matches an option text, prefix with its letter
    const foundIdx = options.findIndex(o => o.toLowerCase() === cAns.toLowerCase());
    if (foundIdx !== -1) {
      const letter = String.fromCharCode(65 + foundIdx);
      return `${letter}. ${options[foundIdx]}`;
    }
  }

  return cAns;
}

/**
 * Checks if a specific option (by text and index) matches the question's correct answer.
 * Handles letter keys ('A', 'B'), numeric index ('0', '1'), or literal option text.
 */
export function isOptionMatch(
  optionText: string,
  optIndex: number,
  correctAnswer: string | undefined | null,
  _rawOptions?: any
): boolean {
  if (!correctAnswer) return false;
  const cAns = String(correctAnswer).trim();
  const opt = String(optionText).trim();

  // 1. Direct text match (case-insensitive)
  if (opt.toLowerCase() === cAns.toLowerCase()) return true;

  // 2. Letter match ('A' = index 0, 'B' = index 1, etc.)
  if (/^[A-Za-z]$/.test(cAns)) {
    const letterIdx = cAns.toUpperCase().charCodeAt(0) - 65;
    if (letterIdx === optIndex) return true;
  }

  // 3. Numeric index match
  if (/^\d+$/.test(cAns)) {
    if (parseInt(cAns, 10) === optIndex) return true;
  }

  // 4. Prefix match (e.g. cAns is "A. Mars" and opt is "Mars")
  const stripPrefix = (val: string) => val.replace(/^(\([A-Za-z]\)|[A-Za-z][.)])\s*/, '').trim().toLowerCase();
  if (stripPrefix(opt) === stripPrefix(cAns)) return true;

  return false;
}

/**
 * Normalizes frozen rows returned by `db.getAttemptQuestions(attemptId)` into Question objects.
 */
export function mapFrozenAttemptQuestions(
  frozen: any[],
  quizId: string,
  lecturerId = ''
): Question[] {
  return (frozen || []).map((f: any) => ({
    id: f.question_bank_id || f.id,
    quiz_id: quizId,
    lecturer_id: lecturerId,
    question_text: f.question_text,
    question_type: f.question_type,
    options: typeof f.options === 'string' ? f.options : JSON.stringify(f.options || []),
    correct_answer: f.correct_answer,
    marks: Number(f.marks || 1),
    created_at: f.created_at || new Date().toISOString(),
  }));
}

/**
 * Computes the denominator for a dynamic-draw attempt that is missing `quiz_attempt_questions` rows.
 * Caps/floors by `drawQuestionCount` so skipped questions are not forgiven and the full bank is never used.
 */
export function computeDynamicDrawPossibleMarks(
  matchedQuestions: Array<{ marks?: number | null }>,
  drawQuestionCount?: number | null
): number {
  const matchedMarks = matchedQuestions.reduce((sum, q) => sum + Number(q.marks || 1), 0);
  const drawCount = Number(drawQuestionCount || 0);
  if (drawCount <= 0) {
    return matchedMarks;
  }
  if (matchedQuestions.length >= drawCount) {
    return matchedMarks;
  }
  const avgMark = matchedQuestions.length > 0 ? matchedMarks / matchedQuestions.length : 1;
  return Math.max(matchedMarks, Math.round(drawCount * avgMark));
}

/**
 * Resolves the authoritative question list and denominator (`totalPossibleMarks`) for grading/displaying
 * an attempt, ensuring dynamic-draw quizzes never divide by the entire Course Question Bank.
 */
export async function resolveAttemptQuestionsForGrading(params: {
  attemptId: string;
  quiz: {
    id: string;
    lecturer_id?: string;
    is_dynamic_draw?: boolean;
    draw_question_count?: number | null;
  };
  studentAnswers: Array<{ question_id: string }>;
  defaultQuizQuestions?: Question[];
  fetchAttemptQuestions: (attemptId: string) => Promise<any[]>;
  fetchQuizQuestions: (quizId: string) => Promise<any[]>;
}): Promise<{ questions: Question[]; totalPossibleMarks: number; usedFrozen: boolean }> {
  const { attemptId, quiz, studentAnswers, defaultQuizQuestions, fetchAttemptQuestions, fetchQuizQuestions } = params;

  const frozen = await fetchAttemptQuestions(attemptId);
  if (frozen && frozen.length > 0) {
    const questions = mapFrozenAttemptQuestions(frozen, quiz.id, quiz.lecturer_id || '');
    const totalPossibleMarks = questions.reduce((sum, q) => sum + Number(q.marks || 1), 0);
    return { questions, totalPossibleMarks, usedFrozen: true };
  }

  const allQuizOrBankQuestions = defaultQuizQuestions ?? (await fetchQuizQuestions(quiz.id));

  if (quiz?.is_dynamic_draw) {
    const answeredIds = new Set(studentAnswers.map((a) => a.question_id));
    const matchedQuestions = (allQuizOrBankQuestions || []).filter((q: any) => answeredIds.has(q.id));
    const totalPossibleMarks = computeDynamicDrawPossibleMarks(
      matchedQuestions,
      quiz.draw_question_count
    );
    return { questions: matchedQuestions, totalPossibleMarks, usedFrozen: false };
  }

  const questions = (allQuizOrBankQuestions || []) as Question[];
  const totalPossibleMarks = questions.reduce((sum, q) => sum + Number(q.marks || 1), 0);
  return { questions, totalPossibleMarks, usedFrozen: false };
}

/**
 * Returns the effective total marks for display/export on a quiz, respecting `draw_question_count`
 * when `is_dynamic_draw` is enabled so stale `quiz.total_marks` values don't skew raw scores.
 */
export function getEffectiveQuizTotalMarks(
  quiz?: {
    is_dynamic_draw?: boolean;
    draw_question_count?: number | null;
    total_marks?: number | null;
  } | null,
  attemptQuestions?: Array<{ marks?: number | null }>
): number {
  if (attemptQuestions && attemptQuestions.length > 0) {
    return attemptQuestions.reduce((sum, q) => sum + Number(q.marks || 1), 0);
  }
  if (quiz?.is_dynamic_draw && Number(quiz.draw_question_count) > 0) {
    return Number(quiz.draw_question_count);
  }
  return Number(quiz?.total_marks ?? 100);
}

