'use client';

import { CalendarClock, CircleAlert } from 'lucide-react';
import { cn } from '@/lib/utils';
import { OPS_STATUSES, type Project, type ProjectIssue, type ProjectTask } from '../types';
import { STATUS_META, isOverdue } from '../components';
import { KindMark, type WorkKind } from './kanban';

const taskOverdue = (t: ProjectTask) => isOverdue({ status: t.status, planned_end: t.due_date });

/** Glass tile that doubles as a filter toggle. */
const StatCard = ({ label, icon, value, valueClassName, caption, pressed, onClick, children }: {
    label: string;
    icon: React.ReactNode;
    value: React.ReactNode;
    valueClassName?: string;
    caption: React.ReactNode;
    pressed: boolean;
    onClick: () => void;
    /** Small visual between the number and the caption */
    children?: React.ReactNode;
}) => (
    <button
        type="button"
        aria-pressed={pressed}
        onClick={onClick}
        className={cn(
            'relative v2-glass rounded-2xl px-4 py-3.5 flex flex-col items-center text-center min-w-0 cursor-pointer transition-all duration-200 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/50',
            pressed && 'ring-2 ring-brand-400 bg-white',
        )}
    >
        {/* corner badge, so it never shifts the centred label */}
        {pressed && <span className="absolute top-2 right-2 rounded-full bg-brand-600 px-1.5 py-px text-[10px] font-semibold text-white">กรองอยู่</span>}
        <span className="flex items-center justify-center gap-2 text-xs text-ink-500 max-w-full">
            {icon}
            <span className="truncate">{label}</span>
        </span>
        <span className={cn('mt-1 font-display text-2xl font-semibold tabular-nums leading-tight', valueClassName ?? 'text-ink-900')}>{value}</span>
        {children}
        <span className="mt-auto pt-1.5 text-[11px] text-ink-500 truncate max-w-full">{caption}</span>
    </button>
);

/**
 * Four cards above the board, each one a shortcut: Project / Task narrow the board to that kind,
 * เลยกำหนด shows only late work, ปัญหา jumps to the issues tab. Counts follow the ของฉัน/ทั้งหมด scope
 * and the assignee / search filters (the page passes the filtered lists).
 */
export const StatCards = ({ projects, tasks, issues, kind, overdueOnly, issuesView, onKind, onOverdue, onIssues }: {
    projects: Project[];
    tasks: ProjectTask[];
    issues: ProjectIssue[];
    kind: WorkKind | 'all';
    overdueOnly: boolean;
    issuesView: boolean;
    onKind: (kind: WorkKind) => void;
    onOverdue: () => void;
    onIssues: () => void;
}) => {
    const byStatus = OPS_STATUSES.map(s => ({ s, n: projects.filter(p => p.status === s).length })).filter(x => x.n > 0);
    const count = (s: string) => byStatus.find(x => x.s === s)?.n ?? 0;

    const liveTasks = tasks.filter(t => t.status !== 'Reject');
    const doneTasks = liveTasks.filter(t => t.status === 'Done').length;
    const taskPct = liveTasks.length ? Math.round((doneTasks / liveTasks.length) * 100) : null;

    const lateProjects = projects.filter(isOverdue).length;
    const lateTasks = tasks.filter(taskOverdue).length;
    const late = lateProjects + lateTasks;

    const openIssues = issues.filter(i => i.status !== 'Done' && i.status !== 'Reject');

    return (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 xl:gap-4">
            <StatCard
                label="โปรเจกต์"
                icon={<KindMark kind="project" className="w-4.5 h-4.5" />}
                value={projects.length}
                caption={`กำลังทำ ${count('In Progress')} · รอตรวจ ${count('Review')} · เสร็จ ${count('Done')}`}
                pressed={!issuesView && kind === 'project'}
                onClick={() => onKind('project')}
            >
                {/* pipeline: one segment per status, in board order */}
                <span className="mt-2 flex h-1.5 w-full max-w-56 gap-0.5 overflow-hidden rounded-full bg-brand-100" aria-hidden>
                    {byStatus.map(({ s, n }) => (
                        <span key={s} className={cn('h-full', STATUS_META[s].bar)} style={{ width: `${(n / projects.length) * 100}%` }} title={`${s} ${n}`} />
                    ))}
                </span>
            </StatCard>

            <StatCard
                label="Task เสร็จแล้ว"
                icon={<KindMark kind="task" className="w-4.5 h-4.5" />}
                value={taskPct === null ? '–' : <>{taskPct}<span className="text-base text-ink-500">%</span></>}
                caption={liveTasks.length
                    ? `${doneTasks}/${liveTasks.length} Task · กำลังทำ ${liveTasks.filter(t => t.status === 'In Progress').length}`
                    : 'ยังไม่มี Task'}
                pressed={!issuesView && kind === 'task'}
                onClick={() => onKind('task')}
            >
                <span className="mt-2 h-1.5 w-full max-w-56 overflow-hidden rounded-full bg-brand-100" aria-hidden>
                    <span className="block h-full rounded-full bg-mint-600 transition-[width] duration-500" style={{ width: `${taskPct ?? 0}%` }} />
                </span>
            </StatCard>

            <StatCard
                label="เลยกำหนด"
                icon={<CalendarClock className={cn('w-4.5 h-4.5', late > 0 ? 'text-rose-500' : 'text-ink-300')} />}
                value={late}
                valueClassName={late > 0 ? 'text-rose-600' : undefined}
                caption={late > 0 ? `โปรเจกต์ ${lateProjects} · Task ${lateTasks}` : 'ทุกงานอยู่ในแผน'}
                pressed={!issuesView && overdueOnly}
                onClick={onOverdue}
            />

            <StatCard
                label="ปัญหาค้างอยู่"
                icon={<CircleAlert className={cn('w-4.5 h-4.5', openIssues.length > 0 ? 'text-sun-500' : 'text-ink-300')} />}
                value={openIssues.length}
                valueClassName={openIssues.length > 0 ? 'text-sun-700' : undefined}
                caption={`ใหม่ ${openIssues.filter(i => i.status === 'Open').length} · กำลังแก้ ${openIssues.filter(i => i.status === 'In Progress').length}`}
                pressed={issuesView}
                onClick={onIssues}
            />
        </div>
    );
};
