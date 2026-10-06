'use client';

import { usePathname, useRouter } from 'next/navigation';
import { Sparkles } from 'lucide-react';
import Loading from '@/components/loading';
import { Mascot } from '@/components/mascot';
import { useSessionContext } from '@/app/context/SessionContext';
import { canUseFinance } from '@/lib/finance/role';
import { FinanceShell } from './components/FinanceShell';

/**
 * Group Finance is open to admins and finance staff only for now (canUseFinance); anyone else who
 * reaches a /finance page sees "เปิดใช้เร็ว ๆ นี้". /finance/approvals stays open so an approver
 * outside finance can still act on a link sent to them (email / share link → /finance/approvals?doc=…).
 */
export default function FinanceLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useSessionContext();
  const pathname = usePathname();
  const router = useRouter();

  if (pathname.startsWith('/finance/approvals')) return children;
  if (loading) return <Loading />;
  if (canUseFinance(user)) return children;

  return (
    <FinanceShell title="Group Finance">
      <div className="rounded-2xl sm:rounded-3xl bg-white px-6 py-10 shadow-xl flex flex-col items-center text-center gap-3">
        <Mascot size={96} motion="bob" />
        <span className="inline-flex items-center gap-1.5 rounded-full bg-mint-300/25 px-3 py-1 text-xs font-semibold text-mint-700">
          <Sparkles className="w-3.5 h-3.5" /> เปิดใช้เร็ว ๆ นี้
        </span>
        <p className="font-display text-base font-semibold text-ink-900">ระบบการเงินกำลังจะเปิดให้ใช้งาน</p>
        <p className="text-sm text-ink-500">ตอนนี้เปิดให้ฝ่ายบัญชีและการเงินทดลองใช้ก่อน แล้วจะเปิดให้ทุกคนเร็ว ๆ นี้</p>
        <button
          type="button"
          onClick={() => router.push('/home')}
          className="mt-2 h-10 px-5 rounded-full bg-brand-600 text-sm font-semibold text-white hover:bg-brand-700 cursor-pointer transition-colors"
        >
          กลับหน้าหลัก
        </button>
      </div>
    </FinanceShell>
  );
}
