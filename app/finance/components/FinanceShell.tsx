'use client';

import type { LucideIcon } from 'lucide-react';
import { Navbar } from '@/components/navbar';
import { WaveBackground } from '@/components/wave-background';
import { Mascot } from '@/components/mascot';

/** Shared V.2 canvas for every finance page: brand-blue sheet + wave, content above it. */
export function FinanceCanvas({ title, width = 'max-w-screen-2xl', children }: { title: string; width?: string; children: React.ReactNode }) {
  return (
    <Navbar isHome={false} title={title}>
      <main className="flex-1 min-h-0 bg-brand-600 rounded-t-[1.5rem] sm:rounded-t-[2rem] lg:rounded-t-[3rem] shadow-2xl overflow-y-auto relative">
        <WaveBackground />
        <div className={`w-full ${width} mx-auto px-3 py-6 sm:px-6 lg:px-10 sm:py-8 relative z-10 space-y-4`}>
          {children}
        </div>
      </main>
    </Navbar>
  );
}

export function FinanceShell({ title, wide = false, children }: { title: string; wide?: boolean; children: React.ReactNode }) {
  return <FinanceCanvas title={title} width={wide ? 'max-w-7xl' : 'max-w-4xl'}>{children}</FinanceCanvas>;
}

/** Page heading on the blue canvas — Group Finance uses the mint tile (see app/home/menu-groups.ts). */
export function FinanceHeading({ icon: Icon, title, caption, actions }: { icon: LucideIcon; title: string; caption?: string; actions?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3 min-w-0">
        <div className="v2-tile-mint size-11 rounded-2xl flex items-center justify-center shrink-0">
          <Icon className="size-5" />
        </div>
        <div className="min-w-0">
          <h1 className="font-display text-lg sm:text-xl font-semibold text-white leading-tight">{title}</h1>
          {caption && <p className="text-xs sm:text-sm text-white/75">{caption}</p>}
        </div>
      </div>
      {actions}
    </div>
  );
}

export interface SummaryStat {
  label: string;
  value: React.ReactNode;
  /** Highlight in rose when the value is non-zero (e.g. overdue). */
  alert?: boolean;
  hint?: string;
}

/** Glass stat tiles — one swipeable row on phones, a grid from sm (same pattern as OPS status). */
export function SummaryTiles({ items }: { items: SummaryStat[] }) {
  return (
    <dl className="-mx-3 px-3 sm:mx-0 sm:px-0 flex sm:grid gap-3 overflow-x-auto pb-1 sm:pb-0" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
      {items.map(s => {
        const hot = s.alert && s.value !== 0 && s.value !== '0';
        return (
          <div key={s.label} className="v2-glass rounded-2xl px-4 py-3 min-w-36 shrink-0 sm:min-w-0">
            <dt className="text-xs text-ink-500">{s.label}</dt>
            <dd className={`mt-0.5 font-display text-2xl font-semibold tabular-nums leading-tight ${hot ? 'text-rose-600' : 'text-ink-900'}`}>
              {s.value}
            </dd>
            {s.hint && <p className="text-[11px] text-ink-500">{s.hint}</p>}
          </div>
        );
      })}
    </dl>
  );
}

export function Panel({ title, children, actions }: { title: string; children: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <section className="rounded-2xl sm:rounded-3xl bg-white p-4 sm:p-6 shadow-xl">
      <div className="mb-4 flex items-center justify-between gap-2 border-b border-gray-100 pb-3">
        <h2 className="flex items-center gap-2 text-base font-semibold text-brand-800">
          <span className="h-4 w-1 rounded-full bg-mint-500" aria-hidden />
          {title}
        </h2>
        {actions}
      </div>
      {children}
    </section>
  );
}

export function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-sm font-medium text-gray-800 break-words">{value ?? '-'}</p>
    </div>
  );
}

export function NoAccess({ text = 'หน้านี้สำหรับฝ่ายการเงินเท่านั้น' }: { text?: string }) {
  return (
    <div className="rounded-2xl sm:rounded-3xl bg-white px-6 py-10 shadow-xl flex flex-col items-center text-center gap-3">
      <Mascot size={96} motion="bob" />
      <p className="font-display text-base font-semibold text-ink-900">ขออภัย ไม่มีสิทธิ์เข้าถึง</p>
      <p className="text-sm text-ink-500">{text}</p>
    </div>
  );
}
