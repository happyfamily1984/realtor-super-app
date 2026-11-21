// 매일 받는 네이버 매물 (뉴스파인더 저장소의 수집 결과, 읽기 전용). 꼴 설명은 그 저장소의 docs/my-data.md.
// 여기서는 두 가지에만 쓴다: 메인 단지 목록, 그리고 내 매물과 비슷한 광고가 올라왔는지 확인.
import { useEffect, useState } from 'react'
import { DEFAULT_MAIN, matchMain, type MainComplex } from '../data/main'
import type { Property } from '../data/property'

const URL = 'https://raw.githubusercontent.com/happyfamily1984/real-estate-news-finder/store/main/my.json'

export interface NaverItem {
  type: 'trade' | 'jeonse' | 'monthly'
  area: number
  price: number // 만원
  priceMax: number
  rent: number
  floor: string // "9/15" 또는 "고/15"
  dong: string // "303동"
  direction: string
  memo: string
  confirmedAt: string
  articleNo: string // 대부분 비어 있음
}
export interface NaverComplex {
  id: string
  name: string
  kind: 'apt' | 'offi'
  aptNm?: string
  listings: { capturedAt: string; total: number; items: NaverItem[] } | null
}
export interface NaverDaily {
  generatedAt: string
  complexes: NaverComplex[]
}

let mem: NaverDaily | null = null
let pending: Promise<NaverDaily> | null = null
export function loadNaverDaily(): Promise<NaverDaily> {
  if (mem) return Promise.resolve(mem)
  pending ??= fetch(`${URL}?t=${Math.floor(Date.now() / 600_000)}`)
    .then((r) => {
      if (!r.ok) throw new Error(`네이버 매물 자료를 받지 못했습니다 (${r.status})`)
      return r.json() as Promise<NaverDaily>
    })
    .then((d) => (mem = d))
    .finally(() => (pending = null))
  return pending
}
export function useNaverDaily() {
  const [data, setData] = useState<NaverDaily | null>(mem)
  useEffect(() => {
    let alive = true
    loadNaverDaily()
      .then((d) => alive && setData(d))
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [])
  return data
}

/** 메인 단지 목록: 수집 결과에 들어 있는 단지 (국토부 이름을 다른 이름으로 함께 둔다) */
export async function loadMainConfig(): Promise<MainComplex[]> {
  const d = await loadNaverDaily()
  return d.complexes.map((c) => {
    const base = DEFAULT_MAIN.find((m) => m.name === c.name)
    return { id: c.id, name: c.name, kind: c.kind === 'offi' ? '오피스텔' : '아파트', aliases: [...new Set([...(base?.aliases ?? []), ...(c.aptNm ? [c.aptNm] : [])])] }
  })
}

const TYPE = { 매매: 'trade', 전세: 'jeonse', 월세: 'monthly' } as const
const digits = (s: string) => s.replace(/\D/g, '')
/** 층을 저·중·고로 (전체 층을 알 때만) */
function band(floor: number, total: number) {
  if (!floor || !total) return ''
  const r = floor / total
  return r <= 1 / 3 ? '저' : r <= 2 / 3 ? '중' : '고'
}

export interface Similar {
  item: NaverItem
  sure: boolean // 동과 층 숫자까지 같으면 true. 층이 '고/15'처럼만 나오면 추정
  key: string
}

/**
 * 내 매물과 비슷한 네이버 광고. 호수가 없어 같은 집이라고 단정할 수는 없고,
 * 같은 단지에서 거래 종류·면적·동·층·가격이 비슷한 것을 찾는 수준이다.
 */
export function similarAds(p: Property, data: NaverDaily | null, main: MainComplex[]): Similar[] {
  if (!data) return []
  const m = matchMain(p.complex, main)
  const c = data.complexes.find((x) => (m?.id && x.id === m.id) || x.name === m?.name)
  if (!c?.listings) return []
  const type = TYPE[p.deal]
  const area = Math.round(p.exclusiveArea)
  const floor = parseInt(p.floor) || 0
  const total = parseInt(p.totalFloors) || 0
  const out: Similar[] = []
  for (const i of c.listings.items) {
    if (i.type !== type) continue
    if (p.articleNo && i.articleNo === p.articleNo) continue // 우리 광고
    if (area && Math.abs(i.area - area) > 1) continue
    const myDong = digits(p.dongNo)
    const itDong = digits(i.dong)
    if (myDong && itDong && myDong !== itDong) continue
    const lo = Math.min(i.price, i.priceMax || i.price)
    const hi = Math.max(i.price, i.priceMax || i.price)
    if (p.price && (hi < p.price * 0.9 || lo > p.price * 1.1)) continue
    if (type === 'monthly' && p.rent && i.rent && Math.abs(i.rent - p.rent) > Math.max(10, p.rent * 0.15)) continue
    const [f, t] = i.floor.split('/')
    const exactFloor = /^\d+$/.test(f)
    if (floor) {
      if (exactFloor && +f !== floor) continue
      if (!exactFloor && f && band(floor, total || +t || 0) && band(floor, total || +t || 0) !== f[0]) continue
    }
    out.push({ item: i, sure: exactFloor && !!floor && !!myDong && !!itDong, key: `${c.id}|${i.type}|${i.area}|${i.dong}|${i.floor}|${i.price}|${i.rent}` })
  }
  return out
}
