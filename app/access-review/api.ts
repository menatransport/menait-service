'use client';

import type {
    AdminRemovalRow, AdminReviewsResponse, AdminRole, AdminRoleItem, AdminSystem, AdminUserRole, AdminUserRolesResponse,
    ApiErrorBody, CatalogResponse, CatalogRolesResponse, DecisionAction, HistoryItem, ImportReport, ItemsResponse, MailPreview, MeResponse, PendingApprovalItem,
    ReviewChanges, ReviewDetail, ReviewLineInput, SystemCode,
} from './types';

/**
 * Client for the Access Review endpoints described in the plan (ncacdb /access-review/*).
 * /api/access-review/* forwards to ncacdb — see app/api/access-review/[...path]/route.ts.
 * The backend reads the caller from X-Employee-Id (set by the proxy) and owns every rule.
 */

export class AccessReviewError extends Error {
    constructor(public status: number, message: string) {
        super(message);
    }
}

async function http<T>(url: string, init?: RequestInit): Promise<T> {
    const res = await fetch(url, { cache: 'no-store', ...init });
    if (res.status === 204) return undefined as T;
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        const body = data as ApiErrorBody;
        throw new AccessReviewError(res.status, body?.detail || body?.error || `เกิดข้อผิดพลาด (${res.status})`);
    }
    return data as T;
}

const json = (method: string, body: unknown): RequestInit => ({
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
});

const qs = (params: Record<string, string | number | boolean | null | undefined>) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
        if (v !== null && v !== undefined && v !== '') sp.set(k, String(v));
    }
    const s = sp.toString();
    return s ? `?${s}` : '';
};

// ─────────────────────────────── me / lines / submit ───────────────────────────────

export const getMe = () => http<MeResponse>('/api/access-review/me');

/** All of my roles' full item lists in one call — used to render the one-page checklist. */
export const getMyItems = () => http<ItemsResponse>('/api/access-review/me/items');

/** Menus a requester can ask to add ("ต้องการเพิ่มสิทธิ์") — every distinct item of that system's roles. */
export const getCatalog = (system: SystemCode) =>
    http<CatalogResponse>(`/api/access-review/catalog${qs({ system })}`);

/** Whole roles a requester can ask to join ("ต้องการเพิ่มอีเมลกลุ่ม") — every active role of that system. */
export const getCatalogRoles = (system: SystemCode) =>
    http<CatalogRolesResponse>(`/api/access-review/catalog/roles${qs({ system })}`);

/** IT-only, read-only: the /me + /me/items an employee would get — powers the admin "ดูหน้าตา Dialog" preview. */
export const adminPreviewMe = (employeeId: string) =>
    http<MeResponse>(`/api/access-review/admin/preview/${encodeURIComponent(employeeId)}`);
export const adminPreviewItems = (employeeId: string) =>
    http<ItemsResponse>(`/api/access-review/admin/preview/${encodeURIComponent(employeeId)}/items`);

/** Same shape, for viewing/approving someone else's submitted review. */
export const getReviewItems = (id: number) => http<ItemsResponse>(`/api/access-review/${id}/items`);

/** requestedRoleIds: whole roles to join (Email groups); undefined = leave the stored set as is. */
export const saveLines = (lines: ReviewLineInput[], requesterNote?: string | null, requestedRoleIds?: number[]) =>
    http<MeResponse>('/api/access-review/me/lines', json('PUT', { lines, requester_note: requesterNote ?? undefined, requested_role_ids: requestedRoleIds }));

export const submitReview = (lines: ReviewLineInput[], requesterNote?: string | null, requestedRoleIds?: number[]) =>
    http<ReviewDetail>('/api/access-review/me/submit', json('POST', { lines, requester_note: requesterNote ?? undefined, requested_role_ids: requestedRoleIds }));

export const getPending = () => http<PendingApprovalItem[]>('/api/access-review/pending');

/** รายการที่เสร็จสิ้นแล้ว (approved/rejected) — same shape as /pending plus the outcome. */
export const getHistory = () => http<HistoryItem[]>('/api/access-review/history');

export const getReview = (id: number) => http<ReviewDetail>(`/api/access-review/${id}`);

export const decideReview = (id: number, action: DecisionAction, comment?: string) =>
    http<ReviewDetail>(`/api/access-review/${id}/decision`, json('POST', { action, comment }));

export const getMailPreview = (id: number) => http<MailPreview>(`/api/access-review/${id}/mail-preview`);

// ─────────────────────────────── admin ───────────────────────────────

export const adminListSystems = () => http<AdminSystem[]>('/api/access-review/admin/systems');
export const adminCreateSystem = (input: { code: SystemCode; name: string; is_active?: boolean }) =>
    http<AdminSystem>('/api/access-review/admin/systems', json('POST', input));
