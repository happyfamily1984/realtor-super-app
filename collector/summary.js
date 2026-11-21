// 저장소에 모인 실거래를 보고서용으로 간추림 (취소 거래는 뺌)
const median = (a) => { const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2); };

/** 단지 + 전용면적(반올림 ㎡)별: 건수·중간값·최저·최고·가장 최근 거래. amount = 매매가 또는 보증금(만원) */
export function byComplex(deals, { type = 'trade', apt = '', dong = '' } = {}) {
  const groups = new Map();
  for (const d of deals) {
    if (d.type !== type || d.canceled) continue;
    if (apt && !d.aptNm.replace(/\s+/g, '').includes(apt.replace(/\s+/g, ''))) continue;
    if (dong && d.umdNm !== dong) continue;
    const k = `${d.umdNm}|${d.aptNm}|${Math.round(d.area)}`;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(d);
  }
  return [...groups.values()].map((g) => {
    const amt = (d) => (type === 'trade' ? d.price : d.deposit);
    const sorted = [...g].sort((a, b) => b.date.localeCompare(a.date));
    const top = g.reduce((a, b) => (amt(b) > amt(a) ? b : a));
    return {
      umdNm: g[0].umdNm, aptNm: g[0].aptNm, area: Math.round(g[0].area), buildYear: g[0].buildYear,
      count: g.length, median: median(g.map(amt)), min: Math.min(...g.map(amt)), max: amt(top), maxDate: top.date,
      last: { date: sorted[0].date, amount: amt(sorted[0]), floor: sorted[0].floor, monthlyRent: sorted[0].monthlyRent ?? 0 },
    };
  }).sort((a, b) => b.count - a.count);
}

/** 달별 건수·중간값 (지역 전체 흐름) */
export function byMonth(deals, { type = 'trade' } = {}) {
  const m = new Map();
  for (const d of deals) {
    if (d.type !== type || d.canceled) continue;
    const ym = d.date.slice(0, 7);
    if (!m.has(ym)) m.set(ym, []);
    m.get(ym).push(type === 'trade' ? d.price : d.deposit);
  }
  return [...m].sort().map(([ym, a]) => ({ ym, count: a.length, median: median(a) }));
}

export const eok = (man) => (man >= 10000 ? `${(man / 10000).toFixed(2).replace(/\.?0+$/, '')}억` : `${man.toLocaleString()}만`);
