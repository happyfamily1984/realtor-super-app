// 뒤로가기 처리 (앱 공통 규칙)
// - 열린 창/선택 모드/탭은 "레이어"로 쌓이고, 뒤로가기는 맨 위 레이어부터 닫는다.
// - 홈에서 뒤로가기를 누르면 onRoot(종료 확인)가 호출된다.
import { useEffect, useRef } from 'react'

const SID = Math.random().toString(36).slice(2)
type Layer = { id: number; close: () => void }
const layers: Layer[] = []
let seq = 0
let ignore = 0
let onRoot: () => void = () => {}

const state = (depth: number) => ({ sid: SID, depth })

function onPop(e: PopStateEvent) {
  if (ignore > 0) {
    ignore--
    return
  }
  const depth = e.state?.sid === SID ? (e.state.depth as number) : 0
  while (layers.length && layers.length + 1 > depth) layers.pop()!.close()
  if (depth < 1) onRoot()
}

/** 앱 시작 시 1회 호출. depth 0 = 종료 확인 지점, depth 1 = 홈 */
export function initNav(rootHandler: () => void) {
  onRoot = rootHandler
  history.replaceState(state(0), '')
  history.pushState(state(1), '')
  window.addEventListener('popstate', onPop)
  return () => window.removeEventListener('popstate', onPop)
}

/** 종료 확인에서 "아니오" → 다시 홈 상태로 */
export function stayInApp() {
  history.pushState(state(1), '')
}

/** 종료 확인에서 "예" */
export function exitApp() {
  window.removeEventListener('popstate', onPop)
  history.back()
  window.close()
}

function pushLayer(close: () => void) {
  const id = ++seq
  layers.push({ id, close })
  history.pushState(state(layers.length + 1), '')
  return id
}

function releaseLayer(id: number) {
  const i = layers.findIndex((l) => l.id === id)
  if (i < 0) return // 이미 뒤로가기로 닫힘
  layers.splice(i, 1)
  ignore++
  history.back()
}

/** active 인 동안 뒤로가기 1회를 onClose 로 연결한다 */
export function useBackLayer(active: boolean, onClose: () => void) {
  const ref = useRef(onClose)
  ref.current = onClose
  useEffect(() => {
    if (!active) return
    const id = pushLayer(() => ref.current())
    return () => releaseLayer(id)
  }, [active])
}
