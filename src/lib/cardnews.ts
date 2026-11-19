// 데일리 브리핑 카드뉴스 (1080×1350 PNG). 디자인 체계는 design.ts 참고.
import type { News, Trade } from '../data/sample'
import { C, SERIF, canvas, clip, dateStamp, dotDate, fitText, issueNo, lines, loadFonts, para, parcels, rect, rule, text, width, type Ctx } from './design'
import { daysUntil, shortDate, won } from './util'

const W = 1080
const H = 1350
const M = 84 // 좌우 여백
const R = W - M

export interface CardInput {
  region: string
  office: string
  trades: Trade[]
  news: News[]
  sample: boolean
  insight?: { comment: string; points: string[] } | null
}

export function tradeStats(trades: Trade[]) {
  const week = trades.filter((t) => daysUntil(t.date) >= -30) // 신고 기한(30일)을 감안해 최근 30일 기준
  const avg = week.length ? Math.round(week.reduce((s, t) => s + t.price, 0) / week.length) : 0
  const top = [...week].sort((a, b) => b.price - a.price)[0]
  const up = week.filter((t) => t.prev && t.price > t.prev).length
  const down = week.filter((t) => t.prev && t.price < t.prev).length
  return { week, avg, top, up, down }
}

/** 실거래 데이터로 만든 한 줄 요약 (규칙 기반) */
export function briefingComment(trades: Trade[]) {
  const { week, avg, top, up, down } = tradeStats(trades)
  if (!week.length) return '최근 30일간 신고된 매매 실거래가 없습니다.'
  const mood = up > down ? '상승 거래가 우세합니다' : up < down ? '하락 거래가 우세합니다' : '보합세입니다'
  return `최근 30일 매매 ${week.length}건, 평균 ${won(avg)}. 직전 거래 대비 상승 ${up}건·하락 ${down}건으로 ${mood}. 최고가는 ${top.complex} ${top.area}㎡ ${won(top.price)}.`
}

const sourceLine = (inp: CardInput) => (inp.sample ? '샘플 데이터 (실제 시세 아님)' : '자료 국토교통부 실거래가 공개시스템')

