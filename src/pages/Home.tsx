// 홈: 오늘 챙길 것 (새 문의, 진행 중인 일, 다가오는 일정)
import { useEffect, useState } from 'react'
import { Icon, useData, type Intent, type Tab } from '../components/ui'
import { api } from '../lib/api'
import { upcoming } from '../lib/match'
import { dday, koDate, today, won } from '../lib/util'
import type { InboxData } from './Inbox'

export default function Home({ go }: { go: (t: Tab, i?: Intent) => void }) {
  const { settings, consults, contracts, properties } = useData()
  const [inbox, setInbox] = useState<InboxData | null>(null)
  useEffect(() => {
    api<InboxData>('office?a=inbox').then(setInbox).catch(() => {})
  }, [])

  const newConsults = consults.filter((c) => c.status === '신규').length
  const activeProps = properties.filter((p) => p.status === '접수' || p.status === '광고중' || p.status === '계약중').length
  const activeContracts = contracts.filter((c) => c.status === '진행중').length
  const events = upcoming(contracts)
  const unread = inbox?.customers.reduce((s, c) => s + (c.unreadOffice || 0), 0) ?? 0
  const adopted = new Set(properties.map((p) => p.intakeId))
  const intakes = inbox?.intakes.filter((i) => i.status === '접수' && !adopted.has(i.id)).length ?? 0

  const actions: { label: string; sub: string; icon: string; tab: Tab; intent?: Intent }[] = [
    { label: '손님 상담 접수', sub: '상담 신청서 작성', icon: 'consult', tab: 'consult', intent: 'newConsult' },
    { label: '매물 등록', sub: '내 매물에 추가', icon: 'listings', tab: 'listings', intent: 'newProperty' },
    { label: '계약 등록', sub: '일정·계약서 작성', icon: 'contracts', tab: 'contracts', intent: 'newContract' },
    { label: '맞춤 매물 추천', sub: '손님 선택 후 제안서', icon: 'briefing', tab: 'consult' },
  ]

  return (
    <>
      <header className="home-hero">
        <div>
          <p>{koDate(today())}</p>
          <h1>{settings.office}</h1>
          <span>{settings.region}</span>
        </div>
        <button className="icon-btn light" aria-label="사무소 설정" onClick={() => go('more')}>
          <Icon name="gear" />
        </button>
      </header>

      <section className="stat-row">
        <button onClick={() => go('consult')}>
          <b>{newConsults}</b>
          <span>신규 상담</span>
        </button>
        <button onClick={() => go('listings')}>
          <b>{activeProps}</b>
          <span>진행 매물</span>
        </button>
        <button onClick={() => go('contracts')}>
          <b>{activeContracts}</b>
          <span>진행 계약</span>
        </button>
      </section>

      {(unread > 0 || intakes > 0) && (
        <section className="block">
          {unread > 0 && (
            <button className="notice" onClick={() => go('consult', 'chat')}>
              <Icon name="consult" />
              <span>
                <b>읽지 않은 채팅 {unread}건</b>
                <small>손님용 앱에서 온 문의입니다.</small>
              </span>
            </button>
          )}
          {intakes > 0 && (
            <button className="notice" style={{ marginTop: unread ? 8 : 0 }} onClick={() => go('listings', 'intake')}>
              <Icon name="listings" />
              <span>
                <b>새로 접수된 매물 {intakes}건</b>
                <small>확인하고 내 매물로 등록하세요.</small>
              </span>
            </button>
          )}
        </section>
      )}

      <section className="block">
        <h2>바로가기</h2>
        <div className="grid2">
          {actions.map((a) => (
            <button key={a.label} className="action" onClick={() => go(a.tab, a.intent)}>
              <span className="action-ic">
                <Icon name={a.icon} />
              </span>
              <b>{a.label}</b>
              <small>{a.sub}</small>
            </button>
          ))}
        </div>
      </section>

      <section className="block">
        <div className="block-head">
          <h2>다가오는 일정</h2>
          <button className="link" onClick={() => go('contracts')}>
            전체 보기
          </button>
        </div>
        {events.length === 0 && <p className="empty">예정된 계약·중도금·잔금 일정이 없습니다.</p>}
        <ul className="list">
          {events.slice(0, 5).map((e, i) => (
            <li key={i} className="card line" onClick={() => go('contracts')}>
              <span className={`dday ${e.left <= 3 ? 'hot' : ''}`}>{dday(e.date)}</span>
              <div className="grow">
                <b>
                  {e.label} · {e.contract.title}
                </b>
                <small>
                  {koDate(e.date)}
                  {e.amount ? ` · ${won(e.amount)}` : ''}
                </small>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </>
  )
}
