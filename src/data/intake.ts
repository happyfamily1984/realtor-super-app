// 매물 접수 양식. 손님용 앱에서 적고, 사무소가 받아 네이버 매물 등록에 쓴다.
// 항목은 네이버 부동산 매물 등록 화면에서 중개사가 입력하는 내용(소재지·면적·가격·입주·시설·설명·소유자 확인)에 맞췄다.
// 실제 전송 형식은 매물 등록 업체가 정해지면 naverUpload.ts 의 연결부만 바꾸면 된다.
export const INTAKE_KINDS = ['아파트', '오피스텔', '빌라·연립', '단독·다가구', '상가', '사무실', '토지'] as const
export const INTAKE_DEALS = ['매매', '전세', '월세'] as const
export const INTAKE_REGIONS = ['안양시 동안구', '그 외'] as const
export const DIRECTIONS = ['남향', '남동향', '남서향', '동향', '서향', '북동향', '북서향', '북향'] as const
export const MOVE_IN = ['즉시 입주', '협의 가능', '날짜 지정'] as const
export const HEATING = ['개별난방', '중앙난방', '지역난방'] as const
export const RELATIONS = ['소유자 본인', '가족', '대리인', '임차인'] as const
export const OPTIONS = ['에어컨', '냉장고', '세탁기', '붙박이장', '인덕션', '식기세척기', '확장', '올수리', '엘리베이터', '주차 가능'] as const
export const INTAKE_STATUS = ['접수', '확인중', '등록완료'] as const

export interface Intake {
  id: string
  customerId?: string
  status: (typeof INTAKE_STATUS)[number]
  createdAt: number
  // 내놓는 분
  ownerName: string
  ownerPhone: string
  relation: (typeof RELATIONS)[number]
  // 매물 기본
  kind: (typeof INTAKE_KINDS)[number]
  deal: (typeof INTAKE_DEALS)[number]
  // 소재지
  region: (typeof INTAKE_REGIONS)[number]
  address: string // 동·지번 또는 도로명
  complex: string // 단지·건물 이름
  dongNo: string
  hoNo: string
  // 면적·구조
  supplyArea: number
  exclusiveArea: number
  floor: string
  totalFloors: string
  direction: (typeof DIRECTIONS)[number] | ''
  rooms: number
  baths: number
  // 가격 (만원)
  price: number // 매매가 / 전세가 / 보증금
  rent: number
  loan: number // 융자금
  tenantDeposit: number // 세 안고 매매일 때 기존 보증금
  maintenanceFee: number
  negotiable: boolean
  // 입주·시설
  moveIn: (typeof MOVE_IN)[number]
  moveInDate: string
  occupied: '소유자 거주' | '임차인 거주' | '공실' | ''
  heating: (typeof HEATING)[number] | ''
  approvalYear: string
  parking: string
  options: string[]
  // 설명
  feature: string // 한 줄 특징
  description: string
  visitTime: string
  photos: string[]
  agree: boolean
}

export const blankIntake = (): Intake => ({
  id: '', status: '접수', createdAt: 0,
  ownerName: '', ownerPhone: '', relation: '소유자 본인',
  kind: '아파트', deal: '매매',
  region: '안양시 동안구', address: '', complex: '', dongNo: '', hoNo: '',
  supplyArea: 0, exclusiveArea: 0, floor: '', totalFloors: '', direction: '', rooms: 0, baths: 0,
  price: 0, rent: 0, loan: 0, tenantDeposit: 0, maintenanceFee: 0, negotiable: false,
  moveIn: '협의 가능', moveInDate: '', occupied: '', heating: '', approvalYear: '', parking: '', options: [],
  feature: '', description: '', visitTime: '', photos: [], agree: false,
})
