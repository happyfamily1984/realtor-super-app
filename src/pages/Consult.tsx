import { useEffect, useMemo, useState } from 'react'
import { Chips, Confirm, Field, Icon, PageHead, Sheet, useData, type PageProps } from '../components/ui'
import { LISTINGS, type Consult, type Deal, type Kind } from '../data/sample'
import { recommend } from '../lib/match'
import { useBackLayer } from '../lib/nav'
import { makeBriefingPpt } from '../lib/ppt'
import { koDate, shortDate, today, toast, uid, won } from '../lib/util'
import { listingPrice } from './Listings'

const DEALS: Deal[] = ['매매', '전세', '월세']
const KINDS: Kind[] = ['아파트', '오피스텔', '빌라', '상가']
const STATUS = ['신규', '상담중', '완료'] as const
const FILTER = ['전체', ...STATUS] as const

const blank = (): Consult => ({ id: '', name: '', phone: '', deal: '매매', kind: '아파트', budget: 0, areaMin: 0, moveIn: '', memo: '', status: '신규', createdAt: today() })

export default function ConsultPage({ intent, clearIntent }: PageProps) {
  const { consults, setConsults } = useData()
  const [filter, setFilter] = useState<(typeof FILTER)[number]>('전체')
  const [form, setForm] = useState<Consult | null>(null)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [recoId, setRecoId] = useState<string | null>(null)
  const [delId, setDelId] = useState<string | null>(null)

  useEffect(() => {
    if (intent === 'newConsult') {
      clearIntent()
      setForm(blank())
    }
  }, [intent])

  const rows = consults.filter((c) => filter === '전체' || c.status === filter)
  const detail = consults.find((c) => c.id === detailId)
  const reco = consults.find((c) => c.id === recoId)

  const save = () => {
    if (!form) return
    if (!form.name.trim() || !form.phone.trim()) return toast('이름과 연락처를 입력해 주세요')
    if (form.id) setConsults((p) => p.map((c) => (c.id === form.id ? form : c)))
    else setConsults((p) => [{ ...form, id: uid() }, ...p])
    setForm(null)
    toast(form.id ? '수정했습니다' : '상담을 접수했습니다')
  }
  const setStatus = (id: string, status: Consult['status']) => setConsults((p) => p.map((c) => (c.id === id ? { ...c, status } : c)))

  return (
    <>
      <PageHead
        title="상담 접수"
        sub="손님 상담 신청과 진행 관리"
        right={
          <button className="btn small" onClick={() => setForm(blank())}>
            <Icon name="plus" size={18} /> 접수
          </button>
        }
      />
      <section className="block filters">
        <Chips options={FILTER} value={filter} onChange={setFilter} />
      </section>
      <section className="block">
        {rows.length === 0 && <p className="empty">상담 내역이 없습니다. 오른쪽 위 ‘접수’로 등록하세요.</p>}
        <ul className="list">
          {rows.map((c) => (
            <li key={c.id} className="card" onClick={() => setDetailId(c.id)}>
              <div className="line">
                <div className="grow">
                  <b className="title">{c.name}</b>
                  <small>
                    {c.deal} · {c.kind} · {won(c.budget)} 이내
                  </small>
                </div>
                <span className={`status s-${c.status}`}>{c.status}</span>
              </div>
              {c.memo && <p className="news-sum">{c.memo}</p>}
              <small>{shortDate(c.createdAt)} 접수</small>
            </li>
          ))}
        </ul>
      </section>

      {detail && (
        <Sheet
          title={`${detail.name}님 상담`}
          onClose={() => setDetailId(null)}
          footer={
            <button className="btn block-btn" onClick={() => setRecoId(detail.id)}>
              맞춤 매물 추천 · PPT 만들기
            </button>
          }
        >
          <Chips options={STATUS} value={detail.status} onChange={(s) => setStatus(detail.id, s)} />
          <dl className="dl">
            <dt>연락처</dt>
            <dd>
              <a href={`tel:${detail.phone}`}>{detail.phone}</a>
            </dd>
            <dt>거래 유형</dt>
            <dd>
              {detail.deal} · {detail.kind}
            </dd>
            <dt>예산</dt>
            <dd>{won(detail.budget)} 이내</dd>
            <dt>희망 면적</dt>
            <dd>전용 {detail.areaMin}㎡ 이상</dd>
            <dt>입주 희망일</dt>
            <dd>{detail.moveIn ? koDate(detail.moveIn) : '협의'}</dd>
            <dt>요청 사항</dt>
            <dd>{detail.memo || '-'}</dd>
          </dl>
          <div className="row">
            <button className="btn ghost" onClick={() => setForm(detail)}>
              수정
            </button>
            <button className="btn ghost danger" onClick={() => setDelId(detail.id)}>
              삭제
            </button>
          </div>
        </Sheet>
      )}

      {reco && <Recommend consult={reco} onClose={() => setRecoId(null)} />}

      {form && (
        <Sheet
          title={form.id ? '상담 수정' : '상담 신청서'}
          onClose={() => setForm(null)}
          footer={
            <button className="btn block-btn" onClick={save}>
              {form.id ? '저장' : '접수하기'}
            </button>
          }
        >
          <Field label="이름">
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="홍길동" />
          </Field>
          <Field label="연락처">
            <input type="tel" inputMode="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="010-0000-0000" />
          </Field>
          <Field label="거래 유형">
            <Chips options={DEALS} value={form.deal} onChange={(deal) => setForm({ ...form, deal })} />
          </Field>
          <Field label="매물 종류">
            <Chips options={KINDS} value={form.kind} onChange={(kind) => setForm({ ...form, kind })} />
          </Field>
          <Field label={`예산 (만원)${form.budget ? ` · ${won(form.budget)}` : ''}`}>
            <input type="number" inputMode="numeric" value={form.budget || ''} onChange={(e) => setForm({ ...form, budget: +e.target.value })} placeholder="예: 150000 = 15억" />
          </Field>
          <Field label="희망 최소 면적 (전용 ㎡)">
            <input type="number" inputMode="numeric" value={form.areaMin || ''} onChange={(e) => setForm({ ...form, areaMin: +e.target.value })} placeholder="예: 59" />
          </Field>
          <Field label="입주 희망일">
            <input type="date" value={form.moveIn} onChange={(e) => setForm({ ...form, moveIn: e.target.value })} />
          </Field>
          <Field label="요청 사항">
            <textarea rows={3} value={form.memo} onChange={(e) => setForm({ ...form, memo: e.target.value })} placeholder="학군, 역세권, 방향 등" />
          </Field>
        </Sheet>
      )}

      {delId && (
        <Confirm
          message="이 상담을 삭제하겠습니까?"
          onNo={() => setDelId(null)}
          onYes={() => {
            setConsults((p) => p.filter((c) => c.id !== delId))
            setDelId(null)
            setDetailId(null)
            toast('삭제했습니다')
          }}
        />
      )}
    </>
  )
}

