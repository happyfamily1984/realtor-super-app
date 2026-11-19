// 국토교통부 아파트 매매 실거래가 → 앱 형식으로 변환
// GET /api/trades?lawd=11440&dong=아현동&months=3
import { handler, HttpError, q, xmlItems, xmlTag } from './_lib.js'

const BASE = 'https://apis.data.go.kr/1613000/RTMSDataSvcAptTrade/getRTMSDataSvcAptTrade'

interface Row {
  id: string
  complex: string
  dong: string
  area: number
  floor: number
  price: number
  prev?: number
  date: string
}

export function parseTrades(xml: string): Row[] {
  return xmlItems(xml)
    .filter((it) => xmlTag(it, 'cdealType') !== 'O') // 계약 해제 건 제외
    .map((it) => {
      const pad = (s: string) => s.padStart(2, '0')
      const date = `${xmlTag(it, 'dealYear')}-${pad(xmlTag(it, 'dealMonth'))}-${pad(xmlTag(it, 'dealDay'))}`
      const complex = xmlTag(it, 'aptNm')
      const areaRaw = parseFloat(xmlTag(it, 'excluUseAr')) || 0
      const floor = parseInt(xmlTag(it, 'floor')) || 0
      const price = parseInt(xmlTag(it, 'dealAmount').replace(/,/g, '')) || 0
      return { id: `${date}-${complex}-${areaRaw}-${floor}-${price}`, complex, dong: xmlTag(it, 'umdNm'), area: Math.round(areaRaw), floor, price, date }
    })
    .filter((r) => r.complex && r.price)
}

/** 같은 단지·같은 면적의 직전 거래가를 붙인다 */
export function withPrev(rows: Row[]): Row[] {
  const asc = [...rows].sort((a, b) => a.date.localeCompare(b.date))
  const lastPrice = new Map<string, number>()
  for (const r of asc) {
    const k = `${r.dong}|${r.complex}|${r.area}`
    if (lastPrice.has(k)) r.prev = lastPrice.get(k)
    lastPrice.set(k, r.price)
  }
  return asc.reverse()
}

/** 시군구의 최근 n개월 아파트 매매 실거래 (최신순, 직전 거래가 포함) */
export async function fetchTrades(lawd: string, months: number) {
  const key = process.env.MOLIT_SERVICE_KEY
  if (!key) throw new HttpError(503, '국토부 실거래가 키가 설정되지 않았습니다 (MOLIT_SERVICE_KEY)')
  if (!/^\d{5}$/.test(lawd)) throw new HttpError(400, '시군구 코드(5자리)를 설정해 주세요')

  const ymds: string[] = []
  const d = new Date(Date.now() + 9 * 3600_000) // 한국 시간
  for (let i = 0; i < months; i++) {
    ymds.push(`${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}`)
    d.setUTCDate(1)
    d.setUTCMonth(d.getUTCMonth() - 1)
  }
  // 인증키는 Decoding/Encoding 어느 쪽을 넣어도 되도록 처리
  const serviceKey = key.includes('%') ? key : encodeURIComponent(key)
  const pages = await Promise.all(
    ymds.map(async (ymd) => {
      const r = await fetch(`${BASE}?serviceKey=${serviceKey}&LAWD_CD=${lawd}&DEAL_YMD=${ymd}&pageNo=1&numOfRows=1000`)
      const xml = await r.text()
      const code = xmlTag(xml, 'resultCode')
      if (!r.ok || (code && !/^0+$/.test(code))) {
        const why = xmlTag(xml, 'returnAuthMsg') || xmlTag(xml, 'resultMsg') || xmlTag(xml, 'errMsg') || `HTTP ${r.status}`
        throw new HttpError(502, `국토부 실거래가 조회 실패: ${why}`)
      }
      return parseTrades(xml)
    }),
  )
  return { rows: withPrev(pages.flat()), months: ymds }
}

export default handler(async (req) => {
  const dong = q(req, 'dong').trim()
  const months = Math.min(6, Math.max(1, parseInt(q(req, 'months')) || 3))
  let { rows, months: ymds } = await fetchTrades(q(req, 'lawd'), months)
  if (dong) rows = rows.filter((r) => r.dong.includes(dong))
  return { trades: rows.slice(0, 300), months: ymds }
}, 1800)
