import { describe, expect, test } from 'bun:test';
import type { PettyClaim, PettyExpenseType } from '@/app/finance/types-petty';
import { detailRows, reportClaims, summaryRows, vehicleTypeOf } from './petty-report';

const TYPES = [{ code: 'WEIGH', name_th: 'ค่าชั่งน้ำหนัก' }, { code: 'TIRE', name_th: 'ค่าปะยาง' }, { code: 'GENERAL', name_th: 'อื่นๆ' }] as PettyExpenseType[];
let n = 0;
const claim = (type: string, fleet: string | null, amount: number, wht: number, extra: Partial<PettyClaim> = {}): PettyClaim => ({
  id: ++n, form_id: `LB-B02-2611-${String(n).padStart(3, '0')}`, fund_id: 1, expense_type: type, expense_date: '2026-11-01',
  period_from: null, period_to: null, driver_employee_id: null, driver_name: null, payee_name: 'ร้าน', amount, wht_amount: wht,
  status: 'APPROVED', created_by: '55555', transfer_date: '2026-11-05', cost_center: '3B01', expense_code: null,
  items: [{ event_date: '2026-11-01', qty: 1, rate: amount, amount, fleet }],
  ...extra,
} as PettyClaim);

/** ตัวอย่างที่ผู้ใช้ส่ง 7/11/2026: ค่าชั่ง MS 1,000+200 (WHT 30) · ML 100+2,000 (WHT 60) · ปะยาง MS 200 · ML 3,000+500 (WHT 90) · อื่นๆ 3B01 100+200 */
const CLAIMS = [
  claim('WEIGH', 'Mixer S', 1000, 30), claim('WEIGH', 'Mixer L', 100, 0), claim('WEIGH', 'Mixer S', 200, 0), claim('WEIGH', 'Mixer L', 2000, 60),
  claim('TIRE', 'Mixer S', 200, 0), claim('TIRE', 'Mixer L', 3000, 90), claim('TIRE', 'Mixer L', 500, 0),
  claim('GENERAL', null, 100, 0), claim('GENERAL', null, 200, 0),
];

describe('รายงาน Excel เงินสดย่อย (ข้อ 14)', () => {
  test('Summary ตรงตัวอย่างของผู้ใช้ ทั้งยอด WHT สุทธิ และแถวรวม 7,300 / 180 / 7,120', () => {
    const rows = summaryRows(CLAIMS, TYPES);
    const pick = (t: string, v: string) => rows.find(r => r['ประเภทค่าใช้จ่าย'] === t && r['ประเภทรถ'] === v)!;
    expect([pick('ค่าชั่งน้ำหนัก', 'MS')['ยอดค่าใช้จ่าย'], pick('ค่าชั่งน้ำหนัก', 'MS')['WHT'], pick('ค่าชั่งน้ำหนัก', 'MS')['ยอดจ่ายสุทธิ']]).toEqual([1200, 30, 1170]);
    expect([pick('ค่าชั่งน้ำหนัก', 'ML')['ยอดค่าใช้จ่าย'], pick('ค่าชั่งน้ำหนัก', 'ML')['WHT'], pick('ค่าชั่งน้ำหนัก', 'ML')['ยอดจ่ายสุทธิ']]).toEqual([2100, 60, 2040]);
    expect([pick('ค่าปะยาง', 'ML')['ยอดค่าใช้จ่าย'], pick('ค่าปะยาง', 'ML')['WHT'], pick('ค่าปะยาง', 'ML')['ยอดจ่ายสุทธิ']]).toEqual([3500, 90, 3410]);
    expect(pick('อื่นๆ', '3B01')['ยอดค่าใช้จ่าย']).toBe(300);
    const total = rows[rows.length - 1];
    expect([total['ประเภทค่าใช้จ่าย'], total['จำนวนใบ'], total['ยอดค่าใช้จ่าย'], total['WHT'], total['ยอดจ่ายสุทธิ']]).toEqual(['รวม', 9, 7300, 180, 7120]);
  });
  test('Detail รายใบ 9 แถว ยอดสุทธิ = ยอด − WHT', () => {
    const rows = detailRows(CLAIMS, TYPES, []);
    expect(rows).toHaveLength(9);
    expect([rows[0]['เลขที่ขอเบิก'], rows[0]['ประเภทรถ'], rows[0]['ยอดค่าใช้จ่าย'], rows[0]['WHT'], rows[0]['ยอดจ่ายสุทธิ']]).toEqual(['LB-B02-2611-001', 'MS', 1000, 30, 970]);
  });
  test('ประเภทรถ: ฟลีทย่อ MS/ML · ไม่มีฟลีทใช้ประเภทรถเดิม · ไม่มีรถใช้รหัสใบสำคัญจ่าย/แผนก', () => {
    expect(vehicleTypeOf(claim('WEIGH', 'Trailer', 1, 0))).toBe('TR');
    expect(vehicleTypeOf({ ...claim('WEIGH', null, 1, 0), items: [{ event_date: 'x', qty: 1, rate: 1, amount: 1, truck_type: 'โม่ใหญ่' }] } as PettyClaim)).toBe('ML');
    expect(vehicleTypeOf(claim('GENERAL', null, 1, 0, { expense_code: '3200' }))).toBe('3200');
  });
  test('ช่วงรายงานยึดวันที่โอน ตีกลับ/ยังไม่โอนไม่นับ', () => {
    const list = [claim('WEIGH', 'Mixer L', 1, 0, { transfer_date: '2026-11-03' }), claim('WEIGH', 'Mixer L', 1, 0, { transfer_date: null }),
      claim('WEIGH', 'Mixer L', 1, 0, { transfer_date: '2026-11-20' }), claim('WEIGH', 'Mixer L', 1, 0, { transfer_date: '2026-11-10', status: 'RETURNED' })];
    expect(reportClaims(list, '2026-11-01', '2026-11-15').map(c => c.transfer_date)).toEqual(['2026-11-03']);
    expect(reportClaims(list).length).toBe(2);
  });
});
