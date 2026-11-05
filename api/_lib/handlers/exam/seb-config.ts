import type { ApiRequest, ApiResponse } from '../../types.js';

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function resolveOrigin(req: ApiRequest): string {
  const forwardedProto = req.headers['x-forwarded-proto'];
  const protoHeader = Array.isArray(forwardedProto) ? forwardedProto[0] : forwardedProto;

  const forwardedHost = req.headers['x-forwarded-host'] || req.headers['host'];
  const hostHeader = Array.isArray(forwardedHost) ? forwardedHost[0] : forwardedHost;
  const host = (hostHeader || 'localhost:5173').split(',')[0].trim();

  const isLocal =
    host.startsWith('localhost') ||
    host.startsWith('127.0.0.1') ||
    host.startsWith('[::1]');

  const proto = protoHeader
    ? protoHeader.split(',')[0].trim()
    : isLocal
      ? 'http'
      : 'https';

  return `${proto}://${host}`;
}

function extractQuizId(req: ApiRequest): string | null {
  const queryQuizId = req.query?.quizId || req.query?.quiz_id;
  const rawQuery = Array.isArray(queryQuizId) ? queryQuizId[0] : queryQuizId;
  if (rawQuery && typeof rawQuery === 'string') {
    const clean = rawQuery.trim();
    if (/^[a-zA-Z0-9_-]+$/.test(clean)) {
      return clean;
    }
  }

  try {
    const parsed = new URL(req.url || '', 'http://localhost');
    const param = parsed.searchParams.get('quizId') || parsed.searchParams.get('quiz_id');
    if (param && /^[a-zA-Z0-9_-]+$/.test(param.trim())) {
      return param.trim();
    }
  } catch {}

  return null;
}

export function buildSebPlistXml(startUrl: string, quitUrl: string): string {
  const safeStartUrl = escapeXml(startUrl);
  const safeQuitUrl = escapeXml(quitUrl);

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
  <dict>
    <key>originatorVersion</key>
    <string>SEB_Win_3.6.0</string>
    <key>startURL</key>
    <string>${safeStartUrl}</string>
    <key>sendBrowserExamKey</key>
    <true/>
    <key>browserUserAgentWinDesktopMode</key>
    <integer>1</integer>
    <key>browserUserAgentMac</key>
    <integer>0</integer>
    <key>allowQuit</key>
    <true/>
    <key>ignoreExitKeys</key>
    <false/>
    <key>hashedQuitPassword</key>
    <string></string>
    <key>quitURL</key>
    <string>${safeQuitUrl}</string>
    <key>quitURLConfirm</key>
    <false/>
    <key>allowSwitchToApplications</key>
    <false/>
    <key>enableAppSwitcherCheck</key>
    <true/>
    <key>showTaskBar</key>
    <true/>
    <key>showReloadButton</key>
    <true/>
    <key>showTime</key>
    <true/>
    <key>showInputLanguage</key>
    <true/>
    <key>enableBrowserWindowToolbar</key>
    <false/>
    <key>hideBrowserWindowToolbar</key>
    <true/>
    <key>browserWindowAllowAddressBar</key>
    <false/>
    <key>newBrowserWindowAllowAddressBar</key>
    <false/>
    <key>allowBrowsingBackForward</key>
    <false/>
    <key>enablePlugIns</key>
    <false/>
    <key>enableJava</key>
    <false/>
    <key>allowSpellCheck</key>
    <false/>
    <key>allowDictionaryLookup</key>
    <false/>
    <key>allowVideoCapture</key>
    <true/>
    <key>allowAudioCapture</key>
    <true/>
    <key>browserMediaCaptureCamera</key>
    <true/>
    <key>browserMediaCaptureMicrophone</key>
    <true/>
    <key>browserMediaCaptureScreen</key>
    <true/>
  </dict>
</plist>`;
}

export default async function sebConfigHandler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.statusCode = 405;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Method not allowed' }));
    return;
  }

  const origin = resolveOrigin(req);
  const quizId = extractQuizId(req);
  const startUrl = quizId ? `${origin}/student/quiz/${quizId}` : `${origin}/student/quizzes`;
  const quitUrl = `${origin}/student/quizzes?seb_quit=1`;

  const xml = buildSebPlistXml(startUrl, quitUrl);

  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/seb; charset=utf-8');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${quizId ? `exam-${quizId}.seb` : 'launcher.seb'}"`
  );
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.end(xml);
}

