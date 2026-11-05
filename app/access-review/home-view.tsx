'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
    ArrowRight, CheckCheck, ChevronRight, Clock, ShieldCheck, User, UserCheck,
} from 'lucide-react';
import { Navbar } from '@/components/navbar';
import { Mascot } from '@/components/mascot';
import Loading from '@/components/loading';
import { WaveBackground } from '@/components/wave-background';
import { useSessionContext } from '@/app/context/SessionContext';
import { getMe, getPending, getHistory } from './api';
import { SYSTEM_META, SystemIcon, formatThaiDate } from './components';
import { ReviewDialog } from './review-dialog';
import type { ApprovalRow, MeResponse } from './types';

const PAGE_TITLE = 'ทบทวนสิทธิ์การใช้งานระบบ';

/** Same shell as /issue: Navbar header + rounded brand panel with the wave background. */
function PageShell({ children }: { children: React.ReactNode }) {
    return (
        <Navbar isHome={false} title={PAGE_TITLE}>
            <main className="flex-1 min-h-0 bg-brand-600 rounded-t-[1.5rem] sm:rounded-t-[2rem] lg:rounded-t-[3rem] shadow-2xl overflow-y-auto relative">
                <WaveBackground />
                <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 z-10 relative">
                    {children}
                </div>
            </main>
        </Navbar>
    );
}

/**
 * "ระบบทบทวนสิทธิ์" home — one white card with a รอการอนุมัติ / เสร็จสิ้นแล้ว toggle and a card
 * feed (no per-system tabs — every system is shown together inside the checklist dialog).
 */
