// 손님용 앱: 소식 · 실거래 알림 · 매물 내놓기 · 상담
import { useEffect, useMemo, useRef, useState } from 'react'
import IntakeForm from '../components/IntakeForm'
import { Chips, Confirm, Field, Icon, Sheet } from '../components/ui'
import { blankIntake, type Intake } from '../data/intake'
import { DEFAULT_MAIN, displayName, matchMain, type MainComplex } from '../data/main'
import { api } from '../lib/api'
import { exitApp, initNav, stayInApp, useBackLayer } from '../lib/nav'
import { deviceId, enablePush, pushState } from '../lib/push'
import { toast, usePersist, won } from '../lib/util'

type Tab = 'feed' | 'trades' | 'sell' | 'chat'
const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'feed', label: '소식', icon: 'briefing' },
  { id: 'trades', label: '실거래', icon: 'listings' },
  { id: 'sell', label: '매물 내놓기', icon: 'contracts' },
  { id: 'chat', label: '상담', icon: 'consult' },
]
const REGIONS: [string, string][] = [['41173', '안양시 동안구']]

// 사무소가 정한 메인 단지 (표시 이름에 쓴다). 앱을 열 때 한 번 받아 온다.
let mainList: MainComplex[] = DEFAULT_MAIN
const fixOld = (list: MainComplex[]) => list.map((m) => (m.name === '공작부영' ? DEFAULT_MAIN.find((d) => d.name === '공작부영아파트')! : m))
const label = (complex: string, kind?: string) => displayName(complex, mainList, kind)

