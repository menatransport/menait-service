'use client';

import { useState } from 'react';
import {
    DndContext, DragOverlay, KeyboardSensor, MouseSensor, TouchSensor, defaultDropAnimationSideEffects,
    pointerWithin, useDraggable, useDroppable, useSensor, useSensors,
    type DragEndEvent, type DragStartEvent, type DropAnimation,
} from '@dnd-kit/core';
import { CalendarDays, Check, CircleAlert, Paperclip, Plus, UserPlus } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { UserAvatar } from '@/components/ui/user-avatar';
import { cn } from '@/lib/utils';
import { OPS_STATUSES, type OpsPerson, type OpsPriority, type OpsStatus, type Project, type ProjectIssue } from '../types';
import { STATUS_META, formatShortDate, isOverdue } from '../components';
import { resolvePerson } from '../team';
import { ReviewChip } from './review-panel';

// ───────────────────────────── board ─────────────────────────────

const DROP_ANIMATION: DropAnimation = {
    duration: 260,
    easing: 'cubic-bezier(.2, .8, .2, 1)',
    sideEffects: defaultDropAnimationSideEffects({
        // the real card stays hidden until the overlay lands on it
        styles: { active: { opacity: '0' } },
        className: { dragOverlay: 'v2-card-dropping' },
    }),
};

/**
 * Board on the app canvas: one glass column per status; scrolls sideways below lg.
 * With `onMove`, cards can be dragged between columns (mouse, touch long-press, or Space + arrows).
 */
export function KanbanBoard<T extends { status: OpsStatus }>({ items, getKey, renderCard, onMove, landedKey }: {
    items: T[];
    getKey: (item: T) => string;
    renderCard: (item: T) => React.ReactNode;
    /** Omit to make the board read-only */
    onMove?: (item: T, to: OpsStatus) => void;
    /** Key of the card that just moved — it gets a short glow */
    landedKey?: string | null;
}) {
    const [activeKey, setActiveKey] = useState<string | null>(null);
    const sensors = useSensors(
        useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
        // long-press so a normal swipe still scrolls the board
        useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
        // Enter is kept for opening the card
        useSensor(KeyboardSensor, { keyboardCodes: { start: ['Space'], cancel: ['Escape'], end: ['Space'] } }),
    );
    const active = activeKey ? items.find(i => getKey(i) === activeKey) ?? null : null;

    const handleStart = ({ active: a }: DragStartEvent) => setActiveKey(String(a.id));
    const handleEnd = ({ active: a, over }: DragEndEvent) => {
        setActiveKey(null);
        const item = items.find(i => getKey(i) === String(a.id));
        const to = over?.id as OpsStatus | undefined;
        if (item && to && to !== item.status) onMove?.(item, to);
    };

    return (
        <DndContext
            sensors={sensors}
            collisionDetection={pointerWithin}
            onDragStart={handleStart}
            onDragEnd={handleEnd}
            onDragCancel={() => setActiveKey(null)}
            accessibility={{
                screenReaderInstructions: { draggable: 'กด Space เพื่อหยิบการ์ด ใช้ลูกศรเพื่อย้าย แล้วกด Space อีกครั้งเพื่อวาง หรือ Esc เพื่อยกเลิก' },
            }}
        >
            <div className="-mx-4 px-4 sm:mx-0 sm:px-0 overflow-x-auto pb-2 snap-x snap-mandatory lg:snap-none">
                <div className="grid grid-flow-col auto-cols-[82%] sm:auto-cols-[17rem] xl:grid-flow-row xl:grid-cols-6 xl:auto-cols-auto gap-3 min-w-0">
                    {OPS_STATUSES.map(status => (
                        <Column
                            key={status}
                            status={status}
                            count={items.filter(i => i.status === status).length}
                            dragFrom={active?.status ?? null}
                        >
                            {items.filter(i => i.status === status).map(item => {
                                const key = getKey(item);
                                return (
                                    <DraggableCard key={key} id={key} disabled={!onMove} landed={key === landedKey}>
                                        {renderCard(item)}
                                    </DraggableCard>
                                );
                            })}
                        </Column>
                    ))}
                </div>
            </div>

            <DragOverlay dropAnimation={DROP_ANIMATION}>
                {active ? <div className="v2-card-lift rounded-2xl cursor-grabbing">{renderCard(active)}</div> : null}
            </DragOverlay>
        </DndContext>
    );
}

