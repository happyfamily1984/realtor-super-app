// 하루 한 번 실행 (vercel.json 의 crons): 새로 신고된 실거래를 찾아, 그 아파트를 지정한 손님에게 알림을 보낸다.
import { hallJ, redis, setJ, unshiftJ } from './_db.js'
import { REGIONS } from './c.js'
import { toCustomer } from './_push.js'
import { fetchTrades } from './trades.js'

const won = (v: number) => {
  const eok = Math.floor(v / 10000)
  const rest = v % 10000
  return eok ? (rest ? `${eok}억 ${rest.toLocaleString()}` : `${eok}억`) : `${rest.toLocaleString()}만`
}

export default async function cron(req: { headers: Record<string, string | string[] | undefined> }, res: any) {
  const secret = process.env.CRON_SECRET
  if (secret && req.headers.authorization !== `Bearer ${secret}`) return res.status(401).json({ error: '권한이 없습니다' })
  try {
    const watch = await hallJ<{ lawd: string; complex: string; dong: string }[]>('watch')
    const report: Record<string, unknown> = {}
    for (const lawd of Object.keys(REGIONS)) {
      const { rows } = await fetchTrades(lawd, 2)
      await setJ(`trades:${lawd}`, { at: 0, rows: [] }) // 손님 화면의 보관본을 새로 받게 한다
      const seenKey = `seen:${lawd}`
      const first = !(await redis<number>('SCARD', seenKey))
      const seen = new Set(await redis<string[]>('SMEMBERS', seenKey))
      if (first) await redis('SADD', seenKey, '_') // 거래가 한 건도 없던 지역도 다음부터는 알림 대상
      const fresh = rows.filter((r) => !seen.has(r.id))
      if (fresh.length) for (let i = 0; i < fresh.length; i += 200) await redis('SADD', seenKey, ...fresh.slice(i, i + 200).map((r) => r.id))
      let sent = 0
      // 처음 실행할 때는 기준만 잡고 알림은 보내지 않는다
      if (!first)
        for (const [who, items] of Object.entries(watch)) {
          const mine = fresh.filter((r) => items.some((w) => w.lawd === lawd && w.complex === r.complex && (!w.dong || w.dong === r.dong)))
          for (const r of mine.slice(0, 5)) {
            const diff = r.prev ? (r.price > r.prev ? ` (직전 대비 ▲${won(r.price - r.prev)})` : r.price < r.prev ? ` (직전 대비 ▼${won(r.prev - r.price)})` : '') : ''
            const note = { title: `${r.complex} 실거래 신고`, body: `전용 ${r.area}㎡ ${r.floor}층 ${won(r.price)}${diff} · 계약일 ${r.date}`, url: '/customer.html?go=trades', tag: `trade-${r.id}` }
            await unshiftJ(`alerts:${who}`, { ...note, at: Date.now(), trade: r }, 100)
            sent += await toCustomer(who, note)
          }
        }
      report[REGIONS[lawd]] = { 새거래: fresh.length, 알림: sent, 기준설정: first }
    }
    res.status(200).json({ ok: true, report })
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : String(e) })
  }
}
