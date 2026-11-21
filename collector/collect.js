#!/usr/bin/env node
// 공용 임시저장소 수집기.
//   node collector/collect.js molit --regions "강남구,성남시 분당구" --months 6 [--types trade,rent]
//   node collector/collect.js summary --regions 강남구 --months 6 [--type trade|jeonse|monthly] [--apt 은마] [--dong 대치동]
//   node collector/collect.js list
//   node collector/collect.js dupes                    네이버 매물 중 중복 의심만 뽑아, 매물번호를 받아 오라고 시킬 글을 출력
//   node collector/collect.js main [--auction false]   메인 단지(config/main-complexes.json) 실거래 분석 + 경매 → main/my.json
// 저장 위치: --out 또는 STORE_DIR (기본 store-out). 깃허브에서는 store 브랜치가 이 폴더임.
import { Store, FRESH_RECENT_H, FRESH_OLD_H } from './store.js';
import { fetchMonth, findRegion, recentYms, PROXY } from './molit.js';
import { byComplex, byMonth, eok } from './summary.js';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { searchCourt, matchComplex, normalizeItem, fetchDetail } from './auction.js';
import { readInbox, summarizeListings, listingInsights, suspectPrompt } from './listings.js';
import { analyze, dealsOf, insights, complexPost, auctionPost, refFor } from './main.js';

const [cmd, ...rest] = process.argv.slice(2);
const opt = {};
for (let i = 0; i < rest.length; i += 2) opt[rest[i].replace(/^--/, '')] = rest[i + 1] ?? '';
const list = (s) => String(s || '').split(',').map((x) => x.trim()).filter(Boolean);
const store = new Store(opt.out || process.env.STORE_DIR || 'store-out');

export async function collectMolit(store, regions, months, apis, { force = false, log = console.log } = {}) {
  const recent = recentYms(2);
  const paths = [];
  for (const r of regions) {
    for (const api of apis) {
      for (const ym of recentYms(months)) {
        const path = `molit/${api}/${r.code}/${ym}.json`;
        paths.push(path);
        if (!force && store.isFresh(path, recent.includes(ym) ? FRESH_RECENT_H : FRESH_OLD_H)) continue;
        const rows = await fetchMonth(api, r.code, ym);
        store.put(path, { kind: `molit-${api}`, source: process.env.MOLIT_API_KEY ? '국토교통부 실거래가 공개시스템 API' : `국토교통부 실거래가 API (중계 ${new URL(PROXY).host})`, region: r.code, regionName: r.name, ym }, rows);
        log(`받음 ${r.name} ${api} ${ym}: ${rows.length}건`);
      }
    }
  }
  return paths;
}

