#!/usr/bin/env node
// 공용 임시저장소 수집기.
//   node collector/collect.js molit --regions "강남구,성남시 분당구" --months 6 [--types trade,rent]
//   node collector/collect.js summary --regions 강남구 --months 6 [--type trade|jeonse|monthly] [--apt 은마] [--dong 대치동]
//   node collector/collect.js list
// 저장 위치: --out 또는 STORE_DIR (기본 store-out). 깃허브에서는 store 브랜치가 이 폴더임.
import { Store, FRESH_RECENT_H, FRESH_OLD_H } from './store.js';
import { fetchMonth, findRegion, recentYms, PROXY } from './molit.js';
import { byComplex, byMonth, eok } from './summary.js';

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
} else if (cmd === 'list') {
  console.log(`갱신 ${store.index.updatedAt ?? '없음'} · 자료 ${store.index.items.length}개`);
  for (const i of store.index.items) console.log(`  ${i.path}  ${i.count}건  ${i.fetchedAt}  ${i.regionName ?? i.label ?? ''}`);
} else {
  console.log('쓰는 법: collect.js molit|summary|list  (파일 맨 위 설명 참고)');
}
