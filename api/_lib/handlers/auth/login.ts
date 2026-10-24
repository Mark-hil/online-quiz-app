import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { sql } from '../../db.js';
import { HttpError, jsonHandler } from '../../http.js';
import { enforceRateLimit, getClientIp, resetRateLimit } from '../../rateLimit.js';
import { createSessionToken, setSessionCookie } from '../../session.js';
import type { ApiRequest, ApiResponse, SessionUser } from '../../types.js';

async function safeRecordLoginAttempt(
  email: string,
  success: boolean,
  errorMessage: string | null,
  ipAddress: string,
  userAgent: string | null
): Promise<void> {
  try {
    await sql`
      INSERT INTO login_attempts (email, success, error_message, ip_address, user_agent)
      VALUES (${email}, ${success}, ${errorMessage}, ${ipAddress}, ${userAgent})
    `;
  } catch (err) {
    // Non-fatal if table has not been migrated yet
    console.warn('[Login Attempts DB Warning]', err);
  }
}

export default jsonHandler(async (req: ApiRequest, res: ApiResponse) => {
  if (req.method !== 'POST') {
    throw new HttpError(405, 'Method not allowed');
  }

  const { identifier, emailOrIndex, password } = req.body || {};
  const userIdentifier = (identifier || emailOrIndex || '').trim();

  if (!userIdentifier || !password) {
    throw new HttpError(400, 'Identifier and password are required');
  }

  const clientIp = getClientIp(req);
  const userAgent = (req.headers['user-agent'] as string) || null;

  // Enforce brute-force rate limit: max 10 failed attempts per 15 minutes
  await enforceRateLimit(req, 'login', userIdentifier, 10, 900);

  const isEmail = userIdentifier.includes('@');
  let rows;

  try {
    if (isEmail) {
      rows = await sql`
        SELECT *
        FROM profiles
        WHERE LOWER(email) = LOWER(${userIdentifier})
        LIMIT 1
      `;
    } else {
      rows = await sql`
        SELECT *
        FROM profiles
        WHERE LOWER(index_number) = LOWER(${userIdentifier}) AND role = 'student'
        LIMIT 1
      `;
    }
  } catch (dbErr: any) {
    // If index_number column does not exist yet in an unmigrated table
    if (!isEmail) {
      rows = await sql`
        SELECT *
        FROM profiles
        WHERE LOWER(email) = LOWER(${userIdentifier})
        LIMIT 1
      `;
    } else {
      throw dbErr;
    }
  }

  if (!rows || rows.length === 0) {
    await safeRecordLoginAttempt(userIdentifier, false, 'User not found', clientIp, userAgent);
    const label = isEmail ? 'email' : 'index number';
    throw new HttpError(401, `Invalid ${label} or password`);
  }

  const row = rows[0];
  let isPasswordValid = false;

  const isBcrypt =
    row.password_algo === 'bcrypt' ||
    (typeof row.password_hash === 'string' && row.password_hash.startsWith('$2'));

  if (isBcrypt) {
    isPasswordValid = await bcrypt.compare(password, row.password_hash);
  } else {
    // Legacy SHA-256 with candidate salts
    let legacyCutoff = process.env.LEGACY_PASSWORD_CUTOFF
      ? new Date(process.env.LEGACY_PASSWORD_CUTOFF).getTime()
      : NaN;

    if (isNaN(legacyCutoff)) {
      // Default to 60 days from launch if not specified or invalid
      legacyCutoff = Date.now() + 60 * 24 * 60 * 60 * 1000;
    }

    if (Date.now() < legacyCutoff) {
      const candidateSecrets = [
        process.env.LEGACY_HASH_SECRET,
        process.env.VITE_JWT_SECRET,
        process.env.SESSION_SECRET,
        'your-secret-key-change-in-production',
        'neon-quiz-system-secret-key-change-in-production',
        'your-super-secret-jwt-key-change-this-in-production',
        '', // plain sha256(password) fallback
      ].filter((s): s is string => typeof s === 'string');

      const uniqueSecrets = Array.from(new Set(candidateSecrets));

      for (const salt of uniqueSecrets) {
        const computedHash = crypto
          .createHash('sha256')
          .update(password + salt)
          .digest('hex');

        if (computedHash.length === row.password_hash.length) {
          if (
            crypto.timingSafeEqual(
              Buffer.from(computedHash),
              Buffer.from(row.password_hash)
            )
          ) {
            isPasswordValid = true;
            break;
          }
        }
      }

      // If valid legacy password, transparently upgrade to bcrypt
      if (isPasswordValid) {
        try {
          const newBcryptHash = await bcrypt.hash(password, 12);
          try {
            await sql`
              UPDATE profiles 
              SET password_hash = ${newBcryptHash}, password_algo = 'bcrypt', updated_at = NOW() 
              WHERE id = ${row.id}
            `;
          } catch {
            await sql`
              UPDATE profiles 
              SET password_hash = ${newBcryptHash} 
              WHERE id = ${row.id}
            `;
          }
          console.log(`[Auth] User ${row.email} transparently upgraded to bcrypt`);
        } catch (upgradeErr) {
          console.error('[Auth Upgrade Warning]', upgradeErr);
        }
      }
    } else {
      // Cutoff has passed
      throw new HttpError(
        401,
        'Your password format has expired. Please use the "Forgot Password" link to set a new password.'
      );
    }
  }

  if (!isPasswordValid) {
    await safeRecordLoginAttempt(userIdentifier, false, 'Invalid password', clientIp, userAgent);
    throw new HttpError(401, 'Invalid email or password');
  }

  // Clear rate limits for this identifier on success
  await resetRateLimit(`rl:login:id:${userIdentifier.toLowerCase()}`);

  // Log successful login attempt
  await safeRecordLoginAttempt(row.email, true, null, clientIp, userAgent);

  // Record audit trail event
  try {
    await sql`
      INSERT INTO audit_logs (user_id, action, entity_type, entity_id, ip_address, user_agent)
      VALUES (${row.id}, 'login', 'user', ${row.id}, ${clientIp}, ${userAgent})
    `;
  } catch (auditErr) {
    console.warn('[Audit Log Warning]', auditErr);
  }

  const sessionUser: SessionUser = {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    index_number: row.index_number,
  };

  const token = await createSessionToken(sessionUser);
  setSessionCookie(res, token);

  return {
    user: {
      ...sessionUser,
      created_at: row.created_at,
    },
    token,
  };
});
