import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

// Vitest config kept separate from the app build config. jsdom is used for
// everything so component tests and IndexedDB-backed logic share one env.
export default defineConfig({
  plugins: [vue()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.js'],
    include: ['tests/**/*.test.js'],
  },
})
