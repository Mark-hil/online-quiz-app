import { defineConfig, loadEnv, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { vitePluginApi } from './vite-plugin-api.ts';

const sebPlugin = (): Plugin => {
  return {
    name: 'seb-config-generator',
    configureServer(server: any) {
      server.middlewares.use(async (req: any, res: any, next: any) => {
        const pathname = (req.url || '').split('?')[0];
        if (pathname === '/launcher.seb') {
          try {
            const mod = await server.ssrLoadModule('/api/_lib/handlers/exam/seb-config.ts');
            const handler = mod.default;
            await handler(req, res);
            return;
          } catch (err) {
            console.error('[SEB Plugin Error]', err);
          }
        }
        next();
      });
    },
  };
};

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), sebPlugin(), vitePluginApi()],
  server: {
    port: 5173,
    hmr: {
      port: 5173,
    },
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
});
