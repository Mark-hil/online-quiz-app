import bcrypt from 'bcryptjs';
import { sql } from '../db.js';
import { HttpError } from '../http.js';

export type UserRole = 'lecturer' | 'student' | 'moderator' | 'admin' | 'super_admin';

export interface ActorContext {
  id: string;
  role: string;
  email?: string;
}

const VALID_ROLES: readonly UserRole[] = ['student', 'lecturer', 'moderator', 'admin', 'super_admin'];

/**
 * Pure server-side role-update policy check. Mirrors frontend `rolePolicy.ts`
 * so direct `/api/db` RPC calls cannot bypass UI restrictions.
 */
export function validateRoleUpdate(
  actor: ActorContext,
  target: { id: string; role: string },
  newRole: string,
  superAdminCount: number
): void {
  if (!VALID_ROLES.includes(newRole as UserRole)) {
    throw new HttpError(400, `Invalid role '${newRole}'.`);
  }
  if (actor.id === target.id) {
    throw new HttpError(403, 'Security restriction: You cannot modify your own role.');
  }
  if (target.role === 'super_admin' && newRole !== 'super_admin') {
    throw new HttpError(403, 'Protected account: Super Admin accounts cannot be demoted.');
  }
  if (target.role === 'super_admin' && newRole !== 'super_admin' && superAdminCount <= 1) {
    throw new HttpError(403, 'System integrity violation: Cannot demote the last remaining Super Admin.');
  }
  if (newRole === 'super_admin' && actor.role !== 'super_admin') {
    throw new HttpError(403, 'Privilege restriction: Only a Super Admin can promote a user to Super Admin.');
  }
}

/**
 * Pure server-side user-deletion policy check.
 */
export function validateUserDeletion(
  actor: ActorContext,
  target: { id: string; role: string }
): void {
  if (actor.id === target.id) {
    throw new HttpError(403, 'Security restriction: You cannot delete your own account.');
  }
  if (target.role === 'super_admin') {
    throw new HttpError(403, 'Protected account: Super Admin accounts cannot be deleted.');
  }
}

async function recordUserAuditLog(
  actorId: string,
  action: string,
  entityId: string,
  details: Record<string, any>
) {
  try {
    await sql`
      INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
      VALUES (${actorId}, ${action}, 'user', ${entityId}, ${JSON.stringify(details)})
    `;
  } catch (auditErr) {
    console.warn(`Failed to record audit log (${action}):`, auditErr);
  }
}

export async function getProfile(id: string) {
  try {
    const result = await sql`
      SELECT id, email, name, index_number, role, created_at, updated_at 
      FROM profiles 
      WHERE id = ${id}
    `;
    return result[0] || null;
  } catch (error) {
    console.error('Error in getProfile:', error);
    return null;
  }
}

export async function getProfiles() {
  return await sql`
    SELECT id, email, name, index_number, role, created_at, updated_at 
    FROM profiles 
    ORDER BY created_at DESC
  `;
}

export async function getProfilesByIds(ids: string[]) {
  if (!ids || ids.length === 0) return [];
  try {
    const all = await getProfiles();
    const idSet = new Set(ids);
    return all.filter((p: any) => idSet.has(p.id));
  } catch (error) {
    console.error('Error in getProfilesByIds:', error);
    return [];
  }
}

export async function createProfile(id: string, name: string, role: 'lecturer' | 'student') {
  const result = await sql`
    INSERT INTO profiles (id, name, role)
    VALUES (${id}, ${name}, ${role})
    RETURNING id, name, role, email, created_at
  `;
  return result[0];
}

export async function getUsersByRole(role: string) {
  return await sql`
    SELECT id, name, email, index_number, role, created_at
    FROM profiles
    WHERE role = ${role}
    ORDER BY created_at DESC
  `;
}

export async function getAllUsers() {
  return await sql`
    SELECT id, name, email, index_number, role, created_at
    FROM profiles
    ORDER BY created_at DESC
    LIMIT 1000
  `;
}

export async function updateUserRole(
  userId: string,
  newRole: UserRole,
  actor?: ActorContext
) {
  const existing = await sql`
    SELECT id, name, email, role
    FROM profiles
    WHERE id = ${userId}
    LIMIT 1
  `;
  const target = existing[0];
  if (!target) {
    throw new HttpError(404, 'User not found');
  }

  if (actor) {
    const countRows = await sql`
      SELECT COUNT(*)::int AS count
      FROM profiles
      WHERE role = 'super_admin'
    `;
    const superAdminCount = Number(countRows[0]?.count || 0);
    validateRoleUpdate(actor, target, newRole, superAdminCount);
  }

  const updated = await sql`
    UPDATE profiles
    SET role = ${newRole}, updated_at = NOW()
    WHERE id = ${userId}
    RETURNING id, name, email, role
  `;

  if (actor?.id && target.role !== newRole) {
    await recordUserAuditLog(actor.id, 'USER_ROLE_CHANGED', userId, {
      targetUserName: target.name,
      targetUserEmail: target.email,
      previousRole: target.role,
      newRole,
      modifiedBy: actor.email || actor.id,
    });
  }

  return updated;
}

export async function deleteUser(userId: string, actor?: ActorContext) {
  const existing = await sql`
    SELECT id, name, email, role
    FROM profiles
    WHERE id = ${userId}
    LIMIT 1
  `;
  const target = existing[0];
  if (!target) {
    throw new HttpError(404, 'User not found');
  }

  if (actor) {
    validateUserDeletion(actor, target);
  }

  const deleted = await sql`
    DELETE FROM profiles
    WHERE id = ${userId}
    RETURNING id
  `;

  if (actor?.id) {
    await recordUserAuditLog(actor.id, 'USER_DELETED', userId, {
      deletedUserName: target.name,
      deletedUserEmail: target.email,
      deletedUserRole: target.role,
      deletedBy: actor.email || actor.id,
    });
  }

  return deleted;
}

