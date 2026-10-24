import type { ApiHandler, ApiRequest, ApiResponse } from './types.js';

export class HttpError extends Error {
  statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.name = 'HttpError';
    this.statusCode = statusCode;
  }
}

export function parseCookies(header?: string): Record<string, string> {
  const list: Record<string, string> = {};
  if (!header) return list;

  header.split(';').forEach(cookie => {
    const parts = cookie.split('=');
    const name = parts[0]?.trim();
    if (!name) return;
    const val = parts.slice(1).join('=').trim();
    try {
      list[name] = decodeURIComponent(val);
    } catch {
      list[name] = val;
    }
  });

  return list;
}

export async function readJsonBody(req: ApiRequest): Promise<any> {
  if (req.body !== undefined) {
    if (typeof req.body === 'string') {
      try {
        req.body = JSON.parse(req.body);
      } catch {
        throw new HttpError(400, 'Invalid JSON body string');
      }
    }
    return req.body;
  }

  // Safe methods do not consume body streams
  if (req.method === 'GET' || req.method === 'HEAD') {
    req.body = {};
    return req.body;
  }

  if (req.readableEnded) {
    req.body = {};
    return req.body;
  }

  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', chunk => {
      raw += chunk;
      // 2MB payload limit
      if (raw.length > 2 * 1024 * 1024) {
        reject(new HttpError(413, 'Payload too large (maximum 2MB)'));
      }
    });

    req.on('end', () => {
      if (!raw || raw.trim().length === 0) {
        req.body = {};
        return resolve(req.body);
      }
      try {
        req.body = JSON.parse(raw);
        resolve(req.body);
      } catch {
        reject(new HttpError(400, 'Invalid JSON payload'));
      }
    });

    req.on('error', err => reject(err));
  });
}

export function parseQuery(url?: string): Record<string, string | string[] | undefined> {
  if (!url) return {};
  const queryIndex = url.indexOf('?');
  if (queryIndex === -1) return {};

  const searchParams = new URLSearchParams(url.slice(queryIndex));
  const query: Record<string, string | string[] | undefined> = {};
  for (const [key, val] of searchParams.entries()) {
    if (query[key] !== undefined) {
      if (Array.isArray(query[key])) {
        (query[key] as string[]).push(val);
      } else {
        query[key] = [query[key] as string, val];
      }
    } else {
      query[key] = val;
    }
  }
  return query;
}

export function checkCsrf(req: ApiRequest): void {
  const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
  if (safeMethods.includes(req.method || 'GET')) {
    return;
  }

  // Modern browser defense: allow same-origin and reject cross-site state-changing requests
  const secFetchSite = req.headers['sec-fetch-site'];
  if (secFetchSite === 'same-origin' || secFetchSite === 'same-site') {
    return;
  }
  if (secFetchSite === 'cross-site') {
    throw new HttpError(403, 'Cross-site request forbidden (Sec-Fetch-Site)');
  }

  const origin = (req.headers['origin'] as string) || '';
  const referer = (req.headers['referer'] as string) || '';
  const host =
    (req.headers['x-forwarded-host'] as string) ||
    (req.headers['host'] as string) ||
    '';
  const configuredAppUrl = process.env.APP_URL || process.env.VITE_APP_URL || '';

  // Non-browser or direct curl/tests with no origin/referer are allowed
  if (!origin && !referer) {
    return;
  }

  try {
    const targetOrigin = origin || (referer ? new URL(referer).origin : '');
    if (!targetOrigin) return;

    const targetUrl = new URL(targetOrigin);
    const targetHost = targetUrl.host;
    const targetHostname = targetUrl.hostname;

    // Check host match (handling proxy comma-separated host headers if present)
    const primaryHost = host.split(',')[0].trim();
    const primaryHostname = primaryHost.split(':')[0];

    if (primaryHost && (targetHost === primaryHost || targetHostname === primaryHostname)) {
      return;
    }

    // Allow *.vercel.app deployment domains
    if (targetHostname.endsWith('.vercel.app')) {
      return;
    }

    // Check match with configured APP_URL
    if (configuredAppUrl) {
      try {
        const appOrigin = new URL(configuredAppUrl).origin;
        if (targetOrigin === appOrigin) {
          return;
        }
      } catch {}
    }

    // Allow localhost in development
    if (targetHostname === 'localhost' || targetHostname === '127.0.0.1') {
      return;
    }

    throw new HttpError(403, 'Cross-site request forbidden (CSRF)');
  } catch (err: any) {
    if (err instanceof HttpError) throw err;
    throw new HttpError(403, 'Invalid request origin (CSRF)');
  }
}

export function jsonHandler(handler: ApiHandler): ApiHandler {
  return async (req: ApiRequest, res: ApiResponse) => {
    // Enhance res with status() and json() if not present
    if (!res.status) {
      res.status = function (code: number) {
        this.statusCode = code;
        return this;
      };
    }

    if (!res.json) {
      res.json = function (data: any) {
        if (!this.getHeader('Content-Type')) {
          this.setHeader('Content-Type', 'application/json; charset=utf-8');
        }
        this.end(JSON.stringify(data));
      };
    }

    // Handle OPTIONS preflight
    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.end();
      return;
    }

    try {
      req.cookies = parseCookies(req.headers['cookie']);
      req.query = parseQuery(req.url);
      await readJsonBody(req);
      checkCsrf(req);

      const result = await handler(req, res);
      if (!res.writableEnded && result !== undefined) {
        res.status(200).json(result);
      }
    } catch (err: any) {
      if (err instanceof HttpError) {
        res.status(err.statusCode).json({ error: err.message });
      } else {
        console.error('[API Error]', req.method, req.url, err);
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  };
}
