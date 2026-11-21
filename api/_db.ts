// 공용 저장소 (Upstash Redis, REST 방식). Vercel > Storage 에서 Upstash Redis 를 추가하면 주소·토큰이 자동으로 들어온다.
// 로컬 개발에서는 저장소가 없으면 메모리에 임시 저장한다.
import { HttpError } from './_lib.js'

const url = () => process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL
const token = () => process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN

type Arg = string | number
const mem: Map<string, any> = ((globalThis as any).__devdb ??= new Map())

function memory([cmd, key, ...a]: Arg[]): any {
  const k = String(key)
  const list = (): string[] => mem.get(k) ?? (mem.set(k, []), mem.get(k))
  const hash = (): Record<string, string> => mem.get(k) ?? (mem.set(k, {}), mem.get(k))
  const set = (): Set<string> => mem.get(k) ?? (mem.set(k, new Set()), mem.get(k))
  switch (String(cmd).toUpperCase()) {
    case 'GET': return mem.get(k) ?? null
    case 'SET': return mem.set(k, String(a[0])), 'OK'
    case 'DEL': return mem.delete(k) ? 1 : 0
    case 'LPUSH': return list().unshift(...a.map(String).reverse()), list().length
    case 'RPUSH': return list().push(...a.map(String)), list().length
    case 'LRANGE': { const l = list(); const e = Number(a[1]); return l.slice(Number(a[0]), e < 0 ? l.length + e + 1 : e + 1) }
    case 'LTRIM': { const l = list(); const e = Number(a[1]); return mem.set(k, l.slice(Number(a[0]), e < 0 ? l.length + e + 1 : e + 1)), 'OK' }
    case 'LREM': return mem.set(k, list().filter((v) => v !== String(a[1]))), 1
    case 'HSET': return (hash()[String(a[0])] = String(a[1])), 1
    case 'HGET': return hash()[String(a[0])] ?? null
    case 'HDEL': return delete hash()[String(a[0])], 1
    case 'HGETALL': return Object.entries(hash()).flat()
    case 'SADD': return a.forEach((v) => set().add(String(v))), a.length
    case 'SMEMBERS': return [...set()]
    case 'SCARD': return set().size
    default: throw new Error(`개발용 저장소가 모르는 명령: ${cmd}`)
  }
}

export async function redis<T = any>(...cmd: Arg[]): Promise<T> {
  if (!url() || !token()) {
    if (process.env.VERCEL) throw new HttpError(503, '저장소가 연결되지 않았습니다. Vercel > Storage 에서 Upstash Redis 를 추가해 주세요.')
    return memory(cmd)
  }
  const r = await fetch(url()!, { method: 'POST', headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' }, body: JSON.stringify(cmd) })
  const j = (await r.json().catch(() => null)) as any
  if (!r.ok || !j || j.error) throw new HttpError(502, `저장소 오류: ${j?.error ?? r.status}`)
  return j.result as T
}

const parse = <T>(s: string | null): T | null => {
  try {
    return s ? (JSON.parse(s) as T) : null
  } catch {
    return null
  }
}
export const getJ = async <T>(key: string) => parse<T>(await redis<string | null>('GET', key))
export const setJ = (key: string, v: unknown) => redis('SET', key, JSON.stringify(v))
export const hgetJ = async <T>(key: string, field: string) => parse<T>(await redis<string | null>('HGET', key, field))
export const hsetJ = (key: string, field: string, v: unknown) => redis('HSET', key, field, JSON.stringify(v))
export async function hallJ<T>(key: string): Promise<Record<string, T>> {
  const flat = (await redis<string[]>('HGETALL', key)) ?? []
  const out: Record<string, T> = {}
  for (let i = 0; i < flat.length; i += 2) {
    const v = parse<T>(flat[i + 1])
    if (v !== null) out[flat[i]] = v
  }
  return out
}
/** 목록 맨 앞에 넣고 max 개까지만 남긴다 */
export async function unshiftJ(key: string, v: unknown, max = 500) {
  await redis('LPUSH', key, JSON.stringify(v))
  await redis('LTRIM', key, 0, max - 1)
}
export const pushJ = (key: string, v: unknown) => redis('RPUSH', key, JSON.stringify(v))
export const listJ = async <T>(key: string, start = 0, stop = -1) => ((await redis<string[]>('LRANGE', key, start, stop)) ?? []).map((s) => parse<T>(s)).filter((v): v is T => v !== null)

export const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 10)
export const idOk = (s: unknown): s is string => typeof s === 'string' && /^[a-z0-9]{12,40}$/.test(s)

/** 사진(dataURL)을 저장하고 주소(/api/img?id=)를 돌려준다 */
export async function saveImage(dataUrl: string) {
  if (!/^data:image\/(jpeg|png|webp);base64,/.test(dataUrl)) throw new HttpError(400, '이미지 형식이 올바르지 않습니다')
  if (dataUrl.length > 900_000) throw new HttpError(400, '이미지가 너무 큽니다')
  const id = newId()
  await redis('SET', `img:${id}`, dataUrl)
  return `/api/img?id=${id}`
}
