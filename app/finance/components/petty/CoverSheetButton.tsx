'use client';

import { useState } from 'react';
import { FileStack } from 'lucide-react';
import type { PettyClaim, PettyExpenseType, PettyFund } from '@/app/finance/types-petty';
import { clerkNameOf, coverSheetHtml, groupByClerk } from '@/lib/finance/petty-cover';
import { openPrintWindow } from '@/lib/finance/printShared';
import { showAlert } from '@/app/finance/api';

/** ใบปะหน้า 1 ชุดต่อเจ้าหน้าที่ — แยกตามชื่อเจ้าหน้าที่ผู้เปิดใบ ตามที่ตกลงไว้ */
export function CoverSheetButton({ claims, types, funds }: {
  claims: PettyClaim[];
  types: PettyExpenseType[];
  funds: PettyFund[];
}) {
  const [open, setOpen] = useState(false);
  const groups = groupByClerk(claims);

  function print(clerk: string) {
    const group = groups.find(g => g.clerk === clerk);
    if (!group) return;
    const fund = funds.find(f => f.id === group.claims[0]?.fund_id) ?? null;
    const html = coverSheetHtml({
      group, types, clerkName: clerkNameOf(group),
      branchCode: fund?.branch_code ?? '-', divisionCode: fund?.division_code ?? '-',
      logoUrl: `${window.location.origin}/mena.png`,
    });
    if (!openPrintWindow(html)) {
      showAlert({ icon: 'warning', title: 'เบราว์เซอร์บล็อกหน้าต่างพิมพ์',
        text: 'อนุญาต pop-up ของเว็บนี้แล้วลองอีกครั้ง' });
    }
    setOpen(false);
  }

  if (groups.length === 0) return null;

  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen(v => !v)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm">
        <FileStack className="h-4 w-4" /> ใบปะหน้า
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-1 w-72 rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
          <p className="px-3 py-1 text-xs text-ink-400">เลือกเจ้าหน้าที่</p>
          {groups.map(g => (
            <button key={g.clerk} type="button" onClick={() => print(g.clerk)}
              className="flex w-full items-center justify-between px-3 py-1.5 text-left text-sm hover:bg-slate-50">
              <span>{clerkNameOf(g)}</span>
              <span className="tabular-nums text-ink-500">
                {g.claims.length} ใบ · {g.total.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
