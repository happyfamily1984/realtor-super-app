// 정보 내보내기: 만든 자료를 손님용 앱·오픈카톡·스레드·블로그로 보낸다
// - 손님용 앱: 서버에 올려 바로 게시하고 알림을 보낸다 (자동)
// - 오픈카톡·스레드·블로그: 외부에서 글을 대신 올려 주는 공식 방법이 없어, 글 복사·이미지 저장·작성 화면 열기까지 도와준다
import { useRef, useState } from 'react'
import { api } from '../lib/api'
import { renderPointCards } from '../lib/cardnews'
import { downloadDataUrl, shrinkImage, shrinkSrc, today, toast } from '../lib/util'
import { Field, Icon, Sheet, useData } from './ui'

export interface ExportContent {
  title: string
  body: string
  images: string[] // dataURL
  kind: string
  texts?: { talk?: string; thread?: string; blog?: string } // 채널별로 미리 써 둔 글 (없으면 제목+내용)
  cards?: { title: string; points: string[] }[] // 카드뉴스로 그릴 내용
}

const copy = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

export default function ExportSheet({ initial, onClose }: { initial: ExportContent; onClose: () => void }) {
  const { settings } = useData()
  const [c, setC] = useState(initial)
  const [done, setDone] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState('')
  const input = useRef<HTMLInputElement>(null)
  const text = `${c.title}\n\n${c.body}`.trim()
  const talk = c.texts?.talk ?? text
  const makeCards = async () => {
    if (!c.cards?.length) return
    setBusy('cards')
    try {
      const made = await renderPointCards(c.cards, { region: settings.region, office: settings.office })
      setC((p) => ({ ...p, images: [...p.images, ...made].slice(0, 10), cards: undefined }))
    } finally {
      setBusy('')
    }
  }
  const mark = (k: string, v: string) => setDone((p) => ({ ...p, [k]: v }))
  const saveImages = () => c.images.forEach((d, i) => setTimeout(() => downloadDataUrl(d, `${c.title || '소식'}_${today()}_${i + 1}.png`), i * 250))

  const toApp = async () => {
    if (!c.title.trim()) return toast('제목을 입력해 주세요')
    setBusy('app')
    try {
      const images = await Promise.all(c.images.map((d) => shrinkSrc(d, 1080, 0.86))) // 전송 용량 줄이기
      const r = await api<{ sent: number }>('office', { a: 'publish', title: c.title, body: c.body, images, kind: c.kind, office: settings.office })
      mark('app', `게시했습니다 · 알림 ${r.sent}명`)
    } catch (e) {
      toast((e as Error).message)
    } finally {
      setBusy('')
    }
  }
  const toKakao = async () => {
    try {
      const files = await Promise.all(c.images.map(async (d, i) => new File([await (await fetch(d)).blob()], `info_${i + 1}.png`, { type: 'image/png' })))
      if (navigator.canShare?.({ files }) || (!files.length && navigator.share)) {
        await navigator.share(files.length ? { files, text: talk } : { text: talk })
        return mark('kakao', '공유 창을 열었습니다')
      }
    } catch {
      return // 공유 취소
    }
    await copy(talk)
    saveImages()
    mark('kakao', '글을 복사하고 이미지를 저장했습니다')
  }
  const toThreads = async () => {
    saveImages()
    window.open(`https://www.threads.net/intent/post?text=${encodeURIComponent((c.texts?.thread ?? text).slice(0, 480))}`, '_blank', 'noopener')
    mark('threads', c.images.length ? '작성 창을 열었습니다 · 저장된 이미지를 첨부하세요' : '작성 창을 열었습니다')
  }
  const toBlog = async () => {
    const ok = await copy(c.texts?.blog ?? text)
    saveImages()
    window.open('https://blog.naver.com/GoBlogWrite.naver', '_blank', 'noopener')
    mark('blog', ok ? '글을 복사했습니다 · 글쓰기 화면에 붙여 넣으세요' : '글쓰기 화면을 열었습니다')
  }

  const channels: [string, string, string, () => void][] = [
    ['app', '손님용 앱', '소식에 바로 올리고 알림을 보냅니다', toApp],
    ['kakao', '오픈카톡', '공유 창에서 카카오톡 방을 고릅니다', toKakao],
    ['threads', '스레드', '글을 채운 작성 창을 엽니다', toThreads],
    ['blog', '네이버 블로그', '글을 복사하고 글쓰기 화면을 엽니다', toBlog],
  ]

  return (
    <Sheet title="정보 내보내기" onClose={onClose}>
      <Field label="제목">
        <input value={c.title} onChange={(e) => setC({ ...c, title: e.target.value })} placeholder="예: 11월 3주차 우리 동네 실거래" />
      </Field>
      <Field label="내용">
        <textarea rows={5} value={c.body} onChange={(e) => setC({ ...c, body: e.target.value })} placeholder="손님에게 전할 내용" />
      </Field>
      <Field label={`이미지 ${c.images.length}장`}>
        <div className="photos">
          {c.images.map((d, i) => (
            <button key={i} type="button" className="photo" aria-label="이미지 빼기" onClick={() => setC({ ...c, images: c.images.filter((_, j) => j !== i) })}>
              <img src={d} alt={`이미지 ${i + 1}`} />
            </button>
          ))}
          {c.images.length < 10 && (
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
            setC((p) => ({ ...p, images: [...p.images, ...add].slice(0, 10) }))
            e.target.value = ''
          }}
        />
      </Field>
      {!!c.cards?.length && (
        <button type="button" className="btn ghost block-btn" disabled={busy === 'cards'} onClick={makeCards}>
          {busy === 'cards' ? '만드는 중…' : `카드 이미지 ${c.cards.length}장 만들어 붙이기`}
        </button>
      )}
      {c.texts && <p className="hint">오픈카톡·스레드·블로그에는 각 채널에 맞게 미리 써 둔 글이 들어갑니다.</p>}
      <h3 className="sub-h">보낼 곳</h3>
      {channels.map(([k, name, desc, run]) => (
        <button key={k} type="button" className={done[k] ? 'export-ch done' : 'export-ch'} disabled={busy === k} onClick={run}>
          <span className="check" style={done[k] ? { background: 'var(--brand)', borderColor: 'var(--brand)' } : undefined}>
            {done[k] ? '✓' : ''}
          </span>
          <span className="grow">
            <b>{name}</b>
            <small>{busy === k ? '보내는 중…' : done[k] || desc}</small>
          </span>
        </button>
      ))}
      <p className="hint">오픈카톡·스레드·블로그는 외부에서 글을 대신 올릴 수 있는 공식 방법이 없어, 작성 화면까지만 열어 드립니다.</p>
    </Sheet>
  )
}
