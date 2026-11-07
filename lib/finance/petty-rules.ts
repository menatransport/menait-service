import type { RoutePreview } from '@/app/finance/petty-api';

/** กติกาหัวใบที่ BE บังคับเหมือนกัน (petty_logic.assert_claim_cap / assert_single_driver_role) — เช็กที่หน้าจอก่อนกดส่ง */

/** เพดานต่อใบ (ผู้ใช้สั่ง 7/11/2026 "เปิดใบเบิก ไม่เกิน 2000 บาท") — เกินนี้ไปเบิก Advance */
export const PETTY_CLAIM_CAP = 2000;

export function claimCapProblem(total: number): string | null {
  if (!(total > PETTY_CLAIM_CAP)) return null;
  return `ยอดรวม ${total.toLocaleString('th-TH', { minimumFractionDigits: 2 })} เกิน ${PETTY_CLAIM_CAP.toLocaleString('th-TH')} บาทต่อใบ ยอดเกินนี้เบิก Advance แทน`;
}

/** ค่าชั่ง 1 ใบ = พจส. หรือ พจร. อย่างเดียว (ลงบัญชีคนละรหัส) — แถวที่ยังไม่เลือกไม่นับ */
export function singleDriverRoleProblem(expenseType: string, rows: ReadonlyArray<Record<string, unknown>>): string | null {
  if (expenseType !== 'WEIGH') return null;
  const roles = new Set(rows.map(r => String(r.driver_role ?? '').trim()).filter(Boolean));
  if (roles.size <= 1) return null;
  return 'ใบค่าชั่งหนึ่งใบใส่ได้แค่ พจส. หรือ พจร. อย่างเดียว แยกเปิดคนละใบ';
}

/** บรรทัดบอกผู้ขอเบิกว่าใบจะไปหาใคร */
export function routeHint(route: RoutePreview | null | undefined): string {
  if (!route) return 'ระบบดูอำนาจอนุมัติตาม TOA ตอนส่ง';
  if (route.over_cap) return `เกินเพดาน ${route.cap.toLocaleString('th-TH')} บาท`;
  if (!route.head_required) return `เจ้าของเงินสด${route.holder_name ? ` (${route.holder_name})` : ''} อนุมัติจ่ายได้เลย ไม่ต้องผ่านหัวหน้า`;
  return `หัวหน้าระดับ ${route.required_level ?? '-'} ขึ้นไปอนุมัติก่อน แล้วถึงเจ้าของเงินสด`;
}