if (cmd === 'molit' || cmd === 'summary') {
  const regions = list(opt.regions).map(findRegion);
  if (!regions.length) throw new Error('--regions 가 필요함 (예: "강남구,성남시 분당구")');
  const months = Math.min(Number(opt.months) || 3, 240);
  const type = opt.type || 'trade';
  const apis = cmd === 'summary' ? [type === 'trade' ? 'trade' : 'rent'] : list(opt.types || 'trade,rent');
  const paths = await collectMolit(store, regions, months, apis, { force: opt.force === 'true', log: cmd === 'summary' ? () => {} : console.log });
  const pruned = store.prune();
  store.save();
  if (cmd === 'molit') console.log(`끝. 자료 ${paths.length}개 (오래된 ${pruned.length}개 지움)`);
  else {
    for (const r of regions) {
      const deals = paths.filter((p) => p.includes(`/${r.code}/`)).flatMap((p) => store.read(p).rows);
      console.log(`\n■ ${r.name} · ${{ trade: '매매', jeonse: '전세', monthly: '월세' }[type]} · 최근 ${months}개월`);
      for (const m of byMonth(deals, { type })) console.log(`  ${m.ym}  ${String(m.count).padStart(4)}건  중간값 ${eok(m.median)}`);
      const rows = byComplex(deals, { type, apt: opt.apt, dong: opt.dong }).slice(0, Number(opt.top) || 30);
      for (const c of rows) console.log(`  ${c.umdNm} ${c.aptNm} ${c.area}㎡(${c.buildYear ?? '?'}년) ${c.count}건 · 중간 ${eok(c.median)} · 최저 ${eok(c.min)} · 최고 ${eok(c.max)}(${c.maxDate}) · 최근 ${c.last.date} ${eok(c.last.amount)}${c.last.monthlyRent ? `/${c.last.monthlyRent}` : ''} ${c.last.floor}층`);
    }
  }
} else if (cmd === 'dupes') {
  const cfg = JSON.parse(readFileSync(new URL('../config/main-complexes.json', import.meta.url), 'utf8'));
  const inbox = readInbox(new URL('../inbox/naver', import.meta.url).pathname);
  console.log(suspectPrompt(Object.fromEntries(cfg.complexes.filter((c) => inbox.out[c.id]).map((c) => [`${c.name} → ${c.id}.json`, inbox.out[c.id].items]))) || '중복 의심 매물이 없어요.');
} else if (cmd === 'main') {
  const cfg = JSON.parse(readFileSync(new URL('../config/main-complexes.json', import.meta.url), 'utf8'));
  const now = new Date();
  const today = new Date(now.getTime() + 9 * 3600e3).toISOString().slice(0, 10);
  const file = join(store.dir, 'main/my.json');
  const prev = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : { auctions: [] };
  const notes = [];

  // ① 실거래: 아파트는 중계 서버로, 오피스텔은 국토부 키가 있을 때만
  const deals = { apt: [], offi: [] };
  for (const code of [...new Set(cfg.complexes.map((c) => c.lawdCd))]) {
    const region = findRegion(code);
    const kinds = new Set(cfg.complexes.filter((c) => c.lawdCd === code).map((c) => c.kind));
    if (kinds.has('apt')) {
      const paths = await collectMolit(store, [region], cfg.months, ['trade', 'rent']);
      deals.apt.push(...paths.flatMap((p) => store.read(p).rows));
    }
    if (kinds.has('offi')) {
      if (!process.env.MOLIT_API_KEY) notes.push('오피스텔 실거래는 국토부 키(MOLIT_API_KEY)가 있어야 받을 수 있어요.');
      else try {
        const paths = await collectMolit(store, [region], cfg.months, ['offi-trade', 'offi-rent']);
        deals.offi.push(...paths.flatMap((p) => store.read(p).rows));
      } catch (e) { notes.push(`오피스텔 실거래를 받지 못했어요: ${e.message}`); }
    }
  }
  // 네이버 매물(호가): inbox/naver 에 넣어 둔 파일
  const inbox = readInbox(new URL('../inbox/naver', import.meta.url).pathname);
  notes.push(...inbox.problems.map((p) => `네이버 매물 ${p}`));
  const complexes = cfg.complexes.map((c) => {
    const a = analyze(c, dealsOf(c, deals[c.kind]), today);
    const has = a.areas.length > 0;
    const listings = inbox.out[c.id] ? summarizeListings(inbox.out[c.id], a, today) : null;
    if (listings?.total) return { id: c.id, name: c.name, kind: c.kind, lawdCd: c.lawdCd, region: c.region, ...a, hasData: has, listings, insights: [...(has ? insights(c, a) : []), ...listingInsights(listings)], post: has ? complexPost(c, a, today, listingInsights(listings)) : null };
    return { id: c.id, name: c.name, kind: c.kind, lawdCd: c.lawdCd, region: c.region, ...a, hasData: has, insights: has ? insights(c, a) : [c.kind === 'offi' ? '오피스텔 실거래 자료가 아직 연결되지 않았어요.' : '최근 실거래 자료가 없어요.'], post: has ? complexPost(c, a, today) : null };
  });

  // ② 경매: 법원 물건 전체에서 메인 단지만 골라 상세까지
  let auctions = prev.auctions ?? [];
  if (opt.auction !== 'false') try {
    const raw = await searchCourt(cfg.court.code);
    store.put(`auction/${cfg.court.code}.json`, { kind: 'auction', source: '법원경매정보', label: `${cfg.court.name} 진행 물건` }, raw.map(normalizeItem));
    const found = [];
    for (const r of raw) {
      const c = matchComplex(r, cfg.complexes);
      if (!c) continue;
      const item = normalizeItem(r);
      if (found.some((f) => f.id === item.id)) continue; // 한 물건이 목록에 여러 줄(토지·건물)로 나올 때
      try { Object.assign(item, await fetchDetail(item)); } catch (e) { console.log(`상세 실패 ${item.caseNo}: ${e.message}`); Object.assign(item, prev.auctions?.find((p) => p.id === item.id) ?? {}, item); }
      const old = prev.auctions?.find((p) => p.id === item.id);
      const cx = complexes.find((x) => x.id === c.id);
      found.push({ ...item, complexId: c.id, complexName: c.name, firstSeen: old?.firstSeen ?? now.toISOString(), updatedAt: now.toISOString(), gone: false, post: auctionPost(c, item, refFor(cx, item.area), today) });
    }
    // 목록에서 빠진 물건(매각·취하·기일 변경 등)은 30일 동안 '목록에서 빠짐'으로 남김
    const gone = (prev.auctions ?? []).filter((p) => !found.some((f) => f.id === p.id)).map((p) => ({ ...p, gone: true, goneAt: p.goneAt ?? now.toISOString() })).filter((p) => now - Date.parse(p.goneAt) < 30 * 86400e3);
    auctions = [...found.sort((a, b) => a.saleDate.localeCompare(b.saleDate)), ...gone];
    console.log(`경매: ${cfg.court.name} ${raw.length}건 중 메인 단지 ${found.length}건`);
  } catch (e) { notes.push(`경매 정보를 새로 받지 못해 이전 자료를 보여줘요: ${e.message}`); console.log(e.message); }

  mkdirSync(join(store.dir, 'main'), { recursive: true });
  const out = { version: 1, generatedAt: now.toISOString(), today, court: cfg.court.name, notes, complexes: complexes.map((c) => ({ ...c, auctionCount: auctions.filter((a) => a.complexId === c.id && !a.gone).length })), auctions };
  writeFileSync(file, JSON.stringify(out));
  store.index.items = store.index.items.filter((i) => i.path !== 'main/my.json');
  store.index.items.push({ path: 'main/my.json', kind: 'main', label: '메인 단지 분석·경매', count: complexes.length, fetchedAt: now.toISOString() });
  store.prune();
  store.save();
  for (const c of out.complexes) console.log(`\n■ ${c.name} (${c.aptNm || '-'} ${c.buildYear ?? ''}) 경매 ${c.auctionCount}건\n  ${c.insights.join('\n  ')}`);
  for (const n of notes) console.log('※', n);
} else if (cmd === 'list') {
  console.log(`갱신 ${store.index.updatedAt ?? '없음'} · 자료 ${store.index.items.length}개`);
  for (const i of store.index.items) console.log(`  ${i.path}  ${i.count}건  ${i.fetchedAt}  ${i.regionName ?? i.label ?? ''}`);
} else {
  console.log('쓰는 법: collect.js molit|summary|list  (파일 맨 위 설명 참고)');
}
