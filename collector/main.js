// 메인 단지: 실거래 분석 + 경매 물건 → store 브랜치의 main/my.json (앱의 '내 단지' 탭과 보고서가 씀)
import { createHash } from 'node:crypto';
import { eok } from './summary.js';

const median = (a) => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2); };
const norm = (s) => String(s ?? '').replace(/[\s()·\-]/g, '');
const won = (w) => eok(Math.round(w / 10000));
const WEEK = ['일', '월', '화', '수', '목', '금', '토'];
const dayOf = (d) => (d ? `${d}(${WEEK[new Date(d + 'T00:00:00Z').getUTCDay()]})` : '');
const md = (d) => (d ? `${Number(d.slice(5, 7))}월 ${Number(d.slice(8, 10))}일` : '');
const pyeong = (a) => Math.round(a / 3.3058 * 1.3); // 전용 → 공급 평형 어림 (아파트)
const monthsAgo = (today, n) => { const d = new Date(today + 'T00:00:00Z'); d.setUTCMonth(d.getUTCMonth() - n); return d.toISOString().slice(0, 10); };

/** 앱(Deals.kt)과 같은 단지 식별값 → 앱의 단지 상세 화면을 바로 열 수 있음 */
export function complexId(lawdCd, umdNm, jibun, aptNm) {
  return createHash('sha1').update([lawdCd, (umdNm ?? '').trim(), (jibun ?? '').trim(), (aptNm ?? '').replace(/\s+/g, '')].join('|')).digest('hex').slice(0, 12);
}

export function dealsOf(cfg, deals) {
  return deals.filter((d) => (cfg.umdNm && cfg.jibun
    ? d.umdNm === cfg.umdNm && d.jibun === cfg.jibun
    : (cfg.words ?? []).some((ws) => ws.every((w) => norm(d.aptNm).includes(norm(w))))));
}

