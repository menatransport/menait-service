/** สิทธิ์ตามหน้าที่ของงาน Advance — ชื่อต้องตรงกับ services/finance/permission_logic.py */
export const PERM = {
  voucher: 'voucher',
  pay: 'pay',
  return: 'return',
  clearingReview: 'clearing_review',
  close: 'close',
  payeeAdmin: 'payee_admin',
  overdueRemind: 'overdue_remind',
} as const;

export type Permission = (typeof PERM)[keyof typeof PERM];

export type PermissionState = {
  permissions: Permission[];
  /** หลังบ้านตอบไม่ได้ — ไม่ซ่อนปุ่ม ให้หลังบ้านเป็นคนปฏิเสธแทน */
  unavailable?: boolean;
};

/** ยังโหลดไม่เสร็จหรือหลังบ้านล่ม = ไม่ซ่อน (หลังบ้านกันอยู่แล้ว) */
export function can(state: PermissionState | null, permission: Permission): boolean {
  if (!state || state.unavailable) return true;
  return state.permissions.includes(permission);
}
