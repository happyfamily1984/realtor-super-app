// 고객에게 나가는 자료(카드뉴스·제안서)의 공통 디자인 체계
//
// 방향: 격식 있는 공문서. 부동산 문서(등기·계약서)의 언어를 가져온다.
//  - 흰 종이 위 먹남색 명조 제목, 표와 가는 괘선으로 정보를 정리한다 (카드 상자를 쌓지 않는다)
//  - 주홍은 상승(▲) 표시와 작은 표식에만 쓴다. 파랑은 하락(▼)에만 쓴다.
//  - 배경 무늬는 지적도(필지 경계선)에서 가져온다.
export const C = {
  ink: '#121a2c', // 본문 먹색
  indigo: '#172a54', // 쪽빛 (주조색)
  seal: '#c4321d', // 주홍 (상승·강조)
  down: '#1c54c0', // 하락
  paper: '#ffffff',
  mist: '#eef1f6',
  line: '#cdd3de',
  sub: '#5a6376',
}
export const SERIF = '"Noto Serif KR", "Nanum Myeongjo", Batang, serif'
export const SANS = 'Pretendard, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif'

export type Ctx = CanvasRenderingContext2D
export interface TextStyle {
  size: number
  color?: string
  weight?: number
  font?: string
  align?: CanvasTextAlign
  alpha?: number
}

const setFont = (c: Ctx, o: TextStyle) => {
  c.font = `${o.weight ?? 500} ${o.size}px ${o.font ?? SANS}`
  c.fillStyle = o.color ?? C.ink
  c.textAlign = o.align ?? 'left'
  c.textBaseline = 'alphabetic'
}

export function text(c: Ctx, s: string, x: number, y: number, o: TextStyle) {
  setFont(c, o)
  c.globalAlpha = o.alpha ?? 1
  c.fillText(s, x, y)
  c.globalAlpha = 1
}
export function width(c: Ctx, s: string, o: TextStyle) {
  setFont(c, o)
  return c.measureText(s).width
}
/** 폭에 맞을 때까지 글자 크기를 줄여서 한 줄로 */
export function fitText(c: Ctx, s: string, x: number, y: number, maxW: number, o: TextStyle, min = 24) {
  let size = o.size
  while (size > min && width(c, s, { ...o, size }) > maxW) size -= 2
  text(c, s, x, y, { ...o, size })
  return size
}
/** 폭을 넘으면 말줄임 */
export function clip(c: Ctx, s: string, maxW: number, o: TextStyle) {
  if (width(c, s, o) <= maxW) return s
  let out = s
  while (out.length > 1 && width(c, out + '…', o) > maxW) out = out.slice(0, -1)
  return out + '…'
}

/** 어절 단위로 줄바꿈한 줄 목록 (한 어절이 너무 길면 글자 단위) */
export function lines(c: Ctx, s: string, maxW: number, o: TextStyle): string[] {
  setFont(c, o)
  const out: string[] = []
  let line = ''
  for (const word of s.split(/\s+/).filter(Boolean)) {
    const tryLine = line ? `${line} ${word}` : word
    if (c.measureText(tryLine).width <= maxW) {
      line = tryLine
      continue
    }
    if (line) out.push(line)
    line = ''
    for (const ch of word) {
      if (c.measureText(line + ch).width > maxW && line) {
        out.push(line)
        line = ch
      } else line += ch
    }
  }
  if (line) out.push(line)
  return out
}
/** 문단을 그리고 마지막 줄의 기준선 y 를 돌려준다 */
export function para(c: Ctx, s: string, x: number, y: number, maxW: number, o: TextStyle & { lh?: number; maxLines?: number }) {
  const all = lines(c, s, maxW, o)
  const max = o.maxLines ?? 99
  const shown = all.slice(0, max)
  if (all.length > max) shown[max - 1] = clip(c, shown[max - 1] + '…', maxW, o)
  const step = o.size * (o.lh ?? 1.45)
  shown.forEach((l, i) => text(c, l, x, y + i * step, o))
  return y + (shown.length - 1) * step
}

