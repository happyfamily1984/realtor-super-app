// 네이버 부동산 매물(호가). 클라우드에서는 네이버가 열리지 않아, 사람이나 다른 AI가 받아서 inbox/naver/<단지id>.json 으로 넣어 둠.
// 형식은 inbox/naver/README.md. 느슨하게 읽음: 금액은 만원 숫자나 "6억 7,000" 같은 글자 모두 받음.
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { eok } from './summary.js';

const median = (a) => { const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2); };
const TYPES = { 매매: 'trade', 전세: 'jeonse', 월세: 'monthly', trade: 'trade', jeonse: 'jeonse', monthly: 'monthly', A1: 'trade', B1: 'jeonse', B2: 'monthly' };

/** "6억 7,000" · "67000" · 67000 · "9,500만" → 만원 */
export function parsePrice(v) {
  if (typeof v === 'number') return Math.round(v);
  const s = String(v ?? '').replace(/[,\s원]/g, '');
  if (!s) return 0;
  const m = s.match(/^(?:(\d+(?:\.\d+)?)억)?(?:(\d+)천)?(\d+)?만?$/);
  if (!m) return Math.round(Number(s)) || 0;
  return Math.round(Number(m[1] || 0) * 10000 + Number(m[2] || 0) * 1000 + Number(m[3] || 0));
}

export function normalizeListing(l) {
  const type = TYPES[String(l.type ?? l.거래 ?? '').trim()] ?? null;
  // 같은 집을 묶어 보여줄 때는 "8억 5,000~9억"처럼 범위로 나옴 → 낮은 값을 호가로, 높은 값은 priceMax로
  const [lo, hi] = String(l.price ?? l.가격 ?? l.deposit ?? l.보증금 ?? '').split('~').map((x) => x.trim());
  const one = (v) => { const m = String(v ?? '').match(/^(.+)\/\s*([\d,]+)$/); return m ? [parsePrice(m[1]), parsePrice(m[2])] : [parsePrice(v), 0]; }; // "5,000/130" 꼴의 월세
  let [price, rent] = typeof (l.price ?? l.가격) === 'number' ? [Math.round(l.price ?? l.가격), 0] : one(lo);
  if (!rent) rent = parsePrice(l.rent ?? l.월세 ?? 0);
  const priceMax = hi ? one(hi)[0] : price;
  const area = Number(String(l.area ?? l.전용 ?? l.전용면적 ?? '').replace(/[^\d.]/g, '')) || 0;
  if (!type || !price || !area) return null;
  return {
    type, area, price, priceMax, rent, floor: String(l.floor ?? l.층 ?? ''), dong: String(l.dong ?? l.동 ?? ''), direction: String(l.direction ?? l.향 ?? ''),
    memo: String(l.memo ?? l.설명 ?? '').slice(0, 120), confirmedAt: String(l.confirmedAt ?? l.확인일 ?? ''), articleNo: String(l.articleNo ?? l.매물번호 ?? ''),
  };
}

/** inbox/naver 의 파일을 읽어 단지 id → { capturedAt, source, items } */
export function readInbox(dir) {
  const out = {}, problems = [];
  if (!existsSync(dir)) return { out, problems };
  for (const f of readdirSync(dir).filter((f) => f.endsWith('.json'))) {
    try {
      const j = JSON.parse(readFileSync(join(dir, f), 'utf8'));
      const raw = j.listings ?? j.매물 ?? [];
      const items = raw.map(normalizeListing).filter(Boolean);
      if (raw.length !== items.length) problems.push(`${f}: 매물 ${raw.length}건 중 ${raw.length - items.length}건은 거래·전용면적·가격이 없어 뺌`);
      out[f.replace(/\.json$/, '')] = { capturedAt: String(j.capturedAt ?? j.받은날 ?? ''), source: String(j.source ?? '네이버 부동산'), items };
    } catch (e) { problems.push(`${f}: 읽지 못함 (${e.message})`); }
  }
  return { out, problems };
}

/** 거래 종류·면적별 호가 요약 + 실거래 중간값과의 차이. analysis: main.js analyze() 결과 */
export function summarizeListings(box, analysis, today) {
  const days = box.capturedAt ? Math.round((Date.parse(today) - Date.parse(box.capturedAt)) / 86400e3) : null;
  const groups = new Map();
  // 네이버는 전용면적을 소수점 없이 보여줌(49.68 → 49) → 실거래 면적 가운데 같은 것을 찾아 그 면적으로 묶음
  // 후보가 여럿이면 거래가 많은 면적으로
  const areaOf = (v) => (analysis?.areas ?? []).filter((x) => x.exact.some((e) => Math.abs(e - v) < 0.6 || Math.floor(e) === v))
    .sort((p, q) => q.trade.count12 + q.jeonse.count12 - (p.trade.count12 + p.jeonse.count12))[0]?.area ?? Math.round(v);
  for (const l of box.items) { const k = `${l.type}|${areaOf(l.area)}`; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(l); }
  const rows = [...groups].map(([k, ls]) => {
    const [type, a] = k.split('|'); const area = Number(a);
    const ref = analysis?.areas.find((x) => x.area === area);
    // 비교 기준: 최근 3개월 실거래가 3건 이상이면 그 중간값, 아니면 최근 1년 중간값 (오르내림이 빠를 때 1년치는 낡은 값이라)
    const side = type === 'trade' ? ref?.trade : type === 'jeonse' ? ref?.jeonse : null;
    const recent = (side?.count3 ?? 0) >= 3;
    const base = side ? (recent ? side.median3 : side.median12) : 0;
    const prices = ls.map((l) => l.price);
    return { type, area, count: ls.length, min: Math.min(...prices), median: median(prices), max: Math.max(...prices), medianRent: type === 'monthly' ? median(ls.map((l) => l.rent)) : 0, dealMedian: base || 0, dealBasis: base ? (recent ? '최근 3개월' : '최근 1년') : '', gapPct: base ? Math.round((median(prices) / base - 1) * 1000) / 10 : null };
  }).sort((p, q) => p.type.localeCompare(q.type) * -1 || p.area - q.area);
  return { capturedAt: box.capturedAt, source: box.source, daysOld: days, stale: days == null || days > 7, total: box.items.length, rows, items: box.items };
}

const LABEL = { trade: '매매', jeonse: '전세', monthly: '월세' };
export function listingInsights(s) {
  if (!s.total) return [];
  const head = `매물(호가) ${s.total}건 · ${s.source} ${s.capturedAt || '날짜 없음'} 기준${s.stale ? ' (7일 넘음, 새로 받아야 함)' : ''}`;
  return [head, ...s.rows.filter((r) => r.type !== 'monthly').slice(0, 6).map((r) =>
    `${LABEL[r.type]} 호가 전용 ${r.area}㎡: ${eok(r.min)}~${eok(r.max)} (${r.count}건, 중간 ${eok(r.median)})${r.gapPct != null ? ` · ${r.dealBasis} 실거래 중간값 ${eok(r.dealMedian)}보다 ${r.gapPct > 0 ? '+' : ''}${r.gapPct}%` : ''}`)];
}
