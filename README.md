# realtor-super-app
공인중개사 슈퍼앱

메인 단지의 실거래·경매·네이버 매물 자료를 어떻게 모으고 앱에서 어떻게 받아 쓰는지는 **[docs/my-data.md](docs/my-data.md)** 에 정리돼 있습니다.

## 공용 임시저장소 (`store` 브랜치)

보고서를 쓸 때 근거로 쓸 자료를 모아 두는 곳입니다. 부동산뉴스파인더의 보고서함(`reports/reports.json`)에 올리는
보고서는 여기 모인 자료의 숫자만 씁니다.

| 자료 | 경로 | 받는 곳 |
| --- | --- | --- |
| 아파트 매매 실거래 | `molit/trade/<시군구코드>/<YYYYMM>.json` | 국토교통부 실거래가 API |
| 아파트 전월세 실거래 | `molit/rent/<시군구코드>/<YYYYMM>.json` | 국토교통부 실거래가 API |
| 메인 단지 분석·경매 | `main/my.json` | 위 실거래 + 법원경매정보 (3시간마다) |
| 법원 진행 물건 전체 | `auction/<법원코드>.json` | 법원경매정보 |
| 목록 | `index.json` | 어떤 자료가 언제 받아졌는지 |

- 파일 꼴: `{ kind, source, region, regionName, ym, fetchedAt, count, rows: [...] }`. 금액은 모두 만원.
  `rows`의 이름은 부동산뉴스파인더 앱(`Deals.kt`)과 같습니다 (`aptNm, umdNm, area, floor, date, price, deposit, monthlyRent, canceled …`).
- 임시 자료입니다. 받은 지 30일이 지나면 지워집니다. 이번 달·지난달은 6시간, 그 전 달은 7일이 지나야 새로 받습니다.
- 국토부 키는 저장소에 두지 않습니다. 키(`MOLIT_API_KEY` 시크릿)가 없으면 부동산뉴스파인더 앱과 같은 중계 서버를 거칩니다.

### 모으기

깃허브 Actions의 **collect**를 실행합니다 (시군구, 최근 몇 달, 종류). 끝나면 `store` 브랜치에 올라갑니다.

직접 돌릴 때:

```
node collector/collect.js molit --regions "강남구,성남시 분당구" --months 6
node collector/collect.js summary --regions 강남구 --months 6 --apt 은마          # 단지·면적별 건수·중간값·최고가
node collector/collect.js summary --regions 강남구 --months 6 --type jeonse
node collector/collect.js list
npm test
```

### 메인 단지

`config/main-complexes.json`에 적은 단지를 3시간마다 깊게 봅니다.

- 실거래 3년치를 면적별로 분석 (최근 1년 건수·중간값·최저·최고, 1년 전 대비, 전세가율, 월세, 최고가, 최근 내역)
- 관할 법원의 진행 물건 가운데 메인 단지 물건을 골라 상세(인수 권리, 기일, 감정평가 요점)까지 받음
- 단지 분석과 경매 물건마다 스레드·오픈톡·블로그·카드뉴스용 글을 미리 만들어 둠 (`post`, 보고서함과 같은 꼴)
- 오피스텔 실거래는 중계 서버에 없어 `MOLIT_API_KEY` 시크릿(오피스텔 매매·전월세 API 활용신청)이 있을 때만 받음
- 법원경매정보는 한국 밖에서 열리지 않아 깃허브 Actions에서만 돎: `node collector/collect.js main --auction false`로 실거래만 볼 수 있음
