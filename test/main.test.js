import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { matchComplex, normalizeItem, parseDetail, searchCourt } from '../collector/auction.js';
import { parsePrice, normalizeListing, summarizeListings, listingInsights, dedupe, suspectPrompt } from '../collector/listings.js';
import { analyze, dealsOf, insights, complexPost, auctionPost, refFor, complexId } from '../collector/main.js';

const cfg = JSON.parse(readFileSync(new URL('../config/main-complexes.json', import.meta.url), 'utf8'));
const silla = cfg.complexes.find((c) => c.id === 'hangaram-silla');
// 2026-11-21 법원경매정보에서 실제로 받은 물건 (필요한 칸만)
const RAW = { boCd: 'B000254', saNo: '20250130101547', maemulSer: '1', srnSaNo: '2025타경101547', gamevalAmt: '383000000', minmaePrice: '383000000', yuchalCnt: '0', maeGiil: '20261201', maegyuljGiil: '20261208', maeHh1: '1000', maePlace: '제104호입찰법정', hjguDong: '관양동', daepyoLotno: '1589-1', buldNm: '한가람아파트', buldList: '404동 3층305호', areaList: '철근콘크리트조\n45.80㎡', jiwonNm: '안양지원', jpDeptNm: '경매3계', tel: '031-8086-1283(1층 민사신청과내)', rdAddrSub: '(관양동,한가람아파트)', dspslUsgNm: '아파트', printSt: '경기도 안양시 동안구 관양동 1589-1 한가람아파트 404동 3층305호' };

test('경매 물건을 법정동+지번으로 단지에 맞춤 (이름이 "한가람아파트"뿐이어도)', () => {
  assert.equal(matchComplex(RAW, cfg.complexes).id, 'hangaram-silla');
  assert.equal(matchComplex({ ...RAW, daepyoLotno: '1589' }, cfg.complexes).id, 'hangaram-segyeong');
  assert.equal(matchComplex({ ...RAW, daepyoLotno: '900', buldNm: '다른아파트', printSt: '경기도 안양시 동안구 관양동 900', rdAddrSub: '' }, cfg.complexes), null);
  assert.equal(matchComplex({ hjguDong: '관양동', daepyoLotno: '1', buldNm: '평촌 아크로타워', printSt: '', rdAddrSub: '' }, cfg.complexes).id, 'acro-tower');
  // 오피스텔: 지번으로도 찾음. 옆 단지(1591-6 푸르지오센트럴파크)는 걸리지 않음
  assert.equal(matchComplex({ hjguDong: '관양동', daepyoLotno: '1591', buldNm: '', printSt: '경기도 안양시 동안구 관양동 1591 5층501호', rdAddrSub: '' }, cfg.complexes).id, 'acro-tower');
  assert.equal(matchComplex({ hjguDong: '관양동', daepyoLotno: '1591-6', buldNm: '평촌푸르지오센트럴파크', printSt: '', rdAddrSub: '' }, cfg.complexes), null);
  assert.equal(matchComplex({ hjguDong: '관양동', daepyoLotno: '1588-18', buldNm: '', printSt: '', rdAddrSub: '' }, cfg.complexes).id, 'hillstate-pyeongchon');
  assert.equal(matchComplex({ hjguDong: '관양동', daepyoLotno: '9', buldNm: '힐스테이트에코평촌', printSt: '', rdAddrSub: '' }, cfg.complexes).id, 'hillstate-pyeongchon');
});

test('경매 물건 정리: 금액·비율·날짜·면적', () => {
  const it = normalizeItem(RAW);
  assert.deepEqual([it.id, it.caseNo, it.appraisal, it.minRate, it.failCount, it.saleDate, it.saleTime, it.area, it.unit],
    ['B000254-20250130101547-1', '2025타경101547', 383000000, 100, 0, '2026-12-01', '10:00', 45.8, '404동 3층305호']);
});

test('상세: 인수 권리·기일·감정평가 요점', () => {
  const d = parseDetail({
    csBaseInfo: { csNm: '부동산임의경매', csRcptYmd: '20251103', clmAmt: 91220406 },
    dspslGdsDxdyInfo: { ndstrcRghCtt: '임차권등기 있음', tprtyRnkHypthcStngDts: '2023.02.23. 근저당권' },
    gdsDspslDxdyLst: [{ dxdyYmd: '20261201', dxdyHm: '1000', auctnDxdyKndCd: '01', tsLwsDspslPrc: 383000000 }],
    aeeWevlMnpntLst: [{ aeeWevlMnpntCtt: '&amp;quot;안양시청&amp;quot; 북측 인근' }],
    rgltLandLstAll: [[{ landArDts: '33650.4㎡', landLdcgDts: '대', rgltRateNmrtVal: '28.569' }]],
  });
  assert.deepEqual([d.caseName, d.receivedDate, d.claim, d.rights, d.topPriority], ['부동산임의경매', '2025-11-03', 91220406, '임차권등기 있음', '2023.02.23. 근저당권']);
  assert.deepEqual(d.schedule[0], { date: '2026-12-01', time: '10:00', kind: '매각기일', place: '', result: '', minPrice: 383000000, soldPrice: 0 });
  assert.equal(d.appraisalNotes[0], '"안양시청" 북측 인근');
  assert.equal(d.landShare, '대 33650.4㎡ 중 28.569');
});

