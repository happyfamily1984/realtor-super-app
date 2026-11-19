import { useEffect, useState } from 'react'
import { Confirm, DataCtx, Icon, type Intent, type Tab } from './components/ui'
import { DEFAULT_SETTINGS, SAMPLE_CONSULTS, SAMPLE_CONTRACTS, type Consult, type Contract, type Settings } from './data/sample'
import { exitApp, initNav, stayInApp, useBackLayer } from './lib/nav'
import { usePersist } from './lib/util'
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
  const [settings, setSettings] = usePersist<Settings>('settings', DEFAULT_SETTINGS)
  const [consults, setConsults] = usePersist<Consult[]>('consults', SAMPLE_CONSULTS)
  const [contracts, setContracts] = usePersist<Contract[]>('contracts', SAMPLE_CONTRACTS)
  const [tab, setTab] = useState<Tab>('home')
  const [intent, setIntent] = useState<Intent>(null)
  const [askExit, setAskExit] = useState(false)
  const [exited, setExited] = useState(false)
  const [toastMsg, setToastMsg] = useState('')

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

  if (exited)
    return (
      <div className="exited">
        <p>앱을 종료했습니다.</p>
        <span>이 창을 닫아 주세요.</span>
      </div>
    )

  return (
    <DataCtx.Provider value={{ settings, setSettings, consults, setConsults, contracts, setContracts }}>
      <div className="app">
        <main>
          {tab === 'home' && <Home go={go} />}
          {tab === 'briefing' && <Briefing {...page} />}
          {tab === 'listings' && <Listings />}
          {tab === 'consult' && <ConsultPage {...page} />}
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
