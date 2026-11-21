// 푸시 알림 켜기. scope: 'c' = 손님용 앱, 'office' = 중개사 슈퍼앱
import { api } from './api'

const b64 = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0))

export const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
export const pushState = () => (pushSupported() ? Notification.permission : 'unsupported')

export function registerSw() {
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {})
}

/** 권한을 묻고 구독을 서버에 저장한다. 실패하면 이유를 던진다. */
export async function enablePush(scope: 'c' | 'office', who: string) {
  if (!pushSupported()) throw new Error('이 기기에서는 알림을 지원하지 않습니다')
  if ((await Notification.requestPermission()) !== 'granted') throw new Error('알림 권한이 거부되었습니다. 기기 설정에서 알림을 허용해 주세요.')
  const reg = await navigator.serviceWorker.register('./sw.js')
  await navigator.serviceWorker.ready
  const { key } = await api<{ key: string }>(`${scope}?a=vapid`)
  const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(key) }))
  await api(scope, scope === 'c' ? { a: 'subscribe', id: who, sub } : { a: 'subscribe', device: who, sub })
}

/** 기기마다 한 번 만들어 계속 쓰는 무작위 id */
export function deviceId(key: string) {
  let id = localStorage.getItem(key)
  if (!id || !/^[a-z0-9]{12,40}$/.test(id)) {
    id = Array.from(crypto.getRandomValues(new Uint8Array(18)), (b) => (b % 36).toString(36)).join('') + Date.now().toString(36)
    localStorage.setItem(key, id)
  }
  return id
}
