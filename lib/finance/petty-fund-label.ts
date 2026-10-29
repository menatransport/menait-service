import type { PettyFund } from '@/app/finance/types-petty';
import { divisionShortName } from '@/lib/finance/petty-account-code';

/** ชื่อสาขาแบบที่การเงินเรียก (รายการวงเงินของจริง 2026-10-13) · สาขาที่ยังไม่รู้ชื่อเต็มใช้รหัส */
const BRANCH_NAME: Record<string, string> = { '01': 'กรุงเทพฯ', '02': 'สระบุรี', '03': 'ลาดกระบัง' };

type FundLike = Pick<PettyFund, 'branch_code' | 'division_code'> & Partial<Pick<PettyFund, 'holder_name' | 'holder_employee_id'>>;

/** "ลาดกระบัง - ยานยนต์" */
function fundPlace(fund: FundLike): string {
  const branch = BRANCH_NAME[fund.branch_code] ?? `สาขา ${fund.branch_code}`;
  return `${branch} - ${divisionShortName(fund.division_code)}`;
}

/** "วงเงินสดย่อย - ลาดกระบัง - ยานยนต์" — ชื่อที่โชว์ทุกที่ที่ต้องเลือกหรืออ่านวงเงิน */
export function fundLabel(fund: FundLike): string {
  return `วงเงินสดย่อย - ${fundPlace(fund)}`;
}

/** "ลาดกระบัง - ยานยนต์ · ผู้ถือเงิน" — ค่าในช่องที่ป้ายเขียนว่า "วงเงินสดย่อย" อยู่แล้ว (PDF) ไม่ต้องขึ้นต้นซ้ำ */
export function fundPlaceWithHolder(fund: FundLike): string {
  const holder = fund.holder_name ?? fund.holder_employee_id;
  return holder ? `${fundPlace(fund)} · ${holder}` : fundPlace(fund);
}

/** ชื่อวงเงิน + ผู้ถือเงิน สำหรับหน้าที่คนเลือกต้องรู้ว่าใครอนุมัติ */
export function fundLabelWithHolder(fund: FundLike): string {
  const holder = fund.holder_name ?? fund.holder_employee_id;
  return holder ? `${fundLabel(fund)} · ${holder}` : fundLabel(fund);
}