// ── 표지 ─────────────────────────────────────────
function cover(inp: CardInput, total: number) {
  const { cv, c } = canvas(W, H)
  const bandY = 930
  parcels(c, 0, 0, W, bandY, C.indigo, 0.07, 11)
  // 제목 뒤는 무늬를 비워 글자가 또렷하게
  const g = c.createLinearGradient(0, 0, W * 0.8, 0)
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(0.72, 'rgba(255,255,255,.86)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  c.fillStyle = g
  c.fillRect(0, 330, W, bandY - 330)

  rect(c, M, 84, 8, 44, C.indigo)
  text(c, `제 ${issueNo()} 호`, M + 26, 118, { size: 30, weight: 600, color: C.indigo })
  dateStamp(c, R - 138, 236, 150, inp.region.split(' ')[0] || inp.region, dotDate(), '데일리 브리핑')

  fitText(c, inp.region, M, 560, W - M * 2, { size: 124, weight: 900, font: SERIF, color: C.indigo }, 64)
  text(c, '부동산', M, 696, { size: 92, weight: 700, font: SERIF, color: C.ink })
  text(c, '데일리 브리핑', M, 816, { size: 92, weight: 700, font: SERIF, color: C.ink })

  // 아래 띠: 오늘의 숫자 세 가지
  rect(c, 0, bandY, W, H - bandY, C.indigo)
  const s = tradeStats(inp.trades)
  const cols: [string, string][] = [
    ['최근 30일 매매', `${s.week.length}건`],
    ['평균 거래가', s.week.length ? won(s.avg) : '-'],
    ['상승 / 하락', `${s.up} / ${s.down}`],
  ]
  const cw = (W - M * 2) / 3
  // 세 숫자를 같은 크기로: 가장 긴 값이 들어가는 크기에 맞춘다
  let vs = 68
  while (vs > 40 && cols.some(([, v]) => width(c, v, { size: vs, weight: 800 }) > cw - 50)) vs -= 2
  cols.forEach(([k, v], i) => {
    const x = M + cw * i + (i ? 34 : 0)
    if (i) rect(c, M + cw * i, bandY + 70, 1, 150, 'rgba(255,255,255,.28)')
    text(c, k, x, bandY + 104, { size: 27, weight: 500, color: '#fff', alpha: 0.72 })
    text(c, v, x, bandY + 190, { size: vs, weight: 800, color: '#fff' })
  })
  rule(c, M, R, H - 112, 'rgba(255,255,255,.28)')
  text(c, inp.office, M, H - 62, { size: 28, weight: 700, color: '#fff' })
  text(c, sourceLine(inp), R - 70, H - 62, { size: 22, weight: 500, color: '#fff', align: 'right', alpha: 0.7 })
  text(c, `1/${total}`, R, H - 62, { size: 24, weight: 700, color: '#fff', align: 'right' })
  return cv
}

// ── 속지 공통 틀 ─────────────────────────────────
function page(title: string, no: number, total: number, inp: CardInput, note?: string) {
  const { cv, c } = canvas(W, H)
  text(c, `${inp.region} 데일리 브리핑`, M, 104, { size: 26, weight: 600, color: C.sub })
  text(c, dotDate(), R, 104, { size: 26, weight: 600, color: C.sub, align: 'right' })
  rule(c, M, R, 132, C.ink, 4)
  text(c, title, M, 236, { size: 72, weight: 900, font: SERIF, color: C.ink })
  if (note) text(c, note, R, 232, { size: 24, weight: 500, color: C.sub, align: 'right' })
  // 꼬리말
  rule(c, M, R, H - 118, C.line, 2)
  rect(c, M, H - 86, 16, 16, C.seal)
  text(c, inp.office, M + 30, H - 68, { size: 26, weight: 700, color: C.ink })
  const pg = `${no}/${total}`
  text(c, pg, R, H - 68, { size: 24, weight: 700, color: C.ink, align: 'right' })
  text(c, sourceLine(inp), R - width(c, pg, { size: 24, weight: 700 }) - 22, H - 68, { size: 22, weight: 500, color: C.sub, align: 'right' })
  return { cv, c }
}

function diffText(c: Ctx, t: Trade, x: number, y: number, size: number) {
  if (!t.prev) return text(c, '직전 거래 없음', x, y, { size: size - 2, weight: 500, color: C.sub, align: 'right' })
  const d = t.price - t.prev
  if (d === 0) return text(c, '보합', x, y, { size, weight: 700, color: C.sub, align: 'right' })
  text(c, `${d > 0 ? '▲' : '▼'} ${won(Math.abs(d))}`, x, y, { size, weight: 700, color: d > 0 ? C.seal : C.down, align: 'right' })
}

// ── 최근 실거래: 표 ──────────────────────────────
function tradesCard(inp: CardInput, no: number, total: number) {
  const { cv, c } = page('최근 실거래', no, total, inp, '아파트 매매, 단위 원')
  const rows = [...inp.trades].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 7)
  const top = 296
  const head = { size: 22, weight: 600, color: C.sub }
  text(c, '단지', M, top, head)
  text(c, '계약일', 640, top, { ...head, align: 'right' })
  text(c, '거래가', R, top, { ...head, align: 'right' })
  rule(c, M, R, top + 20, C.ink, 2)
  const rh = 128
  rows.forEach((t, i) => {
    const y = top + 20 + rh * i
    const name = { size: 38, weight: 700, color: C.ink }
    text(c, clip(c, t.complex, 440, name), M, y + 58, name)
    text(c, `전용 ${t.area}㎡   ${t.floor}층`, M, y + 100, { size: 25, weight: 500, color: C.sub })
    text(c, shortDate(t.date), 640, y + 58, { size: 28, weight: 600, color: C.sub, align: 'right' })
    text(c, won(t.price), R, y + 60, { size: 44, weight: 800, color: C.ink, align: 'right' })
    diffText(c, t, R, y + 102, 26)
    if (i < rows.length - 1) rule(c, M, R, y + rh, C.line, 2)
  })
  if (!rows.length) text(c, '최근 신고된 매매 실거래가 없습니다.', M, top + 110, { size: 32, color: C.sub })
  return cv
}

