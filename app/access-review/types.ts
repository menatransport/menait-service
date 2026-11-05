// Types for the Access Review feature — mirrors the ncacdb contract exactly (prefix /access-review).
// See app/access-review/api.ts for the client and app/api/access-review/[...path]/route.ts for the proxy.

export type SystemCode = 'ATMS' | 'WINSPEED' | 'EMAIL';

export type Decision = 'keep' | 'remove';

export type ReviewStatus = 'draft' | 'pending' | 'approved' | 'rejected';

/** /me.route_preview and /pending[].route and /{id}.route */
export type RoutePreview = 'dept_head' | 'division' | 'it_queue' | 'bypass';

export interface AccountRoleLine {
    user_role_id: number;
    account_name: string;
    role_id: number;
    role_name: string;
    item_count: number;
    /** Items NOT granted — everything else starts (and defaults to) ticked/granted */
    unchecked_item_ids: number[];
    /** "keep" when no line has been saved yet; only meaningful on its own for item-less roles */
    decision: Decision;
    note: string | null;
}

export interface ReviewSystem {
    code: SystemCode;
    name: string;
    roles: AccountRoleLine[];
}

export interface Cycle {
    id: number;
    name: string;
    start_date: string;
    end_date: string;
    is_open: boolean;
}

export interface ReviewSummary {
    id: number;
    status: ReviewStatus;
    route: RoutePreview;
    submitted_at: string | null;
    decided_by: string | null;
    decided_by_name: string | null;
    decided_at: string | null;
    comment: string | null;
    requester_note: string | null;
    /** Who approves next right now — empty once bypass/it_queue or fully decided */
    next_approver_names: string[];
}

export interface ApproverPreview {
    employee_id: string;
    name: string;
    position: string | null;
    email: string | null;
}

export interface MeResponse {
    is_admin: boolean;
    has_pending_approvals: number;
    cycle: Cycle | null;
    review: ReviewSummary | null;
    systems: ReviewSystem[];
    approvers_preview: ApproverPreview[];
    route_preview: RoutePreview;
    /** The requester's own saved note, prefilled into "ข้อเสนอแนะ (ผู้แจ้ง)" */
    requester_note: string | null;
}

export interface RoleItem {
    id: number;
    category: string;
    item: string | null;
    permission: string | null;
    /** false = removed from the source system since; can only still appear if it was unticked before — render "(ยกเลิกในระบบแล้ว)" and not tickable */
    is_active: boolean;
}

/** One role's full item list, as returned in bulk by /me/items and /{id}/items — Email roles: items: [] */
export interface ItemsRole {
    user_role_id: number;
    role_id: number;
    role_name: string;
    system_code: SystemCode;
    items: RoleItem[];
}

export interface ItemsResponse {
    roles: ItemsRole[];
}

export interface ReviewLineInput {
    user_role_id: number;
    /** Items the requester unticked — everything else stays granted. Replaces the whole set for this line. */
    unchecked_item_ids: number[];
    /** Only honoured for item-less (Email) roles */
    decision?: Decision;
}

export interface RequesterInfo {
    employee_id: string;
    name: string;
    position: string | null;
    department: string | null;
    division: string | null;
    image_url: string | null;
}

/** Row shape shared by GET /pending and GET /history (newest first; history = approved/rejected I own or decided) */
export interface ApprovalRow {
    id: number;
    requester: RequesterInfo;
    submitted_at: string;
    total_lines: number;
    /** Whole-role removals */
    remove_count: number;
    /** Unticked items on roles that were otherwise kept */
    unchecked_count: number;
    route: RoutePreview;
    status: ReviewStatus;
    next_approver_names: string[];
    decided_at: string | null;
    decided_by_name: string | null;
}

export type PendingApprovalItem = ApprovalRow;
export type HistoryItem = ApprovalRow;

export interface ReviewLineDetail {
    id: number;
    user_role_id: number;
    system_code: SystemCode;
    system_name: string;
    role_id: number;
    role_name: string;
    account_name: string;
    /** Role-level roll-up: 'remove' if anything under it was unticked (or the item-less decision) */
    decision: Decision;
    note: string | null;
    item_count: number;
    unchecked_item_ids: number[];
    unchecked_count: number;
}

export interface ReviewApprover {
    employee_id: string;
    name: string;
    position: string | null;
}

export interface ReviewDetail {
    id: number;
    status: ReviewStatus;
    route: RoutePreview;
    cycle: { id: number; name: string };
    requester: RequesterInfo;
    lines: ReviewLineDetail[];
    approvers: ReviewApprover[];
    can_decide: boolean;
    submitted_at: string | null;
    decided_by: string | null;
    decided_by_name: string | null;
    decided_at: string | null;
    comment: string | null;
    requester_note: string | null;
    /** Filled only while pending; ["ผู้ดูแลระบบ IT"] for the it_queue route */
    next_approver_names: string[];
}

export type DecisionAction = 'approve' | 'reject';

export interface MailPreview {
    to: string[];
    subject: string;
    html: string;
}

export interface ApiErrorBody {
    detail?: string;
    error?: string;
}

// ───────────────────────────── Admin ─────────────────────────────

