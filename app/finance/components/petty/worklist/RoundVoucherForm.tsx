'use client';

import { useState } from 'react';
import { UserRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { PettyRound } from '@/app/finance/types-petty';
import { voucherFormError, voucherPayload } from '@/lib/finance/petty-worklist';
import { formatBaht, formatDate, todayBkk } from '@/lib/finance/status';
import { showAlert, showSuccess } from '../../../api';
import { roundDuplicateWarning, voucherRound } from '../../../petty-api';
import { DateField } from '../../DateField';
import { Panel } from '../../FinanceShell';
import { pettyReview } from '../petty-confirm';

export const PRIMARY_BTN = 'w-full h-11 rounded-xl bg-linear-to-r from-brand-600 to-brand-500 hover:from-brand-700 hover:to-brand-600 text-white font-semibold shadow-md hover:shadow-lg transition-all disabled:opacity-60';

/** ชิปบอกว่าเงินรอบนี้จ่ายคืนใคร — วางตรงที่ Advance วางป้ายบัญชีตัวเอง/Supplier */
export function HolderChip({ name }: { name: string | null }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-mint-700">
      <UserRound className="size-3" /> จ่ายคืนเจ้าของเงินสด · {name ?? '-'}
    </span>
  );
}

/** กล่องตั้งเบิกทั้งรอบ — หน้าตาและลำดับเดียวกับ VoucherForm ของ Advance */
export function RoundVoucherForm({ round, onSaved }: { round: PettyRound; onSaved: () => void }) {
  const [voucherNo, setVoucherNo] = useState('');
  const [voucherDate, setVoucherDate] = useState(() => todayBkk());
  const [saving, setSaving] = useState(false);
  const count = round.claim_count ?? round.claims?.length ?? 0;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const err = voucherFormError(voucherNo, voucherDate);
    if (err) return showAlert({ icon: 'warning', title: err });
    const warning = await roundDuplicateWarning('voucher_no', voucherNo, round.id);
    if (!(await pettyReview({
      warning,
      title: 'ยืนยันบันทึกตั้งเบิก',
      rows: [
        ['เลขที่รอบ', round.batch_no],
        ['ยอดเงิน (บาท)', `${formatBaht(round.total_amount)} · ${count} ใบ`],
        ['เลขที่ตั้งเบิก', voucherNo.trim()],
        ['วันที่ตั้งเบิก', formatDate(voucherDate)],
      ],
    }))) return;
    setSaving(true);
    try {
      await voucherRound(round.id, voucherPayload(voucherNo, voucherDate));
      await showSuccess('บันทึกตั้งเบิกแล้ว');
      onSaved();
    } catch (err2) {
      showAlert({ icon: 'error', title: 'บันทึกไม่สำเร็จ', text: (err2 as Error).message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Panel title="ตั้งเบิกทำจ่าย">
      <div className="mb-4"><HolderChip name={round.holder_name} /></div>
      <form onSubmit={submit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="space-y-1 text-sm">เลขที่ตั้งเบิก
          <Input value={voucherNo} onChange={e => setVoucherNo(e.target.value)} placeholder="เช่น PV2610-014" maxLength={50} disabled={saving} />
        </label>
        <label className="space-y-1 text-sm">วันที่ตั้งเบิก *
          <DateField value={voucherDate} onChange={setVoucherDate} disabled={saving} />
        </label>
        <div className="sm:col-span-2">
          <Button type="submit" disabled={saving} className={PRIMARY_BTN}>
            {saving ? 'กำลังบันทึก...' : 'บันทึกตั้งเบิก'}
          </Button>
        </div>
      </form>
    </Panel>
  );
}
