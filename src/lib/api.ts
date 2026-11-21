// 서버 기능(/api/*) 호출. 키는 서버에만 있고 앱에는 없다.
import type { Settings } from '../data/sample'

function passcode() {
  try {
    return (JSON.parse(localStorage.getItem('settings') || '{}') as Partial<Settings>).passcode ?? ''
  } catch {
    return ''
  }
}

export async function api<T>(path: string, body?: unknown): Promise<T> {
  let r: Response
  try {
    r = await fetch(`/api/${path}`, {
      method: body ? 'POST' : 'GET',
      headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), 'x-app-code': encodeURIComponent(passcode()) },
      body: body ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new Error('서버에 연결하지 못했습니다')
  }
  const j = await r.json().catch(() => null)
  if (!j) throw new Error('서버 기능이 연결되지 않았습니다')
  if (!r.ok) throw new Error(j.error ?? `서버 오류 (${r.status})`)
  return j as T
}
