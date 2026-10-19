import { NextResponse, type NextRequest } from 'next/server';
import { beUrl, requireFinance } from '@/lib/finance/server';

export const dynamic = 'force-dynamic';

/** สิทธิ์ตามหน้าที่ของผู้ใช้ที่ล็อกอินอยู่ — หน้าเว็บใช้ซ่อนปุ่ม ตัวจริงกันที่หลังบ้าน */
export async function GET(req: NextRequest) {
  const guard = await requireFinance(req);
  if ('error' in guard) return guard.error;

  try {
    const res = await fetch(beUrl('/finance/permissions/me', { employee_id: guard.user.employee_id }), {
      cache: 'no-store',
    });
    if (!res.ok) return NextResponse.json({ permissions: [], unavailable: true });
    const data = await res.json();
    return NextResponse.json({ permissions: data?.permissions ?? [], is_finance: data?.is_finance ?? true });
  } catch {
    // หลังบ้านล่ม: ไม่ซ่อนปุ่ม ปล่อยให้หลังบ้านเป็นคนปฏิเสธ จะได้ไม่บล็อกงานเพราะเน็ตสะดุด
    return NextResponse.json({ permissions: [], unavailable: true });
  }
}
