// 공용 임시저장소: 폴더 하나에 자료 파일 + 목록(index.json). store 브랜치에 그대로 올라감.
import { mkdirSync, readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';

export const KEEP_DAYS = 30;        // 이보다 오래된 자료는 지움
export const FRESH_RECENT_H = 6;    // 이번 달·지난달 실거래: 6시간 지나면 새로 받음
export const FRESH_OLD_H = 7 * 24;  // 그 전 달: 7일 (신고가 끝나 거의 안 바뀜)

export class Store {
  constructor(dir) {
    this.dir = dir;
    mkdirSync(dir, { recursive: true });
    this.index = existsSync(join(dir, 'index.json'))
      ? JSON.parse(readFileSync(join(dir, 'index.json'), 'utf8'))
      : { version: 1, updatedAt: null, items: [] };
  }

  entry(path) { return this.index.items.find((i) => i.path === path); }

  /** 받은 지 hours시간이 안 됐으면 true */
  isFresh(path, hours, now = Date.now()) {
    const e = this.entry(path);
    return !!e && existsSync(join(this.dir, path)) && now - Date.parse(e.fetchedAt) < hours * 3600 * 1000;
  }

  read(path) { return JSON.parse(readFileSync(join(this.dir, path), 'utf8')); }

  /** meta: { kind, source, label, ... } / rows: 자료 배열 */
  put(path, meta, rows, now = new Date()) {
    const fetchedAt = now.toISOString();
    const file = join(this.dir, path);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, JSON.stringify({ ...meta, fetchedAt, count: rows.length, rows }));
    this.index.items = this.index.items.filter((i) => i.path !== path);
    this.index.items.push({ path, ...meta, count: rows.length, fetchedAt });
  }

  /** 오래된 자료 지우기. 지운 경로 목록을 돌려줌 */
  prune(now = Date.now(), keepDays = KEEP_DAYS) {
    const old = this.index.items.filter((i) => now - Date.parse(i.fetchedAt) > keepDays * 24 * 3600 * 1000);
    for (const i of old) rmSync(join(this.dir, i.path), { force: true });
    this.index.items = this.index.items.filter((i) => !old.includes(i));
    return old.map((i) => i.path);
  }

  save(now = new Date()) {
    this.index.updatedAt = now.toISOString();
    this.index.items.sort((a, b) => a.path.localeCompare(b.path));
    writeFileSync(join(this.dir, 'index.json'), JSON.stringify(this.index, null, 1));
  }
}
