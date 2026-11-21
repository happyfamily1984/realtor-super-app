// 국토부 아파트 실거래 (매매 / 전월세) 받기.
// 키가 있으면(MOLIT_API_KEY) 국토부에 바로, 없으면 중계 서버를 거침 (부동산뉴스파인더 앱과 같은 길).
import { readFileSync } from 'node:fs';

export const PROXY = process.env.DEAL_PROXY_URL || 'https://apt-alert.k-rebirth7-03a.workers.dev';
const DIRECT = {
  trade: 'https://apis.data.go.kr/1613000/RTMSDataSvcAptTrade/getRTMSDataSvcAptTrade',
  rent: 'https://apis.data.go.kr/1613000/RTMSDataSvcAptRent/getRTMSDataSvcAptRent',
};

const REGIONS = JSON.parse(readFileSync(new URL('./regions.json', import.meta.url), 'utf8'));

/** "11680", "강남구", "서울 강남구", "성남시 분당구" → { code, name } */
export function findRegion(q) {
  const s = String(q).trim();
  const all = REGIONS.flatMap((r) => r.sigungu.map((g) => ({ code: g.code, name: `${r.sido} ${g.name}`, sido: r.sido, gu: g.name })));
  if (/^\d{5}$/.test(s)) return all.find((r) => r.code === s) ?? { code: s, name: s };
  const words = s.split(/\s+/);
  const hits = all.filter((r) => words.every((w) => r.name.includes(w)));
  const exact = hits.filter((r) => r.gu === words.at(-1) || r.gu.endsWith(' ' + words.at(-1)));
  const pick = exact.length ? exact : hits;
  if (pick.length === 1) return pick[0];
  if (!pick.length) throw new Error(`지역을 찾지 못함: ${s}`);
  throw new Error(`지역이 여러 곳: ${s} → ${pick.map((r) => `${r.name}(${r.code})`).join(', ')}`);
}

/** 이번 달 포함 최근 n개월 YYYYMM (한국 시각) */
export function recentYms(n, now = new Date()) {
  const k = new Date(now.getTime() + 9 * 3600 * 1000);
  let y = k.getUTCFullYear(), m = k.getUTCMonth() + 1;
  const out = [];
  for (let i = 0; i < n; i++) { out.push(`${y}${String(m).padStart(2, '0')}`); if (--m === 0) { m = 12; y--; } }
  return out;
}

const unesc = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');

export function parseXml(xml) {
  const tag = (src, t) => src.match(new RegExp(`<${t}>([\\s\\S]*?)</${t}>`))?.[1]?.trim() ?? '';
  if (xml.includes('<OpenAPI_ServiceResponse>')) throw new Error(`국토부 오류: ${tag(xml, 'returnAuthMsg') || tag(xml, 'errMsg')}`);
  const code = tag(xml, 'resultCode');
  if (code !== '00' && code !== '000') throw new Error(`국토부 오류: ${tag(xml, 'resultMsg')} (${code})`);
  const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((m) => {
    const o = {};
    for (const f of m[1].matchAll(/<(\w+)>([\s\S]*?)<\/\1>/g)) o[f[1]] = unesc(f[2]).trim();
    return o;
  });
  return { items, totalCount: Number(tag(xml, 'totalCount')) || 0 };
}

const num = (s) => Number(String(s ?? '').replace(/,/g, '').trim()) || 0;
const ymd = (it) => `${it.dealYear}-${String(it.dealMonth).padStart(2, '0')}-${String(it.dealDay).padStart(2, '0')}`;

/** 금액은 모두 만원. 앱(Deals.kt)과 같은 이름을 씀 */
export function normalize(api, it) {
  const base = {
    aptNm: it.aptNm ?? '', umdNm: it.umdNm ?? '', jibun: it.jibun ?? '',
    buildYear: num(it.buildYear) || null, area: num(it.excluUseAr), floor: num(it.floor), date: ymd(it),
  };
  if (api === 'trade') {
    return {
      type: 'trade', ...base, price: num(it.dealAmount), dong: it.aptDong ?? '', dealingGbn: it.dealingGbn ?? '',
      canceled: (it.cdealType ?? '').trim() === 'O', cancelDate: it.cdealDay ?? '',
    };
  }
  const rent = num(it.monthlyRent);
  return {
    type: rent > 0 ? 'monthly' : 'jeonse', ...base, deposit: num(it.deposit), monthlyRent: rent,
    contractType: it.contractType ?? '', contractTerm: it.contractTerm ?? '',
  };
}

/** 한 시군구의 한 달 거래 전부 */
export async function fetchMonth(api, lawdCd, ym, { key = process.env.MOLIT_API_KEY || '', fetchFn = fetch } = {}) {
  const all = [];
  for (let page = 1; page <= 50; page++) {
    const params = `LAWD_CD=${lawdCd}&DEAL_YMD=${ym}&pageNo=${page}&numOfRows=1000`;
    const k = /%[0-9A-Fa-f]{2}/.test(key) ? key : encodeURIComponent(key);
    const url = key ? `${DIRECT[api]}?serviceKey=${k}&${params}` : `${PROXY}/molit/${api}?${params}`;
    let body = '';
    for (let tries = 0; ; tries++) {
      try {
        const res = await fetchFn(url, { signal: AbortSignal.timeout(30000) });
        body = (await res.text()).trimStart();
        if (body.startsWith('<')) break;
        throw new Error(body.startsWith('{') ? (JSON.parse(body).error ?? body) : `HTTP ${res.status}`);
      } catch (e) {
        if (tries >= 2) throw new Error(`실거래 받기 실패 (${api} ${lawdCd} ${ym}): ${e.message}`);
        await new Promise((r) => setTimeout(r, 1500 * (tries + 1)));
      }
    }
    const p = parseXml(body);
    all.push(...p.items);
    if (!p.items.length || all.length >= p.totalCount) break;
  }
  return all.map((it) => normalize(api, it));
}