// ── 단지별 평균: 막대 ────────────────────────────
function complexCard(inp: CardInput, no: number, total: number) {
  const { cv, c } = page('단지별 평균 거래가', no, total, inp, '최근 매매 실거래 기준')
  const map = new Map<string, number[]>()
  inp.trades.forEach((t) => map.set(t.complex, [...(map.get(t.complex) ?? []), t.price]))
  const rows = [...map]
    .map(([name, v]) => ({ name, avg: Math.round(v.reduce((a, b) => a + b, 0) / v.length), n: v.length }))
    .sort((a, b) => b.avg - a.avg)
    .slice(0, 7)
  const max = Math.max(...rows.map((r) => r.avg), 1)
  const top = 300
  const rh = Math.min(176, Math.floor((H - 150 - top) / Math.max(rows.length, 1))) // 줄 수에 맞춰 간격을 넓힌다
  rows.forEach((r, i) => {
    const y = top + rh * i
    const name = { size: 36, weight: 700, color: C.ink }
    text(c, clip(c, r.name, 560, name), M, y + 44, name)
    text(c, `${r.n}건`, M + width(c, clip(c, r.name, 560, name), name) + 18, y + 44, { size: 24, weight: 500, color: C.sub })
    text(c, won(r.avg), R, y + 46, { size: 40, weight: 800, color: C.ink, align: 'right' })
    rect(c, M, y + 72, W - M * 2, 18, C.mist)
    rect(c, M, y + 72, Math.max(24, ((W - M * 2) * r.avg) / max), 18, C.indigo)
  })
  if (!rows.length) text(c, '표시할 실거래가 없습니다.', M, top + 80, { size: 32, color: C.sub })
  return cv
}

// ── 시장 읽기 (AI 요약) ──────────────────────────
function insightCard(inp: CardInput, no: number, total: number) {
  const { cv, c } = page('오늘의 시장 읽기', no, total, inp, 'AI가 공개 자료를 요약한 참고용 내용')
  const ins = { comment: inp.insight!.comment.replace(/㎡/g, 'm²'), points: inp.insight!.points }
  const quote = { size: 46, weight: 700, font: SERIF, color: C.ink, lh: 1.62, maxLines: 7 }
  const n = Math.min(7, lines(c, ins.comment, W - M * 2 - 44, quote).length)
  rect(c, M, 316, 8, n * 46 * 1.62 - 10, C.indigo)
  let y = para(c, ins.comment, M + 44, 360, W - M * 2 - 44, quote) + 96
  rule(c, M, R, y - 40, C.ink, 2)
  ins.points.slice(0, 3).forEach((p, i, arr) => {
    rect(c, M, y + 6, 16, 16, C.seal)
    const end = para(c, p, M + 44, y + 28, W - M * 2 - 44, { size: 36, weight: 600, color: C.ink, lh: 1.42, maxLines: 2 })
    y = end + 52
    if (i < arr.length - 1) rule(c, M, R, y - 12, C.line, 2)
    y += 34
  })
  return cv
}

// ── 뉴스 ─────────────────────────────────────────
function newsCard(inp: CardInput, no: number, total: number) {
  const { cv, c } = page('부동산 뉴스', no, total, inp)
  const limit = H - 150
  let y = 300
  for (const [i, raw] of inp.news.slice(0, 4).entries()) {
    const n = { ...raw, title: raw.title.replace(/㎡/g, 'm²') }
    const title = { size: 40, weight: 700, font: SERIF, color: C.ink, lh: 1.4, maxLines: 2 }
    const sum = { size: 27, weight: 500, color: C.sub, lh: 1.5, maxLines: 2 }
    const need = 40 + lines(c, n.title, W - M * 2, title).slice(0, 2).length * 56 + (n.summary ? lines(c, n.summary, W - M * 2, sum).slice(0, 2).length * 41 + 16 : 0) + 40
    if (y + need > limit) break
    if (i) rule(c, M, R, y - 34, C.line, 2)
    text(c, n.source, M, y, { size: 24, weight: 700, color: C.indigo })
    text(c, shortDate(n.date), M + width(c, n.source, { size: 24, weight: 700 }) + 18, y, { size: 24, weight: 500, color: C.sub })
    let end = para(c, n.title, M, y + 58, W - M * 2, title)
    if (n.summary) end = para(c, n.summary, M, end + 54, W - M * 2, sum)
    y = end + 92
  }
  return cv
}

/** 카드뉴스를 PNG dataURL 로 (AI 분석이 있으면 5장, 없으면 4장) */
export async function renderCards(inp: CardInput): Promise<string[]> {
  await loadFonts(
    [inp.region, inp.office, inp.insight?.comment ?? '', ...inp.news.slice(0, 4).map((n) => n.title), '최근실거래단지별평균거래가오늘의시장읽기부동산뉴스'].join(''),
  )
  const total = inp.insight ? 5 : 4
  const cards = [cover(inp, total), tradesCard(inp, 2, total), complexCard(inp, 3, total)]
  if (inp.insight) cards.push(insightCard(inp, 4, total))
  cards.push(newsCard(inp, total, total))
  return cards.map((cv) => cv.toDataURL('image/png'))
}
