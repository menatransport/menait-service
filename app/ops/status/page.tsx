'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ArrowRight, CalendarClock, ChartNoAxesCombined, ClipboardCheck, FolderKanban, ListChecks, RefreshCw, Search, X } from 'lucide-react';
import {
    AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Navbar } from '@/components/navbar';
import Loading from '@/components/loading';
import { useSessionContext } from '@/app/context/SessionContext';
import { cn } from '@/lib/utils';
import {
    createTask, listIssues, listProjects, listTasks, submitReview, updateIssueStatus, updateProject, updateProjectAssignees, updateProjectLink,
    updateProjectPlan, updateProjectStatus, updateTask, updateTaskAssignees, updateTaskPlan, updateTaskStatus,
} from '../api';
import type {
    OpsPerson, OpsReviewResult, OpsScope, OpsStatus, OpsStatusChange, Project, ProjectIssue, ProjectRequestInput, ProjectTask, ProjectTaskEditInput, ProjectTaskInput,
} from '../types';
import { isClosedStatus, isOverdue, toPerson } from '../components';
import { canManageOps, useOpsTeam } from '../team';
import { IssueDetailSheet, ProjectDetailSheet, TaskDetailSheet } from './detail-sheet';
import { IssueKanbanCard, KanbanBoard, ProjectKanbanCard, TaskKanbanCard, sortIssues, sortProjects, sortTasks, type WorkKind } from './kanban';
import { TaskComposer } from './task-composer';
import { StatCards } from './stats';
import { AssigneeFilter, UNASSIGNED, matchesAssignees } from './assignee-filter';

type View = 'projects' | 'issues';

/** The project board also carries the Task OPS of those projects */
type BoardItem = Project | ProjectTask;
const isTask = (x: BoardItem): x is ProjectTask => 'task_id' in x;

const sameUser = (a?: string | null, b?: string | null) => Boolean(a && b && a.toLowerCase() === b.toLowerCase());

const swal = () => import('sweetalert2').then(m => m.default);

/** Reject needs a reason (StatusInput in the schema). Resolves null when cancelled. */
async function askRejectRemark(title: string): Promise<string | null> {
    const Swal = await swal();
    const { isConfirmed, value } = await Swal.fire({
        title: 'ไม่อนุมัติรายการนี้?',
        text: title,
        input: 'textarea',
        inputPlaceholder: 'ระบุเหตุผล เพื่อแจ้งให้ผู้ยื่นทราบ',
        inputValidator: (v) => (v.trim() ? null : 'กรุณาระบุเหตุผล'),
        showCancelButton: true,
        confirmButtonText: 'ยืนยัน Reject',
        cancelButtonText: 'ยกเลิก',
        confirmButtonColor: '#f43f5e',
    });
    return isConfirmed ? String(value).trim() : null;
}

const toast = async (icon: 'success' | 'error', title: string) =>
    (await swal()).fire({ toast: true, position: 'top-end', icon, title, showConfirmButton: false, timer: 1800, timerProgressBar: true });

/** Local copy of a status change, applied before the server answers. */
function withStatus<T extends { status: OpsStatus; updated_at: string; status_history: OpsStatusChange[] }>(
    item: T, status: OpsStatus, remark: string | null, me: OpsPerson,
): T {
    const now = new Date().toISOString();
    return { ...item, status, updated_at: now, status_history: [...item.status_history, { status, changed_at: now, changed_by: me, remark }] };
}

/** Pill switch in the style of the app's primary buttons. */
const Pills = <T extends string>({ value, onChange, options, label }: {
    value: T; onChange: (v: T) => void; options: { value: T; label: React.ReactNode }[]; label: string;
}) => (
    <div role="tablist" aria-label={label} className="v2-glass inline-flex rounded-full p-1">
        {options.map(o => (
            <button
                key={o.value}
                type="button"
                role="tab"
                aria-selected={value === o.value}
                onClick={() => onChange(o.value)}
                className={cn(
                    'h-9 px-4 rounded-full text-sm font-medium flex items-center gap-2 whitespace-nowrap cursor-pointer transition-all',
                    value === o.value ? 'bg-brand-600 text-white shadow-cta' : 'text-ink-700 hover:text-brand-700',
                )}
            >
                {o.label}
            </button>
        ))}
    </div>
);

