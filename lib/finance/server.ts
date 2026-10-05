import { NextResponse, type NextRequest } from 'next/server';
import { verifyToken, COOKIE_NAME } from '@/lib/jwt';
import type { UserInfo } from '@/app/context/SessionContext';
import { FORM_ID_PATTERN } from '@/lib/s3';
import { isAdvTarget } from '@/lib/finance/formsubmit-guard';
import { advDetailGrantsView, isAdvRequester, listHasForm } from '@/lib/finance/adv-access';

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
      const detail = typeof data?.detail === 'string' ? data.detail : 'ข้อมูลไม่ถูกต้อง';
      return NextResponse.json({ error: detail }, { status: res.status });
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
