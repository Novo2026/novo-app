import fs from 'node:fs';
import path from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

const buildVersion = `novo-cache-${Date.now()}`;

function injectServiceWorkerCacheVersion(): Plugin {
  return {
    name: 'inject-sw-cache-version',
    apply: 'build',
    closeBundle() {
      const swPath = path.resolve(__dirname, 'dist/service-worker.js');
      if (!fs.existsSync(swPath)) return;

      const content = fs.readFileSync(swPath, 'utf-8');
      fs.writeFileSync(swPath, content.replaceAll('__CACHE_VERSION__', buildVersion));
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), injectServiceWorkerCacheVersion()],
  define: {
    __CACHE_VERSION__: JSON.stringify(buildVersion),
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  server: {
    proxy: {
      '/anthropic-api': {
        target: 'https://api.anthropic.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/anthropic-api/, ''),
      },
    },
  },
});