export const adminUpdateSystem = (id: number, input: Partial<Pick<AdminSystem, 'name' | 'is_active'>>) =>
    http<AdminSystem>(`/api/access-review/admin/systems/${id}`, json('PUT', input));

export const adminListRoles = (params: { system_id?: number; q?: string; include_inactive?: boolean } = {}) =>
    http<AdminRole[]>(`/api/access-review/admin/roles${qs(params)}`);
export const adminCreateRole = (input: { system_id: number; name: string }) =>
    http<AdminRole>('/api/access-review/admin/roles', json('POST', input));
export const adminUpdateRole = (id: number, input: { name?: string; is_active?: boolean }) =>
    http<AdminRole>(`/api/access-review/admin/roles/${id}`, json('PUT', input));
export const adminDeleteRole = (id: number) =>
    http<void>(`/api/access-review/admin/roles/${id}`, { method: 'DELETE' });

export const adminListRoleItems = (roleId: number) =>
    http<AdminRoleItem[]>(`/api/access-review/admin/roles/${roleId}/items`);
export const adminCreateRoleItem = (roleId: number, input: { category: string; item?: string; permission?: string }) =>
    http<AdminRoleItem>(`/api/access-review/admin/roles/${roleId}/items`, json('POST', input));
/** Copies the source role's items into roleId (same system only); items already there are skipped. */
export const adminCopyRoleItems = (roleId: number, sourceRoleId: number) =>
    http<{ added: number; role: AdminRole }>(`/api/access-review/admin/roles/${roleId}/copy-items`, json('POST', { source_role_id: sourceRoleId }));
export const adminUpdateRoleItem = (itemId: number, input: Partial<Pick<AdminRoleItem, 'category' | 'item' | 'permission'>>) =>
    http<AdminRoleItem>(`/api/access-review/admin/role-items/${itemId}`, json('PUT', input));
export const adminDeleteRoleItem = (itemId: number) =>
    http<void>(`/api/access-review/admin/role-items/${itemId}`, { method: 'DELETE' });

// ar_accounts + ar_account_roles were merged into ar_user_roles — one employee × role row.
export const adminListUserRoles = (params: { system_id?: number; role_id?: number; q?: string; include_inactive?: boolean; page?: number; page_size?: number } = {}) =>
    http<AdminUserRolesResponse>(`/api/access-review/admin/user-roles${qs(params)}`);
export const adminCreateUserRole = (input: { employee_id: string; role_id: number; account_name?: string }) =>
    http<AdminUserRole>('/api/access-review/admin/user-roles', json('POST', input));
export const adminUpdateUserRole = (id: number, input: Partial<Pick<AdminUserRole, 'account_name' | 'is_active'>>) =>
    http<AdminUserRole>(`/api/access-review/admin/user-roles/${id}`, json('PUT', input));
export const adminDeleteUserRole = (id: number) =>
    http<void>(`/api/access-review/admin/user-roles/${id}`, { method: 'DELETE' });

export const adminListCycles = () => http<import('./types').Cycle[]>('/api/access-review/admin/cycles');
export const adminCreateCycle = (input: { name: string; start_date: string; end_date: string; is_open?: boolean }) =>
    http<import('./types').Cycle>('/api/access-review/admin/cycles', json('POST', input));
export const adminUpdateCycle = (id: number, input: Partial<{ name: string; start_date: string; end_date: string; is_open: boolean }>) =>
    http<import('./types').Cycle>(`/api/access-review/admin/cycles/${id}`, json('PUT', input));
export const adminDeleteCycle = (id: number) =>
    http<void>(`/api/access-review/admin/cycles/${id}`, { method: 'DELETE' });

export const adminGetReviews = (params: { cycle_id?: number; status?: string; division_id?: number } = {}) =>
    http<AdminReviewsResponse>(`/api/access-review/admin/reviews${qs(params)}`);

export const adminGetRemovals = (params: { cycle_id?: number; include_pending?: boolean } = {}) =>
    http<AdminRemovalRow[]>(`/api/access-review/admin/removals${qs(params)}`);

/** Before → after of one review, per role (the role's items at submit vs what is left after unticking). */
export const adminGetReviewChanges = (reviewId: number) =>
    http<ReviewChanges>(`/api/access-review/admin/reviews/${reviewId}/changes`);

export async function adminImport(system: SystemCode, file: File, dryRun: boolean) {
    const form = new FormData();
    form.append('system', system);
    form.append('dry_run', String(dryRun));
    form.append('file', file);
    const res = await fetch('/api/access-review/admin/import', { method: 'POST', body: form, cache: 'no-store' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        const body = data as ApiErrorBody;
        throw new AccessReviewError(res.status, body?.detail || body?.error || `นำเข้าข้อมูลไม่สำเร็จ (${res.status})`);
    }
    return data as ImportReport;
}
