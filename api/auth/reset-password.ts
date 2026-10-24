import bcrypt from 'bcryptjs';
import { sql } from '../_lib/db.js';
import { HttpError, jsonHandler } from '../_lib/http.js';
import { enforceRateLimit, getClientIp } from '../_lib/rateLimit.js';
import type { ApiRequest, ApiResponse } from '../_lib/types.js';

export default jsonHandler(async (req: ApiRequest, _res: ApiResponse) => {
  if (req.method !== 'POST') {
    throw new HttpError(405, 'Method not allowed');
  }

  const { token, newPassword } = req.body || {};
  if (!token || typeof token !== 'string') {
    throw new HttpError(400, 'Reset token is required');
  }

  if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 6) {
    throw new HttpError(400, 'New password must be at least 6 characters long');
  }

  await enforceRateLimit(req, 'reset-password', token, 5, 900);

  // Look up token
  const tokens = await sql`
    SELECT id, email, token, expires_at
    FROM password_reset_tokens
    WHERE token = ${token} AND expires_at > NOW()
    ORDER BY created_at DESC
    LIMIT 1
  `;

  if (tokens.length === 0) {
    throw new HttpError(400, 'Invalid or expired password reset link');
  }

  const tokenRecord = tokens[0];
  const hashedPassword = await bcrypt.hash(newPassword, 12);

  // Update password in profiles
  const updatedProfiles = await sql`
    UPDATE profiles
    SET password_hash = ${hashedPassword}, password_algo = 'bcrypt', updated_at = NOW()
    WHERE LOWER(email) = LOWER(${tokenRecord.email})
    RETURNING id, email
  `;

  // Delete all used tokens for this email
  await sql`DELETE FROM password_reset_tokens WHERE LOWER(email) = LOWER(${tokenRecord.email})`;

  const clientIp = getClientIp(req);
  const userAgent = (req.headers['user-agent'] as string) || null;

  if (updatedProfiles.length > 0) {
    try {
      await sql`
        INSERT INTO audit_logs (user_id, action, entity_type, entity_id, ip_address, user_agent)
        VALUES (
          ${updatedProfiles[0].id},
          'password_reset_success',
          'user',
          ${updatedProfiles[0].id},
          ${clientIp},
          ${userAgent}
        )
      `;
    } catch {}
  }

  return {
    success: true,
    message: 'Your password has been successfully reset. You may now log in.',
  };
});
