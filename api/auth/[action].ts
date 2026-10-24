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

export default async function authActionRouter(req: ApiRequest, res: ApiResponse) {
  const url = req.url || '';
  const pathname = url.split('?')[0];
  const queryAction = req.query?.action;
  const actionFromQuery = Array.isArray(queryAction) ? queryAction[0] : queryAction;
  const action = actionFromQuery || pathname.split('/').filter(Boolean).pop() || '';

  const handler = handlers[action];
  if (!handler) {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: `Auth endpoint '/api/auth/${action}' not found` }));
    return;
  }

  return handler(req, res);
}
