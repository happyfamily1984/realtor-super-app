// 매물 탭: 내 매물(매물장) · 손님 접수 매물 · 네이버 수집 매물
import { useEffect, useMemo, useState } from 'react'
import IntakeForm from '../components/IntakeForm'
import { Chips, Confirm, Field, Icon, PageHead, Sheet, useData, type Intent, type PageProps, type Tab } from '../components/ui'
import type { Intake } from '../data/intake'
import { asIntake, blankProperty, fromIntake, PROPERTY_STATUS, propertyTitle, type Property, type PropertyStatus } from '../data/property'
import { api } from '../lib/api'
import { toNaverDraft } from '../lib/naverUpload'
import { toast, uid, won } from '../lib/util'
import { DraftRows, IntakeInbox, NaverUploadSheet, PhotoStrip, type InboxData } from './Inbox'
import NaverListings from './Listings'

const SEGS = ['내 매물', '손님 접수', '네이버 수집'] as const
const FILTER = ['진행 중', ...PROPERTY_STATUS] as const
const ACTIVE: PropertyStatus[] = ['접수', '광고중', '계약중']

const price = (p: Property) => (p.deal === '월세' ? `${won(p.price)} / ${p.rent}만` : won(p.price))

/** 새로 넣은 사진(기기에 있는 것)을 서버에 올리고 주소로 바꾼다. 서버가 없으면 그 사진은 뺀다. */
async function uploadPhotos(photos: string[]) {
  const out: string[] = []
  let failed = 0
  for (const p of photos) {
    if (!p.startsWith('data:')) {
      out.push(p)
      continue
    }
    try {
      out.push((await api<{ url: string }>('office', { a: 'image', data: p })).url)
    } catch {
      failed++
    }
  }
  if (failed) toast(`사진 ${failed}장은 서버에 올리지 못해 빠졌습니다`)
  return out
}

export default function Properties({ intent, clearIntent, go }: PageProps & { go: (t: Tab, i?: Intent) => void }) {
  const { properties, setProperties } = useData()
  const [seg, setSeg] = useState<(typeof SEGS)[number]>(intent === 'intake' ? '손님 접수' : '내 매물')
  const [inbox, setInbox] = useState<InboxData | null>(null)
  const [error, setError] = useState('')
  const reload = () =>
    api<InboxData>('office?a=inbox')
      .then((r) => (setInbox(r), setError('')))
      .catch((e) => setError(e.message))
  useEffect(() => {
    if (intent === 'intake') clearIntent()
    reload()
    const t = setInterval(() => !document.hidden && reload(), 20000)
    return () => clearInterval(t)
  }, [])
  const adopted = useMemo(() => new Set(properties.map((p) => p.intakeId).filter((x): x is string => !!x)), [properties])
  const fresh = inbox?.intakes.filter((i) => i.status === '접수' && !adopted.has(i.id)).length ?? 0

  const adopt = (i: Intake) => {
    setProperties((p) => [{ ...fromIntake(i), id: uid() }, ...p])
    setSeg('내 매물')
    toast('내 매물에 등록했습니다')
  }

  return (
    <>
      <div className="seg hub">
        {SEGS.map((s) => (
          <button key={s} className={s === seg ? 'on' : ''} onClick={() => setSeg(s)}>
            {s}
            {s === '손님 접수' && fresh > 0 && <span className="unread">{fresh}</span>}
          </button>
        ))}
      </div>
      {seg === '내 매물' && <MyProperties newOne={intent === 'newProperty'} clearIntent={clearIntent} go={go} />}
      {seg === '손님 접수' && <IntakeInbox data={inbox} error={error} reload={reload} onAdopt={adopt} adopted={adopted} />}
      {seg === '네이버 수집' && <NaverListings />}
    </>
  )
}

