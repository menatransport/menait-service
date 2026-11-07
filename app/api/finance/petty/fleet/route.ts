import type { NextRequest } from 'next/server';
import { beUrl, proxy, requireUser } from '@/lib/finance/server';

/** ฟลีทของรถ/คนขับ ณ วันทำรายการ (Mixer L / Mixer S / Trailer / Side curtain) จาก ATMS */
export async function GET(req: NextRequest) {
  const guard = await requireUser(req);
  if ('error' in guard) return guard.error;
  const sp = req.nextUrl.searchParams;
  return proxy(beUrl('/finance/petty/fleet', {
    truck_code: sp.get('truck_code'), truck_plate: sp.get('truck_plate'), driver_code: sp.get('driver_code'), date: sp.get('date'),
  }));
}
