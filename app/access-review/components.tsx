'use client';

import { memo, useState, type ReactNode } from 'react';
import { CheckCircle2, Clock, FileEdit, Loader2, Mail, ShieldCheck, Warehouse, XCircle } from 'lucide-react';
import { Navbar } from '@/components/navbar';
import { WaveBackground } from '@/components/wave-background';
import { Mascot } from '@/components/mascot';
import { Button } from '@/components/ui/button';
import type { AdminReviewRowStatus, Decision, ReviewStatus, SystemCode } from './types';

/**
 * Shared, formal V.2 shell + widgets for the Access Review pages — mirrors the brand-blue
 * canvas / white Panel pattern used across app/finance (FinanceShell.tsx) and app/master so this
 * feature looks like the rest of the internal tools, not a one-off design.
 */

// ───────────────────────────── canvas / layout ─────────────────────────────

export function AccessReviewCanvas({ title, width = 'max-w-5xl', children }: { title: string; width?: string; children: ReactNode }) {
    return (
        <Navbar isHome={false} title={title}>
            <main className="flex-1 min-h-0 bg-brand-600 rounded-t-[1.5rem] sm:rounded-t-[2rem] lg:rounded-t-[3rem] shadow-2xl overflow-y-auto relative">
                <WaveBackground />
                <div className={`w-full ${width} mx-auto px-3 py-6 sm:px-6 lg:px-10 sm:py-8 relative z-10 space-y-4 pb-28`}>
                    {children}
                </div>
            </main>
        </Navbar>
    );
}

