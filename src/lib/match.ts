import type { Consult, Contract, Listing } from '../data/sample'
import { daysUntil } from './util'

export interface Match {
  listing: Listing
  score: number
  reasons: string[]
}

/** 손님 조건(거래유형·종류·예산·면적)에 맞는 매물을 점수순으로 */
export function recommend(c: Consult, listings: Listing[]): Match[] {
  const out: Match[] = []
  for (const l of listings) {
    if (l.deal !== c.deal) continue
    if (l.price > c.budget * 1.1) continue
    let score = 0
    const reasons: string[] = []
    if (l.kind === c.kind) {
      score += 30
      reasons.push(`${l.kind} 희망 일치`)
    }
    if (l.price <= c.budget) {
      score += 40
      reasons.push('예산 이내')
    } else {
      score += 15
      reasons.push('예산 10% 이내 초과')
    }
    if (l.area >= c.areaMin) {
      score += 20
      reasons.push(`희망 면적(${c.areaMin}㎡↑) 충족`)
    }
    if (/남/.test(l.dir)) {
      score += 5
      reasons.push(l.dir)
    }
    if (c.memo && /역세권|역 /.test(c.memo) && /역/.test(l.desc)) {
      score += 5
      reasons.push('역세권')
    }
    out.push({ listing: l, score, reasons })
  }
  return out.sort((a, b) => b.score - a.score)
}

export interface Schedule {
  contract: Contract
  label: '계약' | '중도금' | '잔금'
  date: string
  amount: number
  left: number
}

/** 진행중 계약의 다가오는 일정 (계약 예정일·중도금·잔금) */
export function upcoming(contracts: Contract[]): Schedule[] {
  const out: Schedule[] = []
  for (const c of contracts) {
    if (c.status !== '진행중') continue
    const add = (label: Schedule['label'], date: string, amount: number) => {
      if (!date) return
      const left = daysUntil(date)
      if (left >= 0) out.push({ contract: c, label, date, amount, left })
    }
    add('계약', c.contractDate, 0)
    add('중도금', c.midDate, c.midAmount)
    add('잔금', c.balanceDate, c.balanceAmount)
  }
  return out.sort((a, b) => a.left - b.left)
}
