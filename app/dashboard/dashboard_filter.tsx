'use client';

import { useState, useEffect, useCallback } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

const THAI_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

const fmtYM = (y: number, m: number) => `${y}-${String(m).padStart(2, '0')}`;

export const currentYM = () => {
    const d = new Date();
    return fmtYM(d.getFullYear(), d.getMonth() + 1);
};

export const labelYM = (ym: string) => {
    const [y, m] = ym.split('-').map(Number);
    if (!y || !m) return ym;
    return `${THAI_MONTHS[m - 1]} ${y + 543}`;
};

const ymToNum = (ym: string) => {
    const [y, m] = ym.split('-').map(Number);
    return (y || 0) * 12 + ((m || 1) - 1);
};

// Build [start..end] inclusive range of YYYY-MM
export const monthsBetween = (start: string, end: string): string[] => {
    const a = ymToNum(start);
    const b = ymToNum(end);
    const [lo, hi] = a <= b ? [a, b] : [b, a];
    const out: string[] = [];
    for (let i = lo; i <= hi; i++) {
        out.push(fmtYM(Math.floor(i / 12), (i % 12) + 1));
    }
    return out;
};

// Get start_date / end_date covering the whole range
export const rangeToDateRange = (start: string, end: string) => {
    const a = ymToNum(start);
    const b = ymToNum(end);
    const [lo, hi] = a <= b ? [start, end] : [end, start];
    const [sy, sm] = lo.split('-').map(Number);
    const [ey, em] = hi.split('-').map(Number);
    const startDate = `${sy}-${String(sm).padStart(2, '0')}-01`;
    const lastDay = new Date(ey, em, 0).getDate();
    const endDate = `${ey}-${String(em).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    return { start_date: startDate, end_date: endDate };
};

export const DashboardFilter = ({
    start,
    end,
    onChange,
}: {
    start: string;
    end: string;
    onChange: (start: string, end: string) => void;
}) => {
    const [open, setOpen] = useState(false);
    const [draftStart, setDraftStart] = useState<string | undefined>(start);
    const [draftEnd, setDraftEnd] = useState<string | undefined>(end);
    const [hover, setHover] = useState<string | null>(null);
    const [viewYear, setViewYear] = useState<number>(Number(end.split('-')[0]) || new Date().getFullYear());

    useEffect(() => {
        if (open) {
            setDraftStart(start);
            setDraftEnd(end);
            setHover(null);
            setViewYear(Number(end.split('-')[0]) || new Date().getFullYear());
        }
    }, [open, start, end]);

    const apply = useCallback((s: string, e: string) => {
        const [a, b] = ymToNum(s) > ymToNum(e) ? [e, s] : [s, e];
        onChange(a, b);
        setOpen(false);
    }, [onChange]);

    const handlePick = (ym: string) => {
        if (!draftStart || (draftStart && draftEnd)) {
            setDraftStart(ym);
            setDraftEnd(undefined);
            return;
        }
        const s = ymToNum(draftStart) > ymToNum(ym) ? ym : draftStart;
        const e = ymToNum(draftStart) > ymToNum(ym) ? draftStart : ym;
        setDraftStart(s);
        setDraftEnd(e);
        apply(s, e);
    };

    // Range highlight (with hover preview)
    const sNum = draftStart ? ymToNum(draftStart) : null;
    const eNum = draftEnd ? ymToNum(draftEnd) : (draftStart && hover ? ymToNum(hover) : null);
    const [lo, hi] = sNum != null && eNum != null
        ? (sNum <= eNum ? [sNum, eNum] : [eNum, sNum])
        : [null, null];

    const buttonLabel = start === end
        ? labelYM(start)
        : `${labelYM(start)} – ${labelYM(end)}`;

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    className="group inline-flex items-center gap-2.5 bg-white/15 hover:bg-white/25 active:bg-white/30 text-white text-sm font-medium rounded-full pl-3 pr-4 py-2 ring-1 ring-white/25 backdrop-blur-md shadow-lg transition-all cursor-pointer hover:shadow-xl hover:-translate-y-0.5"
                >
                    <span className="w-7 h-7 rounded-full bg-white/20 ring-1 ring-white/25 flex items-center justify-center group-hover:bg-white/30 transition-colors">
                        <CalendarIcon className="w-3.5 h-3.5" />
                    </span>
                    <span className="tabular-nums">{buttonLabel}</span>
                    <ChevronRight className={`w-3.5 h-3.5 opacity-70 transition-transform ${open ? 'rotate-90' : ''}`} />
                </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-70 p-3 rounded-2xl shadow-xl border-gray-200">
                <div className="flex items-center justify-between mb-3">
                    <button
                        type="button"
                        onClick={() => setViewYear((y) => y - 1)}
                        className="p-1.5 rounded-full hover:bg-gray-100 cursor-pointer"
                        aria-label="ปีก่อนหน้า"
                    >
                        <ChevronLeft className="w-4 h-4 text-gray-600" />
                    </button>
                    <div className="text-sm font-semibold text-gray-800">พ.ศ. {viewYear + 543}</div>
                    <button
                        type="button"
                        onClick={() => setViewYear((y) => y + 1)}
                        className="p-1.5 rounded-full hover:bg-gray-100 cursor-pointer"
                        aria-label="ปีถัดไป"
                    >
                        <ChevronRight className="w-4 h-4 text-gray-600" />
                    </button>
                </div>

                <div className="grid grid-cols-4 gap-1">
                    {THAI_MONTHS.map((label, i) => {
                        const ym = fmtYM(viewYear, i + 1);
                        const num = ymToNum(ym);
                        const isStart = draftStart === ym;
                        const isEnd = draftEnd === ym;
                        const inRange = lo != null && hi != null && num >= lo && num <= hi;
                        const isEdge = isStart || isEnd;
                        return (
                            <button
                                key={ym}
                                type="button"
                                onClick={() => handlePick(ym)}
                                onMouseEnter={() => setHover(ym)}
                                onMouseLeave={() => setHover(null)}
                                className={[
                                    'py-2 text-xs rounded-md transition-colors cursor-pointer',
                                    isEdge
                                        ? 'bg-teal-600 text-white font-semibold shadow-sm'
                                        : inRange
                                            ? 'bg-teal-100 text-teal-800'
                                            : 'text-gray-700 hover:bg-gray-100',
                                ].join(' ')}
                            >
                                {label}
                            </button>
                        );
                    })}
                </div>

                <div className="mt-3 pt-3 border-t border-gray-100 flex flex-wrap gap-1.5">
                    <button
                        type="button"
                        onClick={() => {
                            const cm = currentYM();
                            apply(cm, cm);
                        }}
                        className="text-[11px] px-2.5 py-1 rounded-full bg-gray-100 hover:bg-teal-100 hover:text-teal-700 text-gray-700 transition-colors cursor-pointer"
                    >
                        เดือนนี้
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            const now = new Date();
                            const e = fmtYM(now.getFullYear(), now.getMonth() + 1);
                            const sd = new Date(now.getFullYear(), now.getMonth() - 2, 1);
                            apply(fmtYM(sd.getFullYear(), sd.getMonth() + 1), e);
                        }}
                        className="text-[11px] px-2.5 py-1 rounded-full bg-gray-100 hover:bg-teal-100 hover:text-teal-700 text-gray-700 transition-colors cursor-pointer"
                    >
                        3 เดือน
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            const now = new Date();
                            const e = fmtYM(now.getFullYear(), now.getMonth() + 1);
                            const sd = new Date(now.getFullYear(), now.getMonth() - 5, 1);
                            apply(fmtYM(sd.getFullYear(), sd.getMonth() + 1), e);
                        }}
                        className="text-[11px] px-2.5 py-1 rounded-full bg-gray-100 hover:bg-teal-100 hover:text-teal-700 text-gray-700 transition-colors cursor-pointer"
                    >
                        6 เดือน
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            const now = new Date();
                            const e = fmtYM(now.getFullYear(), now.getMonth() + 1);
                            const sd = new Date(now.getFullYear(), now.getMonth() - 11, 1);
                            apply(fmtYM(sd.getFullYear(), sd.getMonth() + 1), e);
                        }}
                        className="text-[11px] px-2.5 py-1 rounded-full bg-gray-100 hover:bg-teal-100 hover:text-teal-700 text-gray-700 transition-colors cursor-pointer"
                    >
                        1 ปี
                    </button>
                </div>

                <p className="mt-2 text-[10px] text-gray-400 text-center">
                    {!draftStart || draftEnd ? 'แตะเดือนเริ่มต้น' : 'แตะเดือนสิ้นสุด'}
                </p>
            </PopoverContent>
        </Popover>
    );
};
