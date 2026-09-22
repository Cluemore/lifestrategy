import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const localApiProxyTarget = env.VITE_LOCAL_API_PROXY_TARGET;

  return {
    plugins: [react()],
    // Vercel serves the Vite build from the site root. Keeping this explicit
    // avoids relative asset paths being resolved from a deep-linked URL.
    base: '/',
    // Local development uses a same-origin /api URL. The proxy target lives in
    // .env.development so production builds never contain a localhost URL.
    server: localApiProxyTarget
      ? {
          proxy: {
            '/api': {
              target: localApiProxyTarget,
              changeOrigin: true,
            },
          },
        }
      : undefined,
  };
});
