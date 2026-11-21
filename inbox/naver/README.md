# 네이버 매물 넣는 곳

네이버 부동산은 클라우드 수집기에서 열리지 않습니다. 그래서 매물(호가)은 사람이나 다른 AI가 받아서 이 폴더에 파일로 넣습니다.
넣어 두면 다음 수집(3시간마다) 때 메인 단지 분석에 합쳐져, 앱의 **내 단지 > 분석 요점**과 보고서에 "호가 vs 실거래"가 나옵니다.

## 파일 이름 (단지마다 하나, 받을 때마다 덮어씀)

| 단지 | 파일 |
| --- | --- |
| 힐스테이트 평촌역 더퍼스트 | `inbox/naver/hillstate-pyeongchon.json` |
| 평촌아크로타워 | `inbox/naver/acro-tower.json` |
| 공작부영아파트 | `inbox/naver/gongjak-buyoung.json` |
| 한가람세경 | `inbox/naver/hangaram-segyeong.json` |
| 한가람신라 | `inbox/naver/hangaram-silla.json` |
| 한가람한양 | `inbox/naver/hangaram-hanyang.json` |

## 형식

```json
{
  "capturedAt": "2026-11-21",
  "source": "네이버 부동산",
  "listings": [
    { "type": "매매", "area": 49.68, "price": "6억 9,000", "floor": "7/15", "dong": "304동", "direction": "남향", "memo": "올수리, 입주 협의", "confirmedAt": "2026-11-20", "articleNo": "2512345678" },
    { "type": "전세", "area": 49.68, "price": 30000 },
    { "type": "월세", "area": 37.85, "price": "1,000/80" }
  ]
}
```

- 꼭 있어야 하는 것: `type`(매매·전세·월세), `area`(전용면적 ㎡), `price`. 나머지는 있으면 넣습니다.
- `price`는 만원 숫자(`69000`)나 글자(`"6억 9,000"`) 모두 됩니다. 월세는 `"보증금/월세"`.
- `capturedAt`은 받은 날짜. 7일이 지나면 "새로 받아야 함"으로 표시됩니다.
- 중개사 이름·전화번호 같은 개인 정보는 넣지 않습니다.

## 다른 AI에게 시킬 때 쓰는 말

> 네이버 부동산에서 "(단지 이름)" 단지의 매매·전세·월세 매물을 전부 확인해서, 아래 JSON 형식으로만 답해줘.
> 같은 집이 여러 중개사에 중복으로 올라와 있으면 한 번만 넣어. 면적은 전용면적(㎡), 가격은 화면에 보이는 그대로.
> 형식: {"capturedAt":"오늘 날짜","source":"네이버 부동산","listings":[{"type":"매매","area":0,"price":"","floor":"","dong":"","direction":"","memo":"","confirmedAt":"","articleNo":""}]}

받은 답을 채팅에 붙여 주시면 제가 이 폴더에 넣습니다. 깃허브에서 직접 올려도 됩니다.
