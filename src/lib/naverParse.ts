// PC 북마클릿(매물 수집기)이 저장한 파일 → 앱 매물 형식
// 네이버 화면이 주고받은 응답을 그대로 담은 파일이므로, 형식이 달라도 최대한 알아보도록 필드 이름 후보를 넓게 잡는다.
import type { Deal, Kind, Listing } from '../data/sample'
import { today, uid } from './util'

export interface CollectorFile {
  source?: string
  responses?: { url: string; data: unknown }[]
  pageText?: string
}

type Flat = Record<string, unknown>

/** 중첩 객체를 소문자 키의 한 단계 객체로 (바깥쪽 값 우선) */
function flatten(o: Record<string, unknown>, out: Flat = {}, depth = 0): Flat {
  const nested: Record<string, unknown>[] = []
  for (const [k, v] of Object.entries(o)) {
    if (v && typeof v === 'object') {
      if (!Array.isArray(v)) nested.push(v as Record<string, unknown>)
    } else if (!(k.toLowerCase() in out)) out[k.toLowerCase()] = v
  }
  if (depth < 4) nested.forEach((n) => flatten(n, out, depth + 1))
  return out
}
const pick = (f: Flat, ...keys: string[]) => {
  for (const k of keys) if (f[k] !== undefined && f[k] !== null && f[k] !== '') return f[k]
  return undefined
}

/** "12억 5,000" · 125000(만원) · 1250000000(원) → 만원 */
export function parsePrice(v: unknown): number {
  if (typeof v === 'number') return v >= 1e7 ? Math.round(v / 1e4) : v
  if (typeof v !== 'string') return 0
  const s = v.replace(/[,\s만원]/g, '')
  const m = /^(?:(\d+(?:\.\d+)?)억)?(\d+)?$/.exec(s)
  if (!m || (!m[1] && !m[2])) return 0
  const n = Math.round(parseFloat(m[1] || '0') * 10000) + parseInt(m[2] || '0')
  return !m[1] && n >= 1e7 ? Math.round(n / 1e4) : n
}

