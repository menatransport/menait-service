'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Panel } from './FinanceShell';
import { putAction, showAlert, showConfirm, showSuccess } from '../api';
import { formatBaht } from '@/lib/finance/status';
import type { AdvanceDetail } from '../types';

/** ด่านอนุมัติการเคลียร์ — ผู้เบิกส่งเคลียร์แล้วต้องผ่านหัวหน้าก่อนถึงบัญชี (19/10/2026) */
export function ClearApprovalPanel({ detail, onSaved }: {
  detail: AdvanceDetail;
  onSaved: (d: AdvanceDetail) => void;
}) {
  const [remark, setRemark] = useState('');
  const [busy, setBusy] = useState(false);
  const actual = detail.fin?.amount_actual ?? null;
  const step = detail.clear_approval?.step ?? 1;
  const total = detail.clear_approval?.total_steps ?? 1;

  const act = async (action: 'clear-approve' | 'clear-reject') => {
    if (action === 'clear-reject' && !remark.trim()) {
      await showAlert({ icon: 'warning', title: 'กรุณาระบุเหตุผลที่ไม่อนุมัติการเคลียร์' });
      return;
    }
    const ok = await showConfirm({
      title: action === 'clear-approve' ? 'อนุมัติการเคลียร์?' : 'ไม่อนุมัติการเคลียร์?',
      text: `${detail.form_id} · ยอดใช้จริง ${formatBaht(actual)}`,
    });
    if (!ok.isConfirmed) return;
    setBusy(true);
    try {
      const body = action === 'clear-approve'
        ? { remark: remark.trim() || undefined }
        : { review_remark: remark.trim() };
      const data = await putAction(detail.form_id, action, body);
      await showSuccess(action === 'clear-approve' ? 'อนุมัติการเคลียร์แล้ว' : 'ส่งกลับให้ผู้เบิกแก้ไขแล้ว');
      onSaved(data);
    } catch (err) {
      showAlert({ icon: 'error', title: 'ทำรายการไม่สำเร็จ', text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel title={`อนุมัติการเคลียร์ · ขั้น ${step}/${total}`}>
      <div className="space-y-4">
        <p className="text-sm text-ink-700">
          ผู้เบิกส่งเอกสารเคลียร์แล้ว ยอดใช้จริง <b>{formatBaht(actual)}</b> บาท
          {detail.clear_approval?.clause ? ` · เข้าข้อ ${detail.clear_approval.clause}` : ''}
          {' '}— อนุมัติแล้วจึงส่งต่อให้บัญชีตรวจ
        </p>
        <label className="block space-y-1 text-sm">หมายเหตุ (บังคับเมื่อไม่อนุมัติ)
          <Textarea value={remark} onChange={e => setRemark(e.target.value)} disabled={busy}
            placeholder="เช่น ใบเสร็จค่าที่พักไม่ตรงกับวันเดินทาง" />
        </label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button type="button" onClick={() => act('clear-approve')} disabled={busy}
            className="h-11 flex-1 rounded-xl bg-linear-to-r from-brand-600 to-brand-500 font-semibold text-white hover:from-brand-700 hover:to-brand-600">
            อนุมัติการเคลียร์
          </Button>
          <Button type="button" variant="outline" onClick={() => act('clear-reject')} disabled={busy}
            className="h-11 flex-1 rounded-xl border-rose-300 text-rose-600 hover:bg-rose-50">
            ไม่อนุมัติ ส่งกลับให้แก้
          </Button>
        </div>
      </div>
    </Panel>
  );
}
