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

export default async function examActionRouter(req: ApiRequest, res: ApiResponse) {
  const action = extractAction(req);
  const handler = handlers[action];
  if (!handler) {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: `Exam endpoint '/api/exam/${action || 'unknown'}' not found` }));
    return;
  }

  return handler(req, res);
}
