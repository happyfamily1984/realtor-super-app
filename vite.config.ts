import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

/** 개발 서버(npm run dev)에서도 /api/* 가 동작하게 한다. 배포 시에는 Vercel 이 api/ 폴더를 직접 실행한다. */
function devApi(): Plugin {
  return {
    name: 'dev-api',
    configureServer(server) {
      Object.assign(process.env, { ...loadEnv('development', process.cwd(), ''), ...process.env })
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url ?? '/', 'http://localhost')
        const m = /^\/api\/([a-z]+)$/.exec(url.pathname)
        if (!m) return next()
        const chunks: Buffer[] = []
        for await (const c of req) chunks.push(c as Buffer)
        const raw = Buffer.concat(chunks).toString()
        const out = {
          status(code: number) {
            res.statusCode = code
            return out
          },
          setHeader: (k: string, v: string) => res.setHeader(k, v),
          json(body: unknown) {
            res.setHeader('Content-Type', 'application/json; charset=utf-8')
            res.end(JSON.stringify(body))
          },
        }
        try {
          const mod = await server.ssrLoadModule(`/api/${m[1]}.ts`)
          await mod.default({ method: req.method, headers: req.headers, query: Object.fromEntries(url.searchParams), body: raw ? JSON.parse(raw) : undefined }, out)
        } catch (e) {
          out.status(500).json({ error: String(e) })
        }
      })
    },
  }
}

export default defineConfig({ base: './', plugins: [react(), devApi()] })
