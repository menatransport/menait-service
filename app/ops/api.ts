import type {
    OpsApiError, OpsAttachment, OpsComment, OpsCommentRef, OpsPerson, OpsScope, OpsStatus, Project, ProjectIssue,
    ProjectIssueInput, ProjectRequestInput, ReviewInput,
} from './types';
import { buildSeed, buildCommentSeed, type MockComment } from './mock-data';

/**
 * Client for the OPS endpoints described in ./schema/ops.schema.json.
 *
 * While the backend is not ready every call is served from in-memory mock data.
 * Once the routes under /api/ops exist, set USE_MOCK = false — the pages don't change.
 */
const USE_MOCK = true;

/** Only the mock uses `me`; the real backend reads the requester from the session. */
export interface OpsCaller {
    me: OpsPerson;
}

export class OpsRequestError extends Error {
    constructor(public body: OpsApiError) {
        super(body.error);
    }
}

async function http<T>(url: string, init?: RequestInit): Promise<T> {
    const res = await fetch(url, init);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new OpsRequestError({ error: data?.error || `HTTP ${res.status}`, field_errors: data?.field_errors });
    return data as T;
}

const json = (method: string, body: unknown): RequestInit => ({
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
});

async function uploadAttachments(refType: 'project' | 'issue', refId: string, files: File[]) {
    for (const file of files) {
        const form = new FormData();
        form.append('ref_type', refType);
        form.append('ref_id', refId);
        form.append('file', file);
        await http<OpsAttachment>('/api/ops/attachments', { method: 'POST', body: form });
    }
}

// ─────────────────────────────── mock store ───────────────────────────────

let store: ReturnType<typeof buildSeed> | null = null;
const db = (me: OpsPerson) => (store ??= buildSeed(me));
const wait = (ms = 450) => new Promise(r => setTimeout(r, ms));
const nextId = (prefix: string, taken: string[]) =>
    `${prefix}-${new Date().getFullYear()}-${String(taken.length + 1).padStart(4, '0')}`;

const toMockAttachments = (files: File[]): OpsAttachment[] =>
    files.map((f, i) => ({
        attachment_id: `mock-${Date.now()}-${i}`,
        file_name: f.name,
        mime_type: f.type || 'application/octet-stream',
        size: f.size,
        url: URL.createObjectURL(f),
        uploaded_at: new Date().toISOString(),
    }));

const openIssueCount = (projectId: string, issues: ProjectIssue[]) =>
    issues.filter(i => i.project_id === projectId && i.status !== 'Done' && i.status !== 'Reject').length;

// ─────────────────────────────── public API ───────────────────────────────

export async function createProject(input: ProjectRequestInput, files: File[], { me }: OpsCaller) {
    if (!USE_MOCK) {
        const { project_id } = await http<{ project_id: string }>('/api/ops/projects', json('POST', input));
        await uploadAttachments('project', project_id, files);
        return { project_id };
    }
    await wait(700);
    const s = db(me);
    const now = new Date().toISOString();
    const project: Project = {
        ...input,
        project_id: nextId('OPS', s.projects.map(p => p.project_id)),
        status: 'Open',
        requested_by: me,
        assignees: [],
        progress: null,
        attachments: toMockAttachments(files),
        status_history: [{ status: 'Open', changed_at: now, changed_by: me, remark: null }],
        issue_count: 0,
        created_at: now,
        updated_at: now,
    };
    s.projects.unshift(project);
    return { project_id: project.project_id };
}

export async function listProjects(scope: OpsScope, { me }: OpsCaller): Promise<Project[]> {
    if (!USE_MOCK) return http<Project[]>(`/api/ops/projects?scope=${scope}`);
    await wait();
    const s = db(me);
    return s.projects
        .filter(p => scope === 'all' || p.requested_by.employee_id === me.employee_id)
        .map(p => ({ ...p, issue_count: openIssueCount(p.project_id, s.issues) }));
}

