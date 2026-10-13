import { NextResponse, type NextRequest } from 'next/server';
import { verifyToken, COOKIE_NAME } from '@/lib/jwt';
import type { UserInfo } from '@/app/context/SessionContext';
import { FORM_ID_PATTERN } from '@/lib/s3';
import { isAdvTarget } from '@/lib/finance/formsubmit-guard';
import { advDetailGrantsView, isAdvRequester, listHasForm } from '@/lib/finance/adv-access';
import { errorBodyFrom } from '@/lib/finance/api-error';

export type Guard = { user: UserInfo } | { error: NextResponse };

export async function requireUser(req: NextRequest): Promise<Guard> {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  const user = token ? await verifyToken(token) : null;
  if (!user?.employee_id) {
    return { error: NextResponse.json({ error: 'กรุณาเข้าสู่ระบบ' }, { status: 401 }) };
  }
  return { user };
}

export async function requireFinance(req: NextRequest): Promise<Guard> {
  const guard = await requireUser(req);
  if ('error' in guard) return guard;
  if (!guard.user.is_finance) {
    return { error: NextResponse.json({ error: 'เฉพาะฝ่ายการเงินเท่านั้น' }, { status: 403 }) };
  }
  return guard;
}

export function beUrl(path: string, query: Record<string, string | null | undefined> = {}): string {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== null && value !== undefined && value !== '') qs.set(key, value);
  }
  const suffix = qs.toString();
  return `${process.env.URL_API}${path}${suffix ? `?${suffix}` : ''}`;
}

export async function proxy(url: string, init: RequestInit = {}): Promise<NextResponse> {
  try {
    const res = await fetch(url, {
      ...init,
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}) },
    });
    const text = await res.text();
    let data: any = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = { detail: text }; }
    if (!res.ok) {
      // detail ที่เป็น object (รายการเอกสารที่ขาด / ใบที่ซ้ำ) ต้องถึงหน้าจอครบ ไม่ยุบเป็นสตริง
      return NextResponse.json(errorBodyFrom(data, 'ข้อมูลไม่ถูกต้อง'), { status: res.status });
    }
    return NextResponse.json(data);
  } catch (err) {
    console.error('finance proxy error:', err);
    return NextResponse.json({ error: 'ไม่สามารถเชื่อมต่อระบบได้' }, { status: 502 });
  }
}

/**
 * Load a payee request from BE and enforce owner-or-finance.
 * Returns the request JSON, or a ready-made error response (404/403/502).
 */
export async function loadPayeeRequestFor(
  id: string,
  user: { employee_id: string; is_finance?: boolean },
  opts: { ownerOnly?: boolean } = {},
): Promise<{ data: any } | { error: NextResponse }> {
  if (!/^\d+$/.test(id)) return { error: NextResponse.json({ error: 'ไม่พบรายการ' }, { status: 404 }) };
  try {
    const res = await fetch(beUrl(`/finance/payee-requests/${id}`), { cache: 'no-store' });
    const data = await res.json().catch(() => null);
    if (!res.ok) return { error: NextResponse.json({ error: data?.detail ?? 'ไม่พบรายการ' }, { status: res.status }) };
    const isOwner = data?.employee_id === user.employee_id;
    if (!isOwner && (opts.ownerOnly || !user.is_finance)) {
      return { error: NextResponse.json({ error: 'ไม่มีสิทธิ์ในรายการนี้' }, { status: 403 }) };
    }
    return { data };
  } catch (err) {
    console.error('payee request lookup error:', err);
    return { error: NextResponse.json({ error: 'ไม่สามารถเชื่อมต่อระบบได้' }, { status: 502 }) };
  }
}

type AdvUser = Pick<UserInfo, 'employee_id' | 'is_finance'>;

/** GET a BE JSON resource; null on any non-2xx, network or parse error (callers fail closed). */
async function beJsonOrNull(url: string): Promise<unknown | null> {
  try {
    const res = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.error('finance BE lookup error:', err);
    return null;
  }
}

// Per-user lists used by canViewAdv (pending queue, approval history). The approvals page checks many ADVs
// at once, so share in-flight requests and keep array results briefly instead of re-asking the BE per row.
const LIST_TTL_MS = 45_000;
const listCache = new Map<string, { at: number; value: Promise<unknown | null> }>();