/** 한 단지의 실거래 분석. deals: 그 단지의 매매·전월세 (취소 포함), today: YYYY-MM-DD */
export function analyze(cfg, deals, today) {
  const live = deals.filter((d) => !d.canceled);
  const y1 = monthsAgo(today, 12), y2 = monthsAgo(today, 24);
  const amt = (d) => (d.type === 'trade' ? d.price : d.deposit);
  const of = (type) => live.filter((d) => d.type === type);
  const trades = of('trade');
  const sample = [...trades, ...live].sort((a, b) => b.date.localeCompare(a.date))[0];
  const areas = [...new Set(live.map((d) => Math.round(d.area)))].sort((a, b) => a - b).map((area) => {
    const pick = (type, from, to = '9999') => live.filter((d) => d.type === type && Math.round(d.area) === area && d.date >= from && d.date < to);
    const t12 = pick('trade', y1), tPrev = pick('trade', y2, y1), tAll = pick('trade', '0000');
    const j12 = pick('jeonse', y1), m12 = pick('monthly', y1);
    const byDate = (l) => [...l].sort((a, b) => b.date.localeCompare(a.date));
    const high = tAll.length ? tAll.reduce((a, b) => (b.price > a.price ? b : a)) : null;
    const tm = median(t12.map(amt)), pm = median(tPrev.map(amt)), jm = median(j12.map(amt));
    return {
      area, exact: [...new Set(live.filter((d) => Math.round(d.area) === area).map((d) => d.area))].sort((a, b) => a - b),
      trade: {
        count12: t12.length, median12: tm, min12: t12.length ? Math.min(...t12.map(amt)) : 0, max12: t12.length ? Math.max(...t12.map(amt)) : 0,
        prevCount: tPrev.length, prevMedian: pm, changePct: tm && pm ? Math.round((tm / pm - 1) * 1000) / 10 : null,
        high: high && { price: high.price, date: high.date, floor: high.floor },
        last: byDate(tAll)[0] ? { price: byDate(tAll)[0].price, date: byDate(tAll)[0].date, floor: byDate(tAll)[0].floor } : null,
      },
      jeonse: { count12: j12.length, median12: jm, last: byDate(pick('jeonse', '0000'))[0] ? { deposit: byDate(pick('jeonse', '0000'))[0].deposit, date: byDate(pick('jeonse', '0000'))[0].date } : null },
      monthly: { count12: m12.length, medianDeposit: median(m12.map((d) => d.deposit)), medianRent: median(m12.map((d) => d.monthlyRent)) },
      jeonseRate: tm && jm ? Math.round((jm / tm) * 100) : null,
    };
  });
  const byYm = new Map();
  for (const d of trades) { const k = d.date.slice(0, 7); if (!byYm.has(k)) byYm.set(k, []); byYm.get(k).push(d.price); }
  const main = [...areas].sort((a, b) => b.trade.count12 - a.trade.count12 || b.jeonse.count12 - a.jeonse.count12)[0] ?? null;
  const row = (d) => ({ type: d.type, date: d.date, area: d.area, floor: d.floor, price: d.price ?? 0, deposit: d.deposit ?? 0, monthlyRent: d.monthlyRent ?? 0, canceled: !!d.canceled });
  return {
    aptNm: sample?.aptNm ?? '', buildYear: sample?.buildYear ?? null,
    complexId: sample && cfg.kind === 'apt' ? complexId(cfg.lawdCd, sample.umdNm, sample.jibun, sample.aptNm) : '',
    umdNm: sample?.umdNm ?? cfg.umdNm, jibun: sample?.jibun ?? cfg.jibun,
    counts: { trade12: trades.filter((d) => d.date >= y1).length, tradePrev: trades.filter((d) => d.date >= y2 && d.date < y1).length, jeonse12: of('jeonse').filter((d) => d.date >= y1).length, monthly12: of('monthly').filter((d) => d.date >= y1).length, canceled12: deals.filter((d) => d.canceled && d.date >= y1).length },
    mainArea: main?.area ?? null, areas,
    monthly: [...byYm].sort().map(([ym, a]) => ({ ym, count: a.length, median: median(a) })),
    recentTrades: [...deals.filter((d) => d.type === 'trade')].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 15).map(row),
    recentRents: [...live.filter((d) => d.type !== 'trade')].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 12).map(row),
  };
}

/** 분석을 사람이 읽는 줄로 */
export function insights(cfg, a) {
  const out = [];
  const c = a.counts;
  if (!a.areas.length) return ['최근 실거래 자료가 없어요.'];
  out.push(`최근 1년 매매 ${c.trade12}건 (그 전 1년 ${c.tradePrev}건${c.tradePrev ? `, ${c.trade12 >= c.tradePrev ? '+' : ''}${Math.round((c.trade12 / c.tradePrev - 1) * 100)}%` : ''}) · 전세 ${c.jeonse12}건 · 월세 ${c.monthly12}건`);
  for (const x of a.areas.filter((x) => x.trade.count12 > 0)) {
    const t = x.trade;
    out.push(`전용 ${x.area}㎡ 매매 중간값 ${eok(t.median12)} (${t.count12}건, ${eok(t.min12)}~${eok(t.max12)})${t.changePct != null ? ` · 1년 전보다 ${t.changePct > 0 ? '+' : ''}${t.changePct}%` : ''}${x.jeonseRate ? ` · 전세가율 ${x.jeonseRate}%` : ''}`);
  }
  const hi = a.areas.filter((x) => x.trade.high).map((x) => ({ area: x.area, ...x.trade.high })).sort((p, q) => q.price - p.price)[0];
  if (hi) out.push(`기간 내 최고가: 전용 ${hi.area}㎡ ${eok(hi.price)} (${hi.date}, ${hi.floor}층)`);
  const m = a.areas.find((x) => x.area === a.mainArea);
  if (m?.monthly.count12) out.push(`전용 ${m.area}㎡ 월세 중간값: 보증금 ${eok(m.monthly.medianDeposit)} / 월 ${m.monthly.medianRent}만 (${m.monthly.count12}건)`);
  if (c.canceled12) out.push(`최근 1년 계약 취소 신고 ${c.canceled12}건`);
  return out;
}

