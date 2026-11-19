// 손님 맞춤 매물 제안서 (1920×1080, 장마다 PNG). 디자인 체계는 design.ts 참고.
// 글꼴과 배치가 어느 기기에서나 똑같이 보이도록 그림으로 만들고, PPT 에는 한 장씩 전체 화면으로 넣는다.
import type { Consult, Settings } from '../data/sample'
import { C, SERIF, canvas, clip, dotDate, fitText, issueNo, loadFonts, para, parcels, rect, rule, squareSeal, text, width, type Ctx } from './design'
import type { Match } from './match'
import { downloadDataUrl, koDate, today, won } from './util'

const W = 1920
const H = 1080
const M = 120
const R = W - M

const priceText = (m: Match) => (m.listing.deal === '월세' ? `${won(m.listing.price)} / 월 ${m.listing.rent ?? 0}만` : won(m.listing.price))

function frame(title: string, no: number, total: number, c2: Consult, s: Settings) {
  const { cv, c } = canvas(W, H)
  text(c, `${c2.name} 님 맞춤 매물 제안서`, M, 96, { size: 26, weight: 600, color: C.sub })
  text(c, dotDate(), R, 96, { size: 26, weight: 600, color: C.sub, align: 'right' })
  rule(c, M, R, 124, C.ink, 4)
  if (title) text(c, title, M, 232, { size: 76, weight: 900, font: SERIF })
  rule(c, M, R, H - 96, C.line, 2)
  rect(c, M, H - 66, 16, 16, C.seal)
  text(c, s.office, M + 30, H - 48, { size: 26, weight: 700 })
  text(c, `${no}/${total}`, R, H - 48, { size: 24, weight: 700, align: 'right' })
  return { cv, c }
}

/** 예산 대비 가격 막대: 예산 위치에 눈금, 넘으면 주홍 */
function budgetBar(c: Ctx, x: number, y: number, w: number, price: number, budget: number, h = 16) {
  const scale = Math.max(budget * 1.15, price * 1.02)
  rect(c, x, y, w, h, C.mist)
  rect(c, x, y, (w * Math.min(price, scale)) / scale, h, price > budget ? C.seal : C.indigo)
  const bx = x + (w * budget) / scale
  rect(c, bx - 2, y - 10, 4, h + 20, C.ink)
  return bx
}

function cover(c2: Consult, picks: Match[], s: Settings) {
  const { cv, c } = canvas(W, H)
  const split = 1240
  // 오른쪽: 쪽빛 면 + 지적도 무늬
  rect(c, split, 0, W - split, H, C.indigo)
  parcels(c, split, 0, W - split, H, '#ffffff', 0.12, 23)
  text(c, '추천 매물', split + 90, 640, { size: 34, weight: 500, color: '#fff', alpha: 0.75 })
  text(c, `${picks.length}`, split + 84, 860, { size: 250, weight: 800, color: '#fff' })
  text(c, '건', split + 100 + width(c, `${picks.length}`, { size: 250, weight: 800 }), 860, { size: 64, weight: 700, color: '#fff' })
  text(c, `${c2.deal}  ${c2.kind}`, split + 90, 950, { size: 34, weight: 600, color: '#fff', alpha: 0.9 })

  // 왼쪽: 받는 분
  rect(c, M, 104, 8, 44, C.indigo)
  text(c, `제안 ${issueNo()} 호`, M + 26, 138, { size: 30, weight: 600, color: C.indigo })
  const nameSize = fitText(c, `${c2.name} 님 귀하`, M, 470, split - M * 2, { size: 150, weight: 900, font: SERIF, color: C.indigo }, 80)
  text(c, '맞춤 매물 제안서', M, 470 + nameSize * 0.2 + 96, { size: 84, weight: 700, font: SERIF })
  rule(c, M, split - M, 700, C.ink, 4)
  const rows: [string, string][] = [
    ['지역', s.region],
    ['조건', `${c2.deal} ${won(c2.budget)} 이내, 전용 ${c2.areaMin}㎡ 이상`],
    ['작성일', koDate(today())],
  ]
  rows.forEach(([k, v], i) => {
    text(c, k, M, 770 + i * 62, { size: 30, weight: 500, color: C.sub })
    text(c, clip(c, v, split - M * 2 - 150, { size: 32, weight: 700 }), M + 150, 770 + i * 62, { size: 32, weight: 700 })
  })
  // 보내는 곳 + 도장 (이름 끝에 겹쳐 찍는다)
  const off = { size: 40, weight: 700, font: SERIF }
  const office = clip(c, s.office, split - M * 2 - 120, off)
  text(c, office, M, H - 84, off)
  squareSeal(c, M + width(c, office, off) + 18, H - 172, 120, '매물제안')
  return cv
}

