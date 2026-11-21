# 메인 단지 자료 (실거래 · 경매 · 네이버 매물)

메인 단지 6곳을 깊게 보기 위한 자료가 어떻게 모이고, 어디서 받아 쓰는지 적은 문서입니다.
부동산뉴스파인더 앱의 **내 단지** 탭이 이 자료를 쓰고 있고, 중개사 슈퍼앱도 같은 주소에서 그대로 받아 쓰면 됩니다.

## 한눈에

| 자료 | 받는 곳 | 누가 | 주기 |
| --- | --- | --- | --- |
| 아파트 실거래 (매매·전월세) | 국토교통부 실거래가 API (중계 서버 경유) | 깃허브 Actions `collect` | 3시간마다 |
| 오피스텔 실거래 | 국토교통부 API (`MOLIT_API_KEY` 시크릿이 있을 때만) | 〃 | 〃 |
| 경매 물건 | 법원경매정보 (수원지방법원 안양지원) | 〃 | 〃 |
| 네이버 매물 (호가) | 네이버 부동산 화면 | 사람 또는 브라우저를 쓰는 AI가 `inbox/naver/`에 저장 | 받을 때마다 |

네이버 부동산은 클라우드에서 열리지 않습니다(2026-11-21 진단: 전부 시간 초과). 그래서 매물만은 브라우저로 받아 파일로 넣습니다.
법원경매정보는 반대로 한국 밖에서 열리지 않아 깃허브 Actions에서만 받습니다.

## 받아 쓰는 주소 (앱에서)

```
https://raw.githubusercontent.com/happyfamily1984/realtor-super-app/store/main/my.json
```

로그인 없이 받을 수 있습니다. 캐시를 피하려면 뒤에 `?t=<분 단위 시각>`을 붙입니다. 3시간마다, 그리고 `inbox/`에 파일이 올라올 때마다 새로 만들어집니다.

## my.json 꼴

금액 단위: 실거래·매물은 **만원**, 경매는 **원**.

```
{
  "generatedAt": "2026-11-21T03:15:43.840Z",   // 만든 시각
  "today": "2026-11-21",
  "court": "수원지방법원 안양지원",
  "notes": ["..."],                             // 화면 아래에 보여줄 알림 (자료를 못 받은 이유 등)
  "complexes": [ 단지 ],
  "auctions":  [ 경매 물건 ]
}
```

### 단지

| 칸 | 뜻 |
| --- | --- |
| `id`, `name`, `kind` | 단지 id, 표기 이름(국토부 이름과 다를 수 있음: 공작부영아파트 = 국토부 "공작아파트"), `apt`/`offi` |
| `aptNm`, `buildYear`, `umdNm`, `jibun`, `lawdCd`, `region` | 국토부 이름, 준공 연도, 법정동, 지번, 시군구 코드, 지역 |
| `complexId` | 부동산뉴스파인더 앱의 단지 식별값 (실거래 상세 화면으로 넘어갈 때 씀) |
| `hasData` | 실거래 분석이 있는지 (오피스텔은 국토부 키가 없으면 false) |
| `counts` | 최근 1년 매매·전세·월세 건수, 그 전 1년 매매 건수, 취소 건수 |
| `areas[]` | 면적별: `trade`(최근 3개월·1년 건수와 중간값, 최저·최고, 1년 전 대비 `changePct`, 3년 최고 `high`, 최근 거래 `last`), `jeonse`, `monthly`, `jeonseRate`(전세가율 %) |
| `monthly[]` | 달별 매매 건수·중간값 (3년) |
| `recentTrades[]`, `recentRents[]` | 최근 매매 15건(취소 포함), 전월세 12건 |
| `insights[]` | 사람이 읽는 분석 요점 줄 (호가 줄 포함). 그대로 화면에 보여주면 됨 |
| `listings` | 네이버 매물 요약 (없으면 null). 아래 참고 |
| `auctionCount` | 진행 중인 경매 물건 수 |
| `post` | 올릴 글 (아래 참고) |

`listings`: `capturedAt`(받은 날), `stale`(7일 넘음), `total`, `suspects`(중복 의심 건수),
`rows[]`(거래 종류·면적별 `count`, `min`, `median`, `max`, 비교 기준 `dealBasis`·`dealMedian`, 호가가 실거래보다 얼마나 높은지 `gapPct`),
`items[]`(매물 하나하나: `type`, `area`, `price`, `priceMax`, `rent`, `floor`, `dong`, `direction`, `memo`, `confirmedAt`, `articleNo`, `suspect`).

