import { NextResponse, type NextRequest } from 'next/server';
import { verifyToken, COOKIE_NAME } from '@/lib/jwt';
import type { UserInfo } from '@/app/context/SessionContext';

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
