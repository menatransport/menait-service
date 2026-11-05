'use client';

import { useState } from 'react';
import { Check, Undo2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { PettyClaim, PettyRound } from '@/app/finance/types-petty';
import { voucherFormError, voucherPayload } from '@/lib/finance/petty-worklist';
import { formatBaht, formatDate, todayBkk } from '@/lib/finance/status';
import { showAlert, showSuccess } from '../../../api';
import { reviewClaim, roundDuplicateWarning, voucherRound } from '../../../petty-api';
import { DateField } from '../../DateField';
import { Panel } from '../../FinanceShell';
import { pettyConfirm, pettyReview } from '../petty-confirm';
import { HolderChip, PRIMARY_BTN } from './RoundVoucherForm';
import { ClaimBadge } from './StatusBadges';

/** ใบที่บัญชียังต้องตัดสิน (ผ่าน/ส่งกลับ) */
const waiting = (c: PettyClaim) => c.status === 'AWAITING_REVIEW';
const sentBack = (c: PettyClaim) => c.status === 'SENT_BACK';

/**
 * บัญชีตรวจและตั้งเบิกทั้งรอบในกล่องเดียว (ผู้ใช้สั่ง 5/11/2026 "รวบ รอบัญชีตรวจกับตั้งเบิก เป็นขั้นตอนเดียว")
 * - แต่ละใบกด ผ่าน / ส่งกลับ ได้ทีละใบตรงนี้ ไม่ต้องเปิดใบ
 * - ปุ่มใหญ่ปุ่มเดียว: ตรวจผ่านใบที่เหลือทั้งหมด แล้วตั้งเบิกต่อทันที (กรอกเลขที่/วันที่ตั้งเบิกในกล่องเดียวกัน)
 * - มีใบส่งกลับแก้ไขค้างอยู่ = ตั้งเบิกยังไม่ได้ (BE บังคับว่าทุกใบต้องผ่านก่อน) ปุ่มบอกเหตุผล
 */
export function RoundReviewVoucherPanel({ round, perms, onSaved, onOpenClaim }: {
  round: PettyRound;
  perms: { review: boolean; voucher: boolean };
  onSaved: () => void;
  onOpenClaim: (claim: PettyClaim) => void;
}) {
  const claims = round.claims ?? [];
  const toReview = claims.filter(waiting);
  const blocked = claims.filter(sentBack);
  const [voucherNo, setVoucherNo] = useState('');
  const [voucherDate, setVoucherDate] = useState(() => todayBkk());
  const [busy, setBusy] = useState<string | null>(null);

  const passOne = async (c: PettyClaim) => {
    if (!(await pettyReview({
      title: 'ยืนยันตรวจผ่าน?',
      rows: [['เลขที่ใบเบิก', c.form_id], ['ยอดเงิน (บาท)', formatBaht(c.amount)], ['เลขที่ DD', c.dd_no]],
      warning: c.dd_no ? null : 'ใบนี้ยังไม่มีเลข DD',
      confirmButtonText: 'ยืนยันตรวจผ่าน',
    }))) return;
    setBusy(`pass-${c.id}`);
    try {
      await reviewClaim(c.form_id, true);
      onSaved();
    } catch (err) {
      showAlert({ icon: 'error', title: 'บันทึกไม่สำเร็จ', text: (err as Error).message });
    } finally {
      setBusy(null);
    }
  };

  const sendBackOne = async (c: PettyClaim) => {
    const res = await pettyConfirm({
      title: 'ส่งกลับให้ผู้เปิดใบแก้ไข?', text: `ใบ ${c.form_id} · ${formatBaht(c.amount)} บาท`,
      input: 'textarea', inputLabel: 'เหตุผลที่ส่งกลับ (ผู้เปิดใบจะเห็น แก้แล้วส่งกลับมาที่บัญชีได้เลย)',
      inputPlaceholder: 'เช่น ใบชั่งเบลอ อ่านเลขบัตรไม่ออก',
      inputValidator: (v: string) => (!v?.trim() ? 'กรุณาระบุเหตุผลที่ส่งกลับ' : null),
      confirmButtonText: 'ยืนยันส่งกลับ',
    }, { danger: true }) as { isConfirmed?: boolean; value?: string };
    if (!res?.isConfirmed || !res.value?.trim()) return;
    setBusy(`back-${c.id}`);
    try {
      await reviewClaim(c.form_id, false, res.value.trim());
      onSaved();
    } catch (err) {
      showAlert({ icon: 'error', title: 'ส่งกลับไม่สำเร็จ', text: (err as Error).message });
    } finally {
      setBusy(null);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const err = voucherFormError(voucherNo, voucherDate);
    if (err) return showAlert({ icon: 'warning', title: err });
    const warning = await roundDuplicateWarning('voucher_no', voucherNo, round.id);
    const names = toReview.map(c => c.form_id);
    if (!(await pettyReview({
      warning,
      title: toReview.length ? 'ยืนยันตรวจผ่านที่เหลือและตั้งเบิก' : 'ยืนยันบันทึกตั้งเบิก',
      rows: [
        ['เลขที่รอบ', round.batch_no],
        ...(toReview.length ? [['ตรวจผ่านเพิ่ม', `${toReview.length} ใบ${names.length <= 5 ? ` (${names.join(', ')})` : ''}`] as [string, string]] : []),
        ['ยอดเงิน (บาท)', `${formatBaht(round.total_amount)} · ${claims.length} ใบ`],
        ['เลขที่ตั้งเบิก', voucherNo.trim()],
        ['วันที่ตั้งเบิก', formatDate(voucherDate)],
      ],
      note: toReview.length ? 'ใบที่ยังรอตรวจจะถูกบันทึกว่าตรวจผ่านทั้งหมด แล้วตั้งเบิกต่อทันทีในคลิกเดียว' : undefined,
      confirmButtonText: toReview.length ? 'ผ่านทั้งหมดและตั้งเบิก' : 'บันทึกตั้งเบิก',
    }))) return;
    setBusy('all');
    let step = '';
    try {
      for (const c of toReview) {
        step = `ตรวจผ่านใบ ${c.form_id}`;
        await reviewClaim(c.form_id, true);
      }
      step = 'ตั้งเบิก';
      await voucherRound(round.id, voucherPayload(voucherNo, voucherDate));
      await showSuccess('ตรวจผ่านและตั้งเบิกแล้ว', 'รอบไปรอการเงินทำจ่าย');
      onSaved();
    } catch (err2) {
      showAlert({ icon: 'error', title: `${step}ไม่สำเร็จ`, text: `${(err2 as Error).message} · ใบที่ผ่านไปแล้วยังผ่านอยู่ กดทำต่อได้` });
      onSaved();
    } finally {
      setBusy(null);
    }
  };

  const canVoucher = perms.voucher && blocked.length === 0;
  const buttonText = busy === 'all' ? 'กำลังบันทึก...'
    : toReview.length ? `ตรวจผ่านที่เหลือ ${toReview.length} ใบ และตั้งเบิก` : 'บันทึกตั้งเบิก';

  return (
    <Panel title="ตรวจและตั้งเบิก">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <HolderChip name={round.holder_name} />
        <p className="text-xs text-ink-500">
          ผ่านแล้ว {claims.length - toReview.length - blocked.length}/{claims.length} ใบ
          {blocked.length > 0 && <span className="text-sun-700"> · ส่งกลับแก้ไข {blocked.length} ใบ</span>}
        </p>
      </div>

      {/* ใบในรอบ กดผ่าน/ส่งกลับทีละใบได้ตรงนี้ */}
      <ul className="mb-4 divide-y divide-gray-100 rounded-xl border border-gray-100">
        {claims.map(c => (
          <li key={c.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-sm">
            <button type="button" onClick={() => onOpenClaim(c)} className="font-medium text-brand-800 hover:underline">{c.form_id}</button>
            <span className="max-w-40 truncate text-ink-500" title={c.payee_name ?? undefined}>{c.payee_name ?? '-'}</span>
            <span className="tabular-nums">{formatBaht(c.amount)}</span>
            <span className={`text-xs ${c.dd_no ? 'text-ink-500' : 'text-rose-600'}`}>DD {c.dd_no ?? 'ยังไม่มี'}</span>
            <span className="ml-auto flex items-center gap-1.5">
              <ClaimBadge status={c.status} />
              {perms.review && waiting(c) && (
                <>
                  <Button type="button" size="sm" onClick={() => void passOne(c)} disabled={busy !== null}
                    className="h-8 rounded-lg bg-brand-600 px-2.5 text-white hover:bg-brand-700">
                    <Check className="mr-1 h-3.5 w-3.5" /> {busy === `pass-${c.id}` ? 'กำลังบันทึก' : 'ผ่าน'}
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => void sendBackOne(c)} disabled={busy !== null}
                    className="h-8 rounded-lg border-orange-300 px-2.5 text-sun-700 hover:bg-orange-50">
                    <Undo2 className="mr-1 h-3.5 w-3.5" /> ส่งกลับ
                  </Button>
                </>
              )}
            </span>
            {sentBack(c) && c.review_remark && <p className="w-full text-xs text-sun-700">เหตุผล: {c.review_remark}</p>}
          </li>
        ))}
      </ul>

      {blocked.length > 0 && (
        <p className="mb-3 rounded-xl border border-orange-200 bg-orange-50 px-3 py-2 text-xs text-sun-700">
          มีใบส่งกลับแก้ไข {blocked.length} ใบ รอผู้เปิดใบแนบเอกสารแล้วส่งกลับมา ถึงจะตั้งเบิกทั้งรอบได้
        </p>
      )}

      <form onSubmit={submit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="space-y-1 text-sm">เลขที่ตั้งเบิก
          <Input value={voucherNo} onChange={e => setVoucherNo(e.target.value)} placeholder="เช่น PV2611-014" maxLength={50} disabled={busy !== null} />
        </label>
        <label className="space-y-1 text-sm">วันที่ตั้งเบิก *
          <DateField value={voucherDate} onChange={setVoucherDate} disabled={busy !== null} />
        </label>
        <div className="sm:col-span-2">
          <Button type="submit" disabled={busy !== null || !canVoucher} className={PRIMARY_BTN}
            title={!perms.voucher ? 'ตั้งเบิกได้เฉพาะฝ่ายบัญชี' : blocked.length ? 'มีใบส่งกลับแก้ไขค้างอยู่' : undefined}>
            {buttonText}
          </Button>
        </div>
      </form>
    </Panel>
  );
}
