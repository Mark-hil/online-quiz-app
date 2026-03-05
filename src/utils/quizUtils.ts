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

// Fisher-Yates shuffle algorithm for unbiased randomization
export function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// Randomize questions and options based on quiz settings
export function prepareQuizQuestions(
  questions: Question[],
  randomizeQuestions: boolean = false,
  randomizeOptions: boolean = false
): Question[] {
  let processedQuestions = [...questions];

  // Randomize question order if enabled
  if (randomizeQuestions) {
    processedQuestions = shuffleArray(processedQuestions);
  }

  // Randomize options for each question if enabled
  if (randomizeOptions) {
    processedQuestions = processedQuestions.map(question => {
      if (question.question_type === 'mcq' && question.options) {
        let options: string[];
        
        if (Array.isArray(question.options)) {
          options = [...question.options];
        } else if (typeof question.options === 'string') {
          try {
            options = JSON.parse(question.options);
          } catch {
            options = [];
          }
        } else {
          options = [];
        }

        if (options.length > 0) {
          // Keep track of original correct answer index
          const originalCorrectIndex = options.findIndex(
            option => option === question.correct_answer
          );
          
          // Shuffle options
          const shuffledOptions = shuffleArray(options);
          
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
