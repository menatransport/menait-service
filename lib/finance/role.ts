export function parseIdList(raw: string | undefined | null): string[] {
  return (raw ?? '').split(',').map(s => s.trim()).filter(Boolean);
}

export function isFinanceUser(
  user: { department_id?: number | null; employee_id?: string | null },
  deptIds: string[],
  employeeIds: string[],
): boolean {
  const dept = user.department_id;
  if (dept !== null && dept !== undefined && deptIds.includes(String(dept))) return true;
  return !!user.employee_id && employeeIds.includes(user.employee_id);
}

/**
 * Group Finance is open only to admins (role "a") and finance staff (is_finance, from the
 * department / employee lists above, set at login); everyone else sees it as "เปิดใช้เร็ว ๆ นี้".
 */
export function canUseFinance(user: { role?: string | null; is_finance?: boolean } | null | undefined): boolean {
  return !!user && (user.role === 'a' || user.is_finance === true);
}

export function financeConfig(env: Record<string, string | undefined> = process.env) {
  return {
    deptIds: parseIdList(env.FINANCE_DEPARTMENT_IDS ?? '4,6'),
    employeeIds: parseIdList(env.FINANCE_EMPLOYEE_IDS),
  };
}

export type AccountingConfig = {
  accDepts: string[]; accEmployees: string[];
  treDepts: string[]; treEmployees: string[];
};

/**
 * บัญชีกับการเงินเป็นคนละฝ่าย: ขั้น 6 (ตรวจเอกสาร) เป็นงานบัญชี ขั้น 7 (ปิดรอบคืนยอด) เป็นงานการเงิน
 * ไม่มีค่า default — ไม่ตั้ง env = ไม่มีใครเป็น ดีกว่าเปิดสิทธิ์ให้คนทั้งแผนกโดยไม่ตั้งใจ
 * (ของเดิม `financeConfig` ยังมี default 4,6 ไว้ให้ Advance ทำงานเหมือนเดิม)
 */
export function accountingConfig(env: Record<string, string | undefined> = process.env): AccountingConfig {
  return {
    accDepts: parseIdList(env.ACCOUNTING_DEPARTMENT_IDS),
    accEmployees: parseIdList(env.ACCOUNTING_EMPLOYEE_IDS),
    treDepts: parseIdList(env.TREASURY_DEPARTMENT_IDS),
    treEmployees: parseIdList(env.TREASURY_EMPLOYEE_IDS),
  };
}

export function isAccountingUser(
  user: { department_id?: number | null; employee_id?: string | null },
  cfg: AccountingConfig,
): boolean {
  return isFinanceUser(user, cfg.accDepts, cfg.accEmployees);
}

export function isTreasuryUser(
  user: { department_id?: number | null; employee_id?: string | null },
  cfg: AccountingConfig,
): boolean {
  return isFinanceUser(user, cfg.treDepts, cfg.treEmployees);
}