const Column = ({ status, count, dragFrom, children }: {
    status: OpsStatus; count: number; dragFrom: OpsStatus | null; children: React.ReactNode;
}) => {
    const m = STATUS_META[status];
    const { setNodeRef, isOver } = useDroppable({ id: status });
    const dragging = dragFrom !== null;
    const target = isOver && dragFrom !== status;
    return (
        <section
            ref={setNodeRef}
            aria-label={status}
            className={cn(
                'snap-start flex flex-col min-w-0 rounded-[22px] border backdrop-blur-sm transition-[background-color,border-color,box-shadow] duration-200',
                target ? 'bg-brand-50/90 border-brand-300 shadow-[0_0_0_4px_rgba(61,165,255,0.18)]'
                    : dragging ? 'bg-white/45 border-white/90 border-dashed'
                        : 'bg-white/55 border-white/90',
            )}
        >
            <header className="px-4 pt-3.5 pb-3">
                {/* same accent bar as the Home group cards */}
                <span className={cn('block h-1.5 rounded-full mb-2.5 transition-[width] duration-300', m.dot, target ? 'w-16' : 'w-10')} aria-hidden />
                <div className="flex items-center gap-2">
                    <m.icon className="w-4 h-4 text-ink-500 shrink-0" />
                    <h3 className="font-display text-[15px] font-semibold text-ink-900">{m.label}</h3>
                    <span className={cn('ml-auto rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums', m.soft)}>{count}</span>
                </div>
                <p className="mt-0.5 text-xs text-ink-500">{m.hint}</p>
            </header>
            <div className="flex-1 px-2.5 pb-2.5 min-h-28 flex flex-col gap-2.5">
                {/* drop slot opens smoothly at the top of the target column */}
                <div className={cn('grid transition-[grid-template-rows,opacity] duration-200 ease-out', target ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0 -mb-2.5')}>
                    <div className="overflow-hidden">
                        <div className="h-14 rounded-2xl border-2 border-dashed border-brand-300 bg-white/70 grid place-items-center text-xs font-medium text-brand-600">
                            วางเพื่อย้ายไป {m.label}
                        </div>
                    </div>
                </div>
                {count === 0 && !target
                    ? <p className="rounded-2xl border border-dashed border-brand-200 py-6 text-center text-xs text-ink-300">ไม่มีรายการ</p>
                    : children}
            </div>
        </section>
    );
};

const DraggableCard = ({ id, disabled, landed, children }: {
    id: string; disabled: boolean; landed: boolean; children: React.ReactNode;
}) => {
    // the inner card is the focus stop; Space bubbles up to these listeners
    const { setNodeRef, listeners, isDragging } = useDraggable({ id, disabled });
    return (
        <div
            ref={setNodeRef}
            {...listeners}
            className={cn(
                'rounded-2xl transition-opacity duration-150 touch-manipulation',
                !disabled && 'cursor-grab',
                isDragging && 'opacity-30',
                landed && 'v2-card-land',
            )}
        >
            {children}
        </div>
    );
};

// ───────────────────────────── people ─────────────────────────────

const AVATAR_TONES = [
    'bg-brand-100 text-brand-700',
    'bg-mint-300/40 text-mint-700',
    'bg-sun-300/40 text-sun-700',
    'bg-violet-100 text-violet-700',
    'bg-ink-300/40 text-ink-700',
];
const toneFor = (key: string) => AVATAR_TONES[[...key].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % AVATAR_TONES.length];

/** IT-system photo, else coloured initials (name, or the username as an e-mail-like fallback). */
const PersonAvatar = ({ person, className = 'w-6 h-6', textClassName = 'text-[10px] font-semibold' }: {
    person: OpsPerson; className?: string; textClassName?: string;
}) => {
    // "kittaboon.l" → "kittaboon l" → KL when the IT profile hasn't loaded / has no name
    const name = person.name === person.username ? person.name.replace(/[._]/g, ' ') : person.name;
    return (
        <UserAvatar
            imageUrl={person.image_url}
            name={name}
            className={className}
            fallbackClassName={toneFor(person.username ?? person.employee_id)}
            textClassName={textClassName}
        />
    );
};

export const AvatarStack = ({ people, max = 3 }: { people: OpsPerson[]; max?: number }) => {
    const shown = people.slice(0, max);
    const extra = people.length - shown.length;
    return (
        <span className="flex -space-x-1.5" title={people.map(p => p.name).join(', ')}>
            {shown.map(p => (
                <span key={p.username ?? p.employee_id} className="rounded-full ring-2 ring-white">
                    <PersonAvatar person={p} />
                </span>
            ))}
            {extra > 0 && (
                <span className="w-6 h-6 rounded-full ring-2 ring-white bg-ink-300/30 text-ink-700 text-[10px] font-semibold grid place-items-center">+{extra}</span>
            )}
        </span>
    );
};

/** Keeps clicks / drags inside the picker from opening or dragging the card (React events bubble through portals). */
const stop = {
    onClick: (e: React.SyntheticEvent) => e.stopPropagation(),
    onMouseDown: (e: React.SyntheticEvent) => e.stopPropagation(),
    onTouchStart: (e: React.SyntheticEvent) => e.stopPropagation(),
    onKeyDown: (e: React.SyntheticEvent) => e.stopPropagation(),
};

const AssigneePicker = ({ team, value, onChange }: {
    team: OpsPerson[]; value: OpsPerson[]; onChange: (next: OpsPerson[]) => void;
}) => {
    const selected = new Set(value.map(v => v.username));
    const toggle = (p: OpsPerson) =>
        onChange(selected.has(p.username) ? value.filter(v => v.username !== p.username) : [...value, p]);
    return (
        <Popover>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    {...stop}
                    aria-label="มอบหมายงาน"
                    className={cn(
                        'inline-flex items-center gap-1.5 rounded-full text-[11px] font-medium text-brand-600 hover:text-brand-700 cursor-pointer transition-colors',
                        value.length === 0 && 'pr-1',
                    )}
                >
                    <span className="w-6 h-6 rounded-full border-[1.5px] border-dashed border-brand-300 bg-white grid place-items-center hover:border-brand-600 hover:bg-brand-50 transition-colors">
                        {value.length === 0 ? <UserPlus className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                    </span>
                    {value.length === 0 && 'มอบหมาย'}
                </button>
            </PopoverTrigger>
            <PopoverContent align="start" sideOffset={6} className="w-64 p-1.5 rounded-2xl border-border shadow-card" {...stop}>
                <div className="px-2.5 pt-1.5 pb-2">
                    <p className="text-sm font-semibold text-ink-900">มอบหมายงาน</p>
                    <p className="text-[11px] text-ink-500">เลือกได้มากกว่า 1 คน</p>
                </div>
                <ul role="listbox" aria-multiselectable className="space-y-0.5">
                    {team.map(p => {
                        const on = selected.has(p.username);
                        return (
                            <li key={p.username}>
                                <button
                                    type="button"
                                    role="option"
                                    aria-selected={on}
                                    onClick={() => toggle(p)}
                                    className={cn('w-full flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-left cursor-pointer transition-colors', on ? 'bg-brand-50' : 'hover:bg-slate-50')}
                                >
                                    <PersonAvatar person={p} className="w-8 h-8" textClassName="text-[11px] font-semibold" />
                                    <span className="min-w-0 flex-1">
                                        <span className="block text-[13px] font-medium text-ink-900 truncate">{p.name}</span>
                                        <span className="block text-[11px] text-ink-500 font-mono truncate">{p.username}</span>
                                    </span>
                                    <span className={cn('w-4.5 h-4.5 rounded-[5px] border grid place-items-center transition-all', on ? 'bg-brand-600 border-brand-600 text-white scale-100' : 'border-slate-300 text-transparent')}>
                                        <Check className="w-3 h-3" strokeWidth={3} />
                                    </span>
                                </button>
                            </li>
                        );
                    })}
                </ul>
                {value.length > 0 && (
                    <button type="button" onClick={() => onChange([])} className="mt-1 w-full rounded-xl px-2.5 py-2 text-left text-xs text-ink-500 hover:bg-slate-50 hover:text-rose-600 cursor-pointer">
                        ล้างการมอบหมาย
                    </button>
                )}
            </PopoverContent>
        </Popover>
    );
};

// ───────────────────────────── card parts ─────────────────────────────

const PRIORITY_LEVEL: Record<OpsPriority, { bars: number; color: string }> = {
    Critical: { bars: 4, color: 'bg-rose-500' },
    High: { bars: 3, color: 'bg-sun-500' },
    Medium: { bars: 2, color: 'bg-brand-600' },
    Low: { bars: 1, color: 'bg-ink-500' },
};

/** Signal-bar priority: bar count + text, so it never relies on colour. */
export const PriorityIndicator = ({ priority }: { priority: OpsPriority }) => {
    const { bars, color } = PRIORITY_LEVEL[priority];
    return (
        <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-ink-700" title={`Priority: ${priority}`}>
            <span className="flex items-end gap-px h-3" aria-hidden>
                {[1, 2, 3, 4].map(n => (
                    <span key={n} className={cn('w-0.75 rounded-[1px]', n <= bars ? color : 'bg-brand-100')} style={{ height: `${n * 25}%` }} />
                ))}
            </span>
            {priority}
        </span>
    );
};

const cardClass = 'group w-full text-left rounded-2xl border border-border bg-white p-3.5 shadow-[0_4px_14px_-8px_rgba(21,86,201,0.25)] hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-card transition-all duration-200 cursor-pointer select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/50';

/** Card surface: a focusable div (not a <button>) so the assignee picker can live inside it. */
const CardShell = ({ onOpen, className, children }: { onOpen: () => void; className?: string; children: React.ReactNode }) => (
    <div
        role="button"
        tabIndex={0}
        onClick={onOpen}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onOpen(); } }}
        className={cn(cardClass, className)}
    >
        {children}
    </div>
);