const tagsOf = (cfg, extra = []) => [...new Set([cfg.name.replace(/\s+/g, ''), cfg.region.split(' ').at(-1), cfg.umdNm, '평촌', ...extra].filter(Boolean))];

/** 단지 분석을 올릴 글로 (보고서함과 같은 꼴: thread · talk · blog · cards) */
export function complexPost(cfg, a, today) {
  const lines = insights(cfg, a);
  const kind = cfg.kind === 'offi' ? '오피스텔' : '아파트';
  const head = `${cfg.name} 실거래 정리 (${today.slice(0, 7).replace('-', '년 ')}월)`;
  const areaLines = a.areas.filter((x) => x.trade.count12 > 0).map((x) => `${x.area}㎡: ${eok(x.trade.median12)} (${x.trade.count12}건)${x.trade.changePct != null ? ` ${x.trade.changePct > 0 ? '▲' : x.trade.changePct < 0 ? '▼' : ''}${Math.abs(x.trade.changePct)}%` : ''}`);
  const thread = [`${cfg.region} ${cfg.umdNm} ${cfg.name}, 최근 1년 실거래를 정리했습니다.`, '', ...lines.map((l) => `· ${l}`), '', '자료: 국토교통부 실거래가 공개시스템'].join('\n').slice(0, 500);
  const talk = [`[${cfg.name}] 최근 1년 실거래`, ...areaLines.slice(0, 4), `매매 ${a.counts.trade12}건 · 전세 ${a.counts.jeonse12}건`].join('\n');
  const recent = a.recentTrades.filter((d) => !d.canceled).slice(0, 6).map((d) => `- ${d.date} · 전용 ${d.area}㎡ · ${d.floor}층 · ${eok(d.price)}`);
  const body = [
    `${cfg.region} ${cfg.umdNm} ${cfg.name}${a.buildYear ? `(${a.buildYear}년 준공)` : ''} ${kind}의 최근 1년 실거래를 면적별로 정리했습니다. 숫자는 모두 국토교통부에 신고된 실거래가입니다.`,
    `■ 거래량은 어땠나\n최근 1년 매매 ${a.counts.trade12}건, 그 전 1년은 ${a.counts.tradePrev}건이었습니다. 전세는 ${a.counts.jeonse12}건, 월세는 ${a.counts.monthly12}건 신고됐습니다.`,
    `■ 면적별 매매가\n${a.areas.filter((x) => x.trade.count12 > 0).map((x) => `- 전용 ${x.area}㎡: 중간값 ${eok(x.trade.median12)}, ${eok(x.trade.min12)}~${eok(x.trade.max12)} (${x.trade.count12}건)${x.trade.changePct != null ? `, 1년 전 대비 ${x.trade.changePct > 0 ? '+' : ''}${x.trade.changePct}%` : ''}`).join('\n') || '최근 1년 매매 신고가 없습니다.'}`,
    `■ 전세와 전세가율\n${a.areas.filter((x) => x.jeonse.count12 > 0).map((x) => `- 전용 ${x.area}㎡: 전세 중간값 ${eok(x.jeonse.median12)} (${x.jeonse.count12}건)${x.jeonseRate ? `, 전세가율 ${x.jeonseRate}%` : ''}`).join('\n') || '최근 1년 전세 신고가 없습니다.'}`,
    recent.length ? `■ 최근 매매 내역\n${recent.join('\n')}` : null,
    `■ 한눈에 정리\n${lines.map((l) => `- ${l}`).join('\n')}`,
    `실거래가는 계약 후 30일 안에 신고되므로 최근 거래는 아직 반영되지 않았을 수 있습니다. (${today} 기준)`,
  ].filter(Boolean).join('\n\n');
  return {
    title: head, summary: lines[0], thread, talk,
    blog: { title: `${cfg.region.split(' ').at(-1)} ${cfg.umdNm} ${cfg.name} 실거래가 ${a.mainArea ? `${a.mainArea}㎡ ` : ''}정리 (${today.slice(0, 4)}년 ${Number(today.slice(5, 7))}월)`, body, tags: tagsOf(cfg, ['실거래가', kind, '전세가율']) },
    cards: [
      { title: `${cfg.name} 면적별 매매가`, points: areaLines.length ? areaLines : ['최근 1년 매매 신고 없음'] },
      { title: '거래량·전세', points: [`매매: 최근 1년 ${a.counts.trade12}건`, `전년: ${a.counts.tradePrev}건`, `전세: ${a.counts.jeonse12}건`, `월세: ${a.counts.monthly12}건`, ...a.areas.filter((x) => x.jeonseRate).slice(0, 2).map((x) => `전세가율 ${x.area}㎡: ${x.jeonseRate}%`)] },
    ],
    sources: [`국토교통부 실거래가 공개시스템 (${today} 받음)`],
  };
}