test('법원 검색: 40건씩 끝까지 받음', async () => {
  let calls = 0;
  const fetchFn = async (url, init) => {
    calls++;
    const page = JSON.parse(init.body).dma_pageInfo.pageNo;
    assert.equal(JSON.parse(init.body).dma_srchGdsDtlSrchInfo.cortOfcCd, 'B000254');
    return { status: 200, text: async () => JSON.stringify({ data: { dlt_srchResult: Array(page === 1 ? 40 : 3).fill(RAW) } }) };
  };
  assert.equal((await searchCourt('B000254', { fetchFn, pause: 0 })).length, 43);
  assert.equal(calls, 2);
});

const deal = (o) => ({ type: 'trade', aptNm: '한가람(신라)', umdNm: '관양동', jibun: '1589-1', buildYear: 1992, area: 45.8, floor: 5, canceled: false, ...o });
const DEALS = [
  deal({ price: 44000, date: '2026-10-01' }), deal({ price: 46000, date: '2026-06-10', floor: 9 }), deal({ price: 40000, date: '2025-07-01' }),
  deal({ price: 99000, date: '2026-09-01', canceled: true }), deal({ price: 73000, date: '2026-08-01', area: 59.76 }),
  deal({ type: 'jeonse', deposit: 23000, date: '2026-09-15' }), deal({ type: 'monthly', deposit: 2000, monthlyRent: 70, date: '2026-09-20' }),
  deal({ price: 50000, date: '2026-10-05', jibun: '1589', aptNm: '한가람(세경)' }),
];

test('단지 분석: 면적별 중간값·1년 전 대비·전세가율, 취소 거래 제외', () => {
  const a = analyze(silla, dealsOf(silla, DEALS), '2026-11-21');
  assert.equal(a.aptNm, '한가람(신라)');
  assert.equal(a.complexId, complexId('41173', '관양동', '1589-1', '한가람(신라)'));
  assert.match(a.complexId, /^[0-9a-f]{12}$/);
  const x = a.areas.find((r) => r.area === 46);
  assert.deepEqual([x.trade.count12, x.trade.median12, x.trade.prevMedian, x.trade.changePct, x.trade.high.price, x.jeonse.median12, x.jeonseRate], [2, 45000, 40000, 12.5, 46000, 23000, 51]);
  assert.deepEqual(a.counts, { trade12: 3, tradePrev: 1, jeonse12: 1, monthly12: 1, canceled12: 1 });
  assert.equal(a.recentTrades.length, 5); // 취소 건도 내역에는 보임
  assert.match(insights(silla, a).join('\n'), /전용 46㎡ 매매 중간값 4\.5억 \(2건, 4\.4억~4\.6억\) · 1년 전보다 \+12\.5% · 전세가율 51%/);
  assert.deepEqual(refFor(a, 45.8), { median12: 45000, count12: 2, last: { price: 44000, date: '2026-10-01', floor: 5 } });
  assert.equal(refFor(a, 84.9), null);
});

test('실거래 고르기: 지번이 같거나 이름 낱말이 맞으면 그 단지', () => {
  const hill = cfg.complexes.find((c) => c.id === 'hillstate-pyeongchon');
  const ds = [{ aptNm: '힐스테이트 에코 평촌', umdNm: '관양동', jibun: '0' }, { aptNm: '이름없음', umdNm: '관양동', jibun: '1588-18' }, { aptNm: '공작아파트', umdNm: '관양동', jibun: '1588' }, { aptNm: '비산힐스테이트', umdNm: '비산동', jibun: '1' }];
  assert.equal(dealsOf(hill, ds).length, 2);
  assert.equal(dealsOf(cfg.complexes.find((c) => c.id === 'gongjak-buyoung'), ds).length, 1);
});

