import type { ApiRequest, ApiResponse } from '../_lib/types.js';
import loginHandler from '../_lib/handlers/auth/login.js';
import signupHandler from '../_lib/handlers/auth/signup.js';
import logoutHandler from '../_lib/handlers/auth/logout.js';
import meHandler from '../_lib/handlers/auth/me.js';
import bootstrapHandler from '../_lib/handlers/auth/bootstrap.js';
import forgotPasswordHandler from '../_lib/handlers/auth/forgot-password.js';
import resetPasswordHandler from '../_lib/handlers/auth/reset-password.js';

const handlers: Record<string, any> = {
  login: loginHandler,
  signup: signupHandler,
  logout: logoutHandler,
  me: meHandler,
  bootstrap: bootstrapHandler,
  'forgot-password': forgotPasswordHandler,
  'reset-password': resetPasswordHandler,
};

function extractAction(req: ApiRequest): string {
  const queryAction = req.query?.action;
  const rawQuery = Array.isArray(queryAction) ? queryAction[0] : queryAction;
  if (rawQuery && rawQuery !== '[action]') {
    return rawQuery.toLowerCase().trim();
  }

  const rawUrl = req.url || '';
  try {
    const parsed = new URL(rawUrl, 'http://localhost');
    const param = parsed.searchParams.get('action');
    if (param && param !== '[action]') {
      return param.toLowerCase().trim();
    }

    const segments = parsed.pathname.split('/').filter(Boolean);
    const last = segments.pop() || '';
    if (last && last !== '[action]') {
      return last.toLowerCase().trim();
    }
  } catch {}

  return '';
}

export default async function authActionRouter(req: ApiRequest, res: ApiResponse) {
  const action = extractAction(req);
  const handler = handlers[action];
  if (!handler) {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: `Auth endpoint '/api/auth/${action || 'unknown'}' not found` }));
    return;
  }

  return handler(req, res);
}