function toDeal(v: unknown): Deal | null {
  const s = String(v ?? '')
  if (/매매|^A1$/.test(s)) return '매매'
  if (/전세|^B1$/.test(s)) return '전세'
  if (/월세|단기|^B2$|^B3$/.test(s)) return '월세'
  return null
}
function toKind(v: unknown): Kind {
  const s = String(v ?? '')
  if (/오피스텔|OPST/.test(s)) return '오피스텔'
  if (/상가|사무실|점포|건물|공장|창고|지식산업|^(SG|SMS|GM|TJ|APTHGJ|GJCG)$/.test(s)) return '상가'
  if (/빌라|연립|다세대|단독|다가구|원룸|주택|한옥|^(VL|DDDGG|JWJT|SGJT|OR|HOJT)$/.test(s)) return '빌라'
  return '아파트'
}
const DIRS: Record<string, string> = { S: '남향', N: '북향', E: '동향', W: '서향', SE: '남동향', SW: '남서향', NE: '북동향', NW: '북서향', ES: '남동향', WS: '남서향', EN: '북동향', WN: '북서향' }
function toDate(v: unknown): string {
  const d = String(v ?? '').replace(/\D/g, '')
  if (d.length === 8) return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6)}`
  if (d.length === 6) return `20${d.slice(0, 2)}-${d.slice(2, 4)}-${d.slice(4)}`
  return today()
}

function toListing(o: Record<string, unknown>): Listing | null {
  const f = flatten(o)
  const deal = toDeal(pick(f, 'tradetypename', 'tradtpnm', 'tradetype', 'tradtpcd', 'tradetypecode'))
  if (!deal) return null
  const name = pick(f, 'articlename', 'atclnm', 'complexname', 'aptname')
  if (!name) return null
  const priceKeys = deal === '매매' ? ['dealorwarrantprc', 'prc', 'dealprice', 'hanprc'] : ['dealorwarrantprc', 'prc', 'warrantyprice', 'warrantprice', 'depositprice', 'deposit', 'hanprc']
  const price = parsePrice(pick(f, ...priceKeys))
  if (!price) return null
  const bld = String(pick(f, 'buildingname', 'bildnm', 'dongname') ?? '')
  const complex = bld && !String(name).includes(bld) ? `${name} ${bld}` : String(name)
  const dir = String(pick(f, 'direction') ?? '')
  const rent = deal === '월세' ? parsePrice(pick(f, 'rentprc', 'rentprice', 'monthlyrent')) : 0
  const area = Math.round(Number(pick(f, 'area2', 'spc2', 'exclusivespace', 'exclusivearea', 'area1', 'spc1', 'supplyspace')) || 0)
  const floor = String(pick(f, 'floorinfo', 'flrinfo') ?? '-')
  const id = pick(f, 'articleno', 'atclno', 'articlenumber', 'articleid')
  return {
    key: id ? `id:${id}` : `${complex}|${deal}|${area}|${floor}`,
    group: String(name),
    id: uid(),
    complex,
    kind: toKind(pick(f, 'realestatetypename', 'rlettpnm', 'realestatetype', 'rlettpcd', 'realestatetypecode')),
    deal,
    price,
    rent: rent || undefined,
    area,
    floor: floor.includes('/') ? `${floor}층` : floor,
    dir: DIRS[dir.toUpperCase()] ?? (dir || '-'),
    desc: String(pick(f, 'articlefeaturedesc', 'atclfetrdesc', 'articlefeaturedescription', 'featuredescription') ?? ''),
    date: toDate(pick(f, 'articleconfirmymd', 'atclcfmymd', 'articleconfirmdate', 'confirmdate')),
    src: 'import',
  }
}

/** 수집 파일에서 매물을 찾아 중복 없이 돌려준다 */
export function parseCollectorFile(file: CollectorFile): Listing[] {
  const found = new Map<string, Listing>()
  const walk = (d: unknown, depth: number) => {
    if (!d || typeof d !== 'object' || depth > 8) return
    if (Array.isArray(d)) {
      for (const el of d) {
        if (!el || typeof el !== 'object') continue
        if (Array.isArray(el)) {
          walk(el, depth + 1)
          continue
        }
        const l = toListing(el as Record<string, unknown>)
        if (l) {
          if (!found.has(l.key!)) found.set(l.key!, l)
        } else walk(el, depth + 1)
      }
      return
    }
    Object.values(d).forEach((v) => walk(v, depth + 1))
  }
  ;(file.responses ?? []).forEach((r) => walk(r.data, 0))
  return [...found.values()]
}

export interface MergeResult {
  list: Listing[]
  added: number
  changed: number
  gone: number
}

/** 새로 수집한 매물을 기존 기록에 합친다: 신규·가격 변동·사라진 매물을 표시 */
export function mergeListings(old: Listing[], incoming: Listing[]): MergeResult {
  const t = today()
  const prev = old.filter((l) => l.src) // 샘플은 버린다
  const keyOf = (l: Listing) => l.key ?? l.id
  const groupOf = (l: Listing) => l.group ?? l.complex
  const byKey = new Map(prev.map((l) => [keyOf(l), l]))
  const knownGroups = new Set(prev.map(groupOf))
  const groups = new Set(incoming.map(groupOf))
  const seen = new Set<string>()
  const list: Listing[] = []
  let added = 0
  let changed = 0
  let gone = 0
  for (const n of incoming) {
    const k = keyOf(n)
    if (seen.has(k)) continue
    seen.add(k)
    const o = byKey.get(k)
    if (!o) {
      added++
      list.push({ ...n, firstSeen: t, lastSeen: t, newAt: knownGroups.has(groupOf(n)) ? t : undefined })
      continue
    }
    const moved = o.price !== n.price || (o.rent ?? 0) !== (n.rent ?? 0)
    if (moved) changed++
    list.push({ ...n, id: o.id, firstSeen: o.firstSeen ?? o.date, lastSeen: t, newAt: o.newAt, prevPrice: moved ? o.price : o.prevPrice, changedAt: moved ? t : o.changedAt, gone: undefined })
  }
  for (const o of prev) {
    if (seen.has(keyOf(o))) continue
    // 이번에 다시 수집한 단지인데 목록에 없으면 사라진 매물
    if (groups.has(groupOf(o)) && !o.gone) {
      gone++
      list.push({ ...o, gone: t })
    } else list.push(o)
  }
  return { list, added, changed, gone }
}

import code from './collector.js?raw'
/** 즐겨찾기에 넣는 매물 수집기 주소 */
export const BOOKMARKLET = 'javascript:' + encodeURIComponent(code)
