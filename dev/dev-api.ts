// Runs api/gemini.ts inside the Vite dev server so `npm run dev` behaves like Vercel.
// Requests from this machine skip the passcode; the key comes from .env.local.
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import type { Plugin } from 'vite'
import { handle } from '../api/gemini.ts'

export function devApi(): Plugin {
  return {
    name: 'dev-api',
    configureServer(server) {
      // Dev only: save a good live run as the replay recording for the sample.
      server.middlewares.use('/api/replay-save', async (req, res) => {
        const host = req.headers.host ?? ''
        if (req.method !== 'POST' || !/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host)) {
          res.statusCode = 403
          return res.end('{}')
        }
        const chunks: Buffer[] = []
        for await (const c of req) chunks.push(c as Buffer)
        const { name, data } = JSON.parse(Buffer.concat(chunks).toString('utf8'))
        const safe = String(name).replace(/[^\w.-]/g, '_')
        const dir = path.resolve('public/replay')
        mkdirSync(dir, { recursive: true })
        writeFileSync(path.join(dir, `${safe}.json`), JSON.stringify(data, null, 1))
        res.setHeader('content-type', 'application/json')
        res.end(JSON.stringify({ ok: true, count: Object.keys(data).length }))
      })
      server.middlewares.use('/api/gemini', async (req, res) => {
        const chunks: Buffer[] = []
        for await (const c of req) chunks.push(c as Buffer)
        const host = req.headers.host ?? 'localhost'
        const local = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(host)
        const request = new Request(`http://${host}/api/gemini`, {
          method: req.method,
          headers: { 'content-type': 'application/json' },
          body: req.method === 'POST' ? Buffer.concat(chunks) : undefined,
        })
        const response = await handle(request, local)
        res.statusCode = response.status
        res.setHeader('content-type', 'application/json')
        res.end(await response.text())
      })
    },
  }
}
