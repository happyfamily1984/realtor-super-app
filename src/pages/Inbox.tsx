// 손님용 앱에서 들어온 것: 채팅 상담, 매물 접수
import { useEffect, useRef, useState } from 'react'
import { Chips, PageHead, Sheet } from '../components/ui'
import { INTAKE_STATUS, type Intake } from '../data/intake'
import { api } from '../lib/api'
import { draftText, missing, toNaverDraft, VENDORS } from '../lib/naverUpload'
import { toast, won } from '../lib/util'

export interface Customer {
  id: string
  name?: string
  phone?: string
  last?: string
  lastAt?: number
  unreadOffice?: number
}
export interface InboxData {
  customers: Customer[]
  intakes: Intake[]
}
interface Msg {
  id: string
  from: 'customer' | 'office'
  text: string
  at: number
}
const stamp = (at: number) => {
  const d = new Date(at)
  return `${d.getMonth() + 1}.${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`
}
const copy = async (text: string, done = '복사했습니다') => {
  try {
    await navigator.clipboard.writeText(text)
    toast(done)
  } catch {
    toast('복사하지 못했습니다')
  }
}

// ── 채팅 ─────────────────────────────────────────
export function ChatInbox({ data, error, reload }: { data: InboxData | null; error: string; reload: () => void }) {
  const [open, setOpen] = useState<Customer | null>(null)
  return (
    <>
      <PageHead title="채팅 상담" sub="손님용 앱에서 온 문의" />
      <section className="block">
        {error && <p className="warn-note">{error}</p>}
        {data && data.customers.length === 0 && <p className="empty">아직 들어온 채팅이 없습니다.</p>}
        <ul className="list">
          {data?.customers.map((c) => (
            <li key={c.id} className="card line" onClick={() => setOpen(c)}>
              <div className="grow">
                <b>{c.name || '이름 없는 손님'}</b>
                <small>{c.last}</small>
              </div>
              <div className="right">
                <small>{c.lastAt ? stamp(c.lastAt) : ''}</small>
                {!!c.unreadOffice && <span className="unread">{c.unreadOffice}</span>}
              </div>
            </li>
          ))}
        </ul>
      </section>
      {open && (
        <ChatRoom
          customer={open}
          onClose={() => {
            setOpen(null)
            reload()
          }}
        />
      )}
    </>
  )
}

function ChatRoom({ customer, onClose }: { customer: Customer; onClose: () => void }) {
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [text, setText] = useState('')
  const last = useRef(0)
  const end = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let alive = true
    const pull = () => {
      if (document.hidden) return
      api<{ messages: Msg[] }>(`office?a=chat&id=${customer.id}&after=${last.current}`)
        .then((r) => {
          if (!alive || !r.messages.length) return
          last.current = r.messages[r.messages.length - 1].at
          setMsgs((p) => [...p, ...r.messages.filter((m) => !p.some((x) => x.id === m.id))])
        })
        .catch(() => {})
    }
    pull()
    const t = setInterval(pull, 4000)
    return () => {
      alive = false
      clearInterval(t)
    }
  }, [customer.id])
  useEffect(() => {
    end.current?.scrollIntoView({ block: 'end' }) // 최신 브라우저는 Promise 를 돌려주므로 그대로 반환하면 안 된다
  }, [msgs.length])

  const send = async () => {
    const body = text.trim()
    if (!body) return
    setText('')
    try {
      const r = await api<{ message: Msg }>('office', { a: 'chatSend', id: customer.id, text: body })
      last.current = Math.max(last.current, r.message.at)
      setMsgs((p) => [...p, r.message])
    } catch (e) {
      setText(body)
      toast((e as Error).message)
    }
  }

  return (
    <Sheet
      title={`${customer.name || '손님'} 님`}
      onClose={onClose}
      footer={
        <form
          className="chat-input"
          onSubmit={(e) => {
            e.preventDefault()
            send()
          }}
        >
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder="답변 입력" aria-label="답변" />
          <button className="btn small" disabled={!text.trim()}>
            보내기
          </button>
        </form>
      }
    >
      {customer.phone && (
        <p className="hint">
          연락처 <a href={`tel:${customer.phone}`}>{customer.phone}</a>
        </p>
      )}
      {msgs.map((m) => (
        <div key={m.id} className={`bubble-row ${m.from === 'office' ? 'me' : ''}`}>
          <p className="bubble">{m.text}</p>
          <small>{stamp(m.at)}</small>
        </div>
      ))}
      <div ref={end} />
    </Sheet>
  )
}

