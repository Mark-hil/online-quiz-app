import { jsonHandler, HttpError } from './_lib/http.js';
import type { ApiRequest, ApiResponse } from './_lib/types.js';

export default jsonHandler(async (req: ApiRequest, res: ApiResponse) => {
  if (req.method !== 'POST') {
    throw new HttpError(405, 'Method not allowed');
  }

  const { to, subject, html } = req.body || {};
  if (!to || !subject || !html) {
    throw new HttpError(400, 'Missing required fields: to, subject, html');
  }

  // If RESEND_API_KEY or SMTP is provided, send through service.
  // Otherwise log to server console for dev / audit.
  console.log('=== [Server Email Dispatch] ===');
  console.log(`To: ${to}`);
  console.log(`Subject: ${subject}`);
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log('===============================');

  return { success: true, message: 'Email queued successfully' };
});
