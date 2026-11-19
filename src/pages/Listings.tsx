import { useMemo, useState } from 'react'
import { Chips, PageHead, SampleBadge } from '../components/ui'
import { LISTINGS, type Listing } from '../data/sample'
import { shortDate, won } from '../lib/util'

const DEALS = ['전체', '매매', '전세', '월세'] as const
const KINDS = ['전체', '아파트', '오피스텔', '빌라', '상가'] as const

export const listingPrice = (l: Listing) => (l.deal === '월세' ? `${won(l.price)} / ${l.rent}만` : won(l.price))

export default function Listings() {
  const [deal, setDeal] = useState<(typeof DEALS)[number]>('전체')
  const [kind, setKind] = useState<(typeof KINDS)[number]>('전체')
  const [view, setView] = useState<'목록' | '차트'>('목록')

  const rows = useMemo(
    () => LISTINGS.filter((l) => (deal === '전체' || l.deal === deal) && (kind === '전체' || l.kind === kind)),
    [deal, kind],
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
      <PageHead title="지역 매물" sub="네이버 매물 정리·시각화" right={<SampleBadge />} />
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
    </>
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
