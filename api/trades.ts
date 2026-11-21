// 국토교통부 실거래가 (아파트·오피스텔, 매매·전월세) → 앱 형식으로 변환
// GET /api/trades?lawd=41173&dong=관양동&months=6
import { handler, HttpError, q, xmlItems, xmlTag } from './_lib.js'

const API = 'https://apis.data.go.kr/1613000'
/** 종류별 조회 주소. 공공데이터포털에서 각각 활용 신청이 되어 있어야 한다. */
const SERVICES = {
  aptTrade: { path: 'RTMSDataSvcAptTrade/getRTMSDataSvcAptTrade', kind: '아파트', label: '아파트 매매' },
  offiTrade: { path: 'RTMSDataSvcOffiTrade/getRTMSDataSvcOffiTrade', kind: '오피스텔', label: '오피스텔 매매' },
  aptRent: { path: 'RTMSDataSvcAptRent/getRTMSDataSvcAptRent', kind: '아파트', label: '아파트 전월세' },
  offiRent: { path: 'RTMSDataSvcOffiRent/getRTMSDataSvcOffiRent', kind: '오피스텔', label: '오피스텔 전월세' },
} as const
type Service = keyof typeof SERVICES

export interface Row {
  id: string
  kind: '아파트' | '오피스텔'
  complex: string
  dong: string
  jibun?: string // 지번 (같은 이름의 단지를 구분할 때 쓴다)
  area: number
  floor: number
  price: number // 매매가 또는 보증금 (만원)
  rent?: number // 월세 (만원). 전월세 자료에만 있고 0 이면 전세
  prev?: number
  date: string
}

const money = (s: string) => parseInt(s.replace(/[,\s]/g, '')) || 0

export function parseRows(xml: string, service: Service): Row[] {
  const { kind } = SERVICES[service]
  const isRent = service.endsWith('Rent')
  return xmlItems(xml)
    .filter((it) => xmlTag(it, 'cdealType') !== 'O') // 계약 해제 건 제외
    .map((it) => {
      const pad = (s: string) => s.padStart(2, '0')
      const date = `${xmlTag(it, 'dealYear')}-${pad(xmlTag(it, 'dealMonth'))}-${pad(xmlTag(it, 'dealDay'))}`
      const complex = xmlTag(it, 'aptNm') || xmlTag(it, 'offiNm')
      const areaRaw = parseFloat(xmlTag(it, 'excluUseAr')) || 0
      const floor = parseInt(xmlTag(it, 'floor')) || 0
      const price = money(isRent ? xmlTag(it, 'deposit') : xmlTag(it, 'dealAmount'))
      const rent = isRent ? money(xmlTag(it, 'monthlyRent')) : undefined
      // 아파트 매매는 예전부터 쓰던 id 형식을 유지한다 (이미 본 거래 기록과 맞아야 한다)
      const id = `${service === 'aptTrade' ? '' : `${service}-`}${date}-${complex}-${areaRaw}-${floor}-${price}${isRent ? `-${rent}` : ''}`
      return { id, kind, complex, dong: xmlTag(it, 'umdNm'), jibun: xmlTag(it, 'jibun') || undefined, area: Math.round(areaRaw), floor, price, rent, date }
    })
    .filter((r) => r.complex && (r.price || r.rent))
}
/** 예전 이름 (아파트 매매) */
export const parseTrades = (xml: string) => parseRows(xml, 'aptTrade')

/** 같은 단지·같은 면적의 직전 거래가를 붙인다 (최신순으로 돌려준다) */
export function withPrev(rows: Row[]): Row[] {
  const asc = [...rows].sort((a, b) => a.date.localeCompare(b.date))
  const lastPrice = new Map<string, number>()
  for (const r of asc) {
    const k = `${r.kind}|${r.dong}|${r.complex}|${r.area}`
    if (lastPrice.has(k)) r.prev = lastPrice.get(k)
    lastPrice.set(k, r.price)
  }
  return asc.reverse()
}

