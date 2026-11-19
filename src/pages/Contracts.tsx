import { useEffect, useRef, useState } from 'react'
import { Chips, Confirm, Field, Icon, PageHead, Sheet, useData, type PageProps } from '../components/ui'
import type { Contract, Deal } from '../data/sample'
import { upcoming, type Schedule } from '../lib/match'
import { useBackLayer } from '../lib/nav'
import { dday, koDate, photoDel, photoGet, photoPut, shrinkImage, today, toast, uid, won } from '../lib/util'

const DEALS: Deal[] = ['매매', '전세', '월세']
const VIEWS = ['일정', '진행중', '완료'] as const

const blank = (): Contract => ({ id: '', title: '', deal: '매매', client: '', price: 0, contractDate: today(), midDate: '', midAmount: 0, balanceDate: '', balanceAmount: 0, memo: '', status: '진행중', photos: [] })

/** 앱을 열었을 때 3일 이내 일정을 하루 한 번 알림 */
function notifySoon(events: Schedule[]) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return
  if (localStorage.getItem('notified') === today()) return
  const soon = events.filter((e) => e.left <= 3)
  if (!soon.length) return
  localStorage.setItem('notified', today())
  soon.forEach((e) => new Notification(`${e.label} ${dday(e.date)} · ${e.contract.title}`, { body: `${koDate(e.date)}${e.amount ? ` · ${won(e.amount)}` : ''}` }))
}

