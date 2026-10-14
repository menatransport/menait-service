import type { PettyFund } from '@/app/finance/types-petty';

/**
 * Map แผนกของเงินสดย่อย — รหัสค่าใช้จ่ายของบัญชี (ตารางจากฝ่ายบัญชี 2026-10-14)
 * รหัส = ตัวอักษรกลุ่ม + เลขแผนก และตรงกับ division_code ของวงเงิน จึงไม่ต้องเก็บเพิ่มใน DB
 * ถ้าบัญชีเพิ่มแผนก/กลุ่ม หรือเปิดประเภทการเบิกให้แผนกใหม่ แก้ที่ไฟล์นี้ที่เดียว
 */
export const ACCOUNT_GROUPS: Record<string, string> = {
  A: 'Management & Admin',
  B: 'Operation & Support',
};

export type AccountDivision = {
  /** ชื่อเต็มตามที่บัญชีใช้ — พิมพ์บนใบสำคัญจ่าย */
  name: string;
  /** ชื่อสั้นสำหรับดรอปดาวน์/ตาราง */
  short: string;
};

export const ACCOUNT_DIVISIONS: Record<string, AccountDivision> = {
  A01: { name: 'ฝ่ายบริหาร', short: 'บริหาร' },
  A02: { name: 'ฝ่ายขายและพัฒนาธุรกิจ', short: 'ขาย' },
  A03: { name: 'ฝ่ายบุคคล', short: 'บุคคล' },
  A04: { name: 'ฝ่ายบัญชี การเงิน', short: 'บัญชี' },
  A05: { name: 'ฝ่ายไอที', short: 'ไอที' },
  B01: { name: 'ฝ่ายจัดส่ง (ศลบ.) / ฝ่ายศูนย์ปฏิบัติการ (สสบ. และ ศบก.)', short: 'จัดส่ง' },
  B02: { name: 'ฝ่ายยานยนต์', short: 'ยานยนต์' },
  B03: { name: 'ฝ่ายจัดซื้อ', short: 'จัดซื้อ' },
  B04: { name: 'ฝ่ายจัดการมาตรฐานและอบรมความปลอดภัย และฝ่ายกำกับการปฏิบัติตามข้อกำหนด', short: 'จป.' },
  B05: { name: 'ฝ่ายวิเคราะห์ข้อมูลและต้นทุน', short: 'วิเคราะห์ข้อมูลและต้นทุน' },
};

/**
 * ประเภทการเบิก → แผนกที่เบิกเงินสดย่อยได้ (ตามตารางบัญชี) · ประเภทที่ไม่อยู่ในนี้ = บัญชียังไม่กำหนด เปิดได้ทุกแผนก
 * WEIGH ค่าชั่งน้ำหนัก · TIRE ค่าปะ-เปลี่ยนยาง · REPAIR ค่าซ่อมฉุกเฉิน
 */
export const EXPENSE_TYPE_DIVISIONS: Record<string, readonly string[]> = {
  WEIGH: ['B01', 'B02', 'B04', 'B05'],
  TIRE: ['B02'],
  REPAIR: ['B02'],
};

export function divisionShortName(code: string): string {
  return ACCOUNT_DIVISIONS[code]?.short ?? code;
}

/** "B02 ฝ่ายยานยนต์" — บรรทัดรหัสค่าใช้จ่ายบนใบสำคัญจ่าย · แผนกที่บัญชีไม่รู้จักพิมพ์รหัสเฉย ๆ */
export function accountCodeLine(fund: Pick<PettyFund, 'division_code'> | null | undefined): string {
  const code = fund?.division_code ?? '';
  if (!code) return '';
  const name = ACCOUNT_DIVISIONS[code]?.name;
  return name ? `${code} ${name}` : code;
}

/** กลุ่มของรหัส เช่น B → "B Operation & Support" */
export function accountGroupLine(code: string): string {
  const letter = code.slice(0, 1);
  const name = ACCOUNT_GROUPS[letter];
  return name ? `${letter} ${name}` : letter;
}

/** แผนกนี้เบิกประเภทนี้ได้ไหม · ประเภทที่บัญชียังไม่กำหนดกติกา = ได้ทุกแผนก */
export function divisionAllowed(expenseType: string | null | undefined, divisionCode: string): boolean {
  const allowed = EXPENSE_TYPE_DIVISIONS[expenseType ?? ''];
  return allowed ? allowed.includes(divisionCode) : true;
}

/** วงเงินที่เปิดใบประเภทนี้ได้ (กรองด้วย Map ข้างบน) */
export function fundsForExpenseType<T extends Pick<PettyFund, 'division_code'>>(expenseType: string | null | undefined, funds: readonly T[]): T[] {
  return funds.filter(f => divisionAllowed(expenseType, f.division_code));
}
