'use client';
import { useState, useCallback, useEffect } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";

// ===================== MONTH RANGE FILTER =====================
export const THAI_MONTHS_SHORT = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

export const parseYM = (ym?: string): { y: number; m: number } | null => {
    if (!ym) return null;
    const [y, m] = ym.split('-').map(Number);
    if (!y || !m) return null;
    return { y, m };
};
export const fmtYM = (y: number, m: number) => `${y}-${String(m).padStart(2, '0')}`;
export const ymToNum = (ym: string) => {
    const p = parseYM(ym);
    return p ? p.y * 12 + (p.m - 1) : 0;
};
export const formatMonthLabel = (ym?: string) => {
    const p = parseYM(ym);
    if (!p) return '';
    return `${THAI_MONTHS_SHORT[p.m - 1]} ${(p.y + 543).toString().slice(-2)}`;
};
export const shiftMonths = (months: number) => {
    const now = new Date();
    const d = new Date(now.getFullYear(), now.getMonth() - months, 1);
    return fmtYM(d.getFullYear(), d.getMonth() + 1);
};
export const currentMonth = () => {
    const now = new Date();
    return fmtYM(now.getFullYear(), now.getMonth() + 1);
};

export const PRESETS: { label: string; getRange: () => { start: string; end: string } }[] = [
    { label: 'เดือนนี้', getRange: () => ({ start: currentMonth(), end: currentMonth() }) },
    { label: '3 เดือน', getRange: () => ({ start: shiftMonths(2), end: currentMonth() }) },
    { label: '6 เดือน', getRange: () => ({ start: shiftMonths(5), end: currentMonth() }) },
    { label: '1 ปี', getRange: () => ({ start: shiftMonths(11), end: currentMonth() }) },
];

export const MonthRangeFilter = ({
    startMonth,
    endMonth,
    onChange,
}: {
    startMonth?: string;
    endMonth?: string;
    onChange?: (startMonth: string, endMonth: string) => void;
}) => {
    const [open, setOpen] = useState(false);
    const [draftStart, setDraftStart] = useState<string | undefined>(startMonth);
    const [draftEnd, setDraftEnd] = useState<string | undefined>(endMonth);
    const [hover, setHover] = useState<string | null>(null);
    const [viewYear, setViewYear] = useState<number>(parseYM(endMonth)?.y ?? new Date().getFullYear());

    // Sync drafts when popover opens or external props change
    useEffect(() => {
        if (open) {
            setDraftStart(startMonth);
            setDraftEnd(endMonth);
            setHover(null);
            setViewYear(parseYM(endMonth)?.y ?? new Date().getFullYear());
        }
    }, [open, startMonth, endMonth]);

    const apply = useCallback((s: string, e: string) => {
        const [a, b] = ymToNum(s) > ymToNum(e) ? [e, s] : [s, e];
        onChange?.(a, b);
        setOpen(false);
    }, [onChange]);

    const handleMonthClick = (ym: string) => {
        // If no start yet, or both already set -> begin new range
        if (!draftStart || (draftStart && draftEnd)) {
            setDraftStart(ym);
            setDraftEnd(undefined);
            return;
        }
        // Have start, no end -> set end and apply
        const s = ymToNum(draftStart) > ymToNum(ym) ? ym : draftStart;
        const e = ymToNum(draftStart) > ymToNum(ym) ? draftStart : ym;
        setDraftStart(s);
        setDraftEnd(e);
        apply(s, e);
    };

    const applyPreset = (p: typeof PRESETS[number]) => {
        const { start, end } = p.getRange();
        setDraftStart(start);
        setDraftEnd(end);
        apply(start, end);
    };

    // Range checks for cell highlighting (include hover preview)
    const sNum = draftStart ? ymToNum(draftStart) : null;
    const eNum = draftEnd ? ymToNum(draftEnd) : (draftStart && hover ? ymToNum(hover) : null);
    const [lo, hi] = sNum != null && eNum != null
        ? (sNum <= eNum ? [sNum, eNum] : [eNum, sNum])
        : [null, null];

    const buttonLabel = startMonth && endMonth
        ? (startMonth === endMonth
            ? formatMonthLabel(startMonth)
            : `${formatMonthLabel(startMonth)} – ${formatMonthLabel(endMonth)}`)
        : 'เลือกช่วงเดือน';

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    className="inline-flex items-center gap-2 bg-teal-800/10 hover:bg-teal-500/20 text-white text-xs sm:text-sm font-medium rounded-full px-3 sm:px-4 py-2 ring-1 ring-white/20 transition-all cursor-pointer mb-6"
                >
                    <CalendarIcon className="w-4 h-4 opacity-90" />
                    <span>{buttonLabel}</span>
                </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-70 p-3 rounded-2xl shadow-xl border-gray-200">
                {/* Year navigator */}
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

                {/* Month grid 4x3 */}
                <div className="grid grid-cols-4 gap-1">
                    {THAI_MONTHS_SHORT.map((label, i) => {
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
                                onClick={() => handleMonthClick(ym)}
                                onMouseEnter={() => setHover(ym)}
                                onMouseLeave={() => setHover(null)}
                                className={[
                                    "py-2 text-xs rounded-md transition-colors cursor-pointer",
                                    isEdge
                                        ? "bg-teal-600 text-white font-semibold shadow-sm"
                                        : inRange
                                            ? "bg-teal-100 text-teal-800"
                                            : "text-gray-700 hover:bg-gray-100",
                                ].join(' ')}
                            >
                                {label}
                            </button>
                        );
                    })}
                </div>

                {/* Presets */}
                <div className="mt-3 pt-3 border-t border-gray-100 flex flex-wrap gap-1.5">
                    {PRESETS.map((p) => (
                        <button
                            key={p.label}
                            type="button"
                            onClick={() => applyPreset(p)}
                            className="text-[11px] px-2.5 py-1 rounded-full bg-gray-100 hover:bg-teal-100 hover:text-teal-700 text-gray-700 transition-colors cursor-pointer"
                        >
                            {p.label}
                        </button>
                    ))}
                </div>

                {/* Helper text */}
                <p className="mt-2 text-[10px] text-gray-400 text-center">
                    {!draftStart || draftEnd ? 'แตะเดือนเริ่มต้น' : 'แตะเดือนสิ้นสุด'}
                </p>
            </PopoverContent>
        </Popover>
    );
};
