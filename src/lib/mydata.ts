// 메인 단지 자료 (수집기가 3시간마다 만드는 my.json). 형식은 main 브랜치의 docs/my-data.md 참고.
// 금액 단위: 실거래·매물은 만원, 경매는 원.
import { useEffect, useState } from 'react'
import type { MainComplex } from '../data/main'
import type { Deal, Listing } from '../data/sample'
import { won } from './util'

const RAW = 'https://raw.githubusercontent.com/happyfamily1984/realtor-super-app'
const DATA_URL = `${RAW}/store/main/my.json`
const CONFIG_URL = `${RAW}/main/config/main-complexes.json`

export interface MyPost {
  title: string
  summary: string
  thread: string
  talk: string
  blog: { title: string; body: string; tags: string[] }
  cards: { title: string; points: string[] }[]
  sources: string[]
}
export interface MyArea {
  area: number
  trade?: { count3: number; median3: number; count12: number; median12: number; min12: number; max12: number; changePct?: number; high?: { price: number; date: string; floor: number }; last?: { price: number; date: string; floor: number } }
  jeonse?: { count12: number; median12: number; median3?: number }
  monthly?: { count12: number; medianDeposit: number; medianRent: number }
  jeonseRate?: number
}
export type ItemType = 'trade' | 'jeonse' | 'monthly'
export interface MyItem {
  type: ItemType
  area: number
  price: number
  priceMax: number
  rent: number
  floor: string
  dong: string
  direction: string
  memo: string
  confirmedAt: string
  articleNo: string
  suspect: boolean
}
export interface MyListings {
  capturedAt: string
  daysOld: number
  stale: boolean
  total: number
  suspects: number
  rows: { type: ItemType; area: number; count: number; min: number; median: number; max: number; medianRent: number; dealMedian?: number; dealBasis?: string; gapPct?: number }[]
  items: MyItem[]
}
export interface MyDeal {
  type: ItemType
  date: string
  area: number
  floor: number
  price: number
  deposit: number
  monthlyRent: number
  canceled: boolean
}
export interface MyComplex {
  id: string
  name: string
  kind: 'apt' | 'offi'
  aptNm: string
  buildYear?: number
  umdNm: string
  jibun: string
  hasData: boolean
  counts: { trade12: number; tradePrev: number; jeonse12: number; monthly12: number; canceled12: number }
  areas: MyArea[]
  recentTrades: MyDeal[]
  recentRents: MyDeal[]
  insights: string[]
  listings: MyListings | null
  auctionCount: number
  post: MyPost | null
}
export interface MyAuction {
  id: string
  complexId: string
  complexName: string
  caseNo: string
  court: string
  dept: string
  tel: string
  caseName: string
  address: string
  unit: string
  area: number
  usage: string
  appraisal: number
  minPrice: number
  minRate: number
  failCount: number
  saleDate: string
  saleTime: string
  place: string
  decisionDate: string
  claim: number
  rights: string
  topPriority: string
  specRemark: string
  remark: string
  landShare: string
  appraisalNotes: string[]
  gone: boolean
  post: MyPost | null
}
export interface MyData {
  generatedAt: string
  today: string
  court: string
  notes: string[]
  complexes: MyComplex[]
  auctions: MyAuction[]
}

export const TYPE_LABEL: Record<ItemType, Deal> = { trade: '매매', jeonse: '전세', monthly: '월세' }
/** 경매 금액(원) → "3억 8,300" */
export const wonOf = (v: number) => won(Math.round(v / 10000))
export const itemPrice = (i: MyItem) => {
  const p = i.priceMax && i.priceMax !== i.price ? `${won(i.price)}~${won(i.priceMax)}` : won(i.price)
  return i.type === 'monthly' ? `${p} / ${i.rent}만` : p
}

// 10분 단위로 새로 받는다 (캐시 피하기)
const stamp = () => Math.floor(Date.now() / 600_000)
let mem: MyData | null = null
let pending: Promise<MyData> | null = null

function fetchMy(): Promise<MyData> {
  pending ??= fetch(`${DATA_URL}?t=${stamp()}`)
    .then((r) => {
      if (!r.ok) throw new Error(`메인 단지 자료를 받지 못했습니다 (${r.status})`)
      return r.json() as Promise<MyData>
    })
    .then((d) => {
      mem = d
      try {
        // 다음에 열 때 바로 보이도록 보관 (매물 하나하나는 커서 빼고 요약만)
        localStorage.setItem('mydata', JSON.stringify({ ...d, complexes: d.complexes.map((c) => ({ ...c, listings: c.listings && { ...c.listings, items: [] } })) }))
      } catch {
        /* 저장 공간 부족은 무시 */
      }
      return d
    })
    .finally(() => setTimeout(() => (pending = null), 600_000))
  return pending
}

/** 메인 단지 자료. 보관해 둔 것을 먼저 보여 주고 새로 받아 바꾼다. */
export function useMyData() {
  const [data, setData] = useState<MyData | null>(() => {
    if (mem) return mem
    try {
      return JSON.parse(localStorage.getItem('mydata') || 'null')
    } catch {
      return null
    }
  })
  const [error, setError] = useState('')
  useEffect(() => {
    let alive = true
    fetchMy()
      .then((d) => alive && (setData(d), setError('')))
      .catch((e) => alive && setError(e instanceof Error ? e.message : '메인 단지 자료를 받지 못했습니다'))
    return () => {
      alive = false
    }
  }, [])
  return { data, error }
}

/** 수집기 설정 파일의 메인 단지 목록 (앱과 수집기가 같은 목록을 쓴다) */
export async function loadMainConfig(): Promise<MainComplex[]> {
  const r = await fetch(`${CONFIG_URL}?t=${stamp()}`)
  if (!r.ok) throw new Error(`단지 목록을 받지 못했습니다 (${r.status})`)
  const j = (await r.json()) as { complexes: { id: string; name: string; kind: string; aliases?: string[] }[] }
  return j.complexes.map((c) => ({ id: c.id, name: c.name, kind: c.kind === 'offi' ? '오피스텔' : '아파트', aliases: c.aliases ?? [] }))
}

/** 수집기의 네이버 매물을 앱의 매물 형식으로 (손님 맞춤 추천·제안서에 쓴다) */
export function myListings(data: MyData | null): Listing[] {
  if (!data) return []
  return data.complexes.flatMap((c) =>
    (c.listings?.items ?? []).map<Listing>((i, n) => ({
      id: `my-${c.id}-${n}`,
      key: `my-${c.id}-${n}`,
      complex: i.dong ? `${c.name} ${i.dong}` : c.name,
      group: c.name,
      kind: c.kind === 'offi' ? '오피스텔' : '아파트',
      deal: TYPE_LABEL[i.type],
      price: i.price,
      rent: i.type === 'monthly' ? i.rent : undefined,
      area: Math.round(i.area),
      floor: i.floor ? `${i.floor}층` : '-',
      dir: i.direction || '-',
      desc: i.memo,
      date: i.confirmedAt || c.listings!.capturedAt,
      src: 'import',
      articleNo: i.articleNo || undefined,
    })),
  )
}
