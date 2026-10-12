import { NextResponse, type NextRequest } from 'next/server';
import { canSeeAllClaims } from '@/lib/finance/petty-access';
import { beUrl, proxy, requireUser } from '@/lib/finance/server';

export async function GET(req: NextRequest) {
  const guard = await requireUser(req);
  if ('error' in guard) return guard.error;
  const seesAll = canSeeAllClaims(guard.user);
  // holder มาจาก session เท่านั้น — ส่ง employee_id จาก browser เข้ามาแล้วดูของคนอื่นไม่ได้
  return proxy(beUrl('/finance/petty/funds', {
    holder: seesAll ? null : guard.user.employee_id,
    active: req.nextUrl.searchParams.get('active') ?? 'true',
  }));
}

export async function POST(req: NextRequest) {
  const guard = await requireUser(req);
  if ('error' in guard) return guard.error;
  if (guard.user.role !== 'a') {
    return NextResponse.json({ error: 'เฉพาะผู้ดูแลระบบ' }, { status: 403 });
  }
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'ข้อมูลไม่ถูกต้อง' }, { status: 400 });
  return proxy(beUrl('/finance/petty/funds'), {
    method: 'POST',
    body: JSON.stringify({ ...body, updated_by: guard.user.employee_id }),
  });
}
