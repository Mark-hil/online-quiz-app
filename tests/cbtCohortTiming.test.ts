import { describe, it, expect } from 'vitest';
import {
  calculateInitialAttemptSeconds,
  calculateRemainingAttemptSeconds,
  isStalePreSessionAttempt,
} from '../src/utils/cbtTimerUtils';

describe('CBT Cohort Timing & Personal Duration Engine (cbtTimerUtils)', () => {
  const ONE_MINUTE_MS = 60 * 1000;

  describe('calculateInitialAttemptSeconds', () => {
    it('grants full quiz.duration_minutes for a cohort session even if check-in occurs 5 minutes before session end_time or past legacy quiz.deadline', () => {
      const nowMs = Date.parse('2026-11-15T10:55:00Z');
      // Even if legacy quiz.deadline was 5 minutes from now (or in the past), cohort session ignores it
      const legacyDeadlineMs = Date.parse('2026-11-15T11:00:00Z');

      const initialSeconds = calculateInitialAttemptSeconds({
        durationMinutes: 60,
        isCohortSession: true,
        quizDeadlineMs: legacyDeadlineMs,
        nowMs,
      });

      expect(initialSeconds).toBe(3600); // Full 60 minutes (3600s), not 300s!
    });

    it('clamps initial seconds to quiz.deadline for non-cohort (standard) quizzes when deadline is closer than duration', () => {
      const nowMs = Date.parse('2026-11-15T10:50:00Z');
      const deadlineMs = Date.parse('2026-11-15T11:00:00Z'); // 10 minutes left until deadline

      const initialSeconds = calculateInitialAttemptSeconds({
        durationMinutes: 45,
        isCohortSession: false,
        quizDeadlineMs: deadlineMs,
        nowMs,
      });

      expect(initialSeconds).toBe(600); // 10 minutes (600s)
    });

    it('returns full duration for non-cohort quizzes when deadline is far in the future', () => {
      const nowMs = Date.parse('2026-11-15T08:00:00Z');
      const deadlineMs = Date.parse('2026-11-15T18:00:00Z');

      const initialSeconds = calculateInitialAttemptSeconds({
        durationMinutes: 30,
        isCohortSession: false,
        quizDeadlineMs: deadlineMs,
        nowMs,
      });

      expect(initialSeconds).toBe(1800);
    });
  });

  describe('calculateRemainingAttemptSeconds', () => {
    it('does NOT expire or truncate a cohort student who checked in at 10:55 AM when serverNow is 11:10 AM (after 11:00 AM check-in close)', () => {
      const startedAtMs = Date.parse('2026-11-15T10:55:00Z');
      const serverNowMs = Date.parse('2026-11-15T11:10:00Z'); // 15 minutes elapsed
      const legacyDeadlineMs = Date.parse('2026-11-15T11:00:00Z'); // passed 10 mins ago

      const result = calculateRemainingAttemptSeconds({
        durationMinutes: 60,
        extensionMinutes: 0,
        startedAtMs,
        serverNowMs,
        isCohortSession: true,
        quizDeadlineMs: legacyDeadlineMs,
      });

      expect(result.isPermanentlyExpired).toBe(false);
      expect(result.remainingSeconds).toBe(45 * 60); // 45 minutes remaining out of 60
      expect(result.elapsedSeconds).toBe(15 * 60);
    });

    it('honors invigilator time extensions (time_remaining) on top of duration_minutes', () => {
      const startedAtMs = Date.parse('2026-11-15T10:00:00Z');
      const serverNowMs = Date.parse('2026-11-15T10:50:00Z'); // 50 minutes elapsed

      const result = calculateRemainingAttemptSeconds({
        durationMinutes: 45,
        extensionMinutes: 15, // +15 mins extension => 60 mins total
        startedAtMs,
        serverNowMs,
        isCohortSession: true,
        quizDeadlineMs: null,
      });

      expect(result.isPermanentlyExpired).toBe(false);
      expect(result.remainingSeconds).toBe(10 * 60); // 10 minutes left
    });

    it('marks a cohort attempt as permanently expired only after duration + extension + graceMinutes has elapsed', () => {
      const startedAtMs = Date.parse('2026-11-15T10:00:00Z');
      // 30m duration + 15m grace = 45m total before hard expiration
      const at40Mins = startedAtMs + 40 * ONE_MINUTE_MS;
      const at46Mins = startedAtMs + 46 * ONE_MINUTE_MS;

      const withinGrace = calculateRemainingAttemptSeconds({
        durationMinutes: 30,
        startedAtMs,
        serverNowMs: at40Mins,
        isCohortSession: true,
        graceMinutes: 15,
      });
      expect(withinGrace.remainingSeconds).toBe(0);
      expect(withinGrace.isPermanentlyExpired).toBe(false);

      const pastGrace = calculateRemainingAttemptSeconds({
        durationMinutes: 30,
        startedAtMs,
        serverNowMs: at46Mins,
        isCohortSession: true,
        graceMinutes: 15,
      });
      expect(pastGrace.remainingSeconds).toBe(0);
      expect(pastGrace.isPermanentlyExpired).toBe(true);
    });

    it('enforces quiz.deadline for non-cohort quizzes', () => {
      const startedAtMs = Date.parse('2026-11-15T10:30:00Z');
      const quizDeadlineMs = Date.parse('2026-11-15T11:00:00Z');
      const serverNowAfterDeadline = Date.parse('2026-11-15T11:01:00Z');

      const result = calculateRemainingAttemptSeconds({
        durationMinutes: 60,
        startedAtMs,
        serverNowMs: serverNowAfterDeadline,
        isCohortSession: false,
        quizDeadlineMs,
      });

      expect(result.remainingSeconds).toBe(0);
      expect(result.isPermanentlyExpired).toBe(true);
    });
  });

  describe('isStalePreSessionAttempt', () => {
    it('identifies an in-progress attempt created before the cohort session check-in start window (beyond 60s clock-skew tolerance)', () => {
      const sessionStartMs = Date.parse('2026-11-15T10:00:00Z');
      const attemptYesterdayMs = Date.parse('2026-11-14T15:00:00Z');
      const attemptOnTimeMs = Date.parse('2026-11-15T10:02:00Z');

      expect(isStalePreSessionAttempt(attemptYesterdayMs, sessionStartMs)).toBe(true);
      expect(isStalePreSessionAttempt(attemptOnTimeMs, sessionStartMs)).toBe(false);
    });
  });
});

