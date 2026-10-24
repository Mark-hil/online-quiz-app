import type { ApiRequest, ApiResponse } from '../_lib/types.js';
import startHandler from '../_lib/handlers/exam/start.js';
import answerHandler from '../_lib/handlers/exam/answer.js';
import heartbeatHandler from '../_lib/handlers/exam/heartbeat.js';
import submitHandler from '../_lib/handlers/exam/submit.js';
import terminateHandler from '../_lib/handlers/exam/terminate.js';
import resumePinHandler from '../_lib/handlers/exam/resume-pin.js';

const handlers: Record<string, any> = {
  start: startHandler,
  answer: answerHandler,
  heartbeat: heartbeatHandler,
  submit: submitHandler,
  terminate: terminateHandler,
  'resume-pin': resumePinHandler,
};

export default async function examActionRouter(req: ApiRequest, res: ApiResponse) {
  const url = req.url || '';
  const pathname = url.split('?')[0];
  const queryAction = req.query?.action;
  const actionFromQuery = Array.isArray(queryAction) ? queryAction[0] : queryAction;
  const action = actionFromQuery || pathname.split('/').filter(Boolean).pop() || '';

  const handler = handlers[action];
  if (!handler) {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: `Exam endpoint '/api/exam/${action}' not found` }));
    return;
  }

  return handler(req, res);
}