export async function createIssue(input: ProjectIssueInput, files: File[], { me }: OpsCaller) {
    if (!USE_MOCK) {
        const { issue_id } = await http<{ issue_id: string }>('/api/ops/issues', json('POST', input));
        await uploadAttachments('issue', issue_id, files);
        return { issue_id };
    }
    await wait(700);
    const s = db(me);
    const now = new Date().toISOString();
    const issue: ProjectIssue = {
        ...input,
        issue_id: nextId('ISS', s.issues.map(i => i.issue_id)),
        project_title: s.projects.find(p => p.project_id === input.project_id)?.title ?? input.project_id,
        project_assignees: s.projects.find(p => p.project_id === input.project_id)?.assignees ?? [],
        status: 'Open',
        reported_by: me,
        attachments: toMockAttachments(files),
        status_history: [{ status: 'Open', changed_at: now, changed_by: me, remark: null }],
        created_at: now,
        updated_at: now,
    };
    s.issues.unshift(issue);
    return { issue_id: issue.issue_id };
}

export async function listIssues(scope: OpsScope, { me }: OpsCaller): Promise<ProjectIssue[]> {
    if (!USE_MOCK) return http<ProjectIssue[]>(`/api/ops/issues?scope=${scope}`);
    await wait();
    const s = db(me);
    return s.issues
        .filter(i => scope === 'all' || i.reported_by.employee_id === me.employee_id)
        // assignees can change after the issue was filed, so read them from the project
        .map(i => ({ ...i, project_assignees: s.projects.find(p => p.project_id === i.project_id)?.assignees ?? [] }));
}

/** Card dragged to another column. `remark` is required for Reject. */
export async function updateProjectStatus(projectId: string, status: OpsStatus, remark: string | null, { me }: OpsCaller) {
    if (!USE_MOCK) return http<Project>(`/api/ops/projects/${projectId}/status`, json('PATCH', { status, remark }));
    await wait(300);
    const p = db(me).projects.find(x => x.project_id === projectId);
    if (!p) throw new OpsRequestError({ error: 'ไม่พบโปรเจกต์' });
    const now = new Date().toISOString();
    Object.assign(p, { status, updated_at: now });
    p.status_history.push({ status, changed_at: now, changed_by: me, remark });
    return { ...p };
}

export async function updateIssueStatus(issueId: string, status: OpsStatus, remark: string | null, { me }: OpsCaller) {
    if (!USE_MOCK) return http<ProjectIssue>(`/api/ops/issues/${issueId}/status`, json('PATCH', { status, remark }));
    await wait(300);
    const i = db(me).issues.find(x => x.issue_id === issueId);
    if (!i) throw new OpsRequestError({ error: 'ไม่พบรายการปัญหา' });
    const now = new Date().toISOString();
    Object.assign(i, { status, updated_at: now });
    i.status_history.push({ status, changed_at: now, changed_by: me, remark });
    return { ...i };
}

/** Replaces the whole assignee list (only while the project is Open). */
export async function updateProjectAssignees(projectId: string, people: OpsPerson[], { me }: OpsCaller) {
    const usernames = people.map(p => p.username).filter(Boolean);
    if (!USE_MOCK) return http<Project>(`/api/ops/projects/${projectId}/assignees`, json('PATCH', { usernames }));
    await wait(250);
    const p = db(me).projects.find(x => x.project_id === projectId);
    if (!p) throw new OpsRequestError({ error: 'ไม่พบโปรเจกต์' });
    Object.assign(p, { assignees: people, updated_at: new Date().toISOString() });
    return { ...p };
}

/** Anyone signed in records a review while the item is in Review. The status does not change — the team moves it. */
export async function submitReview(ref: 'project' | 'issue', id: string, input: ReviewInput, { me }: OpsCaller) {
    const path = `/api/ops/${ref === 'project' ? 'projects' : 'issues'}/${id}/review`;
    if (!USE_MOCK) return http<Project | ProjectIssue>(path, json('POST', input));
    await wait(450);
    const s = db(me);
    const item = ref === 'project' ? s.projects.find(x => x.project_id === id) : s.issues.find(x => x.issue_id === id);
    if (!item) throw new OpsRequestError({ error: 'ไม่พบรายการ' });
    if (item.status !== 'Review') throw new OpsRequestError({ error: 'รายการนี้ไม่ได้อยู่ในขั้นรีวิว' });
    const now = new Date().toISOString();
    Object.assign(item, { updated_at: now, review: { result: input.result, by: me, at: now, note: input.note ?? null } });
    return { ...item };
}