export async function createUserByAdmin(
  payload: {
    name: string;
    email: string;
    role: UserRole;
    password: string;
    indexNumber?: string;
  },
  actor?: ActorContext
) {
  const cleanName = typeof payload?.name === 'string' ? payload.name.trim() : '';
  const cleanEmail = typeof payload?.email === 'string' ? payload.email.trim().toLowerCase() : '';
  const role = payload?.role;
  const password = typeof payload?.password === 'string' ? payload.password : '';
  const cleanIndex =
    typeof payload?.indexNumber === 'string' && payload.indexNumber.trim()
      ? payload.indexNumber.trim()
      : null;

  if (!cleanName) throw new HttpError(400, 'Full name is required.');
  if (!cleanEmail || !cleanEmail.includes('@')) throw new HttpError(400, 'Valid email is required.');
  if (!VALID_ROLES.includes(role)) throw new HttpError(400, `Invalid role '${role}'.`);
  if (password.length < 8) throw new HttpError(400, 'Temporary password must be at least 8 characters.');
  if (role === 'super_admin' && actor && actor.role !== 'super_admin') {
    throw new HttpError(403, 'Only a Super Admin can create a Super Admin account.');
  }

  if (role === 'student' && cleanIndex) {
    const collisions = await sql`
      SELECT email, index_number
      FROM profiles
      WHERE LOWER(email) = ${cleanEmail}
         OR LOWER(index_number) = LOWER(${cleanIndex})
      LIMIT 1
    `;
    if (collisions.length > 0) {
      const hit = collisions[0];
      if (typeof hit.email === 'string' && hit.email.toLowerCase() === cleanEmail) {
        throw new HttpError(409, 'A user with this email already exists.');
      }
      throw new HttpError(409, 'A student with this index number already exists.');
    }
  } else {
    const existing = await sql`
      SELECT id FROM profiles WHERE LOWER(email) = ${cleanEmail} LIMIT 1
    `;
    if (existing.length > 0) {
      throw new HttpError(409, 'A user with this email already exists.');
    }
  }

  const passwordHash = await bcrypt.hash(password, 10);
  let inserted;
  try {
    inserted = await sql`
      INSERT INTO profiles (email, password_hash, password_algo, name, index_number, role)
      VALUES (${cleanEmail}, ${passwordHash}, 'bcrypt', ${cleanName}, ${cleanIndex}, ${role})
      RETURNING id, email, name, index_number, role, created_at
    `;
  } catch {
    inserted = await sql`
      INSERT INTO profiles (email, password_hash, name, role)
      VALUES (${cleanEmail}, ${passwordHash}, ${cleanName}, ${role})
      RETURNING id, email, name, role, created_at
    `;
  }

  const created = inserted[0];
  if (actor?.id && created?.id) {
    await recordUserAuditLog(actor.id, 'USER_CREATED_BY_ADMIN', created.id, {
      createdUserName: created.name,
      createdUserEmail: created.email,
      createdUserRole: created.role,
      createdBy: actor.email || actor.id,
    });
  }

  return created;
}

export async function getUserRoleStats() {
  const rows = await sql`
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE role = 'student')::int AS students,
      COUNT(*) FILTER (WHERE role = 'lecturer')::int AS lecturers,
      COUNT(*) FILTER (WHERE role IN ('moderator', 'admin', 'super_admin'))::int AS staff,
      COUNT(*) FILTER (WHERE role = 'moderator')::int AS moderators,
      COUNT(*) FILTER (WHERE role = 'admin')::int AS admins,
      COUNT(*) FILTER (WHERE role = 'super_admin')::int AS super_admins
    FROM profiles
  `;
  return (
    rows[0] || {
      total: 0,
      students: 0,
      lecturers: 0,
      staff: 0,
      moderators: 0,
      admins: 0,
      super_admins: 0,
    }
  );
}

export async function getUsersPaginated(options: {
  page?: number;
  pageSize?: number;
  tab?: 'all' | 'students' | 'lecturers' | 'staff';
  role?: string;
  search?: string;
} = {}) {
  const page = Math.max(1, Math.floor(Number(options.page) || 1));
  const pageSize = Math.min(100, Math.max(1, Math.floor(Number(options.pageSize) || 10)));
  const offset = (page - 1) * pageSize;
  const tab = options.tab || 'all';
  const roleFilter = options.role && options.role !== 'all' ? options.role : null;
  const search = typeof options.search === 'string' && options.search.trim()
    ? `%${options.search.trim().toLowerCase()}%`
    : null;

  const rows = await sql`
    SELECT
      id,
      name,
      email,
      index_number,
      role,
      created_at,
      COUNT(*) OVER()::int AS total_count
    FROM profiles
    WHERE
      (${tab} = 'all'
        OR (${tab} = 'students' AND role = 'student')
        OR (${tab} = 'lecturers' AND role = 'lecturer')
        OR (${tab} = 'staff' AND role IN ('moderator', 'admin', 'super_admin')))
      AND (${roleFilter}::text IS NULL OR role = ${roleFilter})
      AND (${search}::text IS NULL
        OR LOWER(COALESCE(name, '')) LIKE ${search}
        OR LOWER(COALESCE(email, '')) LIKE ${search}
        OR LOWER(COALESCE(index_number, '')) LIKE ${search})
    ORDER BY created_at DESC
    LIMIT ${pageSize} OFFSET ${offset}
  `;

  const total = rows.length > 0 ? Number(rows[0].total_count || 0) : 0;
  const users = rows.map(({ total_count: _tc, ...rest }: any) => rest);
  return { users, total, page, pageSize };
}
