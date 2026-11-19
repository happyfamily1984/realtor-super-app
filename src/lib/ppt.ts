// 손님 맞춤 매물 브리핑 PPT 생성 (브라우저에서 바로 .pptx 저장)
import type { Consult, Settings } from '../data/sample'
import type { Match } from './match'
import { downloadDataUrl, koDate, today, won } from './util'

const BRAND = '0E6B57'
const INK = '17211D'
const SUB = '66736D'
const PAPER = 'F6F4EE'
const FACE = 'Malgun Gothic'

const priceText = (m: Match) =>
  m.listing.deal === '월세' ? `${won(m.listing.price)} / 월 ${m.listing.rent}만` : won(m.listing.price)

export async function makeBriefingPpt(c: Consult, picks: Match[], s: Settings) {
  const { default: Pptx } = await import('pptxgenjs')
  const p = new Pptx()
  p.layout = 'LAYOUT_WIDE' // 13.33 x 7.5 in
  p.title = `${c.name}님 맞춤 매물 제안`

  // 1. 표지
  let sl = p.addSlide()
  sl.background = { color: BRAND }
  sl.addText(koDate(today()), { x: 0.8, y: 0.7, w: 6, h: 0.4, fontSize: 14, color: 'CFE6DF', fontFace: FACE })
  sl.addText(`${c.name}님을 위한\n맞춤 매물 제안서`, { x: 0.8, y: 2.1, w: 11, h: 2.4, fontSize: 48, bold: true, color: 'FFFFFF', fontFace: FACE })
  sl.addText(`${s.region} · ${c.deal} · ${c.kind}`, { x: 0.8, y: 4.7, w: 11, h: 0.5, fontSize: 20, color: 'FFD9A8', fontFace: FACE })
  sl.addText(s.office, { x: 0.8, y: 6.5, w: 11, h: 0.4, fontSize: 16, bold: true, color: 'FFFFFF', fontFace: FACE })

  const head = (title: string) => {
    const x = p.addSlide()
    x.background = { color: PAPER }
    x.addShape('rect', { x: 0, y: 0, w: 13.33, h: 0.12, fill: { color: BRAND } })
    x.addText(title, { x: 0.8, y: 0.5, w: 11.7, h: 0.8, fontSize: 30, bold: true, color: INK, fontFace: FACE })
    x.addText(s.office, { x: 0.8, y: 6.9, w: 11.7, h: 0.3, fontSize: 11, color: SUB, fontFace: FACE })
    return x
  }
  const cell = (text: string, bold = false, fill?: string, color = INK) => ({
    text,
    options: { bold, color, fontFace: FACE, fill: fill ? { color: fill } : undefined, valign: 'middle' as const },
  })

  // 2. 고객 요청 조건
  sl = head('고객 요청 조건')
  sl.addTable(
    [
      [cell('거래 유형', true, 'E6E3D9'), cell(c.deal)],
      [cell('매물 종류', true, 'E6E3D9'), cell(c.kind)],
      [cell('예산', true, 'E6E3D9'), cell(`${won(c.budget)} 이내`)],
      [cell('희망 면적', true, 'E6E3D9'), cell(`전용 ${c.areaMin}㎡ 이상`)],
      [cell('입주 희망일', true, 'E6E3D9'), cell(c.moveIn ? koDate(c.moveIn) : '협의')],
      [cell('요청 사항', true, 'E6E3D9'), cell(c.memo || '-')],
    ],
    { x: 0.8, y: 1.6, w: 11.7, colW: [2.6, 9.1], rowH: 0.7, fontSize: 18, border: { type: 'solid', color: 'D9D5C8', pt: 1 }, fill: { color: 'FFFFFF' } },
  )

  // 3. 한눈에 비교
  sl = head('추천 매물 한눈에 보기')
  sl.addTable(
    [
      ['No', '단지', '가격', '면적', '층/향', '특징'].map((t) => cell(t, true, BRAND, 'FFFFFF')),
      ...picks.map((m, i) => [
        cell(String(i + 1), true),
        cell(m.listing.complex, true),
        cell(priceText(m)),
        cell(`${m.listing.area}㎡`),
        cell(`${m.listing.floor} / ${m.listing.dir}`),
        cell(m.listing.desc),
      ]),
    ],
    { x: 0.8, y: 1.6, w: 11.7, colW: [0.7, 2.6, 2.3, 1.2, 1.9, 3.0], rowH: 0.6, fontSize: 15, border: { type: 'solid', color: 'D9D5C8', pt: 1 }, fill: { color: 'FFFFFF' } },
  )

  // 4. 매물별 상세
  picks.forEach((m, i) => {
    const l = m.listing
    const x = head(`추천 ${i + 1}. ${l.complex}`)
    x.addShape('roundRect', { x: 0.8, y: 1.6, w: 5.4, h: 4.9, fill: { color: 'FFFFFF' }, line: { color: 'D9D5C8', width: 1 }, rectRadius: 0.1 })
    x.addText(l.deal, { x: 1.1, y: 1.9, w: 4.8, h: 0.4, fontSize: 16, bold: true, color: BRAND, fontFace: FACE })
    x.addText(priceText(m), { x: 1.1, y: 2.4, w: 4.8, h: 0.9, fontSize: 36, bold: true, color: INK, fontFace: FACE })
    x.addText(
      [`종류  ${l.kind}`, `면적  전용 ${l.area}㎡`, `층    ${l.floor}`, `방향  ${l.dir}`].join('\n'),
      { x: 1.1, y: 3.5, w: 4.8, h: 2.6, fontSize: 18, color: INK, fontFace: FACE, lineSpacingMultiple: 1.4, valign: 'top' },
    )
    x.addText('추천 이유', { x: 6.7, y: 1.6, w: 5.8, h: 0.5, fontSize: 20, bold: true, color: BRAND, fontFace: FACE })
    x.addText(
      m.reasons.map((r) => ({ text: r, options: { bullet: true, breakLine: true } })),
      { x: 6.7, y: 2.2, w: 5.8, h: 2.2, fontSize: 18, color: INK, fontFace: FACE, valign: 'top', lineSpacingMultiple: 1.3 },
    )
    x.addText('매물 특징', { x: 6.7, y: 4.5, w: 5.8, h: 0.5, fontSize: 20, bold: true, color: BRAND, fontFace: FACE })
    x.addText(l.desc, { x: 6.7, y: 5.1, w: 5.8, h: 1.2, fontSize: 18, color: INK, fontFace: FACE, valign: 'top' })
  })

  // 5. 마무리
  sl = p.addSlide()
  sl.background = { color: BRAND }
  sl.addText('방문 상담 및 현장 안내를\n도와드리겠습니다', { x: 0.8, y: 2.4, w: 11.7, h: 2, fontSize: 40, bold: true, color: 'FFFFFF', fontFace: FACE })
  sl.addText(s.office, { x: 0.8, y: 4.8, w: 11.7, h: 0.5, fontSize: 20, color: 'FFD9A8', fontFace: FACE })

  const blob = (await p.write({ outputType: 'blob' })) as Blob
  const url = URL.createObjectURL(blob)
  downloadDataUrl(url, `${c.name}님_매물제안_${today()}.pptx`)
  setTimeout(() => URL.revokeObjectURL(url), 10000)
}
