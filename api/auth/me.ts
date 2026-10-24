import { jsonHandler } from '../_lib/http.js';
import { requireUser } from '../_lib/session.js';
import type { ApiRequest, ApiResponse } from '../_lib/types.js';

export default jsonHandler(async (req: ApiRequest, _res: ApiResponse) => {
  const user = await requireUser(req);
  return { user };
});
