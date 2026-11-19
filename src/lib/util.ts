import { useEffect, useState } from 'react'

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7)

/** 오늘 기준 n일 뒤(음수면 이전) 날짜 YYYY-MM-DD */
export function dayOffset(n: number) {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return iso(d)
}
export const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
export const today = () => iso(new Date())

/** 오늘부터 해당 날짜까지 남은 일수 */
export function daysUntil(date: string) {
  const a = new Date(today() + 'T00:00:00').getTime()
  const b = new Date(date + 'T00:00:00').getTime()
  return Math.round((b - a) / 86400000)
}
export function dday(date: string) {
  const n = daysUntil(date)
  return n === 0 ? 'D-DAY' : n > 0 ? `D-${n}` : `D+${-n}`
}
export function shortDate(date: string) {
  const [, m, d] = date.split('-')
  return `${+m}.${+d}`
}
export function koDate(date: string) {
  const d = new Date(date + 'T00:00:00')
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${'일월화수목금토'[d.getDay()]})`
}

/** 만원 단위 금액 → "12억 5,000" */
export function won(v: number) {
  if (!v) return '0'
  const eok = Math.floor(v / 10000)
  const rest = v % 10000
  if (eok === 0) return `${rest.toLocaleString()}만`
  return rest ? `${eok}억 ${rest.toLocaleString()}` : `${eok}억`
}

export function usePersist<T>(key: string, init: T) {
  const [v, setV] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key)
      return raw ? (JSON.parse(raw) as T) : init
    } catch {
      return init
    }
  })
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(v))
    } catch {
      /* 저장 공간 부족 등은 무시 */
    }
  }, [key, v])
  return [v, setV] as const
}

// ── 토스트 ─────────────────────────────────────────
export function toast(msg: string) {
  window.dispatchEvent(new CustomEvent('app-toast', { detail: msg }))
}

// ── 사진 보관 (IndexedDB) ──────────────────────────
function db(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const r = indexedDB.open('realtor-app', 1)
    r.onupgradeneeded = () => r.result.createObjectStore('photos')
    r.onsuccess = () => res(r.result)
    r.onerror = () => rej(r.error)
  })
}
async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>) {
  const d = await db()
  return new Promise<T>((res, rej) => {
    const r = fn(d.transaction('photos', mode).objectStore('photos'))
    r.onsuccess = () => res(r.result)
    r.onerror = () => rej(r.error)
  })
}
export const photoPut = (id: string, dataUrl: string) => tx('readwrite', (s) => s.put(dataUrl, id))
export const photoGet = (id: string) => tx<string | undefined>('readonly', (s) => s.get(id))
export const photoDel = (id: string) => tx('readwrite', (s) => s.delete(id))

/** 촬영한 사진을 긴 변 1600px JPEG 로 줄여서 dataURL 로 */
export async function shrinkImage(file: File, max = 1600): Promise<string> {
  const url = URL.createObjectURL(file)
  try {
    return await shrinkSrc(url, max, 0.82)
  } finally {
    URL.revokeObjectURL(url)
  }
}

/** 이미지 주소(dataURL 포함)를 긴 변 max px JPEG 로 */
export async function shrinkSrc(src: string, max: number, quality: number): Promise<string> {
  const img = new Image()
  img.src = src
  await img.decode()
  const k = Math.min(1, max / Math.max(img.width, img.height))
  const c = document.createElement('canvas')
  c.width = Math.round(img.width * k)
  c.height = Math.round(img.height * k)
  c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height)
  return c.toDataURL('image/jpeg', quality)
}

export function downloadDataUrl(dataUrl: string, name: string) {
  const a = document.createElement('a')
  a.href = dataUrl
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
}