function needs(c2: Consult, picks: Match[], s: Settings, no: number, total: number) {
  const { cv, c } = frame('요청하신 조건', no, total, c2, s)
  const rows: [string, string][] = [
    ['거래 유형', c2.deal],
    ['매물 종류', c2.kind],
    ['예산', `${won(c2.budget)} 이내`],
    ['희망 면적', `전용 ${c2.areaMin}㎡ 이상`],
    ['입주 희망일', c2.moveIn ? koDate(c2.moveIn) : '협의'],
  ]
  const colW = 860
  rows.forEach(([k, v], i) => {
    const y = 330 + i * 104
    text(c, k, M, y + 62, { size: 32, weight: 500, color: C.sub })
    text(c, v, M + 280, y + 64, { size: 44, weight: 700 })
    rule(c, M, M + colW, y + 104, C.line, 2)
  })
  // 오른쪽: 요청 사항과 검토 결과
  const x = M + colW + 110
  rect(c, x, 330, R - x, 520, C.mist)
  text(c, '말씀하신 내용', x + 56, 410, { size: 30, weight: 600, color: C.sub })
  para(c, c2.memo || '별도 요청 사항 없음', x + 56, 492, R - x - 112, { size: 44, weight: 700, font: SERIF, lh: 1.55, maxLines: 4 })
  rule(c, x + 56, R - 56, 720, C.line, 2)
  const inBudget = picks.filter((m) => m.listing.price <= c2.budget).length
  text(c, `조건에 맞춰 ${picks.length}건을 골랐습니다.`, x + 56, 782, { size: 34, weight: 700 })
  text(c, `예산 이내 ${inBudget}건${picks.length - inBudget ? `, 예산을 조금 넘는 ${picks.length - inBudget}건` : ''}`, x + 56, 828, { size: 28, weight: 500, color: C.sub })
  return cv
}

function compare(c2: Consult, picks: Match[], s: Settings, no: number, total: number) {
  const { cv, c } = frame('한눈에 비교', no, total, c2, s)
  const col = { no: M, name: M + 90, price: 1010, area: 1190, floor: 1430, bar: 1480 }
  const head = { size: 24, weight: 600, color: C.sub }
  const top = 320
  text(c, '단지', col.name, top, head)
  text(c, '가격', col.price, top, { ...head, align: 'right' })
  text(c, '전용', col.area, top, { ...head, align: 'right' })
  text(c, '층 / 방향', col.floor, top, { ...head, align: 'right' })
  text(c, '예산 대비', col.bar, top, head)
  rule(c, M, R, top + 24, C.ink, 2)
  const rh = Math.min(130, Math.floor((H - 130 - top - 24) / Math.max(picks.length, 1)))
  let bx = 0
  picks.forEach((m, i) => {
    const l = m.listing
    const y = top + 24 + rh * i
    const mid = y + rh / 2
    text(c, String(i + 1), col.no, mid + 16, { size: 44, weight: 900, font: SERIF, color: C.indigo })
    const nm = { size: 40, weight: 700 }
    text(c, clip(c, l.complex, col.price - col.name - 330, nm), col.name, mid + 2, nm)
    text(c, clip(c, l.desc || l.kind, col.price - col.name - 330, { size: 26 }), col.name, mid + 42, { size: 26, weight: 500, color: C.sub })
    fitText(c, priceText(m), col.price, mid + 16, 320, { size: 44, weight: 800, align: 'right' }, 28)
    text(c, `${l.area}㎡`, col.area, mid + 14, { size: 34, weight: 600, align: 'right' })
    text(c, clip(c, `${l.floor} / ${l.dir}`, 220, { size: 30 }), col.floor, mid + 14, { size: 30, weight: 500, color: C.sub, align: 'right' })
    bx = budgetBar(c, col.bar, mid - 6, R - col.bar, l.price, c2.budget)
    if (i < picks.length - 1) rule(c, M, R, y + rh, C.line, 2)
  })
  if (picks.length) text(c, `예산 ${won(c2.budget)}`, Math.min(bx + 80, R), top + 24 + rh * picks.length + 44, { size: 24, weight: 600, color: C.ink, align: 'right' })
  return cv
}