export interface AdminSystem {
    id: number;
    code: SystemCode;
    name: string;
    is_active: boolean;
}

export interface AdminRole {
    id: number;
    system_id: number;
    system_code: SystemCode;
    name: string;
    is_active: boolean;
    item_count: number;
    /** was account_count — ar_accounts/ar_account_roles were merged into ar_user_roles */
    user_count: number;
}

export interface AdminRoleItem {
    id: number;
    category: string;
    item: string | null;
    permission: string | null;
}

/**
 * One employee × role assignment — ar_accounts + ar_account_roles merged into ar_user_roles.
 * The system follows from the role (role_id → system_id/system_code).
 */
export interface AdminUserRole {
    id: number;
    employee_id: string;
    employee_name: string;
    department: string | null;
    division: string | null;
    email: string | null;
    system_id: number;
    system_code: SystemCode;
    role_id: number;
    role_name: string;
    /** Blank/omitted for Email Group — it has no per-person account name */
    account_name: string | null;
    is_active: boolean;
    /** Additive — whether the role itself (not just this assignment) is still active */
    role_is_active?: boolean;
    /** Additive — ตำแหน่ง (Thai position name); null until the backend sends it */
    position?: string | null;
    updated_at: string;
}

export interface AdminUserRolesResponse {
    items: AdminUserRole[];
    total: number;
    page: number;
    page_size: number;
}

export interface ImportReport {
    system: SystemCode;
    dry_run: boolean;
    roles_added: number;
    roles_updated: number;
    items_replaced: number;
    /** Additive counters */
    roles_in_file?: number;
    employees_in_file?: number;
    user_roles_in_file?: number;
    user_roles_added?: number;
    user_roles_updated?: number;
    user_roles_reactivated?: number;
    user_roles_deactivated?: number;
    items_added?: number;
    items_reactivated?: number;
    items_deleted?: number;
    /** Items kept (soft-deleted, not hard-deleted) only so past review history still resolves them */
    items_kept_for_history?: number;
    warnings?: string[];
    unmatched: { account_name: string; employee_id: string | null; role_name: string; reason: string }[];
}

export interface AdminReviewSummaryCounts {
    total_people: number;
    not_started: number;
    draft: number;
    pending: number;
    approved: number;
    rejected: number;
}

export type AdminReviewRowStatus = ReviewStatus | 'not_started';

export interface AdminReviewRow {
    employee_id: string;
    name: string;
    department: string | null;
    division: string | null;
    status: AdminReviewRowStatus;
    route: RoutePreview | null;
    submitted_at: string | null;
    decided_at: string | null;
    remove_count: number;
    total_lines: number;
    review_id: number | null;
    /** Additive — unticked items on otherwise-kept roles */
    unchecked_count?: number;
    /** Additive — who decides next while pending (["ผู้ดูแลระบบ IT"] for the IT queue) */
    next_approver_names?: string[];
    /** Additive — who approved / rejected */
    decided_by_name?: string | null;
}

export interface AdminReviewsResponse {
    summary: AdminReviewSummaryCounts;
    items: AdminReviewRow[];
    /** Additive — the cycle this summary is for */
    cycle?: { id: number; name: string };
}

/**
 * One row per removal — "role" = the whole ar_user_roles assignment was unticked (category/item/
 * permission null), "item" = a single permission within an otherwise-kept role was unticked.
 */
export interface AdminRemovalRow {
    employee_id: string;
    name: string;
    department: string | null;
    system_code: SystemCode;
    role_name: string;
    removal_type: 'role' | 'item';
    role_item_id: number | null;
    category: string | null;
    item: string | null;
    permission: string | null;
    account_name: string;
    note: string | null;
    requester_note: string | null;
    decided_at: string | null;
    decided_by_name: string | null;
    review_id: number;
    user_role_id: number;
    /** Whether IT has already deactivated this assignment in ar_user_roles */
    user_role_active: boolean;
    /** Additive — 'pending' rows only appear with include_pending */
    status?: ReviewStatus;
}

/** One role of GET /admin/reviews/{id}/changes — before = the role's items at submit, after = before − unticked. */
export interface ReviewChangeLine {
    user_role_id: number;
    system_code: SystemCode;
    system_name: string;
    role_id: number;
    role_name: string;
    account_name: string | null;
    decision: Decision;
    /** 'role' = whole role removed, 'items' = some items unticked, null = unchanged */
    change: 'role' | 'items' | null;
    /** false = submitted before snapshots existed (or a draft) → before is the role's current items */
    has_snapshot: boolean;
    before_count: number;
    after_count: number;
    removed: RoleItem[];
    /** Items added to the role after submit — the requester never reviewed them */
    added_since: RoleItem[];
    /** Items in "before" that have since been removed from the source system */
    retired_since: RoleItem[];
    note: string | null;
    user_role_active: boolean;
}

export interface ReviewChanges {
    review_id: number;
    status: ReviewStatus;
    requester: RequesterInfo;
    submitted_at: string | null;
    decided_at: string | null;
    decided_by_name: string | null;
    requester_note: string | null;
    comment: string | null;
    has_snapshot: boolean;
    lines: ReviewChangeLine[];
}
