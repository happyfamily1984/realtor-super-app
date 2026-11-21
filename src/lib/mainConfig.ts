// 메인 단지 목록: 수집기와 함께 쓰는 설정 파일(main 브랜치의 config/main-complexes.json)에서 받는다.
import type { MainComplex } from '../data/main'

const URL = 'https://raw.githubusercontent.com/happyfamily1984/realtor-super-app/main/config/main-complexes.json'

export async function loadMainConfig(): Promise<MainComplex[]> {
  const r = await fetch(`${URL}?t=${Math.floor(Date.now() / 600_000)}`)
  if (!r.ok) throw new Error(`단지 목록을 받지 못했습니다 (${r.status})`)
  const j = (await r.json()) as { complexes: { id: string; name: string; kind: string; aliases?: string[] }[] }
  return j.complexes.map((c) => ({ id: c.id, name: c.name, kind: c.kind === 'offi' ? '오피스텔' : '아파트', aliases: c.aliases ?? [] }))
}
