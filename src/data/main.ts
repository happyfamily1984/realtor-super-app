// 메인 단지: 사무소가 주로 다루는 단지. 브리핑·매물·손님용 앱이 이 단지를 중심으로 보여 준다.
export interface MainComplex {
  name: string // 화면에 보이는 이름
  kind: '아파트' | '오피스텔'
  aliases?: string[] // 국토부·네이버 자료에 다른 이름으로 올라오는 경우
}

export const DEFAULT_MAIN: MainComplex[] = [
  { name: '힐스테이트 평촌역 더퍼스트', kind: '오피스텔', aliases: ['힐스테이트평촌역더퍼스트', '힐스테이트평촌역'] },
  { name: '평촌아크로타워', kind: '오피스텔', aliases: ['아크로타워'] },
  { name: '공작부영', kind: '아파트', aliases: ['공작아파트', '공작마을부영'] },
  { name: '한가람세경', kind: '아파트', aliases: ['한가람(세경)'] },
  { name: '한가람신라', kind: '아파트', aliases: ['한가람(신라)'] },
  { name: '한가람한양', kind: '아파트', aliases: ['한가람(한양)'] },
]

const norm = (s: string) => s.replace(/[\s()（）·.\-,]|아파트$|오피스텔$/g, '')

/** 자료에 나온 단지 이름이 어느 메인 단지인지 (없으면 undefined) */
export function matchMain(complex: string, list: MainComplex[], kind?: string): MainComplex | undefined {
  const raw = complex.replace(/[\s()（）·.\-,]/g, '')
  const c = norm(complex)
  if (!c) return undefined
  return list.find((m) => {
    if (kind && m.kind !== kind) return false
    return [m.name, ...(m.aliases ?? [])].some((a) => {
      const full = a.replace(/[\s()（）·.\-,]/g, '')
      const n = norm(a)
      // 별칭이 '공작아파트'처럼 '아파트'로 끝나면 통째로 같을 때만 인정한다 (공작럭키 등과 구분)
      if (full !== n) return raw === full
      return c === n || (n.length >= 4 && c.includes(n))
    })
  })
}
