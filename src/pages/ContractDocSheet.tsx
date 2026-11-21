// 계약서 작성: 내용을 채우고 → 미리보기 → 인쇄·PDF 저장
import { useRef, useState } from 'react'
import { Field, Sheet, useData } from '../components/ui'
import type { Contract } from '../data/sample'
import { blankDoc, contractHtml, moneyText, type ContractDoc, type Party } from '../lib/contractDoc'

export default function ContractDocSheet({ contract: c, onSave, onClose }: { contract: Contract; onSave: (doc: ContractDoc, v: Partial<Contract>) => void; onClose: () => void }) {
  const { settings } = useData()
  const [d, setD] = useState<ContractDoc>(() => ({ ...blankDoc(), ...c.doc }))
  const [k, setK] = useState({ price: c.price, midAmount: c.midAmount, midDate: c.midDate, balanceAmount: c.balanceAmount, balanceDate: c.balanceDate, contractDate: c.contractDate })
  const [preview, setPreview] = useState(false)
  const frame = useRef<HTMLIFrameElement>(null)
  const sale = c.deal === '매매'
  const [A, B] = sale ? ['매도인', '매수인'] : ['임대인', '임차인']
  const merged: Contract = { ...c, ...k }
  const set = <K extends keyof ContractDoc>(key: K, v: ContractDoc[K]) => setD((p) => ({ ...p, [key]: v }))
  const num = (label: string, value: number, on: (v: number) => void) => (
    <Field label={`${label} (만원)${value ? ` · ${moneyText(value).replace(/ \(.*/, '')}` : ''}`}>
      <input type="number" inputMode="numeric" value={value || ''} onChange={(e) => on(+e.target.value)} />
    </Field>
  )
  const date = (label: string, value: string, on: (v: string) => void) => (
    <Field label={label}>
      <input type="date" value={value} onChange={(e) => on(e.target.value)} />
    </Field>
  )
  const party = (role: string, key: 'seller' | 'buyer') => {
    const p = d[key]
    const up = (v: Partial<Party>) => set(key, { ...p, ...v })
    return (
      <>
        <h3 className="form-h">{role}</h3>
        <div className="row">
          <Field label="성명">
            <input value={p.name} onChange={(e) => up({ name: e.target.value })} />
          </Field>
          <Field label="전화">
            <input type="tel" inputMode="tel" value={p.phone} onChange={(e) => up({ phone: e.target.value })} />
          </Field>
        </div>
        <Field label="주소">
          <input value={p.address} onChange={(e) => up({ address: e.target.value })} />
        </Field>
      </>
    )
  }
  // 잔금을 비워 두면 대금에서 계약금·중도금을 뺀 값으로 채운다
  const autoBalance = () => setK((p) => ({ ...p, balanceAmount: Math.max(0, p.price - d.downPayment - p.midAmount) }))

  return (
    <Sheet
      title={`${sale ? '매매' : c.deal} 계약서 작성`}
      onClose={onClose}
      footer={
        <div className="row">
          <button
            className="btn ghost"
            onClick={() => {
              onSave(d, k)
              onClose()
            }}
          >
            저장
          </button>
          <button
            className="btn"
            onClick={() => {
              onSave(d, k)
              setPreview(true)
            }}
          >
            미리보기·인쇄
          </button>
        </div>
      }
    >
      <p className="warn-note">일반 서식의 틀을 따른 초안입니다. 서명 전에 협회 서식·최신 법령과 대조하세요. 주민등록번호는 저장하지 않으며, 인쇄 후 직접 적습니다.</p>

      <h3 className="form-h">부동산의 표시</h3>
      <Field label="소재지 (동·호수까지)">
        <input value={d.address} onChange={(e) => set('address', e.target.value)} placeholder="경기도 안양시 동안구 관양동 0000 OO아파트 000동 000호" />
      </Field>
      <div className="row">
        <Field label="지목">
          <input value={d.landCategory} onChange={(e) => set('landCategory', e.target.value)} />
        </Field>
        <Field label="대지 면적·지분">
          <input value={d.landArea} onChange={(e) => set('landArea', e.target.value)} placeholder="예: 33650.4㎡ 중 28.569" />
        </Field>
      </div>
      <div className="row">
        <Field label="건물 구조·용도">
          <input value={d.structure} onChange={(e) => set('structure', e.target.value)} placeholder="철근콘크리트조 / 아파트" />
        </Field>
        <Field label="전용면적 (㎡)">
          <input inputMode="decimal" value={d.area} onChange={(e) => set('area', e.target.value)} />
        </Field>
      </div>

      <h3 className="form-h">대금</h3>
      {date('계약일', k.contractDate, (v) => setK({ ...k, contractDate: v }))}
      {num(sale ? '매매대금' : '보증금', k.price, (v) => setK({ ...k, price: v }))}
      {num('계약금', d.downPayment, (v) => set('downPayment', v))}
      <div className="row">
        {num('중도금', k.midAmount, (v) => setK({ ...k, midAmount: v }))}
        {date('중도금 지급일', k.midDate, (v) => setK({ ...k, midDate: v }))}
      </div>
      <div className="row">
        {num('잔금', k.balanceAmount, (v) => setK({ ...k, balanceAmount: v }))}
        {date('잔금 지급일', k.balanceDate, (v) => setK({ ...k, balanceDate: v }))}
      </div>
      <button type="button" className="link" onClick={autoBalance}>
        잔금을 대금 − 계약금 − 중도금으로 채우기
      </button>
      {sale ? (
        <>
          <Field label="융자금 등 (승계·말소 내용, 선택)">
            <input value={d.loan} onChange={(e) => set('loan', e.target.value)} placeholder="예: 근저당 채권최고액 1억 2천만 원은 잔금일에 말소한다" />
          </Field>
          {date('부동산 인도일', d.deliveryDate, (v) => set('deliveryDate', v))}
        </>
      ) : (
        <>
          <div className="row">
            {date('임대 시작일(인도일)', d.leaseStart, (v) => set('leaseStart', v))}
            {date('임대 종료일', d.leaseEnd, (v) => set('leaseEnd', v))}
          </div>
          {c.deal === '월세' && (
            <div className="row">
              {num('월세', d.rent, (v) => set('rent', v))}
              <Field label="월세 지급일">
                <input value={d.rentDay} onChange={(e) => set('rentDay', e.target.value)} placeholder="매월 25일 (후불)" />
              </Field>
            </div>
          )}
        </>
      )}

      {party(A, 'seller')}
      {party(B, 'buyer')}

      <h3 className="form-h">특약사항</h3>
      <Field label="한 줄에 한 항목씩">
        <textarea rows={6} value={d.special} onChange={(e) => set('special', e.target.value)} placeholder={'현 시설 상태에서의 계약이며, 등기사항증명서를 확인하고 계약함.\n잔금일에 근저당권을 말소하기로 한다.'} />
      </Field>
      {!settings.officeRep && <p className="hint">계약서 아래에 들어갈 사무소 정보(대표, 등록번호, 주소, 전화)는 더보기 &gt; 사무소 설정에서 넣습니다.</p>}

      {preview && (
        <Sheet
          title="계약서 미리보기"
          onClose={() => setPreview(false)}
          footer={
            <button className="btn block-btn" onClick={() => frame.current?.contentWindow?.print()}>
              인쇄 · PDF로 저장
            </button>
          }
        >
          <iframe ref={frame} className="doc-frame" title="계약서 미리보기" srcDoc={contractHtml(merged, d, settings)} />
        </Sheet>
      )}
    </Sheet>
  )
}
