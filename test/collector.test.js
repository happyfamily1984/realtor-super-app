import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseXml, normalize, findRegion, recentYms, fetchMonth } from '../collector/molit.js';
import { Store } from '../collector/store.js';
import { byComplex, byMonth, eok } from '../collector/summary.js';

const item = (o) => `<item>${Object.entries(o).map(([k, v]) => `<${k}>${v}</${k}>`).join('')}</item>`;
const xml = (items, total = items.length) =>
  `<?xml version="1.0"?><response><header><resultCode>000</resultCode><resultMsg>OK</resultMsg></header><body><items>${items.join('')}</items><totalCount>${total}</totalCount></body></response>`;
const T = { aptNm: '은마', umdNm: '대치동', jibun: '316', buildYear: 1979, excluUseAr: '76.79', floor: 14, dealYear: 2026, dealMonth: 11, dealDay: 3, dealAmount: '312,000', aptDong: ' ', dealingGbn: '중개거래', cdealType: ' ', cdealDay: ' ' };

test('매매 응답을 읽어 만원 단위로 정리', () => {
  const d = normalize('trade', parseXml(xml([item(T)])).items[0]);
  assert.deepEqual([d.type, d.aptNm, d.price, d.area, d.date, d.canceled], ['trade', '은마', 312000, 76.79, '2026-11-03', false]);
});

test('전월세: 월세가 있으면 monthly, 없으면 jeonse / 취소 거래 표시', () => {
  const r = { ...T, deposit: '50,000', monthlyRent: '0', contractType: '신규' };
  assert.equal(normalize('rent', r).type, 'jeonse');
  assert.equal(normalize('rent', { ...r, monthlyRent: '120' }).type, 'monthly');
  assert.equal(normalize('trade', { ...T, cdealType: 'O' }).canceled, true);
});

test('국토부 오류 응답은 오류로', () => {
  assert.throws(() => parseXml('<OpenAPI_ServiceResponse><cmmMsgHeader><returnAuthMsg>SERVICE_KEY_IS_NOT_REGISTERED_ERROR</returnAuthMsg></cmmMsgHeader></OpenAPI_ServiceResponse>'), /SERVICE_KEY/);
  assert.throws(() => parseXml('<response><header><resultCode>22</resultCode><resultMsg>LIMITED</resultMsg></header></response>'), /LIMITED/);
});

test('지역 찾기: 코드·이름·시도 포함 이름', () => {
  assert.equal(findRegion('강남구').code, '11680');
  assert.equal(findRegion('11680').name, '서울특별시 강남구');
  assert.equal(findRegion('성남시 분당구').code, '41135');
  assert.throws(() => findRegion('중구'), /여러 곳/);
  assert.equal(findRegion('서울 중구').code, '11140');
  assert.throws(() => findRegion('없는구'), /찾지 못함/);
});

test('최근 달: 한국 시각 기준, 해 넘김', () => {
  assert.deepEqual(recentYms(3, new Date('2026-01-31T16:00:00Z')), ['202602', '202601', '202512']);
});

test('여러 쪽으로 나뉜 응답을 모두 받음', async () => {
  const calls = [];
  const fetchFn = async (url) => { calls.push(url); const p = Number(url.match(/pageNo=(\d+)/)[1]); return { status: 200, text: async () => xml([item({ ...T, floor: p })], 2) }; };
  const deals = await fetchMonth('trade', '11680', '202611', { key: '', fetchFn });
  assert.equal(deals.length, 2);
  assert.match(calls[0], /\/molit\/trade\?LAWD_CD=11680&DEAL_YMD=202611/);
});

test('저장소: 넣기·새 자료 판별·오래된 자료 지우기', () => {
  const dir = mkdtempSync(join(tmpdir(), 'store-'));
  const s = new Store(dir);
  const t0 = new Date('2026-11-01T00:00:00Z');
  s.put('molit/trade/11680/202610.json', { kind: 'molit-trade', region: '11680' }, [{ a: 1 }], t0);
  s.save(t0);
  const s2 = new Store(dir);
  assert.equal(s2.read('molit/trade/11680/202610.json').rows.length, 1);
  assert.equal(s2.isFresh('molit/trade/11680/202610.json', 6, t0.getTime() + 5 * 3600e3), true);
  assert.equal(s2.isFresh('molit/trade/11680/202610.json', 6, t0.getTime() + 7 * 3600e3), false);
  assert.deepEqual(s2.prune(t0.getTime() + 31 * 86400e3), ['molit/trade/11680/202610.json']);
  assert.equal(existsSync(join(dir, 'molit/trade/11680/202610.json')), false);
  assert.equal(s2.index.items.length, 0);
});

test('간추리기: 취소 거래 빼고 단지·면적별, 달별', () => {
  const d = (price, date, extra = {}) => ({ type: 'trade', aptNm: '은마', umdNm: '대치동', area: 76.79, floor: 5, buildYear: 1979, price, date, canceled: false, ...extra });
  const deals = [d(300000, '2026-10-01'), d(320000, '2026-11-02'), d(310000, '2026-10-20'), d(999999, '2026-11-05', { canceled: true }), d(350000, '2026-11-01', { area: 84.43 })];
  const c = byComplex(deals, { apt: '은 마' });
  assert.deepEqual([c[0].area, c[0].count, c[0].median, c[0].max, c[0].maxDate, c[0].last.amount], [77, 3, 310000, 320000, '2026-11-02', 320000]);
  assert.deepEqual(byMonth(deals), [{ ym: '2026-10', count: 2, median: 305000 }, { ym: '2026-11', count: 2, median: 335000 }]);
  assert.equal(eok(312000), '31.2억');
  assert.equal(eok(9500), '9,500만');
});