호가 비교 기준은 최근 3개월 실거래가 3건 이상이면 그 중간값, 아니면 최근 1년 중간값입니다.

### 경매 물건

| 칸 | 뜻 |
| --- | --- |
| `id` | `법원코드-사건번호-물건번호`. 알림을 한 번만 보내려면 `id|minPrice|saleDate`를 기억해 두고 비교 |
| `complexId`, `complexName` | 어느 메인 단지인지 (단지의 `id`) |
| `caseNo`, `court`, `dept`, `tel`, `caseName`, `receivedDate`, `claim` | 사건번호, 법원·계, 연락처, 사건명, 접수일, 청구금액 |
| `address`, `unit`, `area`, `usage`, `landShare` | 소재지, 동·호, 전용면적, 용도, 대지권 |
| `appraisal`, `minPrice`, `minRate`, `failCount` | 감정가, 최저가, 감정가 대비 %, 유찰 횟수 |
| `saleDate`, `saleTime`, `place`, `decisionDate`, `schedule[]` | 매각기일·장소, 매각결정기일, 기일 내역 |
| `rights`, `topPriority`, `specRemark`, `remark` | 매수인이 인수하는 권리, 최선순위 설정, 비고 (매각물건명세서) |
| `appraisalNotes[]` | 감정평가서 요점 |
| `firstSeen`, `gone`, `goneAt` | 처음 본 시각, 법원 목록에서 빠졌는지(매각·취하·기일 변경 등. 30일 뒤 지움) |
| `post` | 올릴 글 |

### 올릴 글 (`post`)

단지 분석과 경매 물건마다 미리 써 둔 글입니다. 부동산뉴스파인더의 보고서함과 같은 꼴입니다.

```
{ "title", "summary", "thread" (500자 이내), "talk" (오픈톡용 짧은 글),
  "blog": { "title", "body" (■ 소제목), "tags": [] },
  "cards": [ { "title", "points": ["항목: 내용"] } ],   // 카드뉴스로 그릴 내용
  "sources": [] }
```

## 네이버 매물 넣기

자세한 형식과 다른 AI에게 시킬 글은 [`inbox/naver/README.md`](../inbox/naver/README.md).

1. 브라우저를 쓰는 AI(또는 사람)가 네이버 부동산 화면에서 단지별 매물을 읽어 `inbox/naver/<단지 id>.json`으로 `main`에 저장
2. 파일이 올라오면 `collect`가 바로 돌아 몇 분 안에 `my.json`에 반영
3. 중복 의심 매물이 있으면 `node collector/collect.js dupes`로 그 매물만 뽑아, 매물번호를 받아 오게 시킴

**매물번호 규칙**: 매물번호는 전부 받지 않습니다(양이 많고 비용이 큼). 거래·면적·가격·층·동이 완전히 같아 **중복이 의심되는 매물만** 받아 옵니다.

- 매물번호가 같으면 같은 집 → 하나만 남김
- 매물번호가 서로 다르면 다른 집 → 둘 다 둠
- 매물번호가 비어 있으면 가려낼 수 없음 → 그대로 두고 `suspect: true`

## 메인 단지 바꾸기

[`config/main-complexes.json`](../config/main-complexes.json)을 고칩니다. 앱을 새로 깔 필요는 없습니다.

- `name`: 앱·보고서에 쓰는 이름
- `umdNm` + `jibun`: 법정동과 지번 (행정동이 아님. 부림동 → 관양동)
- `words`: 이름으로 찾을 낱말 묶음 (예: `["힐스테이트", "평촌역"]`). 실거래·경매 모두 지번이 같거나 낱말이 모두 들어 있으면 그 단지로 봄
- `court`: 경매를 받을 법원 (다른 지역 단지를 넣으면 법원 코드도 맞춰야 함)

## 직접 돌려 보기

```
node collector/collect.js main --auction false   # 실거래 분석 + 네이버 매물 (경매는 깃허브에서만 됨)
node collector/collect.js dupes                  # 중복 의심 매물 목록
npm test
```

## 아직 안 되는 것

- 오피스텔 실거래: 중계 서버에 오피스텔이 없음. 공공데이터포털에서 오피스텔 매매·전월세 실거래가 API를 활용신청하고 키를 `MOLIT_API_KEY` 시크릿으로 넣어야 함
- 네이버 매물이 전부 들어왔는지는 수집기가 확인하지 못함 (네이버 화면의 건수와 사람이 비교)
