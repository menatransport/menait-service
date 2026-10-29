'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { PettyRound } from '@/app/finance/types-petty';
import { bankLabel, formatAccountNo } from '@/lib/finance/bank';
import { pettyFileProblem } from '@/lib/finance/petty-upload';
import { payFormError, payPayload } from '@/lib/finance/petty-worklist';
import { formatBaht, formatDate, todayBkk } from '@/lib/finance/status';
import { confirmReview, showAlert, showSuccess } from '../../../api';
import { payRound, roundDuplicateWarning, uploadRoundSlips } from '../../../petty-api';
import { DateField } from '../../DateField';
import { FilePicker } from '../../FilePicker';
import { Panel } from '../../FinanceShell';
import { HolderChip, PRIMARY_BTN } from './RoundVoucherForm';

/**
 * กล่องจ่ายเงินทั้งรอบ — แบบ PayForm ของ Advance: บัญชีผู้รับ + คัดลอกเลขบัญชี · เลขที่ทำจ่าย · ยอดเงิน · วันที่โอนเงิน
 * · แนบสลิป · ป๊อปอัปทบทวนก่อนบันทึก · เงินสดย่อยไม่มีกำหนดการเคลียร์และวัตถุประสงค์ ยอดเงินคือยอดรวมรอบ แก้ไม่ได้
 */
export function RoundPayForm({ round, onSaved }: { round: PettyRound; onSaved: () => void }) {
  const [payDocNo, setPayDocNo] = useState(round.pay_doc_no ?? '');
  const [payDate, setPayDate] = useState(() => todayBkk());
  const [files, setFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const payee = round.holder_payee;
  const hasAccount = !!payee?.account_no;

  const copyAccount = () => {
    navigator.clipboard?.writeText(payee?.account_no ?? '')
      .then(() => showAlert({ icon: 'success', title: 'คัดลอกเลขที่บัญชีแล้ว', timer: 1200, showConfirmButton: false }))
      .catch(() => showAlert({ icon: 'error', title: 'คัดลอกไม่สำเร็จ' }));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const err = payFormError(payDate, payDocNo);
    if (err) return showAlert({ icon: 'warning', title: err });
    const bad = files.map(f => ({ f, why: pettyFileProblem(f.name, f.size) })).filter(x => x.why);
    if (bad.length) {
      return showAlert({ icon: 'warning', title: 'แนบไฟล์นี้ไม่ได้', text: bad.map(x => `${x.f.name}: ${x.why}`).join('\n') });
    }
    const warning = await roundDuplicateWarning('pay_doc_no', payDocNo, round.id);
    const account = hasAccount
      ? `${bankLabel(payee?.bank)} ${formatAccountNo(payee?.account_no)}\n${payee?.account_name ?? ''}` : null;
    if (!(await confirmReview({
      warning,
      title: 'ยืนยันบันทึกการจ่ายเงิน',
      rows: [
        ['เลขที่รอบ', round.batch_no],
        ['จ่ายคืนให้', round.holder_name ?? round.holder_employee_id],
        ['โอนเข้าบัญชี', account],
        ['เลขที่ทำจ่าย', payDocNo.trim()],
        ['ยอดเงิน (บาท)', formatBaht(round.total_amount)],
        ['วันที่โอนเงิน', formatDate(payDate)],
        ['สลิปโอนที่แนบ', files.length ? `${files.length} ไฟล์` : 'ไม่มี'],
      ],
      note: 'บันทึกแล้วรอบนี้กับทุกใบในรอบจะปิด ยอดคืนเข้าวงเงินของเจ้าของเงินสด',
    }))) return;
    setSaving(true);
    try {
      await payRound(round.id, payPayload(payDate, payDocNo));
      const failed = await uploadRoundSlips(round, files);
      setFiles([]);
      if (failed.length) await showAlert({ icon: 'warning', title: 'บันทึกการจ่ายเงินแล้ว', text: `อัปโหลดไม่สำเร็จ: ${failed.join(', ')}` });
      else await showSuccess('บันทึกการจ่ายเงินแล้ว');
      onSaved();
    } catch (err2) {
      showAlert({ icon: 'error', title: 'บันทึกไม่สำเร็จ', text: (err2 as Error).message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Panel title="จ่ายเงิน">
      <div className="mb-4"><HolderChip name={round.holder_name} /></div>
      <form onSubmit={submit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {hasAccount && (
          <div className="sm:col-span-2 rounded-xl border border-mint-400 bg-mint-400/10 p-3 text-sm">
            <p className="mb-1 font-semibold text-brand-800">โอนเข้าบัญชี</p>
            <p>{bankLabel(payee?.bank)} · <span className="font-mono">{formatAccountNo(payee?.account_no)}</span>
              <button type="button" className="ml-2 text-xs text-brand-600 underline" aria-label="คัดลอกเลขที่บัญชี" onClick={copyAccount}>
                คัดลอก
              </button>
            </p>
            <p className="text-gray-600">ชื่อบัญชี: {payee?.account_name ?? '-'}</p>
          </div>
        )}
        {payee === null && (
          <div className="sm:col-span-2 rounded-xl bg-amber-50 px-3 py-2.5 text-sm">
            <p className="font-medium text-amber-800">ยังไม่มีบัญชีรับเงินของเจ้าของเงินสดในระบบ</p>
            <p className="text-xs text-gray-700">เช็กเลขบัญชีกับเจ้าของเงินสดก่อนโอน หรือให้เขาขอเพิ่มบัญชีรับเงินก่อน</p>
          </div>
        )}
        <label className="space-y-1 text-sm">เลขที่ทำจ่าย
          <Input value={payDocNo} onChange={e => setPayDocNo(e.target.value)} maxLength={50} disabled={saving} />
        </label>
        <label className="space-y-1 text-sm">ยอดเงิน (บาท)
          <Input value={formatBaht(round.total_amount)} readOnly tabIndex={-1} aria-readonly className="bg-gray-50 tabular-nums" />
          <span className="block text-xs text-ink-500">ยอดรวมทั้งรอบ {round.claim_count ?? round.claims?.length ?? 0} ใบ</span>
        </label>
        <label className="space-y-1 text-sm">วันที่โอนเงิน *
          <DateField value={payDate} onChange={setPayDate} disabled={saving} />
        </label>
        <div className="sm:col-span-2">
          <p className="mb-1 text-sm">แนบหลักฐานการจ่าย (สลิปโอน)</p>
          <FilePicker files={files} onChange={setFiles} disabled={saving} />
        </div>
        <div className="sm:col-span-2">
          <Button type="submit" disabled={saving} className={PRIMARY_BTN}>
            {saving ? 'กำลังบันทึก...' : 'บันทึกการจ่ายเงิน'}
          </Button>
        </div>
      </form>
    </Panel>
  );
}
