// 저장된 사진 보여주기  GET /api/img?id=...
import { redis } from './_db.js'

export default async function img(req: { query: Record<string, string | string[] | undefined> }, res: any) {
  const id = String(req.query.id ?? '')
  const data = /^[a-z0-9]{8,40}$/.test(id) ? await redis<string | null>('GET', `img:${id}`).catch(() => null) : null
  const m = data && /^data:(image\/[\w.+-]+);base64,(.+)$/.exec(data)
  if (!m) return res.status(404).json({ error: '사진이 없습니다' })
  res.setHeader('Content-Type', m[1])
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
  res.status(200).send(Buffer.from(m[2], 'base64'))
}
