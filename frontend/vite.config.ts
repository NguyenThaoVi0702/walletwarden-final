/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'logo-180.png', 'logo-64.png'],
      manifest: {
        name: 'WalletWarden',
        short_name: 'WalletWarden',
        description: 'Spend less. Or get roasted.',
        lang: 'vi',
        start_url: '/',
        theme_color: '#0E2F51',
        background_color: '#FFFFFF',
        display: 'standalone',
        icons: [
          { src: '/logo-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/logo-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/logo-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // MSW is for development only; keep it out of the PWA cache.
        globIgnores: ['**/mockServiceWorker.js'],
        navigateFallbackDenylist: [/^\/api/], // the service worker must not return index.html for API calls
        runtimeCaching: [{ urlPattern: /^\/api\//, handler: 'NetworkOnly' }],
      },
    }),
  ],
  server: { proxy: { '/api': 'http://localhost:8000' } }, // dev: reach the real backend when mocks are off
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    environmentOptions: { jsdom: { url: 'http://localhost:5173' } },
  },
});
