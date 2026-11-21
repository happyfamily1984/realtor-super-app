// 매물 접수 양식 (손님용 앱에서 작성)
import { useRef } from 'react'
import { DIRECTIONS, HEATING, INTAKE_DEALS, INTAKE_KINDS, INTAKE_REGIONS, MOVE_IN, OPTIONS, RELATIONS, type Intake } from '../data/intake'
import { shrinkImage, toast, won } from '../lib/util'
import { Chips, Field, Icon } from './ui'

const OCCUPIED = ['소유자 거주', '임차인 거주', '공실'] as const

export default function IntakeForm({ value: v, onChange }: { value: Intake; onChange: (v: Intake) => void }) {
  const input = useRef<HTMLInputElement>(null)
  const set = <K extends keyof Intake>(k: K, val: Intake[K]) => onChange({ ...v, [k]: val })
  const num = (k: keyof Intake, label: string, hint = '') => (
    <Field label={`${label}${v[k] ? ` · ${won(v[k] as number)}` : ''}`}>
      <input type="number" inputMode="numeric" value={(v[k] as number) || ''} placeholder={hint} onChange={(e) => set(k, +e.target.value as never)} />
    </Field>
  )
  const txt = (k: keyof Intake, label: string, hint = '', mode: 'text' | 'numeric' | 'tel' | 'decimal' = 'text') => (
    <Field label={label}>
      <input inputMode={mode} value={(v[k] as string | number) || ''} placeholder={hint} onChange={(e) => set(k, (typeof v[k] === 'number' ? +e.target.value : e.target.value) as never)} />
    </Field>
  )
  const priceLabel = v.deal === '매매' ? '매매 희망가 (만원)' : v.deal === '전세' ? '전세 희망가 (만원)' : '보증금 (만원)'

  const addPhotos = async (files: FileList | null) => {
    if (!files) return
    const add = await Promise.all(Array.from(files).map((f) => shrinkImage(f, 1280)))
    if (v.photos.length + add.length > 5) toast('사진은 5장까지 올릴 수 있습니다')
    set('photos', [...v.photos, ...add].slice(0, 5))
  }

  return (
    <>
      <h3 className="form-h">내놓는 분</h3>
      <div className="row">
        {txt('ownerName', '이름', '홍길동')}
        {txt('ownerPhone', '연락처', '010-0000-0000', 'tel')}
      </div>
      <Field label="소유자와의 관계">
        <Chips options={RELATIONS} value={v.relation} onChange={(x) => set('relation', x)} />
      </Field>

      <h3 className="form-h">어떤 매물인가요</h3>
      <Field label="매물 종류">
        <Chips options={INTAKE_KINDS} value={v.kind} onChange={(x) => set('kind', x)} />
      </Field>
      <Field label="거래 유형">
        <Chips options={INTAKE_DEALS} value={v.deal} onChange={(x) => set('deal', x)} />
      </Field>

      <h3 className="form-h">위치</h3>
      <Field label="지역">
        <Chips options={INTAKE_REGIONS} value={v.region} onChange={(x) => set('region', x)} />
      </Field>
      {txt('address', '주소 (동·번지 또는 도로명)', '예: 평촌동 000')}
      {txt('complex', '단지·건물 이름', '예: OO아파트')}
      <div className="row">
        {txt('dongNo', '동', '101')}
        {txt('hoNo', '호', '1001')}
      </div>

      <h3 className="form-h">면적과 구조</h3>
      <div className="row">
        {txt('exclusiveArea', '전용면적 (㎡)', '84', 'decimal')}
        {txt('supplyArea', '공급면적 (㎡)', '112', 'decimal')}
      </div>
      <div className="row">
        {txt('floor', '해당 층', '12')}
        {txt('totalFloors', '전체 층', '20')}
      </div>
      <div className="row">
        {txt('rooms', '방 개수', '3', 'numeric')}
        {txt('baths', '욕실 개수', '2', 'numeric')}
      </div>
      <Field label="방향 (거실 기준)">
        <Chips options={DIRECTIONS} value={v.direction as (typeof DIRECTIONS)[number]} onChange={(x) => set('direction', x)} />
      </Field>

      <h3 className="form-h">가격</h3>
      {num('price', priceLabel, '예: 95000 = 9억 5천')}
      {v.deal === '월세' && num('rent', '월세 (만원)', '예: 120')}
      {v.deal === '매매' && num('tenantDeposit', '세입자가 있다면 기존 보증금 (만원)')}
      {num('loan', '융자금 (만원)', '없으면 비워 두세요')}
      {num('maintenanceFee', '월 관리비 (만원)', '예: 25')}
      <label className="check-row">
        <input type="checkbox" checked={v.negotiable} onChange={(e) => set('negotiable', e.target.checked)} />
        <span>가격 협의 가능</span>
      </label>

      <h3 className="form-h">입주와 시설</h3>
      <Field label="입주 가능일">
        <Chips options={MOVE_IN} value={v.moveIn} onChange={(x) => set('moveIn', x)} />
      </Field>
      {v.moveIn === '날짜 지정' && (
        <Field label="입주 가능 날짜">
          <input type="date" value={v.moveInDate} onChange={(e) => set('moveInDate', e.target.value)} />
        </Field>
      )}
      <Field label="현재 누가 살고 있나요">
        <Chips options={OCCUPIED} value={v.occupied as (typeof OCCUPIED)[number]} onChange={(x) => set('occupied', x)} />
      </Field>
      <Field label="난방">
        <Chips options={HEATING} value={v.heating as (typeof HEATING)[number]} onChange={(x) => set('heating', x)} />
      </Field>
      <div className="row">
        {txt('approvalYear', '준공(사용승인) 연도', '2015', 'numeric')}
        {txt('parking', '주차', '세대당 1.2대')}
      </div>
      <Field label="옵션·특징 (여러 개 선택)">
        <div className="chips wrap">
          {OPTIONS.map((o) => (
            <button key={o} type="button" className={v.options.includes(o) ? 'chip on' : 'chip'} onClick={() => set('options', v.options.includes(o) ? v.options.filter((x) => x !== o) : [...v.options, o])}>
              {o}
            </button>
          ))}
        </div>
      </Field>

      <h3 className="form-h">소개</h3>
      {txt('feature', '한 줄 특징', '예: 남향 로열층, 올수리, 즉시 입주')}
      <Field label="자세한 설명">
        <textarea rows={4} value={v.description} onChange={(e) => set('description', e.target.value)} placeholder="수리 내역, 주변 환경, 학교·교통 등" />
      </Field>
      {txt('visitTime', '집 보기 편한 시간', '예: 평일 저녁, 주말 오후')}
      <Field label="사진 (최대 5장)">
        <div className="photos">
          {v.photos.map((p, i) => (
            <button key={i} type="button" className="photo" aria-label="사진 빼기" onClick={() => set('photos', v.photos.filter((_, j) => j !== i))}>
              <img src={p} alt={`매물 사진 ${i + 1}`} />
            </button>
          ))}
          {v.photos.length < 5 && (
            <button type="button" className="photo add" onClick={() => input.current?.click()}>
              <Icon name="camera" />
              <small>사진 추가</small>
            </button>
          )}
        </div>
        <input
          ref={input}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => {
            addPhotos(e.target.files)
            e.target.value = ''
          }}
        />
      </Field>

      <label className="check-row agree">
        <input type="checkbox" checked={v.agree} onChange={(e) => set('agree', e.target.checked)} />
        <span>
          <b>개인정보 수집·이용에 동의합니다 (필수)</b>
          <small>이름·연락처·매물 정보를 매물 중개와 광고 등록을 위해 중개사무소에 제공하며, 의뢰가 끝나면 삭제를 요청할 수 있습니다.</small>
        </span>
      </label>
    </>
  )
}
