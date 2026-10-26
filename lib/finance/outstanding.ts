/**
 * ยอดค้างเคลียร์ของผู้ขอเบิก ให้ผู้อนุมัติเห็นตอนเปิดดูรายละเอียดจากหน้าอนุมัติ (ผู้ใช้แจ้ง 26/10/2026)
 * ใบที่นับ = การเงินจ่ายเงินไปแล้วและยังไม่ปิดรายการ (เกณฑ์เดียวกับไทล์ "ยอดค้างเคลียร์" หน้าการเงิน)
 * เกินกำหนด = BE ติดธง overdue (รอเคลียร์/ส่งกลับแก้ไข เลยวันครบกำหนดเคลียร์) · ที่เหลือ = อยู่ในกำหนด
 */
export const OUTSTANDING_STATUSES = ['AWAITING_CLEARING', 'SENT_BACK', 'CLEARING_APPROVAL', 'AWAITING_REVIEW'] as const;

export type OutstandingBucket = { count: number; amount: number };
export type Outstanding = { total: OutstandingBucket; on_time: OutstandingBucket; overdue: OutstandingBucket };

type Row = { status?: string; overdue?: boolean; fin?: { amount_paid?: number | null } | null };

export function summarizeOutstanding(items: Row[]): Outstanding {
  const open = new Set<string>(OUTSTANDING_STATUSES);
  const cents = { total: 0, on_time: 0, overdue: 0 };
  const count = { total: 0, on_time: 0, overdue: 0 };
  for (const it of items) {
    if (!open.has(it.status ?? '')) continue;
    const c = Math.round(Number(it.fin?.amount_paid ?? 0) * 100);
    const bucket = it.overdue ? 'overdue' : 'on_time';
    cents.total += c; count.total += 1;
    cents[bucket] += c; count[bucket] += 1;
  }
  const b = (k: keyof typeof cents): OutstandingBucket => ({ count: count[k], amount: cents[k] / 100 });
  return { total: b('total'), on_time: b('on_time'), overdue: b('overdue') };
}
