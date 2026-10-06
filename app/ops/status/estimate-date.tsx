'use client';

import { useState } from 'react';
import { differenceInCalendarDays, format, startOfDay } from 'date-fns';
import { th } from 'date-fns/locale';
import { CalendarCheck2, CalendarPlus, Pencil, X } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

const toISODate = (d: Date) => format(d, 'yyyy-MM-dd');
const parse = (v?: string | null) => (v ? startOfDay(new Date(v)) : undefined);

/** "อีก 12 วัน" / "วันนี้" / "เลยกำหนด 3 วัน" */
const relative = (date: Date, today: Date) => {
    const d = differenceInCalendarDays(date, today);
    if (d === 0) return { text: 'ครบกำหนดวันนี้', late: false };
    return d > 0 ? { text: `อีก ${d} วัน`, late: false } : { text: `เลยกำหนด ${-d} วัน`, late: true };
};

/**
 * Estimated completion date (planned_end) on the assignee side of the detail sheet.
 * Read-only unless `onChange` is given.
 */
export const EstimateDate = ({ value, targetDate, onChange, label = 'คาดว่าจะเสร็จ' }: {
    value?: string | null;
    /** Tile + popover heading; tasks use กำหนดเสร็จ */
    label?: string;
    /** Requester's wished go-live date — marked on the calendar and compared against */
    targetDate?: string | null;
    onChange?: (date: string | null) => void;
}) => {
    const [open, setOpen] = useState(false);
    const today = startOfDay(new Date());
    const selected = parse(value);
    const target = parse(targetDate);
    const rel = selected && relative(selected, today);

    const pick = (d?: Date | null) => {
        onChange?.(d ? toISODate(d) : null);
        setOpen(false);
    };

    // Option A tile: calendar badge · label · date · relative days
    const tile = (editable: boolean) => (
        <span className="flex items-center gap-2.5 min-w-0 w-full">
            <span className={cn('w-8 h-8 shrink-0 rounded-[10px] grid place-items-center', selected ? 'bg-white text-brand-600' : 'bg-white text-brand-400')}>
                {selected ? <CalendarCheck2 className="w-4 h-4" /> : <CalendarPlus className="w-4 h-4" />}
            </span>
            <span className="flex flex-col min-w-0 flex-1">
                <span className="text-[11px] text-ink-500">{label}</span>
                {selected ? (
                    <>
                        <span className="text-sm font-semibold text-ink-900">{format(selected, 'd MMM yyyy', { locale: th })}</span>
                        <span className={cn('text-[11px]', rel?.late ? 'text-rose-600 font-medium' : 'text-mint-700')}>{rel?.text}</span>
                    </>
                ) : (
                    <span className={cn('text-sm font-semibold', editable ? 'text-brand-600' : 'text-ink-500')}>
                        {editable ? 'กำหนดวันเสร็จ' : 'ยังไม่กำหนด'}
                    </span>
                )}
            </span>
            {editable && selected && <Pencil className="w-3.5 h-3.5 text-ink-500 shrink-0" />}
        </span>
    );
    const tileClass = 'w-full text-left rounded-[14px] border px-3 py-2.5';

    if (!onChange) {
        return <div className={cn(tileClass, 'border-border bg-brand-50/70')}>{tile(false)}</div>;
    }

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    aria-label={`${selected ? 'แก้ไข' : 'ตั้ง'}วันที่${label}`}
                    className={cn(
                        tileClass,
                        'cursor-pointer transition-all hover:shadow-card',
                        selected ? 'border-border bg-brand-50/70 hover:border-brand-300' : 'border-dashed border-brand-300 bg-brand-50/40 hover:border-brand-600',
                    )}
                >
                    {tile(true)}
                </button>
            </PopoverTrigger>
            <PopoverContent align="end" sideOffset={6} className="w-auto p-0 rounded-2xl border-border shadow-card overflow-hidden">
                <div className="px-4 pt-3.5 pb-2.5 border-b border-gray-100">
                    <p className="text-sm font-semibold text-ink-900">วันที่{label}</p>
                    <p className="text-[11px] text-ink-500">เลือกวันในปฏิทิน หรือกดปุ่มลัดด้านล่าง</p>
                </div>
                <Calendar
                    mode="single"
                    locale={th}
                    selected={selected}
                    defaultMonth={selected ?? today}
                    disabled={{ before: today }}
                    onSelect={(d) => d && pick(d)}
                    modifiers={target ? { target } : undefined}
                    modifiersClassNames={{ target: 'relative after:absolute after:bottom-1 after:left-1/2 after:-translate-x-1/2 after:w-1.5 after:h-1.5 after:rotate-45 after:bg-sun-500' }}
                />
                <div className="flex items-center gap-3 px-4 py-2.5 border-t border-gray-100 text-[11px] text-ink-500">
                    {target && (
                        <span className="inline-flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rotate-45 bg-sun-500" />
                            ผู้ยื่นต้องการ {format(target, 'd MMM', { locale: th })}
                        </span>
                    )}
                    {selected && (
                        <button
                            type="button"
                            onClick={() => pick(null)}
                            className="ml-auto inline-flex items-center gap-1 rounded-full px-2 py-1 hover:bg-rose-50 hover:text-rose-600 transition-colors cursor-pointer"
                        >
                            <X className="w-3 h-3" /> ล้างวันที่
                        </button>
                    )}
                </div>
            </PopoverContent>
        </Popover>
    );
};

