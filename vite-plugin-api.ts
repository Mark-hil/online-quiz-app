import type { Plugin, ViteDevServer } from 'vite';
import { loadEnv } from 'vite';
import fs from 'node:fs';
import path from 'node:path';

export function vitePluginApi(): Plugin {
  return {
    name: 'vite-plugin-api',
    config(_config, { mode }) {
      // Ensure all env variables (including non-VITE_) are loaded into process.env in dev
      const env = loadEnv(mode, process.cwd(), '');
      for (const [key, val] of Object.entries(env)) {
        if (process.env[key] === undefined) {
          process.env[key] = val;
        }
      }
    },
    configureServer(server: ViteDevServer) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url || '';
        const pathname = url.split('?')[0];

        if (!pathname.startsWith('/api/')) {
          return next();
        }

        // Block internal helpers from being served directly as endpoints
        if (pathname.startsWith('/api/_')) {
          res.statusCode = 404;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Endpoint not found' }));
          return;
        }

        const relativePath = pathname.slice('/api/'.length);

        // Security: Prevent path traversal attacks
        if (relativePath.includes('..') || relativePath.includes('\0')) {
          res.statusCode = 403;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Access forbidden: invalid API path' }));
          return;
        }

        const apiRoot = path.resolve(process.cwd(), 'api');
        const candidates = [
          path.resolve(apiRoot, `${relativePath}.ts`),
          path.resolve(apiRoot, relativePath, 'index.ts'),
        ];

        let targetFile: string | null = null;
        for (const candidate of candidates) {
          // Verify resolved path stays strictly within the api directory
          if (
            candidate.startsWith(apiRoot + path.sep) &&
            fs.existsSync(candidate) &&
            fs.statSync(candidate).isFile()
          ) {
            targetFile = candidate;
            break;
          }
        }

        if (!targetFile) {
          res.statusCode = 404;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: `API route not found: ${pathname}` }));
          return;
        }

        try {
          // Hot-load the TypeScript API handler
          const mod = await server.ssrLoadModule(targetFile);
          const handler = mod.default || mod.handler;

          if (typeof handler !== 'function') {
            console.error(`[API Dev Error] Handler in ${targetFile} does not export a default function.`);
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'Invalid API handler export' }));
            return;
          }

          await handler(req, res);
        } catch (err: any) {
          console.error(`[API Dev Exception in ${pathname}]:`, err);
          if (!res.writableEnded) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: err?.message || 'Internal server error in dev API' }));
          }
        }
      });
    },
  };
}
