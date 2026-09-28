'use client';

import { Navbar } from '@/components/navbar';

export function FinanceShell({ title, wide = false, children }: { title: string; wide?: boolean; children: React.ReactNode }) {
  return (
    <Navbar isHome={false} title={title}>
      <main className="flex-1 min-h-0 bg-[#026a75] rounded-t-[1.5rem] sm:rounded-t-[2rem] lg:rounded-t-[3rem] shadow-2xl overflow-y-auto relative">
        <div className={`${wide ? 'max-w-7xl' : 'max-w-4xl'} mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-4`}>
          {children}
        </div>
      </main>
    </Navbar>
  );
}

export function Panel({ title, children, actions }: { title: string; children: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <section className="rounded-2xl bg-white p-4 sm:p-6 shadow-xl">
      <div className="mb-4 flex items-center justify-between gap-2 border-b border-gray-100 pb-3">
        <h2 className="text-base font-semibold text-[#055058]">{title}</h2>
        {actions}
      </div>
      {children}
    </section>
  );
}

export function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-sm font-medium text-gray-800 break-words">{value ?? '-'}</p>
    </div>
  );
}

export function NoAccess({ text = 'หน้านี้สำหรับฝ่ายการเงินเท่านั้น' }: { text?: string }) {
  return <div className="rounded-2xl bg-white p-8 text-center text-sm text-gray-500 shadow-xl">{text}</div>;
}
