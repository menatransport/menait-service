'use client';

import { useRef, useState } from 'react';
import { formatDistanceToNowStrict } from 'date-fns';
import { th } from 'date-fns/locale';
import { ArrowRight, Check, Eye, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { OpsPerson, OpsReview, OpsReviewResult, OpsStatus, OpsStatusChange } from '../types';
import { formatThaiDate } from '../components';
import { PersonAvatar } from './kanban';

type Kind = 'project' | 'issue';

const COPY: Record<Kind, { waiting: string; pass: string; hint: string }> = {
    project: {
        waiting: 'รอตรวจรับงาน',
        pass: 'ผ่านรีวิว',
        hint: 'ลองใช้งานตาม Requirement แล้วบันทึกผล — ผู้รับผิดชอบจะเป็นคนปิดงานเอง',
    },
    issue: {
        waiting: 'รอยืนยันการแก้ไข',
        pass: 'แก้ไขแล้ว ผ่าน',
        hint: 'ลองทำขั้นตอนเดิมที่เคยเกิดปัญหา แล้วบันทึกผล — ผู้รับผิดชอบจะเป็นคนปิดเรื่องเอง',
    },
};

const ago = (iso: string) => formatDistanceToNowStrict(new Date(iso), { addSuffix: true, locale: th });

/**
 * The review that belongs to the current Review round — a review from an earlier round
 * (before the item was sent to Review again) no longer counts.
 */
export const currentReview = (status: OpsStatus, review: OpsReview | null | undefined, history: OpsStatusChange[]) => {
    if (!review) return null;
    if (status !== 'Review') return review;
    const sentAt = history.findLast(h => h.status === 'Review')?.changed_at;
    return !sentAt || review.at >= sentAt ? review : null;
};

const ResultCard = ({ review, justNow, children }: { review: OpsReview; justNow: boolean; children?: React.ReactNode }) => {
    const passed = review.result === 'passed';
    return (
        <section className={cn(
            'rounded-[22px] border px-4.5 py-4',
            passed ? 'border-emerald-200 bg-emerald-50/80' : 'border-orange-200 bg-orange-50/80',
            justNow && 'v2-pop-in',
        )}>
            <div className="flex items-start gap-3">
                <span className={cn(
                    'w-10 h-10 shrink-0 rounded-full text-white grid place-items-center',
                    passed ? 'bg-mint-600 shadow-[0_8px_18px_-8px_rgba(11,138,94,0.7)]' : 'bg-sun-500',
                )}>
                    {passed ? <Check className="w-5 h-5" strokeWidth={3} /> : <RotateCcw className="w-4.5 h-4.5" strokeWidth={2.4} />}
                </span>
                <div className="min-w-0 flex-1">
                    <p className={cn('font-display text-[15px] font-semibold', passed ? 'text-mint-700' : 'text-sun-700')}>
                        {passed ? 'ผ่านรีวิวแล้ว' : 'ส่งกลับแก้ไข'}
                    </p>
                    <div className="flex items-center gap-1.5 text-xs text-ink-500">
                        <PersonAvatar person={review.by} className="w-4.5 h-4.5" textClassName="text-[8px] font-semibold" />
                        <span className="truncate">โดย {review.by.name} · {formatThaiDate(review.at, true)}</span>
                    </div>
                    {review.note && <p className="mt-1.5 text-sm text-ink-700 whitespace-pre-line">“{review.note}”</p>}
                </div>
            </div>
            {children}
        </section>
    );
};

/**
 * Review step in the detail sheet.
 * - Anyone signed in can review; the result is recorded but the status does NOT change.
 * - The responsible team then moves the card themselves (drag, or the button on the result card).
 */
export const ReviewSection = ({ kind, status, review, history, me, canReview, onSubmit, onMove }: {
    kind: Kind;
    status: OpsStatus;
    review?: OpsReview | null;
    history: OpsStatusChange[];
    me: OpsPerson | null;
    canReview: boolean;
    onSubmit: (result: OpsReviewResult, note: string | null) => Promise<boolean>;
    /** OPS team / admin only: move the item on after the review */
    onMove?: (to: OpsStatus) => void;
}) => {
    const [note, setNote] = useState('');
    const [busy, setBusy] = useState<OpsReviewResult | null>(null);
    const [error, setError] = useState('');
    const [justNow, setJustNow] = useState(false);
    const [reopened, setReopened] = useState(false);
    const noteRef = useRef<HTMLTextAreaElement>(null);
    const copy = COPY[kind];
    const active = currentReview(status, review, history);

    // Outside Review: only the outcome that led here is worth showing
    if (status !== 'Review') {
        if (active && ((active.result === 'passed' && status === 'Done') || (active.result === 'changes_requested' && status === 'In Progress'))) {
            return <ResultCard review={active} justNow={false} />;
        }
        return null;
    }

    if (active && !reopened) {
        const passed = active.result === 'passed';
        return (
            <ResultCard review={active} justNow={justNow}>
                <div className="mt-3 pt-3 border-t border-black/5 flex flex-wrap items-center gap-2">
                    <p className="text-xs text-ink-500 flex-1 min-w-40">
                        {onMove
                            ? (passed ? 'ผลรีวิวผ่านแล้ว ปิดงานได้เมื่อพร้อม' : 'ย้ายกลับไปแก้ไข แล้วส่ง Review ใหม่อีกครั้ง')
                            : 'รอผู้รับผิดชอบปรับสถานะ'}
                    </p>
                    {canReview && (
                        <button type="button" onClick={() => setReopened(true)} className="h-9 px-3 rounded-full text-xs font-medium text-ink-700 hover:bg-white/70 cursor-pointer transition-colors">
                            รีวิวใหม่
                        </button>
                    )}
                    {onMove && (
                        <button
                            type="button"
                            onClick={() => onMove(passed ? 'Done' : 'In Progress')}
                            className={cn(
                                'h-9 px-4 rounded-full text-xs font-semibold text-white inline-flex items-center gap-1.5 cursor-pointer active:scale-[0.98] transition-all',
                                passed ? 'bg-mint-600 hover:bg-mint-700' : 'bg-sun-500 hover:bg-sun-700',
                            )}
                        >
                            ย้ายไป {passed ? 'Done' : 'In Progress'} <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                    )}
                </div>
            </ResultCard>
        );
    }

    const sentAt = history.findLast(h => h.status === 'Review')?.changed_at;

    const submit = async (result: OpsReviewResult) => {
        const text = note.trim();
        if (result === 'changes_requested' && !text) {
            setError('กรุณาระบุสิ่งที่ต้องแก้ไข เพื่อให้ทีมทราบ');
            noteRef.current?.focus();
            return;
        }
        setError('');
        setBusy(result);
        const ok = await onSubmit(result, text || null);
        setBusy(null);
        if (ok) { setNote(''); setJustNow(true); setReopened(false); }
    };

    return (
        <section className="rounded-[22px] border border-violet-200 bg-white shadow-soft overflow-hidden">
            <div className="flex items-center gap-3 px-4.5 pt-4 pb-3.5 bg-violet-50/70 border-b border-violet-100">
                <span className="w-10 h-10 shrink-0 rounded-[14px] bg-violet-500 text-white grid place-items-center shadow-[0_8px_18px_-8px_rgba(139,92,246,0.8)]">
                    <Eye className="w-5 h-5" />
                </span>
                <div className="min-w-0 flex-1">
                    <p className="font-display text-[15px] font-semibold text-violet-700">{copy.waiting}</p>
                    {sentAt && <p className="text-xs text-ink-500">ทีมส่งงาน {ago(sentAt)} · {formatThaiDate(sentAt)}</p>}
                </div>
                {reopened && (
                    <button type="button" onClick={() => setReopened(false)} className="h-8 px-3 rounded-full text-xs font-medium text-ink-700 hover:bg-white cursor-pointer">
                        ยกเลิก
                    </button>
                )}
            </div>

            <div className="px-4.5 py-4 space-y-3">
                {canReview && me ? (
                    <>
                        <div className="flex items-center gap-2 text-[11px] text-ink-500">
                            <span>ตรวจรับในชื่อ</span>
                            <PersonAvatar person={me} className="w-5 h-5" textClassName="text-[9px] font-semibold" />
                            <span className="text-[13px] font-medium text-ink-900 truncate">{me.name}</span>
                        </div>
                        <p className="text-xs leading-relaxed text-ink-500">{copy.hint}</p>
                        <div>
                            <label htmlFor="review-note" className="sr-only">หมายเหตุถึงทีม</label>
                            <textarea
                                id="review-note"
                                ref={noteRef}
                                value={note}
                                onChange={(e) => { setNote(e.target.value); if (error) setError(''); }}
                                rows={2}
                                maxLength={2000}
                                placeholder="หมายเหตุถึงทีม (จำเป็นเมื่อส่งกลับแก้ไข)"
                                aria-invalid={Boolean(error)}
                                className={cn(
                                    'w-full field-sizing-content min-h-16 max-h-40 resize-none rounded-xl border bg-brand-50/40 px-3 py-2 text-sm text-ink-900 placeholder:text-ink-300 focus:outline-none focus:bg-white transition-all',
                                    error ? 'border-rose-300 focus:shadow-[0_0_0_4px_rgba(244,63,94,0.12)]' : 'border-border focus:border-violet-300 focus:shadow-[0_0_0_4px_rgba(139,92,246,0.12)]',
                                )}
                            />
                            {error && <p className="mt-1 text-xs text-rose-600">{error}</p>}
                        </div>
                        <div className="flex flex-col-reverse sm:flex-row gap-2">
                            <button
                                type="button"
                                onClick={() => submit('changes_requested')}
                                disabled={busy !== null}
                                className="h-11 px-4 rounded-full border border-orange-200 bg-white text-sm font-semibold text-sun-700 hover:bg-orange-50 disabled:opacity-60 cursor-pointer disabled:cursor-not-allowed inline-flex items-center justify-center gap-2 transition-colors"
                            >
                                {busy === 'changes_requested'
                                    ? <span className="w-4 h-4 rounded-full border-2 border-sun-300 border-t-sun-700 animate-spin" />
                                    : <RotateCcw className="w-4 h-4" />}
                                ส่งกลับแก้ไข
                            </button>
                            <button
                                type="button"
                                onClick={() => submit('passed')}
                                disabled={busy !== null}
                                className="flex-1 h-11 px-5 rounded-full bg-mint-600 hover:bg-mint-700 text-white text-sm font-semibold shadow-[0_8px_18px_-8px_rgba(11,138,94,0.75)] active:scale-[0.98] disabled:opacity-60 cursor-pointer disabled:cursor-not-allowed inline-flex items-center justify-center gap-2 transition-all"
                            >
                                {busy === 'passed'
                                    ? <span className="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                                    : <Check className="w-4.5 h-4.5" strokeWidth={3} />}
                                {copy.pass}
                            </button>
                        </div>
                    </>
                ) : (
                    <p className="rounded-xl bg-violet-50/70 px-3 py-2.5 text-xs text-violet-700">เข้าสู่ระบบเพื่อบันทึกผลรีวิว</p>
                )}
            </div>
        </section>
    );
};

/** Small chip on a Kanban card: waiting / passed / sent back. */
export const ReviewChip = ({ status, review, history }: { status: OpsStatus; review?: OpsReview | null; history: OpsStatusChange[] }) => {
    const active = currentReview(status, review, history);
    if (active?.result === 'passed' && (status === 'Review' || status === 'Done')) {
        return (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-mint-700" title={`โดย ${active.by.name}`}>
                <Check className="w-3 h-3" strokeWidth={3} /> ผ่านรีวิว
            </span>
        );
    }
    if (active?.result === 'changes_requested' && (status === 'Review' || status === 'In Progress')) {
        return (
            <span className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-2 py-0.5 text-[11px] font-medium text-sun-700" title={active.note ?? undefined}>
                <RotateCcw className="w-3 h-3" /> ส่งกลับแก้ไข
            </span>
        );
    }
    if (status === 'Review') {
        return (
            <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-medium text-violet-700">
                <Eye className="w-3 h-3" /> รอตรวจรับ
            </span>
        );
    }
    return null;
};
