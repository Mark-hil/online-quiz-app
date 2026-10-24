import { SignJWT, jwtVerify } from 'jose';
import { sql } from './db.js';
import { HttpError } from './http.js';
import type { ApiRequest, ApiResponse, Role, SessionUser } from './types.js';

const COOKIE_NAME = 'qa_session';
const SESSION_DURATION_SECONDS = 8 * 60 * 60; // 8 hours
const REFRESH_THRESHOLD_SECONDS = 4 * 60 * 60; // Refresh session if less than 4 hours remaining
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function getSecretKey(): Uint8Array {
  const secret = process.env.SESSION_SECRET || process.env.VITE_JWT_SECRET;
  const fallback = 'neon-quiz-system-session-secret-fallback-key-min-32chars!';

  if (!secret) {
    console.warn('[Session Security Warning] SESSION_SECRET is not configured in environment. Using fallback secret.');
    return new TextEncoder().encode(fallback);
  }

  if (secret.length < 32) {
    console.warn('[Session Security Warning] SESSION_SECRET is shorter than 32 characters. Deriving 32-byte key.');
    const derived = secret.padEnd(32, '!#$*&^%@~_+-=');
    return new TextEncoder().encode(derived);
  }

  return new TextEncoder().encode(secret);
}

export async function createSessionToken(user: SessionUser): Promise<string> {
  const secretKey = getSecretKey();
  return new SignJWT({
    sub: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    index_number: user.index_number,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION_SECONDS}s`)
    .sign(secretKey);
}

export function setSessionCookie(res: ApiResponse, token: string): void {
  const isSecure = process.env.NODE_ENV === 'production' || process.env.VERCEL === '1';
  const secureFlag = isSecure ? '; Secure' : '';
  const cookieValue = `${COOKIE_NAME}=${encodeURIComponent(token)}; HttpOnly; Path=/; Max-Age=${SESSION_DURATION_SECONDS}; SameSite=Lax${secureFlag}`;

  const existing = res.getHeader('Set-Cookie');
  if (!existing) {
    res.setHeader('Set-Cookie', cookieValue);
  } else if (Array.isArray(existing)) {
    res.setHeader('Set-Cookie', [...existing, cookieValue]);
  } else {
    res.setHeader('Set-Cookie', [String(existing), cookieValue]);
  }
}

export function clearSessionCookie(res: ApiResponse): void {
  const isSecure = process.env.NODE_ENV === 'production' || process.env.VERCEL === '1';
  const secureFlag = isSecure ? '; Secure' : '';
  const cookieValue = `${COOKIE_NAME}=; HttpOnly; Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax${secureFlag}`;

  const existing = res.getHeader('Set-Cookie');
  if (!existing) {
    res.setHeader('Set-Cookie', cookieValue);
  } else if (Array.isArray(existing)) {
    res.setHeader('Set-Cookie', [...existing, cookieValue]);
  } else {
    res.setHeader('Set-Cookie', [String(existing), cookieValue]);
  }
}

export async function getSessionUser(req: ApiRequest, res?: ApiResponse): Promise<SessionUser | null> {
  // Return memoized user if already verified during this request lifecycle
  if (req.user) {
    return req.user;
  }

  // First check cookie, then optional Authorization: Bearer token
  const tokenFromCookie = req.cookies?.[COOKIE_NAME];
  let token = tokenFromCookie;

  if (!token && req.headers.authorization?.startsWith('Bearer ')) {
    token = req.headers.authorization.slice(7).trim();
  }

  if (!token) {
    return null;
  }

  try {
    const secretKey = getSecretKey();
    // Enforce HS256 algorithm to prevent algorithm confusion attacks
    const { payload } = await jwtVerify(token, secretKey, {
      algorithms: ['HS256'],
      clockTolerance: 15,
    });

    const userId = payload.sub;
    // Validate UUID format to prevent Postgres syntax errors
    if (!userId || typeof userId !== 'string' || !UUID_REGEX.test(userId)) {
      return null;
    }

    // Fresh profile read from DB so role changes or deletions take effect immediately
    const rows = await sql`
      SELECT id, email, name, role, index_number 
      FROM profiles 
      WHERE id = ${userId} 
      LIMIT 1
    `;

    if (!rows || rows.length === 0) {
      return null;
    }

    const row = rows[0];
    const user: SessionUser = {
      id: row.id,
      email: row.email,
      name: row.name,
      role: row.role as Role,
      index_number: row.index_number,
    };

    req.user = user;

    // Sliding session auto-refresh: if within refresh threshold and response object is available, issue renewed cookie
    if (res && payload.exp && typeof payload.exp === 'number') {
      const nowSeconds = Math.floor(Date.now() / 1000);
      const remainingSeconds = payload.exp - nowSeconds;
      if (remainingSeconds > 0 && remainingSeconds < REFRESH_THRESHOLD_SECONDS) {
        try {
          const renewedToken = await createSessionToken(user);
          setSessionCookie(res, renewedToken);
        } catch (refreshErr) {
          console.warn('[Session Renewal Warning]', refreshErr);
        }
      }
    }

    return user;
  } catch (err) {
    return null;
  }
}

export async function requireUser(req: ApiRequest, res?: ApiResponse): Promise<SessionUser> {
  const user = await getSessionUser(req, res);
  if (!user) {
    throw new HttpError(401, 'Authentication required');
  }
  return user;
}

export function requireRole(user: SessionUser | undefined | null, roles: Role[]): void {
  if (!user) {
    throw new HttpError(401, 'Authentication required');
  }
  if (!roles.includes(user.role)) {
    throw new HttpError(403, `Access denied for role: ${user.role}`);
  }
}
