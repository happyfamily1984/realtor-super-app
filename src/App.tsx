import { useEffect, useMemo, useRef, useState } from 'react'
import { Confirm, DataCtx, Icon, type Intent, type Tab } from './components/ui'
import { DEFAULT_SETTINGS, LISTINGS, SAMPLE_CONSULTS, SAMPLE_CONTRACTS, type Consult, type Contract, type Listing, type Settings } from './data/sample'
import { exitApp, initNav, stayInApp, useBackLayer } from './lib/nav'
import { registerSw } from './lib/push'
import { mergeListings, parseCollectorFile, parseRegionNames, type CollectorFile } from './lib/naverParse'
import { toast, usePersist } from './lib/util'
import Briefing from './pages/Briefing'
import ConsultPage from './pages/Consult'
import Contracts from './pages/Contracts'
import Home from './pages/Home'
import Listings from './pages/Listings'

const TABS: { id: Tab; label: string }[] = [
  { id: 'home', label: '홈' },
  { id: 'briefing', label: '브리핑' },
  { id: 'listings', label: '매물' },
  { id: 'consult', label: '상담' },
  { id: 'contracts', label: '계약' },
]

export default function App() {
  const [saved, setSettings] = usePersist<Settings>('settings', DEFAULT_SETTINGS)
  const settings = useMemo(() => ({ ...DEFAULT_SETTINGS, ...saved }), [saved]) // 예전 저장값에 새 항목 보충
  const [listings, setListings] = usePersist<Listing[]>('listings', LISTINGS)
  const [consults, setConsults] = usePersist<Consult[]>('consults', SAMPLE_CONSULTS)
  const [contracts, setContracts] = usePersist<Contract[]>('contracts', SAMPLE_CONTRACTS)
  const [tab, setTab] = useState<Tab>('home')
  const [intent, setIntent] = useState<Intent>(null)
  const [askExit, setAskExit] = useState(false)
  const [exited, setExited] = useState(false)
  const [toastMsg, setToastMsg] = useState('')
  const [listKey, setListKey] = useState(0)
  const [consultKey, setConsultKey] = useState(0)
  const listingsRef = useRef(listings)
  listingsRef.current = listings

  // PC 확장 프로그램(매물 수집기)이 넘겨준 수집 결과를 바로 반영
  useEffect(() => {
    const h = (e: MessageEvent) => {
      if (e.source !== window || e.data?.type !== 'rsa-collection') return
      const file = e.data.file as CollectorFile
      if (file?.source !== 'realtor-super-app-collector') return
      window.postMessage({ type: 'rsa-collection-ack' }, location.origin)
      const items = parseCollectorFile(file)
      if (!items.length) return toast('수집기에서 받은 파일에 매물이 없습니다. 매물 > 가져오기에서 파일을 직접 선택해 주세요.')
      try {
        const names = { ...JSON.parse(localStorage.getItem('regionNames') || '{}'), ...parseRegionNames(file) }
        localStorage.setItem('regionNames', JSON.stringify(names))
      } catch {
        /* 무시 */
      }
      const m = mergeListings(listingsRef.current, items)
      setListings(m.list)
      setListKey((k) => k + 1)
      setIntent(null)
      setTab('listings')
      toast(`수집기에서 매물 ${items.length}건 · 신규 ${m.added} · 가격변동 ${m.changed} · 사라짐 ${m.gone}`)
    }
    window.addEventListener('message', h)
    return () => window.removeEventListener('message', h)
  }, [])

  // 홈에서 뒤로가기 → 종료 확인
  useEffect(() => initNav(() => setAskExit(true)), [])
  // 다른 탭에서 뒤로가기 → 홈으로
  useBackLayer(tab !== 'home', () => setTab('home'))

  useEffect(() => {
    let t = 0
    const h = (e: Event) => {
      setToastMsg((e as CustomEvent<string>).detail)
      clearTimeout(t)
      t = window.setTimeout(() => setToastMsg(''), 2600)
    }
    window.addEventListener('app-toast', h)
    return () => window.removeEventListener('app-toast', h)
  }, [])

  const go = (t: Tab, i: Intent = null) => {
    setIntent(i)
    setTab(t)
    window.scrollTo(0, 0)
  }
  const page = { intent, clearIntent: () => setIntent(null) }

  // 푸시 알림을 눌러 들어온 경우 (새 채팅·매물 접수)
  useEffect(() => {
    registerSw()
    const open = (url: string) => {
      const g = new URL(url, location.href).searchParams.get('go')
      if (g === 'chat' || g === 'intake') {
        setIntent(g)
        setTab('consult')
        setConsultKey((k) => k + 1)
      }
    }
    open(location.href)
    const h = (e: MessageEvent) => e.data?.type === 'push-open' && open(e.data.url)
    navigator.serviceWorker?.addEventListener('message', h)
    return () => navigator.serviceWorker?.removeEventListener('message', h)
  }, [])

  if (exited)
    return (
      <div className="exited">
        <p>앱을 종료했습니다.</p>
        <span>이 창을 닫아 주세요.</span>
      </div>
    )

  return (
    <DataCtx.Provider value={{ settings, setSettings, consults, setConsults, contracts, setContracts, listings, setListings }}>
      <div className="app">
        <main>
          {tab === 'home' && <Home go={go} />}
          {tab === 'briefing' && <Briefing {...page} />}
          {tab === 'listings' && <Listings key={listKey} />}
          {tab === 'consult' && <ConsultPage key={consultKey} {...page} />}
          {tab === 'contracts' && <Contracts {...page} />}
        </main>
        <nav className="tabbar" aria-label="하단 메뉴">
          {TABS.map((t) => (
            <button key={t.id} className={t.id === tab ? 'on' : ''} aria-current={t.id === tab ? 'page' : undefined} onClick={() => go(t.id)}>
              <Icon name={t.id} />
              <span>{t.label}</span>
            </button>
          ))}
        </nav>
        {toastMsg && <div className="toast" role="status">{toastMsg}</div>}
        {askExit && (
          <Confirm
            layer={false}
            message="앱을 종료하겠습니까?"
            onNo={() => {
              setAskExit(false)
              stayInApp()
            }}
            onYes={() => {
              exitApp()
              setTimeout(() => setExited(true), 250)
            }}
          />
        )}
      </div>
    </DataCtx.Provider>
  )
}
