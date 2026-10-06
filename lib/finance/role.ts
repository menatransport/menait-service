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
