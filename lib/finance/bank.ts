/** Payee bank rules. Keep identical to api-ncac services/finance/advance_logic.py BANKS (spec v2 §4.2). */
export const DEFAULT_ACCOUNT_DIGITS = [10, 11, 12] as const;

export const BANKS: Record<string, { label: string; digits: readonly number[] }> = {
  BBL: { label: 'ธนาคารกรุงเทพ', digits: [10] },
  KBANK: { label: 'ธนาคารกสิกรไทย', digits: [10] },
  KTB: { label: 'ธนาคารกรุงไทย', digits: [10] },
  SCB: { label: 'ธนาคารไทยพาณิชย์', digits: [10] },
  BAY: { label: 'ธนาคารกรุงศรีอยุธยา', digits: [10] },
  TTB: { label: 'ธนาคารทหารไทยธนชาต', digits: [10] },
  GSB: { label: 'ธนาคารออมสิน', digits: [12] },
  BAAC: { label: 'ธ.ก.ส.', digits: [12] },
  GHB: { label: 'ธนาคารอาคารสงเคราะห์', digits: [12] },
  UOB: { label: 'ธนาคารยูโอบี', digits: DEFAULT_ACCOUNT_DIGITS },
  CIMBT: { label: 'ธนาคารซีไอเอ็มบี ไทย', digits: DEFAULT_ACCOUNT_DIGITS },
  LHB: { label: 'ธนาคารแลนด์ แอนด์ เฮ้าส์', digits: DEFAULT_ACCOUNT_DIGITS },
  KKP: { label: 'ธนาคารเกียรตินาคินภัทร', digits: DEFAULT_ACCOUNT_DIGITS },
  TISCO: { label: 'ธนาคารทิสโก้', digits: DEFAULT_ACCOUNT_DIGITS },
  ICBCT: { label: 'ธนาคารไอซีบีซี (ไทย)', digits: DEFAULT_ACCOUNT_DIGITS },
  IBANK: { label: 'ธนาคารอิสลามแห่งประเทศไทย', digits: DEFAULT_ACCOUNT_DIGITS },
};

export function normalizeAccountNo(raw: string | null | undefined): string {
  return (raw ?? '').replace(/[\s-]/g, '');
}

export function accountNoError(bank: string | null | undefined, raw: string | null | undefined): string | null {
  const info = BANKS[bank ?? ''];
  const digits = info?.digits ?? DEFAULT_ACCOUNT_DIGITS;
  const n = normalizeAccountNo(raw);
  if (/^[0-9]+$/.test(n) && digits.includes(n.length)) return null;
  const count = digits.length === 1 ? `${digits[0]}` : `${digits[0]}–${digits[digits.length - 1]}`;
  return `เลขที่บัญชีไม่ถูกต้อง: ${info?.label ?? (bank || 'ธนาคาร')} ต้องเป็นตัวเลข ${count} หลัก`;
}

export function formatAccountNo(raw: string | null | undefined): string {
  const n = normalizeAccountNo(raw);
  if (/^[0-9]{10}$/.test(n)) return `${n.slice(0, 3)}-${n.slice(3, 4)}-${n.slice(4, 9)}-${n.slice(9)}`;
  return n || '-';
}

export function bankLabel(value: string | null | undefined): string {
  if (!value) return '-';
  return BANKS[value]?.label ?? value;
}