function detail(c2: Consult, m: Match, idx: number, s: Settings, no: number, total: number) {
  const { cv, c } = frame('', no, total, c2, s)
  const l = m.listing
  const split = 1130
  text(c, `추천 ${idx + 1}`, M, 214, { size: 34, weight: 700, color: C.indigo })
  fitText(c, l.complex, M, 332, split - M - 60, { size: 100, weight: 900, font: SERIF }, 56)
  text(c, l.deal, M, 470, { size: 34, weight: 600, color: C.sub })
  fitText(c, priceText(m), M, 610, split - M - 60, { size: 136, weight: 800, color: C.ink }, 72)
  const bx = budgetBar(c, M, 668, split - M - 80, l.price, c2.budget, 18)
  const over = l.price - c2.budget
  text(c, over > 0 ? `예산보다 ${won(over)} 높음` : over < 0 ? `예산보다 ${won(-over)} 낮음` : '예산과 같음', M, 738, { size: 28, weight: 700, color: over > 0 ? C.seal : C.indigo })
  text(c, `예산 ${won(c2.budget)}`, Math.min(bx + 80, split - 80), 738, { size: 24, weight: 600, color: C.sub, align: 'right' })
  // 기본 정보 네 칸
  const facts: [string, string][] = [['종류', l.kind], ['전용면적', `${l.area}㎡`], ['층', l.floor], ['방향', l.dir]]
  const fw = (split - M - 80) / 4
  rule(c, M, split - 80, 800, C.ink, 2)
  facts.forEach(([k, v], i) => {
    const x = M + fw * i
    text(c, k, x, 856, { size: 26, weight: 500, color: C.sub })
    fitText(c, v, x, 916, fw - 24, { size: 44, weight: 700 }, 26)
  })
  // 오른쪽: 추천 이유
  rect(c, split, 124, W - split, H - 124 - 96, C.mist)
  const x = split + 80
  text(c, '조건 적합도', x, 230, { size: 30, weight: 600, color: C.sub })
  text(c, String(m.score), x, 368, { size: 140, weight: 800, color: C.indigo })
  text(c, '/ 100', x + width(c, String(m.score), { size: 140, weight: 800 }) + 18, 368, { size: 36, weight: 600, color: C.sub })
  rule(c, x, R, 420, C.line, 2)
  text(c, '추천 이유', x, 486, { size: 30, weight: 600, color: C.sub })
  let y = 548
  m.reasons.slice(0, 5).forEach((r) => {
    rect(c, x, y - 20, 14, 14, C.seal)
    text(c, clip(c, r, R - x - 40, { size: 36, weight: 700 }), x + 36, y, { size: 36, weight: 700 })
    y += 62
  })
  if (l.desc) {
    rule(c, x, R, y, C.line, 2)
    text(c, '매물 특징', x, y + 66, { size: 30, weight: 600, color: C.sub })
    para(c, l.desc, x, y + 126, R - x, { size: 38, weight: 700, font: SERIF, lh: 1.5, maxLines: 3 })
  }
  return cv
}

function closing(c2: Consult, s: Settings) {
  const { cv, c } = canvas(W, H)
  rect(c, 0, 0, W, H, C.indigo)
  parcels(c, 0, 0, W, H, '#ffffff', 0.07, 5)
  text(c, '현장에서 직접', M, 330, { size: 110, weight: 900, font: SERIF, color: '#fff' })
  text(c, '확인하실 수 있게 안내하겠습니다', M, 470, { size: 110, weight: 900, font: SERIF, color: '#fff' })
  rule(c, M, R, 580, 'rgba(255,255,255,.35)', 2)
  // 실제로 이어지는 순서
  const steps: [string, string][] = [
    ['방문 일정 정하기', '보고 싶은 매물과 편한 날짜를 알려 주세요.'],
    ['현장 확인', '동·층·일조·주변 환경을 함께 봅니다.'],
    ['조건 협의', '가격과 입주일을 조율하고 계약을 준비합니다.'],
  ]
  const cw = (W - M * 2) / 3
  steps.forEach(([k, v], i) => {
    const x = M + cw * i
    text(c, String(i + 1), x, 700, { size: 72, weight: 900, font: SERIF, color: '#fff', alpha: 0.55 })
    text(c, k, x, 776, { size: 44, weight: 700, color: '#fff' })
    para(c, v, x, 832, cw - 70, { size: 28, weight: 500, color: '#fff', alpha: 0.78, lh: 1.5, maxLines: 2 })
  })
  text(c, s.office, M, H - 84, { size: 40, weight: 700, font: SERIF, color: '#fff' })
  text(c, `${c2.name} 님께 드림`, R, H - 84, { size: 30, weight: 500, color: '#fff', align: 'right', alpha: 0.8 })
  return cv
}

/** 제안서 각 장을 PNG dataURL 로 */
export async function renderProposal(c2: Consult, picks: Match[], s: Settings): Promise<string[]> {
  await loadFonts([c2.name, c2.memo, s.office, s.region, ...picks.flatMap((m) => [m.listing.complex, m.listing.desc]), '맞춤매물제안서귀하요청하신조건한눈에비교현장에서직접확인하실수있게안내하겠습니다추천'].join(''))
  const total = picks.length + 4
  return [
    cover(c2, picks, s),
    needs(c2, picks, s, 2, total),
    compare(c2, picks, s, 3, total),
    ...picks.map((m, i) => detail(c2, m, i, s, 4 + i, total)),
    closing(c2, s),
  ].map((cv) => cv.toDataURL('image/png'))
}

/** 제안서를 PPT 파일로 저장 (한 장에 그림 한 장) */
export async function saveProposalPptx(pages: string[], name: string) {
  const { default: Pptx } = await import('pptxgenjs')
  const p = new Pptx()
  p.layout = 'LAYOUT_WIDE' // 13.33 x 7.5 in
  p.title = `${name}님 맞춤 매물 제안서`
  pages.forEach((data) => p.addSlide().addImage({ data, x: 0, y: 0, w: 13.333, h: 7.5 }))
  const blob = (await p.write({ outputType: 'blob' })) as Blob
  const url = URL.createObjectURL(blob)
  downloadDataUrl(url, `${name}님_매물제안_${today()}.pptx`)
  setTimeout(() => URL.revokeObjectURL(url), 10000)
}
