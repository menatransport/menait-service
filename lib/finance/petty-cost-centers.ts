import type { PettyClaim, PettyFund } from '@/app/finance/types-petty';
import { accountCodeLine } from '@/lib/finance/petty-account-code';

/**
 * ศูนย์และแผนกของผู้เบิก — รายการจากผู้ใช้ 29/10/2026 (ชื่อคงตามที่ส่งมา รวมจุดหลังชื่อศูนย์บางตัว)
 * รหัส = เลขศูนย์ (1 สกท · 2 สสบ · 3 ศลบ) + แผนก · BE มีรายการเดียวกันที่ services/finance/petty_cost_centers.py
 * แก้ต้องแก้ทั้งสองที่ (BE รับเฉพาะรหัสในรายการ)
 */
export type CostCenter = { code: string; name: string };

export const COST_CENTERS: readonly CostCenter[] = [
  { code: '1400', name: 'สกท - ขาย' },
  { code: '1A01', name: 'สกท - ฝ่ายบริหาร' },
  { code: '1A02', name: 'สกท - ฝ่ายขายและการตลาด' },
  { code: '1A03', name: 'สกท - ฝ่ายทรัพยากรบุคคลและธุรการ' },
  { code: '1A04', name: 'สกท - ฝ่ายบัญชีและการเงิน' },
  { code: '1A05', name: 'สกท - ฝ่ายไอที' },
  { code: '1A06', name: 'สกท - CEO Office' },
  { code: '1A07', name: 'สกท - คณะกรรมการ' },
  { code: '1B05', name: 'สกท - วางแผนปฏิบัติการ' },
  { code: '1B06', name: 'สกท. - Operation Support' },
  { code: '1B07', name: 'สกท. - Business Development' },
  { code: '2100', name: 'สสบ - ขนส่ง' },
  { code: '2500', name: 'สสบ - รถร่วม' },
  { code: '2A01', name: 'สสบ - ฝ่ายบริหาร' },
  { code: '2A03', name: 'สสบ - ฝ่ายทรัพยากรบุคคลและธุรการ' },
  { code: '2A04', name: 'สสบ - ฝ่ายบัญชีและการเงิน' },
  { code: '2A05', name: 'สสบ - ฝ่ายไอที' },
  { code: '2A06', name: 'สสบ - CEO Office' },
  { code: '2A07', name: 'สสบ - คณะกรรมการ' },
  { code: '2B01', name: 'สสบ - จัดส่ง' },
  { code: '2B02', name: 'สสบ - ยานยนต์' },
  { code: '2B03', name: 'สสบ - จัดซื้อ' },
  { code: '2B04', name: 'สสบ - ความปลอดภัย' },
  { code: '2B05', name: 'สสบ - วางแผนปฏิบัติการ' },
  { code: '2B06', name: 'สสบ. - Operation Support' },
  { code: '2B07', name: 'สสบ. - Business Development' },
  { code: '3200', name: 'ศลบ - บริการ' },
  { code: '3300', name: 'ศลบ - บริหารฟลีท' },
  { code: '3500', name: 'ศลบ - รถร่วม' },
  { code: '3A01', name: 'ศลบ - ฝ่ายบริหาร' },
  { code: '3A02', name: 'ศลบ - ฝ่ายขายและการตลาด' },
  { code: '3A03', name: 'ศลบ - ฝ่ายทรัพยากรบุคคลและธุรการ' },
  { code: '3A04', name: 'ศลบ - ฝ่ายบัญชีและการเงิน' },
  { code: '3A05', name: 'ศลบ - ฝ่ายไอที' },
  { code: '3A06', name: 'ศลบ - CEO Office' },
  { code: '3A07', name: 'ศลบ - คณะกรรมการ' },
  { code: '3B01', name: 'ศลบ - จัดส่ง' },
  { code: '3B02', name: 'ศลบ - ยานยนต์' },
  { code: '3B03', name: 'ศลบ - จัดซื้อ' },
  { code: '3B04', name: 'ศลบ - ความปลอดภัย' },
  { code: '3B05', name: 'ศลบ - วางแผนปฏิบัติการ' },
  { code: '3B06', name: 'ศลบ - Operation Support' },
  { code: '3B07', name: 'ศลบ. - Business Development' },
];

const BY_CODE = new Map(COST_CENTERS.map(c => [c.code, c]));
const CENTER_OF_DIGIT: Record<string, string> = { '1': 'สกท', '2': 'สสบ', '3': 'ศลบ' };

/** กลุ่มใน dropdown ตามศูนย์ (เลขตัวแรกของรหัส) เรียงตามรายการ */
export const COST_CENTER_GROUPS: readonly { center: string; items: readonly CostCenter[] }[] =
  Object.entries(CENTER_OF_DIGIT).map(([digit, center]) => ({
    center, items: COST_CENTERS.filter(c => c.code.startsWith(digit)),
  }));

export function isCostCenter(code: string | null | undefined): boolean {
  return !!code && BY_CODE.has(code);
}

/** "3B02 ศลบ - ยานยนต์" · รหัสที่ไม่รู้จักแสดงรหัสเฉย ๆ · ว่าง = '' */
export function costCenterLabel(code: string | null | undefined): string {
  if (!code) return '';
  const hit = BY_CODE.get(code);
  return hit ? `${hit.code} ${hit.name}` : code;
}

/** ค่าตั้งต้นจากวงเงิน: สาขา '03' + แผนก 'B02' → '3B02' · ไม่มีในรายการ = '' ให้ผู้เปิดใบเลือกเอง */
export function defaultCostCenter(fund: Pick<PettyFund, 'branch_code' | 'division_code'> | null | undefined): string {
  if (!fund) return '';
  const digit = String(Number(fund.branch_code));
  const code = `${digit}${fund.division_code}`;
  return BY_CODE.has(code) ? code : '';
}

/** บรรทัด "รหัสค่าใช้จ่ายของผู้เบิก (บัญชี)" — ศูนย์และแผนกที่เลือกตอนเปิดใบ · ใบเก่าที่ไม่มี ใช้แผนกของวงเงินแบบเดิม */
export function claimCostCenterLine(
  claim: Pick<PettyClaim, 'cost_center'>,
  fund: Pick<PettyFund, 'division_code'> | null | undefined,
): string {
  return costCenterLabel(claim.cost_center) || accountCodeLine(fund);
}
