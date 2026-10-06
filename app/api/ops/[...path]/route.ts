import { NextResponse, type NextRequest } from 'next/server';
import { beUrl, requireUser } from '@/lib/finance/server';

/**
 * Forwards /api/ops/* to the ncacdb backend (/ops/*) — contract: app/ops/schema/ops.schema.json.
 * The backend owns every rule; this only checks the login and passes on who is calling.
 */

type Ctx = { params: Promise<{ path: string[] }> };

// ids and route words only — never "." / ".." that would let the URL climb out of /ops
const SEGMENT = /^[A-Za-z0-9_-]+$/;

type BackendError = { detail?: unknown; error?: unknown; field_errors?: unknown } | null;

/**
 * The /ops router answers { error, field_errors? } itself (OpsAPIRoute); plain FastAPI errors come as
 * { detail: string | { error, field_errors } | pydantic list }. The client expects OpsApiError.
 */
function toOpsError(data: BackendError) {
  if (typeof data?.error === 'string') {
    const fieldErrors = data.field_errors && typeof data.field_errors === 'object' ? (data.field_errors as Record<string, string>) : undefined;
    return { error: data.error, field_errors: fieldErrors };
  }
  const detail = data?.detail;
  if (typeof detail === 'string') return { error: detail };
  if (detail && typeof detail === 'object' && !Array.isArray(detail) && 'error' in detail && typeof detail.error === 'string') {
    const fieldErrors = 'field_errors' in detail ? (detail.field_errors as Record<string, string>) : undefined;
    return { error: detail.error, field_errors: fieldErrors };
  }
  return { error: 'ข้อมูลไม่ถูกต้อง' };
}

async function forward(req: NextRequest, { params }: Ctx) {
  const guard = await requireUser(req);
  if ('error' in guard) return guard.error;

  const { path } = await params;
  if (!path.length || !path.every(s => SEGMENT.test(s))) {
    return NextResponse.json({ error: 'ไม่พบ endpoint' }, { status: 404 });
  }

  const url = `${beUrl(`/ops/${path.join('/')}`)}${req.nextUrl.search}`;
  const headers: Record<string, string> = { 'X-Employee-Id': guard.user.employee_id };
  let body: ArrayBuffer | undefined;
  if (req.method !== 'GET' && req.method !== 'DELETE') {
    // raw bytes keep the multipart boundary of attachment uploads intact
    body = await req.arrayBuffer();
    const type = req.headers.get('content-type');
    if (type) headers['Content-Type'] = type;
  }

  try {
    const res = await fetch(url, { method: req.method, headers, body, cache: 'no-store' });
    if (res.status === 204) return new NextResponse(null, { status: 204 });
    const text = await res.text();
    let data: unknown = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = { detail: text }; }
    if (!res.ok) return NextResponse.json(toOpsError(data as BackendError), { status: res.status });
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    console.error('ops proxy error:', err);
    return NextResponse.json({ error: 'ไม่สามารถเชื่อมต่อระบบได้' }, { status: 502 });
  }
}

export { forward as GET, forward as POST, forward as PUT, forward as PATCH, forward as DELETE };
