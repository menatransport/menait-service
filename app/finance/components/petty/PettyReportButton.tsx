'use client';

import { useState } from 'react';
import { FileSpreadsheet } from 'lucide-react';
import type { PettyExpenseType, PettyFund } from '@/app/finance/types-petty';
import { exportPettyReportXlsx } from '@/lib/finance/petty-report';
import { bangkokToday } from '@/lib/finance/petty-doc';
import { showAlert, showSuccess } from '../../api';
import { listAllClaims } from '../../petty-api';
import { pettyConfirm } from './petty-confirm';

const ids = { from: 'petty-report-from', to: 'petty-report-to' };

/** ปุ่มรายงาน Excel ของบัญชี (ข้อ 14 ผู้ใช้สั่ง 7/11/2026): ถามช่วงวันที่โอน แล้วออกชีต Summary (ประเภท × ประเภทรถ) + Detail */
export function PettyReportButton({ types, funds }: { types: PettyExpenseType[]; funds: PettyFund[] }) {
  const [busy, setBusy] = useState(false);

  async function run() {
    const today = bangkokToday();
    const first = `${today.slice(0, 7)}-01`;
    const input = (id: string, value: string, label: string) =>
      `<label style="display:block;text-align:left;font-size:13px;color:#5a6a80;margin:8px 0 4px">${label}</label>`
      + `<input id="${id}" type="date" value="${value}" max="${today}" style="display:block;width:100%;box-sizing:border-box;height:40px;padding:0 10px;border:1px solid #dbe4f3;border-radius:10px;font-size:14px;color:#10233f">`;
    const res = await pettyConfirm({
      title: 'รายงานเงินสดย่อย (Excel)',
      html: `<div style="text-align:left;font-size:13px;color:#6b7f9e">ช่วงวันที่โอนเงิน (รายงานยึดวันที่โอน ไม่ใช่วันเปิดใบ)</div>${input(ids.from, first, 'ตั้งแต่')}${input(ids.to, today, 'ถึง')}`,
      confirmButtonText: 'ดาวน์โหลด Excel', focusConfirm: false,
      preConfirm: () => {
        const from = (document.getElementById(ids.from) as HTMLInputElement | null)?.value ?? '';
        const to = (document.getElementById(ids.to) as HTMLInputElement | null)?.value ?? '';
        return { from, to };
      },
    }) as { isConfirmed?: boolean; value?: { from: string; to: string } };
    if (!res?.isConfirmed || !res.value) return;
    const { from, to } = res.value;
    if (from && to && from > to) { showAlert({ icon: 'warning', title: 'วันเริ่มต้นต้องไม่เกินวันสิ้นสุด' }); return; }
    setBusy(true);
    try {
      const { items } = await listAllClaims({ view: 'all' });  // บัญชี/การเงินเห็นทุกใบ
      const count = await exportPettyReportXlsx({ claims: items, types, funds, from, to, fileName: `petty-report_${from || 'all'}_${to || 'all'}.xlsx` });
      if (count === 0) showAlert({ icon: 'info', title: 'ช่วงนี้ไม่มีใบที่โอนแล้ว', text: 'ไฟล์ออกมาแต่ไม่มีแถว ลองขยายช่วงวันที่' });
      else showSuccess(`ออกรายงาน ${count} ใบ`);
    } catch (err) {
      showAlert({ icon: 'error', title: 'ออกรายงานไม่สำเร็จ', text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <button type="button" onClick={() => void run()} disabled={busy}
      className="v2-glass inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium text-ink-900 transition-shadow hover:shadow-md disabled:opacity-60">
      <FileSpreadsheet className="size-4" />
      {busy ? 'กำลังออกรายงาน…' : 'รายงาน Excel'}
    </button>
  );
}
