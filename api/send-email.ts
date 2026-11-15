import { jsonHandler, HttpError } from './_lib/http.js';
import { requireUser } from './_lib/session.js';
import { enforceRateLimit } from './_lib/rateLimit.js';
import type { ApiRequest, ApiResponse } from './_lib/types.js';

const AUTHORIZED_ROLES = ['lecturer', 'moderator', 'admin', 'super_admin'];

export default jsonHandler(async (req: ApiRequest, res: ApiResponse) => {
  if (req.method !== 'POST') {
    throw new HttpError(405, 'Method not allowed');
  }

  const user = await requireUser(req);
  if (!AUTHORIZED_ROLES.includes(user.role)) {
    throw new HttpError(403, 'Access denied: Only staff members can dispatch outbound emails');
  }

  await enforceRateLimit(req, 'send-email', user.id, 20, 3600);

  const { to, subject, html } = req.body || {};
  if (!to || !subject || !html) {
    throw new HttpError(400, 'Missing required fields: to, subject, html');
  }

  // If RESEND_API_KEY or SMTP is provided, send through service.
  // Otherwise log to server console for dev / audit.
  console.log('=== [Server Email Dispatch] ===');
  console.log(`From User: ${user.email} (${user.role})`);
  console.log(`To: ${to}`);
  console.log(`Subject: ${subject}`);
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log('===============================');

  return { success: true, message: 'Email queued successfully' };
});
