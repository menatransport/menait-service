'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import type { PettyRound } from '@/app/finance/types-petty';
import { formatBaht } from '@/lib/finance/status';
import { showAlert, showSuccess } from '../../../api';
import { postRoundAction } from '../../../petty-api';
import { Panel } from '../../FinanceShell';
import { pettyConfirm } from '../petty-confirm';

/** หัวหน้าตามสายงานอนุมัติเคลียร์ทั้งรอบ — หน้าตาแบบ ClearApprovalPanel ของ Advance (อีเมลแจ้งหัวหน้าลิงก์มาหน้านี้) */
export function RoundClearPanel({ round, onSaved }: { round: PettyRound; onSaved: () => void }) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const count = round.claim_count ?? round.claims?.length ?? 0;

  const act = async (action: 'clear-approve' | 'clear-reject') => {
    if (action === 'clear-reject' && !reason.trim()) {
      await showAlert({ icon: 'warning', title: 'กรุณาระบุเหตุผลที่ไม่อนุมัติ' });
      return;
    }
    const ok = await pettyConfirm({
      title: action === 'clear-approve' ? 'อนุมัติเคลียร์รอบนี้?' : 'ไม่อนุมัติรอบนี้?',
      text: `${round.batch_no} · ${count} ใบ รวม ${formatBaht(round.total_amount)} บาท`,
    }, { danger: action === 'clear-reject' }) as { isConfirmed?: boolean };
    if (!ok.isConfirmed) return;
    setBusy(true);
    try {
      await postRoundAction(round.id, action, action === 'clear-reject' ? { reason: reason.trim() } : {});
      await showSuccess(action === 'clear-approve' ? 'อนุมัติเคลียร์แล้ว' : 'ไม่อนุมัติรอบนี้แล้ว');
      onSaved();
    } catch (err) {
      showAlert({ icon: 'error', title: 'ทำรายการไม่สำเร็จ', text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel title="อนุมัติเคลียร์">
      <div className="space-y-4">
        <p className="text-sm text-ink-700">
          {round.holder_name ?? 'เจ้าของเงินสด'} ส่งเคลียร์ {count} ใบ รวม <b>{formatBaht(round.total_amount)}</b> บาท
          {' '}— อนุมัติแล้วส่งต่อให้บัญชีตรวจ
        </p>
        <label className="block space-y-1 text-sm">เหตุผล (บังคับเมื่อไม่อนุมัติ)
          <Textarea value={reason} onChange={e => setReason(e.target.value)} disabled={busy} maxLength={1000}
            placeholder="เช่น ใบชั่งไม่ตรงกับวันที่ในใบเบิก" />
        </label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button type="button" onClick={() => act('clear-approve')} disabled={busy}
            className="h-11 flex-1 rounded-xl bg-linear-to-r from-brand-600 to-brand-500 font-semibold text-white hover:from-brand-700 hover:to-brand-600">
            อนุมัติเคลียร์
          </Button>
          <Button type="button" variant="outline" onClick={() => act('clear-reject')} disabled={busy}
            className="h-11 flex-1 rounded-xl border-rose-300 text-rose-600 hover:bg-rose-50">
            ไม่อนุมัติ
          </Button>
        </div>
        <p className="text-xs text-ink-500">ไม่อนุมัติแล้ว ใบทั้งหมดกลับไปให้เจ้าของเงินสดจัดรอบใหม่</p>
      </div>
    </Panel>
  );
}
