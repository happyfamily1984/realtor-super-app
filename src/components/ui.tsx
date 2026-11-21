import { createContext, useContext, type ReactNode } from 'react'
import type { Consult, Contract, Listing, Settings } from '../data/sample'
import { useBackLayer } from '../lib/nav'

// ── 앱 전역 데이터 ─────────────────────────────────
type Set<T> = (v: T | ((p: T) => T)) => void
export interface AppData {
  settings: Settings
  setSettings: Set<Settings>
  consults: Consult[]
  setConsults: Set<Consult[]>
  contracts: Contract[]
  setContracts: Set<Contract[]>
  listings: Listing[]
  setListings: Set<Listing[]>
}
export const DataCtx = createContext<AppData>(null as unknown as AppData)
export const useData = () => useContext(DataCtx)

export type Tab = 'home' | 'briefing' | 'listings' | 'consult' | 'contracts'
export type Intent = 'cards' | 'newConsult' | 'newContract' | 'chat' | 'intake' | null
export interface PageProps {
  intent: Intent
  clearIntent: () => void
}

// ── 아이콘 ─────────────────────────────────────────
const PATHS: Record<string, string> = {
  home: 'M4 11 12 4l8 7v8a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z',
  briefing: 'M5 4h11l3 3v13H5zM8 9h8M8 13h8M8 17h5',
  listings: 'M4 20V9l5-4 5 4v11M14 20v-8h6v8M2 20h20M8 12v2M8 16v1',
  consult: 'M4 5h16v11H9l-5 4zM8 9h8M8 12h5',
  contracts: 'M7 3h8l4 4v14H7zM14 3v5h5M10 13l2 2 4-4',
  plus: 'M12 5v14M5 12h14',
  close: 'M6 6l12 12M18 6 6 18',
  bell: 'M6 16V11a6 6 0 0 1 12 0v5l2 2H4zM10 20h4',
  camera: 'M4 8h3l2-3h6l2 3h3v11H4zM12 17a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7',
  gear: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1',
  chevron: 'M9 6l6 6-6 6',
}
export function Icon({ name, size = 22 }: { name: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={PATHS[name]} />
    </svg>
  )
}

// ── 아래에서 올라오는 창 ───────────────────────────
export function Sheet({ title, onClose, children, footer }: { title: string; onClose: () => void; children: ReactNode; footer?: ReactNode }) {
  useBackLayer(true, onClose)
  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet" role="dialog" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <header className="sheet-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="닫기">
            <Icon name="close" />
          </button>
        </header>
        <div className="sheet-body">{children}</div>
        {footer && <div className="sheet-foot">{footer}</div>}
      </div>
    </div>
  )
}

// ── 확인 창 ────────────────────────────────────────
export function Confirm({ message, yes = '예', no = '아니오', onYes, onNo, layer = true }: { message: string; yes?: string; no?: string; onYes: () => void; onNo: () => void; layer?: boolean }) {
  useBackLayer(layer, onNo)
  return (
    <div className="overlay center" onClick={onNo}>
      <div className="dialog" role="alertdialog" onClick={(e) => e.stopPropagation()}>
        <p>{message}</p>
        <div className="row">
          <button className="btn ghost" onClick={onNo}>{no}</button>
          <button className="btn" onClick={onYes}>{yes}</button>
        </div>
      </div>
    </div>
  )
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  )
}

export function Chips<T extends string>({ options, value, onChange }: { options: readonly T[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="chips">
      {options.map((o) => (
        <button key={o} type="button" className={o === value ? 'chip on' : 'chip'} onClick={() => onChange(o)}>
          {o}
        </button>
      ))}
    </div>
  )
}

export const SampleBadge = () => <span className="badge sample">샘플 데이터</span>

export function PageHead({ title, sub, right }: { title: string; sub?: string; right?: ReactNode }) {
  return (
    <header className="page-head">
      <div>
        <h1>{title}</h1>
        {sub && <p>{sub}</p>}
      </div>
      {right}
    </header>
  )
}
