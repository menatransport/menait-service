/**
 * Pure parts of the ADV (finance advance) viewer check — `canViewAdv` in lib/finance/server.ts does the BE calls.
 * Every check fails closed: anything that isn't the exact expected shape grants nothing.
 */

const asRecord = (v: unknown): Record<string, any> | null =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, any>) : null;

const sameId = (a: unknown, employeeId: string): boolean =>
  typeof a === 'string' && a !== '' && typeof employeeId === 'string' && employeeId !== '' && a === employeeId;

/** GET /finance/advances/{id} → requester.employee_id is the session user. */
export function isAdvRequester(detail: unknown, employeeId: string): boolean {
  return sameId(asRecord(asRecord(detail)?.requester)?.employee_id, employeeId);
}

/** GET /finance/advances/{id} → the session user approved a step of the current round (approval.step_approvals). */
export function isAdvStepApprover(detail: unknown, employeeId: string): boolean {
  const steps = asRecord(asRecord(detail)?.approval)?.step_approvals;
  return Array.isArray(steps) && steps.some(s => sameId(asRecord(s)?.employee_id, employeeId));
}

/** True when the advance detail alone lets the user view it (requester or current-round approver). */
export function advDetailGrantsView(detail: unknown, employeeId: string): boolean {
  return isAdvRequester(detail, employeeId) || isAdvStepApprover(detail, employeeId);
}

/** A BE list (pending approvals / approval history) contains an item with this form_id. */
export function listHasForm(list: unknown, formId: string): boolean {
  if (!Array.isArray(list) || typeof formId !== 'string' || formId === '') return false;
  return list.some(item => asRecord(item)?.form_id === formId);
}

/** Upload folders on an ADV: pay/check are Finance's; request (no folder) and clear are the requester's. */
export type AdvUploadRole = 'finance' | 'owner';
export function advUploadRole(folder: string): AdvUploadRole {
  return folder === 'pay' || folder === 'check' ? 'finance' : 'owner';
}
