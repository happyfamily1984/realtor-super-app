// 타입 정의 + 샘플 데이터
// 실거래·뉴스·매물은 지금은 "샘플"이며, 추후 서버 연동 시 이 파일의 배열만 실제 데이터로 교체하면 된다.
import { dayOffset } from '../lib/util'

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
}
export interface News {
  id: string
  title: string
  source: string
  date: string
  summary: string
  link?: string
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
  src?: 'import' // 직접 가져온 매물 (없으면 샘플)
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
}
export interface Settings {
  office: string
  region: string // 화면·카드뉴스에 표시할 지역 이름
  lawdCd: string // 실거래 조회용 시군구 코드 5자리
  dong: string // 동 이름 (비우면 시군구 전체)
  passcode: string // 서버 접속 암호 (APP_PASSCODE 를 설정한 경우)
  myRealtor: string // 네이버 부동산에 표시되는 우리 사무소 이름 (비우면 사무소 이름)
  myArticles: string // 우리 사무소의 네이버 매물번호 (쉼표로 구분)
}

export const DEFAULT_SETTINGS: Settings = { office: '우리 공인중개사사무소', region: '안양시 동안구', lawdCd: '41173', dong: '', passcode: '', myRealtor: '', myArticles: '' }

export const TRADES: Trade[] = [
  { id: 't1', complex: '아현 숲마을', area: 84, floor: 12, price: 172000, prev: 168500, date: dayOffset(-1) },
  { id: 't2', complex: '마포 리버뷰', area: 59, floor: 7, price: 138000, prev: 139500, date: dayOffset(-1) },
  { id: 't3', complex: '공덕 해오름', area: 84, floor: 18, price: 181500, prev: 176000, date: dayOffset(-2) },
  { id: 't4', complex: '아현 센트럴파크', area: 114, floor: 9, price: 224000, prev: 221000, date: dayOffset(-3) },
  { id: 't5', complex: '아현 숲마을', area: 59, floor: 4, price: 131000, prev: 131000, date: dayOffset(-3) },
  { id: 't6', complex: '마포 더힐스', area: 84, floor: 21, price: 165000, prev: 161000, date: dayOffset(-4) },
  { id: 't7', complex: '공덕 해오름', area: 59, floor: 11, price: 142500, prev: 140000, date: dayOffset(-5) },
  { id: 't8', complex: '마포 리버뷰', area: 84, floor: 15, price: 169000, prev: 171000, date: dayOffset(-6) },
  { id: 't9', complex: '아현 센트럴파크', area: 84, floor: 6, price: 178000, prev: 174500, date: dayOffset(-9) },
  { id: 't10', complex: '마포 더힐스', area: 59, floor: 3, price: 127500, prev: 129000, date: dayOffset(-11) },
  { id: 't11', complex: '아현 숲마을', area: 84, floor: 16, price: 168500, prev: 166000, date: dayOffset(-12) },
  { id: 't12', complex: '공덕 해오름', area: 114, floor: 8, price: 232000, prev: 228000, date: dayOffset(-13) },
]

export const NEWS: News[] = [
  {
    id: 'n1',
    title: '아현·공덕 일대 정비사업 속도… 관리처분 인가 임박',
    source: '샘플뉴스',
    date: dayOffset(0),
    summary: '인근 재개발 구역이 관리처분 인가를 앞두고 있어 이주 수요에 따른 전세 움직임이 예상됩니다.',
  },
  {
    id: 'n2',
    title: '기준금리 동결… 주택담보대출 금리 소폭 하락',
    source: '샘플뉴스',
    date: dayOffset(-1),
    summary: '대출 금리가 내려가며 실수요자 문의가 늘어날 수 있다는 전망이 나옵니다.',
  },
  {
    id: 'n3',
    title: '서북권 신축 입주 물량 감소, 전세가 강보합',
    source: '샘플뉴스',
    date: dayOffset(-1),
    summary: '내년 상반기 입주 물량이 줄어 전세 매물 부족이 이어질 것으로 보입니다.',
  },
  {
    id: 'n4',
    title: '광역교통 개선 대책 발표… 환승센터 2028년 착공',
    source: '샘플뉴스',
    date: dayOffset(-2),
    summary: '역세권 단지를 중심으로 교통 호재 기대감이 커지고 있습니다.',
  },
]

