'use client';

import { useId, useState } from 'react';
import { formatDistanceToNowStrict } from 'date-fns';
import { th } from 'date-fns/locale';
import { ArrowLeftRight, ArrowUpRight, Check, ChevronDown, Hand, Pencil, X } from 'lucide-react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import type { OpsPerson, OpsPriority, OpsReviewResult, OpsStatus, OpsStatusChange, Project, ProjectIssue, ProjectRequestInput, ProjectTask } from '../types';
import { AttachmentList, PriorityBadge, STATUS_META, StatusBadge, formatThaiDate, isClosedStatus } from '../components';
import { RichTextView, isRichText } from '../rich-text';
import { resolvePerson, useEmailOf } from '../team';
import { AssigneePicker, KindMark, PersonAvatar } from './kanban';
import { CommentComposer, CommentList, useComments } from './comments';
import { EstimateDate } from './estimate-date';
import { ProjectEditForm } from './project-edit-form';
import { ProjectLink } from './project-link';
import { ReviewSection } from './review-panel';
import { SurveySection } from './survey-panel';
import { ProjectPicker } from './task-composer';
import { TaskNoteSection } from './task-note';

// ───────────────────────────── hero (blue header, like the Home hero) ─────────────────────────────

const FLOW: OpsStatus[] = ['Open', 'To-Do', 'In Progress', 'Review', 'Done'];

/** Status text colour on the white hero pill */
const HERO_TEXT: Record<OpsStatus, string> = {
    'Open': 'text-ink-700',
    'To-Do': 'text-aqua-700',
    'In Progress': 'text-sun-700',
    'Review': 'text-violet-700',
    'Done': 'text-mint-700',
    'Reject': 'text-rose-600',
};

/** "เมื่อสักครู่" under a minute, else "3 วันที่ผ่านมา" */
const updatedAgo = (iso: string) =>
    Date.now() - new Date(iso).getTime() < 60_000 ? 'เมื่อสักครู่' : formatDistanceToNowStrict(new Date(iso), { addSuffix: true, locale: th });

const PRIORITY_BARS: Record<OpsPriority, number> = { Critical: 4, High: 3, Medium: 2, Low: 1 };

/** Open → To-Do → In Progress → Review → Done on the blue hero; a rejected item stops at Reject. */
const HeroStepper = ({ status }: { status: OpsStatus }) => {
    const steps: OpsStatus[] = status === 'Reject' ? ['Open', 'Reject'] : FLOW;
    const current = steps.indexOf(status);
    return (
        <ol className="grid mt-1.5" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}>
            {steps.map((s, i) => {
                const finished = i < current || (i === current && s === 'Done');
                const active = i === current && !finished;
                return (
                    <li key={s} className="relative flex flex-col items-center gap-1.5">
                        {i < steps.length - 1 && (
                            <span className={cn('absolute top-3.25 left-1/2 w-full h-0.5', i < current ? 'bg-white' : 'bg-white/40')} aria-hidden />
                        )}
                        <span className={cn(
                            'relative z-1 w-7 h-7 rounded-full grid place-items-center text-xs font-bold',
                            finished ? 'bg-white text-brand-600'
                                : active ? cn(s === 'Reject' ? 'bg-rose-500' : STATUS_META[s].bar, 'text-white ring-4 ring-white/35')
                                    : 'bg-[#2a8cf9] border-2 border-white/55 text-white/90',
                        )}>
                            {finished ? <Check className="w-3.5 h-3.5" strokeWidth={3} />
                                : s === 'Reject' ? <X className="w-3.5 h-3.5" strokeWidth={3} />
                                    : i + 1}
                        </span>
                        <span className={cn('text-xs', active ? 'font-semibold text-white' : 'text-white/85')}>{s}</span>
                    </li>
                );
            })}
        </ol>
    );
};

const HeroPills = ({ status, priority, updatedAt }: { status: OpsStatus; priority?: OpsPriority; updatedAt: string }) => {
    const m = STATUS_META[status];
    const bars = priority ? PRIORITY_BARS[priority] : 0;
    return (
        <div className="flex flex-wrap items-center gap-2">
            <span className={cn('inline-flex items-center gap-1.5 h-7 px-3 rounded-full bg-white text-[13px] font-semibold', HERO_TEXT[status])}>
                <m.icon className="w-3.5 h-3.5" />
                {m.label}
            </span>
            {priority && (
                <span className="inline-flex items-center gap-1.5 h-7 px-3 rounded-full bg-white/18 text-[13px] font-medium" title={`Priority: ${priority}`}>
                    <span className="flex items-end gap-px h-3" aria-hidden>
                        {[1, 2, 3, 4].map(n => (
                            <span key={n} className={cn('w-0.75 rounded-[1px]', n <= bars ? 'bg-white' : 'bg-white/35')} style={{ height: `${n * 25}%` }} />
                        ))}
                    </span>
                    {priority}
                </span>
            )}
            <span className="text-xs text-white/85">
                อัปเดตล่าสุด {updatedAgo(updatedAt)}
            </span>
        </div>
    );
};

