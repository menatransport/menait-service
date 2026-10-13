import type { PettyFund } from '@/app/finance/types-petty';

/** ชื่อสาขาแบบที่การเงินเรียก (รายการวงเงินของจริง 2026-10-13) · สาขาที่ยังไม่รู้ชื่อเต็มใช้รหัส */
const BRANCH_NAME: Record<string, string> = { '01': 'กรุงเทพฯ', '02': 'สระบุรี', '03': 'ลาดกระบัง' };
/** ชื่อแผนกสั้น ๆ ตามรหัส Division */
const DIVISION_NAME: Record<string, string> = {
  A01: 'บริหาร', A02: 'ขาย', A03: 'บุคคล', A04: 'บัญชี', A05: 'ไอที',
  B01: 'จัดส่ง', B02: 'ยานยนต์', B03: 'จัดซื้อ', B04: 'จป.',
};

type FundLike = Pick<PettyFund, 'branch_code' | 'division_code'> & Partial<Pick<PettyFund, 'holder_name' | 'holder_employee_id'>>;

/** "วงเงินสดย่อย - ลาดกระบัง - ยานยนต์" — ชื่อที่โชว์ทุกที่ที่ต้องเลือกหรืออ่านวงเงิน */
export function fundLabel(fund: FundLike): string {
  const branch = BRANCH_NAME[fund.branch_code] ?? `สาขา ${fund.branch_code}`;
  const division = DIVISION_NAME[fund.division_code] ?? fund.division_code;
  return `วงเงินสดย่อย - ${branch} - ${division}`;
}

/** ชื่อวงเงิน + ผู้ถือเงิน สำหรับหน้าที่คนเลือกต้องรู้ว่าใครอนุมัติ */
export function fundLabelWithHolder(fund: FundLike): string {
  const holder = fund.holder_name ?? fund.holder_employee_id;
  return holder ? `${fundLabel(fund)} · ${holder}` : fundLabel(fund);
}
