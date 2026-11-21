// 메인 단지 상세·경매 물건 화면 (수집기 자료 my.json 을 보여 준다)
import { useState } from 'react'
import { itemPrice, TYPE_LABEL, wonOf, type ItemType, type MyAuction, type MyComplex, type MyData, type MyPost } from '../lib/mydata'
import { dday, koDate, shortDate, won } from '../lib/util'
import ExportSheet, { type ExportContent } from './ExportSheet'
import { Chips, Sheet } from './ui'

/** 수집기가 미리 써 둔 글 → 내보내기 내용 */
export const postToExport = (p: MyPost, kind: string): ExportContent => ({
  title: p.title,
  body: p.talk,
  images: [],
  kind,
  texts: { talk: p.talk, thread: p.thread, blog: `${p.blog.title}\n\n${p.blog.body}\n\n${p.blog.tags.map((t) => `#${t}`).join(' ')}` },
  cards: p.cards,
})

const pct = (v?: number) => (v === undefined || v === null ? '-' : `${v > 0 ? '+' : ''}${v}%`)
const tone = (v?: number) => (v === undefined || v === 0 ? '' : v > 0 ? 'up' : 'down')

export function ComplexSheet({ complex: c, data, onClose }: { complex: MyComplex; data: MyData; onClose: () => void }) {
  const [type, setType] = useState<'매매' | '전세' | '월세'>('매매')
  const [exporting, setExporting] = useState<ExportContent | null>(null)
  const [auction, setAuction] = useState<MyAuction | null>(null)
  const L = c.listings
  const items = (L?.items ?? []).filter((i) => TYPE_LABEL[i.type] === type).sort((a, b) => a.area - b.area || a.price - b.price)
  const auctions = data.auctions.filter((a) => a.complexId === c.id && !a.gone)
  const typeCount = (t: ItemType) => (L?.items ?? []).filter((i) => i.type === t).length

  return (
    <Sheet
      title={c.name}
      onClose={onClose}
      footer={
        c.post ? (
          <button className="btn block-btn" onClick={() => setExporting(postToExport(c.post!, '단지 분석'))}>
            이 단지 분석 글 내보내기
          </button>
        ) : undefined
      }
    >
      <p className="hint">
        {c.kind === 'offi' ? '오피스텔' : '아파트'} · {c.umdNm} {c.jibun}
        {c.buildYear ? ` · ${c.buildYear}년 준공` : ''}
        {c.aptNm && c.aptNm !== c.name ? ` · 국토부 이름 ${c.aptNm}` : ''}
      </p>

      {c.insights.length > 0 && (
        <div className="ai-box">
          <ul>
            {c.insights.slice(0, 7).map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </div>
      )}
      {!c.hasData && <p className="warn-note">이 단지는 아직 실거래 분석이 없습니다.</p>}

      {c.areas.length > 0 && (
        <>
          <h3 className="sub-h">면적별 실거래 (최근 1년)</h3>
          <div className="card rtable t5">
            <div className="rrow head">
              <span>전용</span>
              <span>매매 중간</span>
              <span>1년 전 대비</span>
              <span>전세 중간</span>
              <span>전세가율</span>
            </div>
            {c.areas.map((a) => (
              <div key={a.area} className="rrow">
                <span>{a.area}㎡</span>
                <span>{a.trade?.count12 ? `${won(a.trade.median12)} (${a.trade.count12})` : '-'}</span>
                <span className={tone(a.trade?.changePct)}>{pct(a.trade?.changePct)}</span>
                <span>{a.jeonse?.count12 ? won(a.jeonse.median12) : '-'}</span>
                <span>{a.jeonseRate ? `${a.jeonseRate}%` : '-'}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {L && (
        <>
          <h3 className="sub-h">호가와 실거래 비교</h3>
          <p className="hint">
            네이버 매물 {L.total}건, {shortDate(L.capturedAt)} 기준{L.stale ? ' (7일 넘은 자료)' : ''}
            {L.suspects ? `, 중복 의심 ${L.suspects}건 포함` : ''}
          </p>
          <div className="card rtable t4">
            <div className="rrow head">
              <span>구분</span>
              <span>호가 중간 (건)</span>
              <span>실거래 중간</span>
              <span>차이</span>
            </div>
            {L.rows.map((r) => (
              <div key={r.type + r.area} className="rrow">
                <span>
                  {TYPE_LABEL[r.type]} {r.area}㎡
                </span>
                <span>
                  {r.type === 'monthly' ? `${won(r.median)}/${r.medianRent}만` : won(r.median)} ({r.count})
                </span>
                <span>{r.dealMedian ? won(r.dealMedian) : '-'}</span>
                <span className={tone(r.gapPct)}>{pct(r.gapPct)}</span>
              </div>
            ))}
          </div>
          <p className="hint">실거래 중간은 최근 3개월 거래가 3건 이상이면 그 값, 아니면 최근 1년 값입니다. {[...new Set(L.rows.map((r) => r.dealBasis).filter(Boolean))].length === 1 ? `(지금은 모두 ${L.rows.find((r) => r.dealBasis)?.dealBasis} 기준)` : ''}</p>

          <h3 className="sub-h">매물</h3>
          <Chips options={(['매매', '전세', '월세'] as const).filter((t) => typeCount(t === '매매' ? 'trade' : t === '전세' ? 'jeonse' : 'monthly') > 0 || t === type)} value={type} onChange={setType} />
          {items.length === 0 && <p className="empty">{type} 매물이 없습니다.</p>}
          <ul className="list">
            {items.slice(0, 60).map((i, n) => (
              <li key={n} className="card">
                <div className="line">
                  <div className="grow">
                    <b>
                      전용 {i.area}㎡ {i.dong}
                    </b>
                    <small>
                      {[i.floor && `${i.floor}층`, i.direction, i.confirmedAt && `${shortDate(i.confirmedAt)} 확인`].filter(Boolean).join(' · ')}
                    </small>
                  </div>
                  <div className="right">
                    <b className="price">{itemPrice(i)}</b>
                    {i.suspect && <small className="up">중복 의심</small>}
                  </div>
                </div>
                {i.memo && <p className="news-sum">{i.memo}</p>}
                {i.articleNo && (
                  <a href={`https://m.land.naver.com/article/info/${i.articleNo}`} target="_blank" rel="noreferrer">
                    네이버에서 보기 (매물번호 {i.articleNo})
                  </a>
                )}
              </li>
            ))}
          </ul>
          {items.length > 60 && <p className="hint">가격이 낮은 순으로 60건까지 보여 줍니다. (전체 {items.length}건)</p>}
        </>
      )}

      {auctions.length > 0 && (
        <>
          <h3 className="sub-h">진행 중인 경매</h3>
          <ul className="list">
            {auctions.map((a) => (
              <AuctionRow key={a.id} a={a} onOpen={() => setAuction(a)} />
            ))}
          </ul>
        </>
      )}

      {c.recentTrades.length > 0 && (
        <>
          <h3 className="sub-h">최근 매매</h3>
          <ul className="list">
            {c.recentTrades.slice(0, 8).map((t, n) => (
              <li key={n} className="card line">
                <div className="grow">
                  <b>
                    전용 {Math.round(t.area)}㎡ {t.floor}층
                  </b>
                  <small>{shortDate(t.date)} 계약</small>
                </div>
                <div className="right">
                  <b className="price">{won(t.price)}</b>
                  {t.canceled && <small className="up">계약 취소</small>}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      {auction && <AuctionSheet auction={auction} onClose={() => setAuction(null)} />}
      {exporting && <ExportSheet initial={exporting} onClose={() => setExporting(null)} />}
    </Sheet>
  )
}

export function AuctionRow({ a, onOpen }: { a: MyAuction; onOpen: () => void }) {
  return (
    <li className="card line" onClick={onOpen}>
      <span className={`dday ${a.saleDate && dday(a.saleDate).length <= 4 ? 'hot' : ''}`}>{a.saleDate ? dday(a.saleDate) : '-'}</span>
      <div className="grow">
        <b>
          {a.complexName} {a.unit}
        </b>
        <small>
          전용 {a.area}㎡ · 최저 {wonOf(a.minPrice)} (감정가의 {a.minRate}%){a.failCount ? ` · 유찰 ${a.failCount}회` : ''}
        </small>
      </div>
    </li>
  )
}

export function AuctionSheet({ auction: a, onClose }: { auction: MyAuction; onClose: () => void }) {
  const [exporting, setExporting] = useState<ExportContent | null>(null)
  const rows: [string, string][] = [
    ['사건번호', `${a.caseNo} (${a.caseName})`],
    ['법원', `${a.court} ${a.dept}`],
    ['소재지', a.address],
    ['전용면적', `${a.area}㎡ · ${a.usage}`],
    ['감정가', wonOf(a.appraisal)],
    ['최저가', `${wonOf(a.minPrice)} (${a.minRate}%)${a.failCount ? `, 유찰 ${a.failCount}회` : ''}`],
    ['매각기일', a.saleDate ? `${koDate(a.saleDate)} ${a.saleTime} · ${a.place}` : '-'],
    ['매각결정기일', a.decisionDate ? koDate(a.decisionDate) : '-'],
    ['청구금액', a.claim ? wonOf(a.claim) : '-'],
    ['최선순위 설정', a.topPriority || '-'],
    ['대지권', a.landShare || '-'],
    ['문의', a.tel || '-'],
  ]
  return (
    <Sheet
      title={`${a.complexName} ${a.unit}`}
      onClose={onClose}
      footer={
        a.post ? (
          <button className="btn block-btn" onClick={() => setExporting(postToExport(a.post!, '경매'))}>
            이 경매 물건 글 내보내기
          </button>
        ) : undefined
      }
    >
      <dl className="dl">
        {rows.map(([k, v]) => (
          <div key={k} style={{ display: 'contents' }}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
      {(a.rights || a.specRemark || a.remark) && (
        <div className="warn-note">
          <b>매수인이 인수하는 권리·비고</b>
          <p>{[a.rights, a.specRemark, a.remark].filter(Boolean).join(' / ')}</p>
        </div>
      )}
      {a.appraisalNotes.length > 0 && (
        <>
          <h3 className="sub-h">감정평가서 요점</h3>
          <ul className="notes">
            {a.appraisalNotes.slice(0, 5).map((n) => (
              <li key={n}>{n.length > 220 ? `${n.slice(0, 220)}…` : n}</li>
            ))}
          </ul>
        </>
      )}
      <p className="hint">자료: 법원경매정보. 입찰 전에 매각물건명세서와 현황조사서를 직접 확인하세요.</p>
      {exporting && <ExportSheet initial={exporting} onClose={() => setExporting(null)} />}
    </Sheet>
  )
}
