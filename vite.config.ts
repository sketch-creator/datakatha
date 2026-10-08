/// <reference types="vitest/config" />
import path from 'node:path'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, loadEnv } from 'vite'
import { devApi } from './dev/dev-api.ts'

export default defineConfig(({ mode }) => {
  // Make .env.local values (GEMINI_API_KEY, DEMO_PASSCODE) visible to the dev API only.
  const env = loadEnv(mode, process.cwd(), '')
  for (const k of ['GEMINI_API_KEY', 'DEMO_PASSCODE']) if (env[k] && !process.env[k]) process.env[k] = env[k]
  return {
    plugins: [react(), tailwindcss(), devApi()],
    resolve: { alias: { '@': path.resolve(import.meta.dirname, './src') } },
    test: { environment: 'node', include: ['tests/**/*.test.ts'] },
  }
})
