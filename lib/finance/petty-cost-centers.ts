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

/** ชื่อศูนย์ใน session (sites.site_name_en) หรือรหัสไทย → ศูนย์ในรายการ · ศูนย์ที่ยังไม่มีรหัส = null */
const SITE_TO_CENTER: Record<string, string> = {
  'bangkok hq': 'สกท', 'สกท': 'สกท',
  'saraburi': 'สสบ', 'สสบ': 'สสบ',
  'lat krabang': 'ศลบ', 'ศลบ': 'ศลบ',
};

export function centerOfSite(site: string | null | undefined): string | null {
  const key = (site ?? '').trim().replace(/\.+$/, '').trim().toLowerCase();
  return SITE_TO_CENTER[key] ?? null;
}

/** กลุ่มที่ผู้เบิกเห็นใน dropdown: เฉพาะศูนย์ของตัวเอง · ศูนย์ที่ไม่รู้ = ทุกกลุ่ม */
export function costCenterGroupsForSite(site: string | null | undefined): typeof COST_CENTER_GROUPS {
  const center = centerOfSite(site);
  return center ? COST_CENTER_GROUPS.filter(g => g.center === center) : COST_CENTER_GROUPS;
}

export function isCostCenter(code: string | null | undefined): boolean {
  return !!code && BY_CODE.has(code);
}

/** "3B02 ศลบ - ยานยนต์" · รหัสที่ไม่รู้จักแสดงรหัสเฉย ๆ · ว่าง = '' */
export function costCenterLabel(code: string | null | undefined): string {
  if (!code) return '';
  const hit = BY_CODE.get(code);
  return hit ? `${hit.code} ${hit.name}` : code;
}

/**
 * ฝ่ายในระบบ HR (divisions.division_code ผ่าน departments.division_id) → รหัสฝ่ายของบัญชี
 * ผู้ใช้อนุมัติ map นี้ 29/10/2026 (ค่าตั้งต้นเท่านั้น ผู้เบิกเปลี่ยนเองได้)
 */
const HR_DIVISION_TO_ACCOUNT: Record<string, string> = {
  ACC: 'A04', FIN: 'A04',                                   // บัญชี · การเงิน
  IT: 'A05',
  HR: 'A03', HCB: 'A03', HOD: 'A03', HRC: 'A03', HTA: 'A03', HPR: 'A03',
  VHC: 'B02',                                               // ยานยนต์
  SPR: 'B03',                                               // จัดซื้อ รวมสโตร์
  STY: 'B04', CPA: 'B04',                                   // ความปลอดภัย · Compliance (ตารางบัญชีเดิมรวมใน B04)
  OPS: 'B06',                                               // Operation Support · Process Excellence · Freight Rate · Fuel Control
  LKB: 'B01', SRB: 'B01', BPK: 'B01',                       // ฝ่ายจัดส่ง / ศูนย์ปฏิบัติการ
  EX: 'A01',                                                // Chief-Level → ฝ่ายบริหาร
  CSC: 'A06',                                               // Company Secretary & Compliance → CEO Office
  BD: 'B07',
};

/** แผนกที่ไม่ได้ผูกฝ่ายในระบบ — departments.department_id → รหัสของบัญชี (ไม่รวมเลขศูนย์) */
const DEPARTMENT_TO_ACCOUNT: Record<number, string> = {
  9: '500', // Sales & Driver Partner (แผนกขายรถร่วม) → x500 รถร่วม
};

const DIGIT_OF_CENTER: Record<string, string> = { 'สกท': '1', 'สสบ': '2', 'ศลบ': '3' };

export type CostCenterUser = {
  site?: string | null;
  department_id?: number | null;
  division?: { division_code?: string | null } | null;
};

/** ค่าตั้งต้นจากผู้เบิก: เลขศูนย์จาก site + รหัสฝ่ายจากแผนก เช่น Process Excellence ที่ Bangkok HQ → 1B06
 *  ไม่มีในรายการ / map ไม่ได้ = '' ให้ผู้เบิกเลือกเอง */
export function defaultCostCenterForUser(user: CostCenterUser | null | undefined): string {
  if (!user) return '';
  const center = centerOfSite(user.site);
  const digit = center ? DIGIT_OF_CENTER[center] : undefined;
  const part = (user.department_id != null ? DEPARTMENT_TO_ACCOUNT[user.department_id] : undefined)
    ?? HR_DIVISION_TO_ACCOUNT[user.division?.division_code ?? ''];
  if (!digit || !part) return '';
  const code = `${digit}${part}`;
  return BY_CODE.has(code) ? code : '';
}

/** บรรทัด "รหัสค่าใช้จ่ายของผู้เบิก (บัญชี)" — ศูนย์และแผนกที่เลือกตอนเปิดใบ · ใบเก่าที่ไม่มี ใช้แผนกของวงเงินแบบเดิม */
export function claimCostCenterLine(
  claim: Pick<PettyClaim, 'cost_center'>,
  fund: Pick<PettyFund, 'division_code'> | null | undefined,
): string {
  return costCenterLabel(claim.cost_center) || accountCodeLine(fund);
}
