'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowRight, ChartNoAxesCombined, ClipboardCheck, Search } from 'lucide-react';
import {
    AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Navbar } from '@/components/navbar';
import Loading from '@/components/loading';
import { useSessionContext } from '@/app/context/SessionContext';
import { cn } from '@/lib/utils';
import {
    listIssues, listProjects, submitReview, updateIssueStatus, updateProjectAssignees, updateProjectPlan, updateProjectStatus,
} from '../api';
import type { OpsPerson, OpsReviewResult, OpsScope, OpsStatus, OpsStatusChange, Project, ProjectIssue } from '../types';
import { isOverdue, toPerson } from '../components';
import { canManageOps, useOpsTeam } from '../team';
import { IssueDetailSheet, ProjectDetailSheet } from './detail-sheet';
import { IssueKanbanCard, KanbanBoard, ProjectKanbanCard, sortIssues, sortProjects } from './kanban';
import { AssigneeFilter, matchesAssignees } from './assignee-filter';

type View = 'projects' | 'issues';

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

const Summary = ({ items }: { items: { label: string; value: number; alert?: boolean }[] }) => (
    // one swipeable row on phones, a 5-up grid from sm
    <dl className="-mx-4 px-4 sm:mx-0 sm:px-0 flex sm:grid sm:grid-cols-5 gap-3 overflow-x-auto pb-1 sm:pb-0">
        {items.map(s => (
            <div key={s.label} className="v2-glass rounded-2xl px-4 py-3 min-w-34 shrink-0 sm:min-w-0">
                <dt className="text-xs text-ink-500">{s.label}</dt>
                <dd className={cn('mt-0.5 font-display text-2xl font-semibold tabular-nums leading-tight', s.alert && s.value > 0 ? 'text-rose-600' : 'text-ink-900')}>
                    {s.value}
                </dd>
            </div>
        ))}
    </dl>
);

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

