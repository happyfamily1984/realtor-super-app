// 시도 → 시군구 → 동 선택. 목록은 국토교통부 법정동코드(공공데이터포털) 기준이며 필요할 때만 불러온다.
import { useEffect, useState } from 'react'
import { Field } from './ui'

interface Gu {
  n: string // 시군구 이름 (예: 안양시 동안구)
  c: string // 시군구 코드 5자리
  d: string[] // 읍·면·동
}
interface Sido {
  n: string
  g: Gu[]
}

export default function RegionPicker({ lawdCd, dong, onChange }: { lawdCd: string; dong: string; onChange: (v: { lawdCd: string; dong: string; name: string }) => void }) {
  const [all, setAll] = useState<Sido[] | null>(null)
  const [sido, setSido] = useState('')

  useEffect(() => {
    import('../data/regions.json').then((m) => {
      const list = m.default as Sido[]
      setAll(list)
      setSido(list.find((s) => s.g.some((g) => g.c === lawdCd))?.n ?? '')
    })
  }, [])

  if (!all) return <p className="hint">지역 목록을 불러오는 중…</p>
  const gus = all.find((s) => s.n === sido)?.g ?? []
  const gu = gus.find((g) => g.c === lawdCd)
  const label = (g: Gu, d: string) => (d ? `${g.n} ${d}` : g.n)

  return (
    <>
      <Field label="시·도">
        <select
          value={sido}
          onChange={(e) => {
            const next = all.find((s) => s.n === e.target.value)
            setSido(e.target.value)
            // 시군구가 하나뿐인 곳(세종)은 바로 정한다
            if (next?.g.length === 1) onChange({ lawdCd: next.g[0].c, dong: '', name: next.g[0].n })
          }}
        >
          <option value="">선택</option>
          {all.map((s) => (
            <option key={s.n}>{s.n}</option>
          ))}
        </select>
      </Field>
      <div className="row">
        <Field label="시·군·구">
          <select
            value={gu ? gu.c : ''}
            disabled={!sido}
            onChange={(e) => {
              const g = gus.find((x) => x.c === e.target.value)
              if (g) onChange({ lawdCd: g.c, dong: '', name: g.n })
            }}
          >
            <option value="">선택</option>
            {gus.map((g) => (
              <option key={g.c} value={g.c}>
                {g.n}
              </option>
            ))}
          </select>
        </Field>
        <Field label="읍·면·동">
          <select value={gu?.d.includes(dong) ? dong : ''} disabled={!gu} onChange={(e) => gu && onChange({ lawdCd: gu.c, dong: e.target.value, name: label(gu, e.target.value) })}>
            <option value="">전체</option>
            {gu?.d.map((d) => (
              <option key={d}>{d}</option>
            ))}
          </select>
        </Field>
      </div>
      {!gu && lawdCd && <p className="warn-note">저장된 지역 코드({lawdCd})가 목록에 없습니다. 지역을 다시 골라 주세요.</p>}
    </>
  )
}
