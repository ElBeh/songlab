import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import { alphaTab } from '@coderline/alphatab-vite';

export default defineConfig({
  base: process.env.VITE_BASE_PATH || '/',
  plugins: [
    react(),
    tailwindcss(),
    alphaTab(),  
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/icon-192.png', 'icons/icon-512.png'],
      manifest: {
        name: 'SongLab',
        short_name: 'SongLab',
        description: 'Guitar practice & song structure tool',
        theme_color: '#1e293b',
        background_color: '#0f172a',
        display: 'standalone',
        orientation: 'landscape',
        icons: [
          {
            src: 'icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        // Cache all assets for offline use
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
          },
        ],
      },
    }),
  ],
  server: {
    proxy: {
      // Proxy socket.io requests to the Express sync server during development
      '/socket.io': {
        target: 'http://localhost:3000',
        ws: true,
      },
    },
  },
});