function MyProperties({ newOne, clearIntent, go }: { newOne: boolean; clearIntent: () => void; go: (t: Tab, i?: Intent) => void }) {
  const { properties, setProperties } = useData()
  const [filter, setFilter] = useState<(typeof FILTER)[number]>('진행 중')
  const [q, setQ] = useState('')
  const [form, setForm] = useState<Property | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)
  const [upload, setUpload] = useState(false)
  const [delId, setDelId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const open = properties.find((p) => p.id === openId)

  useEffect(() => {
    if (newOne) {
      clearIntent()
      setForm(blankProperty())
    }
  }, [newOne])

  const rows = properties
    .filter((p) => (filter === '진행 중' ? ACTIVE.includes(p.status) : p.status === filter))
    .filter((p) => !q.trim() || `${propertyTitle(p)}${p.ownerName}${p.ownerPhone}${p.address}`.includes(q.trim()))
    .sort((a, b) => (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt))
  const patch = (id: string, v: Partial<Property>) => setProperties((list) => list.map((p) => (p.id === id ? { ...p, ...v, updatedAt: Date.now() } : p)))

  const save = async () => {
    if (!form) return
    if (!form.complex.trim() && !form.address.trim()) return toast('단지 이름이나 주소를 입력해 주세요')
    if (!form.price) return toast('가격을 입력해 주세요')
    setBusy(true)
    try {
      const photos = await uploadPhotos(form.photos)
      const now = Date.now()
      const item = { ...form, photos, updatedAt: now }
      if (form.id) setProperties((list) => list.map((p) => (p.id === form.id ? item : p)))
      else setProperties((list) => [{ ...item, id: uid(), createdAt: now }, ...list])
      setForm(null)
      toast('저장했습니다')
    } finally {
      setBusy(false)
    }
  }
  /** 이 매물로 계약을 등록하러 간다 (계약 화면이 미리 채워 준다) */
  const toContract = (p: Property) => {
    sessionStorage.setItem('contractPrefill', JSON.stringify({ title: propertyTitle(p), deal: p.deal, price: p.price, rent: p.rent, owner: p.ownerName, ownerPhone: p.ownerPhone, address: [p.region, p.address].filter(Boolean).join(' '), area: p.exclusiveArea, propertyId: p.id }))
    go('contracts', 'newContract')
  }

  return (
    <>
      <PageHead
        title="내 매물"
        sub="우리 사무소가 맡은 매물"
        right={
          <button className="btn small" onClick={() => setForm(blankProperty())}>
            <Icon name="plus" size={18} /> 등록
          </button>
        }
      />
      <section className="block filters">
        <Chips options={FILTER} value={filter} onChange={setFilter} />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="단지·주소·소유자 이름으로 찾기" aria-label="매물 찾기" />
      </section>
      <section className="block">
        {rows.length === 0 && <p className="empty">{properties.length ? '조건에 맞는 매물이 없습니다.' : '등록된 매물이 없습니다. 오른쪽 위 ‘등록’으로 추가하거나, 손님 접수 매물을 내 매물로 옮기세요.'}</p>}
        <ul className="list">
          {rows.map((p) => (
            <li key={p.id} className="card" onClick={() => setOpenId(p.id)}>
              <div className="line">
                <div className="grow">
                  <span className={`tag deal-${p.deal}`}>{p.deal}</span> <span className="tag">{p.kind}</span>
                  <b className="title">{propertyTitle(p)}</b>
                </div>
                <b className="price">{price(p)}</b>
              </div>
              <div className="line">
                <small className="grow">
                  {[p.exclusiveArea && `전용 ${p.exclusiveArea}㎡`, p.floor && `${p.floor}층`, p.direction, p.ownerName && `소유자 ${p.ownerName}`].filter(Boolean).join(' · ')}
                </small>
                <span className={`status p-${p.status}`}>{p.status}</span>
              </div>
              {p.feature && <p className="news-sum">{p.feature}</p>}
            </li>
          ))}
        </ul>
      </section>

      {open && (
        <Sheet
          title={propertyTitle(open)}
          onClose={() => setOpenId(null)}
          footer={
            <div className="row">
              <button className="btn ghost" onClick={() => setUpload(true)}>
                네이버 업로드
              </button>
              <button className="btn" onClick={() => toContract(open)}>
                계약 등록
              </button>
            </div>
          }
        >
          <Chips options={PROPERTY_STATUS} value={open.status} onChange={(status) => patch(open.id, { status })} />
          <p className="hint">
            소유자 {open.ownerName || '-'} ({open.relation}) {open.ownerPhone && <a href={`tel:${open.ownerPhone}`}>{open.ownerPhone}</a>}
          </p>
          <PhotoStrip photos={open.photos} />
          <Field label="네이버 매물번호 (광고 중이면 적어 두세요)">
            <input inputMode="numeric" value={open.articleNo} onChange={(e) => patch(open.id, { articleNo: e.target.value.trim() })} placeholder="예: 2512345678" />
          </Field>
          <Field label="메모 (사무소만 봄)">
            <textarea rows={2} value={open.memo} onChange={(e) => patch(open.id, { memo: e.target.value })} placeholder="열쇠 위치, 집주인 성향, 가격 조정 여지 등" />
          </Field>
          <DraftRows draft={toNaverDraft(asIntake(open)).filter((d) => d.section !== '소유자 확인')} />
          <div className="row act-row">
            <button className="btn ghost" onClick={() => setForm(open)}>
              수정
            </button>
            <button className="btn ghost danger" onClick={() => setDelId(open.id)}>
              삭제
            </button>
          </div>
        </Sheet>
      )}

      {open && upload && <NaverUploadSheet intake={asIntake(open)} onClose={() => setUpload(false)} onSent={() => patch(open.id, { status: '광고중' })} />}

      {form && (
        <Sheet
          title={form.id ? '매물 수정' : '매물 등록'}
          onClose={() => setForm(null)}
          footer={
            <button className="btn block-btn" disabled={busy} onClick={save}>
              {busy ? '저장 중…' : '저장'}
            </button>
          }
        >
          <IntakeForm staff value={asIntake(form)} onChange={(v) => setForm({ ...form, ...v, status: form.status })} />
        </Sheet>
      )}

      {delId && (
        <Confirm
          message="이 매물을 삭제하겠습니까?"
          onNo={() => setDelId(null)}
          onYes={() => {
            setProperties((list) => list.filter((p) => p.id !== delId))
            setDelId(null)
            setOpenId(null)
            toast('삭제했습니다')
          }}
        />
      )}
    </>
  )
}
