'use client';

import { Check, ChevronDown, UserRound, UserX, Users } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import type { OpsPerson } from '../types';
import { PersonAvatar } from './kanban';

/** Filter value for items nobody is assigned to yet */
export const UNASSIGNED = '__unassigned__';

/** No selection = everything; otherwise anyone selected is on it (or it is unassigned and that option is on). */
export const matchesAssignees = (people: OpsPerson[], selected: string[]) =>
    selected.length === 0
    || (people.length === 0
        ? selected.includes(UNASSIGNED)
        : people.some(p => p.username && selected.includes(p.username)));

/** Toolbar pill: multi-select of the OPS team plus "ยังไม่มอบหมาย". */
export const AssigneeFilter = ({ team, value, onChange, me }: {
    team: OpsPerson[];
    /** usernames, and/or UNASSIGNED */
    value: string[];
    onChange: (next: string[]) => void;
    me?: OpsPerson | null;
}) => {
    const active = value.length > 0;
    const picked = team.filter(t => t.username && value.includes(t.username));
    const unassignedOn = value.includes(UNASSIGNED);
    const toggle = (key: string) => onChange(value.includes(key) ? value.filter(v => v !== key) : [...value, key]);
    const label = !active ? 'ผู้รับผิดชอบ'
        : picked.length === 1 && !unassignedOn ? picked[0].name.split(' ')[0]
            : `${value.length} ตัวเลือก`;

    const options: { key: string; title: string; sub: string; avatar: React.ReactNode }[] = [
        ...team.map(t => ({
            key: t.username ?? t.employee_id,
            title: t.name + (me && t.username && t.username === me.username ? ' (คุณ)' : ''),
            sub: t.username ?? '',
            avatar: <PersonAvatar person={t} className="w-8 h-8" textClassName="text-[11px] font-semibold" />,
        })),
        {
            key: UNASSIGNED,
            title: 'ยังไม่มอบหมาย',
            sub: 'การ์ดที่ยังไม่มีผู้รับผิดชอบ',
            avatar: (
                <span className="w-8 h-8 rounded-full border-[1.5px] border-dashed border-ink-300 grid place-items-center text-ink-500">
                    <UserX className="w-3.5 h-3.5" />
                </span>
            ),
        },
    ];

    return (
        <Popover>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    aria-label={active ? `กรองผู้รับผิดชอบ: ${label}` : 'กรองตามผู้รับผิดชอบ'}
                    className={cn(
                        'h-11 shrink-0 rounded-full pl-3 pr-3 sm:pl-3.5 inline-flex items-center gap-2 text-sm font-medium cursor-pointer transition-all',
                        active ? 'bg-brand-600 text-white shadow-cta' : 'v2-glass text-ink-700 hover:text-brand-700',
                    )}
                >
                    {picked.length > 0 ? (
                        <span className="flex -space-x-1.5">
                            {picked.slice(0, 3).map(p => (
                                <span key={p.username} className="rounded-full ring-2 ring-brand-600">
                                    <PersonAvatar person={p} className="w-6 h-6" textClassName="text-[10px] font-semibold" />
                                </span>
                            ))}
                        </span>
                    ) : unassignedOn ? <UserX className="w-4 h-4" /> : <Users className="w-4 h-4" />}
                    <span className="hidden sm:inline whitespace-nowrap">{label}</span>
                    <ChevronDown className={cn('w-4 h-4 hidden sm:block', active ? 'text-white/80' : 'text-ink-300')} />
                </button>
            </PopoverTrigger>
            <PopoverContent align="end" sideOffset={8} className="w-72 p-1.5 rounded-2xl border-border shadow-card">
                <div className="flex items-center gap-2 px-2.5 pt-1.5 pb-2">
                    <UserRound className="w-4 h-4 text-brand-600" />
                    <p className="text-sm font-semibold text-ink-900">กรองตามผู้รับผิดชอบ</p>
                    <span className="ml-auto text-[11px] text-ink-500">เลือกได้หลายคน</span>
                </div>
                <ul role="listbox" aria-multiselectable className="space-y-0.5">
                    {options.map((o, i) => {
                        const on = value.includes(o.key);
                        return (
                            <li key={o.key} className={cn(i === options.length - 1 && 'mt-1 pt-1 border-t border-border')}>
                                <button
                                    type="button"
                                    role="option"
                                    aria-selected={on}
                                    onClick={() => toggle(o.key)}
                                    className={cn('w-full flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-left cursor-pointer transition-colors', on ? 'bg-brand-50' : 'hover:bg-slate-50')}
                                >
                                    {o.avatar}
                                    <span className="min-w-0 flex-1">
                                        <span className="block text-[13px] font-medium text-ink-900 truncate">{o.title}</span>
                                        <span className={cn('block text-[11px] text-ink-500 truncate', o.key !== UNASSIGNED && 'font-mono')}>{o.sub}</span>
                                    </span>
                                    <span className={cn('w-4.5 h-4.5 rounded-[5px] border grid place-items-center transition-all', on ? 'bg-brand-600 border-brand-600 text-white' : 'border-slate-300 text-transparent')}>
                                        <Check className="w-3 h-3" strokeWidth={3} />
                                    </span>
                                </button>
                            </li>
                        );
                    })}
                </ul>
                {active && (
                    <button type="button" onClick={() => onChange([])} className="mt-1 w-full rounded-xl px-2.5 py-2 text-left text-xs text-ink-500 hover:bg-slate-50 hover:text-rose-600 cursor-pointer">
                        ล้างตัวกรอง
                    </button>
                )}
            </PopoverContent>
        </Popover>
    );
};