/** Sheet frame: scrolling blue hero, body cards that overlap it, composer pinned to the bottom. */
/** Hero title; with `onRename` a pencil turns it into a textarea (Enter saves, Esc cancels). */
const HeroTitle = ({ title, onRename }: { title: string; onRename?: (title: string) => void }) => {
    const [draft, setDraft] = useState<string | null>(null);
    const save = () => {
        const next = draft?.trim();
        if (next && next !== title) onRename?.(next);
        setDraft(null);
    };

    if (draft === null) {
        return (
            <div className="flex items-start gap-2 pr-10">
                <SheetTitle className="font-display text-[22px] sm:text-2xl font-semibold leading-snug text-white">{title}</SheetTitle>
                {onRename && (
                    <button
                        type="button"
                        onClick={() => setDraft(title)}
                        aria-label="แก้ไขชื่อ"
                        title="แก้ไขชื่อ"
                        className="mt-1 w-7 h-7 shrink-0 rounded-full grid place-items-center bg-white/15 text-white/90 hover:bg-white/30 cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
                    >
                        <Pencil className="w-3.5 h-3.5" />
                    </button>
                )}
            </div>
        );
    }

    return (
        <div className="pr-10 space-y-2">
            <SheetTitle className="sr-only">{title}</SheetTitle>
            <textarea
                autoFocus
                rows={2}
                maxLength={200}
                value={draft}
                aria-label="ชื่อ Task"
                onChange={(e) => setDraft(e.target.value)}
                onFocus={(e) => e.currentTarget.select()}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); save(); }
                    if (e.key === 'Escape') setDraft(null);
                }}
                // SheetShell skips its own Esc-to-close for this
                data-local-escape
                className="w-full resize-none rounded-xl border border-white/40 bg-white/15 px-3 py-2 font-display text-lg font-semibold leading-snug text-white placeholder:text-white/50 focus:outline-none focus:border-white focus:ring-2 focus:ring-white/30"
            />
            <div className="flex justify-end gap-1.5">
                <button type="button" onClick={() => setDraft(null)} className="h-8 px-3.5 rounded-full text-xs font-medium text-white/90 hover:bg-white/15 cursor-pointer transition-colors">
                    ยกเลิก
                </button>
                <button
                    type="button"
                    onClick={save}
                    disabled={!draft.trim()}
                    className="h-8 px-4 rounded-full bg-white text-xs font-semibold text-brand-700 hover:bg-brand-50 cursor-pointer transition-colors disabled:opacity-50 disabled:pointer-events-none"
                >
                    บันทึก
                </button>
            </div>
        </div>
    );
};

const SheetShell = ({ onClose, id, title, onRename, status, priority, updatedAt, children, footer }: {
    onClose: () => void; id: string; title: string; status: OpsStatus; priority?: OpsPriority; updatedAt: string;
    /** Present when the viewer may rename it */
    onRename?: (title: string) => void;
    children: React.ReactNode;
    /** Pinned to the bottom of the sheet (comment composer) */
    footer?: React.ReactNode;
}) => (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
        <SheetContent
            side="right"
            // Esc inside an inline editor cancels that edit only
            onEscapeKeyDown={(e) => { if ((e.target as HTMLElement | null)?.closest?.('[data-local-escape]')) e.preventDefault(); }}
            className={cn(
                'w-full sm:max-w-xl p-0 gap-0 overflow-y-auto bg-brand-50 border-l-0',
                // the sheet's own close button (its last child), restyled for the blue hero
                '[&>button:last-child]:top-5 [&>button:last-child]:right-5 [&>button:last-child]:w-9 [&>button:last-child]:h-9 [&>button:last-child]:rounded-full',
                '[&>button:last-child]:grid [&>button:last-child]:place-items-center [&>button:last-child]:bg-white/20 [&>button:last-child]:text-white',
                '[&>button:last-child]:opacity-100 [&>button:last-child]:hover:bg-white/30 [&>button:last-child]:focus:ring-white/60 [&>button:last-child]:focus:ring-offset-0',
            )}
        >
            <SheetHeader className="v2-shell gap-3.5 px-6 sm:px-7 pt-6 pb-19 text-white">
                <span className="font-mono text-xs tracking-wide text-white/85">{id}</span>
                <HeroTitle key={title} title={title} onRename={onRename} />
                <SheetDescription className="sr-only">รายละเอียดและสถานะ</SheetDescription>
                <HeroPills status={status} priority={priority} updatedAt={updatedAt} />
                <HeroStepper status={status} />
            </SheetHeader>
            <div className="relative z-1 -mt-13 px-4 sm:px-5 pb-5 space-y-4 flex-1">{children}</div>
            {footer && (
                <div className="sticky bottom-0 z-20 px-4 sm:px-5 pb-4 pt-6 bg-linear-to-t from-brand-50 from-55% to-brand-50/0">{footer}</div>
            )}
        </SheetContent>
    </Sheet>
);

