import type {
    OpsApiError, OpsAttachment, OpsComment, OpsCommentRef, OpsPerson, OpsScope, OpsStatus, Project, ProjectEditInput, ProjectIssue,
    ProjectIssueInput, ProjectRequestInput, ProjectTask, ProjectTaskEditInput, ProjectTaskInput, ReviewInput,
} from './types';

/**
 * Client for the OPS endpoints described in ./schema/ops.schema.json.
 * /api/ops/* forwards to the ncacdb backend, which reads the caller from the session and owns every rule.
 */

export class OpsRequestError extends Error {
    constructor(public body: OpsApiError) {
        super(body.error);
    }
}

async function http<T>(url: string, init?: RequestInit): Promise<T> {
    const res = await fetch(url, init);
    if (res.status === 204) return undefined as T;
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

const usernamesOf = (people: OpsPerson[]) => people.map(p => p.username).filter(Boolean);

// ─────────────────────────────── projects & issues ───────────────────────────────

export async function createProject(input: ProjectRequestInput, files: File[]) {
    const { project_id } = await http<{ project_id: string }>('/api/ops/projects', json('POST', input));
    await uploadAttachments('project', project_id, files);
    return { project_id };
}

export const listProjects = (scope: OpsScope) => http<Project[]>(`/api/ops/projects?scope=${scope}`);

/** Edit the request itself — allowed when project.can_edit (the backend re-checks). */
export const updateProject = (projectId: string, input: ProjectEditInput) =>
    http<Project>(`/api/ops/projects/${projectId}`, json('PATCH', input));

export async function createIssue(input: ProjectIssueInput, files: File[]) {
    const { issue_id } = await http<{ issue_id: string }>('/api/ops/issues', json('POST', input));
    await uploadAttachments('issue', issue_id, files);
    return { issue_id };
}

export const listIssues = (scope: OpsScope) => http<ProjectIssue[]>(`/api/ops/issues?scope=${scope}`);

/** Card dragged to another column. `remark` is required for Reject. */
export const updateProjectStatus = (projectId: string, status: OpsStatus, remark: string | null) =>
    http<Project>(`/api/ops/projects/${projectId}/status`, json('PATCH', { status, remark }));

export const updateIssueStatus = (issueId: string, status: OpsStatus, remark: string | null) =>
    http<ProjectIssue>(`/api/ops/issues/${issueId}/status`, json('PATCH', { status, remark }));

/** Replaces the whole assignee list (not once the project is Done/Reject). */
export const updateProjectAssignees = (projectId: string, people: OpsPerson[]) =>
    http<Project>(`/api/ops/projects/${projectId}/assignees`, json('PATCH', { usernames: usernamesOf(people) }));

/** Anyone signed in records a review while the item is in Review. The status does not change — the team moves it. */
export const submitReview = (ref: 'project' | 'issue', id: string, input: ReviewInput) =>
    http<Project | ProjectIssue>(`/api/ops/${ref === 'project' ? 'projects' : 'issues'}/${id}/review`, json('POST', input));

/** OPS team / admin, Done projects only. null removes it. */
export const updateProjectLink = (projectId: string, url: string | null) =>
    http<Project>(`/api/ops/projects/${projectId}/link`, json('PATCH', { url }));

export type ProjectPlanInput = Partial<Pick<Project, 'planned_start' | 'planned_end' | 'progress'>>;

/** Estimated finish date (planned_end) and the rest of the plan. */
export const updateProjectPlan = (projectId: string, plan: ProjectPlanInput) =>
    http<Project>(`/api/ops/projects/${projectId}/plan`, json('PATCH', plan));

// ─────────────────────────────── tasks ───────────────────────────────

export const listTasks = (scope: OpsScope) => http<ProjectTask[]>(`/api/ops/tasks?scope=${scope}`);

/** Not under a Reject project (Done is allowed, for follow-up fixes); the creator becomes the owner. */
export const createTask = (input: ProjectTaskInput) => http<ProjectTask>('/api/ops/tasks', json('POST', input));

export const updateTaskStatus = (taskId: string, status: OpsStatus) =>
    http<ProjectTask>(`/api/ops/tasks/${taskId}/status`, json('PATCH', { status }));

/** Rename until Done; move it under another project (not Reject) while Open. */
export const updateTask = (taskId: string, input: ProjectTaskEditInput) =>
    http<ProjectTask>(`/api/ops/tasks/${taskId}`, json('PATCH', input));

/** Until Done/Reject. Replaces the co-assignee list; the owner is never in it. */
export const updateTaskAssignees = (taskId: string, people: OpsPerson[]) =>
    http<ProjectTask>(`/api/ops/tasks/${taskId}/assignees`, json('PATCH', { usernames: usernamesOf(people) }));

/** Until Done/Reject. null clears the due date. */
export const updateTaskPlan = (taskId: string, plan: { due_date: string | null }) =>
    http<ProjectTask>(`/api/ops/tasks/${taskId}/plan`, json('PATCH', plan));

/** Owner / co-assignee / admin, until Done. Empty or null clears it. */
export const updateTaskNote = (taskId: string, note: string | null) =>
    http<ProjectTask>(`/api/ops/tasks/${taskId}/note`, json('PATCH', { note }));

/** Same people as the note. Images only, up to 10 per task. */
export function uploadTaskImage(taskId: string, file: File) {
    const form = new FormData();
    form.append('file', file);
    return http<OpsAttachment>(`/api/ops/tasks/${taskId}/attachments`, { method: 'POST', body: form });
}

export const deleteTaskImage = (taskId: string, attachmentId: string) =>
    http<ProjectTask>(`/api/ops/tasks/${taskId}/attachments/${attachmentId}`, { method: 'DELETE' });

// ─────────────────────────────── comments ───────────────────────────────

const commentsPath = (ref: OpsCommentRef, refId: string) => `/api/ops/${ref === 'project' ? 'projects' : 'issues'}/${refId}/comments`;

export const listComments = (ref: OpsCommentRef, refId: string) => http<OpsComment[]>(commentsPath(ref, refId));

export function createComment(ref: OpsCommentRef, refId: string, body: string, images: File[] = []) {
    if (images.length === 0) return http<OpsComment>(commentsPath(ref, refId), json('POST', { body }));
    // text + images go in one multipart request, so the comment never appears without its pictures
    const form = new FormData();
    form.append('body', body);
    for (const file of images) form.append('files', file);
    return http<OpsComment>(commentsPath(ref, refId), { method: 'POST', body: form });
}

/** Author only. */
export const updateComment = (commentId: string, body: string) =>
    http<OpsComment>(`/api/ops/comments/${commentId}`, json('PATCH', { body }));

/** Author only. */
export const deleteComment = (commentId: string) => http<void>(`/api/ops/comments/${commentId}`, { method: 'DELETE' });

/** like = true → PUT, false → DELETE. Returns the server's count. */
export const setCommentLike = (commentId: string, like: boolean) =>
    http<{ like_count: number; liked_by_me: boolean }>(`/api/ops/comments/${commentId}/like`, { method: like ? 'PUT' : 'DELETE' });
