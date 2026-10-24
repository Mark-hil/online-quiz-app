import { jsonHandler } from '../../http.js';
import { clearSessionCookie } from '../../session.js';
import type { ApiRequest, ApiResponse } from '../../types.js';

export default jsonHandler(async (req: ApiRequest, res: ApiResponse) => {
  clearSessionCookie(res);
  return { success: true, message: 'Logged out successfully' };
});
