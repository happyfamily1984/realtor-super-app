import { useState } from 'react'
import { Chips, Field, Icon, Sheet, useData, type Intent, type Tab } from '../components/ui'
import RegionPicker from '../components/RegionPicker'
import { matchMain } from '../data/main'
import { api } from '../lib/api'
import { upcoming } from '../lib/match'
import { dday, koDate, today, toast, won } from '../lib/util'

export default function Home({ go }: { go: (t: Tab, i?: Intent) => void }) {
  const { settings, setSettings, consults, contracts, listings } = useData()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(settings)
  const [add, setAdd] = useState<{ name: string; alias: string; kind: '아파트' | '오피스텔' }>({ name: '', alias: '', kind: '아파트' })
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
        <div className="block-head">
          <h2>메인 단지</h2>
          <button className="link" onClick={() => go('briefing')}>
            실거래 보기
          </button>
        </div>
        <ul className="list">
          {settings.mainComplexes.map((m) => {
            const n = listings.filter((l) => l.src && !l.gone && matchMain(l.group ?? l.complex, [m])).length
            return (
              <li key={m.name} className="card line" onClick={() => go('listings')}>
                <div className="grow">
                  <b>{m.name}</b>
                  <small>{m.kind}</small>
                </div>
                <small>수집 매물 {n}건</small>
              </li>
            )
          })}
        </ul>
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
                // 손님용 앱에도 사무소 이름과 메인 단지를 알려 준다 (서버가 없으면 조용히 넘어간다)
                api('office', { a: 'profile', office: draft.office.trim() || settings.office, main: draft.mainComplexes }).catch(() => {})
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
          <h3 className="sub-h">메인 단지</h3>
          <p className="hint">브리핑·매물·손님용 앱이 이 단지를 중심으로 보여 줍니다.</p>
          <ul className="list main-edit">
            {draft.mainComplexes.map((m) => (
              <li key={m.name} className="card line">
                <div className="grow">
                  <b>
                    <span className="tag">{m.kind}</span> {m.name}
                  </b>
                  {!!m.aliases?.length && <small>자료상 이름: {m.aliases.join(', ')}</small>}
                </div>
                <button type="button" className="icon-btn" aria-label={`${m.name} 빼기`} onClick={() => setDraft({ ...draft, mainComplexes: draft.mainComplexes.filter((x) => x !== m) })}>
                  <Icon name="close" />
                </button>
              </li>
            ))}
          </ul>
          <div className="row">
            <Field label="단지 이름">
              <input value={add.name} onChange={(e) => setAdd({ ...add, name: e.target.value })} placeholder="예: 한가람삼성" />
            </Field>
            <Field label="자료상 다른 이름 (선택)">
              <input value={add.alias} onChange={(e) => setAdd({ ...add, alias: e.target.value })} placeholder="예: 한가람(삼성)" />
            </Field>
          </div>
          <div className="row add-main">
            <Chips options={['아파트', '오피스텔'] as const} value={add.kind} onChange={(kind) => setAdd({ ...add, kind })} />
            <button
              type="button"
              className="btn ghost small"
              onClick={() => {
                const name = add.name.trim()
                if (!name) return toast('단지 이름을 입력해 주세요')
                if (draft.mainComplexes.some((m) => m.name === name)) return toast('이미 있는 단지입니다')
                setDraft({ ...draft, mainComplexes: [...draft.mainComplexes, { name, kind: add.kind, aliases: add.alias.split(',').map((x) => x.trim()).filter(Boolean) }] })
                setAdd({ name: '', alias: '', kind: add.kind })
              }}
            >
              단지 추가
            </button>
          </div>
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
