# realtor-super-app
공인중개사 슈퍼앱

## 공용 임시저장소 (`store` 브랜치)

보고서를 쓸 때 근거로 쓸 자료를 모아 두는 곳입니다. 부동산뉴스파인더의 보고서함(`reports/reports.json`)에 올리는
보고서는 여기 모인 자료의 숫자만 씁니다.

| 자료 | 경로 | 받는 곳 |
| --- | --- | --- |
| 아파트 매매 실거래 | `molit/trade/<시군구코드>/<YYYYMM>.json` | 국토교통부 실거래가 API |
| 아파트 전월세 실거래 | `molit/rent/<시군구코드>/<YYYYMM>.json` | 국토교통부 실거래가 API |
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