export function PageHeading({ icon: Icon, title, caption, actions }: { icon: React.ComponentType<{ className?: string }>; title: string; caption?: ReactNode; actions?: ReactNode }) {
    return (
        <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
                <div className="v2-tile-blue size-11 rounded-2xl flex items-center justify-center shrink-0">
                    <Icon className="size-5" />
                </div>
                <div className="min-w-0">
                    <h1 className="font-display text-lg sm:text-xl font-semibold text-white leading-tight">{title}</h1>
                    {caption && <div className="text-xs sm:text-sm text-white/75">{caption}</div>}
                </div>
            </div>
            {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
    );
}

export function Panel({ title, children, actions, icon: Icon }: { title?: string; children: ReactNode; actions?: ReactNode; icon?: React.ComponentType<{ className?: string }> }) {
    return (
        <section className="rounded-2xl sm:rounded-3xl bg-white p-4 sm:p-6 shadow-xl">
            {title && (
                <div className="mb-4 flex items-center justify-between gap-2 border-b border-gray-100 pb-3">
                    <h2 className="flex items-center gap-2 text-base font-semibold text-brand-800">
                        {Icon ? <Icon className="size-4 text-brand-600" /> : <span className="h-4 w-1 rounded-full bg-brand-500" aria-hidden />}
                        {title}
                    </h2>
                    {actions}
                </div>
            )}
            {children}
        </section>
    );
}

export function Field({ label, value, mono }: { label: string; value: ReactNode; mono?: boolean }) {
    return (
        <div className="min-w-0">
            <p className="text-xs text-gray-500">{label}</p>
            <p className={`text-sm font-medium text-gray-800 break-words ${mono ? 'font-mono' : ''}`}>{value ?? '-'}</p>
        </div>
    );
}

export function NoAccess({ text = 'คุณไม่มีสิทธิ์เข้าถึงหน้านี้' }: { text?: string }) {
    return (
        <div className="rounded-2xl sm:rounded-3xl bg-white px-6 py-10 shadow-xl flex flex-col items-center text-center gap-3">
            <Mascot size={96} motion="bob" />
            <p className="font-display text-base font-semibold text-ink-900">ขออภัย ไม่มีสิทธิ์เข้าถึง</p>
            <p className="text-sm text-ink-500">{text}</p>
        </div>
    );
}

export function EmptyState({ text, sub }: { text: string; sub?: string }) {
    return (
        <div className="rounded-2xl sm:rounded-3xl bg-white px-6 py-14 shadow-xl flex flex-col items-center text-center gap-3">
            <Mascot size={88} />
            <p className="text-sm font-medium text-gray-700">{text}</p>
            {sub && <p className="text-xs text-gray-400">{sub}</p>}
        </div>
    );
}

// ───────────────────────────── status / decision pills ─────────────────────────────

const STATUS_STYLE: Record<AdminReviewRowStatus, { label: string; cls: string; icon: typeof Clock }> = {
    not_started: { label: 'ยังไม่เริ่ม', cls: 'border-gray-200 bg-gray-50 text-gray-500', icon: Clock },
    draft: { label: 'ยังไม่ส่ง', cls: 'border-gray-200 bg-gray-50 text-gray-600', icon: FileEdit },
    pending: { label: 'รออนุมัติ', cls: 'border-amber-200 bg-amber-50 text-amber-700', icon: Clock },
    approved: { label: 'อนุมัติแล้ว', cls: 'border-emerald-200 bg-emerald-50 text-mint-700', icon: CheckCircle2 },
    rejected: { label: 'ไม่อนุมัติ', cls: 'border-rose-200 bg-rose-50 text-rose-700', icon: XCircle },
};

export const ReviewStatusPill = memo(({ status }: { status: ReviewStatus | AdminReviewRowStatus }) => {
    const s = STATUS_STYLE[status] ?? STATUS_STYLE.draft;
    const Icon = s.icon;
    return (
        <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium ${s.cls}`}>
            <Icon className="h-3 w-3" /> {s.label}
        </span>
    );
});
ReviewStatusPill.displayName = 'ReviewStatusPill';

export const DecisionPill = memo(({ decision }: { decision: Decision | null }) => {
    if (decision === 'keep') {
        return <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-mint-700">ใช้</span>;
    }
    if (decision === 'remove') {
        return <span className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2.5 py-0.5 text-xs font-semibold text-rose-700">ไม่ใช้</span>;
    }
    return <span className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-gray-50 px-2.5 py-0.5 text-xs font-medium text-gray-400">ยังไม่เลือก</span>;
});
DecisionPill.displayName = 'DecisionPill';

/** สถานะ column pill shared by the admin tables — always one line; clickable when onClick is given. */
export function ActivePill({ active, onClick, on = 'ใช้งาน', off = 'ปิดใช้งาน' }: { active: boolean; onClick?: () => void; on?: string; off?: string }) {
    const cls = `inline-flex items-center whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium ${active ? 'border-emerald-200 bg-emerald-50 text-mint-700' : 'border-gray-200 bg-gray-50 text-gray-500'}`;
    if (!onClick) return <span className={cls}>{active ? on : off}</span>;
    return (
        <button type="button" onClick={onClick} title={active ? `คลิกเพื่อ${off}` : `คลิกเพื่อ${on}`} className={`${cls} cursor-pointer hover:border-gray-300`}>
            {active ? on : off}
        </button>
    );
}

export const SYSTEM_META: Record<SystemCode, { icon: typeof ShieldCheck; label: string }> = {
    ATMS: { icon: Warehouse, label: 'ATMS' },
    WINSPEED: { icon: ShieldCheck, label: 'Winspeed' },
    EMAIL: { icon: Mail, label: 'Email Group' },
};

export function SystemIcon({ code, className = 'size-4' }: { code: SystemCode; className?: string }) {
    const Icon = SYSTEM_META[code]?.icon ?? ShieldCheck;
    return <Icon className={className} />;
}

// ───────────────────────────── date helpers ─────────────────────────────

/** th-TH's default calendar is Buddhist — Bew always speaks in พ.ศ. */
export function formatThaiDate(value?: string | null): string {
    if (!value) return '-';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '-';
    return d.toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' });
}

export function formatThaiDateTime(value?: string | null): string {
    if (!value) return '-';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '-';
    return d.toLocaleString('th-TH', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// ───────────────────────────── inline confirm step ─────────────────────────────

/**
 * Replaces window.confirm for important actions (submit review / approve / reject):
 * the trigger button expands in place into a summary + ยืนยัน/ยกเลิก row, instead of a native
 * or modal dialog. Collapses back on cancel, success, or failure (the caller shows its own error).
 */
export function InlineConfirm({
    label, confirmLabel = 'ยืนยัน', summary, tone = 'primary', disabled, onConfirm, className = '',
}: {
    label: ReactNode;
    confirmLabel?: string;
    summary: ReactNode;
    tone?: 'primary' | 'danger';
    disabled?: boolean;
    onConfirm: () => Promise<void> | void;
    className?: string;
}) {
    const [open, setOpen] = useState(false);
    const [busy, setBusy] = useState(false);

    if (!open) {
        return (
            <Button
                type="button"
                disabled={disabled}
                onClick={() => setOpen(true)}
                variant={tone === 'danger' ? 'outline' : 'default'}
                className={tone === 'danger'
                    ? `border-rose-300 text-rose-600 hover:bg-rose-50 ${className}`
                    : `bg-linear-to-r from-brand-600 to-brand-500 hover:from-brand-700 hover:to-brand-600 text-white shadow-md ${className}`}
            >
                {label}
            </Button>
        );
    }

    return (
        <div className={`flex flex-col gap-2.5 rounded-xl border ${tone === 'danger' ? 'border-rose-200 bg-rose-50/60' : 'border-brand-200 bg-brand-600/5'} p-3.5 ${className}`}>
            <div className="text-sm text-gray-700">{summary}</div>
            <div className="flex items-center justify-end gap-2">
                <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => setOpen(false)}>
                    ยกเลิก
                </Button>
                <Button
                    type="button"
                    size="sm"
                    disabled={busy}
                    onClick={async () => {
                        setBusy(true);
                        try {
                            await onConfirm();
                            setOpen(false);
                        } finally {
                            setBusy(false);
                        }
                    }}
                    className={tone === 'danger'
                        ? 'bg-rose-600 hover:bg-rose-700 text-white'
                        : 'bg-linear-to-r from-brand-600 to-brand-500 hover:from-brand-700 hover:to-brand-600 text-white'}
                >
                    {busy ? <Loader2 className="size-4 animate-spin" /> : confirmLabel}
                </Button>
            </div>
        </div>
    );
}
