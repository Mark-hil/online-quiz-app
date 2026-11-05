import bcrypt from 'bcryptjs';
import { sql } from '../../db.js';
import { HttpError, jsonHandler } from '../../http.js';
import { enforceRateLimit, getClientIp, resetRateLimit } from '../../rateLimit.js';
import { createSessionToken, setSessionCookie } from '../../session.js';
import type { ApiRequest, ApiResponse, Role, SessionUser } from '../../types.js';

const PUBLIC_ROLES = ['student', 'lecturer'] as const;

export default jsonHandler(async (req: ApiRequest, res: ApiResponse) => {
  if (req.method !== 'POST') {
    throw new HttpError(405, 'Method not allowed');
  }

  const { email, password, name, role, index_number } = req.body || {};

  const cleanEmail = (email || '').toLowerCase().trim();
  const cleanName = (name || '').trim();
  const cleanIndex = index_number ? String(index_number).trim() : null;

  if (!cleanEmail || !password || !cleanName || !role) {
    throw new HttpError(400, 'Missing required fields: email, password, name, role');
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(cleanEmail)) {
    throw new HttpError(400, 'Please provide a valid email address');
  }

  if (cleanName.length < 2) {
    throw new HttpError(400, 'Name must be at least 2 characters long');
  }

  if (typeof password !== 'string' || password.length < 6) {
    throw new HttpError(400, 'Password must be at least 6 characters long');
  }

  await enforceRateLimit(req, 'signup', cleanEmail, 20, 900);

  // Role authorization validation
  const isPublicRole = PUBLIC_ROLES.includes(role);
  if (!isPublicRole) {
    if (role === 'super_admin') {
      const superAdminCountResult = await sql`
        SELECT COUNT(*)::int as count 
        FROM profiles 
        WHERE role = 'super_admin'
      `;
      const count = Number(superAdminCountResult[0]?.count || 0);
      if (count > 0) {
        throw new HttpError(
          403,
          'Super Admin registration is permanently closed. Accounts must be provisioned through the Super Admin panel.'
        );
      }
    } else {
      throw new HttpError(
        403,
        `Unauthorized registration: '${role}' accounts cannot be self-registered.`
      );
    }
  }

  // Check email and index_number collision in a single database round-trip
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
        throw new HttpError(409, 'User already exists with this email');
      }
      throw new HttpError(409, 'Index number already exists');
    }
  } else {
    const existingUsers = await sql`SELECT id FROM profiles WHERE LOWER(email) = ${cleanEmail} LIMIT 1`;
    if (existingUsers.length > 0) {
      throw new HttpError(409, 'User already exists with this email');
    }
  }

  // Securely hash with bcrypt (cost 10 balances security with high-concurrency throughput for 500+ student cohorts)
  const passwordHash = await bcrypt.hash(password, 10);

  let result;
  try {
    result = await sql`
      INSERT INTO profiles (email, password_hash, password_algo, name, index_number, role)
      VALUES (
        ${cleanEmail},
        ${passwordHash},
        'bcrypt',
        ${cleanName},
        ${cleanIndex},
        ${role}
      )
      RETURNING id, email, name, index_number, role, created_at
    `;
  } catch (err: any) {
    // If password_algo or index_number does not exist in an older schema
    result = await sql`
      INSERT INTO profiles (email, password_hash, name, role)
      VALUES (
        ${cleanEmail},
        ${passwordHash},
        ${cleanName},
        ${role}
      )
      RETURNING id, email, name, role, created_at
    `;
  }

  const row = result[0];
  const clientIp = getClientIp(req);
  const userAgent = (req.headers['user-agent'] as string) || null;

  // Clear rate limit for this email on successful account creation
  await resetRateLimit(`rl:signup:id:${cleanEmail}`);

  // Record audit trail event
  try {
    await sql`
      INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip_address, user_agent)
      VALUES (
        ${row.id},
        'signup',
        'user',
        ${row.id},
        ${JSON.stringify({ email: cleanEmail, role })},
        ${clientIp},
        ${userAgent}
      )
    `;
  } catch (auditErr) {
    console.warn('[Audit Log Warning]', auditErr);
  }

  const user: SessionUser = {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role as Role,
    index_number: row.index_number,
  };

  const token = await createSessionToken(user);
  setSessionCookie(res, token);

  return {
    user: {
      ...user,
      created_at: row.created_at,
    },
    token,
  };
});
