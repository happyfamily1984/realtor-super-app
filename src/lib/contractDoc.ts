// 계약서 초안 만들기 (매매 / 임대차). 인쇄하거나 PDF 로 저장해 쓴다.
// 조항은 중개 현장에서 널리 쓰는 일반 서식의 틀을 따른 초안이다. 실제 계약 전에 협회 서식·최신 법령과 대조해야 한다.
import type { Contract, Deal, Settings } from '../data/sample'

export interface Party {
  name: string
  address: string
  phone: string
}
export interface ContractDoc {
  address: string // 소재지
  landCategory: string // 지목
  landArea: string // 대지 면적·지분
  structure: string // 구조·용도
  area: string // 전용면적 ㎡
  seller: Party // 매도인 / 임대인
  buyer: Party // 매수인 / 임차인
  downPayment: number // 계약금 (만원)
  loan: string // 융자금 등 승계 내용
  deliveryDate: string // 인도일
  leaseStart: string
  leaseEnd: string
  rent: number // 월세 (만원)
  rentDay: string // 월세 지급일 (예: 매월 말일)
  special: string // 특약사항 (줄바꿈으로 구분)
}
export const blankDoc = (): ContractDoc => ({
  address: '', landCategory: '대', landArea: '', structure: '', area: '',
  seller: { name: '', address: '', phone: '' }, buyer: { name: '', address: '', phone: '' },
  downPayment: 0, loan: '', deliveryDate: '', leaseStart: '', leaseEnd: '', rent: 0, rentDay: '', special: '',
})

const NUM = ['', '일', '이', '삼', '사', '오', '육', '칠', '팔', '구']
const UNIT = ['', '십', '백', '천']
const BIG = ['', '만', '억', '조']
/** 1710000000 → "일십칠억일천만" */
export function hangul(n: number): string {
  if (!n) return '영'
  let out = ''
  let i = 0
  while (n > 0) {
    const part = n % 10000
    let s = ''
    String(part).split('').reverse().forEach((d, k) => {
      if (+d) s = NUM[+d] + UNIT[k] + s
    })
    if (s) out = s + BIG[i] + out
    n = Math.floor(n / 10000)
    i++
  }
  return out
}
/** 만원 단위 금액 → "금 일십칠억일천만 원정 (₩1,710,000,000)" */
export const moneyText = (man: number) => (man ? `금 ${hangul(man * 10000)} 원정 (₩${(man * 10000).toLocaleString()})` : '')

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const ymd = (d: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d)
  return m ? `${m[1]}년 ${+m[2]}월 ${+m[3]}일` : '      년    월    일'
}

