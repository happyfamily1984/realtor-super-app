// 더보기: 사무소 설정, 손님용 앱 소식 올리기, 손님용 앱 안내, 자료 백업
import { useEffect, useRef, useState } from 'react'
import { Confirm, Field, Icon, PageHead, Sheet, useData } from '../components/ui'
import { api } from '../lib/api'
import { downloadDataUrl, photoGet, photoPut, shrinkImage, shrinkSrc, today, toast } from '../lib/util'

interface Post {
  id: string
  title: string
  body: string
  images: string[]
  at: number
}
const BACKUP_KEYS = ['settings', 'consults', 'contracts', 'properties', 'listings', 'regionNames']

export default function More() {
  const { settings, setSettings, consults, contracts, properties } = useData()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(settings)
  const [writing, setWriting] = useState(false)
  const [posts, setPosts] = useState<Post[] | null>(null)
  const [delPost, setDelPost] = useState<string | null>(null)
  const [restoring, setRestoring] = useState<Record<string, unknown> | null>(null)
  const file = useRef<HTMLInputElement>(null)
  const customerUrl = `${location.origin}/customer.html`

  const loadPosts = () => api<{ posts: Post[] }>('office?a=posts').then((r) => setPosts(r.posts)).catch(() => setPosts(null))
  useEffect(() => void loadPosts(), [])

  const backup = async () => {
    const data: Record<string, unknown> = { app: 'realtor-super-app', savedAt: new Date().toISOString() }
    BACKUP_KEYS.forEach((k) => {
      try {
        data[k] = JSON.parse(localStorage.getItem(k) || 'null')
      } catch {
        /* 무시 */
      }
    })
    // 계약서 사진(기기 안에 따로 저장)도 함께 담는다
    const photos: Record<string, string> = {}
    for (const id of contracts.flatMap((c) => c.photos)) {
      const p = await photoGet(id).catch(() => undefined)
      if (p) photos[id] = p
    }
    data.photos = photos
    const url = URL.createObjectURL(new Blob([JSON.stringify(data)], { type: 'application/json' }))
    downloadDataUrl(url, `중개사앱_백업_${today()}.json`)
    setTimeout(() => URL.revokeObjectURL(url), 10000)
    toast(`백업 파일을 저장했습니다 (계약서 사진 ${Object.keys(photos).length}장 포함)`)
  }
  const pickRestore = async (f?: File) => {
    if (!f) return
    try {
      const d = JSON.parse(await f.text())
      if (d.app !== 'realtor-super-app') throw new Error()
      setRestoring(d)
    } catch {
      toast('이 앱의 백업 파일이 아닙니다')
    }
  }
  const field = (k: 'office' | 'region' | 'officeRep' | 'officeRegNo' | 'officeAddress' | 'officePhone' | 'myRealtor', label: string, hint = '') => (
    <Field label={label}>
      <input value={draft[k] ?? ''} placeholder={hint} onChange={(e) => setDraft({ ...draft, [k]: e.target.value })} />
    </Field>
  )

  return (
    <>
      <PageHead title="더보기" sub="설정과 손님용 앱 관리" />

      <section className="block">
        <h2>사무소</h2>
        <button
          className="card line menu-row"
          onClick={() => {
            setDraft(settings)
            setEditing(true)
          }}
        >
          <Icon name="gear" />
          <div className="grow">
            <b>사무소 설정</b>
            <small>{settings.office}{settings.officeRep ? ` · 대표 ${settings.officeRep}` : ' · 계약서용 정보를 넣어 주세요'}</small>
          </div>
          <Icon name="chevron" />
        </button>
      </section>

      <section className="block">
        <h2>손님용 앱</h2>
        <button
          className="card line menu-row"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(customerUrl)
              toast('손님용 앱 주소를 복사했습니다')
            } catch {
              toast(customerUrl)
            }
          }}
        >
          <Icon name="consult" />
          <div className="grow">
            <b>손님용 앱 주소 복사</b>
            <small>{customerUrl.replace(/^https?:\/\//, '')}</small>
          </div>
        </button>
        <button className="card line menu-row" onClick={() => setWriting(true)}>
          <Icon name="briefing" />
          <div className="grow">
            <b>손님에게 소식 올리기</b>
            <small>손님용 앱의 소식에 올리고 알림을 보냅니다</small>
          </div>
          <Icon name="chevron" />
        </button>
        {posts && posts.length > 0 && (
          <ul className="list posts-list">
            {posts.slice(0, 10).map((p) => (
              <li key={p.id} className="card line">
                <div className="grow">
                  <b>{p.title}</b>
                  <small>
                    {new Date(p.at).toLocaleDateString('ko-KR')} · 이미지 {p.images.length}장
                  </small>
                </div>
                <button className="icon-btn" aria-label={`${p.title} 삭제`} onClick={() => setDelPost(p.id)}>
                  <Icon name="close" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="block">
        <h2>자료 백업</h2>
        <p className="hint">
          손님 상담 {consults.length}건, 내 매물 {properties.length}건, 계약 {contracts.length}건이 이 기기에 저장돼 있습니다. 기기를 바꾸거나 브라우저 자료를 지우면 사라지니 가끔 백업해 두세요. 백업 파일에는 계약서 사진도 들어갑니다.
        </p>
        <div className="row">
          <button className="btn ghost" onClick={backup}>
            백업 파일 저장
          </button>
          <button className="btn ghost" onClick={() => file.current?.click()}>
            백업에서 복원
          </button>
        </div>
        <input
          ref={file}
          type="file"
          accept=".json,application/json"
          hidden
          onChange={(e) => {
            pickRestore(e.target.files?.[0])
            e.target.value = ''
          }}
        />
      </section>

      {editing && (
        <Sheet
          title="사무소 설정"
          onClose={() => setEditing(false)}
          footer={
            <button
              className="btn block-btn"
              onClick={() => {
                setSettings({ ...draft, office: draft.office.trim() || settings.office, region: draft.region.trim() || settings.region })
                setEditing(false)
                toast('저장했습니다')
                api('office', { a: 'profile', office: draft.office.trim() || settings.office, main: settings.mainComplexes }).catch(() => {})
              }}
            >
              저장
            </button>
          }
        >
          {field('office', '사무소 이름')}
          {field('region', '지역 이름 (제안서에 표시)')}
          <h3 className="form-h">계약서에 들어가는 정보</h3>
          {field('officeRep', '대표 (개업공인중개사 성명)')}
          {field('officeRegNo', '등록번호')}
          {field('officeAddress', '사무소 소재지')}
          {field('officePhone', '사무소 전화')}
          <h3 className="form-h">네이버 중복 광고 확인</h3>
          {field('myRealtor', '네이버에 표시되는 우리 사무소 이름', '비우면 사무소 이름')}
          <h3 className="form-h">서버</h3>
          <Field label="서버 접속 암호">
            <input type="password" autoComplete="off" value={draft.passcode} onChange={(e) => setDraft({ ...draft, passcode: e.target.value })} />
          </Field>
          <p className="hint">채팅, 손님 접수 매물, 사진 저장, 계약서 AI 정리에 필요합니다.</p>
        </Sheet>
      )}

      {writing && (
        <PostSheet
          onClose={() => setWriting(false)}
          onDone={() => {
            setWriting(false)
            loadPosts()
          }}
        />
      )}

      {delPost && (
        <Confirm
          message="이 소식을 손님용 앱에서 지우겠습니까?"
          onNo={() => setDelPost(null)}
          onYes={async () => {
            try {
              await api('office', { a: 'postDelete', id: delPost })
              toast('지웠습니다')
              loadPosts()
            } catch (e) {
              toast((e as Error).message)
            }
            setDelPost(null)
          }}
        />
      )}

      {restoring && (
        <Confirm
          message="백업 파일의 내용으로 바꾸겠습니까? 지금 이 기기에 있는 상담·매물·계약은 덮어씁니다."
          onNo={() => setRestoring(null)}
          onYes={async () => {
            BACKUP_KEYS.forEach((k) => restoring[k] != null && localStorage.setItem(k, JSON.stringify(restoring[k])))
            const photos = (restoring.photos ?? {}) as Record<string, string>
            for (const [id, p] of Object.entries(photos)) await photoPut(id, p).catch(() => {})
            localStorage.setItem('samplesCleared', '1')
            location.reload()
          }}
        />
      )}
    </>
  )
}

function PostSheet({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const { settings } = useData()
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [images, setImages] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const input = useRef<HTMLInputElement>(null)

  const send = async () => {
    if (!title.trim()) return toast('제목을 입력해 주세요')
    setBusy(true)
    try {
      const small = await Promise.all(images.map((d) => shrinkSrc(d, 1080, 0.86)))
      const r = await api<{ sent: number }>('office', { a: 'publish', title, body, images: small, kind: '소식', office: settings.office })
      toast(`올렸습니다 · 알림 ${r.sent}명`)
      onDone()
    } catch (e) {
      toast((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <Sheet
      title="손님에게 소식 올리기"
      onClose={onClose}
      footer={
        <button className="btn block-btn" disabled={busy} onClick={send}>
          {busy ? '올리는 중…' : '올리기'}
        </button>
      }
    >
      <Field label="제목">
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="예: 이번 주 새로 나온 매물" />
      </Field>
      <Field label="내용">
        <textarea rows={5} value={body} onChange={(e) => setBody(e.target.value)} />
      </Field>
      <Field label={`이미지 ${images.length}장 (최대 10장)`}>
        <div className="photos">
          {images.map((d, i) => (
            <button key={i} type="button" className="photo" aria-label="이미지 빼기" onClick={() => setImages(images.filter((_, j) => j !== i))}>
              <img src={d} alt={`이미지 ${i + 1}`} />
            </button>
          ))}
          {images.length < 10 && (
            <button type="button" className="photo add" onClick={() => input.current?.click()}>
              <Icon name="plus" />
              <small>이미지 추가</small>
            </button>
          )}
        </div>
        <input
          ref={input}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={async (e) => {
            const add = await Promise.all(Array.from(e.target.files ?? []).map((f) => shrinkImage(f, 1600)))
            setImages((p) => [...p, ...add].slice(0, 10))
            e.target.value = ''
          }}
        />
      </Field>
    </Sheet>
  )
}