export function AccessReviewHome({ dialogId }: { dialogId: string | null }) {
    const router = useRouter();
    const { loading } = useSessionContext();

    const [me, setMe] = useState<MeResponse | null>(null);
    const [pending, setPending] = useState<ApprovalRow[] | null>(null);
    const [history, setHistory] = useState<ApprovalRow[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [tab, setTab] = useState<'pending' | 'history'>('pending');

    const load = useCallback(() => {
        getMe().then(data => {
            setMe(data);
            setError(null);
            getPending().then(setPending).catch(() => setPending([]));
            getHistory().then(setHistory).catch(() => setHistory([]));
        }).catch(err => setError(err instanceof Error ? err.message : 'โหลดข้อมูลไม่สำเร็จ'));
    }, []);

    useEffect(() => { load(); }, [load]);

    const openDialog = (id: string) => router.push(`/access-review/${id}`);
    const closeDialog = () => router.push('/access-review');

    // The รอการอนุมัติ tab count: my own card (if it still needs attention) plus everything awaiting my approval.
    const mineNeedsAction = Boolean(me?.cycle) && me?.review?.status !== 'approved';
    const pendingCount = (mineNeedsAction ? 1 : 0) + (pending?.length ?? 0);

    if (loading || (!me && !error)) {
        return (
            <PageShell>
                <div className="fixed inset-0 z-9999 flex items-center justify-center v2-loader-overlay">
                    <Loading />
                </div>
            </PageShell>
        );
    }

    if (error || !me) {
        return (
            <PageShell>
                <div className="rounded-2xl sm:rounded-3xl bg-white shadow-xl flex flex-col items-center gap-3 px-6 py-14 text-center">
                    <Mascot size={80} motion="bob" />
                    <p className="text-sm text-ink-700">{error ?? 'โหลดข้อมูลไม่สำเร็จ'}</p>
                </div>
            </PageShell>
        );
    }

    const nothingAtAll = !me.cycle && !me.is_admin && (pending?.length ?? 0) === 0 && (history?.length ?? 0) === 0;
    const tabs = [
        { key: 'pending' as const, label: 'รอการอนุมัติ', icon: Clock, count: pendingCount },
        { key: 'history' as const, label: 'เสร็จสิ้นแล้ว', icon: CheckCheck, count: history?.length ?? 0 },
    ];

    return (
        <PageShell>
            <div className="rounded-2xl sm:rounded-3xl bg-white shadow-xl overflow-hidden">
                <div className="p-4 sm:p-6 lg:p-8">
                    {/* header — same pattern as the /issue form header */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-gray-200">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-linear-to-br from-brand-600 to-brand-500 rounded-xl flex items-center justify-center shadow-md">
                                <ShieldCheck className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <h2 className="text-xl font-semibold text-brand-800 mb-1">ทบทวนสิทธิ์การใช้งาน</h2>
                                <p className="text-xs text-gray-500">ตรวจสอบและยืนยันสิทธิ์ ATMS, Winspeed และ Group Mail ของคุณ</p>
                            </div>
                        </div>
                    </div>

                    {nothingAtAll ? (
                        <div className="py-12 flex flex-col items-center text-center gap-3">
                            <Mascot size={80} />
                            <p className="text-sm font-medium text-ink-700">ไม่มีสิทธิ์ที่ต้องทบทวน</p>
                            <p className="text-xs text-ink-400">ระบบจะแจ้งเมื่อมีรอบทบทวนใหม่</p>
                        </div>
                    ) : (
                        <>
                            <div role="tablist" className="mt-4 mb-5 inline-flex rounded-xl bg-gray-100 p-1 gap-1">
                                {tabs.map(t => (
                                    <button
                                        key={t.key}
                                        type="button"
                                        role="tab"
                                        aria-selected={tab === t.key}
                                        onClick={() => setTab(t.key)}
                                        className={`inline-flex items-center gap-1.5 rounded-lg px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium transition-colors cursor-pointer ${tab === t.key ? 'bg-white text-brand-700 shadow-sm' : 'text-gray-500 hover:text-ink-700'}`}
                                    >
                                        <t.icon className="size-4" /> {t.label}
                                        <span className={`rounded-full px-1.5 text-[11px] font-bold tabular-nums ${tab === t.key ? 'bg-brand-50 text-brand-700' : 'bg-gray-200 text-gray-500'}`}>{t.count}</span>
                                    </button>
                                ))}
                            </div>

                            {tab === 'pending' ? (
                                <PendingSection me={me} pending={pending} mineNeedsAction={mineNeedsAction} onOpen={openDialog} />
                            ) : (
                                <HistorySection history={history} onOpen={openDialog} />
                            )}
                        </>
                    )}
                </div>
            </div>

            {dialogId && <ReviewDialog dialogId={dialogId} onClose={closeDialog} onChanged={load} />}
        </PageShell>
    );
}

// ───────────────────────────── card feed ─────────────────────────────
// Two looks on purpose: my own review is one highlighted card with a clear call to action;
// reviews I approve (and history) are compact person rows, so the two never get mixed up.

const CARD_STATUS: Record<string, { label: string; cls: string }> = {
    not_submitted: { label: 'รอตรวจสอบ', cls: 'border-amber-200 bg-amber-50 text-amber-700' },
    draft: { label: 'รอตรวจสอบ', cls: 'border-amber-200 bg-amber-50 text-amber-700' },
    pending: { label: 'รออนุมัติ', cls: 'border-amber-200 bg-amber-50 text-amber-700' },
    approved: { label: 'อนุมัติแล้ว', cls: 'border-emerald-200 bg-emerald-50 text-mint-700' },
    rejected: { label: 'ไม่อนุมัติ', cls: 'border-rose-200 bg-rose-50 text-rose-700' },
};

function StatusChip({ statusKey }: { statusKey: string }) {
    const status = CARD_STATUS[statusKey] ?? CARD_STATUS.draft;
    return (
        <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap ${status.cls}`}>
            <span className="size-1.5 rounded-full bg-current" /> {status.label}
        </span>
    );
}

const MY_CTA: Record<string, string> = {
    not_submitted: 'ตรวจสอบและยืนยันสิทธิ์',
    draft: 'ตรวจสอบและยืนยันสิทธิ์',
    rejected: 'แก้ไขและส่งใหม่',
    pending: 'ดูคำขอของฉัน',
};

function MyReviewCard({ me, onOpen }: { me: MeResponse; onOpen: () => void }) {
    const statusKey = me.review?.status ?? 'not_submitted';
    const systems = me.systems.filter(s => s.roles.length > 0);
    const nextApprovers = me.review?.status === 'pending' ? me.review.next_approver_names ?? [] : [];
    const rejectReason = me.review?.status === 'rejected' ? me.review.comment : null;

    return (
        <div className="rounded-2xl border border-brand-200 bg-linear-to-br from-brand-50 to-white p-4 sm:p-5">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <span className="inline-flex items-center gap-1 rounded-full bg-brand-600 px-2.5 py-0.5 text-[11px] font-semibold text-white">
                        <User className="size-3" /> สิทธิ์ของฉัน
                    </span>
                    <p className="mt-2 text-base sm:text-lg font-semibold text-ink-900">ยืนยันสิทธิ์การเข้าถึงของคุณ</p>
                    {me.cycle && (
                        <p className="text-xs text-gray-500 mt-0.5">{me.cycle.name} · ภายใน {formatThaiDate(me.cycle.end_date)}</p>
                    )}
                </div>
                <StatusChip statusKey={statusKey} />
            </div>

            {systems.length > 0 && (
                <div className="mt-4 grid gap-2 sm:grid-cols-3">
                    {systems.map(s => (
                        <div key={s.code} className="rounded-xl border border-gray-200 bg-white px-3 py-2.5">
                            <div className="flex items-center gap-1.5 text-xs font-semibold text-brand-700">
                                <SystemIcon code={s.code} className="size-3.5" /> {SYSTEM_META[s.code]?.label ?? s.name}
                            </div>
                            <p className="mt-1 text-xs text-gray-600 line-clamp-2">
                                {s.code === 'EMAIL' ? `${s.roles.length} กลุ่ม` : s.roles.map(r => r.role_name).join(', ')}
                            </p>
                        </div>
                    ))}
                </div>
            )}

            {nextApprovers.length > 0 && (
                <p className="mt-3 flex items-center gap-1.5 text-xs text-gray-600">
                    <UserCheck className="size-3.5 text-gray-400" /> รออนุมัติจาก {nextApprovers.join(', ')}
                </p>
            )}
            {rejectReason && (
                <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                    <span className="font-semibold">เหตุผลที่ไม่อนุมัติ:</span> {rejectReason}
                </div>
            )}

            <button
                type="button"
                onClick={onOpen}
                className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 transition-colors cursor-pointer"
            >
                {MY_CTA[statusKey] ?? 'ดูรายละเอียด'} <ArrowRight className="size-4" />
            </button>
        </div>
    );
}

function Avatar({ name, imageUrl }: { name: string; imageUrl: string | null }) {
    if (imageUrl) {
        // eslint-disable-next-line @next/next/no-img-element
        return <img src={imageUrl} alt={name} referrerPolicy="no-referrer" loading="lazy" className="size-10 rounded-full object-cover shrink-0" />;
    }
    return (
        <span className="size-10 rounded-full bg-gray-100 text-gray-500 text-sm font-semibold flex items-center justify-center shrink-0">
            {name.trim().charAt(0) || '?'}
        </span>
    );
}

function RequestRow({ row, meta, onOpen }: { row: ApprovalRow; meta: string; onOpen: () => void }) {
    const notUsed = row.remove_count + row.unchecked_count;
    return (
        <button
            type="button"
            onClick={onOpen}
            className="group flex w-full items-center gap-3 rounded-xl border border-gray-200 bg-white px-3 py-3 text-left hover:border-brand-300 hover:bg-brand-50/40 transition-colors cursor-pointer"
        >
            <Avatar name={row.requester.name} imageUrl={row.requester.image_url} />
            <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-ink-900">{row.requester.name}</p>
                <p className="truncate text-xs text-gray-500">
                    <span className="font-mono">{row.requester.employee_id}</span>
                    {row.requester.department ? ` · ${row.requester.department}` : ''}
                </p>
                <p className="mt-0.5 truncate text-xs text-gray-500">
                    {row.total_lines} สิทธิ์{notUsed > 0 ? <span className="text-rose-600"> · ไม่ใช้ {notUsed}</span> : ''} · {meta}
                </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
                <StatusChip statusKey={row.status} />
                <ChevronRight className="size-4 text-gray-300 group-hover:text-brand-600" />
            </div>
        </button>
    );
}

function SectionLabel({ children, count }: { children: React.ReactNode; count?: number }) {
    return (
        <p className="flex items-center gap-1.5 text-xs font-semibold text-gray-500">
            {children}
            {count != null && <span className="rounded-full bg-gray-100 px-1.5 text-[11px] tabular-nums">{count}</span>}
        </p>
    );
}

function PendingSection({ me, pending, mineNeedsAction, onOpen }: { me: MeResponse; pending: ApprovalRow[] | null; mineNeedsAction: boolean; onOpen: (id: string) => void }) {
    if (pending === null) {
        return <div className="flex justify-center py-10"><Mascot size={64} motion="hop" /></div>;
    }

    const showMine = mineNeedsAction && Boolean(me.cycle);
    if (!showMine && pending.length === 0) {
        return <p className="py-8 text-center text-sm text-gray-400">ไม่มีรายการรออนุมัติ</p>;
    }

    return (
        <div className="space-y-5">
            {showMine && <MyReviewCard me={me} onOpen={() => onOpen('me')} />}

            {pending.length > 0 && (
                <div className="space-y-2">
                    <SectionLabel count={pending.length}>รอคุณอนุมัติ</SectionLabel>
                    {pending.map(row => (
                        <RequestRow
                            key={row.id}
                            row={row}
                            meta={`ส่งเมื่อ ${formatThaiDate(row.submitted_at)}`}
                            onOpen={() => onOpen(String(row.id))}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

function HistorySection({ history, onOpen }: { history: ApprovalRow[] | null; onOpen: (id: string) => void }) {
    if (history === null) {
        return <div className="flex justify-center py-10"><Mascot size={64} motion="hop" /></div>;
    }

    if (history.length === 0) {
        return <p className="py-8 text-center text-sm text-gray-400">ยังไม่มีรายการที่เสร็จสิ้น</p>;
    }

    return (
        <div className="space-y-2">
            {history.map(row => (
                <RequestRow
                    key={row.id}
                    row={row}
                    meta={`${formatThaiDate(row.decided_at)}${row.decided_by_name ? ` โดย ${row.decided_by_name}` : ''}`}
                    onOpen={() => onOpen(String(row.id))}
                />
            ))}
        </div>
    );
}
