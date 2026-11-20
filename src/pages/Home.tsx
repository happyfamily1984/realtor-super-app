import { useState } from 'react'
import { Field, Icon, Sheet, useData, type Intent, type Tab } from '../components/ui'
import RegionPicker from '../components/RegionPicker'
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
          <h3 className="sub-h">담당 지역</h3>
          <RegionPicker lawdCd={draft.lawdCd} dong={draft.dong} onChange={(v) => setDraft((d) => ({ ...d, lawdCd: v.lawdCd, dong: v.dong, region: v.name }))} />
          <Field label="지역 이름 (카드뉴스·제안서에 표시, 고쳐 쓸 수 있음)">
            <input value={draft.region} onChange={(e) => setDraft({ ...draft, region: e.target.value })} />
          </Field>
          <p className="hint">실거래와 뉴스는 여기서 고른 지역 기준으로 가져옵니다. 동을 ‘전체’로 두면 시·군·구 전체를 봅니다.</p>
          <h3 className="sub-h">내 매물 중복 광고 확인</h3>
          <Field label="네이버에 표시되는 우리 사무소 이름 (비우면 위 사무소 이름)">
            <input value={draft.myRealtor} onChange={(e) => setDraft({ ...draft, myRealtor: e.target.value })} />
          </Field>
          <Field label="우리 사무소 네이버 매물번호 (쉼표로 구분, 선택)">
            <textarea rows={2} value={draft.myArticles} onChange={(e) => setDraft({ ...draft, myArticles: e.target.value })} placeholder="2512345678, 2512345679" />
          </Field>
          <Field label="서버 접속 암호 (설정한 경우만)">
            <input type="password" autoComplete="off" value={draft.passcode} onChange={(e) => setDraft({ ...draft, passcode: e.target.value })} />
          </Field>
        </Sheet>
      )}
    </>
  )
}
