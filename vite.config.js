import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'

// Base public path. Local dev/preview stay at '/'; the GitHub Pages build sets
// VITE_BASE=/Shop-as-a-job/ (the repo name) so assets resolve under the subpath.
const base = process.env.VITE_BASE || '/'

// https://vite.dev/config/
export default defineConfig({
  base,
  // Bind on all interfaces (incl. IPv4 127.0.0.1) and keep the port fixed so
  // `localhost` always resolves and the URL never silently drifts.
  server: { host: true, port: 5173, strictPort: true },
  preview: { host: true, port: 4173, strictPort: true },
  plugins: [
    vue(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Кафе — заказы и аналитика',
        short_name: 'Кафе',
        description: 'Offline-first cafe order, stock and analytics app',
        theme_color: '#1e293b',
        background_color: '#0f172a',
        display: 'standalone',
        // Scope/start_url follow the base so the installed PWA works on Pages.
        scope: base,
        start_url: base,
        icons: [
          {
            src: 'icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        // Precache everything the build emits so the app works fully offline.
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        navigateFallback: `${base}index.html`,
      },
      devOptions: {
        // Enable the service worker during `npm run dev` for testing offline.
        enabled: true,
      },
    }),
  ],
})