function Recommend({ consult, onClose }: { consult: Consult; onClose: () => void }) {
  const { settings } = useData()
  const matches = useMemo(() => recommend(consult, LISTINGS), [consult])
  const [picked, setPicked] = useState<Set<string>>(() => new Set(matches.slice(0, 3).map((m) => m.listing.id)))
  const [busy, setBusy] = useState(false)
  // 선택 모드: 뒤로가기를 누르면 창을 닫기 전에 선택부터 해제
  useBackLayer(picked.size > 0, () => setPicked(new Set()))

  const toggle = (id: string) =>
    setPicked((p) => {
      const n = new Set(p)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })
  const ppt = async () => {
    setBusy(true)
    try {
      await makeBriefingPpt(consult, matches.filter((m) => picked.has(m.listing.id)), settings)
      toast('PPT 파일을 저장했습니다')
    } catch {
      toast('PPT 생성에 실패했습니다')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet
      title={`${consult.name}님 맞춤 매물`}
      onClose={onClose}
      footer={
        <button className="btn block-btn" disabled={!picked.size || busy} onClick={ppt}>
          {busy ? '만드는 중…' : picked.size ? `선택한 ${picked.size}건으로 PPT 만들기` : '매물을 선택하세요'}
        </button>
      }
    >
      <p className="hint">
        {consult.deal} · {consult.kind} · {won(consult.budget)} 이내 · {consult.areaMin}㎡ 이상 조건으로 추천했습니다.
      </p>
      {matches.length === 0 && <p className="empty">조건에 맞는 매물이 없습니다.</p>}
      <ul className="list">
        {matches.map((m) => {
          const on = picked.has(m.listing.id)
          return (
            <li key={m.listing.id} className={on ? 'card pick on' : 'card pick'} onClick={() => toggle(m.listing.id)} role="checkbox" aria-checked={on}>
              <span className="check">{on ? '✓' : ''}</span>
              <div className="grow">
                <div className="line">
                  <b className="title grow">{m.listing.complex}</b>
                  <b className="price">{listingPrice(m.listing)}</b>
                </div>
                <small>
                  {m.listing.kind} · 전용 {m.listing.area}㎡ · {m.listing.floor} · {m.listing.dir}
                </small>
                <div className="reasons">
                  <span className="tag score">적합도 {m.score}</span>
                  {m.reasons.map((r) => (
                    <span key={r} className="tag">
                      {r}
                    </span>
                  ))}
                </div>
              </div>
            </li>
          )
        })}
      </ul>
    </Sheet>
  )
}
