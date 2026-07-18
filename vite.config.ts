import { defineConfig, loadEnv, Plugin } from 'vite';
import react from '@vitejs/plugin-react';

const sebPlugin = (): Plugin => {
  return {
    name: 'seb-config-generator',
    configureServer(server: any) {
      server.middlewares.use((req: any, res: any, next: any) => {
        if (req.url === '/launcher.seb') {
          const env = loadEnv(server.config.mode, process.cwd(), '');
          const appUrl = env.VITE_APP_URL || 'http://localhost:5173';
          
          const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
  <dict>
    <key>startURL</key>
    <string>${appUrl}</string>
  </dict>
</plist>`;
          res.setHeader('Content-Type', 'application/seb');
          res.end(xml);
        } else {
          next();
        }
      });
    },
    generateBundle() {
      const env = loadEnv('production', process.cwd(), '');
      const appUrl = env.VITE_APP_URL || 'http://localhost:5173';
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
  <dict>
    <key>startURL</key>
    <string>${appUrl}</string>
  </dict>
</plist>`;
      
      this.emitFile({
        type: 'asset',
        fileName: 'launcher.seb',
        source: xml
      });
    }
  };
};

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), sebPlugin()],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
});
