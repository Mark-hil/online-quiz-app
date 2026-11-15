export interface InitialTimerParams {
  durationMinutes: number;
  isCohortSession: boolean;
  quizDeadlineMs?: number | null;
  nowMs?: number;
}

export interface RemainingTimerParams {
  durationMinutes: number;
  extensionMinutes?: number;
  startedAtMs: number;
  serverNowMs: number;
  isCohortSession: boolean;
  quizDeadlineMs?: number | null;
  graceMinutes?: number;
}

export interface RemainingTimerResult {
  totalSeconds: number;
  elapsedSeconds: number;
  remainingSeconds: number;
  isPermanentlyExpired: boolean;
}

/**
 * Industrial-standard CBT initial timer calculation:
 * - For Cohort Sessions (`isCohortSession = true`), `start_time -> end_time` is strictly
 *   the Check-In / Admission Window. Any candidate admitted before `end_time` receives
 *   their full `durationMinutes` allocation (never truncated by `end_time` or legacy `quiz.deadline`).
 * - For standalone non-cohort assessments (`isCohortSession = false`), `quizDeadlineMs`
 *   bounds the remaining time if configured.
 */
export function calculateInitialAttemptSeconds({
  durationMinutes,
  isCohortSession,
  quizDeadlineMs = null,
  nowMs = Date.now(),
}: InitialTimerParams): number {
  let initialSeconds = Math.max(0, Math.round((Number(durationMinutes) || 0) * 60));

  if (!isCohortSession && quizDeadlineMs && !Number.isNaN(quizDeadlineMs)) {
    const secondsToDeadline = Math.floor((quizDeadlineMs - nowMs) / 1000);
    if (secondsToDeadline > 0) {
      initialSeconds = Math.min(initialSeconds, secondsToDeadline);
    }
  }

  return initialSeconds;
}

/**
 * Industrial-standard CBT resume/heartbeat timer calculation:
 * - Measures elapsed time from the candidate's individual `startedAtMs` against `serverNowMs`.
 * - Adds any approved `extensionMinutes`.
 * - Does NOT truncate an active cohort attempt when the room check-in window (`end_time`) closes.
 */
export function calculateRemainingAttemptSeconds({
  durationMinutes,
  extensionMinutes = 0,
  startedAtMs,
  serverNowMs,
  isCohortSession,
  quizDeadlineMs = null,
  graceMinutes = 15,
}: RemainingTimerParams): RemainingTimerResult {
  const baseSeconds = Math.max(0, Math.round((Number(durationMinutes) || 0) * 60));
  const extSeconds = Math.max(0, Math.round((Number(extensionMinutes) || 0) * 60));
  const totalSeconds = baseSeconds + extSeconds;
  const elapsedSeconds = Math.max(0, Math.floor((serverNowMs - startedAtMs) / 1000));
  let remainingSeconds = Math.max(0, totalSeconds - elapsedSeconds);

  if (!isCohortSession && quizDeadlineMs && !Number.isNaN(quizDeadlineMs)) {
    const secondsToDeadline = Math.floor((quizDeadlineMs - serverNowMs) / 1000);
    if (secondsToDeadline >= 0) {
      remainingSeconds = Math.min(remainingSeconds, secondsToDeadline);
    } else {
      remainingSeconds = 0;
    }
  }

  const graceExceeded = totalSeconds + graceMinutes * 60 <= elapsedSeconds;
  const standaloneDeadlinePassed =
    !isCohortSession && Boolean(quizDeadlineMs && !Number.isNaN(quizDeadlineMs) && quizDeadlineMs < serverNowMs);

  return {
    totalSeconds,
    elapsedSeconds,
    remainingSeconds,
    isPermanentlyExpired: graceExceeded || standaloneDeadlinePassed,
  };
}

/**
 * Detects whether an existing `in_progress` attempt was opened prior to the
 * assigned cohort session's check-in window (e.g. before sessions/PINs were attached).
 */
export function isStalePreSessionAttempt(
  attemptStartedAtMs: number,
  sessionStartTimeMs?: number | null
): boolean {
  if (!sessionStartTimeMs || Number.isNaN(sessionStartTimeMs) || Number.isNaN(attemptStartedAtMs)) {
    return false;
  }
  // Allow 60s clock skew buffer
  return attemptStartedAtMs < sessionStartTimeMs - 60_000;
}

