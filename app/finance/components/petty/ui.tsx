'use client';

import './petty.css';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Navbar } from '@/components/navbar';
import { cn } from '@/lib/utils';

/**
 * ชุดหน้าตาของ Group เงินสดย่อย (Bew อนุมัติแบบ "clean" 30/10/2026):
 * แผ่นขาวแผ่นเดียวต่อหน้า แบ่งส่วนด้วยเส้นบาง + ป้ายหัวข้อเทาเล็ก · สีเน้นมีสีเดียวคือน้ำเงินแบรนด์
 * (ปุ่มหลัก วงโฟกัส สิ่งที่เลือกอยู่) · ป้ายสถานะเป็นกรอบเทา · ข้อผิดพลาด = เส้นแดงบางด้านซ้าย + ข้อความแดงสั้น
 * แยกจาก FinanceShell เพราะหน้า Advance ยังใช้หน้าตาเดิม
 */

export const LINE = 'border-[#edf1f7]';
export const FIELD = 'w-full rounded-[10px] border border-[#dbe4f3] bg-white px-3 py-2.5 text-sm text-ink-900 placeholder:text-ink-300 transition-colors focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/15 disabled:bg-[#f7f9fc] disabled:text-ink-500';
export const FIELD_SM = 'rounded-lg border border-[#dbe4f3] bg-white px-2.5 py-1.5 text-sm text-ink-900 placeholder:text-ink-300 transition-colors focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/15 disabled:bg-[#f7f9fc]';
export const LABEL = 'mb-1.5 block text-xs font-medium text-ink-500';

/** เครื่องหมายช่องบังคับ */
export function Req() {
  return <span className="text-rose-600" aria-hidden> *</span>;
}

/** หน้าของเงินสดย่อย: หัวเรื่องบนพื้นน้ำเงิน + แผ่นขาวแผ่นเดียว (footer = แถบติดล่าง) */
export function PettyPage({ title, caption, aside, children, footer, width = 'max-w-[1180px]' }: {
  title: string;
  caption?: ReactNode;
  /** ด้านขวาของหัวเรื่อง (ข้อมูลผู้เบิก / ปุ่มหลักของหน้า) */
  aside?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  width?: string;
}) {
  return (
    <Navbar isHome={false} title={title}>
      <main className="relative flex min-h-0 flex-1 flex-col overflow-y-auto rounded-t-[1.5rem] bg-brand-600 shadow-2xl sm:rounded-t-[2rem] lg:rounded-t-[3rem]">
        <div className={`mx-auto flex w-full flex-1 flex-col sm:px-6 lg:px-10 ${width}`}>
          <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3 px-4 pb-4 pt-5 sm:px-2 sm:pb-5 sm:pt-7">
            <div className="min-w-0">
              <h1 className="font-display text-lg font-semibold leading-tight text-white sm:text-xl">{title}</h1>
              {caption && <p className="mt-1 text-xs text-white/75 sm:text-sm">{caption}</p>}
            </div>
            {aside && <div className="flex min-w-0 flex-wrap items-center gap-3">{aside}</div>}
          </header>
          <div className="flex flex-1 flex-col rounded-t-[22px] bg-white shadow-[0_-12px_28px_rgba(15,39,72,0.14)] sm:rounded-t-[26px]">
            <div className="flex-1 px-4 pb-8 pt-5 sm:px-8 sm:pt-7">{children}</div>
            {footer}
          </div>
        </div>
      </main>
    </Navbar>
  );
}

/** ข้อความหนึ่งบรรทัดบนพื้นน้ำเงิน (ชื่อ · รหัส · แผนก · สาขา) */
export function HeaderMeta({ primary, secondary }: { primary: ReactNode; secondary?: ReactNode }) {
  return (
    <div className="min-w-0 text-left leading-tight sm:text-right">
      <p className="truncate text-sm font-semibold text-white">{primary}</p>
      {secondary && <p className="mt-0.5 truncate text-xs text-white/75">{secondary}</p>}
    </div>
  );
}

/** แถบติดล่างของแผ่นขาว — ปุ่มส่ง/ยอดรวม */
export function StickyBar({ children }: { children: ReactNode }) {
  return (
    <div className={`sticky bottom-0 z-20 border-t ${LINE} bg-white/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-white/90 sm:px-8 sm:py-4`}>
      {children}
    </div>
  );
}

/**
 * หนึ่งส่วนในแผ่นขาว: เส้นบางด้านบน + ป้ายหัวข้อเทาเล็ก
 * band = หัวข้อเป็นแถบสีแบบแบบฟอร์มทางการ (พื้นน้ำเงินอ่อน + เส้นน้ำเงินด้านซ้าย + เลขลำดับ) — หน้าเปิดใบ (Bew 30/10/2026)
 */
