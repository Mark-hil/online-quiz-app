import { jsonHandler } from '../_lib/http.js';
import { clearSessionCookie } from '../_lib/session.js';
import type { ApiRequest, ApiResponse } from '../_lib/types.js';

export default jsonHandler(async (req: ApiRequest, res: ApiResponse) => {
  clearSessionCookie(res);
  return { success: true, message: 'Logged out successfully' };
});
