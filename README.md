# 중개사 슈퍼앱 (초안)

공인중개사 사무소 업무를 한곳에서 처리하는 모바일 웹앱(PWA)입니다.

## 실행

```bash
npm install
npm run dev      # 개발 서버
npm run build    # 배포용 빌드 (dist/)
```

## 하단 5단 메뉴

| 메뉴 | 내용 |
| --- | --- |
| 홈 | 오늘 요약, 바로가기, 다가오는 일정, 사무소·지역 설정 |
| 브리핑 | 국토부 실거래 + 지역 뉴스, AI 분석, 카드뉴스(1080×1350 PNG) 생성·저장·공유 |
| 매물 | 매물 가져오기(캡처·복사한 글을 AI가 정리), 필터, 단지별 평균가·면적별 분포 차트 |
| 상담 | 상담 신청서 접수·상태 관리, 맞춤 매물 추천, PPT(.pptx) 생성 |
| 계약 | 계약·중도금·잔금 일정(D-day), 계약서 사진 보관, AI 계약서 정리, 알림 |

## 서버 기능 (Vercel)

`api/` 폴더가 Vercel Functions 로 배포됩니다. 키는 Vercel 프로젝트 → Settings → Environment Variables 에만 넣습니다.

| 변수 | 내용 |
| --- | --- |
| `MOLIT_SERVICE_KEY` | 공공데이터포털 "국토교통부_아파트 매매 실거래가 자료" 인증키 |
| `GEMINI_API_KEYS` | 제미나이 키 여러 개를 쉼표로 구분 (`키1,키2,키3`). 한도를 다 쓴 키는 건너뛰고 다음 키 사용 |
| `GEMINI_MODELS` | (선택) 쉼표로 구분한 모델 순서. 기본값 `gemini-3.1-flash-lite,gemini-3.5-flash-lite,gemini-flash-lite-latest,gemini-3.8-flash` — 한 모델에서 모든 키의 한도가 끝나면 다음 모델 사용 |
| `APP_PASSCODE` | (선택·권장) 접속 암호. 설정하면 앱의 홈 > 설정에 같은 암호를 넣어야 서버 기능이 동작 |

| 주소 | 내용 |
| --- | --- |
| `GET /api/trades?lawd=11440&dong=아현동` | 최근 3개월 아파트 매매 실거래 (직전 거래가 포함) |
| `GET /api/news?q=마포구 부동산` | 최근 7일 지역 뉴스 제목·언론사·링크 |
| `POST /api/ai` | `task`: `briefing`(시장 분석) · `contract`(계약서 사진 정리) · `listings`(매물 정리) |

키가 없거나 조회에 실패하면 브리핑은 샘플 데이터로 표시하고 화면에 이유를 알려 줍니다.
로컬에서는 `.env.local` 에 같은 변수를 넣고 `npm run dev` 하면 `/api` 도 함께 동작합니다.

## 아직 없는 기능

- 손님이 직접 접속하는 상담 신청 링크, 앱을 닫아도 오는 푸시 알림, 기기 간 데이터 공유 (데이터베이스 필요)
- 전월세 실거래, 아파트 외 유형 실거래

## 구조

- `src/App.tsx` — 하단 메뉴, 종료 확인
- `api/` — 서버 기능 (실거래·뉴스·AI)
- `src/lib/api.ts` — 서버 기능 호출
- `src/lib/nav.ts` — 뒤로가기 규칙 (창·선택 모드 취소 → 이전 화면 → 홈에서 종료 확인)
- `src/lib/cardnews.ts` — 카드뉴스 이미지 생성
- `src/lib/ppt.ts` — 매물 제안 PPT 생성
- `src/lib/match.ts` — 매물 추천 점수, 계약 일정 계산
- `src/pages/` — 메뉴별 화면

데이터(상담·계약·설정)는 기기 안(localStorage), 계약서 사진은 IndexedDB 에 저장됩니다.
