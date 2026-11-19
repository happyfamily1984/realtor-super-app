import { useMemo, useRef, useState } from 'react'
import { Chips, Confirm, Icon, PageHead, SampleBadge, Sheet, useData } from '../components/ui'
import type { Deal, Kind, Listing } from '../data/sample'
import { api } from '../lib/api'
import { shortDate, shrinkImage, today, toast, uid, won } from '../lib/util'

const DEALS = ['전체', '매매', '전세', '월세'] as const
const KINDS = ['전체', '아파트', '오피스텔', '빌라', '상가'] as const

export const listingPrice = (l: Listing) => (l.deal === '월세' ? `${won(l.price)} / ${l.rent}만` : won(l.price))

export default function Listings() {
  const [deal, setDeal] = useState<(typeof DEALS)[number]>('전체')
  const [kind, setKind] = useState<(typeof KINDS)[number]>('전체')
  const [view, setView] = useState<'목록' | '차트'>('목록')
  const { listings, setListings } = useData()
  const [importing, setImporting] = useState(false)
  const [clearing, setClearing] = useState(false)
  const isSample = listings.some((l) => !l.src)

  const rows = useMemo(
    () => listings.filter((l) => (deal === '전체' || l.deal === deal) && (kind === '전체' || l.kind === kind)),
    [deal, kind, listings],
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
      <section className="block filters">
        <Chips options={DEALS} value={deal} onChange={setDeal} />
        <Chips options={KINDS} value={kind} onChange={setKind} />
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
                    <b className="title">{l.complex}</b>
                  </div>
                  <b className="price">{listingPrice(l)}</b>
                </div>
                <small>
                  전용 {l.area}㎡ · {l.floor} · {l.dir} · {shortDate(l.date)} 등록
                </small>
                <p className="news-sum">{l.desc}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <>
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

      {importing && (
        <ImportSheet
          onClose={() => setImporting(false)}
          onDone={(items) => {
            setListings((p) => [...items, ...p.filter((l) => l.src)]) // 샘플은 제거
            setImporting(false)
            toast(`매물 ${items.length}건을 가져왔습니다`)
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

const DEAL_SET: Deal[] = ['매매', '전세', '월세']
const KIND_SET: Kind[] = ['아파트', '오피스텔', '빌라', '상가']

/** 매물 화면에서 복사한 글·캡처를 AI 가 표로 정리 */
function ImportSheet({ onClose, onDone }: { onClose: () => void; onDone: (items: Listing[]) => void }) {
  const [text, setText] = useState('')
  const [shots, setShots] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const input = useRef<HTMLInputElement>(null)

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
