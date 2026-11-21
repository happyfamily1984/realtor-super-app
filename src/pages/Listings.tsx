import { useEffect, useMemo, useRef, useState } from 'react'
import { Chips, Confirm, Icon, PageHead, SampleBadge, Sheet, useData } from '../components/ui'
import { matchMain } from '../data/main'
import type { Deal, Kind, Listing, Trade } from '../data/sample'
import { api } from '../lib/api'
import { articleUrl, BOOKMARKLET, findDupes, mergeListings, parseCollectorFile, parseRegionNames, type CollectorFile } from '../lib/naverParse'
import { daysUntil, shortDate, shrinkImage, today, toast, uid, usePersist, won } from '../lib/util'

const DEALS = ['전체', '매매', '전세', '월세'] as const
const KINDS = ['전체', '아파트', '오피스텔', '빌라', '상가'] as const

export const listingPrice = (l: Listing) => (l.deal === '월세' ? `${won(l.price)} / ${l.rent}만` : won(l.price))

export default function Listings() {
  const [deal, setDeal] = useState<(typeof DEALS)[number]>('전체')
  const [kind, setKind] = useState<(typeof KINDS)[number]>('전체')
  const [view, setView] = useState<'목록' | '차트'>('목록')
  const { listings, setListings, settings } = useData()
  const [trades, setTrades] = useState<Trade[]>([])
  const [regionNames, setRegionNames] = usePersist<Record<string, string>>('regionNames', {})
  const [region, setRegion] = useState('전체')
  const regionLabel = (code: string) => regionNames[code] ?? (code.endsWith('00000') ? `구 전체(${code.slice(0, 5)})` : `지역 ${code}`)
  const active = useMemo(() => listings.filter((l) => !l.gone), [listings])
  const goneList = useMemo(() => listings.filter((l) => l.gone).sort((a, b) => b.gone!.localeCompare(a.gone!)), [listings])
  const lastCollect = listings.reduce((m, l) => (l.lastSeen && l.lastSeen > m ? l.lastSeen : m), '')
  const staleDays = lastCollect ? -daysUntil(lastCollect) : 0

  // 수집해 둔 단지에 새 실거래 신고가 있으면 다시 수집하라고 알려 준다
  useEffect(() => {
    api<{ trades: Trade[] }>(`trades?${new URLSearchParams({ lawd: settings.lawdCd, dong: settings.dong, months: '3' })}`)
      .then((r) => setTrades(r.trades))
      .catch(() => {})
  }, [settings.lawdCd, settings.dong])
  const tradedGroups = useMemo(() => {
    let seen: string[] | null = null
    try {
      seen = JSON.parse(localStorage.getItem('seenTrades') || 'null')
    } catch {
      /* 무시 */
    }
    if (!seen) return []
    const known = new Set(seen)
    const norm = (s: string) => s.replace(/\s/g, '')
    const groups = [...new Set(active.map((l) => l.group ?? l.complex))]
    const fresh = trades.filter((t) => !known.has(t.id))
    return groups.filter((g) => fresh.some((t) => norm(g).includes(norm(t.complex)) || norm(t.complex).includes(norm(g))))
  }, [trades, active])
  const [importing, setImporting] = useState(false)
  const [clearing, setClearing] = useState(false)
  const isSample = listings.some((l) => !l.src)
  const isMain = (l: Listing) => !!matchMain(l.group ?? l.complex, settings.mainComplexes)
  const hasMain = listings.some((l) => l.src && !l.gone && isMain(l))
  const [scopePick, setScope] = useState<'메인 단지' | '전체 단지' | null>(null)
  const scope = scopePick ?? (hasMain ? '메인 단지' : '전체 단지')
  const [showDupes, setShowDupes] = useState(false)
  const dupes = useMemo(() => findDupes(listings, settings.myRealtor || settings.office, settings.myArticles), [listings, settings.myRealtor, settings.office, settings.myArticles])
  // 새로 발견된 중복 광고는 한 번만 알린다
  useEffect(() => {
    const key = (d: (typeof dupes)[number]) => `${d.mine.key}>${d.other.key}`
    let seen: string[] = []
    try {
      seen = JSON.parse(localStorage.getItem('seenDupes') || '[]')
    } catch {
      /* 무시 */
    }
    const fresh = dupes.filter((d) => !seen.includes(key(d)))
    if (!fresh.length) return
    localStorage.setItem('seenDupes', JSON.stringify(dupes.map(key)))
    const msg = `내 매물과 같은 매물을 다른 부동산이 광고 중입니다 (새로 ${fresh.length}건)`
    toast(msg)
    if ('Notification' in window && Notification.permission === 'granted') new Notification('중복 광고 발견', { body: `${fresh[0].mine.complex} · ${fresh[0].other.realtor}${fresh.length > 1 ? ` 외 ${fresh.length - 1}건` : ''}` })
  }, [dupes])

  const rows = useMemo(
    () => active.filter((l) => (scope === '전체 단지' || isMain(l)) && (deal === '전체' || l.deal === deal) && (kind === '전체' || l.kind === kind) && (region === '전체' || (l.region && regionLabel(l.region) === region))),
    [deal, kind, region, active, regionNames, scope, settings.mainComplexes],
  )
  // 차트는 가격 단위가 같아야 하므로 한 가지 거래유형 기준
  const chartDeal = deal === '전체' ? '매매' : deal
  const chartRows = rows.filter((l) => l.deal === chartDeal)
  const prices = chartRows.map((l) => l.price)

  const byComplex = useMemo(() => {
    const m = new Map<string, number[]>()
    chartRows.forEach((l) => m.set(l.complex, [...(m.get(l.complex) ?? []), l.price]))
    return [...m].map(([name, v]) => ({ name, avg: Math.round(v.reduce((a, b) => a + b, 0) / v.length), n: v.length })).sort((a, b) => b.avg - a.avg)
  }, [chartRows])
  const maxAvg = Math.max(...byComplex.map((c) => c.avg), 1)

  // 동(지역 코드)별 비교: 현재 매물 수, 매매 평균, 마지막 수집에서의 변동
  const byRegion = useMemo(() => {
    const m = new Map<string, { n: number; sale: number[]; added: number; changed: number; gone: number }>()
    for (const l of listings) {
      if (!l.region) continue
      const r = m.get(l.region) ?? { n: 0, sale: [], added: 0, changed: 0, gone: 0 }
      if (l.gone) {
        if (l.gone === lastCollect) r.gone++
      } else {
        r.n++
        if (l.deal === '매매') r.sale.push(l.price)
        if (l.newAt === lastCollect) r.added++
        if (l.changedAt === lastCollect) r.changed++
      }
      m.set(l.region, r)
    }
    return [...m].map(([code, r]) => ({ code, ...r, avg: r.sale.length ? Math.round(r.sale.reduce((a, b) => a + b, 0) / r.sale.length) : 0 })).sort((a, b) => b.n - a.n)
  }, [listings, lastCollect])
  const regionOptions = ['전체', ...new Set(byRegion.filter((r) => r.n).map((r) => regionLabel(r.code)))]

  return (
    <>
      <PageHead
        title="지역 매물"
        sub="매물 정리·시각화"
        right={
          <button className="btn small" onClick={() => setImporting(true)}>
            <Icon name="plus" size={18} /> 가져오기
          </button>
        }
      />
      {isSample && (
        <section className="block">
          <SampleBadge /> <small>‘가져오기’로 실제 매물을 넣으면 샘플은 사라집니다.</small>
        </section>
      )}
      {dupes.length > 0 && (
        <section className="block">
          <button className="notice" onClick={() => setShowDupes(true)}>
            <Icon name="bell" />
            <span>
              <b>내 매물을 다른 부동산도 광고 중 · {dupes.length}건</b>
              <small>눌러서 어떤 매물인지 확인하세요.</small>
            </span>
          </button>
        </section>
      )}
      {lastCollect && (
        <section className="block">
          {staleDays >= STALE_DAYS || tradedGroups.length > 0 ? (
            <button className="notice" onClick={() => setImporting(true)}>
              <Icon name="bell" />
              <span>
                <b>매물을 다시 수집해 주세요</b>
                {staleDays >= STALE_DAYS && <small>마지막 수집 후 {staleDays}일이 지났습니다.</small>}
                {tradedGroups.length > 0 && <small>새 실거래 신고: {tradedGroups.slice(0, 3).join(', ')}{tradedGroups.length > 3 ? ` 외 ${tradedGroups.length - 3}곳` : ''}</small>}
              </span>
            </button>
          ) : (
            <small>
              마지막 수집 {staleDays === 0 ? '오늘' : `${staleDays}일 전`} · 누적 {listings.length}건 (현재 {active.length}건)
            </small>
          )}
        </section>
      )}
      <section className="block filters">
        {hasMain && <Chips options={['메인 단지', '전체 단지'] as const} value={scope} onChange={setScope} />}
        <Chips options={DEALS} value={deal} onChange={setDeal} />
        <Chips options={KINDS} value={kind} onChange={setKind} />
        {regionOptions.length > 2 && <Chips options={regionOptions} value={region} onChange={setRegion} />}
      </section>

      <section className="block">
        <div className="kpis">
          <div>
            <small>매물 수</small>
            <b>{rows.length}건</b>
          </div>
          <div>
            <small>{chartDeal} 평균</small>
            <b>{prices.length ? won(Math.round(prices.reduce((a, b) => a + b, 0) / prices.length)) : '-'}</b>
          </div>
          <div>
            <small>{chartDeal} 최저</small>
            <b>{prices.length ? won(Math.min(...prices)) : '-'}</b>
          </div>
        </div>
        <div className="seg">
          {(['목록', '차트'] as const).map((v) => (
            <button key={v} className={v === view ? 'on' : ''} onClick={() => setView(v)}>
              {v}
            </button>
          ))}
        </div>
      </section>

      {view === '목록' ? (
        <section className="block">
          {rows.length === 0 && <p className="empty">조건에 맞는 매물이 없습니다.</p>}
          {!isSample && listings.length > 0 && (
            <button className="link" onClick={() => setClearing(true)}>
              매물 전체 비우기
            </button>
          )}
          <ul className="list">
            {rows.map((l) => (
              <li key={l.id} className="card">
                <div className="line">
                  <div className="grow">
                    <span className={`tag deal-${l.deal}`}>{l.deal}</span> <span className="tag">{l.kind}</span>
                    {l.newAt && l.newAt === lastCollect && <span className="tag new"> 신규</span>}
                    <b className="title">{l.complex}</b>
                  </div>
                  <div className="right">
                    <b className="price">{listingPrice(l)}</b>
                    {l.prevPrice && l.changedAt === lastCollect && l.prevPrice !== l.price && (
                      <small className={l.price > l.prevPrice ? 'up' : 'down'}>
                        {l.price > l.prevPrice ? '▲' : '▼'} {won(Math.abs(l.price - l.prevPrice))}
                      </small>
                    )}
                  </div>
                </div>
                <small>
                  전용 {l.area}㎡ · {l.floor} · {l.dir} · {shortDate(l.date)} 등록{l.realtor ? ` · ${l.realtor}` : ''}
                </small>
                <p className="news-sum">{l.desc}</p>
              </li>
            ))}
          </ul>
          {goneList.length > 0 && (
            <>
              <h2 className="gone-h">사라진 매물 {goneList.length}건 (거래완료·광고종료 추정)</h2>
              <ul className="list gone">
                {goneList.slice(0, 30).map((l) => (
                  <li key={l.id} className="card line">
                    <div className="grow">
                      <b>{l.complex}</b>
                      <small>
                        {l.deal} · 전용 {l.area}㎡ · {l.floor} · {shortDate(l.gone!)} 사라짐
                      </small>
                    </div>
                    <b className="price">{listingPrice(l)}</b>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      ) : (
        <>
          {byRegion.length > 0 && (
            <section className="block">
              <h2>동별 비교</h2>
              <div className="card rtable">
                <div className="rrow head">
                  <span>지역</span>
                  <span>매물</span>
                  <span>매매 평균</span>
                  <span>신규</span>
                  <span>변동</span>
                  <span>사라짐</span>
                </div>
                {byRegion.map((r) => (
                  <div key={r.code} className="rrow">
                    <span>{regionLabel(r.code)}</span>
                    <span>{r.n}</span>
                    <span>{r.avg ? won(r.avg) : '-'}</span>
                    <span className={r.added ? 'up' : ''}>{r.added}</span>
                    <span>{r.changed}</span>
                    <span className={r.gone ? 'down' : ''}>{r.gone}</span>
                  </div>
                ))}
              </div>
              <p className="hint">신규·변동·사라짐은 마지막 수집에서 확인된 건수입니다.</p>
            </section>
          )}
          <section className="block">
            <h2>단지별 평균 {chartDeal === '월세' ? '보증금' : `${chartDeal}가`}</h2>
            {byComplex.length === 0 && <p className="empty">표시할 매물이 없습니다.</p>}
            <div className="bars">
              {byComplex.map((c, i) => (
                <div key={c.name} className="bar-row">
                  <div className="bar-label">
                    <span>{c.name}</span>
                    <small>{c.n}건</small>
                  </div>
                  <div className="bar-track">
                    <div className={i === 0 ? 'bar top' : 'bar'} style={{ width: `${Math.max(22, (c.avg / maxAvg) * 100)}%` }}>
                      {won(c.avg)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
          <section className="block">
            <h2>면적별 가격 분포 ({chartDeal})</h2>
            <Scatter rows={chartRows} />
          </section>
        </>
      )}

      {showDupes && (
        <Sheet title="같은 매물의 다른 광고" onClose={() => setShowDupes(false)}>
          <p className="hint">마지막으로 수집한 네이버 매물 기준입니다. 동·면적·층이 같으면 같은 매물로 봅니다. 눌러서 네이버에서 확인하세요.</p>
          <ul className="list">
            {dupes.map((d) => (
              <li key={`${d.mine.id}${d.other.id}`} className="card">
                <a className="dupe" href={articleUrl(d.other)} target="_blank" rel="noreferrer">
                  <div className="line">
                    <div className="grow">
                      <span className={`tag deal-${d.other.deal}`}>{d.other.deal}</span> {!d.sure && <span className="tag">추정</span>}
                      <b className="title">{d.other.complex}</b>
                    </div>
                    <Icon name="chevron" />
                  </div>
                  <small>
                    전용 {d.other.area}㎡ · {d.other.floor}
                  </small>
                  <div className="dupe-cmp">
                    <span>
                      <small>우리 광고</small>
                      <b>{listingPrice(d.mine)}</b>
                    </span>
                    <span>
                      <small>{d.other.realtor}</small>
                      <b className={d.other.price < d.mine.price ? 'down' : d.other.price > d.mine.price ? 'up' : ''}>{listingPrice(d.other)}</b>
                    </span>
                  </div>
                </a>
              </li>
            ))}
          </ul>
        </Sheet>
      )}
      {importing && (
        <ImportSheet
          onClose={() => setImporting(false)}
          onRegions={(names) => setRegionNames((p) => ({ ...p, ...names }))}
          onDone={(items) => {
            const m = mergeListings(listings, items)
            setListings(m.list)
            if (trades.length) localStorage.setItem('seenTrades', JSON.stringify(trades.map((t) => t.id)))
            setImporting(false)
            toast(`매물 ${items.length}건 수집 · 신규 ${m.added} · 가격변동 ${m.changed} · 사라짐 ${m.gone}`)
          }}
        />
      )}
      {clearing && (
        <Confirm
          message="가져온 매물을 모두 삭제하겠습니까?"
          onNo={() => setClearing(false)}
          onYes={() => {
            setListings([])
            setClearing(false)
          }}
        />
      )}
    </>
  )
}

const STALE_DAYS = 3 // 이 날수가 지나면 다시 수집하라고 알린다
const DEAL_SET: Deal[] = ['매매', '전세', '월세']
const KIND_SET: Kind[] = ['아파트', '오피스텔', '빌라', '상가']

/** 매물 화면에서 복사한 글·캡처를 AI 가 표로 정리 */
function ImportSheet({ onClose, onDone, onRegions }: { onClose: () => void; onDone: (items: Listing[]) => void; onRegions: (names: Record<string, string>) => void }) {
  const [text, setText] = useState('')
  const [shots, setShots] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  /** PC 수집기 파일: 바로 인식되면 그대로 가져오고, 형식을 못 알아보면 화면 글을 AI 에 맡긴다 */
  const loadFile = async (file?: File) => {
    if (!file) return
    let data: CollectorFile
    try {
      data = JSON.parse(await file.text())
    } catch {
      return toast('수집기에서 저장한 파일이 아닙니다')
    }
    onRegions(parseRegionNames(data))
    const items = parseCollectorFile(data)
    if (items.length) return onDone(items)
    if (data.pageText?.trim()) {
      setText(data.pageText)
      toast('매물 형식을 바로 알아보지 못했습니다. 아래 버튼으로 AI 정리를 해 주세요.')
    } else toast('파일에서 매물을 찾지 못했습니다')
  }

  const addShots = async (files: FileList | null) => {
    if (!files) return
    const add = await Promise.all(Array.from(files).map((f) => shrinkImage(f, 1400)))
    setShots((p) => [...p, ...add].slice(0, 6))
  }
  const run = async () => {
    setBusy(true)
    try {
      const r = await api<{ listings: Partial<Listing>[] }>('ai', { task: 'listings', text, images: shots })
      const items = (r.listings ?? [])
        .filter((l) => l.complex && Number(l.price) > 0)
        .map<Listing>((l) => ({
          id: uid(),
          complex: String(l.complex),
          kind: KIND_SET.includes(l.kind as Kind) ? (l.kind as Kind) : '아파트',
          deal: DEAL_SET.includes(l.deal as Deal) ? (l.deal as Deal) : '매매',
          price: Number(l.price) || 0,
          rent: Number(l.rent) || undefined,
          area: Number(l.area) || 0,
          floor: String(l.floor || '-'),
          dir: String(l.dir || '-'),
          desc: String(l.desc || ''),
          date: today(),
          src: 'import',
        }))
        .map((l) => ({ ...l, key: `${l.complex}|${l.deal}|${l.area}|${l.floor}`, group: l.complex.replace(/\s*\d+동$/, '') }))
      if (!items.length) return toast('매물을 찾지 못했습니다. 목록이 잘 보이게 다시 시도해 주세요.')
      onDone(items)
    } catch (e) {
      toast((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet
      title="매물 가져오기"
      onClose={onClose}
      footer={
        <button className="btn block-btn" disabled={busy || (!text.trim() && !shots.length)} onClick={run}>
          {busy ? 'AI가 정리하는 중…' : 'AI로 정리해서 가져오기'}
        </button>
      }
    >
      <p className="hint">
        네이버 부동산 등에서 보고 있는 매물 목록을 <b>화면 캡처</b>하거나 <b>글을 길게 눌러 복사</b>해서 넣어 주세요. AI가 단지·가격·면적·층을 표로 정리합니다.
      </p>
      <details className="pc-box">
        <summary>PC에서 네이버 매물 한 번에 가져오기</summary>
        <ol>
          <li>
            PC 크롬에서 이 앱을 열고, 아래 버튼을 <b>즐겨찾기 막대로 끌어다 놓습니다</b>. (막대가 안 보이면 Ctrl+Shift+B)
            <a className="bookmarklet" ref={(el) => el?.setAttribute('href', BOOKMARKLET)} onClick={(e) => e.preventDefault()}>
              매물 수집기
            </a>
          </li>
          <li>네이버 부동산에서 원하는 지역을 열고, 즐겨찾기의 <b>매물 수집기</b>를 누릅니다.</li>
          <li>단지를 누르거나 매물 목록을 아래로 내리면 화면에 뜨는 매물이 모입니다.</li>
          <li><b>파일로 저장</b>을 누른 뒤, 그 파일을 아래에서 선택합니다.</li>
        </ol>
        <p className="hint">
          <b>더 편한 방법 (크롬 확장 프로그램)</b>: 동 이름만 넣으면 그 동으로 이동해 매물을 모으고, 이 앱 창을 열면 자동으로 들어옵니다.{' '}
          <a href="./collector-extension.zip" download>
            확장 프로그램 내려받기
          </a>
          <br />
          압축을 푼 뒤 크롬 주소창에 chrome://extensions → 오른쪽 위 ‘개발자 모드’ 켜기 → ‘압축해제된 확장 프로그램을 로드합니다’에서 그 폴더를 선택합니다.
        </p>
        <button className="btn ghost block-btn" onClick={() => fileInput.current?.click()}>
          수집 파일 선택 (.json)
        </button>
        <input
          ref={fileInput}
          type="file"
          accept=".json,application/json"
          hidden
          onChange={(e) => {
            loadFile(e.target.files?.[0])
            e.target.value = ''
          }}
        />
      </details>
      <h3 className="sub-h">화면 캡처 (최대 6장)</h3>
      <div className="photos">
        {shots.map((s, i) => (
          <button key={i} className="photo" onClick={() => setShots((p) => p.filter((_, j) => j !== i))} aria-label="캡처 빼기">
            <img src={s} alt={`캡처 ${i + 1}`} />
          </button>
        ))}
        {shots.length < 6 && (
          <button className="photo add" onClick={() => input.current?.click()}>
            <Icon name="plus" />
            <small>캡처 선택</small>
          </button>
        )}
        <input
          ref={input}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => {
            addShots(e.target.files)
            e.target.value = ''
          }}
        />
      </div>
      {shots.length > 0 && <p className="hint">캡처를 누르면 빠집니다.</p>}
      <h3 className="sub-h">복사한 글 붙여넣기</h3>
      <textarea rows={6} value={text} onChange={(e) => setText(e.target.value)} placeholder="매물 목록을 복사해 여기에 붙여넣기" />
    </Sheet>
  )
}

function Scatter({ rows }: { rows: Listing[] }) {
  if (rows.length < 2) return <p className="empty">매물이 2건 이상일 때 표시됩니다.</p>
  const W = 340
  const H = 220
  const pad = { l: 52, r: 14, t: 12, b: 30 }
  const xs = rows.map((r) => r.area)
  const ys = rows.map((r) => r.price)
  const [x0, x1] = [Math.min(...xs) - 5, Math.max(...xs) + 5]
  const [y0, y1] = [Math.min(...ys) * 0.92, Math.max(...ys) * 1.05]
  const px = (v: number) => pad.l + ((v - x0) / (x1 - x0)) * (W - pad.l - pad.r)
  const py = (v: number) => H - pad.b - ((v - y0) / (y1 - y0)) * (H - pad.t - pad.b)
  const ticks = [0, 0.5, 1].map((k) => y0 + (y1 - y0) * k)
  return (
    <div className="card chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="면적별 가격 분포">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={py(t)} y2={py(t)} stroke="#e4e6e1" />
            <text x={pad.l - 6} y={py(t) + 4} textAnchor="end" fontSize="10" fill="#66736d">
              {won(Math.round(t / 1000) * 1000)}
            </text>
          </g>
        ))}
        {[...new Set(xs)].map((x) => (
          <text key={x} x={px(x)} y={H - 10} textAnchor="middle" fontSize="10" fill="#66736d">
            {x}㎡
          </text>
        ))}
        {rows.map((r) => (
          <circle key={r.id} cx={px(r.area)} cy={py(r.price)} r="6" fill="#0e6b57" fillOpacity=".75" stroke="#fff" strokeWidth="1.5">
            <title>{`${r.complex} ${r.area}㎡ ${won(r.price)}`}</title>
          </circle>
        ))}
      </svg>
    </div>
  )
}
