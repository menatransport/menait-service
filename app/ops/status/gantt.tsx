'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
    addDays, differenceInCalendarDays, eachMonthOfInterval, endOfMonth, format, startOfDay, startOfMonth,
} from 'date-fns';
import { th } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { OPS_STATUSES, type Project } from '../types';
import { REJECT_HATCH, STATUS_META, StatusBadge, formatThaiDate, isOverdue } from '../components';

export type GanttZoom = 'month' | 'quarter';
const PX_PER_DAY: Record<GanttZoom, number> = { month: 5, quarter: 2 };
const ROW_H = 'h-14';

type Span = { start: Date; end: Date; kind: 'planned' | 'requested' | 'rejected' | 'pending' };

const toDay = (iso: string) => startOfDay(new Date(iso));

/** Where the bar sits: the admin plan when there is one, otherwise what we know from the request. */
function spanOf(p: Project): Span {
    const created = toDay(p.created_at);
    if (p.planned_start && p.planned_end) return { start: toDay(p.planned_start), end: toDay(p.planned_end), kind: 'planned' };
    if (p.status === 'Reject') {
        const at = p.status_history.findLast(h => h.status === 'Reject')?.changed_at;
        return { start: created, end: at ? toDay(at) : created, kind: 'rejected' };
    }
    if (p.target_date) return { start: created, end: toDay(p.target_date), kind: 'requested' };
    return { start: created, end: created, kind: 'pending' };
}

const ORDER = Object.fromEntries(OPS_STATUSES.map((s, i) => [s, i]));

