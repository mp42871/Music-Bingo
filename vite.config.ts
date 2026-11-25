/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: './',
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'Music Bingo DJ',
        short_name: 'Music Bingo',
        description: 'Run music bingo: playlists, printable cards, DJ console and claim checks — online or offline.',
        theme_color: '#0d0820',
        background_color: '#0d0820',
        display: 'standalone',
        start_url: './',
        scope: './',
        icons: [{ src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,woff,woff2,svg,png}'],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        navigateFallback: 'index.html',
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/(i\.scdn\.co|image-cdn-[a-z0-9-]+\.spotifycdn\.com|mosaic\.scdn\.co)\//,
            handler: 'CacheFirst',
            options: { cacheName: 'album-art', expiration: { maxEntries: 3000 }, cacheableResponse: { statuses: [0, 200] } },
          },
        ],
      },
    }),
  ],
  server: { host: '127.0.0.1', port: 5173 },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    css: false,
    globals: true,
  },
});
