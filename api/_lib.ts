// 서버 기능 공통 (Vercel Functions). 파일명이 _ 로 시작하면 주소로 노출되지 않는다.
export interface Req {
  method?: string
  query: Record<string, string | string[] | undefined>
  body?: any
  headers: Record<string, string | string[] | undefined>
}
export interface Res {
  status(code: number): Res
  json(body: unknown): void
  setHeader(name: string, value: string): void
}

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

/** 공통 처리: 접속 암호 확인 + 오류를 { error } 로 응답 */
export function handler(fn: (req: Req) => Promise<unknown>, cacheSeconds = 0) {
  return async (req: Req, res: Res) => {
    try {
      const pass = process.env.APP_PASSCODE
      if (pass && req.headers['x-app-code'] !== encodeURIComponent(pass)) throw new HttpError(401, '접속 암호가 맞지 않습니다. 홈 > 설정에서 입력해 주세요.')
      const data = await fn(req)
      if (cacheSeconds) res.setHeader('Cache-Control', `private, max-age=${cacheSeconds}`)
      res.status(200).json(data)
    } catch (e) {
      const status = e instanceof HttpError ? e.status : 500
      res.status(status).json({ error: e instanceof Error ? e.message : '알 수 없는 오류' })
    }
  }
}

export const q = (req: Req, name: string) => {
  const v = req.query[name]
  return (Array.isArray(v) ? v[0] : v) ?? ''
}

export const decodeXml = (s: string) =>
  s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .trim()
export const xmlItems = (xml: string) => xml.match(/<item>[\s\S]*?<\/item>/g) ?? []
export const xmlTag = (xml: string, name: string) => {
  const m = xml.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`))
  return m ? decodeXml(m[1]) : ''
}

// ── 제미나이: 키 여러 개를 순서대로 사용 ───────────────────
// GEMINI_API_KEYS="키1,키2,키3"  → 한도를 다 쓴 키(429)는 잠시 건너뛰고 다음 키를 쓴다.
const blockedUntil = new Map<string, number>()

export type Part = { text: string } | { inline_data: { mime_type: string; data: string } }

/** dataURL(사진) → 제미나이 입력 */
export function imagePart(dataUrl: string): Part {
  const m = /^data:(image\/[\w.+-]+);base64,(.+)$/.exec(dataUrl)
  if (!m) throw new HttpError(400, '이미지 형식이 올바르지 않습니다')
  return { inline_data: { mime_type: m[1], data: m[2] } }
}

export async function gemini<T>(parts: Part[]): Promise<T> {
  const keys = (process.env.GEMINI_API_KEYS ?? '').split(',').map((s) => s.trim()).filter(Boolean)
  if (!keys.length) throw new HttpError(503, 'AI 키가 설정되지 않았습니다 (GEMINI_API_KEYS)')
  const model = process.env.GEMINI_MODEL || 'gemini-flash-latest'
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`
  const body = JSON.stringify({ contents: [{ parts }], generationConfig: { responseMimeType: 'application/json', temperature: 0.2 } })

  const now = Date.now()
  const free = keys.filter((k) => (blockedUntil.get(k) ?? 0) <= now)
  // 모두 막혀 있으면 그래도 한 번씩은 다시 시도한다
  const order = free.length ? free : keys
  let last = ''
  for (const key of order) {
    const n = keys.indexOf(key) + 1
    let r: Response
    try {
      r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key }, body })
    } catch {
      last = `키 ${n}: 연결 실패`
      continue
    }
    if (r.ok) {
      const j = (await r.json()) as any
      const text: string = (j.candidates?.[0]?.content?.parts ?? []).map((p: any) => p.text ?? '').join('')
      try {
        return JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, '')) as T
      } catch {
        throw new HttpError(502, 'AI 응답을 해석하지 못했습니다. 다시 시도해 주세요.')
      }
    }
    const msg = await r.text()
    last = `키 ${n}: ${r.status}`
    if (r.status === 429) {
      // 하루 한도면 1시간, 분당 한도면 1분 뒤에 다시 시도
      blockedUntil.set(key, now + (/PerDay/i.test(msg) ? 3600_000 : 60_000))
      continue
    }
    if (r.status === 401 || r.status === 403 || (r.status === 400 && /API key/i.test(msg))) {
      blockedUntil.set(key, now + 3600_000) // 잘못되었거나 막힌 키
      continue
    }
    if (r.status >= 500) continue
    throw new HttpError(502, `AI 요청 오류 (${r.status})`)
  }
  throw new HttpError(429, `사용할 수 있는 AI 키가 없습니다. 모든 키의 한도를 다 썼거나 키가 올바르지 않습니다. (${last})`)
}
