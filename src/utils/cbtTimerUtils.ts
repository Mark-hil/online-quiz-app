export type LateLoginPolicyRatio = 0 | 0.25 | 0.5 | 0.75 | 1;

export const DEFAULT_LATE_LOGIN_FLOOR_RATIO: number = 0.5; // Half of the time set (50%)

export interface InitialTimerParams {
  durationMinutes: number;
  isCohortSession: boolean;
  quizDeadlineMs?: number | null;
  nowMs?: number;
  lateLoginFloorRatio?: number;
}

export interface RemainingTimerParams {
  durationMinutes: number;
  extensionMinutes?: number;
  startedAtMs: number;
  serverNowMs: number;
  isCohortSession: boolean;
  quizDeadlineMs?: number | null;
  graceMinutes?: number;
  lateLoginFloorRatio?: number;
}

export interface RemainingTimerResult {
  totalSeconds: number;
  elapsedSeconds: number;
  remainingSeconds: number;
  isPermanentlyExpired: boolean;
}

/**
 * Computes the effective base seconds allocated to an attempt at the moment it starts:
 * - Cohort Sessions (`isCohortSession = true`): always receive full `durationMinutes`.
 * - Standard Quizzes (`isCohortSession = false`): if `quizDeadlineMs` is closer than `durationMinutes`,
 *   guarantees at least `durationMinutes * lateLoginFloorRatio` (default 50% = Half of Duration)
 *   so a student logging in 5 minutes before the deadline receives half of the quiz time instead of 5 minutes,
 *   while still preventing late starters from getting 100% full time for relay cheating.
 */
export function computeAllocatedBaseSeconds({
  durationMinutes,
  isCohortSession,
  quizDeadlineMs = null,
  startedAtMs,
  lateLoginFloorRatio = DEFAULT_LATE_LOGIN_FLOOR_RATIO,
}: {
  durationMinutes: number;
  isCohortSession: boolean;
  quizDeadlineMs?: number | null;
  startedAtMs: number;
  lateLoginFloorRatio?: number;
}): number {
  const fullSeconds = Math.max(0, Math.round((Number(durationMinutes) || 0) * 60));

  if (isCohortSession || !quizDeadlineMs || Number.isNaN(quizDeadlineMs)) {
    return fullSeconds;
  }

  const clampedRatio = Math.min(1, Math.max(0, Number.isFinite(lateLoginFloorRatio) ? lateLoginFloorRatio : DEFAULT_LATE_LOGIN_FLOOR_RATIO));
  const floorSeconds = Math.round(fullSeconds * clampedRatio);
  const secondsToDeadlineAtStart = Math.floor((quizDeadlineMs - startedAtMs) / 1000);

  if (secondsToDeadlineAtStart > 0) {
    return Math.min(fullSeconds, Math.max(secondsToDeadlineAtStart, floorSeconds));
  }

  // If attempt was started before or at the deadline boundary, grant at least the floor
  return floorSeconds;
}

/**
 * Industrial-standard CBT initial timer calculation:
 * - Grants full `durationMinutes` when starting early or in a cohort session.
 * - Grants at least `durationMinutes * lateLoginFloorRatio` (default 50% = Half of Duration)
 *   when starting shortly before `quizDeadlineMs`.
 */
export function calculateInitialAttemptSeconds({
  durationMinutes,
  isCohortSession,
  quizDeadlineMs = null,
  nowMs = Date.now(),
  lateLoginFloorRatio = DEFAULT_LATE_LOGIN_FLOOR_RATIO,
}: InitialTimerParams): number {
  return computeAllocatedBaseSeconds({
    durationMinutes,
    isCohortSession,
    quizDeadlineMs,
    startedAtMs: nowMs,
    lateLoginFloorRatio,
  });
}

/**
 * Industrial-standard CBT resume/heartbeat timer calculation:
 * - Measures elapsed time from the candidate's individual `startedAtMs` against `serverNowMs`.
 * - Uses `computeAllocatedBaseSeconds` (respecting the Half-Duration Floor) plus any Admin `extensionMinutes`.
 */
export function calculateRemainingAttemptSeconds({
  durationMinutes,
  extensionMinutes = 0,
  startedAtMs,
  serverNowMs,
  isCohortSession,
  quizDeadlineMs = null,
  graceMinutes = 15,
  lateLoginFloorRatio = DEFAULT_LATE_LOGIN_FLOOR_RATIO,
}: RemainingTimerParams): RemainingTimerResult {
  const allocatedBaseSeconds = computeAllocatedBaseSeconds({
    durationMinutes,
    isCohortSession,
    quizDeadlineMs,
    startedAtMs,
    lateLoginFloorRatio,
  });
  const extSeconds = Math.max(0, Math.round((Number(extensionMinutes) || 0) * 60));
  const totalSeconds = allocatedBaseSeconds + extSeconds;
  const elapsedSeconds = Math.max(0, Math.floor((serverNowMs - startedAtMs) / 1000));
  const remainingSeconds = Math.max(0, totalSeconds - elapsedSeconds);

  const graceExceeded = totalSeconds + graceMinutes * 60 <= elapsedSeconds;

  return {
    totalSeconds,
    elapsedSeconds,
    remainingSeconds,
    isPermanentlyExpired: graceExceeded,
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