// Most urgent first, then most recently touched
const PRIORITY_RANK: Record<OpsPriority, number> = { Critical: 0, High: 1, Medium: 2, Low: 3 };
export const sortProjects = (list: Project[]) =>
    [...list].sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || b.updated_at.localeCompare(a.updated_at));
export const sortIssues = (list: ProjectIssue[]) => [...list].sort((a, b) => b.created_at.localeCompare(a.created_at));

// ───────────────────────────── cards ─────────────────────────────

export const ProjectKanbanCard = ({ p, team, onOpen, onAssign }: {
    p: Project;
    team: OpsPerson[];
    onOpen: () => void;
    /** Present only when the viewer may assign; used while the project is Open */
    onAssign?: (people: OpsPerson[]) => void;
}) => {
    const overdue = isOverdue(p);
    const due = p.planned_end ?? p.target_date;
    const muted = p.status === 'Reject';
    const people = p.assignees.map(a => resolvePerson(a, team));
    const canAssign = Boolean(onAssign) && p.status === 'Open';

    return (
        <CardShell onOpen={onOpen} className={cn(muted && 'bg-white/80')}>
            <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-[11px] text-ink-500 whitespace-nowrap">{p.project_id}</span>
                <PriorityIndicator priority={p.priority} />
            </div>

            <h4 className={cn('mt-1.5 text-sm font-semibold leading-snug line-clamp-2 transition-colors', muted ? 'text-ink-500' : 'text-ink-900 group-hover:text-brand-700')}>
                {p.title}
            </h4>
            <div className="mt-1.5 empty:hidden"><ReviewChip status={p.status} review={p.review} history={p.status_history} /></div>

            <div className="mt-3 pt-2.5 border-t border-border flex items-center gap-2 text-[11px] text-ink-500 min-h-9">
                <span className="flex items-center gap-1.5 min-w-0">
                    {people.length > 0 && <AvatarStack people={people} />}
                    {canAssign
                        ? <AssigneePicker team={team} value={people} onChange={onAssign!} />
                        : people.length === 0 && <span className="text-ink-300">ยังไม่มอบหมาย</span>}
                </span>
                <span className="ml-auto flex items-center gap-2.5 shrink-0">
                    {p.issue_count > 0 && (
                        <span className="inline-flex items-center gap-1 text-sun-700" title={`${p.issue_count} ปัญหาที่ยังเปิดอยู่`}>
                            <CircleAlert className="w-3.5 h-3.5" />{p.issue_count}
                        </span>
                    )}
                    {p.attachments.length > 0 && (
                        <span className="inline-flex items-center gap-1"><Paperclip className="w-3 h-3" />{p.attachments.length}</span>
                    )}
                    {due && !muted && (
                        <span
                            className={cn('inline-flex items-center gap-1 tabular-nums', overdue && 'rounded-full bg-rose-50 px-1.5 py-0.5 text-rose-600 font-semibold')}
                            title={overdue ? 'เลยกำหนดแผน' : 'กำหนดเสร็จ'}
                        >
                            <CalendarDays className="w-3 h-3" />{formatShortDate(due)}
                        </span>
                    )}
                </span>
            </div>
        </CardShell>
    );
};

export const IssueKanbanCard = ({ i, onOpen }: { i: ProjectIssue; onOpen: () => void }) => (
    <CardShell onOpen={onOpen}>
        <p className="mt-1.5 text-xs font-medium text-brand-700 truncate">{i.project_title}</p>
        <p className={cn('mt-1 text-[13px] leading-snug line-clamp-3', i.status === 'Reject' ? 'text-ink-500' : 'text-ink-900')}>
            {i.description}
        </p>
        <div className="mt-1.5 empty:hidden"><ReviewChip status={i.status} review={i.review} history={i.status_history} /></div>
        <div className="mt-3 pt-2.5 border-t border-border flex items-center gap-2 text-[11px] text-ink-500">
            <PersonAvatar person={i.reported_by} />
            <span className="truncate">{i.reported_by.name}</span>
            <span className="ml-auto flex items-center gap-2.5 shrink-0">
                {i.attachments.length > 0 && (
                    <span className="inline-flex items-center gap-1"><Paperclip className="w-3 h-3" />{i.attachments.length}</span>
                )}
                <span className="tabular-nums">{formatShortDate(i.created_at)}</span>
            </span>
        </div>
    </CardShell>
);

export { PersonAvatar };