export type ProjectPlanInput = Partial<Pick<Project, 'planned_start' | 'planned_end' | 'progress'>>;

/** Estimated finish date (planned_end) and the rest of the plan. */
export async function updateProjectPlan(projectId: string, plan: ProjectPlanInput, { me }: OpsCaller) {
    if (!USE_MOCK) return http<Project>(`/api/ops/projects/${projectId}/plan`, json('PATCH', plan));
    await wait(250);
    const p = db(me).projects.find(x => x.project_id === projectId);
    if (!p) throw new OpsRequestError({ error: 'ไม่พบโปรเจกต์' });
    Object.assign(p, plan, { updated_at: new Date().toISOString() });
    return { ...p };
}

// ─────────────────────────────── comments ───────────────────────────────

let commentStore: MockComment[] | null = null;
const comments = (me: OpsPerson) => (commentStore ??= buildCommentSeed(db(me)));
const commentsPath = (ref: OpsCommentRef, refId: string) => `/api/ops/${ref === 'project' ? 'projects' : 'issues'}/${refId}/comments`;

const toComment = ({ liked_by, ...c }: MockComment, me: OpsPerson): OpsComment => ({
    ...c,
    like_count: liked_by.length,
    liked_by_me: liked_by.includes(me.employee_id),
});

export async function listComments(ref: OpsCommentRef, refId: string, { me }: OpsCaller): Promise<OpsComment[]> {
    if (!USE_MOCK) return http<OpsComment[]>(commentsPath(ref, refId));
    await wait(350);
    return comments(me).filter(c => c.ref_type === ref && c.ref_id === refId).map(c => toComment(c, me));
}

export async function createComment(ref: OpsCommentRef, refId: string, body: string, { me }: OpsCaller): Promise<OpsComment> {
    if (!USE_MOCK) return http<OpsComment>(commentsPath(ref, refId), json('POST', { body }));
    await wait(300);
    const c: MockComment = {
        comment_id: `cmt-${Date.now()}`, ref_type: ref, ref_id: refId, author: me, body,
        created_at: new Date().toISOString(), liked_by: [],
    };
    comments(me).push(c);
    return toComment(c, me);
}

const ownComment = (commentId: string, me: OpsPerson) => {
    const c = comments(me).find(x => x.comment_id === commentId);
    if (!c) throw new OpsRequestError({ error: 'ไม่พบความคิดเห็น' });
    const mine = c.author.employee_id === me.employee_id || (c.author.username && c.author.username === me.username);
    if (!mine) throw new OpsRequestError({ error: 'แก้ไขได้เฉพาะความคิดเห็นของตัวเอง' });
    return c;
};

/** Author only. */
export async function updateComment(commentId: string, body: string, { me }: OpsCaller): Promise<OpsComment> {
    if (!USE_MOCK) return http<OpsComment>(`/api/ops/comments/${commentId}`, json('PATCH', { body }));
    await wait(250);
    const c = ownComment(commentId, me);
    Object.assign(c, { body, edited_at: new Date().toISOString() });
    return toComment(c, me);
}

/** Author only. */
export async function deleteComment(commentId: string, { me }: OpsCaller): Promise<void> {
    if (!USE_MOCK) {
        const res = await fetch(`/api/ops/comments/${commentId}`, { method: 'DELETE' });
        if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new OpsRequestError({ error: data?.error || `HTTP ${res.status}` });
        }
        return;
    }
    await wait(250);
    ownComment(commentId, me);
    commentStore = comments(me).filter(x => x.comment_id !== commentId);
}

/** like = true → PUT, false → DELETE. Returns the server's count. */
export async function setCommentLike(commentId: string, like: boolean, { me }: OpsCaller) {
    if (!USE_MOCK) return http<{ like_count: number; liked_by_me: boolean }>(`/api/ops/comments/${commentId}/like`, { method: like ? 'PUT' : 'DELETE' });
    await wait(200);
    const c = comments(me).find(x => x.comment_id === commentId);
    if (!c) throw new OpsRequestError({ error: 'ไม่พบความคิดเห็น' });
    c.liked_by = like ? [...new Set([...c.liked_by, me.employee_id])] : c.liked_by.filter(id => id !== me.employee_id);
    return { like_count: c.liked_by.length, liked_by_me: like };
}
