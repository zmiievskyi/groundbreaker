import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// During `npm run dev`, requests to /api/* are proxied to the local n8n webhook
// so the React app can fetch live data without going through Caddy.
// In production, Caddy handles the same rewrite.
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5678',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '/webhook/api'),
      },
    },
  },
});