const SALE_CLAUSES = (d: ContractDoc) => [
  ['제2조 (소유권 이전 등)', `매도인은 매매대금의 잔금 수령과 동시에 매수인에게 소유권이전등기에 필요한 모든 서류를 교부하고 등기절차에 협력하며, 위 부동산의 인도일은 ${ymd(d.deliveryDate)}로 한다.`],
  ['제3조 (제한물권 등의 소멸)', '매도인은 위 부동산에 설정된 저당권, 지상권, 임차권 등 소유권의 행사를 제한하는 사유가 있거나 제세공과금 기타 부담금의 미납금 등이 있을 때에는 잔금 수수일까지 그 권리의 하자 및 부담 등을 제거하여 완전한 소유권을 매수인에게 이전한다. 다만, 승계하기로 합의하는 권리 및 금액은 그러하지 아니하다.'],
  ['제4조 (지방세 등)', '위 부동산에 관하여 발생한 수익의 귀속과 제세공과금 등의 부담은 위 부동산의 인도일을 기준으로 하되, 지방세의 납부의무 및 납부책임은 지방세법의 규정에 의한다.'],
  ['제5조 (계약의 해제)', '매수인이 매도인에게 중도금(중도금이 없을 때에는 잔금)을 지불하기 전까지 매도인은 계약금의 배액을 상환하고, 매수인은 계약금을 포기하고 본 계약을 해제할 수 있다.'],
  ['제6조 (채무불이행과 손해배상)', '매도인 또는 매수인이 본 계약상의 내용에 대하여 불이행이 있을 경우 그 상대방은 불이행한 자에 대하여 서면으로 최고하고 계약을 해제할 수 있다. 그리고 계약 당사자는 계약해제에 따른 손해배상을 각각 상대방에게 청구할 수 있으며, 손해배상에 대하여 별도의 약정이 없는 한 계약금을 손해배상의 기준으로 본다.'],
  ['제7조 (중개보수)', '개업공인중개사는 매도인 또는 매수인의 본 계약 불이행에 대하여 책임을 지지 않는다. 또한 중개보수는 본 계약 체결과 동시에 계약 당사자 쌍방이 각각 지불하며, 개업공인중개사의 고의나 과실 없이 본 계약이 무효·취소 또는 해제되어도 중개보수는 지급한다. 공동중개인 경우에 매도인과 매수인은 자신이 중개 의뢰한 개업공인중개사에게 각각 중개보수를 지급한다.'],
  ['제8조 (중개보수 외)', '매도인 또는 매수인이 본 계약 이외의 업무를 의뢰한 경우 이에 관한 보수는 중개보수와는 별도로 지급하며 그 금액은 합의에 의한다.'],
  ['제9조 (중개대상물 확인·설명서 교부 등)', '개업공인중개사는 중개대상물 확인·설명서를 작성하고 업무보증관계증서(공제증서 등) 사본을 첨부하여 계약 체결과 동시에 거래당사자 쌍방에게 교부한다.'],
]
const LEASE_CLAUSES = (d: ContractDoc) => [
  ['제2조 (존속기간)', `임대인은 위 부동산을 임대차 목적대로 사용·수익할 수 있는 상태로 ${ymd(d.leaseStart)}까지 임차인에게 인도하며, 임대차 기간은 인도일로부터 ${ymd(d.leaseEnd)}까지로 한다.`],
  ['제3조 (용도변경 및 전대 등)', '임차인은 임대인의 동의 없이 위 부동산의 용도나 구조를 변경하거나 전대·임차권 양도 또는 담보제공을 하지 못하며 임대차 목적 이외의 용도로 사용할 수 없다.'],
  ['제4조 (계약의 해지)', '임차인의 차임 연체액이 2기의 차임액에 달하거나 제3조를 위반하였을 때 임대인은 즉시 본 계약을 해지할 수 있다.'],
  ['제5조 (계약의 종료)', '임대차 계약이 종료된 경우 임차인은 위 부동산을 원상으로 회복하여 임대인에게 반환한다. 이러한 경우 임대인은 보증금을 임차인에게 반환하고, 연체 임대료 또는 손해배상금이 있을 때는 이들을 제하고 그 잔액을 반환한다.'],
  ['제6조 (계약의 해제)', '임차인이 임대인에게 중도금(중도금이 없을 때는 잔금)을 지불하기 전까지 임대인은 계약금의 배액을 상환하고, 임차인은 계약금을 포기하고 이 계약을 해제할 수 있다.'],
  ['제7조 (채무불이행과 손해배상)', '임대인 또는 임차인이 본 계약상의 내용에 대하여 불이행이 있을 경우 그 상대방은 불이행한 자에 대하여 서면으로 최고하고 계약을 해제할 수 있다. 그리고 계약 당사자는 계약해제에 따른 손해배상을 각각 상대방에게 청구할 수 있으며, 손해배상에 대하여 별도의 약정이 없는 한 계약금을 손해배상의 기준으로 본다.'],
  ['제8조 (중개보수)', '개업공인중개사는 임대인 또는 임차인의 본 계약 불이행에 대하여 책임을 지지 않는다. 또한 중개보수는 본 계약 체결과 동시에 계약 당사자 쌍방이 각각 지불하며, 개업공인중개사의 고의나 과실 없이 본 계약이 무효·취소 또는 해제되어도 중개보수는 지급한다. 공동중개인 경우에 임대인과 임차인은 자신이 중개 의뢰한 개업공인중개사에게 각각 중개보수를 지급한다.'],
  ['제9조 (중개대상물 확인·설명서 교부 등)', '개업공인중개사는 중개대상물 확인·설명서를 작성하고 업무보증관계증서(공제증서 등) 사본을 첨부하여 계약 체결과 동시에 거래당사자 쌍방에게 교부한다.'],
]

