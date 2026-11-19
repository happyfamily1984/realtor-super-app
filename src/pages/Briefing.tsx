import { useEffect, useState } from 'react'
import { PageHead, SampleBadge, Sheet, useData, type PageProps } from '../components/ui'
import { NEWS, TRADES } from '../data/sample'
import { briefingComment, renderCards, tradeStats } from '../lib/cardnews'
import { downloadDataUrl, shortDate, today, toast, won } from '../lib/util'

export default function Briefing({ intent, clearIntent }: PageProps) {
  const { settings } = useData()
  const [cards, setCards] = useState<string[] | null>(null)
  const [busy, setBusy] = useState(false)
  const s = tradeStats(TRADES)
  const trades = [...TRADES].sort((a, b) => b.date.localeCompare(a.date))

  const make = async () => {
    setBusy(true)
    try {
      setCards(await renderCards({ region: settings.region, office: settings.office, trades: TRADES, news: NEWS, sample: true }))
    } finally {
      setBusy(false)
    }
  }
  useEffect(() => {
    if (intent === 'cards') {
      clearIntent()
      make()
    }
  }, [intent])

  const saveAll = () => {
    cards?.forEach((c, i) => setTimeout(() => downloadDataUrl(c, `브리핑_${today()}_${i + 1}.png`), i * 250))
    toast('이미지 4장을 저장합니다')
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
      <PageHead title="데일리 브리핑" sub={`${settings.region} · 실거래와 뉴스 요약`} right={<SampleBadge />} />

      <section className="block">
        <div className="kpis">
          <div>
            <small>최근 7일 매매</small>
            <b>{s.week.length}건</b>
          </div>
          <div>
            <small>평균 거래가</small>
            <b>{won(s.avg)}</b>
          </div>
          <div>
            <small>상승 / 하락</small>
            <b>
              <i className="up">{s.up}</i> / <i className="down">{s.down}</i>
            </b>
          </div>
        </div>
        <p className="comment">{briefingComment(TRADES)}</p>
        <button className="btn block-btn" disabled={busy} onClick={make}>
          {busy ? '만드는 중…' : '카드뉴스 만들기'}
        </button>
      </section>

      <section className="block">
        <h2>최근 실거래</h2>
        <ul className="list">
          {trades.map((t) => {
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
                  <small className={d > 0 ? 'up' : d < 0 ? 'down' : ''}>{d === 0 ? '보합' : `${d > 0 ? '▲' : '▼'} ${won(Math.abs(d))}`}</small>
                </div>
              </li>
            )
          })}
        </ul>
      </section>

      <section className="block">
        <h2>부동산 뉴스</h2>
        <ul className="list">
          {NEWS.map((n) => (
            <li key={n.id} className="card">
              <b>{n.title}</b>
              <p className="news-sum">{n.summary}</p>
              <small>
                {n.source} · {shortDate(n.date)}
              </small>
            </li>
          ))}
        </ul>
      </section>

      {cards && (
        <Sheet
          title="카드뉴스 미리보기"
          onClose={() => setCards(null)}
          footer={
            <div className="row">
              <button className="btn ghost" onClick={saveAll}>
                전체 저장
              </button>
              <button className="btn" onClick={share}>
                공유하기
              </button>
            </div>
          }
        >
          <p className="hint">옆으로 넘겨 4장을 확인하세요. 오픈톡방에 바로 올릴 수 있는 1080×1350 이미지입니다.</p>
          <div className="card-strip">
            {cards.map((c, i) => (
              <img key={i} src={c} alt={`카드뉴스 ${i + 1}번`} onClick={() => downloadDataUrl(c, `브리핑_${today()}_${i + 1}.png`)} />
            ))}
          </div>
        </Sheet>
      )}
    </>
  )
}
