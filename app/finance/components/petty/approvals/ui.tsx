'use client';

import type { ReactNode } from 'react';
import { CheckCircle2, Clock, Info, X, XCircle } from 'lucide-react';
import { Mascot } from '@/components/mascot';
import { PETTY_ROUND_LABELS, PETTY_ROUND_STYLES, PETTY_STATUS_LABELS, PETTY_STATUS_STYLES, type PettyRoundStatus, type PettyStatus } from '@/lib/finance/petty-status';
import { formatBaht } from '@/lib/finance/status';

// class ชุดเดียวกับหน้าอนุมัติ Advance (app/finance/approvals/page.tsx) — ต้นฉบับไม่ได้ export ไว้ จึงคัดลอกมาตรงตัว
export const CARD = 'rounded-2xl border border-gray-100 bg-white p-4 shadow-sm transition-shadow hover:shadow-md sm:p-5';
export const CARD_HEAD = 'mb-3 flex flex-wrap items-start justify-between gap-2 border-b border-gray-100 pb-3';
export const CARD_FOOT = 'mt-4 border-t border-gray-100 pt-3';
export const BTN_REJECT = 'inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-white px-4 py-2 text-sm font-medium text-rose-600 transition-colors hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50';
export const BTN_APPROVE = 'inline-flex items-center gap-1.5 rounded-xl bg-linear-to-r from-brand-600 to-brand-500 px-5 py-2 text-sm font-semibold text-white shadow-md transition-all hover:from-brand-700 hover:to-brand-600 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50';
export const BTN_VIEW = 'inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-brand-700 transition-colors hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-50';

/** แถบหัวขวาแบบ Advance (pill บนกระจก) */
export function HeaderTabs<T extends string>({ value, onChange, tabs, label = 'มุมมองรายการ' }: {
  value: T; onChange: (v: T) => void; tabs: readonly (readonly [T, string])[]; label?: string;
}) {
  return (
    <div role="tablist" aria-label={label} className="v2-glass inline-flex max-w-full overflow-x-auto rounded-full p-1">
      {tabs.map(([key, text]) => (
        <button key={key} type="button" role="tab" aria-selected={value === key} onClick={() => onChange(key)}
          className={`shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 text-[13px] font-medium transition-all cursor-pointer sm:px-4 sm:text-sm ${value === key ? 'bg-linear-to-r from-brand-600 to-brand-500 text-white shadow-md' : 'text-ink-700 hover:text-brand-600'}`}>
          {text}
        </button>
      ))}
    </div>
  );
}

/** แถบย่อยในการ์ด (รอฉันอนุมัติ / อนุมัติแทนได้) แบบ Advance */
export function SubTabs<T extends string>({ value, onChange, tabs }: {
  value: T; onChange: (v: T) => void; tabs: readonly (readonly [T, string])[];
}) {
  const pill = (active: boolean) =>
    `rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${active ? 'bg-brand-600 text-white shadow-sm' : 'text-gray-600 hover:text-brand-600'}`;
  return (
    <div className="mb-4 inline-flex items-center gap-0.5 rounded-full bg-gray-100 p-0.5">
      {tabs.map(([key, text]) => (
        <button key={key} type="button" onClick={() => onChange(key)} className={pill(value === key)}>{text}</button>
      ))}
    </div>
  );
}

/** ตัวเลขเงินบนการ์ด — strong = ยอดที่คนตัดสินใจ (ตัวใหญ่ที่สุด) */
export function Money({ label, value, strong = false }: { label: string; value: number | null | undefined; strong?: boolean }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`tabular-nums ${strong ? 'font-display text-xl font-semibold text-brand-800' : 'text-sm font-medium text-gray-800'}`}>
        {formatBaht(value)} <span className="text-xs font-normal text-gray-500">บาท</span>
      </p>
    </div>
  );
}

export function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center gap-2 py-8 text-center">
      <Mascot size={80} />
      <p className="text-sm text-ink-500">{text}</p>
    </div>
  );
}

export function WaitingBadge({ text }: { text: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700">
      <Clock className="h-3 w-3" /> {text}
    </span>
  );
}

export function OutcomeBadge({ ok, okText, noText }: { ok: boolean; okText: string; noText: string }) {
  return ok ? (
    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-mint-700">
      <CheckCircle2 className="h-3 w-3" /> {okText}
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2.5 py-0.5 text-xs font-medium text-rose-700">
      <XCircle className="h-3 w-3" /> {noText}
    </span>
  );
}

export function ClaimStatusPill({ status }: { status: PettyStatus }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ${PETTY_STATUS_STYLES[status]}`}>
      {PETTY_STATUS_LABELS[status]}
    </span>
  );
}

export function RoundStatusPill({ status }: { status: PettyRoundStatus }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ${PETTY_ROUND_STYLES[status]}`}>
      {PETTY_ROUND_LABELS[status]}
    </span>
  );
}

/** บรรทัดเล็กเหนือปุ่ม แบบ "อนุมัติแทนได้ — …" ของ Advance */
export function HintLine({ children, tone = 'info' }: { children: ReactNode; tone?: 'info' | 'warn' }) {
  return (
    <p className={`mb-2 flex items-start gap-1.5 text-xs ${tone === 'warn' ? 'text-amber-700' : 'text-gray-500'}`}>
      <Info className={`mt-px h-3.5 w-3.5 shrink-0 ${tone === 'warn' ? 'text-amber-600' : 'text-brand-600'}`} /> <span>{children}</span>
    </p>
  );
}

/** แถบแจ้งเตือนจากลิงก์ ?doc= — เหมือนของ Advance */
export function NoticeBar({ text, onClose }: { text: string; onClose: () => void }) {
  if (!text) return null;
  return (
    <div role="status" className="flex items-start justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
      <span>{text}</span>
      <button type="button" aria-label="ปิด" onClick={onClose} className="shrink-0 text-amber-700 hover:text-amber-900">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