export default function Contracts({ intent, clearIntent }: PageProps) {
  const { contracts, setContracts } = useData()
  const [view, setView] = useState<(typeof VIEWS)[number]>('일정')
  const [form, setForm] = useState<Contract | null>(null)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [delId, setDelId] = useState<string | null>(null)
  const [perm, setPerm] = useState(() => ('Notification' in window ? Notification.permission : 'unsupported'))
  const events = upcoming(contracts)
  const detail = contracts.find((c) => c.id === detailId)

  useEffect(() => {
    if (intent === 'newContract') {
      clearIntent()
      setForm(blank())
    }
  }, [intent])
  useEffect(() => notifySoon(events), [perm])

  const askPerm = async () => {
    if (!('Notification' in window)) return toast('이 기기에서는 알림을 지원하지 않습니다')
    const p = await Notification.requestPermission()
    setPerm(p)
    toast(p === 'granted' ? '알림을 켰습니다' : '알림 권한이 거부되었습니다')
  }

  const save = () => {
    if (!form) return
    if (!form.title.trim()) return toast('물건(주소)을 입력해 주세요')
    if (!form.balanceDate) return toast('잔금일을 입력해 주세요')
    if (form.id) setContracts((p) => p.map((c) => (c.id === form.id ? form : c)))
    else setContracts((p) => [{ ...form, id: uid() }, ...p])
    setForm(null)
    toast('저장했습니다')
  }
  const patch = (id: string, v: Partial<Contract>) => setContracts((p) => p.map((c) => (c.id === id ? { ...c, ...v } : c)))

  const addPhotos = async (c: Contract, files: FileList | null) => {
    if (!files?.length) return
    const ids: string[] = []
    for (const f of Array.from(files)) {
      const id = uid()
      await photoPut(id, await shrinkImage(f))
      ids.push(id)
    }
    patch(c.id, { photos: [...c.photos, ...ids] })
    toast(`계약서 사진 ${ids.length}장을 보관했습니다`)
  }

  const list = contracts.filter((c) => c.status === view)

  return (
    <>
      <PageHead
        title="계약 관리"
        sub="진행 상황 · 중도금 · 잔금 일정"
        right={
          <button className="btn small" onClick={() => setForm(blank())}>
            <Icon name="plus" size={18} /> 등록
          </button>
        }
      />
      {perm !== 'granted' && (
        <section className="block">
          <button className="notice" onClick={askPerm}>
            <Icon name="bell" />
            <span>
              <b>일정 알림 켜기</b>
              <small>계약·중도금·잔금 3일 전부터 앱을 열 때 알려드립니다.</small>
            </span>
          </button>
        </section>
      )}
      <section className="block filters">
        <div className="seg">
          {VIEWS.map((v) => (
            <button key={v} className={v === view ? 'on' : ''} onClick={() => setView(v)}>
              {v}
              {v === '일정' ? ` ${events.length}` : ` ${contracts.filter((c) => c.status === v).length}`}
            </button>
          ))}
        </div>
      </section>

      {view === '일정' ? (
        <section className="block">
          {events.length === 0 && <p className="empty">예정된 일정이 없습니다.</p>}
          <ul className="list">
            {events.map((e, i) => (
              <li key={i} className="card line" onClick={() => setDetailId(e.contract.id)}>
                <span className={`dday ${e.left <= 3 ? 'hot' : ''}`}>{dday(e.date)}</span>
                <div className="grow">
                  <b>
                    <span className={`tag ev-${e.label}`}>{e.label}</span> {e.contract.title}
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
      ) : (
        <section className="block">
          {list.length === 0 && <p className="empty">{view} 계약이 없습니다.</p>}
          <ul className="list">
            {list.map((c) => (
              <li key={c.id} className="card" onClick={() => setDetailId(c.id)}>
                <div className="line">
                  <div className="grow">
                    <span className={`tag deal-${c.deal}`}>{c.deal}</span>
                    <b className="title">{c.title}</b>
                  </div>
                  <b className="price">{won(c.price)}</b>
                </div>
                <small>{c.client}</small>
                <Steps c={c} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {detail && (
        <Sheet title={detail.title} onClose={() => setDetailId(null)}>
          <Chips options={['진행중', '완료'] as const} value={detail.status} onChange={(status) => patch(detail.id, { status })} />
          <Steps c={detail} />
          <dl className="dl">
            <dt>거래</dt>
            <dd>
              {detail.deal} · {won(detail.price)}
            </dd>
            <dt>당사자</dt>
            <dd>{detail.client || '-'}</dd>
            <dt>계약일</dt>
            <dd>{koDate(detail.contractDate)}</dd>
            {detail.midDate && (
              <>
                <dt>중도금</dt>
                <dd>
                  {koDate(detail.midDate)} · {won(detail.midAmount)}
                </dd>
              </>
            )}
            <dt>잔금</dt>
            <dd>
              {koDate(detail.balanceDate)}
              {detail.balanceAmount ? ` · ${won(detail.balanceAmount)}` : ''}
            </dd>
            <dt>메모</dt>
            <dd>{detail.memo || '-'}</dd>
          </dl>

          <h3 className="sub-h">계약서 사진</h3>
          <Photos
            contract={detail}
            onAdd={(f) => addPhotos(detail, f)}
            onRemove={(id) => {
              photoDel(id)
              patch(detail.id, { photos: detail.photos.filter((p) => p !== id) })
            }}
          />
          <button className="btn ghost block-btn" onClick={() => toast('AI 계약서 분석은 서버 연동 후 사용할 수 있습니다')}>
            AI 로 계약 내용 정리 <span className="badge">연동 예정</span>
          </button>

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

      {form && (
        <Sheet
          title={form.id ? '계약 수정' : '계약 등록'}
          onClose={() => setForm(null)}
          footer={
            <button className="btn block-btn" onClick={save}>
              저장
            </button>
          }
        >
          <Field label="물건 (주소·동호수)">
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="예: OO아파트 101동 1001호" />
          </Field>
          <Field label="거래 유형">
            <Chips options={DEALS} value={form.deal} onChange={(deal) => setForm({ ...form, deal })} />
          </Field>
          <Field label="당사자">
            <input value={form.client} onChange={(e) => setForm({ ...form, client: e.target.value })} placeholder="매수 홍길동 / 매도 김철수" />
          </Field>
          <Field label={`거래 금액 (만원)${form.price ? ` · ${won(form.price)}` : ''}`}>
            <input type="number" inputMode="numeric" value={form.price || ''} onChange={(e) => setForm({ ...form, price: +e.target.value })} />
          </Field>
          <Field label="계약일 (예정일 포함)">
            <input type="date" value={form.contractDate} onChange={(e) => setForm({ ...form, contractDate: e.target.value })} />
          </Field>
          <div className="row">
            <Field label="중도금 지급일">
              <input type="date" value={form.midDate} onChange={(e) => setForm({ ...form, midDate: e.target.value })} />
            </Field>
            <Field label="중도금 (만원)">
              <input type="number" inputMode="numeric" value={form.midAmount || ''} onChange={(e) => setForm({ ...form, midAmount: +e.target.value })} />
            </Field>
          </div>
          <div className="row">
            <Field label="잔금 지급일">
              <input type="date" value={form.balanceDate} onChange={(e) => setForm({ ...form, balanceDate: e.target.value })} />
            </Field>
            <Field label="잔금 (만원)">
              <input type="number" inputMode="numeric" value={form.balanceAmount || ''} onChange={(e) => setForm({ ...form, balanceAmount: +e.target.value })} />
            </Field>
          </div>
          <Field label="메모">
            <textarea rows={3} value={form.memo} onChange={(e) => setForm({ ...form, memo: e.target.value })} />
          </Field>
          {!form.id && <p className="hint">계약서 사진은 저장 후 상세 화면에서 촬영·첨부할 수 있습니다.</p>}
        </Sheet>
      )}

      {delId && (
        <Confirm
          message="이 계약을 삭제하겠습니까? 보관한 계약서 사진도 함께 삭제됩니다."
          onNo={() => setDelId(null)}
          onYes={() => {
            contracts.find((c) => c.id === delId)?.photos.forEach((p) => photoDel(p))
            setContracts((p) => p.filter((c) => c.id !== delId))
            setDelId(null)
            setDetailId(null)
            toast('삭제했습니다')
          }}
        />
      )}
    </>
  )
}

/** 계약 → 중도금 → 잔금 진행 단계 */
function Steps({ c }: { c: Contract }) {
  const steps = [
    { label: '계약', date: c.contractDate },
    ...(c.midDate ? [{ label: '중도금', date: c.midDate }] : []),
    { label: '잔금', date: c.balanceDate },
  ]
  return (
    <ol className="steps">
      {steps.map((s) => {
        const done = c.status === '완료' || (!!s.date && s.date < today())
        return (
          <li key={s.label} className={done ? 'done' : ''}>
            <i />
            <b>{s.label}</b>
            <small>{s.date ? (done ? s.date.slice(5).replace('-', '.') : dday(s.date)) : '-'}</small>
          </li>
        )
      })}
    </ol>
  )
}

function Photos({ contract, onAdd, onRemove }: { contract: Contract; onAdd: (f: FileList | null) => void; onRemove: (id: string) => void }) {
  const [urls, setUrls] = useState<Record<string, string>>({})
  const [open, setOpen] = useState<string | null>(null)
  const input = useRef<HTMLInputElement>(null)
  useBackLayer(!!open, () => setOpen(null))

  useEffect(() => {
    let alive = true
    Promise.all(contract.photos.map(async (id) => [id, (await photoGet(id)) ?? ''] as const)).then((e) => alive && setUrls(Object.fromEntries(e)))
    return () => {
      alive = false
    }
  }, [contract.photos])

  return (
    <>
      <div className="photos">
        {contract.photos.map((id) => (
          <button key={id} className="photo" onClick={() => setOpen(id)} aria-label="계약서 사진 보기">
            {urls[id] && <img src={urls[id]} alt="계약서" />}
          </button>
        ))}
        <button className="photo add" onClick={() => input.current?.click()}>
          <Icon name="camera" />
          <small>촬영·첨부</small>
        </button>
        <input
          ref={input}
          type="file"
          accept="image/*"
          capture="environment"
          multiple
          hidden
          onChange={(e) => {
            onAdd(e.target.files)
            e.target.value = ''
          }}
        />
      </div>
      {open && (
        <div className="overlay viewer" onClick={() => setOpen(null)}>
          <img src={urls[open]} alt="계약서 원본" />
          <button
            className="btn danger"
            onClick={(e) => {
              e.stopPropagation()
              onRemove(open)
              setOpen(null)
            }}
          >
            이 사진 삭제
          </button>
        </div>
      )}
    </>
  )
}