// ── 매물 접수 ────────────────────────────────────
export function IntakeInbox({ data, error, reload }: { data: InboxData | null; error: string; reload: () => void }) {
  const [openId, setOpenId] = useState<string | null>(null)
  const [upload, setUpload] = useState(false)
  const open = data?.intakes.find((i) => i.id === openId)
  const draft = open ? toNaverDraft(open) : []
  const lack = missing(draft)

  const setStatus = async (status: Intake['status']) => {
    if (!open) return
    try {
      await api('office', { a: 'intakeStatus', id: open.id, status })
      reload()
    } catch (e) {
      toast((e as Error).message)
    }
  }
  const sendToVendor = async () => {
    if (!open) return
    if (!VENDORS.length) return toast('매물 등록 업체가 아직 연결되지 않았습니다. 지금은 복사해서 입력해 주세요.')
    try {
      toast(await VENDORS[0].submit(draft, open))
      setStatus('등록완료')
    } catch (e) {
      toast((e as Error).message)
    }
  }

  return (
    <>
      <PageHead title="매물 접수" sub="손님이 내놓은 매물" />
      <section className="block">
        {error && <p className="warn-note">{error}</p>}
        {data && data.intakes.length === 0 && <p className="empty">아직 접수된 매물이 없습니다.</p>}
        <ul className="list">
          {data?.intakes.map((i) => (
            <li key={i.id} className="card" onClick={() => setOpenId(i.id)}>
              <div className="line">
                <div className="grow">
                  <span className={`tag deal-${i.deal}`}>{i.deal}</span> <span className="tag">{i.kind}</span>
                  <b className="title">{i.complex || i.address}</b>
                </div>
                <b className="price">{won(i.price)}</b>
              </div>
              <div className="line">
                <small className="grow">
                  {i.ownerName} · {stamp(i.createdAt)} 접수
                </small>
                <span className={`status i-${i.status}`}>{i.status}</span>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {open && (
        <Sheet
          title={open.complex || open.address || '매물 접수'}
          onClose={() => setOpenId(null)}
          footer={
            <button className="btn block-btn" onClick={() => setUpload(true)}>
              네이버 매물 업로드
            </button>
          }
        >
          <Chips options={INTAKE_STATUS} value={open.status} onChange={setStatus} />
          <p className="hint">
            의뢰인 {open.ownerName} ({open.relation}) <a href={`tel:${open.ownerPhone}`}>{open.ownerPhone}</a>
          </p>
          {open.photos.length > 0 && (
            <div className="photos">
              {open.photos.map((p) => (
                <a key={p} className="photo" href={p} target="_blank" rel="noreferrer">
                  <img src={p} alt="매물 사진" />
                </a>
              ))}
            </div>
          )}
          <DraftRows draft={draft} />
        </Sheet>
      )}

      {open && upload && (
        <Sheet
          title="네이버 매물 업로드 (초안)"
          onClose={() => setUpload(false)}
          footer={
            <div className="row">
              <button className="btn ghost" onClick={() => copy(draftText(draft), '전체 내용을 복사했습니다')}>
                전체 복사
              </button>
              <button className="btn" onClick={sendToVendor}>
                {VENDORS.length ? `${VENDORS[0].name}로 전송` : '업체 연결 예정'}
              </button>
            </div>
          }
        >
          <p className="warn-note">매물 등록 업체가 정해지면 이 값들이 등록 화면에 자동으로 들어갑니다. 지금은 항목을 눌러 복사해 붙여 넣으세요.</p>
          {lack.length > 0 && <p className="warn-note">등록에 꼭 필요한데 비어 있는 항목: {lack.join(', ')}</p>}
          <DraftRows draft={draft} tapToCopy showEmpty />
        </Sheet>
      )}
    </>
  )
}

function DraftRows({ draft, tapToCopy, showEmpty }: { draft: ReturnType<typeof toNaverDraft>; tapToCopy?: boolean; showEmpty?: boolean }) {
  let sec = ''
  return (
    <div>
      {draft
        .filter((d) => d.value || (showEmpty && d.required))
        .map((d) => {
          const head = d.section !== sec ? (sec = d.section) : ''
          return (
            <div key={d.section + d.label}>
              {head && <h3 className="draft-sec">{head}</h3>}
              <button type="button" className={d.value ? 'draft-row' : 'draft-row miss'} disabled={!tapToCopy || !d.value} onClick={() => copy(d.value, `${d.label} 복사`)}>
                <span>{d.label}</span>
                <b>{d.value || '입력 필요'}</b>
              </button>
            </div>
          )
        })}
    </div>
  )
}
