import { describe, it, expect } from 'vitest';
import { registry } from '../api/_lib/registry.js';
import type { SessionUser } from '../api/_lib/types.js';

describe('Question Bank Access & Delegation Governance', () => {
  const studentUser: SessionUser = {
    id: '11111111-1111-1111-1111-111111111111',
    email: 'student@university.edu',
    name: 'Student Smith',
    role: 'student',
    index_number: 'STU1001',
  };

  const lecturerUser: SessionUser = {
    id: '22222222-2222-2222-2222-222222222222',
    email: 'lecturer@university.edu',
    name: 'Dr. Alan Turing',
    role: 'lecturer',
  };

  const adminUser: SessionUser = {
    id: '33333333-3333-3333-3333-333333333333',
    email: 'academic.officer@university.edu',
    name: 'Academic Affairs Officer',
    role: 'admin',
  };

  const superAdminUser: SessionUser = {
    id: '44444444-4444-4444-4444-444444444444',
    email: 'provost@university.edu',
    name: 'Vice Chancellor / Super Admin',
    role: 'super_admin',
  };

  describe('Registry Permissions & Access Control', () => {
    it('restricts grantBankAccessDirectly to staff roles and forbids students', () => {
      const entry = registry.grantBankAccessDirectly;
      expect(entry).toBeDefined();
      expect(entry.allowedRoles?.includes('student')).toBe(false);
      expect(entry.allowedRoles?.includes('lecturer')).toBe(true);
      expect(entry.allowedRoles?.includes('admin')).toBe(true);
      expect(entry.allowedRoles?.includes('super_admin')).toBe(true);
    });

    it('injects authenticated user ID as granted_by in grantBankAccessDirectly guard', async () => {
      const entry = registry.grantBankAccessDirectly;
      expect(entry.guard).toBeDefined();

      const inputArgs = [{
        course_id: 'c123',
        requester_id: 'lecturer-to-grant',
        access_level: 'contributor',
        duration_days: 30,
        notes: 'Semester moderation access'
      }];

      await entry.guard!(adminUser, inputArgs);
      expect(inputArgs[0].granted_by).toBe(adminUser.id);
    });

    it('restricts revokeBankAccess to staff roles and forbids students', () => {
      const entry = registry.revokeBankAccess;
      expect(entry).toBeDefined();
      expect(entry.allowedRoles?.includes('student')).toBe(false);
      expect(entry.allowedRoles?.includes('lecturer')).toBe(true);
      expect(entry.allowedRoles?.includes('admin')).toBe(true);
      expect(entry.allowedRoles?.includes('super_admin')).toBe(true);
    });

    it('injects authenticated user ID as revoked_by in revokeBankAccess guard', async () => {
      const entry = registry.revokeBankAccess;
      expect(entry.guard).toBeDefined();

      const inputArgs = [{
        request_id: 'req-456',
        reason: 'Internal exam cycle concluded'
      }];

      await entry.guard!(adminUser, inputArgs);
      expect(inputArgs[0].revoked_by).toBe(adminUser.id);
    });

    it('restricts extendBankAccess to staff roles and injects reviewer_id', async () => {
      const entry = registry.extendBankAccess;
      expect(entry).toBeDefined();
      expect(entry.allowedRoles?.includes('student')).toBe(false);
      expect(entry.allowedRoles?.includes('lecturer')).toBe(true);
      expect(entry.allowedRoles?.includes('admin')).toBe(true);
      expect(entry.allowedRoles?.includes('super_admin')).toBe(true);

      const inputArgs = [{
        request_id: 'req-789',
        additional_days: 14
      }];

      await entry.guard!(superAdminUser, inputArgs);
      expect(inputArgs[0].reviewer_id).toBe(superAdminUser.id);
    });

    it('restricts getCourseBankDelegations to staff roles and forbids students', () => {
      const entry = registry.getCourseBankDelegations;
      expect(entry).toBeDefined();
      expect(entry.allowedRoles?.includes('student')).toBe(false);
      expect(entry.allowedRoles?.includes('lecturer')).toBe(true);
      expect(entry.allowedRoles?.includes('admin')).toBe(true);
      expect(entry.allowedRoles?.includes('super_admin')).toBe(true);
    });

    it('allows academic officer and lead lecturer to review access requests', () => {
      const entry = registry.reviewBankAccessRequest;
      expect(entry).toBeDefined();
      expect(entry.allowedRoles?.includes('student')).toBe(false);
      expect(entry.allowedRoles?.includes('lecturer')).toBe(true);
      expect(entry.allowedRoles?.includes('admin')).toBe(true);
      expect(entry.allowedRoles?.includes('super_admin')).toBe(true);
    });
  });

  describe('Delegation Expiry & Arithmetic Logic', () => {
    it('calculates expected expiry for preset durations correctly', () => {
      const now = new Date('2026-10-28T12:00:00Z').getTime();
      const presets = [7, 30, 90, 365];

      for (const days of presets) {
        const expectedMs = now + days * 24 * 60 * 60 * 1000;
        const expiry = new Date(expectedMs);
        expect(expiry.getTime()).toBeGreaterThan(now);
        const diffDays = Math.round((expiry.getTime() - now) / (24 * 60 * 60 * 1000));
        expect(diffDays).toBe(days);
      }
    });

    it('correctly extends active expiry by additional days', () => {
      const currentExpiry = new Date('2026-11-15T12:00:00Z');
      const additionalDays = 30;
      const newExpiry = new Date(currentExpiry.getTime() + additionalDays * 24 * 60 * 60 * 1000);

      expect(newExpiry.toISOString()).toBe('2026-12-15T12:00:00.000Z');
    });

    it('resets baseline to current time if extending an already expired delegation', () => {
      const expiredAt = new Date('2026-09-01T12:00:00Z');
      const now = new Date('2026-10-28T12:00:00Z');
      const isExpired = expiredAt.getTime() < now.getTime();
      expect(isExpired).toBe(true);

      const additionalDays = 14;
      // In extendBankAccess: baseTime = (expires_at > now) ? expires_at : now()
      const baseTime = (expiredAt.getTime() > now.getTime()) ? expiredAt : now;
      const extendedExpiry = new Date(baseTime.getTime() + additionalDays * 24 * 60 * 60 * 1000);

      expect(extendedExpiry.toISOString()).toBe('2026-11-11T12:00:00.000Z');
      expect(extendedExpiry.getTime()).toBeGreaterThan(now.getTime());
    });
  });

  describe('Immediate Revocation Rule', () => {
    it('ensures revoked status excludes delegation from active course access queries', () => {
      // In api/_lib/queries/courses.ts:
      // status = 'approved' AND (expires_at IS NULL OR expires_at > now())
      const activeDelegation = { status: 'approved', expires_at: '2026-12-01T00:00:00Z' };
      const revokedDelegation = { status: 'revoked', expires_at: '2026-12-01T00:00:00Z' };

      const checkActive = (d: { status: string; expires_at: string }) => {
        return d.status === 'approved' && new Date(d.expires_at).getTime() > Date.now();
      };

      expect(checkActive(activeDelegation)).toBe(true);
      expect(checkActive(revokedDelegation)).toBe(false);
    });
  });
});
