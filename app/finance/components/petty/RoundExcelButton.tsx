'use client';

import { useState } from 'react';
import { FileSpreadsheet } from 'lucide-react';
import type { PettyExpenseType, PettyRound } from '@/app/finance/types-petty';
import { bangkokToday } from '@/lib/finance/petty-doc';
import { exportRoundsXlsx, roundsInRange, type RoundWithClaims } from '@/lib/finance/petty-round-export';
import { showAlert, showSuccess } from '../../api';
import { getRound } from '../../petty-api';
import { pettyConfirm } from './petty-confirm';

const ids = { from: 'round-xlsx-from', to: 'round-xlsx-to' };

/** Excel รอบที่ส่งเคลียร์ของวงเงินนี้ (ผู้ใช้ขอ 25/11/2026): ถามช่วงวันที่ส่งเคลียร์ → ชีตรอบ + ชีตใบในรอบ */
export function RoundExcelButton({ rounds, types, fileTag }: { rounds: readonly PettyRound[]; types: PettyExpenseType[]; fileTag: string }) {
  const [busy, setBusy] = useState(false);

  async function run() {
    const today = bangkokToday();
    const first = `${today.slice(0, 7)}-01`;
    const input = (id: string, value: string, label: string) =>
      `<label style="display:block;text-align:left;font-size:13px;color:#5a6a80;margin:8px 0 4px">${label}</label>`
      + `<input id="${id}" type="date" value="${value}" max="${today}" style="display:block;width:100%;box-sizing:border-box;height:40px;padding:0 10px;border:1px solid #dbe4f3;border-radius:10px;font-size:14px;color:#10233f">`;
    const res = await pettyConfirm({
      title: 'Excel รอบที่ส่งเคลียร์',
      html: `<div style="text-align:left;font-size:13px;color:#6b7f9e">เลือกช่วงวันที่ส่งเคลียร์ ได้รอบละแถว และใบในรอบละแถว (รอบที่หัวหน้าไม่อนุมัติไม่รวม)</div>${input(ids.from, first, 'ส่งเคลียร์ตั้งแต่')}${input(ids.to, today, 'ถึง')}`,
      confirmButtonText: 'ดาวน์โหลด Excel', focusConfirm: false,
      preConfirm: () => ({
        from: (document.getElementById(ids.from) as HTMLInputElement | null)?.value ?? '',
        to: (document.getElementById(ids.to) as HTMLInputElement | null)?.value ?? '',
      }),
    }) as { isConfirmed?: boolean; value?: { from: string; to: string } };
    if (!res?.isConfirmed || !res.value) return;
    const { from, to } = res.value;
    if (from && to && from > to) { showAlert({ icon: 'warning', title: 'วันเริ่มต้นต้องไม่เกินวันสิ้นสุด' }); return; }
    const picked = roundsInRange(rounds, from, to);
    if (picked.length === 0) { showAlert({ icon: 'info', title: 'ช่วงนี้ไม่มีรอบที่ส่งเคลียร์', text: 'ลองขยายช่วงวันที่' }); return; }
    setBusy(true);
    try {
      // รายการรอบไม่มีใบติดมา → ขอรายละเอียดทีละรอบ (ทีละ 5 กันยิงพร้อมกันเยอะ)
      const full: RoundWithClaims[] = [];
      for (let i = 0; i < picked.length; i += 5) {
        const chunk = await Promise.all(picked.slice(i, i + 5).map(r => (r.claims ? r : getRound(r.id))));
        full.push(...chunk.map(r => ({ ...r, claims: r.claims ?? [] })));
      }
      await exportRoundsXlsx(full, types, `petty-rounds_${fileTag}_${from || 'all'}_${to || 'all'}.xlsx`);
      showSuccess(`ออก Excel ${full.length} รอบ ${full.reduce((s, r) => s + r.claims.length, 0)} ใบ`);
    } catch (err) {
      showAlert({ icon: 'error', title: 'ออก Excel ไม่สำเร็จ', text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <button type="button" onClick={() => void run()} disabled={busy}
      className="inline-flex items-center gap-2 rounded-xl border border-[#dbe4f3] bg-white px-3 py-2 text-sm font-medium text-ink-900 transition-shadow hover:shadow-md disabled:opacity-60">
      <FileSpreadsheet className="size-4 text-mint-700" />
      {busy ? 'กำลังออก Excel…' : 'Excel รอบที่ส่งเคลียร์'}
    </button>
  );
}
