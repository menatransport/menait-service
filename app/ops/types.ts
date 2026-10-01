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
    priority_reason: string;
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
    created_at: string;
    updated_at: string;
}

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
}

export interface OpsApiError {
    error: string;
    field_errors?: Record<string, string>;
}

export type OpsScope = 'mine' | 'all';
