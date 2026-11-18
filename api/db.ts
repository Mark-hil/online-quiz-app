import { jsonHandler, HttpError, readJsonBody } from './_lib/http.js';
import { requireUser } from './_lib/session.js';
import { registry } from './_lib/registry.js';
import type { ApiRequest, ApiResponse } from './_lib/types.js';

export default jsonHandler(async (req: ApiRequest, _res: ApiResponse) => {
  if (req.method !== 'POST') {
    throw new HttpError(405, 'Method not allowed. Use POST for RPC calls.');
  }

  const user = await requireUser(req);
  const body = await readJsonBody(req);

  const { method, args = [] } = body || {};

  if (!method || typeof method !== 'string') {
    throw new HttpError(400, 'Missing or invalid RPC method');
  }

  if (!Array.isArray(args)) {
    throw new HttpError(400, 'Invalid RPC args: must be an array');
  }

  const entry = registry[method];
  if (!entry) {
    throw new HttpError(404, `Unknown RPC method: ${method}`);
  }

  // Safe backwards-compatible fallback if a student device with a cached bundle calls getQuestionBankQuestions:
  // Forces status='active' and strictly strips correct_answer and explanation so answers are never exposed.
  if (user.role === 'student' && method === 'getQuestionBankQuestions') {
    const rawItems = await entry.handler(args[0], { ...(args[1] || {}), status: 'active' });
    const sanitized = Array.isArray(rawItems)
      ? rawItems.map((q: any) => {
          if (!q || typeof q !== 'object') return q;
          const { correct_answer, explanation, ...safe } = q;
          return safe;
        })
      : [];
    return { data: sanitized };
  }

  // Check role authorization
  if (entry.allowedRoles && !entry.allowedRoles.includes(user.role)) {
    throw new HttpError(
      403,
      `Forbidden: Role '${user.role}' is not authorized to call '${method}'`
    );
  }

  // Execute guard (can inspect, mutate args, or throw)
  if (entry.guard) {
    await entry.guard(user, args);
  }

  // Execute implementation handler
  let result = await entry.handler(...args);

  // Transform / sanitize output if configured
  if (entry.transformResult) {
    result = await entry.transformResult(user, result);
  }

  return { data: result };
});
