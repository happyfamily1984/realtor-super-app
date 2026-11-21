import { useEffect, useState } from 'react'
import ExportSheet, { type ExportContent } from '../components/ExportSheet'
import { Chips, PageHead, SampleBadge, Sheet, useData, type PageProps } from '../components/ui'
import { matchMain } from '../data/main'
import { NEWS, TRADES, type News, type Trade } from '../data/sample'
import { api } from '../lib/api'
import { briefingComment, renderCards, tradeStats } from '../lib/cardnews'
import { downloadDataUrl, shortDate, today, toast, won } from '../lib/util'

interface Insight {
  comment: string
  points: string[]
  news: { title: string; summary: string }[]
}
interface Live {
  key: string
  trades: Trade[] | null // null = 불러오지 못함 (샘플 표시)
  rents: Trade[]
  notes: string[]
  news: News[] | null
  tradeErr: string
  newsErr: string
  insight: Insight | null
}
// 탭을 오갈 때 다시 불러오지 않도록 보관 (지역·날짜가 바뀌면 새로 조회)
let cache: Live | null = null

export default function Briefing({ intent, clearIntent }: PageProps) {
  const { settings } = useData()
  const key = `${settings.lawdCd}|${settings.dong}|${settings.region}|${today()}`
  const [live, setLive] = useState<Live | null>(cache?.key === key ? cache : null)
  const [cards, setCards] = useState<string[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [aiBusy, setAiBusy] = useState(false)
  const [exporting, setExporting] = useState<ExportContent | null>(null)
  const loading = !live

  useEffect(() => {
    if (cache?.key === key) return setLive(cache)
    let alive = true
    setLive(null)
    const q = new URLSearchParams({ lawd: settings.lawdCd, dong: settings.dong, months: '6' })
    Promise.allSettled([
      api<{ trades: Trade[]; rents?: Trade[]; notes?: string[] }>(`trades?${q}`),
      api<{ news: News[] }>(`news?${new URLSearchParams({ q: `${settings.region} 부동산` })}`),
    ]).then(([t, n]) => {
      const msg = (r: PromiseSettledResult<unknown>) => (r.status === 'rejected' ? (r.reason as Error).message : '')
      cache = {
        key,
        trades: t.status === 'fulfilled' ? t.value.trades : null,
        rents: t.status === 'fulfilled' ? (t.value.rents ?? []) : [],
        notes: t.status === 'fulfilled' ? (t.value.notes ?? []) : [],
        news: n.status === 'fulfilled' && n.value.news.length ? n.value.news : null,
        tradeErr: msg(t),
        newsErr: msg(n),
        insight: null,
      }
      if (alive) setLive(cache)
    })
    return () => {
      alive = false
    }
  }, [key])

  const liveTrades = !!live?.trades
  // 보는 범위: 메인 단지만 / 지역 전체
  const main = settings.mainComplexes
  const [scope, setScope] = useState<'메인 단지' | '지역 전체'>('메인 단지')
  const onlyMain = liveTrades && scope === '메인 단지' && main.length > 0
  const toMain = (rows: Trade[]) => rows.flatMap((t) => { const m = matchMain(t.complex, main, t.kind); return m ? [{ ...t, complex: m.name }] : [] })
  const allTrades = live?.trades ?? TRADES
  const trades = onlyMain ? toMain(allTrades) : allTrades
  const rents = onlyMain ? toMain(live?.rents ?? []) : (live?.rents ?? [])
  // 메인 단지별 요약: 최근 매매, 6개월 건수, 최근 전월세
  const mainRows = main.map((m) => {
    const sales = toMain(allTrades).filter((t) => t.complex === m.name)
    const lease = toMain(live?.rents ?? []).filter((t) => t.complex === m.name)
    return { m, n: sales.length, last: sales[0], lease: lease[0], leaseN: lease.length }
  })
  const insight = live?.insight ?? null
  const news = (live?.news ?? NEWS).map((n) => ({ ...n, summary: insight?.news.find((x) => x.title === n.title)?.summary ?? n.summary }))
  // AI 가 고른 뉴스가 있으면 그것을 앞으로
  const picked = insight ? [...news.filter((n) => n.summary), ...news.filter((n) => !n.summary)] : news
  const s = tradeStats(trades)

  const make = async () => {
    setBusy(true)
    try {
      setCards(await renderCards({ region: settings.region, office: settings.office, trades, news: picked, sample: !liveTrades, insight }))
    } finally {
      setBusy(false)
    }
  }
  useEffect(() => {
    if (intent === 'cards' && !loading) {
      clearIntent()
      make()
    }
  }, [intent, loading])

  const analyze = async () => {
    if (!live) return
    setAiBusy(true)
    try {
      const r = await api<Insight>('ai', {
        task: 'briefing',
        region: settings.region,
        stats: { 최근30일건수: s.week.length, 평균가_만원: s.avg, 상승: s.up, 하락: s.down, 실거래_샘플여부: !liveTrades },
        trades: trades.slice(0, 40).map((t) => ({ 단지: t.complex, 전용: t.area, 층: t.floor, 가격_만원: t.price, 직전가_만원: t.prev, 계약일: t.date })),
        news: news.map((n) => ({ title: n.title, source: n.source })),
      })
      cache = { ...live, insight: { comment: String(r.comment ?? ''), points: (r.points ?? []).map(String), news: r.news ?? [] } }
      setLive(cache)
      toast('AI 분석을 마쳤습니다')
    } catch (e) {
      toast((e as Error).message)
    } finally {
      setAiBusy(false)
    }
  }

  const saveAll = () => {
    cards?.forEach((c, i) => setTimeout(() => downloadDataUrl(c, `브리핑_${today()}_${i + 1}.png`), i * 250))
    toast(`이미지 ${cards?.length}장을 저장합니다`)
  }
  const share = async () => {
    if (!cards) return
    try {
      const files = await Promise.all(
        cards.map(async (c, i) => new File([await (await fetch(c)).blob()], `briefing_${i + 1}.png`, { type: 'image/png' })),
      )
      if (navigator.canShare?.({ files })) await navigator.share({ files, title: `${settings.region} 데일리 브리핑` })
      else saveAll()
    } catch {
      /* 공유 취소 */
    }
  }

  return (
    <>
      <PageHead title="데일리 브리핑" sub={`${settings.region} · 실거래와 뉴스 요약`} right={!loading && !liveTrades ? <SampleBadge /> : undefined} />
      {liveTrades && main.length > 0 && (
        <section className="block filters">
          <Chips options={['메인 단지', '지역 전체'] as const} value={scope} onChange={setScope} />
        </section>
      )}

      <section className="block">
        {loading && <p className="hint">실거래와 뉴스를 불러오는 중…</p>}
        {live && !liveTrades && <p className="warn-note">실거래는 샘플입니다 · {live.tradeErr}</p>}
        {live?.notes.map((n) => (
          <p key={n} className="warn-note">{n}</p>
        ))}
        {live && !live.news && <p className="warn-note">뉴스는 샘플입니다{live.newsErr ? ` · ${live.newsErr}` : ''}</p>}
        <div className="kpis">
          <div>
            <small>최근 30일 매매</small>
            <b>{s.week.length}건</b>
          </div>
          <div>
            <small>평균 거래가</small>
            <b>{s.week.length ? won(s.avg) : '-'}</b>
          </div>
          <div>
            <small>상승 / 하락</small>
            <b>
              <i className="up">{s.up}</i> / <i className="down">{s.down}</i>
            </b>
          </div>
        </div>
        <div className="comment">
          {insight && <span className="tag score">AI 분석</span>}
          <p>{insight?.comment || briefingComment(trades)}</p>
          {insight && (
            <ul>
              {insight.points.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          )}
        </div>
        <div className="row">
          <button className="btn ghost" disabled={loading || aiBusy} onClick={analyze}>
            {aiBusy ? '분석 중…' : insight ? 'AI 다시 분석' : 'AI 분석'}
          </button>
          <button className="btn" disabled={loading || busy} onClick={make}>
            {busy ? '만드는 중…' : '카드뉴스 만들기'}
          </button>
        </div>
        <button className="btn ghost block-btn write-btn" onClick={() => setExporting({ title: '', body: '', images: [], kind: '정보' })}>
          새 소식 직접 써서 내보내기
        </button>
      </section>

      {liveTrades && main.length > 0 && (
        <section className="block">
          <h2>메인 단지 현황</h2>
          <ul className="list">
            {mainRows.map(({ m, n, last, lease, leaseN }) => (
              <li key={m.name} className="card">
                <div className="line">
                  <div className="grow">
                    <span className="tag">{m.kind}</span>
                    <b className="title">{m.name}</b>
                  </div>
                  <div className="right">
                    <b className="price">{last ? won(last.price) : '-'}</b>
                    <small>{last ? `${last.area}㎡ ${last.floor}층, ${shortDate(last.date)}` : '최근 6개월 매매 없음'}</small>
                  </div>
                </div>
                <small>
                  매매 {n}건 (6개월){leaseN ? `, 전월세 ${leaseN}건 (3개월)` : ''}
                  {lease ? `, 최근 ${lease.rent ? `월세 ${won(lease.price)}/${lease.rent}만` : `전세 ${won(lease.price)}`} ${lease.area}㎡` : ''}
                </small>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="block">
        <h2>최근 실거래{liveTrades ? ` (${trades.length}건)` : ''}</h2>
        {trades.length === 0 && <p className="empty">{onlyMain ? '메인 단지에 최근 6개월간 신고된 매매 실거래가 없습니다.' : '최근 6개월간 신고된 매매 실거래가 없습니다. 홈 > 설정에서 지역을 확인해 주세요.'}</p>}
        <ul className="list">
          {trades.slice(0, 30).map((t) => {
            const d = t.prev ? t.price - t.prev : 0
            return (
              <li key={t.id} className="card line">
                <div className="grow">
                  <b>{t.complex}</b>
                  <small>
                    전용 {t.area}㎡ · {t.floor}층 · {shortDate(t.date)}
                  </small>
                </div>
                <div className="right">
                  <b>{won(t.price)}</b>
                  <small className={d > 0 ? 'up' : d < 0 ? 'down' : ''}>{!t.prev ? '직전 거래 없음' : d === 0 ? '보합' : `${d > 0 ? '▲' : '▼'} ${won(Math.abs(d))}`}</small>
                </div>
              </li>
            )
          })}
        </ul>
      </section>

      {rents.length > 0 && (
        <section className="block">
          <h2>최근 전월세 ({rents.length}건)</h2>
          <ul className="list">
            {rents.slice(0, 15).map((t) => (
              <li key={t.id} className="card line">
                <div className="grow">
                  <b>{t.complex}</b>
                  <small>
                    전용 {t.area}㎡ · {t.floor}층 · {shortDate(t.date)}
                  </small>
                </div>
                <div className="right">
                  <b>{t.rent ? `${won(t.price)} / ${t.rent}만` : won(t.price)}</b>
                  <small>{t.rent ? '월세' : '전세'}</small>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="block">
        <h2>부동산 뉴스</h2>
        <ul className="list">
          {picked.map((n) => (
            <li key={n.id} className="card">
              {n.link ? (
                <a className="news-link" href={n.link} target="_blank" rel="noreferrer">
                  {n.title}
                </a>
              ) : (
                <b>{n.title}</b>
              )}
              {n.summary && <p className="news-sum">{n.summary}</p>}
              <small>
                {n.source} · {shortDate(n.date)}
              </small>
            </li>
          ))}
        </ul>
      </section>

      {exporting && !cards && <ExportSheet initial={exporting} onClose={() => setExporting(null)} />}
      {cards && (
        <Sheet
          title="카드뉴스 미리보기"
          onClose={() => setCards(null)}
          footer={
            <div className="row">
              <button className="btn ghost" onClick={saveAll}>
                전체 저장
              </button>
              <button
                className="btn"
                onClick={() =>
                  setExporting({
                    title: `${settings.region} 부동산 데일리 브리핑 (${today().slice(5).replace('-', '.')})`,
                    body: `${insight?.comment || briefingComment(trades)}${insight ? `\n\n${insight.points.map((p) => `· ${p}`).join('\n')}` : ''}\n\n${settings.office}`,
                    images: cards,
                    kind: '카드뉴스',
                  })
                }
              >
                내보내기
              </button>
            </div>
          }
        >
          <p className="hint">
            옆으로 넘겨 {cards.length}장을 확인하세요. 오픈톡방에 바로 올릴 수 있는 1080×1350 이미지입니다.
            {!insight && ' ‘AI 분석’을 먼저 하면 분석 카드가 추가됩니다.'}
          </p>
          <div className="card-strip">
            {cards.map((c, i) => (
              <img key={i} src={c} alt={`카드뉴스 ${i + 1}번`} onClick={() => downloadDataUrl(c, `브리핑_${today()}_${i + 1}.png`)} />
            ))}
          </div>
          {exporting && <ExportSheet initial={exporting} onClose={() => setExporting(null)} />}
        </Sheet>
      )}
    </>
  )
}
