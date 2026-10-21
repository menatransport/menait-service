'use client';

/**
 * Group Finance is open to every signed-in user (เปิดใช้งานจริง 21/10/2026).
 * Finance-staff pages (/finance worklist, /finance/[form_id], /finance/payee-accounts) still check
 * user.is_finance / finance permissions themselves and show NoAccess to everyone else.
 */
export default function FinanceLayout({ children }: { children: React.ReactNode }) {
  return children;
}
