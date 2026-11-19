// 푸시 알림 (Web Push). 서명 키는 처음 쓸 때 만들어 저장소에 보관하므로 따로 설정할 것이 없다.
import * as wp from 'web-push'
import type { PushSubscription } from 'web-push'
import { getJ, hallJ, hsetJ, redis, setJ } from './_db.js'

// web-push 는 CommonJS 모듈이라 실행 환경에 따라 default 로 감싸져 온다
const webpush: typeof wp = (wp as any).default ?? wp

interface Keys {
  publicKey: string
  privateKey: string
}
export interface Note {
  title: string
  body: string
  url?: string
  tag?: string
}

async function keys(): Promise<Keys> {
  let k = await getJ<Keys>('vapid')
  if (!k) {
    k = webpush.generateVAPIDKeys()
    await setJ('vapid', k)
  }
  return k
}
export const publicKey = async () => (await keys()).publicKey

/** who: 손님 id 또는 "office:기기id" */
export const subscribe = (who: string, sub: unknown) => hsetJ('push', who, sub)

/** pick 이 고른 대상에게 알림. 만료된 구독은 지운다. */
export async function notify(pick: (who: string) => boolean, note: Note) {
  const all = await hallJ<PushSubscription>('push')
  const targets = Object.entries(all).filter(([who]) => pick(who))
  if (!targets.length) return 0
  const k = await keys()
  let sent = 0
  await Promise.all(
    targets.map(async ([who, sub]) => {
      try {
        await webpush.sendNotification(sub, JSON.stringify(note), { vapidDetails: { subject: 'mailto:noreply@example.com', ...k }, TTL: 86400 })
        sent++
      } catch (e: any) {
        if (e?.statusCode === 404 || e?.statusCode === 410) await redis('HDEL', 'push', who)
      }
    }),
  )
  return sent
}
export const toOffice = (note: Note) => notify((w) => w.startsWith('office:'), note)
export const toCustomer = (id: string, note: Note) => notify((w) => w === id, note)
export const toAllCustomers = (note: Note) => notify((w) => !w.startsWith('office:'), note)
