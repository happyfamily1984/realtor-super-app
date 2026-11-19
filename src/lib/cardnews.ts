// 데일리 브리핑 카드뉴스 (1080×1350 PNG) 를 캔버스로 그린다
import type { News, Trade } from '../data/sample'
import { daysUntil, koDate, shortDate, today, won } from './util'

const W = 1080
const H = 1350
const BRAND = '#0e6b57'
const INK = '#17211d'
const SUB = '#66736d'
const PAPER = '#f6f4ee'
const UP = '#d8432e'
const DOWN = '#1f5fd0'
const FONT = 'Pretendard, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif'

type Ctx = CanvasRenderingContext2D

function text(c: Ctx, s: string, x: number, y: number, size: number, color: string, weight = 500, align: CanvasTextAlign = 'left') {
  c.font = `${weight} ${size}px ${FONT}`
  c.fillStyle = color
  c.textAlign = align
  c.textBaseline = 'alphabetic'
  c.fillText(s, x, y)
}

/** 줄바꿈 텍스트. 마지막으로 그린 줄의 y 를 돌려준다 */
function wrap(c: Ctx, s: string, x: number, y: number, maxW: number, size: number, color: string, weight = 500, lh = 1.4, maxLines = 4) {
  c.font = `${weight} ${size}px ${FONT}`
  c.fillStyle = color
  c.textAlign = 'left'
  const lines: string[] = []
  let line = ''
  for (const ch of s) {
    if (c.measureText(line + ch).width > maxW && line) {
      lines.push(line)
      line = ch.trimStart()
    } else line += ch
  }
  if (line) lines.push(line)
  const shown = lines.slice(0, maxLines)
  if (lines.length > maxLines) shown[maxLines - 1] = shown[maxLines - 1].slice(0, -1) + '…'
  shown.forEach((l, i) => c.fillText(l, x, y + i * size * lh))
  return y + (shown.length - 1) * size * lh
}

function rr(c: Ctx, x: number, y: number, w: number, h: number, r: number, fill: string) {
  c.beginPath()
  c.roundRect(x, y, w, h, r)
  c.fillStyle = fill
  c.fill()
}

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

function frame(title: string, page: number, total: number, inp: CardInput) {
  const cv = document.createElement('canvas')
  cv.width = W
  cv.height = H
  const c = cv.getContext('2d')!
  c.fillStyle = PAPER
  c.fillRect(0, 0, W, H)
  c.fillStyle = BRAND
  c.fillRect(0, 0, W, 16)
  text(c, `${inp.region} 데일리 브리핑`, 72, 110, 30, BRAND, 700)
  text(c, `${page} / ${total}`, W - 72, 110, 28, SUB, 600, 'right')
  text(c, title, 72, 200, 68, INK, 800)
  footer(c, inp, SUB)
  return { cv, c }
}

function footer(c: Ctx, inp: CardInput, color: string) {
  text(c, inp.office, 72, H - 64, 30, color, 700)
  text(c, inp.sample ? '※ 샘플 데이터 (실제 시세 아님)' : `자료: 국토교통부 실거래가 · ${shortDate(today())} 기준`, W - 72, H - 64, 26, color, 500, 'right')
}

function cover(inp: CardInput, total: number) {
  const cv = document.createElement('canvas')
  cv.width = W
  cv.height = H
  const c = cv.getContext('2d')!
  c.fillStyle = BRAND
  c.fillRect(0, 0, W, H)
  // 장식: 지붕 모양
  c.globalAlpha = 0.09
  c.fillStyle = '#fff'
  c.beginPath()
  c.moveTo(W - 520, H)
  c.lineTo(W - 520, 760)
  c.lineTo(W - 180, 470)
  c.lineTo(W + 160, 760)
  c.lineTo(W + 160, H)
  c.fill()
  c.globalAlpha = 1

  rr(c, 72, 96, 300, 60, 30, 'rgba(255,255,255,.16)')
  text(c, koDate(today()), 222, 137, 28, '#fff', 600, 'center')
  text(c, inp.region, 72, 330, 84, '#ffd9a8', 800)
  text(c, '부동산', 72, 450, 104, '#fff', 800)
  text(c, '데일리 브리핑', 72, 575, 104, '#fff', 800)

  const s = tradeStats(inp.trades)
  const items: [string, string][] = [
    ['최근 30일 매매', `${s.week.length}건`],
    ['평균 거래가', won(s.avg)],
    ['상승 / 하락', `${s.up} / ${s.down}`],
  ]
  items.forEach(([k, v], i) => {
    const y = 760 + i * 130
    rr(c, 72, y, 600, 108, 20, 'rgba(255,255,255,.12)')
    text(c, k, 104, y + 67, 32, 'rgba(255,255,255,.8)', 500)
    text(c, v, 640, y + 70, 44, '#fff', 800, 'right')
  })
  footer(c, inp, 'rgba(255,255,255,.85)')
  text(c, `1 / ${total}`, W - 72, 137, 28, 'rgba(255,255,255,.7)', 600, 'right')
  return cv
}