function recentMonths(n: number) {
  const out: string[] = []
  const d = new Date(Date.now() + 9 * 3600_000) // 한국 시간
  for (let i = 0; i < n; i++) {
    out.push(`${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}`)
    d.setUTCDate(1)
    d.setUTCMonth(d.getUTCMonth() - 1)
  }
  return out
}

/** 한 종류의 최근 n개월 자료 */
export async function fetchService(service: Service, lawd: string, months: number): Promise<Row[]> {
  const key = process.env.MOLIT_SERVICE_KEY
  if (!key) throw new HttpError(503, '국토부 실거래가 키가 설정되지 않았습니다 (MOLIT_SERVICE_KEY)')
  if (!/^\d{5}$/.test(lawd)) throw new HttpError(400, '시군구 코드(5자리)를 설정해 주세요')
  // 인증키는 Decoding/Encoding 어느 쪽을 넣어도 되도록 처리
  const serviceKey = key.includes('%') ? key : encodeURIComponent(key)
  const pages = await Promise.all(
    recentMonths(months).map(async (ymd) => {
      const r = await fetch(`${API}/${SERVICES[service].path}?serviceKey=${serviceKey}&LAWD_CD=${lawd}&DEAL_YMD=${ymd}&pageNo=1&numOfRows=1000`)
      const xml = await r.text()
      const code = xmlTag(xml, 'resultCode')
      if (!r.ok || (code && !/^0+$/.test(code))) {
        const why = xmlTag(xml, 'returnAuthMsg') || xmlTag(xml, 'resultMsg') || xmlTag(xml, 'errMsg') || `HTTP ${r.status}`
        throw new HttpError(502, `${SERVICES[service].label} 조회 실패: ${why}`)
      }
      return parseRows(xml, service)
    }),
  )
  return pages.flat()
}

/** 여러 종류를 함께 조회. 일부가 실패해도(활용 신청이 안 된 경우 등) 나머지는 돌려주고, 실패 이유를 함께 알려준다. */
export async function fetchMany(services: Service[], lawd: string, months: number) {
  const res = await Promise.allSettled(services.map((s) => fetchService(s, lawd, months)))
  const rows: Row[] = []
  const errors: string[] = []
  res.forEach((r, i) => {
    if (r.status === 'fulfilled') rows.push(...r.value)
    else errors.push(r.reason instanceof Error ? r.reason.message : `${SERVICES[services[i]].label} 조회 실패`)
  })
  if (errors.length === services.length) throw new HttpError(502, errors[0])
  return { rows, errors }
}

/** 매매 실거래 (아파트 + 오피스텔), 직전 거래가 포함 */
export async function fetchTrades(lawd: string, months: number) {
  const { rows, errors } = await fetchMany(['aptTrade', 'offiTrade'], lawd, months)
  return { rows: withPrev(rows), errors, months: recentMonths(months) }
}

export default handler(async (req) => {
  const lawd = q(req, 'lawd')
  const dong = q(req, 'dong').trim()
  const months = Math.min(6, Math.max(1, parseInt(q(req, 'months')) || 3))
  const [sale, lease] = await Promise.allSettled([fetchTrades(lawd, months), fetchMany(['aptRent', 'offiRent'], lawd, Math.min(months, 3))])
  if (sale.status === 'rejected') throw sale.reason
  const inDong = (r: Row) => !dong || r.dong.includes(dong)
  const rents = lease.status === 'fulfilled' ? withPrev(lease.value.rows).map(({ prev, ...r }) => r) : []
  return {
    trades: sale.value.rows.filter(inDong),
    rents: rents.filter(inDong),
    months: sale.value.months,
    // 화면에 그대로 보여 줄 안내 (예: 오피스텔 자료 활용 신청이 안 된 경우)
    notes: [...sale.value.errors, ...(lease.status === 'fulfilled' ? lease.value.errors : [lease.reason instanceof Error ? lease.reason.message : '전월세 조회 실패'])],
  }
}, 1800)
