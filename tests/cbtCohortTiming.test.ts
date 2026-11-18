import { describe, it, expect } from 'vitest';
import {
  calculateInitialAttemptSeconds,
  calculateRemainingAttemptSeconds,
  isStalePreSessionAttempt,
} from '../src/utils/cbtTimerUtils';
import { computeBridgedExtensionMinutes } from '../api/_lib/queries/extensions';

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

    it('grants half of duration_minutes (50% floor) when a student logs in 5 minutes before quiz.deadline on a standard quiz', () => {
      const nowMs = Date.parse('2026-11-15T10:55:00Z');
      const deadlineMs = Date.parse('2026-11-15T11:00:00Z'); // Only 5 minutes left until deadline

      const initialSeconds = calculateInitialAttemptSeconds({
        durationMinutes: 30,
        isCohortSession: false,
        quizDeadlineMs: deadlineMs,
        nowMs,
      });

      // Half of 30 minutes = 15 minutes (900s), instead of 5 minutes (300s) or full 30 minutes (1800s)
      expect(initialSeconds).toBe(900);
    });

    it('grants actual remaining time to deadline when remaining time is between 50% and 100% of duration', () => {
      const nowMs = Date.parse('2026-11-15T10:40:00Z');
      const deadlineMs = Date.parse('2026-11-15T11:00:00Z'); // 20 minutes left until deadline

      const initialSeconds = calculateInitialAttemptSeconds({
        durationMinutes: 30,
        isCohortSession: false,
        quizDeadlineMs: deadlineMs,
        nowMs,
      });

      expect(initialSeconds).toBe(1200); // 20 minutes (1200s)
    });

    it('respects custom lateLoginFloorRatio when configured (e.g. 0 for strict deadline or 1 for full duration)', () => {
      const nowMs = Date.parse('2026-11-15T10:55:00Z');
      const deadlineMs = Date.parse('2026-11-15T11:00:00Z'); // 5 minutes left

      expect(
        calculateInitialAttemptSeconds({
          durationMinutes: 30,
          isCohortSession: false,
          quizDeadlineMs: deadlineMs,
          nowMs,
          lateLoginFloorRatio: 0,
        })
      ).toBe(300);

      expect(
        calculateInitialAttemptSeconds({
          durationMinutes: 30,
          isCohortSession: false,
          quizDeadlineMs: deadlineMs,
          nowMs,
          lateLoginFloorRatio: 1,
        })
      ).toBe(1800);
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

    it('preserves the 50% half-duration floor for non-cohort quizzes when a student starts 5 minutes before quiz.deadline', () => {
      const startedAtMs = Date.parse('2026-11-15T10:55:00Z'); // Started 5m before 11:00 AM deadline
      const quizDeadlineMs = Date.parse('2026-11-15T11:00:00Z');
      // Allocated base time = 50% of 30m = 15m (until 11:10 AM)
      const serverNowAt1102 = Date.parse('2026-11-15T11:02:00Z'); // 7m elapsed out of 15m allocated

      const result = calculateRemainingAttemptSeconds({
        durationMinutes: 30,
        startedAtMs,
        serverNowMs: serverNowAt1102,
        isCohortSession: false,
        quizDeadlineMs,
      });

      expect(result.totalSeconds).toBe(900); // 15m allocated
      expect(result.elapsedSeconds).toBe(420); // 7m elapsed
      expect(result.remainingSeconds).toBe(480); // 8m remaining
      expect(result.isPermanentlyExpired).toBe(false);
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

  describe('computeBridgedExtensionMinutes (Reopen & Extend Auto-Submitted Attempts)', () => {
    it('adds minutes normally when the student attempt is still active with time remaining', () => {
      // 30-min quiz, 20 mins elapsed (10 mins left), Admin adds +15 mins
      const totalExt = computeBridgedExtensionMinutes({
        durationMinutes: 30,
        currentExtensionMinutes: 0,
        elapsedMinutes: 20,
        addedMinutes: 15,
      });

      expect(totalExt).toBe(15); // 30 + 15 - 20 = 25 mins remaining
    });

    it('bridges expired dead time and grants full addedMinutes from NOW() when reopening an auto-submitted/expired attempt', () => {
      // 30-min quiz started at 10:00 AM, expired at 10:30 AM, Admin reopens at 10:50 AM (50m elapsed, 20m dead time) with +15 mins
      const totalExt = computeBridgedExtensionMinutes({
        durationMinutes: 30,
        currentExtensionMinutes: 0,
        elapsedMinutes: 50,
        addedMinutes: 15,
      });

      // Must store 20 (dead time bridge) + 15 (fresh time) = 35 mins so (30 + 35) - 50 = 15 mins remaining right now!
      expect(totalExt).toBe(35);
    });
  });
});

