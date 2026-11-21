// 손님용 앱 기능 (접속 암호 없음). 손님은 기기에서 만든 긴 무작위 id 로 구분한다.
// GET /api/c?a=...   POST /api/c { a: '...', ... }
import { getJ, hgetJ, hsetJ, idOk, listJ, newId, pushJ, saveImage, setJ, unshiftJ } from './_db.js'
import { handler, HttpError, q } from './_lib.js'
import { publicKey, subscribe, toOffice } from './_push.js'
import { fetchTrades } from './trades.js'

/** 실거래 알림을 받을 수 있는 지역 */
export const REGIONS: Record<string, string> = { '41173': '안양시 동안구' }

const str = (v: unknown, max: number) => String(v ?? '').trim().slice(0, max)

/** 지역의 최근 실거래 (하루 동안 보관해 국토부 조회를 아낀다) */
export async function regionTrades(lawd: string) {
  if (!REGIONS[lawd]) throw new HttpError(400, '지원하지 않는 지역입니다')
  const key = `trades:${lawd}`
  const hit = await getJ<{ at: number; rows: any[] }>(key)
  if (hit && Date.now() - hit.at < 12 * 3600_000) return hit.rows
  const { rows } = await fetchTrades(lawd, 6)
  await setJ(key, { at: Date.now(), rows: rows.slice(0, 1500) })
  return rows
}

export default handler(
  async (req) => {
    const b = req.method === 'POST' ? (req.body ?? {}) : {}
    const a = req.method === 'POST' ? b.a : q(req, 'a')
    const id = req.method === 'POST' ? b.id : q(req, 'id')
    const need = () => {
      if (!idOk(id)) throw new HttpError(400, '기기 정보가 올바르지 않습니다')
      return id as string
    }
    const touch = async (patch: Record<string, unknown>) => {
      const cur: Record<string, any> = (await hgetJ<Record<string, any>>('customers', need())) ?? { id, createdAt: Date.now() }
      const next: Record<string, any> = { ...cur, ...patch }
      await hsetJ('customers', need(), next)
      return next
    }

    switch (a) {
      // 소식 (사무소가 내보낸 카드뉴스·정보)
      case 'feed':
        return { posts: await listJ('posts', 0, 29), office: (await getJ<{ office?: string }>('profile'))?.office ?? '' }

      // 실거래 알림
      case 'complexes': {
        const lawd = q(req, 'lawd')
        const rows = await regionTrades(lawd)
        const m = new Map<string, { complex: string; dong: string; kind: string; n: number; last: string; price: number }>()
        for (const r of rows) {
          const k = `${r.kind}|${r.dong}|${r.complex}`
          const c = m.get(k)
          if (c) c.n++
          else m.set(k, { complex: r.complex, dong: r.dong, kind: r.kind, n: 1, last: r.date, price: r.price })
        }
        return { region: REGIONS[lawd], main: (await getJ<{ main?: unknown[] }>('profile'))?.main ?? [], complexes: [...m.values()].sort((x, y) => x.complex.localeCompare(y.complex, 'ko')) }
      }
      case 'watch':
        return { items: (await hgetJ<unknown[]>('watch', need())) ?? [], alerts: await listJ(`alerts:${need()}`, 0, 29) }
      case 'watchSet': {
        const items = (Array.isArray(b.items) ? b.items : [])
          .slice(0, 20)
          .map((w: any) => ({ lawd: str(w.lawd, 5), complex: str(w.complex, 60), dong: str(w.dong, 30) }))
          .filter((w: any) => REGIONS[w.lawd] && w.complex)
        await hsetJ('watch', need(), items)
        return { items }
      }
      case 'watchTrades': {
        const items = (await hgetJ<{ lawd: string; complex: string; dong: string }[]>('watch', need())) ?? []
        const out: any[] = []
        for (const lawd of [...new Set(items.map((w) => w.lawd))]) {
          const rows = await regionTrades(lawd)
          const mine = items.filter((w) => w.lawd === lawd)
          out.push(...rows.filter((r) => mine.some((w) => w.complex === r.complex && (!w.dong || w.dong === r.dong))).slice(0, 40))
        }
        return { trades: out.sort((x, y) => y.date.localeCompare(x.date)).slice(0, 60) }
      }

      // 매물 접수
      case 'intake': {
        const f = b.form ?? {}
        if (!f.agree) throw new HttpError(400, '개인정보 수집·이용에 동의해 주세요')
        if (!str(f.ownerName, 30) || !str(f.ownerPhone, 20)) throw new HttpError(400, '이름과 연락처를 입력해 주세요')
        const photos: string[] = []
        for (const p of (Array.isArray(f.photos) ? f.photos : []).slice(0, 5)) photos.push(await saveImage(String(p)))
        const clean: Record<string, unknown> = {}
        for (const [k, v] of Object.entries(f)) if (k !== 'photos') clean[k] = typeof v === 'string' ? v.slice(0, 2000) : typeof v === 'number' || typeof v === 'boolean' ? v : Array.isArray(v) ? v.slice(0, 30).map((x) => String(x).slice(0, 40)) : undefined
        const item: Record<string, any> = { ...clean, photos, id: newId(), customerId: need(), status: '접수', createdAt: Date.now() }
        await unshiftJ('intakes', item, 1000)
        await touch({ name: str(f.ownerName, 30), phone: str(f.ownerPhone, 20) })
        await toOffice({ title: '새 매물 접수', body: `${item.ownerName} · ${str(f.complex, 40) || str(f.address, 40)} ${str(f.deal, 4)}`, url: '/?go=intake', tag: 'intake' })
        return { ok: true, id: item.id }
      }
      case 'myIntakes':
        return { intakes: (await listJ<any>('intakes')).filter((i) => i.customerId === need()).map(({ id: iid, complex, address, deal, kind, price, status, createdAt }) => ({ id: iid, complex, address, deal, kind, price, status, createdAt })) }

      // 채팅 상담
      case 'chat': {
        const after = Number(q(req, 'after')) || 0
        const c = await hgetJ<Record<string, unknown>>('customers', need())
        if (c?.unreadCustomer) await touch({ unreadCustomer: 0 })
        return { messages: (await listJ<{ at: number }>(`chat:${need()}`)).filter((m) => m.at > after), name: c?.name ?? '' }
      }
      case 'chatSend': {
        const text = str(b.text, 1000)
        if (!text) throw new HttpError(400, '내용을 입력해 주세요')
        const name = str(b.name, 30)
        const msg = { id: newId(), from: 'customer', text, at: Date.now() }
        await pushJ(`chat:${need()}`, msg)
        const c = await touch({ ...(name ? { name } : {}), ...(b.phone ? { phone: str(b.phone, 20) } : {}), last: text.slice(0, 60), lastAt: msg.at })
        await hsetJ('customers', need(), { ...c, unreadOffice: (Number(c.unreadOffice) || 0) + 1 })
        await toOffice({ title: `${c.name || '손님'} 님의 상담`, body: text.slice(0, 80), url: '/?go=chat', tag: `chat-${id}` })
        return { message: msg }
      }

      // 알림 구독
      case 'vapid':
        return { key: await publicKey() }
      case 'subscribe':
        await subscribe(need(), b.sub)
        return { ok: true }
      default:
        throw new HttpError(400, '알 수 없는 요청입니다')
    }
  },
  0,
  true,
)