function ProjectStatusContent() {
    const searchParams = useSearchParams();
    const { user } = useSessionContext();
    const router = useRouter();
    /** Set after a project passes review: the satisfaction survey is required next */
    const [surveyFor, setSurveyFor] = useState<Project | null>(null);
    const [view, setView] = useState<View>(searchParams.get('view') === 'issues' ? 'issues' : 'projects');
    const [scope, setScope] = useState<OpsScope>('mine');
    const [query, setQuery] = useState('');
    /** usernames (and/or UNASSIGNED); empty = everyone */
    const [assigneeFilter, setAssigneeFilter] = useState<string[]>([]);
    const [projects, setProjects] = useState<Project[]>([]);
    const [issues, setIssues] = useState<ProjectIssue[]>([]);
    const [loading, setLoading] = useState(true);
    // keep only the id so the sheet always shows the latest copy after edits
    const [openProjectId, setOpenProjectId] = useState<string | null>(null);
    const openProject = projects.find(p => p.project_id === openProjectId) ?? null;
    const [openIssueId, setOpenIssueId] = useState<string | null>(null);
    const openIssue = issues.find(i => i.issue_id === openIssueId) ?? null;
    const [landedKey, setLandedKey] = useState<string | null>(null);
    const team = useOpsTeam();
    const canManage = canManageOps(user);

    // the glow on a just-dropped card lasts ~1s
    useEffect(() => {
        if (!landedKey) return;
        const t = setTimeout(() => setLandedKey(null), 1300);
        return () => clearTimeout(t);
    }, [landedKey]);

    const moveProject = async (p: Project, to: OpsStatus) => {
        if (!user) return;
        const remark = to === 'Reject' ? await askRejectRemark(p.title) : null;
        if (to === 'Reject' && remark === null) return;
        const me = toPerson(user);
        const swap = (next: Project) => setProjects(list => sortProjects(list.map(x => (x.project_id === p.project_id ? next : x))));
        swap(withStatus(p, to, remark, me));
        setLandedKey(p.project_id);
        try {
            await updateProjectStatus(p.project_id, to, remark, { me });
            toast('success', `ย้ายไป ${to} แล้ว`);
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
            await updateIssueStatus(i.issue_id, to, remark, { me });
            toast('success', `ย้ายไป ${to} แล้ว`);
        } catch (err) {
            swap(i);
            toast('error', err instanceof Error ? err.message : 'ย้ายสถานะไม่สำเร็จ');
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
            await submitReview('project', p.project_id, { result, note }, { me });
            toast('success', result === 'passed' ? 'บันทึกผล: ผ่านรีวิว' : 'บันทึกผล: ส่งกลับแก้ไข');
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
            await submitReview('issue', i.issue_id, { result, note }, { me });
            toast('success', result === 'passed' ? 'บันทึกผล: แก้ไขแล้ว ผ่าน' : 'บันทึกผล: ส่งกลับแก้ไข');
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
            await updateProjectPlan(p.project_id, { planned_end: date }, { me: toPerson(user) });
            toast('success', date ? 'บันทึกวันที่คาดว่าจะเสร็จแล้ว' : 'ล้างวันที่คาดว่าจะเสร็จแล้ว');
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
            await updateProjectAssignees(p.project_id, people, { me: toPerson(user) });
        } catch (err) {
            swap(p);
            toast('error', err instanceof Error ? err.message : 'มอบหมายงานไม่สำเร็จ');
        }
    };

    useEffect(() => {
        if (!user) return;
        let cancelled = false;
        const caller = { me: toPerson(user) };
        Promise.all([listProjects(scope, caller), listIssues(scope, caller)])
            .then(([p, i]) => { if (!cancelled) { setProjects(sortProjects(p)); setIssues(sortIssues(i)); } })
            .catch(err => console.error('Error fetching OPS status:', err))
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [user, scope]);

    const q = query.trim().toLowerCase();
    const visibleProjects = useMemo(
        () => projects.filter(p =>
            matchesAssignees(p.assignees, assigneeFilter)
            && (!q || `${p.project_id} ${p.title}`.toLowerCase().includes(q))),
        [projects, q, assigneeFilter],
    );
    const visibleIssues = useMemo(
        () => issues.filter(i =>
            // an issue belongs to whoever is responsible for its project
            matchesAssignees(i.project_assignees ?? [], assigneeFilter)
            && (!q || `${i.issue_id} ${i.project_id} ${i.project_title} ${i.description}`.toLowerCase().includes(q))),
        [issues, q, assigneeFilter],
    );

    const summary = useMemo(() => [
        { label: 'โปรเจกต์ทั้งหมด', value: projects.length },
        { label: 'กำลังดำเนินการ', value: projects.filter(p => p.status === 'In Progress').length },
        { label: 'เสร็จสิ้น', value: projects.filter(p => p.status === 'Done').length },
        { label: 'เลยกำหนดแผน', value: projects.filter(isOverdue).length, alert: true },
        { label: 'ปัญหาค้างอยู่', value: issues.filter(i => i.status !== 'Done' && i.status !== 'Reject').length, alert: true },
    ], [projects, issues]);

    const tabs: { value: View; label: string; count: number }[] = [
        { value: 'projects', label: 'โปรเจกต์', count: projects.length },
        { value: 'issues', label: 'ปัญหาที่แจ้ง', count: issues.length },
    ];

    return (
        <main className="flex-1 min-h-0 v2-canvas rounded-t-[1.5rem] sm:rounded-t-[2rem] lg:rounded-t-[3rem] shadow-2xl overflow-y-auto">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-5">

                {/* heading */}
                <div className="flex items-center gap-3">
                    <span className="v2-tile-sun w-11 h-11 rounded-[15px] grid place-items-center shrink-0">
                        <ChartNoAxesCombined className="w-5 h-5" />
                    </span>
                    <div className="min-w-0">
                        <h2 className="font-display text-xl sm:text-2xl font-semibold text-ink-900 leading-tight">สถานะโปรเจกต์ OPS</h2>
                        <p className="text-[13px] text-ink-500">
                            {canManage ? 'ลากการ์ดเพื่อเปลี่ยนสถานะ · มอบหมายงานได้ที่การ์ดสถานะ Open' : 'อัปเดตโดยทีมผู้ดูแลโปรเจกต์ · เลือกการ์ดเพื่อดูรายละเอียด'}
                        </p>
                    </div>
                </div>

                <Summary items={summary} />

                {/* tabs + filters */}
                <div className="flex flex-col md:flex-row md:items-center gap-3">
                    <Pills<View>
                        label="ประเภทข้อมูล"
                        value={view}
                        onChange={setView}
                        options={tabs.map(t => ({
                            value: t.value,
                            label: <>{t.label}<span className={cn('rounded-full px-1.5 text-[11px] tabular-nums', view === t.value ? 'bg-white/25' : 'bg-brand-50 text-brand-700')}>{t.count}</span></>,
                        }))}
                    />
                    <div className="flex items-center gap-2 md:ml-auto">
                        <div className="relative flex-1 md:w-64">
                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-300" />
                            <input
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder={view === 'issues' ? 'ค้นหาปัญหา' : 'ค้นหาโปรเจกต์ / ID'}
                                aria-label="ค้นหา"
                                className="v2-glass w-full h-11 pl-10 pr-4 rounded-full text-sm text-ink-900 placeholder:text-ink-300 focus:outline-none focus:ring-2 focus:ring-brand-400/40"
                            />
                        </div>
                        <AssigneeFilter team={team} value={assigneeFilter} onChange={setAssigneeFilter} me={user ? toPerson(user) : null} />
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
                    <KanbanBoard
                        items={visibleProjects}
                        getKey={p => p.project_id}
                        onMove={canManage ? moveProject : undefined}
                        landedKey={landedKey}
                        renderCard={p => (
                            <ProjectKanbanCard
                                p={p}
                                team={team}
                                onOpen={() => setOpenProjectId(p.project_id)}
                                onAssign={canManage ? (people) => assignProject(p, people) : undefined}
                            />
                        )}
                    />
                ) : (
                    <KanbanBoard
                        items={visibleIssues}
                        getKey={i => i.issue_id}
                        onMove={canManage ? moveIssue : undefined}
                        landedKey={landedKey}
                        renderCard={i => <IssueKanbanCard i={i} onOpen={() => setOpenIssueId(i.issue_id)} />}
                    />
                )}
            </div>

            <ProjectDetailSheet
                project={openProject}
                issues={issues}
                team={team}
                onClose={() => setOpenProjectId(null)}
                onOpenIssue={(i) => { setOpenProjectId(null); setOpenIssueId(i.issue_id); }}
                onEstimateChange={canManage ? setEstimate : undefined}
                onReview={user ? reviewProject : undefined}
                onMove={canManage ? moveProject : undefined}
            />
            <IssueDetailSheet
                issue={openIssue}
                team={team}
                onClose={() => setOpenIssueId(null)}
                onReview={user ? reviewIssue : undefined}
                onMove={canManage ? moveIssue : undefined}
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
