import { useState } from 'react'
import { Chips, Field, Icon, Sheet, useData, type Intent, type Tab } from '../components/ui'
import RegionPicker from '../components/RegionPicker'
import { ComplexSheet } from '../components/MainData'
import { useMyData } from '../lib/mydata'
import { api } from '../lib/api'
import { upcoming } from '../lib/match'
import { dday, koDate, today, toast, won } from '../lib/util'

export default function Home({ go }: { go: (t: Tab, i?: Intent) => void }) {
  const { settings, setSettings, consults, contracts, listings } = useData()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(settings)
  const { data: my } = useMyData()
  const [openComplex, setOpenComplex] = useState<string | null>(null)
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
            const c = my?.complexes.find((x) => x.id === m.id || x.name === m.name)
            const area = c?.areas.find((a) => a.trade?.count12)
            return (
              <li key={m.name} className="card line" onClick={() => (c ? setOpenComplex(c.id) : go('briefing'))}>
                <div className="grow">
                  <b>{m.name}</b>
                  <small>
                    {m.kind}
                    {c ? ` · 매물 ${c.listings?.total ?? 0}건` : ''}
                    {c?.auctionCount ? ` · 경매 ${c.auctionCount}건` : ''}
                  </small>
                </div>
                {area?.trade && (
                  <div className="right">
                    <b>{won(area.trade.median12)}</b>
                    <small className={area.trade.changePct ? (area.trade.changePct > 0 ? 'up' : 'down') : ''}>
                      {area.area}㎡ {area.trade.changePct !== undefined ? `${area.trade.changePct > 0 ? '+' : ''}${area.trade.changePct}%` : ''}
                    </small>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      </section>

      {my && openComplex && my.complexes.find((c) => c.id === openComplex) && <ComplexSheet complex={my.complexes.find((c) => c.id === openComplex)!} data={my} onClose={() => setOpenComplex(null)} />}
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
                // 손님용 앱에도 사무소 이름을 알려 준다 (서버가 없으면 조용히 넘어간다)
                api('office', { a: 'profile', office: draft.office.trim() || settings.office, main: settings.mainComplexes }).catch(() => {})
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
          <p className="hint">브리핑·매물·손님용 앱이 이 단지를 중심으로 보여 줍니다. 목록은 수집기와 함께 쓰는 설정 파일(저장소 main 브랜치의 config/main-complexes.json)에서 받아 오며, 단지를 바꾸려면 그 파일을 고칩니다.</p>
          <ul className="list main-edit">
            {settings.mainComplexes.map((m) => (
              <li key={m.name} className="card">
                <b>
                  <span className="tag">{m.kind}</span> {m.name}
                </b>
                {!!m.aliases?.length && <small style={{ display: 'block' }}>자료상 이름: {m.aliases.join(', ')}</small>}
              </li>
            ))}
          </ul>
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