function cachedList(url: string): Promise<unknown | null> {
  const now = Date.now();
  const hit = listCache.get(url);
  if (hit && now - hit.at < LIST_TTL_MS) return hit.value;
  const value = beJsonOrNull(url).then(v => {
    if (!Array.isArray(v)) listCache.delete(url); // only successful lists are reused
    return v;
  });
  listCache.set(url, { at: now, value });
  if (listCache.size > 500) {
    for (const [k, e] of listCache) if (now - e.at >= LIST_TTL_MS) listCache.delete(k);
  }
  return value;
}

/**
 * Who may see an ADV (its values, logs and attachments): Finance; the requester; an approver of the current
 * round (approval.step_approvals); anyone whose ADV approval queue holds it now; and anyone who approved or
 * rejected it before (the detail's approval_logs carry only actor_name, so past actors are matched by id
 * through /forms/approval-history instead). Fails closed on any BE error.
 */
export async function canViewAdv(user: AdvUser, formId: string): Promise<boolean> {
  if (!user?.employee_id || typeof formId !== 'string' || !FORM_ID_PATTERN.test(formId)) return false;
  if (user.is_finance === true) return true;
  const detail = await beJsonOrNull(beUrl(`/finance/advances/${encodeURIComponent(formId)}`));
  if (detail === null) return false;
  if (advDetailGrantsView(detail, user.employee_id)) return true;
  const pending = await cachedList(beUrl('/finance/approvals/pending', { employee_id: user.employee_id }));
  if (listHasForm(pending, formId)) return true;
  const history = await cachedList(beUrl('/forms/approval-history', { employee_id: user.employee_id }));
  return listHasForm(history, formId);
}

/** The requester of the ADV (BE detail). Fails closed on any BE error. */
export async function isAdvOwner(user: AdvUser, formId: string): Promise<boolean> {
  if (!user?.employee_id || typeof formId !== 'string' || !FORM_ID_PATTERN.test(formId)) return false;
  const detail = await beJsonOrNull(beUrl(`/finance/advances/${encodeURIComponent(formId)}`));
  return isAdvRequester(detail, user.employee_id);
}

/** For an ADV form id: a 403 response unless canViewAdv. Non-ADV ids pass (null) — their rules are unchanged. */
export async function denyUnlessAdvViewer(user: AdvUser, formId: string): Promise<NextResponse | null> {
  if (!isAdvTarget({ formId })) return null;
  if (await canViewAdv(user, formId)) return null;
  return NextResponse.json({ error: 'ไม่มีสิทธิ์ดูรายการนี้' }, { status: 403 });
}

/** ใบเงินสดย่อย + กองทุนของมัน สำหรับการ์ดไฟล์แนบ · โหลดไม่ได้คืน null ทั้งคู่ (ผู้เรียก fail closed) */
export async function loadPettyClaimFor(formId: string): Promise<{
  claim: { created_by: string; fund_id: number; status: any; expense_type?: string } | null;
  fund: { id: number; holder_employee_id: string } | null;
  /** spec ของประเภทการเบิก (max ต่อหมวดไฟล์) — null เมื่อหาไม่เจอ ผู้เรียกถือว่าไม่มีเพดาน */
  spec: { attachments?: { key: string; max?: number }[] } | null;
}> {
  const claim = await beJsonOrNull(beUrl(`/finance/petty/claims/${encodeURIComponent(formId)}`)) as any;
  if (!claim || typeof claim.created_by !== 'string' || typeof claim.fund_id !== 'number') {
    return { claim: null, fund: null, spec: null };
  }
  const [funds, types] = await Promise.all([
    beJsonOrNull(beUrl('/finance/petty/funds', { active: 'false' })) as Promise<any>,
    beJsonOrNull(beUrl('/finance/petty/expense-types', { active: 'false' })) as Promise<any>,
  ]);
  const fund = Array.isArray(funds)
    ? funds.find((f: any) => f?.id === claim.fund_id) ?? null
    : null;
  const spec = Array.isArray(types)
    ? types.find((t: any) => t?.code === claim.expense_type)?.spec ?? null
    : null;
  return { claim, fund, spec };
}

/** กองทุนที่คนนี้ถือ — ใช้ตัดสินว่าเห็นใบของกองทุนนั้นได้ไหม (fail closed: BE ล่ม = ไม่ถือกองทุนไหน) */
export async function loadPettyFundsHeldBy(employeeId: string): Promise<{ id: number; holder_employee_id: string }[]> {
  const funds = await beJsonOrNull(beUrl('/finance/petty/funds', { holder: employeeId, active: 'false' }));
  return Array.isArray(funds)
    ? funds.filter((f: any) => typeof f?.id === 'number' && typeof f?.holder_employee_id === 'string')
    : [];
}
