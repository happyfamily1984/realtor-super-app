// 타입 정의 (손님 상담, 계약, 네이버 수집 매물, 설정)
import type { ContractDoc } from '../lib/contractDoc'
import { DEFAULT_MAIN, type MainComplex } from './main'

export type Deal = '매매' | '전세' | '월세'
export type Kind = '아파트' | '오피스텔' | '빌라' | '상가'

export interface Trade {
  id: string
  complex: string
  area: number // 전용 ㎡
  floor: number
  price: number // 만원
  prev?: number // 직전 동일면적 거래가(만원)
  dong?: string
  date: string
  kind?: '아파트' | '오피스텔'
  rent?: number // 전월세 자료의 월세(만원). 0 이면 전세
}
export interface Listing {
  id: string
  complex: string
  kind: Kind
  deal: Deal
  price: number // 매매가 / 전세가 / 보증금 (만원)
  rent?: number // 월세 (만원)
  area: number
  floor: string
  dir: string
  desc: string
  date: string
  src?: 'import' // 가져온 매물
  mine?: boolean // 내 매물(매물장)에서 온 것
  // ── 누적 수집 기록 ──
  key?: string // 같은 매물인지 알아보는 값 (네이버 매물번호 등)
  group?: string // 단지 이름 (동 제외)
  articleNo?: string // 네이버 매물번호
  realtor?: string // 광고하는 중개사무소
  complexNo?: string // 네이버 단지 번호
  bld?: string // 동
  scope?: 'region' // 동(지역) 전체 목록에서 수집한 매물
  region?: string // 네이버 지역 코드 = 법정동코드 10자리 (앞 5자리는 시군구)
  firstSeen?: string // 처음 수집한 날
  lastSeen?: string // 마지막으로 확인된 날
  newAt?: string // 이전에 수집한 단지에 새로 나온 날
  prevPrice?: number // 가격이 바뀌기 전 값
  changedAt?: string // 가격 변동을 확인한 날
  gone?: string // 다시 수집했을 때 사라진 날 (거래완료·광고종료 추정)
}
export interface Consult {
  id: string
  name: string
  phone: string
  deal: Deal
  kind: Kind
  budget: number // 최대 예산 (만원)
  areaMin: number // 희망 최소 면적 ㎡
  moveIn: string
  memo: string
  status: '신규' | '상담중' | '완료'
  createdAt: string
}
export interface Contract {
  id: string
  title: string // 물건
  deal: Deal
  client: string
  price: number
  contractDate: string
  midDate: string
  midAmount: number
  balanceDate: string
  balanceAmount: number
  memo: string
  status: '진행중' | '완료'
  photos: string[] // IndexedDB 사진 id
  ai?: { summary: string; special: string[]; checks: string[] } // AI 계약서 분석 결과
  doc?: ContractDoc // 계약서 작성 내용
  propertyId?: string // 어느 내 매물의 계약인지
}
export interface Settings {
  office: string
  region: string // 제안서에 표시할 지역 이름
  passcode: string // 서버 접속 암호 (APP_PASSCODE 를 설정한 경우)
  myRealtor: string // 네이버 부동산에 표시되는 우리 사무소 이름 (비우면 사무소 이름)
  mainComplexes: MainComplex[] // 메인 단지
  // 계약서에 들어가는 사무소 정보
  officeRep?: string // 대표 (개업공인중개사 성명)
  officeRegNo?: string // 등록번호
  officeAddress?: string
  officePhone?: string
}

export const DEFAULT_SETTINGS: Settings = { office: '우리 공인중개사사무소', region: '안양시 동안구', passcode: '', myRealtor: '', mainComplexes: DEFAULT_MAIN }

/** 예전 버전이 넣어 둔 샘플 자료의 id. 실제 업무용으로 바뀌면서 처음 열 때 지운다. */
export const SAMPLE_IDS = new Set(['c1', 'c2', 'c3', 'k1', 'k2', 'k3', 'k4', ...Array.from({ length: 14 }, (_, i) => `l${i + 1}`)])