export function GanttChart({ projects, zoom, onOpen }: {
    projects: Project[]; zoom: GanttZoom; onOpen: (p: Project) => void;
}) {
    const scrollRef = useRef<HTMLDivElement>(null);
    const [tip, setTip] = useState<{ p: Project; span: Span; x: number; y: number } | null>(null);
    const px = PX_PER_DAY[zoom];
    const today = startOfDay(new Date());

    const rows = useMemo(() => projects
        .map(p => ({ p, span: spanOf(p) }))
        // Rejected rows sink to the bottom; the rest run in start order
        .sort((a, b) => Number(a.p.status === 'Reject') - Number(b.p.status === 'Reject')
            || a.span.start.getTime() - b.span.start.getTime()
            || ORDER[a.p.status] - ORDER[b.p.status]),
    [projects]);

    const { rangeStart, months, totalW } = useMemo(() => {
        const dates = rows.flatMap(r => [r.span.start, r.span.end, ...(r.p.target_date ? [toDay(r.p.target_date)] : [])]);
        dates.push(today);
        const min = startOfMonth(new Date(Math.min(...dates.map(d => d.getTime()))));
        const max = endOfMonth(addDays(new Date(Math.max(...dates.map(d => d.getTime()))), 20));
        const ms = eachMonthOfInterval({ start: min, end: max });
        return { rangeStart: min, months: ms, totalW: (differenceInCalendarDays(max, min) + 1) * px };
        // `today` only changes across midnight — not worth recomputing for
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [rows, px]);

    const x = (d: Date) => differenceInCalendarDays(d, rangeStart) * px;
    const todayX = x(today);

    // Open on "today" rather than on the oldest project
    useEffect(() => {
        const el = scrollRef.current;
        if (el) el.scrollLeft = Math.max(0, todayX - el.clientWidth / 3);
    }, [todayX]);

    const gridLines = months.map(m => <span key={m.getTime()} className="absolute inset-y-0 w-px bg-gray-100" style={{ left: x(m) }} />);
    const todayLine = <span className="absolute inset-y-0 w-0.5 bg-brand-600/70 z-[1]" style={{ left: todayX }} />;

    if (rows.length === 0) {
        return <p className="rounded-2xl bg-white p-10 text-center text-sm text-gray-500 shadow-card">ไม่มีโปรเจกต์ให้แสดงบนไทม์ไลน์</p>;
    }

    return (
        <div className="rounded-2xl bg-white shadow-card border border-white overflow-hidden">
            <div ref={scrollRef} className="overflow-x-auto" onScroll={() => setTip(null)}>
                <div style={{ width: `calc(var(--gantt-left) + ${totalW}px)` }} className="[--gantt-left:10rem] sm:[--gantt-left:17rem]">

                    {/* header */}
                    <div className="flex bg-white border-b border-gray-100">
                        <div className="sticky left-0 z-20 w-(--gantt-left) shrink-0 bg-white border-r border-gray-100 px-3 flex items-end pb-2 text-xs font-semibold text-gray-500">
                            โปรเจกต์
                        </div>
                        <div className="relative h-11" style={{ width: totalW }}>
                            {months.map(m => (
                                <div key={m.getTime()} className="absolute top-0 h-full border-l border-gray-100 px-2 pt-1.5"
                                    style={{ left: x(m), width: (differenceInCalendarDays(endOfMonth(m), m) + 1) * px }}>
                                    <span className="text-xs font-medium text-gray-600 whitespace-nowrap">
                                        {format(m, zoom === 'month' ? 'MMMM yy' : 'MMM yy', { locale: th })}
                                    </span>
                                </div>
                            ))}
                            <span className="absolute bottom-1 -translate-x-1/2 rounded-full bg-brand-600 px-1.5 text-[10px] font-semibold text-white z-[2]" style={{ left: todayX }}>
                                วันนี้
                            </span>
                        </div>
                    </div>

                    {/* rows */}
                    {rows.map(({ p, span }) => {
                        const m = STATUS_META[p.status];
                        const left = x(span.start);
                        const width = Math.max(x(span.end) - left + px, 8);
                        const overdue = isOverdue(p);
                        const targetX = p.target_date ? x(toDay(p.target_date)) + px / 2 : -Infinity;
                        const fill = span.kind === 'planned' ? (p.status === 'Done' ? 100 : p.progress ?? 0) : 0;
                        const label = span.kind === 'pending' ? 'รอวางแผน'
                            : span.kind === 'requested' ? 'ยังไม่วางแผน'
                                : p.status === 'In Progress' && p.progress != null ? `${p.progress}%`
                                    : m.label;
                        return (
                            <div key={p.project_id} className="flex border-b border-gray-50 last:border-b-0 group">
                                <button
                                    type="button"
                                    onClick={() => onOpen(p)}
                                    className={cn('sticky left-0 z-[5] w-(--gantt-left) shrink-0 bg-white group-hover:bg-brand-50 border-r border-gray-100 px-3 text-left cursor-pointer flex flex-col justify-center min-w-0', ROW_H)}
                                >
                                    <span className="text-sm font-medium text-gray-800 truncate">{p.title}</span>
                                    <span className="flex items-center gap-1.5 mt-0.5">
                                        <span className="hidden sm:inline font-mono text-[10px] text-gray-400">{p.project_id}</span>
                                        <StatusBadge status={p.status} className="text-[10px] px-1.5 py-0" />
                                    </span>
                                </button>

                                <div className={cn('relative group-hover:bg-brand-50/40', ROW_H)} style={{ width: totalW }}>
                                    {gridLines}
                                    {todayLine}

                                    <button
                                        type="button"
                                        onClick={() => onOpen(p)}
                                        onMouseMove={(e) => setTip({ p, span, x: e.clientX, y: e.clientY })}
                                        onMouseLeave={() => setTip(null)}
                                        aria-label={`${p.title} ${formatThaiDate(span.start.toISOString())} – ${formatThaiDate(span.end.toISOString())}`}
                                        // padded hit-area larger than the 20px bar
                                        className="absolute top-1/2 -translate-y-1/2 h-9 flex items-center cursor-pointer z-[2]"
                                        style={{ left, width }}
                                    >
                                        <span
                                            className={cn(
                                                'relative block h-5 w-full rounded overflow-hidden',
                                                span.kind === 'planned' && m.track,
                                                span.kind === 'requested' && 'border-2 border-dashed border-slate-400 bg-slate-50',
                                                span.kind === 'pending' && 'bg-slate-400 rounded-full',
                                                span.kind === 'rejected' && 'border border-rose-400 bg-rose-50',
                                                overdue && 'ring-2 ring-rose-500 ring-offset-1',
                                            )}
                                            style={span.kind === 'rejected' ? REJECT_HATCH : undefined}
                                        >
                                            {fill > 0 && <span className={cn('absolute inset-y-0 left-0 rounded', m.bar)} style={{ width: `${fill}%` }} />}
                                        </span>
                                    </button>

                                    {/* label sits after the bar or the target diamond, whichever is further right */}
                                    <span
                                        className={cn('absolute top-1/2 -translate-y-1/2 whitespace-nowrap text-[11px] font-medium pointer-events-none z-[2]', overdue ? 'text-rose-600' : 'text-gray-600')}
                                        style={{ left: Math.max(left + width, targetX + 6) + 8 }}
                                    >
                                        {label}{overdue && ' · เลยกำหนด'}
                                    </span>

                                    {/* requested go-live date */}
                                    {p.target_date && (
                                        <span
                                            title={`ต้องการใช้งาน ${formatThaiDate(p.target_date)}`}
                                            className="absolute top-1/2 w-2.5 h-2.5 -translate-x-1/2 -translate-y-1/2 rotate-45 bg-sun-500 ring-2 ring-white z-[3] pointer-events-none"
                                            style={{ left: targetX }}
                                        />
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {tip && <GanttTooltip {...tip} />}
        </div>
    );
}

const GanttTooltip = ({ p, span, x, y }: { p: Project; span: Span; x: number; y: number }) => {
    const days = differenceInCalendarDays(span.end, span.start) + 1;
    const flip = typeof window !== 'undefined' && x > window.innerWidth - 280;
    return (
        <div
            role="tooltip"
            className="fixed z-[100] w-64 rounded-xl bg-white p-3 text-xs shadow-lift border border-gray-100 pointer-events-none"
            style={{ top: y + 14, left: flip ? x - 268 : x + 14 }}
        >
            <p className="font-mono text-[10px] text-gray-400">{p.project_id}</p>
            <p className="font-semibold text-gray-800 leading-snug">{p.title}</p>
            <div className="mt-2 space-y-1 text-gray-600">
                <p className="flex justify-between gap-2"><span className="text-gray-400 shrink-0">สถานะ</span><StatusBadge status={p.status} /></p>
                <p className="flex justify-between gap-2">
                    <span className="text-gray-400 shrink-0">{span.kind === 'planned' ? 'แผนงาน' : 'ช่วงที่ขอ'}</span>
                    <span>{span.kind === 'pending' ? 'ยังไม่วางแผน' : `${formatThaiDate(span.start.toISOString())} – ${formatThaiDate(span.end.toISOString())} (${days} วัน)`}</span>
                </p>
                {p.progress != null && span.kind === 'planned' && (
                    <p className="flex justify-between"><span className="text-gray-400 shrink-0">ความคืบหน้า</span><span className="font-medium text-gray-800">{p.progress}%</span></p>
                )}
                <p className="flex justify-between gap-2"><span className="text-gray-400 shrink-0">ผู้รับผิดชอบ</span><span>{p.assignees.map(a => a.name).join(', ') || '-'}</span></p>
                {isOverdue(p) && <p className="text-rose-600 font-medium">เลยกำหนดแผน</p>}
            </div>
        </div>
    );
};

/** Key for the Gantt marks; statuses always appear with their icon + label. */
export const GanttLegend = () => (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] text-gray-600">
        {OPS_STATUSES.map(s => <StatusBadge key={s} status={s} />)}
        <span className="inline-flex items-center gap-1.5"><span className="w-6 h-3 rounded border-2 border-dashed border-slate-400 bg-slate-50" />ยังไม่วางแผน (ช่วงที่ขอ)</span>
        <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rotate-45 bg-sun-500" />วันที่ต้องการใช้งาน</span>
        <span className="inline-flex items-center gap-1.5"><span className="w-0.5 h-3.5 bg-brand-600" />วันนี้</span>
        <span className="inline-flex items-center gap-1.5"><span className="w-6 h-3 rounded bg-amber-200 ring-2 ring-rose-500 ring-offset-1" />เลยกำหนด</span>
    </div>
);