/** 인쇄용 계약서 HTML (A4) */
export function contractHtml(c: Contract, d: ContractDoc, s: Settings): string {
  const sale = c.deal === '매매'
  const [A, B] = sale ? ['매도인', '매수인'] : ['임대인', '임차인']
  const title = sale ? '부동산 매매 계약서' : `부동산 ${c.deal === '전세' ? '전세' : '월세'} 계약서`
  const pay: [string, string][] = sale
    ? [['매매대금', moneyText(c.price)], ['계약금', `${moneyText(d.downPayment)}은 계약 시에 지불하고 영수함.`], ...(c.midAmount ? [['중도금', `${moneyText(c.midAmount)}은 ${ymd(c.midDate)}에 지불한다.`] as [string, string]] : []), ['잔금', `${moneyText(c.balanceAmount)}은 ${ymd(c.balanceDate)}에 지불한다.`], ...(d.loan ? [['융자금 등', esc(d.loan)] as [string, string]] : [])]
    : [['보증금', moneyText(c.price)], ['계약금', `${moneyText(d.downPayment)}은 계약 시에 지불하고 영수함.`], ...(c.midAmount ? [['중도금', `${moneyText(c.midAmount)}은 ${ymd(c.midDate)}에 지불한다.`] as [string, string]] : []), ['잔금', `${moneyText(c.balanceAmount)}은 ${ymd(c.balanceDate)}에 지불한다.`], ...(c.deal === '월세' ? [['차임(월세)', `${moneyText(d.rent)}은 ${esc(d.rentDay || '매월    일')}에 지불한다.`] as [string, string]] : [])]
  const clauses = (sale ? SALE_CLAUSES : LEASE_CLAUSES)(d)
  const special = d.special.split('\n').map((x) => x.trim()).filter(Boolean)
  const party = (role: string, p: Party) => `<tr><th rowspan="3">${role}</th><th>주소</th><td colspan="3">${esc(p.address)}</td><td rowspan="3" class="sign">(인)</td></tr><tr><th>주민등록번호</th><td class="w"></td><th>전화</th><td class="w">${esc(p.phone)}</td></tr><tr><th>성명</th><td colspan="3">${esc(p.name)}</td></tr>`
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>${title}</title><style>
@page{size:A4;margin:14mm}*{box-sizing:border-box}body{font-family:'Malgun Gothic','Apple SD Gothic Neo','Noto Sans KR',sans-serif;font-size:10.5pt;line-height:1.55;color:#000;margin:0;padding:12px}
h1{text-align:center;font-size:19pt;letter-spacing:.3em;margin:0 0 10px}p{margin:4px 0}
table{width:100%;border-collapse:collapse;margin:4px 0 8px}th,td{border:1px solid #000;padding:4px 7px;vertical-align:middle}th{background:#f1f1f1;font-weight:600;white-space:nowrap;text-align:center;width:1%}
.sec{font-weight:700;margin-top:8px}.cl b{font-weight:700}.cl{margin:3px 0;text-align:justify}.sp{min-height:60px;border:1px solid #000;padding:6px 8px}.sp li{margin-left:14px}
.w{width:32%}.sign{width:46px;text-align:center;color:#555}.date{text-align:center;margin:10px 0 6px;font-weight:600}.draft{font-size:8.5pt;color:#666;text-align:right;margin-bottom:4px}
@media print{body{padding:0}.draft{display:none}}
</style></head><body>
<p class="draft">초안 · 서명 전 협회 서식 및 최신 법령과 대조하세요</p>
<h1>${title}</h1>
<p>${A}과 ${B} 쌍방은 아래 표시 부동산에 관하여 다음 계약 내용과 같이 ${sale ? '매매' : '임대차'}계약을 체결한다.</p>
<p class="sec">1. 부동산의 표시</p>
<table><tr><th>소재지</th><td colspan="5">${esc(d.address)}</td></tr>
<tr><th>토지</th><th>지목</th><td>${esc(d.landCategory)}</td><th>면적</th><td colspan="2">${esc(d.landArea)}</td></tr>
<tr><th>건물</th><th>구조·용도</th><td>${esc(d.structure)}</td><th>면적</th><td colspan="2">${d.area ? `${esc(d.area)} ㎡` : ''}</td></tr></table>
<p class="sec">2. 계약 내용</p>
<p class="cl"><b>제1조 (목적)</b> 위 부동산의 ${sale ? '매매' : '임대차'}에 ${sale ? '대하여 매도인과 매수인은' : '한하여 임대인과 임차인은'} 합의에 의하여 ${sale ? '매매대금을' : '임차보증금 및 차임을'} 아래와 같이 지불하기로 한다.</p>
<table>${pay.map(([k, v]) => `<tr><th>${k}</th><td>${v}</td></tr>`).join('')}</table>
${clauses.map(([h, t]) => `<p class="cl"><b>${h}</b> ${t}</p>`).join('')}
<p class="sec">특약사항</p>
<div class="sp">${special.length ? `<ol>${special.map((x) => `<li>${esc(x)}</li>`).join('')}</ol>` : '&nbsp;'}</div>
<p>본 계약을 증명하기 위하여 계약 당사자가 이의 없음을 확인하고 각각 서명·날인 후 ${A}, ${B} 및 개업공인중개사는 매장마다 간인하여야 하며, 각각 1통씩 보관한다.</p>
<p class="date">${ymd(c.contractDate)}</p>
<table>${party(A, d.seller)}${party(B, d.buyer)}
<tr><th rowspan="3">개업<br>공인중개사</th><th>사무소 소재지</th><td colspan="4">${esc(s.officeAddress ?? '')}</td></tr>
<tr><th>사무소 명칭</th><td>${esc(s.office)}</td><th>등록번호</th><td colspan="2">${esc(s.officeRegNo ?? '')}</td></tr>
<tr><th>대표</th><td>${esc(s.officeRep ?? '')} &nbsp; (서명 및 인)</td><th>전화</th><td colspan="2">${esc(s.officePhone ?? '')}</td></tr></table>
</body></html>`
}

export type { Deal }
