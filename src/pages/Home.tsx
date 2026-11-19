import { useState } from 'react'
import { Field, Icon, Sheet, useData, type Intent, type Tab } from '../components/ui'
import { SEOUL_GU } from '../data/sample'
import { upcoming } from '../lib/match'
import { dday, koDate, today, toast, won } from '../lib/util'

export default function Home({ go }: { go: (t: Tab, i?: Intent) => void }) {
  const { settings, setSettings, consults, contracts } = useData()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(settings)
  const newConsults = consults.filter((c) => c.status === '신규').length
  const active = contracts.filter((c) => c.status === '진행중').length
  const events = upcoming(contracts)
  const soon = events.filter((e) => e.left <= 7).length

  const actions: { label: string; sub: string; icon: string; tab: Tab; intent?: Intent }[] = [
    { label: '카드뉴스 만들기', sub: '오늘의 브리핑', icon: 'briefing', tab: 'briefing', intent: 'cards' },
    { label: '상담 접수', sub: '손님 신청서 작성', icon: 'consult', tab: 'consult', intent: 'newConsult' },
    { label: '매물 추천·PPT', sub: '손님 선택 후 추천', icon: 'listings', tab: 'consult' },
    { label: '계약 등록', sub: '계약서 촬영·보관', icon: 'contracts', tab: 'contracts', intent: 'newContract' },
  ]

  return (
    <>
      <header className="home-hero">
        <div>
          <p>{koDate(today())}</p>
          <h1>{settings.office}</h1>
          <span>{settings.region}</span>
        </div>
        <button
          className="icon-btn light"
          aria-label="사무소 설정"
          onClick={() => {
            setDraft(settings)
            setEditing(true)
          }}
        >
          <Icon name="gear" />
        </button>
      </header>

      <section className="stat-row">
        <button onClick={() => go('consult')}>
          <b>{newConsults}</b>
          <span>신규 상담</span>
        </button>
        <button onClick={() => go('contracts')}>
          <b>{active}</b>
          <span>진행중 계약</span>
        </button>
        <button onClick={() => go('contracts')}>
          <b className={soon ? 'warn' : ''}>{soon}</b>
          <span>7일 내 일정</span>
        </button>
      </section>

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
        {events.length === 0 && <p className="empty">예정된 일정이 없습니다.</p>}
        <ul className="list">
          {events.slice(0, 4).map((e, i) => (
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

      <section className="block">
        <h2>추가 예정 기능</h2>
        <p className="hint">새 기능은 이 화면의 바로가기에 계속 추가됩니다.</p>
      </section>

      {editing && (
        <Sheet
          title="사무소 설정"
          onClose={() => setEditing(false)}
          footer={
            <button
              className="btn block-btn"
              onClick={() => {
                setSettings({ ...draft, office: draft.office.trim() || settings.office, region: draft.region.trim() || settings.region, lawdCd: draft.lawdCd.trim(), dong: draft.dong.trim() })
                setEditing(false)
                toast('저장했습니다')
              }}
            >
              저장
            </button>
          }
        >
          <Field label="사무소 이름">
            <input value={draft.office} onChange={(e) => setDraft({ ...draft, office: e.target.value })} />
          </Field>
          <Field label="담당 지역 이름 (카드뉴스·PPT 에 표시)">
            <input value={draft.region} onChange={(e) => setDraft({ ...draft, region: e.target.value })} />
          </Field>
          <h3 className="sub-h">실거래 조회 지역</h3>
          <Field label="서울은 구 선택 (그 외 지역은 아래에 코드 입력)">
            <select value={SEOUL_GU.some(([, c]) => c === draft.lawdCd) ? draft.lawdCd : ''} onChange={(e) => e.target.value && setDraft({ ...draft, lawdCd: e.target.value })}>
              <option value="">직접 입력</option>
              {SEOUL_GU.map(([n, c]) => (
                <option key={c} value={c}>
                  {n}
                </option>
              ))}
            </select>
          </Field>
          <div className="row">
            <Field label="시군구 코드 (5자리)">
              <input inputMode="numeric" maxLength={5} value={draft.lawdCd} onChange={(e) => setDraft({ ...draft, lawdCd: e.target.value })} />
            </Field>
            <Field label="동 이름 (비우면 전체)">
              <input value={draft.dong} onChange={(e) => setDraft({ ...draft, dong: e.target.value })} placeholder="예: 아현동" />
            </Field>
          </div>
          <p className="hint">시군구 코드는 법정동코드 앞 5자리입니다. (예: 마포구 11440)</p>
          <Field label="서버 접속 암호 (설정한 경우만)">
            <input type="password" autoComplete="off" value={draft.passcode} onChange={(e) => setDraft({ ...draft, passcode: e.target.value })} />
          </Field>
        </Sheet>
      )}
    </>
  )
}
