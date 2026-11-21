// 사무소(중개사 슈퍼앱)용 기능. 접속 암호(APP_PASSCODE)로 보호된다.
import { getJ, hallJ, hgetJ, hsetJ, idOk, listJ, newId, pushJ, redis, saveImage, setJ, unshiftJ } from './_db.js'
import { handler, HttpError, q } from './_lib.js'
import { publicKey, subscribe, toAllCustomers, toCustomer } from './_push.js'

const str = (v: unknown, max: number) => String(v ?? '').trim().slice(0, max)

export default handler(async (req) => {
  const b = req.method === 'POST' ? (req.body ?? {}) : {}
  const a = req.method === 'POST' ? b.a : q(req, 'a')
  switch (a) {
    // 받은 것 한눈에: 채팅 손님 목록 + 매물 접수
    case 'inbox': {
      const customers = Object.values(await hallJ<any>('customers')).filter((c) => c.lastAt).sort((x, y) => y.lastAt - x.lastAt)
      return { customers, intakes: await listJ('intakes', 0, 199) }
    }
    case 'chat': {
      const id = q(req, 'id')
      if (!idOk(id)) throw new HttpError(400, '손님 정보가 올바르지 않습니다')
      const c = await hgetJ<any>('customers', id)
      if (c?.unreadOffice) await hsetJ('customers', id, { ...c, unreadOffice: 0 })
      return { messages: (await listJ<{ at: number }>(`chat:${id}`)).filter((m) => m.at > (Number(q(req, 'after')) || 0)), customer: c }
    }
    case 'chatSend': {
      if (!idOk(b.id)) throw new HttpError(400, '손님 정보가 올바르지 않습니다')
      const text = str(b.text, 1000)
      if (!text) throw new HttpError(400, '내용을 입력해 주세요')
      const msg = { id: newId(), from: 'office', text, at: Date.now() }
      await pushJ(`chat:${b.id}`, msg)
      const c = (await hgetJ<any>('customers', b.id)) ?? { id: b.id }
      await hsetJ('customers', b.id, { ...c, last: text.slice(0, 60), lastAt: msg.at, unreadCustomer: (Number(c.unreadCustomer) || 0) + 1 })
      await toCustomer(b.id, { title: '상담 답변이 도착했습니다', body: text.slice(0, 80), url: '/customer.html?go=chat', tag: 'chat' })
      return { message: msg }
    }
    case 'intakeStatus': {
      const all = await listJ<any>('intakes')
      const i = all.findIndex((x) => x.id === b.id)
      if (i < 0) throw new HttpError(404, '접수 내역이 없습니다')
      all[i] = { ...all[i], status: str(b.status, 10) }
      await redis('DEL', 'intakes')
      if (all.length) await redis('RPUSH', 'intakes', ...all.map((x) => JSON.stringify(x)))
      return { ok: true }
    }

    // 정보 내보내기 → 손님용 앱
    case 'publish': {
      const title = str(b.title, 80)
      if (!title) throw new HttpError(400, '제목을 입력해 주세요')
      const images: string[] = []
      for (const d of (Array.isArray(b.images) ? b.images : []).slice(0, 10)) images.push(await saveImage(String(d)))
      const post = { id: newId(), title, body: str(b.body, 4000), images, kind: str(b.kind, 20) || '정보', at: Date.now() }
      await unshiftJ('posts', post, 200)
      if (b.office) await setJ('profile', { ...((await getJ<object>('profile')) ?? {}), office: str(b.office, 40) })
      const sent = await toAllCustomers({ title, body: post.body.slice(0, 80) || '새 소식이 도착했습니다', url: `/customer.html?post=${post.id}`, tag: 'post' })
      return { post, sent }
    }
    case 'posts':
      return { posts: await listJ('posts', 0, 49) }
    case 'postDelete': {
      const all = await listJ<any>('posts')
      const hit = all.find((p) => p.id === b.id)
      if (hit) await redis('LREM', 'posts', 0, JSON.stringify(hit))
      return { ok: true }
    }

    // 사무소 이름·메인 단지를 손님용 앱에도 알려 준다
    case 'profile': {
      const main = (Array.isArray(b.main) ? b.main : []).slice(0, 30).map((m: any) => ({ name: str(m.name, 40), kind: str(m.kind, 10), aliases: (Array.isArray(m.aliases) ? m.aliases : []).slice(0, 5).map((x: unknown) => str(x, 40)) }))
      await setJ('profile', { office: str(b.office, 40), main })
      return { ok: true }
    }
    // 내 매물 사진 올리기
    case 'image':
      return { url: await saveImage(String(b.data ?? '')) }

    case 'vapid':
      return { key: await publicKey() }
    case 'subscribe':
      await subscribe(`office:${str(b.device, 30)}`, b.sub)
      return { ok: true }
    default:
      throw new HttpError(400, '알 수 없는 요청입니다')
  }
})

