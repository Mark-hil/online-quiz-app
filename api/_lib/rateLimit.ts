import { sql } from './db.js';
import { HttpError } from './http.js';
import type { ApiRequest } from './types.js';

// In-memory fallback if the DB rate_limits table has not been migrated yet
const memoryStore = new Map<string, { count: number; resetAt: number }>();

export function getClientIp(req: ApiRequest): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  if (Array.isArray(forwarded) && forwarded.length > 0) {
    return forwarded[0].trim();
  }
  const realIp = req.headers['x-real-ip'];
  if (typeof realIp === 'string') {
    return realIp.trim();
  }
  return req.socket?.remoteAddress || '127.0.0.1';
}

export async function checkRateLimit(
  key: string,
  maxAttempts = 10,
  windowSeconds = 900 // 15 minutes
): Promise<{ allowed: boolean; remaining: number }> {
  const now = new Date();
  const resetAt = new Date(Date.now() + windowSeconds * 1000);

  try {
    // Try Neon database rate_limits table
    const rows = await sql`
      INSERT INTO rate_limits (key, attempts, reset_at)
      VALUES (${key}, 1, ${resetAt.toISOString()})
      ON CONFLICT (key) DO UPDATE
      SET 
        attempts = CASE 
          WHEN rate_limits.reset_at < NOW() THEN 1 
          ELSE rate_limits.attempts + 1 
        END,
        reset_at = CASE 
          WHEN rate_limits.reset_at < NOW() THEN ${resetAt.toISOString()} 
          ELSE rate_limits.reset_at 
        END
      RETURNING attempts, reset_at
    `;

    const attempts = rows[0]?.attempts ?? 1;
    const allowed = attempts <= maxAttempts;
    return {
      allowed,
      remaining: Math.max(0, maxAttempts - attempts),
    };
  } catch (err: any) {
    // Fallback to memory store if table does not exist
    const record = memoryStore.get(key);
    const nowMs = Date.now();

    if (!record || record.resetAt < nowMs) {
      memoryStore.set(key, { count: 1, resetAt: nowMs + windowSeconds * 1000 });
      return { allowed: true, remaining: maxAttempts - 1 };
    }

    record.count += 1;
    const allowed = record.count <= maxAttempts;
    return {
      allowed,
      remaining: Math.max(0, maxAttempts - record.count),
    };
  }
}

export async function resetRateLimit(key: string): Promise<void> {
  try {
    await sql`DELETE FROM rate_limits WHERE key = ${key}`;
  } catch {
    memoryStore.delete(key);
  }
}

export async function enforceRateLimit(
  req: ApiRequest,
  action: string,
  identifier?: string,
  maxAttempts = 10,
  windowSeconds = 900
): Promise<void> {
  const ip = getClientIp(req);
  const ipKey = `rl:${action}:ip:${ip}`;
  const ipCheck = await checkRateLimit(ipKey, maxAttempts * 2, windowSeconds);

  if (!ipCheck.allowed) {
    throw new HttpError(429, 'Too many requests from this IP. Please try again later.');
  }

  if (identifier) {
    const idKey = `rl:${action}:id:${identifier.toLowerCase().trim()}`;
    const idCheck = await checkRateLimit(idKey, maxAttempts, windowSeconds);
    if (!idCheck.allowed) {
      throw new HttpError(429, 'Too many failed attempts. Please wait before trying again.');
    }
  }
}
