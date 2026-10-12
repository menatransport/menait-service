import { round2 } from '@/lib/finance/status';
import type { PettyClaimItem } from '@/app/finance/types-petty';

export type PrintGroup = {
  label: string; count: number; rate: number; total: number; truckCodes: string[]; unit: string;
};

export type PrintOpts = {
  /** หน่วยนับบนใบ — ชั่งน้ำหนักนับเป็นคัน ยางนับเป็นเส้น ค่าเดินทางนับเป็นเที่ยว */
  unit?: string;
};

/** "ค่าชั่งน้ำหนักรถโม่ใหญ่ 100 บาท" — ถ้อยคำเดียวกับที่เขียนในใบจริง */
export function voucherLabel(rate: number, truckType: string | null | undefined, typeName: string): string {
  return truckType ? `${typeName}รถ${truckType} ${rate} บาท` : `${typeName} ${rate} บาท`;
}

/**
 * จัดกลุ่มรายการสำหรับพิมพ์ — เหมือนที่คนทำมือทำอยู่
 *
 * แถวที่เขียนรายละเอียดไว้เอง (ค่าเดินทาง "คลองตัน → เมกาบางนา", ยาง "เปลี่ยนยาง 6 เส้น")
 * อยู่บรรทัดของตัวเอง ไม่ถูกยุบรวมตามราคา เพราะข้อความคนละเรื่องกัน
 * ส่วนค่าชั่งน้ำหนักที่ไม่มีคำบรรยายรายแถว ยุบตามราคา + ประเภทรถ อย่างเดิม
 */
export function groupForPrint(
  items: readonly Partial<PettyClaimItem>[],
  typeName: string,
  opts: PrintOpts = {},
): PrintGroup[] {
  const unit = opts.unit ?? 'คัน';
  const buckets = new Map<string, PrintGroup & { byType: Map<string, number> }>();
  for (const [index, item] of items.entries()) {
    const rate = Number(item.rate ?? 0);
    const truckType = (item.truck_type ?? '').trim();
    const remark = (item.remark ?? '').trim();
    const token = remark ? `remark:${index}` : `${rate}`;
    let group = buckets.get(token);
    if (!group) {
      group = { label: remark ? `${typeName} ${remark}` : '', count: 0, rate, total: 0, truckCodes: [], unit,
        byType: new Map() };
      buckets.set(token, group);
    }
    group.count += remark ? Number(item.qty ?? 1) : 1;
    group.total = round2(group.total + Number(item.amount ?? rate * Number(item.qty ?? 1)));
    if (item.truck_code) group.truckCodes.push(item.truck_code);
    if (!remark && truckType) group.byType.set(truckType, (group.byType.get(truckType) ?? 0) + 1);
  }
  const out: PrintGroup[] = [...buckets.values()].map(g => {
    if (g.label) return { label: g.label, count: g.count, rate: g.rate, total: g.total, truckCodes: g.truckCodes, unit: g.unit };
    // "ค่าชั่งน้ำหนัก 100 บาท = 12 คัน (โม่ใหญ่ 8 คัน, โม่เล็ก 4 คัน)" — แยกประเภทรถในวงเล็บเมื่อมีมากกว่าหนึ่งแบบ
    const types = [...g.byType.entries()];
    const breakdown = types.length > 1 ? ` (${types.map(([t, n]) => `${t} ${n} ${g.unit}`).join(', ')})` : '';
    const typeWord = types.length === 1 ? `รถ${types[0][0]}` : '';
    // แถวเดี่ยวที่ไม่ใช่รายการรถ (ค่าเดินทาง 215 บาท) ไม่ต้องเขียน "= 1 เที่ยว" ต่อท้าย
    const countWord = g.count > 1 || types.length > 0 ? ` = ${g.count} ${g.unit}${breakdown}` : '';
    return { label: `${typeName}${typeWord} ${g.rate} บาท${countWord}`,
      count: g.count, rate: g.rate, total: g.total, truckCodes: g.truckCodes, unit: g.unit };
  });
  // เรียงกลุ่มใหญ่มาก่อน แล้วราคาสูงมาก่อน ตามลำดับที่ใบจริงเขียน
  return out.sort((a, b) => b.count - a.count || b.rate - a.rate);
}

/** ตารางบนกระดาษมี 6 บรรทัด เกินนั้นขึ้นแผ่นใหม่ */
export function paginateGroups(groups: readonly PrintGroup[], perPage = 6): PrintGroup[][] {
  if (groups.length === 0) return [];
  const pages: PrintGroup[][] = [];
  for (let i = 0; i < groups.length; i += perPage) pages.push(groups.slice(i, i + perPage));
  return pages;
}