// ───────────────────────────── body building blocks ─────────────────────────────

/** White card that overlaps the hero: requester side | assignee side. */
const SidesCard = ({ left, right }: { left: React.ReactNode; right: React.ReactNode }) => (
    <section className="grid grid-cols-1 sm:grid-cols-2 rounded-[22px] bg-white shadow-soft divide-y sm:divide-y-0 sm:divide-x divide-border">
        <div className="p-4.5 sm:p-5 flex flex-col gap-3 min-w-0">{left}</div>
        <div className="p-4.5 sm:p-5 flex flex-col gap-3 min-w-0">{right}</div>
    </section>
);

const SideLabel = ({ children }: { children: React.ReactNode }) => (
    <span className="text-[11px] font-semibold tracking-wide text-ink-500">{children}</span>
);

const PersonLine = ({ person, sub }: { person: OpsPerson; sub?: React.ReactNode }) => (
    <div className="flex items-center gap-2.5 min-w-0">
        <PersonAvatar person={person} className="w-9 h-9" textClassName="text-sm font-semibold" />
        <div className="min-w-0">
            <p className="text-sm font-semibold text-ink-900 truncate">{person.name}</p>
            {sub && <p className="text-xs text-ink-500 truncate">{sub}</p>}
        </div>
    </div>
);

/** Overlapping avatars + "N คน · first names"; same row on the project and the issue sheet. */
const AssigneeRow = ({ people }: { people: OpsPerson[] }) =>
    people.length === 0 ? (
        <p className="text-sm text-ink-500 py-1.5">ยังไม่มอบหมาย</p>
    ) : (
        <div className="flex items-center gap-2.5 min-w-0">
            <span className="flex shrink-0">
                {people.slice(0, 3).map((a, i) => (
                    <span key={a.username ?? a.employee_id} className={cn('rounded-full ring-2 ring-white', i > 0 && '-ml-2')}>
                        <PersonAvatar person={a} className="w-8 h-8" textClassName="text-[13px] font-semibold" />
                    </span>
                ))}
            </span>
            <span className="text-xs leading-snug text-ink-500 line-clamp-2" title={people.map(a => a.name).join(', ')}>
                {people.length} คน · {people.map(a => a.name.split(' ')[0]).join(', ')}
            </span>
        </div>
    );

/** AssigneeRow plus the picker when editable (OPS team list minus anyone the caller leaves out). */
const EditableAssignees = ({ people, team, onChange }: {
    people: OpsPerson[]; team: OpsPerson[]; onChange?: (next: OpsPerson[]) => void;
}) => (
    <div className="flex items-center gap-2 min-w-0">
        {(people.length > 0 || !onChange) && <div className="min-w-0 flex-1"><AssigneeRow people={people} /></div>}
        {onChange && <AssigneePicker team={team} value={people} onChange={onChange} />}
    </div>
);

const Facts = ({ rows }: { rows: [string, React.ReactNode, boolean?][] }) => (
    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-[13px]">
        {rows.map(([label, value, strong]) => (
            <div key={label} className="contents">
                <dt className="text-ink-500">{label}</dt>
                <dd className={cn('text-right text-ink-900', strong && 'font-semibold')}>{value}</dd>
            </div>
        ))}
    </dl>
);

/** One row inside the details card. */
const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div className="py-3.5 min-w-0">
        <p className="text-xs font-semibold text-ink-500 mb-1">{label}</p>
        <div className="text-sm leading-relaxed text-ink-900 whitespace-pre-line wrap-break-word">{children}</div>
    </div>
);

/** "1) a\n2) b" → numbered chips; anything else stays a paragraph. */
const Steps = ({ text }: { text: string }) => {
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length < 2) return <>{text}</>;
    return (
        <ol className="space-y-1.5 whitespace-normal">
            {lines.map((l, i) => (
                <li key={i} className="flex items-baseline gap-2.5">
                    <span className="w-5 h-5 shrink-0 rounded-md bg-brand-100 text-brand-700 text-[11px] font-bold grid place-items-center translate-y-0.5">{i + 1}</span>
                    {l.replace(/^\d+[).]\s*/, '')}
                </li>
            ))}
        </ol>
    );
};

const RejectNote = ({ remark, label }: { remark: string; label: string }) => (
    <div className="rounded-[18px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
        <span className="font-semibold">{label}: </span>{remark}
    </div>
);

