// 내 매물 (매물장): 사무소가 실제로 맡아 관리하는 매물.
// 항목은 손님 매물 접수 양식(intake.ts)과 같아서, 접수된 매물을 그대로 옮겨 오고 네이버 등록 초안에도 그대로 쓴다.
import { blankIntake, type Intake } from './intake'
import type { Kind, Listing } from './sample'

export const PROPERTY_STATUS = ['접수', '광고중', '계약중', '거래완료', '보류'] as const
export type PropertyStatus = (typeof PROPERTY_STATUS)[number]

export interface Property extends Omit<Intake, 'status' | 'agree' | 'customerId'> {
  status: PropertyStatus
  articleNo: string // 네이버 매물번호
  memo: string // 사무소만 보는 메모
  intakeId?: string // 손님 접수에서 옮겨 온 경우
  updatedAt: number
}

export const blankProperty = (): Property => {
  const { status, agree, customerId, ...rest } = blankIntake()
  return { ...rest, status: '접수', articleNo: '', memo: '', updatedAt: 0 }
}

/** 손님이 접수한 매물 → 내 매물 */
export function fromIntake(i: Intake): Property {
  const { status, agree, customerId, ...rest } = i
  return { ...rest, id: '', status: '접수', articleNo: '', memo: '', intakeId: i.id, createdAt: Date.now(), updatedAt: Date.now() }
}

/** 네이버 등록 초안·접수 양식 화면은 Intake 꼴을 받는다 */
export const asIntake = (p: Property): Intake => ({ ...p, status: '접수', agree: true })

export const propertyTitle = (p: Property) => [p.complex || p.address, p.dongNo && `${p.dongNo}동`, p.hoNo && `${p.hoNo}호`].filter(Boolean).join(' ') || '이름 없는 매물'

const KIND_MAP: Record<string, Kind> = { 아파트: '아파트', 오피스텔: '오피스텔', '빌라·연립': '빌라', '단독·다가구': '빌라', 상가: '상가', 사무실: '상가', 토지: '상가' }

/** 손님 맞춤 추천에 쓰는 꼴. 광고중·접수 상태만 추천 후보가 된다. */
export function toListing(p: Property): Listing {
  return {
    id: `mine-${p.id}`,
    key: `mine-${p.id}`,
    complex: propertyTitle(p),
    group: p.complex || p.address,
    kind: KIND_MAP[p.kind] ?? '아파트',
    deal: p.deal,
    price: p.price,
    rent: p.deal === '월세' ? p.rent : undefined,
    area: Math.round(p.exclusiveArea),
    floor: p.floor ? `${p.floor}${p.totalFloors ? `/${p.totalFloors}` : ''}층` : '-',
    dir: p.direction || '-',
    desc: p.feature || p.description.slice(0, 60),
    date: new Date(p.createdAt || Date.now()).toISOString().slice(0, 10),
    src: 'import',
    articleNo: p.articleNo || undefined,
    mine: true,
  }
}
