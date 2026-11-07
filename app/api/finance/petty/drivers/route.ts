import type { NextRequest } from 'next/server';
import { beUrl, proxy, requireUser } from '@/lib/finance/server';

/** ค้นคนขับจากรายงานรถประจำวัน ATMS (ชื่อ/รหัส) — ค่าแนะนำ พจส./พจร. ฟลีท และรถ (ผู้ใช้สั่ง 7/11/2026) */
export async function GET(req: NextRequest) {
  const guard = await requireUser(req);
  if ('error' in guard) return guard.error;
  const sp = req.nextUrl.searchParams;
  return proxy(beUrl('/finance/petty/drivers', { q: sp.get('q'), date: sp.get('date'), limit: sp.get('limit') ?? '20' }));
}
