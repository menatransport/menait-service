/**
 * Group OPS data contract — TypeScript mirror of app/ops/schema/ops.schema.json.
 * Keep both files in sync when a field changes.
 */

export const OPS_STATUSES = ['Open', 'To-Do', 'In Progress', 'Review', 'Done', 'Reject'] as const;
export type OpsStatus = (typeof OPS_STATUSES)[number];

export const OPS_PRIORITIES = ['Low', 'Medium', 'High', 'Critical'] as const;
export type OpsPriority = (typeof OPS_PRIORITIES)[number];

export interface OpsPerson {
    employee_id: string;
    name: string;
    /** IT-system username, e.g. "kittaboon.l" — the key used for assignment */
    username?: string | null;
    /** users.image_url from the IT system */
    image_url?: string | null;
    department?: string | null;
    position?: string | null;
}

export interface OpsAttachment {
    attachment_id: string;
    file_name: string;
    mime_type: string;
    size: number;
    url: string;
    uploaded_at?: string;
}

export type OpsReviewResult = 'passed' | 'changes_requested';

/** Latest review outcome. Recording it does not change the status — the OPS team moves the item. */
export interface OpsReview {
    result: OpsReviewResult;
    by: OpsPerson;
    at: string;
    note?: string | null;
}

/** POST /api/ops/{projects|issues}/{id}/review — only while status = Review, by anyone signed in */
export interface ReviewInput {
    result: OpsReviewResult;
    /** Required for changes_requested */
    note?: string | null;
}

export interface OpsStatusChange {
    status: OpsStatus;
    changed_at: string;
    changed_by: OpsPerson;
    remark?: string | null;
}

/** POST /api/ops/projects */
export interface ProjectRequestInput {
    title: string;
    objective: string;
    requirement: string;
    expected_benefit: string;
    estimated_users: number;
    user_groups?: string | null;
    priority: OpsPriority;
    /** YYYY-MM-DD */
    target_date?: string | null;
}

export interface Project extends ProjectRequestInput {
    project_id: string;
    status: OpsStatus;
    requested_by: OpsPerson;
    /** OPS team members working on it — set while the request is Open */
    assignees: OpsPerson[];
    /** Not shown on the board; kept for the (parked) Gantt view */
    progress?: number | null;
    /** YYYY-MM-DD, set by admin — drives the Gantt bar */
    planned_start?: string | null;
    planned_end?: string | null;
    attachments: OpsAttachment[];
    status_history: OpsStatusChange[];
    /** Latest review (null = never reviewed) */
    review?: OpsReview | null;
    issue_count: number;
    /** Where the finished system is used — OPS team / admin set it once Done (PATCH /api/ops/projects/{id}/link) */
    link_url?: string | null;
    /**
     * Whether the signed-in viewer may edit the request (PATCH /api/ops/projects/{id}), until Done/Reject:
     * imported by the system (requested_by.employee_id = "system") → its assignees; filed by a user → the requester's department.
     */
    can_edit?: boolean;
    /** Whether the viewer may rename it (PATCH /api/ops/projects/{id}/title): OPS team / admin or can_edit, any status except Done */
    can_rename?: boolean;
    created_at: string;
    updated_at: string;
}

/** PATCH /api/ops/projects/{id} — any subset of the request fields */
export type ProjectEditInput = Partial<ProjectRequestInput>;

/** POST /api/ops/issues */
export interface ProjectIssueInput {
    project_id: string;
    description: string;
}

export interface ProjectIssue extends ProjectIssueInput {
    issue_id: string;
    project_title: string;
    /** Denormalised from the project — who is responsible for fixing it */
    project_assignees: OpsPerson[];
    status: OpsStatus;
    reported_by: OpsPerson;
    attachments: OpsAttachment[];
    status_history: OpsStatusChange[];
    /** Reporter confirms the fix */
    review?: OpsReview | null;
    created_at: string;
    updated_at: string;
}

/** POST /api/ops/tasks — OPS team / admin, while the project is not Reject (Done allowed for follow-up fixes) */
export interface ProjectTaskInput {
    project_id: string;
    title: string;
    /** YYYY-MM-DD */
    due_date?: string | null;
}

/** PATCH /api/ops/tasks/{id} — OPS team / admin: title until Done; project_id while Open (same target rule as creating) */
export type ProjectTaskEditInput = Partial<Pick<ProjectTaskInput, 'title' | 'project_id'>>;

/** A piece of work the project's assignee creates and moves themselves. */
export interface ProjectTask extends ProjectTaskInput {
    task_id: string;
    /** Denormalised for the card */
    project_title: string;
    status: OpsStatus;
    /** Creator = the one responsible; co-assignees may be added until Done/Reject */
    owner: OpsPerson;
    /** OPS team members helping on it (owner not included); they may move it too */
    assignees: OpsPerson[];
    status_history: OpsStatusChange[];
    /** The responsible people's work note (PATCH /api/ops/tasks/{id}/note) — until Done */
    note?: string | null;
    note_updated_at?: string | null;
    note_updated_by?: OpsPerson | null;
    /** Pictures under the note — images only, up to 10 */
    attachments?: OpsAttachment[];
    /** Owner, co-assignee or admin, and the task is not Done: may edit the note and pictures */
    can_note?: boolean;
    created_at: string;
    updated_at: string;
}

export type OpsCommentRef = 'project' | 'issue';

/** GET /api/ops/{projects|issues}/{id}/comments — oldest first */
export interface OpsComment {
    comment_id: string;
    ref_type: OpsCommentRef;
    ref_id: string;
    author: OpsPerson;
    body: string;
    created_at: string;
    /** Set when the author edited the text */
    edited_at?: string | null;
    like_count: number;
    /** Whether the signed-in viewer has liked it */
    liked_by_me: boolean;
    /** Images posted with the comment (absent on older backends) */
    attachments?: OpsAttachment[];
}

/** POST /api/ops/surveys — question id → 1..5, all 5 per section. Answering again replaces the earlier answer. */
export interface OpsSurveyInput {
    /** An OPS project id (must be Review / Done) or a system from the Apps Script list */
    system_id: string;
    system_name?: string | null;
    section2: Record<number, number>;
    section3: Record<number, number>;
    comment?: string | null;
}

export interface OpsSurveyResponse {
    survey_id: string;
    system_id: string;
    system_name?: string | null;
    project_id?: string | null;
    respondent: OpsPerson;
    section2: Record<string, number>;
    section3: Record<string, number>;
    comment?: string | null;
    created_at: string;
    updated_at: string;
}

/** GET /api/ops/projects/{id}/surveys — OPS team / admin */
export interface OpsSurveyResults {
    project_id: string;
    count: number;
    /** Over every score; null when nobody answered */
    average: number | null;
    /** Average per question 1..5 */
    section2_avg: (number | null)[];
    section3_avg: (number | null)[];
    /** Newest first */
    responses: OpsSurveyResponse[];
}

export interface OpsApiError {
    error: string;
    field_errors?: Record<string, string>;
}

export type OpsScope = 'mine' | 'all';
