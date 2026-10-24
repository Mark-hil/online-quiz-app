import crypto from 'node:crypto';
import { sql } from '../_lib/db.js';
import { HttpError, jsonHandler } from '../_lib/http.js';
import { enforceRateLimit, getClientIp } from '../_lib/rateLimit.js';
import type { ApiRequest, ApiResponse } from '../_lib/types.js';

export default jsonHandler(async (req: ApiRequest, _res: ApiResponse) => {
  if (req.method !== 'POST') {
    throw new HttpError(405, 'Method not allowed');
  }

  const { email } = req.body || {};
  if (!email || typeof email !== 'string') {
    throw new HttpError(400, 'Email address is required');
  }

  const cleanEmail = email.toLowerCase().trim();
  await enforceRateLimit(req, 'forgot-password', cleanEmail, 5, 3600);

  // Look up user
  const users = await sql`
    SELECT id, email, name 
    FROM profiles 
    WHERE LOWER(email) = ${cleanEmail}
    LIMIT 1
  `;

  if (users.length > 0) {
    const user = users[0];
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Invalidate any existing unused reset tokens for this user
    await sql`DELETE FROM password_reset_tokens WHERE LOWER(email) = ${cleanEmail}`;

    await sql`
      INSERT INTO password_reset_tokens (email, token, expires_at)
      VALUES (${user.email}, ${token}, ${expiresAt.toISOString()})
    `;

    const appUrl = process.env.APP_URL || process.env.VITE_APP_URL || 'http://localhost:5173';
    const resetLink = `${appUrl}/reset-password?token=${token}`;

    const clientIp = getClientIp(req);
    const userAgent = (req.headers['user-agent'] as string) || null;

    try {
      await sql`
        INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip_address, user_agent)
        VALUES (
          ${user.id},
          'password_reset_request',
          'user',
          ${user.id},
          ${JSON.stringify({ email: user.email })},
          ${clientIp},
          ${userAgent}
        )
      `;
    } catch {}

    console.log('=== [Password Reset Dispatch] ===');
    console.log(`To: ${user.email} (${user.name})`);
    console.log(`Reset Link: ${resetLink}`);
    console.log(`Expires: ${expiresAt.toISOString()}`);
    console.log('=================================');
  }

  // Consistent message to prevent account enumeration
  return {
    success: true,
    message: 'If an account exists with that email address, a password reset link has been dispatched.',
  };
});