interface Post {
  id: string
  title: string
  body: string
  images: string[]
  kind: string
  at: number
}
interface Profile {
  name: string
  phone: string
}
const day = (at: number) => {
  const d = new Date(at)
  return `${d.getMonth() + 1}월 ${d.getDate()}일`
}
const clock = (at: number) => {
  const d = new Date(at)
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`
}

export default function CustomerApp() {
  const cid = useMemo(() => deviceId('cid'), [])
  const [tab, setTab] = useState<Tab>('feed')
  const [profile, setProfile] = usePersist<Profile>('cprofile', { name: '', phone: '' })
  const [askExit, setAskExit] = useState(false)
  const [exited, setExited] = useState(false)
  const [toastMsg, setToastMsg] = useState('')
  const [perm, setPerm] = useState(pushState())
  const [focusPost, setFocusPost] = useState('')

  useEffect(() => initNav(() => setAskExit(true)), [])
  useBackLayer(tab !== 'feed', () => setTab('feed'))

  // 알림을 눌러 들어온 경우 해당 화면으로
  useEffect(() => {
    const open = (url: string) => {
      const p = new URL(url, location.href).searchParams
      const go = p.get('go')
      if (go === 'chat' || go === 'trades') setTab(go)
      if (p.get('post')) {
        setTab('feed')
        setFocusPost(p.get('post')!)
      }
    }
    open(location.href)
    const h = (e: MessageEvent) => e.data?.type === 'push-open' && open(e.data.url)
    navigator.serviceWorker?.addEventListener('message', h)
    return () => navigator.serviceWorker?.removeEventListener('message', h)
  }, [])

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

  const turnOnPush = async () => {
    try {
      await enablePush('c', cid)
      toast('알림을 켰습니다')
    } catch (e) {
      toast((e as Error).message)
    }
    setPerm(pushState())
  }

  if (exited)
    return (
      <div className="exited">
        <p>앱을 종료했습니다.</p>
        <span>이 창을 닫아 주세요.</span>
      </div>
    )

  return (
    <div className="app">
      <main>
        {tab === 'feed' && <Feed focus={focusPost} />}
        {tab === 'trades' && <Trades cid={cid} perm={perm} onPush={turnOnPush} />}
        {tab === 'sell' && <Sell cid={cid} profile={profile} setProfile={setProfile} />}
        {tab === 'chat' && <Chat cid={cid} profile={profile} setProfile={setProfile} perm={perm} onPush={turnOnPush} />}
      </main>
      <nav className="tabbar four" aria-label="하단 메뉴">
        {TABS.map((t) => (
          <button key={t.id} className={t.id === tab ? 'on' : ''} aria-current={t.id === tab ? 'page' : undefined} onClick={() => (setTab(t.id), window.scrollTo(0, 0))}>
            <Icon name={t.icon} />
            <span>{t.label}</span>
          </button>
        ))}
      </nav>
      {toastMsg && <div className="toast" role="status">{toastMsg}</div>}
      {askExit && (
        <Confirm
          layer={false}
          message="앱을 종료하겠습니까?"
          onNo={() => (setAskExit(false), stayInApp())}
          onYes={() => {
            exitApp()
            setTimeout(() => setExited(true), 250)
          }}
        />
      )}
    </div>
  )
}

const PushBanner = ({ perm, onPush, text }: { perm: string; onPush: () => void; text: string }) =>
  perm === 'granted' || perm === 'unsupported' ? null : (
    <section className="block">
      <button className="notice" onClick={onPush}>
        <Icon name="bell" />
        <span>
          <b>알림 켜기</b>
          <small>{text}</small>
        </span>
      </button>
    </section>
  )

// ── 소식 ─────────────────────────────────────────
function Feed({ focus }: { focus: string }) {
  const [posts, setPosts] = useState<Post[] | null>(null)
  const [office, setOffice] = useState('')
  const [err, setErr] = useState('')
  const [view, setView] = useState<string | null>(null)
  useBackLayer(!!view, () => setView(null))

  useEffect(() => {
    api<{ posts: Post[]; office: string }>('c?a=feed')
      .then((r) => (setPosts(r.posts), setOffice(r.office)))
      .catch((e) => setErr(e.message))
  }, [])
  useEffect(() => {
    if (focus && posts) document.getElementById(`post-${focus}`)?.scrollIntoView({ block: 'start' })
  }, [focus, posts])

  return (
    <>
      <header className="page-head">
        <div>
          <h1>{office || '우리 동네 부동산'}</h1>
          <p>중개사무소가 전하는 시세와 소식</p>
        </div>
      </header>
      <section className="block">
        {err && <p className="warn-note">{err}</p>}
        {!posts && !err && <p className="hint">소식을 불러오는 중…</p>}
        {posts?.length === 0 && <p className="empty">아직 올라온 소식이 없습니다.</p>}
        <ul className="list">
          {posts?.map((p) => (
            <li key={p.id} id={`post-${p.id}`} className="card post">
              <small>
                <span className="tag">{p.kind}</span> {day(p.at)}
              </small>
              <b className="title">{p.title}</b>
              {p.images.length > 0 && (
                <div className="card-strip">
                  {p.images.map((src, i) => (
                    <img key={i} src={src} alt={`${p.title} ${i + 1}`} loading="lazy" onClick={() => setView(src)} />
                  ))}
                </div>
              )}
              {p.body && <p className="post-body">{p.body}</p>}
            </li>
          ))}
        </ul>
      </section>
      {view && (
        <div className="overlay viewer" onClick={() => setView(null)}>
          <img src={view} alt="크게 보기" />
        </div>
      )}
    </>
  )
}

// ── 실거래 알림 ──────────────────────────────────
interface Watch {
  lawd: string
  complex: string
  dong: string
}
interface TradeRow {
  id: string
  complex: string
  dong: string
  area: number
  floor: number
  price: number
  prev?: number
  date: string
}
function Trades({ cid, perm, onPush }: { cid: string; perm: string; onPush: () => void }) {
  const [items, setItems] = useState<Watch[]>([])
  const [trades, setTrades] = useState<TradeRow[]>([])
  const [err, setErr] = useState('')
  const [adding, setAdding] = useState(false)
  const [, redraw] = useState(0)
  useEffect(() => {
    api<{ main?: MainComplex[] }>('c?a=profile')
      .then((r) => {
        if (r.main?.length) mainList = fixOld(r.main)
        redraw((n) => n + 1)
      })
      .catch(() => {})
  }, [])

  const loadTrades = () =>
    api<{ trades: TradeRow[] }>(`c?a=watchTrades&id=${cid}`)
      .then((r) => (setTrades(r.trades), setErr('')))
      .catch((e) => setErr(e.message))
  useEffect(() => {
    api<{ items: Watch[] }>(`c?a=watch&id=${cid}`)
      .then((r) => {
        setItems(r.items)
        if (r.items.length) loadTrades()
      })
      .catch((e) => setErr(e.message))
  }, [])

  const save = async (next: Watch[]) => {
    setItems(next)
    try {
      await api('c', { a: 'watchSet', id: cid, items: next })
      next.length ? loadTrades() : setTrades([])
    } catch (e) {
      toast((e as Error).message)
    }
  }

  return (
    <>
      <header className="page-head">
        <div>
          <h1>실거래 알림</h1>
          <p>관심 아파트에 새 실거래가 신고되면 알려 드립니다</p>
        </div>
        <button className="btn small" onClick={() => setAdding(true)}>
          <Icon name="plus" size={18} /> 아파트
        </button>
      </header>
      <PushBanner perm={perm} onPush={onPush} text="앱을 닫아도 새 실거래 신고를 알려 드립니다." />
      <section className="block">
        <h2>관심 아파트</h2>
        {items.length === 0 && <p className="empty">안양시 동안구의 아파트·오피스텔을 골라 주세요.</p>}
        <ul className="list">
          {items.map((w) => (
            <li key={`${w.lawd}${w.dong}${w.complex}`} className="card line">
              <div className="grow">
                <b>{label(w.complex)}</b>
                <small>
                  {REGIONS.find(([c]) => c === w.lawd)?.[1]} {w.dong}
                </small>
              </div>
              <button className="icon-btn" aria-label={`${label(w.complex)} 빼기`} onClick={() => save(items.filter((x) => x !== w))}>
                <Icon name="close" />
              </button>
            </li>
          ))}
        </ul>
      </section>
      {items.length > 0 && (
        <section className="block">
          <h2>최근 실거래</h2>
          {err && <p className="warn-note">{err}</p>}
          {!err && trades.length === 0 && <p className="empty">최근 6개월간 신고된 거래가 없습니다.</p>}
          <ul className="list">
            {trades.map((t) => {
              const d = t.prev ? t.price - t.prev : 0
              return (
                <li key={t.id} className="card line">
                  <div className="grow">
                    <b>{label(t.complex)}</b>
                    <small>
                      전용 {t.area}㎡ {t.floor}층, 계약 {t.date.slice(5).replace('-', '.')}
                    </small>
                  </div>
                  <div className="right">
                    <b>{won(t.price)}</b>
                    <small className={d > 0 ? 'up' : d < 0 ? 'down' : ''}>{!t.prev ? '' : d === 0 ? '보합' : `${d > 0 ? '▲' : '▼'} ${won(Math.abs(d))}`}</small>
                  </div>
                </li>
              )
            })}
          </ul>
          <p className="hint">자료: 국토교통부 실거래가 공개시스템 (아파트 매매)</p>
        </section>
      )}
      {adding && <AddComplex picked={items} onToggle={(w, on) => save(on ? [...items, w] : items.filter((x) => !(x.lawd === w.lawd && x.complex === w.complex && x.dong === w.dong)))} onClose={() => setAdding(false)} />}
    </>
  )
}

function AddComplex({ picked, onToggle, onClose }: { picked: Watch[]; onToggle: (w: Watch, on: boolean) => void; onClose: () => void }) {
  const names = REGIONS.map(([, n]) => n)
  const [region, setRegion] = useState(names[0])
  const [q, setQ] = useState('')
  const [list, setList] = useState<{ complex: string; dong: string; kind?: string; n: number }[] | null>(null)
  const [main, setMain] = useState<MainComplex[]>(DEFAULT_MAIN)
  const [err, setErr] = useState('')
  const lawd = REGIONS.find(([, n]) => n === region)![0]

  useEffect(() => {
    setList(null)
    setErr('')
    api<{ complexes: { complex: string; dong: string; kind?: string; n: number }[]; main?: MainComplex[] }>(`c?a=complexes&lawd=${lawd}`)
      .then((r) => {
        setList(r.complexes)
        if (r.main?.length) setMain(fixOld(r.main))
      })
      .catch((e) => setErr(e.message))
  }, [lawd])
  const isMain = (c: { complex: string; kind?: string }) => !!matchMain(c.complex, main, c.kind)
  // 중개사무소가 주로 다루는 단지를 맨 위에
  const rows = (list ?? []).filter((c) => !q.trim() || `${c.complex}${label(c.complex, c.kind)}${c.dong}`.includes(q.trim())).sort((a, b) => Number(isMain(b)) - Number(isMain(a)))
  const has = (c: { complex: string; dong: string }) => picked.some((w) => w.lawd === lawd && w.complex === c.complex && w.dong === c.dong)

  return (
    <Sheet title="관심 아파트 고르기" onClose={onClose}>
      {names.length > 1 && <Chips options={names} value={region} onChange={setRegion} />}
      <Field label="아파트 또는 동 이름으로 찾기">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="예: 평촌, 래미안" />
      </Field>
      {err && <p className="warn-note">{err}</p>}
      {!list && !err && <p className="hint">아파트 목록을 불러오는 중…</p>}
      {list && <p className="hint">안양시 동안구에서 최근 6개월 안에 매매 거래가 있었던 아파트·오피스텔 {list.length}곳입니다. 최대 20곳까지 고를 수 있습니다.</p>}
      <ul className="list">
        {rows.slice(0, 80).map((c) => {
          const on = has(c)
          return (
            <li key={c.dong + c.complex} className={on ? 'card pick on' : 'card pick'} role="checkbox" aria-checked={on} onClick={() => (on || picked.length < 20 ? onToggle({ lawd, complex: c.complex, dong: c.dong }, !on) : toast('20곳까지 고를 수 있습니다'))}>
              <span className="check">{on ? '✓' : ''}</span>
              <div className="grow">
                <b>{label(c.complex, c.kind)}</b>
                <small>
                  {isMain(c) && <span className="tag score">추천</span>} {c.kind ?? '아파트'} · {c.dong}, 최근 거래 {c.n}건
                </small>
              </div>
            </li>
          )
        })}
      </ul>
    </Sheet>
  )
}

// ── 매물 내놓기 ──────────────────────────────────
interface Mine {
  id: string
  complex: string
  address: string
  deal: string
  kind: string
  price: number
  status: string
  createdAt: number
}
function Sell({ cid, profile, setProfile }: { cid: string; profile: Profile; setProfile: (p: Profile) => void }) {
  const [form, setForm] = useState<Intake | null>(null)
  const [mine, setMine] = useState<Mine[]>([])
  const [busy, setBusy] = useState(false)
  const load = () => api<{ intakes: Mine[] }>(`c?a=myIntakes&id=${cid}`).then((r) => setMine(r.intakes)).catch(() => {})
  useEffect(() => void load(), [])

  const submit = async () => {
    if (!form) return
    if (!form.ownerName.trim() || !form.ownerPhone.trim()) return toast('이름과 연락처를 입력해 주세요')
    if (!form.address.trim() && !form.complex.trim()) return toast('주소나 단지 이름을 입력해 주세요')
    if (!form.price) return toast('희망 가격을 입력해 주세요')
    if (!form.agree) return toast('개인정보 수집·이용에 동의해 주세요')
    setBusy(true)
    try {
      await api('c', { a: 'intake', id: cid, form })
      setProfile({ name: form.ownerName, phone: form.ownerPhone })
      setForm(null)
      toast('매물을 접수했습니다. 확인 후 연락드리겠습니다.')
      load()
    } catch (e) {
      toast((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <header className="page-head">
        <div>
          <h1>매물 내놓기</h1>
          <p>집 정보를 적어 주시면 확인 후 연락드립니다</p>
        </div>
      </header>
      <section className="block">
        <button className="btn block-btn" onClick={() => setForm({ ...blankIntake(), ownerName: profile.name, ownerPhone: profile.phone })}>
          매물 접수하기
        </button>
        <p className="hint sell-hint">매매·전세·월세 모두 접수할 수 있습니다. 아는 만큼만 적으셔도 됩니다.</p>
      </section>
      <section className="block">
        <h2>내 접수 내역</h2>
        {mine.length === 0 && <p className="empty">접수한 매물이 없습니다.</p>}
        <ul className="list">
          {mine.map((m) => (
            <li key={m.id} className="card line">
              <div className="grow">
                <b>{m.complex || m.address}</b>
                <small>
                  {m.kind} {m.deal} {won(m.price)}, {day(m.createdAt)} 접수
                </small>
              </div>
              <span className={`status i-${m.status}`}>{m.status}</span>
            </li>
          ))}
        </ul>
      </section>
      {form && (
        <Sheet
          title="매물 접수"
          onClose={() => setForm(null)}
          footer={
            <button className="btn block-btn" disabled={busy} onClick={submit}>
              {busy ? '보내는 중…' : '접수하기'}
            </button>
          }
        >
          <IntakeForm value={form} onChange={setForm} />
        </Sheet>
      )}
    </>
  )
}

// ── 채팅 상담 ────────────────────────────────────
interface Msg {
  id: string
  from: 'customer' | 'office'
  text: string
  at: number
}
function Chat({ cid, profile, setProfile, perm, onPush }: { cid: string; profile: Profile; setProfile: (p: Profile) => void; perm: string; onPush: () => void }) {
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [text, setText] = useState('')
  const [err, setErr] = useState('')
  const [askName, setAskName] = useState(false)
  const [draft, setDraft] = useState(profile)
  const last = useRef(0)
  const end = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let alive = true
    const pull = () => {
      if (document.hidden) return
      api<{ messages: Msg[] }>(`c?a=chat&id=${cid}&after=${last.current}`)
        .then((r) => {
          if (!alive) return
          setErr('')
          if (r.messages.length) {
            last.current = r.messages[r.messages.length - 1].at
            setMsgs((p) => [...p, ...r.messages.filter((m) => !p.some((x) => x.id === m.id))])
          }
        })
        .catch((e) => alive && setErr(e.message))
    }
    pull()
    const t = setInterval(pull, 4000)
    return () => {
      alive = false
      clearInterval(t)
    }
  }, [])
  useEffect(() => {
    end.current?.scrollIntoView({ block: 'end' }) // 최신 브라우저는 Promise 를 돌려주므로 그대로 반환하면 안 된다
  }, [msgs.length])

  const send = async (who = profile) => {
    const body = text.trim()
    if (!body) return
    if (!who.name.trim()) return setAskName(true)
    setText('')
    try {
      const r = await api<{ message: Msg }>('c', { a: 'chatSend', id: cid, text: body, name: who.name, phone: who.phone })
      last.current = Math.max(last.current, r.message.at)
      setMsgs((p) => [...p, r.message])
    } catch (e) {
      setText(body)
      toast((e as Error).message)
    }
  }

  return (
    <>
      <header className="page-head">
        <div>
          <h1>상담</h1>
          <p>궁금한 점을 남기시면 중개사가 답해 드립니다</p>
        </div>
      </header>
      <PushBanner perm={perm} onPush={onPush} text="답변이 오면 바로 알려 드립니다." />
      <section className="block chat">
        {err && <p className="warn-note">{err}</p>}
        {msgs.length === 0 && !err && <p className="empty">매수·매도·전월세 무엇이든 편하게 물어보세요.</p>}
        {msgs.map((m, i) => (
          <div key={m.id}>
            {(i === 0 || day(msgs[i - 1].at) !== day(m.at)) && <p className="chat-day">{day(m.at)}</p>}
            <div className={`bubble-row ${m.from === 'customer' ? 'me' : ''}`}>
              <p className="bubble">{m.text}</p>
              <small>{clock(m.at)}</small>
            </div>
          </div>
        ))}
        <div ref={end} />
      </section>
      <form
        className="chat-input"
        onSubmit={(e) => {
          e.preventDefault()
          send()
        }}
      >
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="메시지 입력" aria-label="메시지" />
        <button className="btn small" disabled={!text.trim()}>
          보내기
        </button>
      </form>
      {askName && (
        <Sheet
          title="상담을 시작합니다"
          onClose={() => setAskName(false)}
          footer={
            <button
              className="btn block-btn"
              onClick={() => {
                if (!draft.name.trim()) return toast('이름을 입력해 주세요')
                setProfile(draft)
                setAskName(false)
                send(draft)
              }}
            >
              상담 시작
            </button>
          }
        >
          <p className="hint">답변드릴 때 부를 이름과, 통화가 필요할 때 쓸 연락처를 알려 주세요.</p>
          <Field label="이름">
            <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="홍길동" />
          </Field>
          <Field label="연락처 (선택)">
            <input type="tel" inputMode="tel" value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} placeholder="010-0000-0000" />
          </Field>
        </Sheet>
      )}
    </>
  )
}