test('올릴 글: 단지 분석과 경매 (스레드 500자 이내, 블로그 소제목, 카드)', () => {
  const a = analyze(silla, dealsOf(silla, DEALS), '2026-11-21');
  const p = complexPost(silla, a, '2026-11-21');
  assert.ok(p.thread.length <= 500);
  assert.match(p.blog.title, /^동안구 관양동 한가람신라 실거래가/);
  assert.ok(p.blog.body.includes('■ 면적별 매매가') && p.blog.body.includes('■ 한눈에 정리'));
  const it = { ...normalizeItem(RAW), rights: '임차권등기 있음(임대차보증금 260,000,000원)', topPriority: '2023.02.23. 근저당권', caseName: '부동산임의경매' };
  const q = auctionPost(silla, it, refFor(a, it.area), '2026-11-21');
  assert.ok(q.thread.length <= 500);
  assert.match(q.thread, /감정가 3\.83억 · 최저가 3\.83억\(100%\)/);
  assert.match(q.thread, /매각기일 2026-12-01\(화\) 10:00/);
  assert.match(q.thread, /실거래 중간값 4\.5억 \(2건\) → 최저가는 그 85%/);
  assert.match(q.blog.title, /한가람신라 45\.8㎡ 경매 \| 최저가 3\.83억, 매각기일 12월 1일 \(2025타경101547\)/);
  assert.equal(q.cards.length, 3);
  assert.ok(q.talk.split('\n').length <= 4);
});

test('네이버 매물: 금액 글자 읽기, 호가 요약과 실거래 대비', () => {
  assert.deepEqual(['6억 7,000', '67000', 67000, '9,500만', '4.5억', '12억'].map(parsePrice), [67000, 67000, 67000, 9500, 45000, 120000]);
  assert.deepEqual([normalizeListing({ type: '월세', area: '37.85㎡', price: '1,000/80' })].map((l) => [l.type, l.area, l.price, l.rent]), [['monthly', 37.85, 1000, 80]]);
  assert.equal(normalizeListing({ type: '매매', price: '5억' }), null); // 면적 없음
  assert.deepEqual([normalizeListing({ type: '매매', area: 50, price: '8억 5,000~9억' })].map((l) => [l.price, l.priceMax]), [[85000, 90000]]);
  assert.deepEqual([normalizeListing({ type: '월세', area: 34, price: '8,000/65~1억/55' })].map((l) => [l.price, l.rent, l.priceMax]), [[8000, 65, 10000]]);
  assert.deepEqual([normalizeListing({ type: '전세', area: 50, price: 30000 })].map((l) => [l.price, l.priceMax, l.rent]), [[30000, 30000, 0]]);
  const a = analyze(silla, dealsOf(silla, DEALS), '2026-11-21');
  const items = [{ type: '매매', area: 45.8, price: '4억 8,000' }, { type: '매매', area: 45.8, price: 50000 }, { type: '전세', area: 45.8, price: '2억 5,000' }].map(normalizeListing);
  const s = summarizeListings({ capturedAt: '2026-11-20', source: '네이버 부동산', items }, a, '2026-11-21');
  assert.equal(s.stale, false);
  const t = s.rows.find((r) => r.type === 'trade');
  assert.deepEqual([t.area, t.count, t.min, t.median, t.dealMedian, t.gapPct], [46, 2, 48000, 49000, 45000, 8.9]);
  assert.equal(listingInsights(s)[1], '매매 호가 전용 46㎡: 4.8억~5억 (2건, 중간 4.9억) · 최근 1년 실거래 중간값 4.5억보다 +8.9%');
  // 네이버 표기 45㎡(소수점 버림)도 실거래 45.8㎡(46㎡)와 같은 면적으로 묶임
  const cut = summarizeListings({ capturedAt: '2026-11-20', source: 'x', items: [normalizeListing({ type: '매매', area: 45, price: '5억' })] }, a, '2026-11-21');
  assert.deepEqual([cut.rows[0].area, cut.rows[0].dealMedian], [46, 45000]);
  assert.equal(summarizeListings({ capturedAt: '2026-11-01', source: 'x', items }, a, '2026-11-21').stale, true);
  assert.ok(complexPost(silla, a, '2026-11-21', listingInsights(s)).blog.body.includes('■ 지금 나와 있는 매물 (호가)'));
});

test('네이버 매물 중복: 매물번호가 같으면 하나로, 다르면 둘 다, 비어 있으면 의심으로 표시', () => {
  const base = { type: '매매', area: 66, price: '3억 9,500', floor: '27/42', dong: 'A동' };
  const n = (o) => normalizeListing({ ...base, ...o });
  assert.equal(dedupe([n({ articleNo: '1' }), n({ articleNo: '1' })]).length, 1);
  assert.deepEqual(dedupe([n({ articleNo: '1' }), n({ articleNo: '2' })]).map((l) => l.suspect), [false, false]);
  assert.deepEqual(dedupe([n({}), n({})]).map((l) => l.suspect), [true, true]);
  assert.deepEqual(dedupe([n({}), n({ floor: '3/42' })]).map((l) => l.suspect), [false, false]); // 층이 다르면 다른 집
  const text = suspectPrompt({ '평촌아크로타워 → acro-tower.json': dedupe([n({}), n({}), n({ floor: '3/42' })]) });
  assert.match(text, /■ 평촌아크로타워 → acro-tower\.json \(2건\)\n- 매매 · 전용 66㎡ · A동 · 27\/42층 · 3\.95억/);
  assert.equal(suspectPrompt({ a: dedupe([n({ articleNo: '1' })]) }), '');
});