export const LISTINGS: Listing[] = [
  { id: 'l1', complex: '아현 숲마을', kind: '아파트', deal: '매매', price: 169000, area: 84, floor: '중층', dir: '남향', desc: '올수리, 즉시 입주 가능', date: dayOffset(-1) },
  { id: 'l2', complex: '아현 숲마을', kind: '아파트', deal: '매매', price: 133000, area: 59, floor: '고층', dir: '남동향', desc: '역세권, 전망 좋음', date: dayOffset(-2) },
  { id: 'l3', complex: '마포 리버뷰', kind: '아파트', deal: '매매', price: 175000, area: 84, floor: '고층', dir: '남향', desc: '한강 조망, 풀옵션', date: dayOffset(-1) },
  { id: 'l4', complex: '마포 리버뷰', kind: '아파트', deal: '전세', price: 78000, area: 59, floor: '중층', dir: '남향', desc: '신혼부부 추천, 깨끗함', date: dayOffset(-3) },
  { id: 'l5', complex: '공덕 해오름', kind: '아파트', deal: '매매', price: 184000, area: 84, floor: '고층', dir: '남서향', desc: '초품아, 로열동', date: dayOffset(-2) },
  { id: 'l6', complex: '공덕 해오름', kind: '아파트', deal: '전세', price: 95000, area: 84, floor: '저층', dir: '남향', desc: '입주 협의, 확장형', date: dayOffset(-4) },
  { id: 'l7', complex: '아현 센트럴파크', kind: '아파트', deal: '매매', price: 228000, area: 114, floor: '중층', dir: '남향', desc: '대형 평형, 공원 조망', date: dayOffset(-5) },
  { id: 'l8', complex: '아현 센트럴파크', kind: '아파트', deal: '전세', price: 88000, area: 84, floor: '고층', dir: '동향', desc: '융자 없음', date: dayOffset(-1) },
  { id: 'l9', complex: '마포 더힐스', kind: '아파트', deal: '매매', price: 129000, area: 59, floor: '저층', dir: '남향', desc: '급매, 가격 협의 가능', date: dayOffset(0) },
  { id: 'l10', complex: '마포 더힐스', kind: '아파트', deal: '월세', price: 10000, rent: 220, area: 84, floor: '중층', dir: '남향', desc: '풀옵션, 단기 가능', date: dayOffset(-2) },
  { id: 'l11', complex: '아현 스테이', kind: '오피스텔', deal: '월세', price: 1000, rent: 85, area: 24, floor: '고층', dir: '남향', desc: '역 도보 2분, 풀옵션', date: dayOffset(-1) },
  { id: 'l12', complex: '아현 스테이', kind: '오피스텔', deal: '전세', price: 24000, area: 28, floor: '중층', dir: '동향', desc: '전세대출 가능', date: dayOffset(-6) },
  { id: 'l13', complex: '공덕 빌리지', kind: '빌라', deal: '매매', price: 52000, area: 49, floor: '3층', dir: '남향', desc: '신축급, 주차 가능', date: dayOffset(-3) },
  { id: 'l14', complex: '아현시장 1층 상가', kind: '상가', deal: '월세', price: 5000, rent: 350, area: 40, floor: '1층', dir: '-', desc: '유동인구 많음, 무권리', date: dayOffset(-7) },
]

export const SAMPLE_CONSULTS: Consult[] = [
  { id: 'c1', name: '김민수', phone: '010-1234-5678', deal: '매매', kind: '아파트', budget: 175000, areaMin: 84, moveIn: dayOffset(60), memo: '초등학교 가까운 곳, 남향 선호', status: '신규', createdAt: dayOffset(0) },
  { id: 'c2', name: '이서연', phone: '010-9876-5432', deal: '전세', kind: '아파트', budget: 90000, areaMin: 59, moveIn: dayOffset(30), memo: '신혼부부, 역세권 희망', status: '상담중', createdAt: dayOffset(-2) },
  { id: 'c3', name: '박준형', phone: '010-5555-1212', deal: '월세', kind: '오피스텔', budget: 2000, areaMin: 20, moveIn: dayOffset(14), memo: '직장인 1인, 월 90 이하', status: '완료', createdAt: dayOffset(-8) },
]

export const SAMPLE_CONTRACTS: Contract[] = [
  { id: 'k1', title: '아현 숲마을 103동 1204호', deal: '매매', client: '매수 정하늘 / 매도 최영호', price: 171000, contractDate: dayOffset(-20), midDate: dayOffset(2), midAmount: 50000, balanceDate: dayOffset(40), balanceAmount: 103900, memo: '중도금 대출 실행 확인 필요', status: '진행중', photos: [] },
  { id: 'k2', title: '마포 리버뷰 201동 702호', deal: '전세', client: '임차 한지우 / 임대 오세진', price: 78000, contractDate: dayOffset(-10), midDate: '', midAmount: 0, balanceDate: dayOffset(6), balanceAmount: 70200, memo: '잔금일 전입신고·확정일자 안내', status: '진행중', photos: [] },
  { id: 'k3', title: '공덕 해오름 105동 1801호', deal: '매매', client: '매수 윤가람 / 매도 서민재', price: 181500, contractDate: dayOffset(5), midDate: dayOffset(35), midAmount: 60000, balanceDate: dayOffset(75), balanceAmount: 103350, memo: '계약 예정 (가계약금 입금 완료)', status: '진행중', photos: [] },
  { id: 'k4', title: '아현 스테이 1105호', deal: '월세', client: '임차 박준형 / 임대 김도현', price: 1000, contractDate: dayOffset(-45), midDate: '', midAmount: 0, balanceDate: dayOffset(-15), balanceAmount: 900, memo: '', status: '완료', photos: [] },
]

