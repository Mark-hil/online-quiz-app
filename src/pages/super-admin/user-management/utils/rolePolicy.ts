import { User, UserRole } from '../types';

export interface PolicyCheckResult {
  allowed: boolean;
  reason?: string;
  badgeType?: 'protected' | 'current_user' | null;
}

/**
 * Checks if the actor has permission to initiate role editing for the target user.
 */
export function canEditUserRole(
  actor: { id: string; role: UserRole } | null | undefined,
  targetUser: User
): PolicyCheckResult {
  // 1. Cannot edit own role
  if (actor && actor.id === targetUser.id) {
    return {
      allowed: false,
      reason: 'You cannot modify your own role.',
      badgeType: 'current_user',
    };
  }

  // 2. Super Admin accounts are root-protected
  if (targetUser.role === 'super_admin') {
    return {
      allowed: false,
      reason: 'Super Admin accounts have permanent root privileges and cannot be modified.',
      badgeType: 'protected',
    };
  }

  return { allowed: true, badgeType: null };
}

/**
 * Checks if the actor has permission to delete the target user.
 */
export function canDeleteUser(
  actor: { id: string; role: UserRole } | null | undefined,
  targetUser: User
): PolicyCheckResult {
  // 1. Cannot delete self
  if (actor && actor.id === targetUser.id) {
    return {
      allowed: false,
      reason: 'Security restriction: You cannot delete your own account.',
      badgeType: 'current_user',
    };
  }

  // 2. Super Admin accounts cannot be deleted (preserves root account and last admin invariants)
  if (targetUser.role === 'super_admin') {
    return {
      allowed: false,
      reason: 'Protected account: Super Admin accounts cannot be deleted.',
      badgeType: 'protected',
    };
  }

  return { allowed: true, badgeType: null };
}

/**
 * Checks if a specific role change is permissible according to governance rules.
 */
export function canAssignRole(
  actor: { id: string; role: UserRole } | null | undefined,
  targetUser: User,
  newRole: UserRole,
  superAdminCount?: number
): PolicyCheckResult {
  // 1. Self modification check
  if (actor && actor.id === targetUser.id) {
    return {
      allowed: false,
      reason: 'Security restriction: You cannot modify your own role.',
    };
  }

  // 2. Demotion of super admin is disallowed
  if (targetUser.role === 'super_admin' && newRole !== 'super_admin') {
    return {
      allowed: false,
      reason: 'Protected account: Super Admin accounts cannot be demoted.',
    };
  }

  // 3. Last Super Admin protection invariant
  if (
    superAdminCount !== undefined &&
    targetUser.role === 'super_admin' &&
    newRole !== 'super_admin' &&
    superAdminCount <= 1
  ) {
    return {
      allowed: false,
      reason: 'System integrity violation: Cannot demote the last remaining Super Admin.',
    };
  }

  // 4. Only an existing Super Admin can grant Super Admin privileges
  if (newRole === 'super_admin' && actor?.role !== 'super_admin') {
    return {
      allowed: false,
      reason: 'Privilege restriction: Only a Super Admin can promote a user to Super Admin.',
    };
  }

  return { allowed: true };
}
