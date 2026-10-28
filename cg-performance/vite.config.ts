import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// `--mode hosted`: build publicável como página estática (caminho relativo, sem service worker,
// sem dados do private-seed, roteamento em memória). Ver README > Versão hospedada.
export default defineConfig(({ mode }) => {
  const hosted = mode === 'hosted';
  return {
  base: hosted ? './' : '/',
  define: { 'import.meta.env.VITE_HOSTED': JSON.stringify(hosted ? '1' : '') },
  resolve: {
    alias: hosted ? [{ find: /^\.\.\/seed\/private$/, replacement: fileURLToPath(new URL('./src/seed/private.empty.ts', import.meta.url)) }] : [],
  },
  plugins: [
    react(),
    VitePWA({
      disable: hosted,
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'CG Performance',
        short_name: 'CG Perf',
        description: 'Treinador inteligente pessoal orientado à metodologia CrossFit (não oficial).',
        lang: 'pt-BR',
        theme_color: '#0f1214',
        background_color: '#0f1214',
        display: 'standalone',
        start_url: '/',
        icons: [{ src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }],
      },
      workbox: {
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // Fotos privadas do private-seed não entram no precache (ficam só no IndexedDB após importação).
        globIgnores: ['**/private-seed/**', '**/assets/*.jpg'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
      },
    }),
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks: { react: ['react', 'react-dom', 'react-router-dom'], charts: ['recharts'], data: ['dexie', 'dexie-react-hooks', 'zod'] },
      },
    },
  },
  server: {
    port: 5173,
    proxy: { '/api': 'http://localhost:8787' },
  },
  preview: {
    port: 4173,
    proxy: { '/api': 'http://localhost:8787' },
  },
  test: {
    environment: 'node',
    setupFiles: ['tests/setup.ts'],
  },
};
});
