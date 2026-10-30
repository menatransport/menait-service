import type { NextRequest } from 'next/server';
import { beUrl, proxy, requireUser } from '@/lib/finance/server';

/** ส่งต่อแค่พารามิเตอร์ที่ด่านใช้ — ไม่ปล่อย query อะไรก็ได้ไปถึง BE · payee_name ใช้กับประเภทที่เทียบ เลขที่บิล + จ่ายให้ */
const PASS_THROUGH = ['expense_type', 'event_date', 'truck_code', 'truck_plate', 'ref_no', 'payee_name', 'exclude_claim_id'] as const;

export async function GET(req: NextRequest) {
  const guard = await requireUser(req);
  if ('error' in guard) return guard.error;
  const sp = req.nextUrl.searchParams;
  const query: Record<string, string | null> = {};
  for (const key of PASS_THROUGH) query[key] = sp.get(key);
  return proxy(beUrl('/finance/petty/claims/duplicate-check', query));
}
