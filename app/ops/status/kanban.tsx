'use client';

import { useState } from 'react';
import {
    DndContext, DragOverlay, KeyboardSensor, MouseSensor, TouchSensor, defaultDropAnimationSideEffects,
    pointerWithin, useDraggable, useDroppable, useSensor, useSensors,
    type DragEndEvent, type DragStartEvent, type DropAnimation,
} from '@dnd-kit/core';
import { CalendarDays, Check, CircleAlert, CornerDownRight, ExternalLink, FolderKanban, ListChecks, Paperclip, Plus, UserPlus } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { UserAvatar } from '@/components/ui/user-avatar';
import { cn } from '@/lib/utils';
import { OPS_STATUSES, type OpsPerson, type OpsPriority, type OpsStatus, type Project, type ProjectIssue, type ProjectTask } from '../types';
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
 * Each column shows about two cards, then its cards scroll on their own.
 * With `onMove`, cards can be dragged between columns (mouse, touch long-press, or Space + arrows).
 */
export function KanbanBoard<T extends { status: OpsStatus }>({ items, getKey, renderCard, onMove, canMove, columnTop, listMaxHeight = 'max-h-84', landedKey }: {
    items: T[];
    getKey: (item: T) => string;
    renderCard: (item: T) => React.ReactNode;
    /** Omit to make the board read-only */
    onMove?: (item: T, to: OpsStatus) => void;
    /** Per-card drag permission on top of `onMove` (default: every card) */
    canMove?: (item: T) => boolean;
    /** Pinned above a column's cards, outside its scroll area (e.g. the composer on Open) */
    columnTop?: (status: OpsStatus) => React.ReactNode;
    /** Tailwind max-h for a column's card list — sized to ~2 cards plus a peek of the third */
    listMaxHeight?: string;
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
            <div className="-mx-4 px-4 sm:mx-0 sm:px-0 overflow-x-hidden overflow-y-hidden pb-2 snap-x snap-mandatory lg:snap-none">
                <div className="grid grid-flow-col auto-cols-[82%] sm:auto-cols-[17rem] xl:grid-flow-row xl:grid-cols-6 xl:auto-cols-auto gap-3 min-w-0">
                    {OPS_STATUSES.map(status => (
                        <Column
                            key={status}
                            status={status}
                            count={items.filter(i => i.status === status).length}
                            dragFrom={active?.status ?? null}
                            top={columnTop?.(status)}
                            listMaxHeight={listMaxHeight}
                        >
                            {items.filter(i => i.status === status).map(item => {
                                const key = getKey(item);
                                return (
                                    <DraggableCard key={key} id={key} disabled={!onMove || (canMove ? !canMove(item) : false)} landed={key === landedKey}>
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

/** Drop-target colors follow the column's status (literal classes so Tailwind keeps them). */
const DROP_TONE: Record<OpsStatus, { column: string; slot: string }> = {
    'Open':        { column: 'bg-slate-50/90 border-ink-500 ring-ink-500/15',       slot: 'border-ink-300 text-ink-700' },
    'To-Do':       { column: 'bg-aqua-50/90 border-aqua-400 ring-aqua-500/20',      slot: 'border-aqua-400 text-aqua-700' },
    'In Progress': { column: 'bg-orange-50/90 border-sun-400 ring-sun-500/20',      slot: 'border-sun-400 text-sun-700' },
    'Review':      { column: 'bg-violet-50/90 border-violet-400 ring-violet-500/20', slot: 'border-violet-300 text-violet-700' },
    'Done':        { column: 'bg-emerald-50/90 border-mint-500 ring-mint-500/20',   slot: 'border-mint-400 text-mint-700' },
    'Reject':      { column: 'bg-rose-50/90 border-rose-400 ring-rose-500/20',      slot: 'border-rose-300 text-rose-700' },
};

const Column = ({ status, count, dragFrom, top, listMaxHeight, children }: {
    status: OpsStatus; count: number; dragFrom: OpsStatus | null; top?: React.ReactNode; listMaxHeight: string; children: React.ReactNode;
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
                target ? cn('ring-4', DROP_TONE[status].column)
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
            {top && <div className="px-2.5 pb-2.5">{top}</div>}
            {/* ~2 cards, then the column scrolls by itself; pt leaves room for the hover lift */}
            <div className={cn('min-h-28 overflow-y-auto overscroll-y-contain px-2.5 pt-1 pb-2.5 flex flex-col gap-2', listMaxHeight)}>
                {/* drop slot opens smoothly at the top of the target column */}
                <div className={cn('grid transition-[grid-template-rows,opacity] duration-200 ease-out', target ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0 -mb-2.5')}>
                    <div className="overflow-hidden">
                        <div className={cn('h-14 rounded-2xl border-2 border-dashed bg-white/70 grid place-items-center text-xs font-medium', DROP_TONE[status].slot)}>
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

/** Up to `max` faces, tightly overlapped; the rest collapse into "+N" (all names in the tooltip). */
export const AvatarStack = ({ people, max = 4, small }: { people: OpsPerson[]; max?: number; small?: boolean }) => {
    const shown = people.slice(0, max);
    const extra = people.length - shown.length;
    const size = small ? 'w-5 h-5' : 'w-6 h-6';
    const text = small ? 'text-[8.5px] font-semibold' : 'text-[10px] font-semibold';
    return (
        <span className={cn('flex', small ? '-space-x-1.5' : '-space-x-2')} title={people.map(p => p.name).join(', ')}>
            {shown.map(p => (
                <span key={p.username ?? p.employee_id} className={cn('rounded-full ring-white', small ? 'ring-[1.5px]' : 'ring-2')}>
                    <PersonAvatar person={p} className={size} textClassName={text} />
                </span>
            ))}
            {extra > 0 && (
                // solid fill so the overlapped face doesn't show through
                <span className={cn(size, text, 'rounded-full ring-2 ring-white bg-slate-100 text-ink-700 tabular-nums grid place-items-center')}>+{extra}</span>
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

/** Picks are a draft while the popover is open; `onChange` fires once, on close, and only if the set changed. */
export const AssigneePicker = ({ team, value, onChange }: {
    team: OpsPerson[]; value: OpsPerson[]; onChange: (next: OpsPerson[]) => void;
}) => {
    const [draft, setDraft] = useState<OpsPerson[] | null>(null);
    const picked = draft ?? value;
    const selected = new Set(picked.map(v => v.username));
    const toggle = (p: OpsPerson) =>
        setDraft(selected.has(p.username) ? picked.filter(v => v.username !== p.username) : [...picked, p]);
    const setOpen = (open: boolean) => {
        if (open) { setDraft(value); return; }
        const before = new Set(value.map(v => v.username));
        if (draft && (draft.length !== before.size || draft.some(d => !before.has(d.username)))) onChange(draft);
        setDraft(null);
    };
    return (
        <Popover open={draft !== null} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    {...stop}
                    aria-label="มอบหมายงาน"
                    className={cn(
                        'inline-flex items-center gap-1 rounded-full text-[10.5px] font-medium text-brand-600 hover:text-brand-700 cursor-pointer transition-colors',
                        value.length === 0 && 'pr-1',
                    )}
                >
                    <span className="w-5 h-5 rounded-full border-[1.5px] border-dashed border-brand-300 bg-white grid place-items-center hover:border-brand-600 hover:bg-brand-50 transition-colors">
                        {value.length === 0 ? <UserPlus className="w-2.5 h-2.5" /> : <Plus className="w-2.5 h-2.5" />}
                    </span>
                    {value.length === 0 && 'มอบหมาย'}
                </button>
            </PopoverTrigger>
            <PopoverContent align="start" sideOffset={6} className="w-64 p-1.5 rounded-2xl border-border shadow-card" {...stop}>
                <div className="px-2.5 pt-1.5 pb-2">
                    <p className="text-sm font-semibold text-ink-900">มอบหมายงาน</p>
                    <p className="text-[11px] text-ink-500">เลือกได้มากกว่า 1 คน · บันทึกเมื่อปิดหน้าต่างนี้</p>
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
                <div className="mt-1 flex items-center gap-1 border-t border-border pt-1.5">
                    {picked.length > 0 && (
                        <button type="button" onClick={() => setDraft([])} className="rounded-xl px-2.5 py-2 text-left text-xs text-ink-500 hover:bg-slate-50 hover:text-rose-600 cursor-pointer">
                            ล้างการมอบหมาย
                        </button>
                    )}
                    <button type="button" onClick={() => setOpen(false)} className="ml-auto h-8 px-4 rounded-full bg-brand-600 text-xs font-semibold text-white hover:bg-brand-700 cursor-pointer transition-colors">
                        เสร็จ
                    </button>
                </div>
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

/** Signal-bar priority, icon only: the bar count carries the level (never colour alone); the name is in the tooltip. */
export const PriorityIndicator = ({ priority }: { priority: OpsPriority }) => {
    const { bars, color } = PRIORITY_LEVEL[priority];
    return (
        <span className="inline-flex items-center" title={`Priority: ${priority}`}>
            <span className="flex items-end gap-px h-3" aria-hidden>
                {[1, 2, 3, 4].map(n => (
                    <span key={n} className={cn('w-0.75 rounded-[1px]', n <= bars ? color : 'bg-brand-100')} style={{ height: `${n * 25}%` }} />
                ))}
            </span>
            <span className="sr-only">Priority: {priority}</span>
        </span>
    );
};

const cardClass = 'group w-full text-left rounded-xl border border-border bg-white px-3 py-2.5 shadow-[0_3px_10px_-7px_rgba(21,86,201,0.3)] hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-card transition-all duration-200 cursor-pointer select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/50';

/** Card titles: IBM Plex Sans Thai (font-title), compact and crisp for mixed Thai / Latin names at small sizes */
const TITLE_CLASS = 'font-title font-semibold leading-[1.4] line-clamp-2 transition-colors';
/** One slim footer row for every card: 20px faces, 10.5px meta */
const FOOTER_CLASS = 'mt-2 pt-1.5 border-t border-border/70 flex items-center gap-1.5 text-[10.5px] leading-none text-ink-500 min-h-7';

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
export const sortTasks = (list: ProjectTask[]) => [...list].sort((a, b) => b.updated_at.localeCompare(a.updated_at));

/** Same project → same dot colour on every task card and in the composer. */
const PROJECT_DOTS = ['bg-brand-600', 'bg-sun-500', 'bg-mint-600', 'bg-violet-500', 'bg-aqua-500', 'bg-rose-500'];
export const projectDot = (projectId: string) =>
    PROJECT_DOTS[[...projectId].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % PROJECT_DOTS.length];

// ───────────────────────────── cards ─────────────────────────────

export type WorkKind = 'project' | 'task';

/**
 * Tells a project from a task by shape and fill, not colour alone:
 * project = solid square (a container), task = outlined circle (an item inside one).
 */
export const KindMark = ({ kind, className }: { kind: WorkKind; className?: string }) => (
    <span
        title={kind === 'project' ? 'Project' : 'Task'}
        className={cn(
            'w-5 h-5 shrink-0 grid place-items-center',
            kind === 'project' ? 'rounded-md bg-brand-600 text-white' : 'rounded-full border-[1.5px] border-brand-400 bg-white text-brand-600',
            className,
        )}
    >
        {kind === 'project' ? <FolderKanban className="w-3 h-3" /> : <ListChecks className="w-3 h-3" />}
        <span className="sr-only">{kind === 'project' ? 'Project' : 'Task'}</span>
    </span>
);

/** One badge for kind + ID: project = solid brand, task = pale brand with an outline. */
const KIND_TONE: Record<WorkKind, string> = {
    project: 'bg-brand-600 text-white',
    task: 'bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-300',
};

const KindId = ({ kind, id }: { kind: WorkKind; id: string }) => {
    const Icon = kind === 'project' ? FolderKanban : ListChecks;
    return (
        <span
            title={kind === 'project' ? 'Project' : 'Task'}
            className={cn('inline-flex items-center gap-0.5 rounded px-1 font-mono text-[9px] leading-[15px] font-medium tracking-tight whitespace-nowrap', KIND_TONE[kind])}
        >
            <Icon className="w-2 h-2 shrink-0" strokeWidth={2.5} aria-hidden />
            <span className="sr-only">{kind === 'project' ? 'Project ' : 'Task '}</span>{id}
        </span>
    );
};

export const ProjectKanbanCard = ({ p, team, onOpen, onAssign }: {
    p: Project;
    team: OpsPerson[];
    onOpen: () => void;
    /** Present only when the viewer may assign; the card offers it while Open, later changes go through the sheet */
    onAssign?: (people: OpsPerson[]) => void;
}) => {
    const overdue = isOverdue(p);
    const due = p.planned_end ?? p.target_date;
    const muted = p.status === 'Reject';
    const people = p.assignees.map(a => resolvePerson(a, team));
    const canAssign = Boolean(onAssign) && p.status === 'Open';

    return (
        <CardShell onOpen={onOpen} className={cn(muted && 'bg-white/80')}>
            <div className="flex items-center gap-1.5">
                <KindId kind="project" id={p.project_id} />
                <span className="ml-auto"><PriorityIndicator priority={p.priority} /></span>
            </div>

            <h4 className={cn(TITLE_CLASS, 'mt-1 text-[13.5px]', muted ? 'text-ink-500' : 'text-ink-900 group-hover:text-brand-700')}>
                {p.title}
            </h4>
            <div className="mt-1 empty:hidden"><ReviewChip status={p.status} review={p.review} history={p.status_history} /></div>

            <div className={FOOTER_CLASS}>
                <span className="flex items-center gap-1 min-w-0">
                    {people.length > 0 && <AvatarStack people={people} small />}
                    {canAssign
                        ? <AssigneePicker team={team} value={people} onChange={onAssign!} />
                        : people.length === 0 && <span className="text-ink-300">ยังไม่มอบหมาย</span>}
                </span>
                <span className="ml-auto flex items-center gap-2 shrink-0">
                    {p.status === 'Done' && p.link_url && (
                        <a
                            href={p.link_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            {...stop}
                            title={`เปิดระบบ: ${p.link_url}`}
                            aria-label="เปิดลิงก์ใช้งานระบบ"
                            className="inline-flex items-center gap-0.5 rounded-full bg-mint-300/20 px-1.5 py-px font-semibold text-mint-700 hover:bg-mint-300/40 transition-colors"
                        >
                            <ExternalLink className="w-2.5 h-2.5" />เปิด
                        </a>
                    )}
                    {p.issue_count > 0 && (
                        <span className="inline-flex items-center gap-0.5 text-sun-700" title={`${p.issue_count} ปัญหาที่ยังเปิดอยู่`}>
                            <CircleAlert className="w-3 h-3" />{p.issue_count}
                        </span>
                    )}
                    {p.attachments.length > 0 && (
                        <span className="inline-flex items-center gap-0.5"><Paperclip className="w-2.5 h-2.5" />{p.attachments.length}</span>
                    )}
                    {due && !muted && (
                        <span
                            className={cn('inline-flex items-center gap-0.5 tabular-nums', overdue && 'rounded-full bg-rose-50 px-1.5 py-px text-rose-600 font-semibold')}
                            title={overdue ? 'เลยกำหนดแผน' : 'กำหนดเสร็จ'}
                        >
                            <CalendarDays className="w-2.5 h-2.5" />{formatShortDate(due)}
                        </span>
                    )}
                </span>
            </div>
        </CardShell>
    );
};

export const IssueKanbanCard = ({ i, onOpen }: { i: ProjectIssue; onOpen: () => void }) => (
    <CardShell onOpen={onOpen}>
        <p className={cn(TITLE_CLASS, 'text-[12.5px] text-brand-700 truncate')}>{i.project_title}</p>
        <p className={cn('mt-0.5 text-[12.5px] leading-snug line-clamp-3', i.status === 'Reject' ? 'text-ink-500' : 'text-ink-900')}>
            {i.description}
        </p>
        <div className="mt-1 empty:hidden"><ReviewChip status={i.status} review={i.review} history={i.status_history} /></div>
        <div className={FOOTER_CLASS}>
            <PersonAvatar person={i.reported_by} className="w-5 h-5" textClassName="text-[8.5px] font-semibold" />
            <span className="truncate">{i.reported_by.name}</span>
            <span className="ml-auto flex items-center gap-2 shrink-0">
                {i.attachments.length > 0 && (
                    <span className="inline-flex items-center gap-0.5"><Paperclip className="w-2.5 h-2.5" />{i.attachments.length}</span>
                )}
                <span className="tabular-nums">{formatShortDate(i.created_at)}</span>
            </span>
        </div>
    </CardShell>
);

/** Lighter and flatter than a project card, hanging off its project (↳ line); same footer as a project card. */
export const TaskKanbanCard = ({ t, team, onOpen, onAssign }: {
    t: ProjectTask;
    team: OpsPerson[];
    onOpen: () => void;
    /** Present only for the task owner; the card offers it while Open, later changes go through the sheet */
    onAssign?: (people: OpsPerson[]) => void;
}) => {
    const muted = t.status === 'Reject';
    const overdue = isOverdue({ status: t.status, planned_end: t.due_date });
    // null = a user's request (พัฒนาเพิ่ม) nobody has taken yet
    const owner = t.owner ? resolvePerson(t.owner, team) : null;
    const helpers = t.assignees.map(a => resolvePerson(a, team));
    const canAssign = Boolean(onAssign) && t.status === 'Open';
    // the owner is always on the task, so the picker offers everyone else
    const pickable = team.filter(p => p.username !== owner?.username);
    const remark = muted ? t.status_history[t.status_history.length - 1]?.remark : null;
    return (
        <CardShell onOpen={onOpen} className={cn('rounded-lg py-2 shadow-none', muted ? 'bg-white/60' : 'bg-white/85')}>
            <div className="flex items-center gap-1.5">
                <KindId kind="task" id={t.task_id} />
                {t.requested_by && (
                    <span title={`คำขอจาก ${t.requested_by.name}`} className="rounded bg-sun-300/30 px-1 text-[9px] leading-[15px] font-semibold text-sun-700 whitespace-nowrap">
                        คำขอ
                    </span>
                )}
            </div>
            <h4 className={cn(TITLE_CLASS, 'mt-1 text-[13px]', muted ? 'text-ink-500 line-through' : 'text-ink-900 group-hover:text-brand-700')}>
                {t.title}
            </h4>
            {remark && <p className="mt-0.5 text-[10.5px] text-rose-600 line-clamp-2">{remark}</p>}
            {t.project_id ? (
                <p className="mt-1 flex items-center gap-1.5 text-[10.5px] text-ink-500 min-w-0">
                    <CornerDownRight className="w-3 h-3 shrink-0 text-ink-300" aria-hidden />
                    <span className={cn('w-1.75 h-1.75 rounded-full shrink-0', projectDot(t.project_id))} aria-hidden />
                    <span className="truncate" title={`${t.project_id} · ${t.project_title}`}>{t.project_title}</span>
                </p>
            ) : (
                <p className="mt-1 flex items-center gap-1.5 text-[10.5px] text-ink-500 min-w-0">
                    <span className="w-1.75 h-1.75 rounded-full shrink-0 border border-dashed border-ink-300" aria-hidden />
                    งานเดี่ยว · ไม่อิงโปรเจกต์
                </p>
            )}

            <div className={FOOTER_CLASS}>
                <span className="flex items-center gap-1 min-w-0">
                    {owner || helpers.length > 0
                        ? <AvatarStack people={owner ? [owner, ...helpers] : helpers} small />
                        : !muted && <span className="rounded-full border border-dashed border-ink-300 px-1.5 text-[10px] leading-4 text-ink-500">รอรับงาน</span>}
                    {canAssign && <AssigneePicker team={pickable} value={helpers} onChange={onAssign!} />}
                </span>
                {t.due_date && !muted && (
                    <span
                        className={cn('ml-auto tabular-nums shrink-0', overdue && 'rounded-full bg-rose-50 px-1.5 py-px text-rose-600 font-semibold')}
                        title={overdue ? 'เลยกำหนด' : 'กำหนดเสร็จ'}
                    >
                        {formatShortDate(t.due_date)}
                    </span>
                )}
            </div>
        </CardShell>
    );
};

export { PersonAvatar };