const Chip = ({ children }: { children: React.ReactNode }) => (
    <span className="rounded-full bg-brand-100 px-1.75 text-[11px] font-semibold text-brand-700 tabular-nums shrink-0">{children}</span>
);

/** Section that starts closed; the header shows a one-line summary and opens the body with a smooth height animation. */
const Collapsible = ({ title, count, summary, defaultOpen = false, children }: {
    title: string; count?: number; summary?: React.ReactNode; defaultOpen?: boolean; children: React.ReactNode;
}) => {
    const [open, setOpen] = useState(defaultOpen);
    const bodyId = useId();
    return (
        <section className="rounded-[18px] border border-border bg-white">
            <button
                type="button"
                onClick={() => setOpen(o => !o)}
                aria-expanded={open}
                aria-controls={bodyId}
                className="w-full flex items-center gap-2.5 px-4.5 py-3.5 text-left cursor-pointer rounded-[18px] hover:bg-brand-50/60 transition-colors"
            >
                <span className="text-[13px] font-semibold text-ink-900 shrink-0">{title}</span>
                {count != null && <Chip>{count}</Chip>}
                <span className={cn('ml-auto min-w-0 flex items-center gap-1.5 transition-opacity duration-200', open && 'opacity-0')}>{summary}</span>
                <ChevronDown className={cn('w-4 h-4 text-ink-500 shrink-0 transition-transform duration-300', open && 'rotate-180 text-brand-600')} />
            </button>
            <div id={bodyId} className={cn('grid transition-[grid-template-rows] duration-300 ease-out', open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]')}>
                <div className="overflow-hidden">
                    <div className={cn('px-4.5 pb-4 pt-1 transition-opacity duration-300', open ? 'opacity-100' : 'opacity-0')} inert={!open}>
                        {children}
                    </div>
                </div>
            </div>
        </section>
    );
};

const Timeline = ({ items }: { items: OpsStatusChange[] }) => (
    <ol className="relative border-l-2 border-border ml-1.5 space-y-4">
        {[...items].reverse().map((h, i) => (
            <li key={`${h.status}-${h.changed_at}-${i}`} className="pl-4 relative">
                <span className={cn('absolute -left-1.75 top-1.5 w-3 h-3 rounded-full ring-2 ring-white', STATUS_META[h.status].dot)} />
                <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={h.status} />
                    <span className="text-[11px] text-ink-500">{formatThaiDate(h.changed_at, true)}</span>
                </div>
                <p className="text-xs text-ink-500 mt-1">โดย {h.changed_by.name}</p>
                {h.remark && <p className="mt-1 text-sm text-ink-700 bg-brand-50 rounded-xl px-3 py-2">{h.remark}</p>}
            </li>
        ))}
    </ol>
);

const HistorySection = ({ items }: { items: OpsStatusChange[] }) => {
    const last = items[items.length - 1];
    return (
        <Collapsible
            title="ประวัติสถานะ"
            count={items.length}
            summary={last && <span className="text-xs text-ink-500 truncate">ล่าสุด {formatThaiDate(last.changed_at)} · {last.status}</span>}
        >
            <Timeline items={items} />
        </Collapsible>
    );
};

const AttachmentsSection = ({ items, title }: { items: Project['attachments']; title: string }) =>
    items.length === 0 ? (
        <div className="flex items-center gap-2.5 rounded-[18px] border border-border bg-white px-4.5 py-3.5 text-[13px]">
            <span className="font-semibold text-ink-900">{title}</span>
            <span className="ml-auto text-ink-500">ไม่มีไฟล์แนบ</span>
        </div>
    ) : (
        // pictures are previewed straight away; files-only stays folded
        <Collapsible
            title={title}
            count={items.length}
            summary={<span className="text-xs text-ink-500">{items.length} ไฟล์</span>}
            defaultOpen={items.some(a => a.mime_type.startsWith('image/'))}
        >
            <AttachmentList items={items} />
        </Collapsible>
    );

// ───────────────────────────── project ─────────────────────────────

type ProjectSheetProps = {
    /** OPS team with live IT-system profiles, to show photos */
    team: OpsPerson[];
    /** Issues already loaded on the page; filtered to this project here */
    issues: ProjectIssue[];
    /** Tasks already loaded on the page; filtered to this project here */
    tasks: ProjectTask[];
    onClose: () => void;
    onOpenIssue: (issue: ProjectIssue) => void;
    onOpenTask: (task: ProjectTask) => void;
    /** Given only when the viewer may edit the plan (OPS team / admin) */
    onEstimateChange?: (project: Project, date: string | null) => void;
    /** Given only when the viewer may assign (OPS team / admin) */
    onAssign?: (project: Project, people: OpsPerson[]) => void;
    /** Given to anyone signed in; records the result only (status stays Review). Resolves true on success */
    onReview?: (project: Project, result: OpsReviewResult, note: string | null) => Promise<boolean>;
    /** OPS team / admin only: move the card on after a review */
    onMove?: (project: Project, to: OpsStatus) => void;
    /** OPS team / admin: set or remove the system link once Done. Resolves true on success */
    onLinkChange?: (project: Project, url: string | null) => Promise<boolean>;
    /** OPS team / admin: see the satisfaction survey results (Review / Done) */
    canViewSurveys?: boolean;
    /** Renames it from the hero title; shown only when project.can_rename */
    onRename?: (project: Project, title: string) => void;
    /** Saves the edited request; shown only when project.can_edit. Resolves true on success */
    onEdit?: (project: Project, input: ProjectRequestInput) => Promise<boolean>;
};

export const ProjectDetailSheet = ({ project, ...rest }: ProjectSheetProps & { project: Project | null }) =>
    // keyed so a different project starts a fresh comment thread
    project ? <ProjectSheet key={project.project_id} p={project} {...rest} /> : null;

const ProjectSheet = ({ p, issues, tasks, team, onClose, onOpenIssue, onOpenTask, onEstimateChange, onAssign, onReview, onMove, onEdit, onRename, onLinkChange, canViewSurveys = false }: ProjectSheetProps & { p: Project }) => {
    const thread = useComments('project', p.project_id);
    const [editing, setEditing] = useState(false);
    const canEdit = Boolean(onEdit && p.can_edit);
    const related = issues.filter(i => i.project_id === p.project_id);
    const projectTasks = tasks.filter(t => t.project_id === p.project_id);
    const liveTasks = projectTasks.filter(t => t.status !== 'Reject');
    const doneTasks = liveTasks.filter(t => t.status === 'Done').length;
    const openIssues = related.filter(i => i.status !== 'Done' && i.status !== 'Reject').length;
    const people = p.assignees.map(a => resolvePerson(a, team));
    const requester = resolvePerson(p.requested_by, team);
    const rejectRemark = p.status === 'Reject' ? p.status_history.findLast(h => h.status === 'Reject')?.remark : null;
    // dates and assignees freeze once the project is Done/Reject
    const closed = isClosedStatus(p.status);

    return (
        <SheetShell
            onClose={onClose}
            id={p.project_id}
            title={p.title}
            onRename={onRename && p.can_rename ? (title) => onRename(p, title) : undefined}
            status={p.status}
            priority={p.priority}
            updatedAt={p.updated_at}
            footer={<CommentComposer me={thread.me} onPost={thread.post} />}
        >
            <SidesCard
                left={<>
                    <SideLabel>ฝั่งผู้ยื่น</SideLabel>
                    <PersonLine person={requester} sub={p.requested_by.department} />
                    <Facts rows={[
                        ['วันที่ยื่น', formatThaiDate(p.created_at)],
                        ['ต้องการใช้งาน', formatThaiDate(p.target_date), true],
                    ]} />
                </>}
                right={<>
                    <SideLabel>ฝั่งผู้รับผิดชอบ</SideLabel>
                    <EditableAssignees people={people} team={team} onChange={onAssign && !closed ? (next) => onAssign(p, next) : undefined} />
                    <EstimateDate
                        value={p.planned_end}
                        targetDate={p.target_date}
                        onChange={onEstimateChange && !closed ? (d) => onEstimateChange(p, d) : undefined}
                    />
                </>}
            />

            {p.status === 'Done' && (
                <ProjectLink url={p.link_url} onSave={onLinkChange ? (url) => onLinkChange(p, url) : undefined} />
            )}

            <ReviewSection
                kind="project"
                status={p.status}
                review={p.review}
                history={p.status_history}
                me={thread.me}
                canReview={Boolean(onReview)}
                onSubmit={(result, note) => onReview ? onReview(p, result, note) : Promise.resolve(false)}
                onMove={onMove ? (to) => onMove(p, to) : undefined}
            />

            {(p.status === 'Review' || p.status === 'Done') && <SurveySection p={p} canViewResults={canViewSurveys} />}

            {rejectRemark && <RejectNote label="เหตุผลที่ไม่อนุมัติ" remark={rejectRemark} />}

            {editing && canEdit ? (
                <ProjectEditForm project={p} onSave={(input) => onEdit!(p, input)} onCancel={() => setEditing(false)} />
            ) : (
                <section className="rounded-[22px] border border-border bg-white px-5 py-1 divide-y divide-[#eef5fd]">
                    {canEdit && (
                        <div className="flex items-center justify-between gap-2 py-2.5">
                            <span className="text-xs font-semibold text-ink-500">รายละเอียดคำขอ</span>
                            <button
                                type="button"
                                onClick={() => setEditing(true)}
                                className="h-8 px-3 rounded-full inline-flex items-center gap-1.5 text-xs font-medium text-brand-700 hover:bg-brand-50 cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/50"
                            >
                                <Pencil className="w-3.5 h-3.5" /> แก้ไขคำขอ
                            </button>
                        </div>
                    )}
                    <Field label="วัตถุประสงค์และปัญหาที่ต้องการแก้ไข">{p.objective}</Field>
                    <Field label="รายละเอียดความต้องการ (Requirement)">
                        {isRichText(p.requirement) ? <RichTextView html={p.requirement} /> : <Steps text={p.requirement} />}
                    </Field>
                    <Field label="ประโยชน์และความคุ้มค่า">{p.expected_benefit}</Field>
                    <Field label="ผู้ใช้งานโดยประมาณ">
                        <span className="font-display text-lg font-semibold">{p.estimated_users.toLocaleString()}</span> คน
                        {p.user_groups && <span className="block text-xs text-ink-500">{p.user_groups}</span>}
                    </Field>
                </section>
            )}

            <div className="space-y-2.5">
                <HistorySection items={p.status_history} />
                {projectTasks.length > 0 && (
                    <Collapsible
                        title="Task OPS"
                        count={projectTasks.length}
                        summary={<span className="text-xs text-ink-500">เสร็จ {doneTasks}/{liveTasks.length}</span>}
                    >
                        <ul className="space-y-1.5">
                            {projectTasks.map(t => (
                                <li key={t.task_id}>
                                    <button type="button" onClick={() => onOpenTask(t)} className="w-full text-left flex items-center gap-2 rounded-xl border border-border bg-brand-50/50 px-3 py-2.5 hover:border-brand-300 cursor-pointer transition-colors">
                                        {t.owner
                                            ? <PersonAvatar person={resolvePerson(t.owner, team)} className="w-6 h-6" textClassName="text-[10px] font-semibold" />
                                            : <span title="รอรับงาน" className="w-6 h-6 shrink-0 rounded-full border border-dashed border-ink-300" />}
                                        <span className={cn('text-[13px] line-clamp-1 flex-1', t.status === 'Reject' ? 'text-ink-500 line-through' : 'text-ink-900')}>{t.title}</span>
                                        <StatusBadge status={t.status} />
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </Collapsible>
                )}
                {related.length > 0 && (
                    <Collapsible
                        title="ปัญหาที่แจ้ง"
                        count={related.length}
                        summary={openIssues > 0
                            ? <span className="text-xs font-medium text-sun-700">ยังเปิดอยู่ {openIssues}</span>
                            : <span className="text-xs text-ink-500">ปิดครบแล้ว</span>}
                    >
                        <ul className="space-y-1.5">
                            {related.map(i => (
                                <li key={i.issue_id}>
                                    <button type="button" onClick={() => onOpenIssue(i)} className="w-full text-left flex items-center gap-2 rounded-xl border border-border bg-brand-50/50 px-3 py-2.5 hover:border-brand-300 cursor-pointer transition-colors">
                                        <span className="text-[13px] text-ink-900 line-clamp-1 flex-1">{i.description}</span>
                                        <StatusBadge status={i.status} />
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </Collapsible>
                )}
                <AttachmentsSection title="เอกสารอ้างอิง" items={p.attachments} />
            </div>

            <CommentList thread={thread} team={team} />
        </SheetShell>
    );
};

// ───────────────────────────── issue ─────────────────────────────

type IssueSheetProps = {
    team: OpsPerson[];
    onClose: () => void;
    /** Given to anyone signed in; records the result only (status stays Review). Resolves true on success */
    onReview?: (issue: ProjectIssue, result: OpsReviewResult, note: string | null) => Promise<boolean>;
    /** OPS team / admin only: move the card on after a review */
    onMove?: (issue: ProjectIssue, to: OpsStatus) => void;
};

export const IssueDetailSheet = ({ issue, ...rest }: IssueSheetProps & { issue: ProjectIssue | null }) =>
    issue ? <IssueSheet key={issue.issue_id} issue={issue} {...rest} /> : null;

const IssueSheet = ({ issue, team, onClose, onReview, onMove }: IssueSheetProps & { issue: ProjectIssue }) => {
    const thread = useComments('issue', issue.issue_id);
    const reporterEmail = useEmailOf(issue.reported_by.employee_id);
    const rejectRemark = issue.status === 'Reject' ? issue.status_history.findLast(h => h.status === 'Reject')?.remark : null;
    return (
        <SheetShell
            onClose={onClose}
            id={issue.issue_id}
            title={`ปัญหา: ${issue.project_title}`}
            status={issue.status}
            updatedAt={issue.updated_at}
            footer={<CommentComposer me={thread.me} onPost={thread.post} />}
        >
            <SidesCard
                left={<>
                    <SideLabel>ผู้แจ้ง</SideLabel>
                    <PersonLine person={resolvePerson(issue.reported_by, team)} sub={issue.reported_by.department} />
                    <Facts rows={[
                        ['รหัสพนักงาน', <span key="id" className="font-mono">{issue.reported_by.employee_id}</span>],
                        // a narrow sheet wraps the email after the @, not mid-name
                        ['อีเมล', reporterEmail ? (
                            <a key="mail" href={`mailto:${reporterEmail}`} className="text-brand-700 hover:underline">
                                {reporterEmail.replace(/@.*/, '@')}<wbr />{reporterEmail.replace(/^[^@]*@/, '')}
                            </a>
                        ) : '-'],
                        ['วันที่แจ้ง', formatThaiDate(issue.created_at, true)],
                    ]} />
                </>}
                right={<>
                    <SideLabel>โปรเจกต์</SideLabel>
                    <div className="min-w-0">
                        <p className="font-mono text-xs text-ink-500">{issue.project_id}</p>
                        <p className="text-sm font-semibold text-ink-900 line-clamp-2">{issue.project_title}</p>
                    </div>
                    <div className="min-w-0">
                        <p className="text-[11px] text-ink-500 mb-1">ผู้รับผิดชอบ</p>
                        <AssigneeRow people={(issue.project_assignees ?? []).map(a => resolvePerson(a, team))} />
                    </div>
                    <Facts rows={[['อัปเดตล่าสุด', formatThaiDate(issue.updated_at, true)]]} />
                </>}
            />

            <ReviewSection
                kind="issue"
                status={issue.status}
                review={issue.review}
                history={issue.status_history}
                me={thread.me}
                canReview={Boolean(onReview)}
                onSubmit={(result, note) => onReview ? onReview(issue, result, note) : Promise.resolve(false)}
                onMove={onMove ? (to) => onMove(issue, to) : undefined}
            />

            {rejectRemark && <RejectNote label="เหตุผล" remark={rejectRemark} />}

            <section className="rounded-[22px] border border-border bg-white px-5 py-1">
                <Field label="รายละเอียดปัญหาที่พบ">{issue.description}</Field>
            </section>

            <div className="space-y-2.5">
                <HistorySection items={issue.status_history} />
                <AttachmentsSection title="ไฟล์แนบ" items={issue.attachments} />
            </div>

            <CommentList thread={thread} team={team} />
        </SheetShell>
    );
};

// ───────────────────────────── task ─────────────────────────────

type TaskSheetProps = {
    team: OpsPerson[];
    onClose: () => void;
    /** Owner or co-assignee: change the due date */
    onDueChange?: (task: ProjectTask, date: string | null) => void;
    /** Owner only: change the co-assignees */
    onAssign?: (task: ProjectTask, people: OpsPerson[]) => void;
    /** Back up to the parent project's sheet */
    onOpenProject: (projectId: string) => void;
    /** OPS team / admin: rename it until Done; move it to another project while Open */
    onEdit?: (task: ProjectTask, input: { title?: string; project_id?: string }) => void;
    /** Projects it may move to (same list as the composer) */
    projects?: Project[];
    /** OPS team / admin: take a requested task that has no owner yet */
    onClaim?: (task: ProjectTask) => void;
    /** Applies a note / picture change to the page's copy of the task */
    onTaskChange: (taskId: string, update: (task: ProjectTask) => ProjectTask) => void;
};

export const TaskDetailSheet = ({ task, ...rest }: TaskSheetProps & { task: ProjectTask | null }) =>
    task ? <TaskSheet key={task.task_id} t={task} {...rest} /> : null;

/** Status moves on the board; due date and co-assignees are edited here until Done/Reject, the title, note and pictures until Done. */
const TaskSheet = ({ t, team, onClose, onOpenProject, onDueChange, onAssign, onEdit, onClaim, onTaskChange, projects = [] }: TaskSheetProps & { t: ProjectTask }) => {
    // null = a user's request (พัฒนาเพิ่ม) nobody has taken yet
    const owner = t.owner ? resolvePerson(t.owner, team) : null;
    const closed = isClosedStatus(t.status);
    // the title stays editable until Done; moving to another project only before work starts
    const renamable = Boolean(onEdit) && t.status !== 'Done';
    const movable = Boolean(onEdit) && t.status === 'Open';
    const rejectRemark = t.status === 'Reject' ? t.status_history.findLast(h => h.status === 'Reject')?.remark : null;
    return (
        <SheetShell
            onClose={onClose}
            id={t.task_id}
            title={t.title}
            onRename={renamable ? (title) => onEdit!(t, { title }) : undefined}
            status={t.status}
            updatedAt={t.updated_at}
        >
            <SidesCard
                left={<>
                    <SideLabel>ผู้รับผิดชอบ</SideLabel>
                    {owner ? <PersonLine person={owner} sub="เจ้าของ Task" /> : (
                        <div className="flex flex-col gap-2.5 min-w-0">
                            <div className="flex items-center gap-2.5 min-w-0">
                                <span className="w-9 h-9 shrink-0 rounded-full border-2 border-dashed border-ink-300" aria-hidden />
                                <div className="min-w-0">
                                    <p className="text-sm font-semibold text-ink-900">รอทีม OPS รับงาน</p>
                                    <p className="text-xs text-ink-500">ผู้ที่รับงานจะเป็นเจ้าของ Task</p>
                                </div>
                            </div>
                            {onClaim && !closed && (
                                <button type="button" onClick={() => onClaim(t)} className="v2-btn self-start h-9 px-4 text-xs inline-flex items-center gap-1.5 cursor-pointer">
                                    <Hand className="w-3.5 h-3.5" /> รับงานนี้
                                </button>
                            )}
                        </div>
                    )}
                    {(t.assignees.length > 0 || (onAssign && !closed)) && (
                        <div className="min-w-0">
                            <p className="text-[11px] text-ink-500 mb-1">ร่วมรับผิดชอบ</p>
                            <EditableAssignees
                                people={t.assignees.map(a => resolvePerson(a, team))}
                                // the owner is already on it
                                team={team.filter(p => p.username !== owner?.username)}
                                onChange={onAssign && !closed ? (next) => onAssign(t, next) : undefined}
                            />
                        </div>
                    )}
                    <EstimateDate
                        label="กำหนดเสร็จ"
                        value={t.due_date}
                        onChange={onDueChange && !closed ? (d) => onDueChange(t, d) : undefined}
                    />
                    <Facts rows={[['วันที่สร้าง', formatThaiDate(t.created_at)]]} />
                </>}
                right={<>
                    <SideLabel>อยู่ในโปรเจกต์</SideLabel>
                    <button
                        type="button"
                        onClick={() => onOpenProject(t.project_id)}
                        className="group w-full text-left flex items-start gap-2.5 rounded-[14px] border border-border bg-brand-50/70 px-3 py-2.5 hover:border-brand-300 cursor-pointer transition-colors"
                    >
                        <KindMark kind="project" className="mt-0.5" />
                        <span className="min-w-0 flex-1">
                            <span className="block font-mono text-xs text-ink-500">{t.project_id}</span>
                            <span className="block text-sm font-semibold text-ink-900 line-clamp-2 group-hover:text-brand-700">{t.project_title}</span>
                        </span>
                        <ArrowUpRight className="w-4 h-4 text-ink-500 shrink-0 group-hover:text-brand-600" />
                    </button>
                    {movable && projects.length > 0 && (
                        <ProjectPicker
                            projects={projects}
                            value={{ project_id: t.project_id, title: t.project_title }}
                            onChange={(id) => { if (id !== t.project_id) onEdit!(t, { project_id: id }); }}
                        >
                            <button
                                type="button"
                                className="-mt-1 self-start h-8 px-3 rounded-full inline-flex items-center gap-1.5 text-xs font-medium text-brand-700 hover:bg-brand-50 cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/50"
                            >
                                <ArrowLeftRight className="w-3.5 h-3.5" /> ย้ายโปรเจกต์
                            </button>
                        </ProjectPicker>
                    )}
                    <Facts rows={[['อัปเดตล่าสุด', formatThaiDate(t.updated_at, true)]]} />
                </>}
            />

            {t.requested_by && (
                <section className="rounded-[22px] border border-border bg-white px-5 py-1 divide-y divide-border">
                    <Field label="ขอพัฒนาเพิ่มโดย">
                        <span className="font-semibold">{t.requested_by.name}</span>
                        {t.requested_by.department && <span className="text-ink-500"> · {t.requested_by.department}</span>}
                    </Field>
                    {(t.priority || t.target_date) && (
                        <div className="py-3.5 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-ink-900">
                            {t.priority && <span className="flex items-center gap-2"><span className="text-xs font-semibold text-ink-500">ความสำคัญ</span><PriorityBadge priority={t.priority} /></span>}
                            {t.target_date && <span className="flex items-center gap-2"><span className="text-xs font-semibold text-ink-500">ต้องการใช้งาน</span>{formatThaiDate(t.target_date)}</span>}
                        </div>
                    )}
                    {t.detail && <Field label="รายละเอียดคำขอ">{t.detail}</Field>}
                </section>
            )}

            <TaskNoteSection t={t} onChange={(update) => onTaskChange(t.task_id, update)} />

            {rejectRemark && <RejectNote label="เหตุผล" remark={rejectRemark} />}

            <div className="space-y-2.5">
                <HistorySection items={t.status_history} />
                {t.requested_by && <AttachmentsSection title="ไฟล์แนบคำขอ" items={t.request_attachments ?? []} />}
            </div>
        </SheetShell>
    );
};