export function Section({ label, actions, children, className = '', band = false, index }: {
  label?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string;
  band?: boolean; index?: number;
}) {
  if (band) {
    return (
      <section className={`py-5 first:pt-0 last:pb-0 ${className}`}>
        {(label || actions) && (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 rounded-md border-l-4 border-brand-700 bg-[#eef3fb] px-3.5 py-2.5">
            {label && (
              <h2 className="flex items-baseline gap-2 font-display text-sm font-semibold text-brand-900">
                {index !== undefined && <span className="tabular-nums text-brand-700">{index}.</span>}
                {label}
              </h2>
            )}
            {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
          </div>
        )}
        {children}
      </section>
    );
  }
  return (
    <section className={`border-t ${LINE} py-6 first:border-t-0 first:pt-0 last:pb-0 ${className}`}>
      {(label || actions) && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          {label && <h2 className="text-[13px] font-semibold text-ink-700">{label}</h2>}
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

/** ป้ายกรอบเทา — สถานะ / แนบแล้ว / ไม่บังคับ */
export function Tag({ children, strong = false, className = '' }: { children: ReactNode; strong?: boolean; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-md border bg-white px-2 py-0.5 text-[11.5px] font-medium leading-5 ${strong ? 'border-ink-300 text-ink-900' : 'border-[#dbe4f3] text-ink-700'} ${className}`}>
      {children}
    </span>
  );
}

type Tone = 'primary' | 'secondary' | 'danger';
type Size = 'sm' | 'md' | 'lg';

export function buttonClass(tone: Tone = 'secondary', size: Size = 'md', extra = ''): string {
  const t = tone === 'primary'
    ? 'bg-brand-600 text-white hover:bg-brand-700 disabled:bg-[#edf1f7] disabled:text-ink-300'
    : tone === 'danger'
      ? 'border border-[#dbe4f3] bg-white text-rose-700 hover:border-rose-200 hover:bg-rose-50/60 disabled:text-ink-300'
      : 'border border-[#dbe4f3] bg-white text-ink-700 hover:bg-[#f7f9fc] hover:text-ink-900 disabled:text-ink-300';
  const s = size === 'sm' ? 'gap-1 rounded-lg px-2.5 py-1 text-xs'
    : size === 'lg' ? 'min-h-11 gap-2 rounded-[10px] px-6 py-2.5 text-sm'
      : 'min-h-10 gap-1.5 rounded-[10px] px-4 py-2 text-sm';
  return cn('inline-flex items-center justify-center whitespace-nowrap font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/30 disabled:cursor-not-allowed', t, s, extra);
}

export function Button({ tone = 'secondary', size = 'md', className = '', type = 'button', ...props }:
  ButtonHTMLAttributes<HTMLButtonElement> & { tone?: Tone; size?: Size }) {
  return <button type={type} className={buttonClass(tone, size, className)} {...props} />;
}

export type Stat = { label: string; value: ReactNode; hint?: string };

/** ตัวเลขสรุปบรรทัดเดียว คั่นด้วยเส้นบาง (แทนการ์ดสถิติ) */
export function StatRow({ items }: { items: Stat[] }) {
  return (
    <dl className={`mb-6 grid grid-cols-2 gap-x-4 gap-y-4 border-b ${LINE} pb-5 sm:flex sm:flex-wrap sm:gap-y-3`}>
      {items.map(s => (
        <div key={s.label} className={`min-w-0 sm:border-l ${LINE} sm:px-6 sm:first:border-l-0 sm:first:pl-0`}>
          <dt className="text-xs text-ink-500">{s.label}</dt>
          <dd className="mt-0.5 font-display text-xl font-semibold leading-tight tabular-nums text-ink-900">{s.value}</dd>
          {s.hint && <p className="mt-0.5 text-[11px] text-ink-500">{s.hint}</p>}
        </div>
      ))}
    </dl>
  );
}

/** แท็บเส้นใต้ — ตัวที่เลือกขีดน้ำเงิน */
export function UnderlineTabs({ tabs, active, onChange, counts = {}, label }: {
  tabs: { key: string; label: string }[];
  active: string;
  onChange: (key: string) => void;
  counts?: Record<string, number | undefined>;
  label?: string;
}) {
  return (
    <div role="tablist" aria-label={label} className={`-mx-4 flex overflow-x-auto overflow-y-hidden border-b ${LINE} px-4 sm:mx-0 sm:px-0`}>
      {tabs.map(t => {
        const on = t.key === active;
        const n = counts[t.key];
        return (
          <button key={t.key} type="button" role="tab" aria-selected={on} onClick={() => onChange(t.key)}
            className={`relative shrink-0 whitespace-nowrap px-3 py-2.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-600/30 ${on
              ? 'font-semibold text-ink-900 after:absolute after:inset-x-3 after:-bottom-px after:h-0.5 after:rounded-full after:bg-brand-600'
              : 'text-ink-500 hover:text-ink-900'}`}>
            {t.label}
            {n !== undefined && <span className={`ml-1.5 tabular-nums ${on ? 'text-ink-500' : 'text-ink-300'}`}>{n}</span>}
          </button>
        );
      })}
    </div>
  );
}

/** ข้อความแจ้ง: error = เส้นแดงซ้าย + ตัวแดง · info = เส้นเทา + ตัวเทาเข้ม */
export function Notice({ tone = 'info', title, children }: { tone?: 'error' | 'info'; title?: ReactNode; children?: ReactNode }) {
  return (
    <div className={`border-l-2 py-0.5 pl-3 text-sm ${tone === 'error' ? 'border-rose-600 text-rose-700' : 'border-[#dbe4f3] text-ink-700'}`}>
      {title && <p className="font-medium">{title}</p>}
      {children}
    </div>
  );
}

/** ข้อมูลอ่านอย่างเดียว: ป้ายเทาเล็ก + ค่า */
export function Info({ label, value, className = '' }: { label: string; value: ReactNode; className?: string }) {
  return (
    <div className={`min-w-0 ${className}`}>
      <dt className="text-xs text-ink-500">{label}</dt>
      <dd className="mt-0.5 break-words text-sm text-ink-900">{value ?? '-'}</dd>
    </div>
  );
}

/** หน้าว่าง / ไม่มีสิทธิ์ ในแผ่นขาว */
export function EmptyState({ title, text }: { title: string; text?: string }) {
  return (
    <div className="py-14 text-center">
      <p className="font-display text-base font-semibold text-ink-900">{title}</p>
      {text && <p className="mx-auto mt-1 max-w-md text-sm text-ink-500">{text}</p>}
    </div>
  );
}

export const baht2 = (n: number) => n.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
