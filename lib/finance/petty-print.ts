import { round2 } from '@/lib/finance/status';
import type { PettyClaimItem } from '@/app/finance/types-petty';

export type PrintGroup = {
  label: string; count: number; rate: number; total: number; truckCodes: string[];
};

/** "ค่าชั่งน้ำหนักรถโม่ใหญ่ 100 บาท" — ถ้อยคำเดียวกับที่เขียนในใบจริง */
export function voucherLabel(rate: number, truckType: string | null | undefined, typeName: string): string {
  return truckType ? `${typeName}รถ${truckType} ${rate} บาท` : `${typeName} ${rate} บาท`;
}

/** จัดกลุ่มตามราคา + ประเภทรถ แล้วรหัสรถไปอยู่ในหมายเหตุ — เหมือนที่คนทำมือทำอยู่ */
export function groupForPrint(
  items: readonly Partial<PettyClaimItem>[],
  typeName: string,
): PrintGroup[] {
  const buckets = new Map<string, PrintGroup>();
  for (const item of items) {
    const rate = Number(item.rate ?? 0);
    const truckType = item.truck_type ?? null;
    const token = `${rate}|${truckType ?? ''}`;
    let group = buckets.get(token);
    if (!group) {
      group = { label: voucherLabel(rate, truckType, typeName), count: 0, rate, total: 0, truckCodes: [] };
      buckets.set(token, group);
    }
    group.count += 1;
    group.total = round2(group.total + Number(item.amount ?? rate * Number(item.qty ?? 1)));
    if (item.truck_code) group.truckCodes.push(item.truck_code);
  }
  // เรียงกลุ่มใหญ่มาก่อน แล้วราคาสูงมาก่อน ตามลำดับที่ใบจริงเขียน
  return [...buckets.values()].sort((a, b) => b.count - a.count || b.rate - a.rate);
}

/** ตารางบนกระดาษมี 6 บรรทัด เกินนั้นขึ้นแผ่นใหม่ */
export function paginateGroups(groups: readonly PrintGroup[], perPage = 6): PrintGroup[][] {
  if (groups.length === 0) return [];
  const pages: PrintGroup[][] = [];
  for (let i = 0; i < groups.length; i += perPage) pages.push(groups.slice(i, i + perPage));
  return pages;
}