export function rule(c: Ctx, x1: number, x2: number, y: number, color = C.line, w = 1) {
  c.fillStyle = color
  c.fillRect(x1, y - w / 2, x2 - x1, w)
}
export function rect(c: Ctx, x: number, y: number, w: number, h: number, color: string) {
  c.fillStyle = color
  c.fillRect(x, y, w, h)
}

/** 지적도 느낌의 필지 경계선 무늬 (seed 가 같으면 같은 무늬) */
export function parcels(c: Ctx, x: number, y: number, w: number, h: number, color: string, alpha: number, seed = 7) {
  let s = seed
  const rnd = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff), s / 0x7fffffff)
  const step = 150
  const cols = Math.ceil(w / step) + 2
  const rows = Math.ceil(h / step) + 2
  const pt: [number, number][][] = []
  for (let r = 0; r < rows; r++) {
    pt.push([])
    for (let k = 0; k < cols; k++) pt[r].push([x + (k - 0.5) * step + (rnd() - 0.5) * 70 + r * 26, y + (r - 0.5) * step + (rnd() - 0.5) * 60 - k * 14])
  }
  c.save()
  c.beginPath()
  c.rect(x, y, w, h)
  c.clip()
  c.strokeStyle = color
  c.globalAlpha = alpha
  c.lineWidth = 2
  c.beginPath()
  for (let r = 0; r < rows; r++)
    for (let k = 0; k < cols; k++) {
      const [px, py] = pt[r][k]
      if (k + 1 < cols && rnd() > 0.12) {
        c.moveTo(px, py)
        c.lineTo(...pt[r][k + 1])
      }
      if (r + 1 < rows && rnd() > 0.2) {
        c.moveTo(px, py)
        c.lineTo(...pt[r + 1][k])
      }
      // 필지를 한 번 더 나누는 선
      if (k + 1 < cols && r + 1 < rows && rnd() > 0.62) {
        const a = pt[r][k + 1]
        const b = pt[r + 1][k]
        c.moveTo((px + a[0]) / 2, (py + a[1]) / 2)
        c.lineTo((b[0] + pt[r + 1][k + 1][0]) / 2, (b[1] + pt[r + 1][k + 1][1]) / 2)
      }
    }
  c.stroke()
  c.restore()
}

/** 문서 번호에 쓰는 "연도-그 해의 몇 번째 날" */
export function issueNo(d = new Date()) {
  const start = new Date(d.getFullYear(), 0, 0)
  const day = Math.floor((d.getTime() - start.getTime()) / 86400000)
  return `${d.getFullYear()}-${String(day).padStart(3, '0')}`
}
export const dotDate = (d = new Date()) => `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`

/** 캔버스에 쓰기 전에 글꼴을 불러온다 (명조는 글자 묶음별로 나뉘어 있어 실제 쓸 글자를 넘겨야 한다) */
export async function loadFonts(sample: string) {
  const s = sample + '0123456789부동산데일리브리핑제안서귀하님'
  try {
    await Promise.all([
      document.fonts.load(`900 40px "Noto Serif KR"`, s),
      document.fonts.load(`700 40px "Noto Serif KR"`, s),
      document.fonts.load(`800 40px Pretendard`, s),
      document.fonts.load(`700 40px Pretendard`, s),
      document.fonts.load(`600 40px Pretendard`, s),
      document.fonts.load(`500 40px Pretendard`, s),
    ])
  } catch {
    /* 글꼴을 못 불러오면 기기 글꼴로 그린다 */
  }
}

export function canvas(w: number, h: number) {
  const cv = document.createElement('canvas')
  cv.width = w
  cv.height = h
  const c = cv.getContext('2d')!
  rect(c, 0, 0, w, h, C.paper)
  return { cv, c }
}