/** 경매 물건을 올릴 글로. ref: 같은 단지·같은 면적의 최근 1년 실거래 { median12, count12 } (만원) */
export function auctionPost(cfg, it, ref, today) {
  const name = `${cfg.name}${it.area ? ` ${it.area}㎡` : ''}`;
  const price = `감정가 ${won(it.appraisal)} · 최저가 ${won(it.minPrice)}(${it.minRate}%)`;
  const cmp = ref?.median12 ? `최근 1년 같은 면적 실거래 중간값 ${eok(ref.median12)} (${ref.count12}건) → 최저가는 그 ${Math.round(it.minPrice / 10000 / ref.median12 * 100)}%` : null;
  const rights = it.rights ? `인수되는 권리(명세서): ${it.rights}` : null;
  const warn = '입찰 전 매각물건명세서·현황조사서·등기부를 꼭 확인하세요.';
  const thread = [
    `[경매] ${name} 경매 물건이 나왔습니다.`, '',
    `· 사건 ${it.caseNo} (${it.court} ${it.dept})`, `· 소재지 ${it.address}`, `· ${price}`, `· 유찰 ${it.failCount}회 · 매각기일 ${dayOf(it.saleDate)} ${it.saleTime}`,
    cmp ? `· ${cmp}` : null, rights ? `\n⚠ ${rights.slice(0, 150)}${rights.length > 150 ? '…' : ''}` : null, '', warn, '자료: 법원경매정보',
  ].filter((l) => l != null).join('\n').slice(0, 500);
  const talk = [`[경매] ${name}`, `최저가 ${won(it.minPrice)} (감정가 ${won(it.appraisal)}의 ${it.minRate}%)`, `매각기일 ${dayOf(it.saleDate)} ${it.saleTime} · ${it.court}`, `사건 ${it.caseNo}`].join('\n');
  const body = [
    `${cfg.region} ${cfg.umdNm} ${cfg.name}${it.unit ? ` ${it.unit}` : ''}가 법원 경매로 나왔습니다. 사건번호는 ${it.caseNo}, 담당은 ${it.court} ${it.dept}입니다.`,
    `■ 물건 개요\n- 소재지: ${it.address}\n- 용도: ${it.usage}${it.area ? `\n- 전용면적: ${it.area}㎡` : ''}${it.landShare ? `\n- 대지권: ${it.landShare}` : ''}${it.caseName ? `\n- 사건: ${it.caseName}${it.receivedDate ? ` (${it.receivedDate} 접수)` : ''}` : ''}${it.claim ? `\n- 청구금액: ${won(it.claim)}` : ''}`,
    `■ 가격과 일정\n- 감정가: ${won(it.appraisal)}\n- 최저매각가격: ${won(it.minPrice)} (감정가의 ${it.minRate}%)\n- 유찰: ${it.failCount}회\n- 매각기일: ${dayOf(it.saleDate)} ${it.saleTime}${it.place ? ` ${it.place}` : ''}${it.decisionDate ? `\n- 매각결정기일: ${dayOf(it.decisionDate)}` : ''}`,
    `■ 실거래가와 비교\n${cmp ? `${cmp}입니다.` : '같은 면적의 최근 1년 실거래 신고가 없어 비교하지 못했습니다.'}${ref?.last ? `\n가장 최근 거래는 ${ref.last.date} ${eok(ref.last.price)}(${ref.last.floor}층)입니다.` : ''}${cmp && it.rights ? '\n다만 매수인이 인수하는 권리가 있어, 실제 부담은 최저가보다 커질 수 있습니다.' : ''}`,
    `■ 권리 관계 (매각물건명세서 기재)\n${it.rights || '매수인이 인수하는 권리 기재 없음'}${it.topPriority ? `\n- 최선순위 설정: ${it.topPriority}` : ''}${it.specRemark ? `\n- 비고: ${it.specRemark}` : ''}${it.remark ? `\n- 물건 비고: ${it.remark}` : ''}`,
    it.appraisalNotes?.length ? `■ 감정평가서 요점\n${it.appraisalNotes.slice(0, 4).map((n) => `- ${n}`).join('\n')}` : null,
    `■ 한눈에 정리\n- ${name}, 사건 ${it.caseNo}\n- ${price}\n- 매각기일 ${dayOf(it.saleDate)} ${it.saleTime}${cmp ? `\n- ${cmp}` : ''}`,
    `${warn} 이 글은 법원경매정보에 공개된 내용을 정리한 것이며, 일정과 가격은 바뀔 수 있습니다. (${today} 기준)`,
  ].filter(Boolean).join('\n\n');
  return {
    title: `[경매] ${name} · 최저가 ${won(it.minPrice)}`, summary: `${price} · 매각기일 ${md(it.saleDate)}`, thread, talk,
    blog: { title: `${cfg.region.split(' ').at(-1)} ${cfg.umdNm} ${cfg.name} ${it.area ? `${it.area}㎡ ` : ''}경매 | 최저가 ${won(it.minPrice)}, 매각기일 ${md(it.saleDate)} (${it.caseNo})`, body, tags: tagsOf(cfg, ['경매', '법원경매', '아파트경매', it.court.replace(/\s+/g, '')]) },
    cards: [
      { title: `${name} 경매`, points: [`사건: ${it.caseNo}`, `법원: ${it.court} ${it.dept}`, `감정가: ${won(it.appraisal)}`, `최저가: ${won(it.minPrice)} (${it.minRate}%)`, `유찰: ${it.failCount}회`, `매각기일: ${dayOf(it.saleDate)} ${it.saleTime}`] },
      ...(cmp ? [{ title: '실거래가와 비교', points: [`실거래 중간값: ${eok(ref.median12)} (${ref.count12}건)`, `최저가: ${won(it.minPrice)}`, `실거래 대비: ${Math.round(it.minPrice / 10000 / ref.median12 * 100)}%`, ...(it.rights ? ['주의: 인수 권리만큼 부담이 늘 수 있음'] : [])] }] : []),
      { title: '입찰 전 확인', points: [`인수 권리: ${it.rights ? '있음 (명세서 확인)' : '기재 없음'}`, ...(it.topPriority ? [`최선순위: ${it.topPriority}`] : []), '명세서·현황조사서·등기부 확인'] },
    ],
    sources: [`법원경매정보 ${it.caseNo} (${today} 받음)`, ...(cmp ? [`국토교통부 실거래가 공개시스템 (${today} 받음)`] : [])],
  };
}

/** 같은 면적(±1.5㎡) 최근 1년 실거래 */
export function refFor(analysis, area) {
  if (!analysis || !area) return null;
  const x = analysis.areas.filter((a) => a.exact.some((e) => Math.abs(e - area) <= 1.5)).sort((p, q) => q.trade.count12 - p.trade.count12)[0];
  return x?.trade.count12 ? { median12: x.trade.median12, count12: x.trade.count12, last: x.trade.last } : null;
}
