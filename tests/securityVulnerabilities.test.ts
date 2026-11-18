import { describe, it, expect, vi } from 'vitest';
import { registry } from '../api/_lib/registry';
import { updateQuiz } from '../api/_lib/queries/quizzes';
import { checkCsrf, HttpError } from '../api/_lib/http';
import type { SessionUser, ApiRequest } from '../api/_lib/types';

describe('Security Vulnerability & Integrity Regression Suite', () => {
  const studentUser: SessionUser = {
    id: '11111111-1111-1111-1111-111111111111',
    email: 'student@example.edu',
    name: 'Alice Student',
    role: 'student',
  };

  const lecturerUser: SessionUser = {
    id: '22222222-2222-2222-2222-222222222222',
    email: 'lecturer@example.edu',
    name: 'Dr. Lecturer',
    role: 'lecturer',
  };

  const superAdminUser: SessionUser = {
    id: '33333333-3333-3333-3333-333333333333',
    email: 'admin@example.edu',
    name: 'Super Admin',
    role: 'super_admin',
  };

  describe('Finding 1: Correct Answer Redaction & Question Bank Lockdown', () => {
    it('prohibits students from accessing the question bank (getQuestionBankQuestions)', () => {
      const entry = registry['getQuestionBankQuestions'];
      expect(entry.allowedRoles).not.toContain('student');
      expect(entry.allowedRoles).toContain('lecturer');
    });

    it('redacts correct_answer, explanation, and question_bank_id when students fetch questions', async () => {
      const entry = registry['getQuestions'];
      const rawQuestions = [
        {
          id: 'q-1',
          question_text: 'What is 2+2?',
          options: ['3', '4', '5'],
          correct_answer: '4',
          explanation: 'Basic arithmetic addition',
          question_bank_id: 'qb-secret-999',
          marks: 2,
        },
      ];

      const studentResult = await entry.transformResult!(studentUser, rawQuestions);
      expect(studentResult[0].correct_answer).toBeUndefined();
      expect(studentResult[0].explanation).toBeUndefined();
      expect(studentResult[0].question_bank_id).toBeUndefined();
      expect(studentResult[0].question_text).toBe('What is 2+2?');
      expect(studentResult[0].marks).toBe(2);

      const lecturerResult = await entry.transformResult!(lecturerUser, rawQuestions);
      expect(lecturerResult[0].correct_answer).toBe('4');
      expect(lecturerResult[0].explanation).toBe('Basic arithmetic addition');
      expect(lecturerResult[0].question_bank_id).toBe('qb-secret-999');
    });
  });

  describe('Finding 2: Student Score & Grade Tampering Prevention', () => {
    it('strips score, status, cheated, and timer fields if student attempts updateQuizAttempt', async () => {
      const entry = registry['updateQuizAttempt'];
      const attemptId = 'a0000000-0000-0000-0000-000000000123';
      const maliciousArgs = [
        attemptId,
        {
          score: 100,
          status: 'graded',
          cheated: false,
          cheating_reason: null,
          time_remaining: 9999,
          extensions_applied: 5,
          tab_switch_count: 2,
          copy_attempts: 1,
          last_activity: '2026-11-15T23:00:00Z',
        },
      ];

      try {
        await entry.guard!(studentUser, maliciousArgs as any);
      } catch (err: any) {
        // Ownership check against live unseeded DB may throw, but sanitization occurs first
      }

      const sanitizedUpdates = maliciousArgs[1] as Record<string, any>;
      expect(sanitizedUpdates.score).toBeUndefined();
      expect(sanitizedUpdates.status).toBeUndefined();
      expect(sanitizedUpdates.cheated).toBeUndefined();
      expect(sanitizedUpdates.cheating_reason).toBeUndefined();
      expect(sanitizedUpdates.time_remaining).toBeUndefined();
      expect(sanitizedUpdates.extensions_applied).toBeUndefined();

      // Benign telemetry should be preserved
      expect(sanitizedUpdates.tab_switch_count).toBe(2);
      expect(sanitizedUpdates.copy_attempts).toBe(1);
      expect(sanitizedUpdates.last_activity).toBe('2026-11-15T23:00:00Z');
    });

    it('denies students from invoking updateStudentAnswer', () => {
      const entry = registry['updateStudentAnswer'];
      expect(entry.allowedRoles).not.toContain('student');
      expect(entry.allowedRoles).toContain('lecturer');
    });
  });

  describe('Finding 3: Self-Service Time Extension Lockdown', () => {
    it('denies students from invoking extendQuizTime directly', () => {
      const entry = registry['extendQuizTime'];
      expect(entry.allowedRoles).not.toContain('student');
      expect(entry.allowedRoles).toContain('lecturer');
    });
  });

  describe('Finding 4: Session PIN & Master Proctor PIN Leakage Prevention', () => {
    it('redacts access_pin from getQuizSessions for students', async () => {
      const entry = registry['getQuizSessions'];
      const sessions = [
        { id: 'sess-1', session_name: 'Room A', access_pin: '849201', start_time: '2026-11-15T10:00:00Z' },
        { id: 'sess-2', session_name: 'Room B', access_pin: '123456', start_time: '2026-11-15T11:00:00Z' },
      ];

      const studentResult = await entry.transformResult!(studentUser, sessions);
      expect(studentResult[0].access_pin).toBeUndefined();
      expect(studentResult[1].access_pin).toBeUndefined();
      expect(studentResult[0].session_name).toBe('Room A');

      const staffResult = await entry.transformResult!(lecturerUser, sessions);
      expect(staffResult[0].access_pin).toBe('849201');
      expect(staffResult[1].access_pin).toBe('123456');
    });

    it('redacts access_pin from getStudentAssignedSession for students', async () => {
      const entry = registry['getStudentAssignedSession'];
      const assigned = {
        id: 'sess-1',
        session_name: 'Room A',
        access_pin: '849201',
        start_time: '2026-11-15T10:00:00Z',
      };

      const studentResult = await entry.transformResult!(studentUser, assigned);
      expect(studentResult.access_pin).toBeUndefined();
      expect(studentResult.session_name).toBe('Room A');

      const staffResult = await entry.transformResult!(lecturerUser, assigned);
      expect(staffResult.access_pin).toBe('849201');
    });

    it('blocks students and non-super-admins from reading proctor_master_pin or secrets', () => {
      const entry = registry['getSystemSetting'];

      // Non-super-admin requesting proctor_master_pin must throw
      expect(() => {
        entry.guard!(studentUser, ['proctor_master_pin']);
      }).toThrow(/Access denied/);

      expect(() => {
        entry.guard!(lecturerUser, ['proctor_master_pin']);
      }).toThrow(/Access denied/);

      // Super admin can read
      expect(() => {
        entry.guard!(superAdminUser, ['proctor_master_pin']);
      }).not.toThrow();

      // Safe public system setting is allowed
      expect(() => {
        entry.guard!(studentUser, ['institution_name']);
      }).not.toThrow();
    });
  });

  describe('Finding 5: Institutional User Directory Lockdown', () => {
    it('denies students from querying full user profiles list (getProfiles)', () => {
      const entry = registry['getProfiles'];
      expect(entry.allowedRoles).not.toContain('student');
      expect(entry.allowedRoles).toContain('lecturer');
    });

    it('restricts getProfilesByIds to the student own ID when student calls it', () => {
      const entry = registry['getProfilesByIds'];
      const targetIds = [studentUser.id, 'other-student-id-999', 'admin-id-888'];
      const args = [targetIds];

      entry.guard!(studentUser, args as any);
      expect(args[0]).toEqual([studentUser.id]);
    });
  });

  describe('Finding 7: CSRF Protection Hardening', () => {
    it('rejects foreign *.vercel.app origins that do not match the application host', () => {
      const maliciousRequest: Partial<ApiRequest> = {
        method: 'POST',
        headers: {
          host: 'my-institution.edu',
          origin: 'https://malicious-attacker.vercel.app',
        },
      };

      expect(() => checkCsrf(maliciousRequest as ApiRequest)).toThrow(HttpError);
    });

    it('allows genuine requests where origin matches host', () => {
      const legitimateRequest: Partial<ApiRequest> = {
        method: 'POST',
        headers: {
          host: 'my-institution.edu',
          origin: 'https://my-institution.edu',
        },
      };

      expect(() => checkCsrf(legitimateRequest as ApiRequest)).not.toThrow();
    });
  });

  describe('Finding 8: SQL Injection & Key Sanitization in updateQuiz', () => {
    it('returns null and does not execute query if updates contains only malicious/unrecognized keys', async () => {
      const result = await updateQuiz('quiz-1', {
        "status = 'published'; DROP TABLE users; --": true,
        non_existent_column: 'value',
      });
      expect(result).toBeNull();
    });
  });
});

