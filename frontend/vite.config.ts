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
        // MSW chỉ dùng lúc dev, không đưa vào cache của PWA.
        globIgnores: ['**/mockServiceWorker.js'],
        navigateFallbackDenylist: [/^\/api/], // quan trọng: SW không được trả index.html cho API
        runtimeCaching: [{ urlPattern: /^\/api\//, handler: 'NetworkOnly' }],
      },
    }),
  ],
  server: { proxy: { '/api': 'http://localhost:8000' } }, // dev: gọi backend thật khi tắt mock
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    environmentOptions: { jsdom: { url: 'http://localhost:5173' } },
  },
});
