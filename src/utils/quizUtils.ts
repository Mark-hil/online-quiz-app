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

// Safely parse question options from various database formats
export function parseOptions(rawOptions: any): string[] {
  if (!rawOptions) return [];
  if (Array.isArray(rawOptions)) return rawOptions.map(String);

  if (typeof rawOptions === 'string') {
    try {
      let parsed = JSON.parse(rawOptions);

      // Handle double-stringified JSON (where the parsed result is still a string that looks like an array)
      if (typeof parsed === 'string') {
        try {
          const innerParsed = JSON.parse(parsed);
          if (Array.isArray(innerParsed)) {
            parsed = innerParsed;
          } else if (innerParsed && typeof innerParsed === 'object') {
            parsed = innerParsed;
          }
        } catch {
          // If inner parsing fails, stick with the outer parsed value
        }
      }

      if (Array.isArray(parsed)) return parsed.map(String);
      if (parsed && typeof parsed === 'object') return Object.values(parsed).map(String);
      return [String(parsed)];
    } catch {
      return [rawOptions];
    }
  }

  if (typeof rawOptions === 'object') {
    return Object.values(rawOptions).map(String);
  }

  return [String(rawOptions)];
}
