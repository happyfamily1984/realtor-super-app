// 제미나이 AI 분석
// POST /api/ai  { task: 'briefing' | 'contract' | 'listings', ... }
import { gemini, handler, HttpError, imagePart, type Part } from './_lib.js'

const images = (list: unknown, max: number): Part[] => {
  if (!Array.isArray(list)) return []
  if (list.length > max) throw new HttpError(400, `사진은 한 번에 ${max}장까지 분석할 수 있습니다`)
  return list.map((d) => imagePart(String(d)))
}

const BRIEFING = `당신은 한국 공인중개사의 부동산 오픈채팅방 운영을 돕는 분석가입니다.
아래 지역의 최근 아파트 매매 실거래와 뉴스 제목을 보고 오늘의 브리핑을 작성하세요.
- 주어진 자료에 있는 사실만 사용하고, 없는 수치나 사실을 지어내지 마세요.
- 가격 전망을 단정하거나 매수·매도를 권유하지 마세요.
- 쉬운 존댓말로 간결하게 쓰세요.
다음 JSON 으로만 답하세요:
{"comment":"시장 흐름 요약 2~3문장","points":["핵심 포인트(40자 이내)","...","..."],"news":[{"title":"입력된 뉴스 제목 그대로","summary":"이 뉴스가 지역 시장에 주는 의미 한 문장"}]}
points 는 3개, news 는 지역 부동산과 관련 깊은 순으로 최대 4개.`

const CONTRACT = `첨부한 사진은 한국의 부동산 계약서입니다. 내용을 읽어 아래 JSON 으로만 답하세요.
- 금액은 모두 "만원" 단위 정수 (예: 12억 5천만원 → 125000). 날짜는 YYYY-MM-DD.
- 읽을 수 없거나 없는 항목은 문자열은 "", 숫자는 0 으로 두고 추측하지 마세요.
- 주민등록번호 등 고유식별번호는 절대 출력하지 마세요.
{"title":"소재지와 동·호수","deal":"매매|전세|월세","client":"예: 매수 홍길동 / 매도 김철수 (임대차는 임차/임대)","price":0,"downPayment":0,"contractDate":"","midDate":"","midAmount":0,"balanceDate":"","balanceAmount":0,"monthlyRent":0,"special":["특약사항을 한 항목씩 요약"],"summary":"계약 핵심 내용 2~3문장 요약","checks":["중개사가 잔금 전 확인할 사항"]}`

const LISTINGS = `아래는 공인중개사가 부동산 매물 목록 화면에서 직접 복사한 글 또는 화면 캡처입니다.
보이는 매물을 하나씩 정리해 아래 JSON 으로만 답하세요.
- 금액은 "만원" 단위 정수 (예: 12억 5,000 → 125000). price 는 매매가/전세가/월세 보증금, rent 는 월세(없으면 0).
- area 는 전용면적 ㎡ 숫자(전용이 없으면 표시된 면적). 보이지 않는 값은 "" 또는 0 으로 두고 추측하지 마세요.
- 광고·메뉴 등 매물이 아닌 글은 무시하고, 같은 매물이 중복되면 한 번만 넣으세요.
{"listings":[{"complex":"단지 또는 건물명(동 포함 가능)","kind":"아파트|오피스텔|빌라|상가","deal":"매매|전세|월세","price":0,"rent":0,"area":0,"floor":"예: 12/20층, 고층","dir":"예: 남향","desc":"특징 한 줄"}]}`

export default handler(async (req) => {
  if (req.method !== 'POST') throw new HttpError(405, 'POST 로 요청해 주세요')
  const b = req.body ?? {}
  switch (b.task) {
    case 'briefing':
      return gemini([{ text: `${BRIEFING}\n\n자료:\n${JSON.stringify({ region: b.region, stats: b.stats, trades: b.trades, news: b.news }).slice(0, 20000)}` }])
    case 'contract': {
      const imgs = images(b.images, 4)
      if (!imgs.length) throw new HttpError(400, '계약서 사진을 먼저 첨부해 주세요')
      return gemini([{ text: CONTRACT }, ...imgs])
    }
    case 'listings': {
      const imgs = images(b.images, 6)
      const text = String(b.text ?? '').slice(0, 30000)
      if (!imgs.length && !text.trim()) throw new HttpError(400, '붙여넣은 글이나 캡처가 없습니다')
      return gemini([{ text: `${LISTINGS}${text ? `\n\n복사한 글:\n${text}` : ''}` }, ...imgs])
    }
    default:
      throw new HttpError(400, '알 수 없는 작업입니다')
  }
})