function tradesCard(inp: CardInput, page: number, total: number) {
  const { cv, c } = frame('최근 실거래', page, total, inp)
  const rows = [...inp.trades].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6)
  rows.forEach((t, i) => {
    const y = 270 + i * 152
    rr(c, 72, y, W - 144, 132, 22, '#fff')
    text(c, t.complex, 108, y + 58, 38, INK, 700)
    text(c, `전용 ${t.area}㎡ · ${t.floor}층 · ${shortDate(t.date)}`, 108, y + 102, 27, SUB, 500)
    text(c, won(t.price), W - 108, y + 60, 44, INK, 800, 'right')
    if (t.prev) {
      const d = t.price - t.prev
      const col = d > 0 ? UP : d < 0 ? DOWN : SUB
      const s = d === 0 ? '직전가와 동일' : `${d > 0 ? '▲' : '▼'} ${won(Math.abs(d))}`
      text(c, s, W - 108, y + 104, 27, col, 700, 'right')
    }
  })
  return cv
}

function complexCard(inp: CardInput, page: number, total: number) {
  const { cv, c } = frame('단지별 평균 거래가', page, total, inp)
  const map = new Map<string, number[]>()
  inp.trades.forEach((t) => map.set(t.complex, [...(map.get(t.complex) ?? []), t.price]))
  const rows = [...map]
    .map(([name, v]) => ({ name, avg: Math.round(v.reduce((a, b) => a + b, 0) / v.length), n: v.length }))
    .sort((a, b) => b.avg - a.avg)
    .slice(0, 6)
  const max = Math.max(...rows.map((r) => r.avg), 1)
  text(c, '최근 매매 실거래 기준', 72, 262, 28, SUB, 500)
  rows.forEach((r, i) => {
    const y = 330 + i * 150
    text(c, r.name, 72, y + 34, 36, INK, 700)
    text(c, `${r.n}건`, W - 72, y + 34, 28, SUB, 500, 'right')
    rr(c, 72, y + 56, W - 144, 46, 12, '#e6e3d9')
    const w = Math.max(160, ((W - 144) * r.avg) / max)
    rr(c, 72, y + 56, w, 46, 12, i === 0 ? '#ff7a3d' : BRAND)
    text(c, won(r.avg), 72 + w - 18, y + 90, 28, '#fff', 800, 'right')
  })
  return cv
}

function newsCard(inp: CardInput, page: number, total: number) {
  const { cv, c } = frame('오늘의 부동산 뉴스', page, total, inp)
  let y = 280
  inp.news.slice(0, 3).forEach((n, i) => {
    rr(c, 72, y, W - 144, 290, 24, '#fff')
    rr(c, 104, y + 34, 56, 56, 28, BRAND)
    text(c, String(i + 1), 132, y + 74, 30, '#fff', 800, 'center')
    text(c, `${n.source} · ${shortDate(n.date)}`, 180, y + 72, 26, SUB, 500)
    const ty = wrap(c, n.title, 104, y + 140, W - 208, 38, INK, 700, 1.32, 2)
    wrap(c, n.summary, 104, ty + 52, W - 208, 28, SUB, 500, 1.4, 2)
    y += 314
  })
  return cv
}

function insightCard(inp: CardInput, page: number, total: number) {
  const { cv, c } = frame('AI 시장 분석', page, total, inp)
  const ins = inp.insight!
  rr(c, 72, 270, W - 144, 330, 24, BRAND)
  wrap(c, ins.comment, 112, 345, W - 224, 36, '#fff', 600, 1.5, 5)
  let y = 650
  ins.points.slice(0, 3).forEach((p, i) => {
    rr(c, 72, y, W - 144, 150, 22, '#fff')
    rr(c, 104, y + 47, 56, 56, 28, '#ff7a3d')
    text(c, String(i + 1), 132, y + 87, 30, '#fff', 800, 'center')
    wrap(c, p, 188, y + (c.measureText(p).width > 600 ? 68 : 88), W - 300, 34, INK, 700, 1.35, 2)
    y += 170
  })
  text(c, '※ AI가 공개 자료를 요약한 참고용 내용입니다', 72, H - 120, 24, SUB, 500)
  return cv
}

/** 카드뉴스를 PNG dataURL 로 (AI 분석이 있으면 5장, 없으면 4장) */
export async function renderCards(inp: CardInput): Promise<string[]> {
  try {
    await Promise.all([document.fonts.load(`800 40px Pretendard`), document.fonts.load(`500 40px Pretendard`)])
  } catch {
    /* 폰트 로드 실패 시 시스템 글꼴 사용 */
  }
  const total = inp.insight ? 5 : 4
  const cards = [cover(inp, total), tradesCard(inp, 2, total), complexCard(inp, 3, total)]
  if (inp.insight) cards.push(insightCard(inp, 4, total))
  cards.push(newsCard(inp, total, total))
  return cards.map((cv) => cv.toDataURL('image/png'))
}