/** /ops/status/{OPS-… | ISS-… | TSK-…} → that item's sheet */
const detailIdFrom = (pathname: string) => {
    const m = pathname.match(/^\/ops\/status\/([^/]+)/);
    return m ? decodeURIComponent(m[1]) : null;
};

/**
 * Opens/closes a sheet by URL without a Next navigation (history API, synced to usePathname),
 * so the board keeps its data and filters. Back/forward walk through the sheets.
 */
const goToDetail = (id: string | null, mode: 'push' | 'replace' = 'push') => {
    const url = `/ops/status${id ? `/${encodeURIComponent(id)}` : ''}${window.location.search}`;
    if (mode === 'push') window.history.pushState(null, '', url);
    else window.history.replaceState(null, '', url);
};

function ProjectStatusContent() {
    const searchParams = useSearchParams();
    const detailId = detailIdFrom(usePathname());
    const { user } = useSessionContext();
    const router = useRouter();
    /** Set after a project passes review: the satisfaction survey is required next */
    const [surveyFor, setSurveyFor] = useState<Project | null>(null);
    const isIssueId = (id: string | null) => Boolean(id?.startsWith('ISS-'));
    const [view, setView] = useState<View>(searchParams.get('view') === 'issues' || isIssueId(detailId) ? 'issues' : 'projects');
    // an issue opened by URL (link, back/forward) brings its tab along
    const [seenDetailId, setSeenDetailId] = useState(detailId);
    if (detailId !== seenDetailId) {
        setSeenDetailId(detailId);
        if (isIssueId(detailId)) setView('issues');
    }
    const [scope, setScope] = useState<OpsScope>('mine');
    const [query, setQuery] = useState('');
    /** usernames (and/or UNASSIGNED); empty = everyone */
    const [assigneeFilter, setAssigneeFilter] = useState<string[]>([]);
    /** Board filters: which kind of card, and late work only */
    const [kind, setKind] = useState<WorkKind | 'all'>('all');
    const [overdueOnly, setOverdueOnly] = useState(false);
    const [projects, setProjects] = useState<Project[]>([]);
    const [issues, setIssues] = useState<ProjectIssue[]>([]);
    const [tasks, setTasks] = useState<ProjectTask[]>([]);
    /** Projects a manager may file tasks under — "ของฉัน" is narrower, so these come from scope=all */
    const [assigned, setAssigned] = useState<Project[]>([]);
    const [loading, setLoading] = useState(true);
    // the URL holds only the id, so the sheet always shows the latest copy after edits
    const openProject = projects.find(p => p.project_id === detailId)
        ?? assigned.find(p => p.project_id === detailId) ?? null;
    const openIssue = issues.find(i => i.issue_id === detailId) ?? null;
    const openTask = tasks.find(t => t.task_id === detailId) ?? null;
    const closeDetail = () => goToDetail(null, 'replace');
    const [landedKey, setLandedKey] = useState<string | null>(null);
    const team = useOpsTeam();
    const canManage = canManageOps(user);
    const me = useMemo(() => (user ? toPerson(user) : null), [user]);

    // the glow on a just-dropped card lasts ~1s
    useEffect(() => {
        if (!landedKey) return;
        const t = setTimeout(() => setLandedKey(null), 1300);
        return () => clearTimeout(t);
    }, [landedKey]);

    /** Bumped per fetch so an older response never overwrites a newer one */
    const fetchSeq = useRef(0);
    const [syncing, setSyncing] = useState(false);

    /**
     * Pulls every list again — on load / scope change, from the refresh button, and quietly after each save,
     * so the board matches the server without F5 (the "ของฉัน" filter, can_edit, titles copied onto tasks/issues).
     */
    const reload = useCallback(async () => {
        if (!user) return;
        const seq = ++fetchSeq.current;
        setSyncing(true);
        try {
            // issues always come as "all": the server's "mine" is reporter-only, so it's narrowed below
            const [p, i, t, all] = await Promise.all([
                listProjects(scope), listIssues('all'), listTasks(scope),
                scope === 'all' ? null : listProjects('all'),
            ]);
            if (seq !== fetchSeq.current) return;
            // OPS team / admin: "ของฉัน" = projects nobody owns yet (any status from Open) + ones assigned to me
            const mine = scope === 'mine' && canManageOps(user)
                ? (all ?? p).filter(x => x.assignees.length === 0 || x.assignees.some(a => sameUser(a.username, user.username)))
                : p;
            // "ของฉัน" issues = ones I reported + ones on projects I'm responsible for
            const myIssues = scope === 'mine'
                ? i.filter(x => x.reported_by.employee_id === user.employee_id
                    || x.project_assignees.some(a => sameUser(a.username, user.username)))
                : i;
            setProjects(sortProjects(mine));
            setIssues(sortIssues(myIssues));
            setTasks(sortTasks(t));
            setAssigned(canManageOps(user) ? (all ?? p) : []);
        } catch (err) {
            if (seq === fetchSeq.current) toast('error', err instanceof Error ? err.message : 'โหลดข้อมูลไม่สำเร็จ');
        } finally {
            if (seq === fetchSeq.current) { setSyncing(false); setLoading(false); }
        }
    }, [user, scope]);

    useEffect(() => { void reload(); }, [reload]);

    const moveProject = async (p: Project, to: OpsStatus) => {
        if (!user) return;
        const remark = to === 'Reject' ? await askRejectRemark(p.title) : null;
        if (to === 'Reject' && remark === null) return;
        const me = toPerson(user);
        const swap = (next: Project) => setProjects(list => sortProjects(list.map(x => (x.project_id === p.project_id ? next : x))));
        swap(withStatus(p, to, remark, me));
        setLandedKey(p.project_id);
        try {
            await updateProjectStatus(p.project_id, to, remark);
            toast('success', `ย้ายไป ${to} แล้ว`);
            void reload();
        } catch (err) {
            swap(p);
            toast('error', err instanceof Error ? err.message : 'ย้ายสถานะไม่สำเร็จ');
        }
    };

    const moveIssue = async (i: ProjectIssue, to: OpsStatus) => {
        if (!user) return;
        const remark = to === 'Reject' ? await askRejectRemark(i.description) : null;
        if (to === 'Reject' && remark === null) return;
        const me = toPerson(user);
        const swap = (next: ProjectIssue) => setIssues(list => sortIssues(list.map(x => (x.issue_id === i.issue_id ? next : x))));
        swap(withStatus(i, to, remark, me));
        setLandedKey(i.issue_id);
        try {
            await updateIssueStatus(i.issue_id, to, remark);
            toast('success', `ย้ายไป ${to} แล้ว`);
            void reload();
        } catch (err) {
            swap(i);
            toast('error', err instanceof Error ? err.message : 'ย้ายสถานะไม่สำเร็จ');
        }
    };

    /** Reject = cancelled, no reason asked. */
    const moveTask = async (t: ProjectTask, to: OpsStatus) => {
        if (!me) return;
        const swap = (next: ProjectTask) => setTasks(list => sortTasks(list.map(x => (x.task_id === t.task_id ? next : x))));
        swap(withStatus(t, to, null, me));
        setLandedKey(t.task_id);
        try {
            await updateTaskStatus(t.task_id, to);
            toast('success', `ย้ายไป ${to} แล้ว`);
            void reload();
        } catch (err) {
            swap(t);
            toast('error', err instanceof Error ? err.message : 'ย้ายสถานะไม่สำเร็จ');
        }
    };

    const assignTask = async (t: ProjectTask, people: OpsPerson[]) => {
        if (!me) return;
        const swap = (next: ProjectTask) => setTasks(list => list.map(x => (x.task_id === t.task_id ? next : x)));
        swap({ ...t, assignees: people });
        try {
            await updateTaskAssignees(t.task_id, people);
            toast('success', 'บันทึกผู้ร่วมรับผิดชอบแล้ว');
            void reload();
        } catch (err) {
            swap(t);
            toast('error', err instanceof Error ? err.message : 'เพิ่มผู้รับผิดชอบไม่สำเร็จ');
        }
    };

    const setTaskDue = async (t: ProjectTask, date: string | null) => {
        if (!me) return;
        const swap = (next: ProjectTask) => setTasks(list => list.map(x => (x.task_id === t.task_id ? next : x)));
        swap({ ...t, due_date: date });
        try {
            await updateTaskPlan(t.task_id, { due_date: date });
            toast('success', date ? 'บันทึกกำหนดเสร็จแล้ว' : 'ล้างกำหนดเสร็จแล้ว');
            void reload();
        } catch (err) {
            swap(t);
            toast('error', err instanceof Error ? err.message : 'บันทึกวันที่ไม่สำเร็จ');
        }
    };

    /** While Open: rename or move to another project */
    const editTask = async (t: ProjectTask, input: ProjectTaskEditInput) => {
        if (!me) return;
        const swap = (next: ProjectTask) => setTasks(list => sortTasks(list.map(x => (x.task_id === t.task_id ? next : x))));
        const target = input.project_id ? assigned.find(p => p.project_id === input.project_id) : undefined;
        swap({ ...t, ...input, ...(target && { project_title: target.title }) });
        try {
            swap(await updateTask(t.task_id, input));
            if (target) setLandedKey(t.task_id);
            toast('success', target ? `ย้ายไป ${target.project_id} แล้ว` : 'บันทึกชื่อ Task แล้ว');
            void reload();
        } catch (err) {
            swap(t);
            toast('error', err instanceof Error ? err.message : 'บันทึก Task ไม่สำเร็จ');
        }
    };

    const addTask = async (input: ProjectTaskInput) => {
        if (!me) return false;
        try {
            const task = await createTask(input);
            setTasks(list => [task, ...list]);
            setLandedKey(task.task_id);
            toast('success', 'สร้าง Task แล้ว');
            void reload();
            return true;
        } catch (err) {
            toast('error', err instanceof Error ? err.message : 'สร้าง Task ไม่สำเร็จ');
            return false;
        }
    };

    const applyReview = <T extends { status: OpsStatus; updated_at: string; status_history: OpsStatusChange[] }>(
        item: T, result: OpsReviewResult, note: string | null, me: OpsPerson,
    ): T => {
        // the result is recorded only — the responsible team moves the card themselves
        const at = new Date().toISOString();
        return { ...item, updated_at: at, review: { result, by: me, at, note } };
    };

    const reviewProject = async (p: Project, result: OpsReviewResult, note: string | null) => {
        if (!user) return false;
        const me = toPerson(user);
        const swap = (next: Project) => setProjects(list => sortProjects(list.map(x => (x.project_id === p.project_id ? next : x))));
        swap(applyReview(p, result, note, me));
        setLandedKey(p.project_id);
        try {
            await submitReview('project', p.project_id, { result, note });
            toast('success', result === 'passed' ? 'บันทึกผล: ผ่านรีวิว' : 'บันทึกผล: ส่งกลับแก้ไข');
            void reload();
            if (result === 'passed') setSurveyFor(p);
            return true;
        } catch (err) {
            swap(p);
            toast('error', err instanceof Error ? err.message : 'บันทึกผลรีวิวไม่สำเร็จ');
            return false;
        }
    };

    const reviewIssue = async (i: ProjectIssue, result: OpsReviewResult, note: string | null) => {
        if (!user) return false;
        const me = toPerson(user);
        const swap = (next: ProjectIssue) => setIssues(list => sortIssues(list.map(x => (x.issue_id === i.issue_id ? next : x))));
        swap(applyReview(i, result, note, me));
        setLandedKey(i.issue_id);
        try {
            await submitReview('issue', i.issue_id, { result, note });
            toast('success', result === 'passed' ? 'บันทึกผล: แก้ไขแล้ว ผ่าน' : 'บันทึกผล: ส่งกลับแก้ไข');
            void reload();
            return true;
        } catch (err) {
            swap(i);
            toast('error', err instanceof Error ? err.message : 'บันทึกผลรีวิวไม่สำเร็จ');
            return false;
        }
    };

    const setEstimate = async (p: Project, date: string | null) => {
        if (!user) return;
        const swap = (next: Project) => setProjects(list => list.map(x => (x.project_id === p.project_id ? next : x)));
        swap({ ...p, planned_end: date });
        try {
            await updateProjectPlan(p.project_id, { planned_end: date });
            toast('success', date ? 'บันทึกวันที่คาดว่าจะเสร็จแล้ว' : 'ล้างวันที่คาดว่าจะเสร็จแล้ว');
            void reload();
        } catch (err) {
            swap(p);
            toast('error', err instanceof Error ? err.message : 'บันทึกวันที่ไม่สำเร็จ');
        }
    };

    const assignProject = async (p: Project, people: OpsPerson[]) => {
        if (!user) return;
        const swap = (next: Project) => setProjects(list => list.map(x => (x.project_id === p.project_id ? next : x)));
        swap({ ...p, assignees: people });
        try {
            await updateProjectAssignees(p.project_id, people);
            toast('success', people.length ? 'บันทึกผู้รับผิดชอบแล้ว' : 'ล้างผู้รับผิดชอบแล้ว');
            void reload();
        } catch (err) {
            swap(p);
            toast('error', err instanceof Error ? err.message : 'มอบหมายงานไม่สำเร็จ');
        }
    };

    const setProjectLink = async (p: Project, url: string | null) => {
        try {
            const next = await updateProjectLink(p.project_id, url);
            const swap = (list: Project[]) => list.map(x => (x.project_id === p.project_id ? next : x));
            setProjects(swap);
            setAssigned(swap);
            toast('success', url ? 'บันทึกลิงก์แล้ว' : 'ลบลิงก์แล้ว');
            void reload();
            return true;
        } catch (err) {
            toast('error', err instanceof Error ? err.message : 'บันทึกลิงก์ไม่สำเร็จ');
            return false;
        }
    };

    const editProject = async (p: Project, input: ProjectRequestInput) => {
        try {
            const next = await updateProject(p.project_id, input);
            const swap = (list: Project[]) => sortProjects(list.map(x => (x.project_id === p.project_id ? next : x)));
            setProjects(swap);
            setAssigned(swap);
            // tasks carry the project title for their cards
            if (next.title !== p.title) {
                setTasks(list => list.map(t => (t.project_id === p.project_id ? { ...t, project_title: next.title } : t)));
            }
            toast('success', 'บันทึกการแก้ไขคำขอแล้ว');
            void reload();
            return true;
        } catch (err) {
            toast('error', err instanceof Error ? err.message : 'แก้ไขคำขอไม่สำเร็จ');
            return false;
        }
    };


    // a shared link may point outside "ของฉัน": widen to ทั้งหมด once so the sheet can open
    const detailMissing = !loading && Boolean(detailId) && !openProject && !openIssue && !openTask;
    useEffect(() => {
        if (detailMissing && scope === 'mine') { setScope('all'); setLoading(true); }
    }, [detailMissing, scope]);

    const q = query.trim().toLowerCase();
    // assignee + search filters — what the stat cards count; the card toggles (kind / overdue) narrow the board further
    const filteredProjects = useMemo(
        () => projects.filter(p =>
            matchesAssignees(p.assignees, assigneeFilter)
            && (!q || `${p.project_id} ${p.title}`.toLowerCase().includes(q))),
        [projects, q, assigneeFilter],
    );
    const filteredTasks = useMemo(
        () => tasks.filter(t =>
            matchesAssignees([t.owner, ...t.assignees], assigneeFilter)
            && (!q || `${t.task_id} ${t.project_id} ${t.project_title} ${t.title}`.toLowerCase().includes(q))),
        [tasks, q, assigneeFilter],
    );
    const visibleProjects = useMemo(
        () => (kind === 'task' ? [] : filteredProjects.filter(p => !overdueOnly || isOverdue(p))),
        [filteredProjects, kind, overdueOnly],
    );
    const visibleIssues = useMemo(
        () => issues.filter(i =>
            // an issue belongs to whoever is responsible for its project
            matchesAssignees(i.project_assignees ?? [], assigneeFilter)
            && (!q || `${i.issue_id} ${i.project_id} ${i.project_title} ${i.description}`.toLowerCase().includes(q))),
        [issues, q, assigneeFilter],
    );

    const visibleTasks = useMemo(
        () => (kind === 'project' ? [] : filteredTasks.filter(t => !overdueOnly || isOverdue({ status: t.status, planned_end: t.due_date }))),
        [filteredTasks, kind, overdueOnly],
    );

    /** Picking anyone but me looks past "ของฉัน", so switch to ทั้งหมด */
    const pickAssignees = (next: string[]) => {
        setAssigneeFilter(next);
        if (scope === 'mine' && next.some(u => u !== UNASSIGNED && !sameUser(u, user?.username))) {
            setScope('all');
            setLoading(true);
        }
    };
    /** Projects a new task may go under: not rejected — Done stays open for follow-up design fixes */
    const taskProjects = useMemo(
        () => sortProjects(assigned.filter(p => p.status !== 'Reject')),
        [assigned],
    );
    // projects first in each column, their tasks after them
    const boardItems = useMemo<BoardItem[]>(() => [...visibleProjects, ...visibleTasks], [visibleProjects, visibleTasks]);
    const moveBoardItem = (x: BoardItem, to: OpsStatus) => (isTask(x) ? moveTask(x, to) : moveProject(x, to));

    // stat cards are shortcuts into the board filters; from the issues tab they also bring the board back
    const pickKind = (k: WorkKind) => {
        setKind(cur => (view === 'projects' && cur === k ? 'all' : k));
        setView('projects');
    };
    const toggleOverdue = () => {
        setOverdueOnly(cur => (view === 'projects' ? !cur : true));
        setView('projects');
    };

    // the tab counts show work still open — Done / Reject are left out
    const openCount = (list: { status: OpsStatus }[]) => list.filter(x => !isClosedStatus(x.status)).length;
    const tabs: { value: View; label: string; count: number }[] = [
        { value: 'projects', label: 'โปรเจกต์', count: openCount(projects) + openCount(tasks) },
        { value: 'issues', label: 'ปัญหาที่แจ้ง', count: openCount(issues) },
    ];

    return (
        <main className="flex-1 min-h-0 v2-canvas rounded-t-[1.5rem] sm:rounded-t-[2rem] lg:rounded-t-[3rem] shadow-2xl overflow-y-auto">
            <div className="w-full max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-10 2xl:px-14 py-6 sm:py-8 space-y-5">

                {/* heading */}
                <div className="flex items-center gap-3">
                    <span className="v2-tile-sun w-11 h-11 rounded-[15px] grid place-items-center shrink-0">
                        <ChartNoAxesCombined className="w-5 h-5" />
                    </span>
                    <div className="min-w-0">
                        <h2 className="font-display text-xl sm:text-2xl font-semibold text-ink-900 leading-tight">สถานะโปรเจกต์ OPS</h2>

                    </div>
                    <button
                        type="button"
                        onClick={() => void reload()}
                        disabled={syncing}
                        aria-live="polite"
                        title="ดึงข้อมูลล่าสุด"
                        className="ml-auto v2-glass h-9 px-3.5 rounded-full inline-flex items-center gap-1.5 text-xs font-medium text-ink-700 hover:text-brand-700 cursor-pointer transition-colors disabled:cursor-default disabled:text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/50"
                    >
                        <RefreshCw className={cn('w-3.5 h-3.5', syncing && 'animate-spin')} />
                        {syncing ? 'กำลังอัปเดต…' : 'อัปเดตข้อมูล'}
                    </button>
                </div>

                <StatCards
                    projects={filteredProjects}
                    tasks={filteredTasks}
                    issues={visibleIssues}
                    kind={kind}
                    overdueOnly={overdueOnly}
                    issuesView={view === 'issues'}
                    onKind={pickKind}
                    onOverdue={toggleOverdue}
                    onIssues={() => setView(v => (v === 'issues' ? 'projects' : 'issues'))}
                />

                {/* tabs + filters */}
                <div className="flex flex-col lg:flex-row lg:items-center gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                        <Pills<View>
                            label="ประเภทข้อมูล"
                            value={view}
                            onChange={setView}
                            options={tabs.map(t => ({
                                value: t.value,
                                label: <>{t.label}<span className={cn('rounded-full px-1.5 text-[11px] tabular-nums', view === t.value ? 'bg-white/25' : 'bg-brand-50 text-brand-700')}>{t.count}</span></>,
                            }))}
                        />
                        {view === 'projects' && (
                            <Pills<WorkKind | 'all'>
                                label="ประเภทงาน"
                                value={kind}
                                onChange={setKind}
                                options={[
                                    { value: 'all', label: 'ทั้งคู่' },
                                    { value: 'project', label: <><FolderKanban className="w-4 h-4" />Project</> },
                                    { value: 'task', label: <><ListChecks className="w-4 h-4" />Task</> },
                                ]}
                            />
                        )}
                        {view === 'projects' && overdueOnly && (
                            <button
                                type="button"
                                onClick={() => setOverdueOnly(false)}
                                className="h-9 inline-flex items-center gap-1.5 rounded-full border border-rose-200 bg-rose-50 pl-3 pr-2 text-xs font-medium text-rose-700 hover:bg-rose-100 cursor-pointer transition-colors"
                            >
                                <CalendarClock className="w-3.5 h-3.5" />เฉพาะงานเลยกำหนด
                                <X className="w-3.5 h-3.5" aria-label="ล้างตัวกรอง" />
                            </button>
                        )}
                    </div>
                    <div className="flex items-center gap-2 lg:ml-auto">
                        <div className="relative flex-1 lg:w-64">
                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-300" />
                            <input
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder={view === 'issues' ? 'ค้นหาปัญหา' : 'ค้นหาโปรเจกต์ / Task / ID'}
                                aria-label="ค้นหา"
                                className="v2-glass w-full h-11 pl-10 pr-4 rounded-full text-sm text-ink-900 placeholder:text-ink-300 focus:outline-none focus:ring-2 focus:ring-brand-400/40"
                            />
                        </div>
                        <AssigneeFilter team={team} value={assigneeFilter} onChange={pickAssignees} me={user ? toPerson(user) : null} />
                        <Pills<OpsScope>
                            label="ขอบเขตข้อมูล"
                            value={scope}
                            onChange={(v) => { setScope(v); setLoading(true); }}
                            options={[{ value: 'mine', label: 'ของฉัน' }, { value: 'all', label: 'ทั้งหมด' }]}
                        />
                    </div>
                </div>

                {/* board */}
                {loading ? (
                    <div className="py-20 flex justify-center"><Loading /></div>
                ) : view === 'projects' ? (
                    <KanbanBoard<BoardItem>
                        items={boardItems}
                        getKey={x => (isTask(x) ? x.task_id : x.project_id)}
                        // the OPS team / admin manage everything; everyone else views
                        onMove={me ? moveBoardItem : undefined}
                        canMove={() => canManage}
                        landedKey={landedKey}
                        columnTop={status => (status === 'Open' && me && taskProjects.length > 0 && kind !== 'project' && !overdueOnly
                            ? <TaskComposer projects={taskProjects} me={me} onCreate={addTask} />
                            : null)}
                        renderCard={x => (isTask(x)
                            ? (
                                <TaskKanbanCard
                                    t={x}
                                    team={team}
                                    onOpen={() => goToDetail(x.task_id)}
                                    onAssign={canManage ? (people) => assignTask(x, people) : undefined}
                                />
                            )
                            : (
                                <ProjectKanbanCard
                                    p={x}
                                    team={team}
                                    onOpen={() => goToDetail(x.project_id)}
                                    onAssign={canManage ? (people) => assignProject(x, people) : undefined}
                                />
                            ))}
                    />
                ) : (
                    <KanbanBoard
                        items={visibleIssues}
                        getKey={i => i.issue_id}
                        onMove={me ? moveIssue : undefined}
                        canMove={() => canManage}
                        landedKey={landedKey}
                        renderCard={i => <IssueKanbanCard i={i} onOpen={() => goToDetail(i.issue_id)} />}
                    />
                )}
            </div>

            <ProjectDetailSheet
                project={openProject}
                issues={issues}
                tasks={tasks}
                team={team}
                onClose={closeDetail}
                onOpenIssue={(i) => goToDetail(i.issue_id)}
                onOpenTask={(t) => goToDetail(t.task_id)}
                onEstimateChange={canManage ? setEstimate : undefined}
                onAssign={canManage ? assignProject : undefined}
                onReview={user ? reviewProject : undefined}
                onMove={canManage ? moveProject : undefined}
                onEdit={user ? editProject : undefined}
                onLinkChange={canManage ? setProjectLink : undefined}
            />
            <IssueDetailSheet
                issue={openIssue}
                team={team}
                onClose={closeDetail}
                onReview={user ? reviewIssue : undefined}
                onMove={canManage ? moveIssue : undefined}
            />
            <TaskDetailSheet
                task={openTask}
                team={team}
                onClose={closeDetail}
                onOpenProject={(id) => goToDetail(id)}
                onDueChange={canManage ? setTaskDue : undefined}
                onAssign={canManage ? assignTask : undefined}
                onEdit={canManage ? editTask : undefined}
                onTaskChange={(id, update) => setTasks(list => list.map(x => (x.task_id === id ? update(x) : x)))}
                projects={taskProjects}
            />

            {/* Required next step after "ผ่านรีวิว": no cancel, Esc and outside clicks do nothing */}
            <AlertDialog open={Boolean(surveyFor)}>
                <AlertDialogContent
                    className="swal-on-sheet sm:max-w-md p-0 gap-0 overflow-hidden rounded-[28px] border-0"
                    onEscapeKeyDown={(e) => e.preventDefault()}
                >
                    <div className="v2-shell relative px-6 pt-6 pb-12 text-white">
                        <span className="absolute top-5 right-5 rounded-full bg-white/20 px-2.5 py-0.5 text-[11px] font-semibold">จำเป็น</span>
                        <span className="w-12 h-12 rounded-[16px] bg-white/20 grid place-items-center mb-3">
                            <ClipboardCheck className="w-6 h-6" />
                        </span>
                        <AlertDialogTitle className="font-display text-xl font-semibold text-white">ขอบคุณที่ตรวจรับงาน</AlertDialogTitle>
                        <AlertDialogDescription className="mt-1 text-sm text-white/85">
                            ขั้นตอนสุดท้าย ช่วยประเมินความพึงพอใจของระบบนี้ เพื่อให้ทีมนำไปปรับปรุง
                        </AlertDialogDescription>
                    </div>
                    {surveyFor && (
                        <div className="relative -mt-7 mx-5 rounded-2xl bg-white shadow-soft px-4 py-3.5">
                            <p className="font-mono text-[11px] text-ink-500">{surveyFor.project_id}</p>
                            <p className="text-sm font-semibold text-ink-900 line-clamp-2">{surveyFor.title}</p>
                        </div>
                    )}
                    <div className="px-5 pt-4 pb-5 space-y-3">
                        <p className="text-xs text-ink-500 text-center">แบบประเมิน 10 ข้อ · ใช้เวลาประมาณ 1–2 นาที</p>
                        <button
                            type="button"
                            autoFocus
                            onClick={() => surveyFor && router.push(`/survey-ops/${surveyFor.project_id}?from=review`)}
                            className="v2-btn w-full h-12 text-[15px] cursor-pointer"
                        >
                            ไปทำแบบประเมิน <ArrowRight className="w-4 h-4" />
                        </button>
                    </div>
                </AlertDialogContent>
            </AlertDialog>
        </main>
    );
}

export default function ProjectStatusPage() {
    return (
        <Navbar isHome={false} title="Project Status">
            <Suspense>
                <ProjectStatusContent />
            </Suspense>
        </Navbar>
    );
}
