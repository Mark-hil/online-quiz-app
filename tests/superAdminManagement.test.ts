import { describe, it, expect } from 'vitest';
import { registry } from '../api/_lib/registry.js';
import { HttpError } from '../api/_lib/http.js';
import { validateRoleUpdate, validateUserDeletion, validatePasswordReset } from '../api/_lib/queries/users.js';
import { computeAttemptKpis } from '../src/pages/super-admin/analytics/metrics.js';
import type { SessionUser } from '../api/_lib/types.js';

describe('Super Admin Server-Side Governance', () => {
  const superAdmin: SessionUser = {
    id: 'sa-1',
    email: 'root@example.com',
    name: 'Root Super Admin',
    role: 'super_admin',
  };

  const otherSuperAdmin = { id: 'sa-2', role: 'super_admin' };
  const adminTarget = { id: 'adm-1', role: 'admin' };
  const lecturerTarget = { id: 'lec-1', role: 'lecturer' };

  describe('validateRoleUpdate', () => {
    it('rejects invalid role strings with 400', () => {
      expect(() =>
        validateRoleUpdate(superAdmin, lecturerTarget, 'owner', 1)
      ).toThrowError(HttpError);
    });

    it('rejects self-role modification with 403', () => {
      expect(() =>
        validateRoleUpdate(superAdmin, { id: superAdmin.id, role: 'super_admin' }, 'admin', 2)
      ).toThrowError(/modify your own role/);
    });

    it('rejects demoting a super_admin account', () => {
      expect(() =>
        validateRoleUpdate(superAdmin, otherSuperAdmin, 'admin', 2)
      ).toThrowError(/Super Admin accounts cannot be demoted/);
    });

    it('rejects non-super_admin promoting a user to super_admin', () => {
      expect(() =>
        validateRoleUpdate({ id: 'adm-actor', role: 'admin' }, lecturerTarget, 'super_admin', 1)
      ).toThrowError(/Only a Super Admin can promote/);
    });

    it('allows super_admin to promote/demote non-super_admin users', () => {
      expect(() => validateRoleUpdate(superAdmin, lecturerTarget, 'admin', 1)).not.toThrow();
      expect(() => validateRoleUpdate(superAdmin, adminTarget, 'super_admin', 1)).not.toThrow();
      expect(() => validateRoleUpdate(superAdmin, adminTarget, 'lecturer', 1)).not.toThrow();
    });
  });

  describe('validateUserDeletion', () => {
    it('rejects self-deletion', () => {
      expect(() =>
        validateUserDeletion(superAdmin, { id: superAdmin.id, role: 'super_admin' })
      ).toThrowError(/delete your own account/);
    });

    it('rejects deleting any super_admin account', () => {
      expect(() =>
        validateUserDeletion(superAdmin, otherSuperAdmin)
      ).toThrowError(/Super Admin accounts cannot be deleted/);
    });

    it('allows super_admin to delete non-super_admin users', () => {
      expect(() => validateUserDeletion(superAdmin, lecturerTarget)).not.toThrow();
    });
  });

  describe('validatePasswordReset', () => {
    const studentTarget = { id: 'stu-1', role: 'student' };

    it('allows admin and super_admin to reset student and lecturer passwords', () => {
      expect(() => validatePasswordReset({ id: 'adm-actor', role: 'admin' }, studentTarget)).not.toThrow();
      expect(() => validatePasswordReset({ id: 'adm-actor', role: 'admin' }, lecturerTarget)).not.toThrow();
      expect(() => validatePasswordReset(superAdmin, studentTarget)).not.toThrow();
      expect(() => validatePasswordReset(superAdmin, adminTarget)).not.toThrow();
    });

    it('blocks admin from resetting another admin or super_admin password', () => {
      expect(() =>
        validatePasswordReset({ id: 'adm-actor', role: 'admin' }, adminTarget)
      ).toThrowError(/Academic Officers can only reset passwords/);
      expect(() =>
        validatePasswordReset({ id: 'adm-actor', role: 'admin' }, otherSuperAdmin)
      ).toThrowError(/Super Admin passwords cannot be reset/);
    });

    it('blocks non-admin roles from resetting passwords', () => {
      expect(() =>
        validatePasswordReset({ id: 'lec-actor', role: 'lecturer' }, studentTarget)
      ).toThrowError(/Only Admin or Super Admin/);
      expect(() =>
        validatePasswordReset({ id: 'stu-actor', role: 'student' }, studentTarget)
      ).toThrowError(/Only Admin or Super Admin/);
    });
  });

  describe('Registry guards & role restrictions', () => {
    it('allows admin and super_admin to call adminResetUserPassword with actor guard', async () => {
      const entry = registry.adminResetUserPassword;
      expect(entry).toBeDefined();
      expect(entry.allowedRoles).toEqual(['admin', 'super_admin']);
      const resetArgs: any[] = ['stu-1', 'Exam4829'];
      await entry.guard!(superAdmin, resetArgs);
      expect(resetArgs[2]).toEqual({ id: superAdmin.id, role: superAdmin.role, email: superAdmin.email });
    });
    it('restricts updateUserRole, deleteUser, and createUserByAdmin to super_admin with actor guards', async () => {
      for (const method of ['updateUserRole', 'deleteUser', 'createUserByAdmin'] as const) {
        const entry = registry[method];
        expect(entry).toBeDefined();
        expect(entry.allowedRoles).toEqual(['super_admin']);
        expect(typeof entry.guard).toBe('function');
      }

      const roleArgs: any[] = ['target-1', 'admin'];
      await registry.updateUserRole.guard!(superAdmin, roleArgs);
      expect(roleArgs[2]).toEqual({ id: superAdmin.id, role: superAdmin.role, email: superAdmin.email });

      const delArgs: any[] = ['target-1'];
      await registry.deleteUser.guard!(superAdmin, delArgs);
      expect(delArgs[1]).toEqual({ id: superAdmin.id, role: superAdmin.role, email: superAdmin.email });

      const createArgs: any[] = [{ name: 'A', email: 'a@b.com', role: 'admin', password: 'password123' }];
      await registry.createUserByAdmin.guard!(superAdmin, createArgs);
      expect(createArgs[1]).toEqual({ id: superAdmin.id, role: superAdmin.role, email: superAdmin.email });
    });

    it('exposes getUserRoleStats and getUsersPaginated to ADMIN_ROLES', () => {
      expect(registry.getUserRoleStats.allowedRoles).toEqual(['moderator', 'admin', 'super_admin']);
      expect(registry.getUsersPaginated.allowedRoles).toEqual(['moderator', 'admin', 'super_admin']);
    });

    it('enforces Separation of Duties: excludes super_admin from authoring quizzes or editing/taking submissions while preserving read oversight', () => {
      for (const method of ['createQuiz', 'updateQuiz', 'deleteQuiz', 'submitForApproval'] as const) {
        expect(registry[method].allowedRoles).not.toContain('super_admin');
        expect(registry[method].allowedRoles).toContain('lecturer');
      }

      for (const method of [
        'createQuizAttempt',
        'createStudentAnswer',
        'upsertStudentAnswer',
        'saveAttemptQuestions',
      ] as const) {
        expect(registry[method].allowedRoles).toEqual(['student']);
      }

      for (const method of ['updateQuizAttempt', 'updateStudentAnswer'] as const) {
        expect(registry[method].allowedRoles).not.toContain('super_admin');
        expect(registry[method].allowedRoles).toContain('lecturer');
      }

      // Read-only oversight & time extension remain available to super_admin
      for (const method of [
        'getQuizzes',
        'getQuiz',
        'getQuizAttempts',
        'getStudentAnswers',
        'getAttemptQuestions',
        'getQuizAttemptsForExtension',
        'extendQuizTime',
      ] as const) {
        expect(registry[method].allowedRoles).toContain('super_admin');
      }
    });
  });

  describe('Analytics KPI calculations (computeAttemptKpis)', () => {
    it('returns zeros for empty stats', () => {
      expect(computeAttemptKpis([])).toEqual({
        totalAttempts: 0,
        totalCompleted: 0,
        completionRate: 0,
        overallAvgScore: 0,
      });
    });

    it('includes both submitted and graded in completionRate and computes volume-weighted avg score', () => {
      const kpis = computeAttemptKpis([
        // Day 1: 90 completed (50 submitted + 40 graded) out of 100 attempts, avg 80%
        { total_attempts: 100, submitted: 50, graded: 40, avg_score: 80 },
        // Day 2: 10 completed (0 submitted + 10 graded) out of 10 attempts, avg 50%
        { total_attempts: 10, submitted: 0, graded: 10, avg_score: 50 },
      ]);

      expect(kpis.totalAttempts).toBe(110);
      expect(kpis.totalCompleted).toBe(100);
      expect(kpis.completionRate).toBe(91); // round(100/110 * 100)
      // Weighted avg = (80*90 + 50*10) / 100 = 77.0 (unweighted would have been 65.0)
      expect(kpis.overallAvgScore).toBe('77.0');
    });
  });
});

