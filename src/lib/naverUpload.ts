// 접수된 매물 → 네이버 매물 등록 입력값 (초안)
// 매물 등록 업체가 아직 정해지지 않아, 지금은 "등록 화면 순서대로 정리해서 복사"까지만 한다.
// 업체가 정해지면 UploadVendor 를 구현해 VENDORS 에 넣으면 '네이버 매물 업로드' 버튼이 그 업체로 전송한다.
import type { Intake } from '../data/intake'
import { won } from './util'

export interface DraftField {
  section: string
  label: string
  value: string
  required?: boolean
}

export interface UploadVendor {
  name: string
  /** 업체 등록 화면·API 로 전송. 성공하면 등록 번호나 안내 문구를 돌려준다. */
  submit(draft: DraftField[], intake: Intake): Promise<string>
}
/** 업체 확정 후 여기에 추가 */
export const VENDORS: UploadVendor[] = []

const money = (v: number) => (v ? `${v.toLocaleString()}만원 (${won(v)})` : '')
const area = (v: number) => (v ? `${v}㎡ (${(v / 3.3058).toFixed(1)}평)` : '')

export function toNaverDraft(i: Intake): DraftField[] {
  const f: DraftField[] = [
    { section: '매물 구분', label: '매물 종류', value: i.kind, required: true },
    { section: '매물 구분', label: '거래 유형', value: i.deal, required: true },
    { section: '소재지', label: '지역', value: i.region, required: true },
    { section: '소재지', label: '주소', value: i.address, required: true },
    { section: '소재지', label: '단지·건물명', value: i.complex },
    { section: '소재지', label: '동', value: i.dongNo },
    { section: '소재지', label: '호', value: i.hoNo },
    { section: '면적·구조', label: '공급면적', value: area(i.supplyArea) },
    { section: '면적·구조', label: '전용면적', value: area(i.exclusiveArea), required: true },
    { section: '면적·구조', label: '해당층 / 총층', value: i.floor || i.totalFloors ? `${i.floor || '?'}층 / ${i.totalFloors || '?'}층` : '', required: true },
    { section: '면적·구조', label: '방향 (거실 기준)', value: i.direction },
    { section: '면적·구조', label: '방 / 욕실', value: i.rooms || i.baths ? `${i.rooms}개 / ${i.baths}개` : '' },
    { section: '가격', label: i.deal === '매매' ? '매매가' : i.deal === '전세' ? '전세가' : '보증금', value: money(i.price), required: true },
    ...(i.deal === '월세' ? [{ section: '가격', label: '월세', value: money(i.rent), required: true }] : []),
    { section: '가격', label: '융자금', value: money(i.loan) },
    ...(i.deal === '매매' ? [{ section: '가격', label: '기존 임대 보증금', value: money(i.tenantDeposit) }] : []),
    { section: '가격', label: '관리비 (월)', value: money(i.maintenanceFee) },
    { section: '가격', label: '가격 협의', value: i.negotiable ? '가능' : '' },
    { section: '입주·시설', label: '입주 가능일', value: i.moveIn === '날짜 지정' ? i.moveInDate : i.moveIn, required: true },
    { section: '입주·시설', label: '현재 거주', value: i.occupied },
    { section: '입주·시설', label: '난방', value: i.heating },
    { section: '입주·시설', label: '사용승인 연도', value: i.approvalYear },
    { section: '입주·시설', label: '주차', value: i.parking },
    { section: '입주·시설', label: '옵션', value: i.options.join(', ') },
    { section: '설명', label: '매물 특징 (한 줄)', value: i.feature, required: true },
    { section: '설명', label: '상세 설명', value: i.description },
    { section: '소유자 확인', label: '의뢰인', value: `${i.ownerName} (${i.relation})`, required: true },
    { section: '소유자 확인', label: '연락처', value: i.ownerPhone, required: true },
    { section: '소유자 확인', label: '방문 가능 시간', value: i.visitTime },
  ]
  return f
}

/** 필수인데 비어 있는 항목 */
export const missing = (d: DraftField[]) => d.filter((x) => x.required && !x.value).map((x) => x.label)

export const draftText = (d: DraftField[]) => {
  let out = ''
  let sec = ''
  for (const x of d) {
    if (!x.value) continue
    if (x.section !== sec) out += `${out ? '\n' : ''}[${(sec = x.section)}]\n`
    out += `${x.label}: ${x.value}\n`
  }
  return out
}
