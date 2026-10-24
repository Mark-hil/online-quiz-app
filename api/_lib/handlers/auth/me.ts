import { jsonHandler } from '../../http.js';
import { requireUser } from '../../session.js';
import type { ApiRequest, ApiResponse } from '../../types.js';

export default jsonHandler(async (req: ApiRequest, _res: ApiResponse) => {
  const user = await requireUser(req);
  return { user };
});
