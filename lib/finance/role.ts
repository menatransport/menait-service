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

/** คนนอกแผนกการเงินที่ต้องเข้าหน้าการเงินได้เสมอ
 * 660057 คุณป้อง ผู้บริหาร อนุมัติขั้น 2 ใบยอดสูง · 670108 narongkorn.a superadmin ทำได้ทุกปุ่ม (หลังบ้านกำหนดสิทธิ์) */
const ALWAYS_FINANCE_IDS = ['660057', '670108'];

/** แผนกที่เข้าหน้าการเงินได้เสมอ ไม่ขึ้นกับ env · 4 = แผนกการเงิน (ผู้ใช้สั่ง 21/10/2026) */
const ALWAYS_FINANCE_DEPT_IDS = ['4'];

export function financeConfig(env: Record<string, string | undefined> = process.env) {
  return {
    deptIds: [...new Set([...ALWAYS_FINANCE_DEPT_IDS, ...parseIdList(env.FINANCE_DEPARTMENT_IDS ?? '4,6')])],
    employeeIds: [...new Set([...ALWAYS_FINANCE_IDS, ...parseIdList(env.FINANCE_EMPLOYEE_IDS)])],
  };
}
