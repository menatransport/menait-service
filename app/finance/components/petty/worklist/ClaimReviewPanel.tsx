'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import type { PettyClaim } from '@/app/finance/types-petty';
import { formatBaht } from '@/lib/finance/status';
import { showAlert, showSuccess } from '../../../api';
import { reviewClaim } from '../../../petty-api';
import { Panel } from '../../FinanceShell';
import { PRIMARY_BTN } from './RoundVoucherForm';
import { pettyReview } from '../petty-confirm';

/**
 * บัญชีตรวจทีละใบ — หน้าตาแบบ ReviewPanel ของ Advance: สรุปยอด · ปุ่มหลักเต็มแถว · เส้นคั่น · เหตุผล + ส่งกลับแก้ไข
 * ทุกปุ่มมีป๊อปอัปทบทวนก่อนบันทึก (กติกาเดียวกับ Advance)
 */
export function ClaimReviewPanel({ claim, needsDd, onSaved }: { claim: PettyClaim; needsDd: boolean; onSaved: () => void }) {
  const [remark, setRemark] = useState('');
  const [saving, setSaving] = useState(false);
  const missingDd = needsDd && !claim.dd_no;

  const pass = async () => {
    if (!(await pettyReview({
      title: 'ยืนยันตรวจผ่าน?',
      rows: [['เลขที่ใบเบิก', claim.form_id], ['ยอดเงิน (บาท)', formatBaht(claim.amount)], ['เลขที่ DD', claim.dd_no]],
      warning: missingDd ? 'ใบนี้ยังไม่มีเลข DD' : null,
      note: 'ผ่านครบทุกใบในรอบแล้ว รอบจะไปรอตั้งเบิก',
      confirmButtonText: 'ยืนยันตรวจผ่าน',
    }))) return;
    setSaving(true);
    try {
      await reviewClaim(claim.form_id, true);
      await showSuccess('ตรวจผ่านแล้ว');
      onSaved();
    } catch (err) {
      showAlert({ icon: 'error', title: 'บันทึกไม่สำเร็จ', text: (err as Error).message });
    } finally {
      setSaving(false);
    }
  };

  const sendBack = async () => {
    if (!remark.trim()) return showAlert({ icon: 'warning', title: 'กรุณาระบุเหตุผลที่ส่งกลับ' });
    if (!(await pettyReview({
      title: 'ส่งกลับให้ผู้เปิดใบแก้ไข?',
      rows: [['เลขที่ใบเบิก', claim.form_id], ['เหตุผลที่ส่งกลับ', remark.trim()]],
      note: 'ผู้เปิดใบแก้แล้วส่งกลับมาที่บัญชีได้เลย ไม่ต้องผ่านหัวหน้าอีก',
      confirmButtonText: 'ยืนยันส่งกลับ', danger: true,
    }))) return;
    setSaving(true);
    try {
      await reviewClaim(claim.form_id, false, remark.trim());
      setRemark('');
      await showSuccess('ส่งกลับแก้ไขแล้ว');
      onSaved();
    } catch (err) {
      showAlert({ icon: 'error', title: 'ส่งกลับไม่สำเร็จ', text: (err as Error).message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Panel title="บัญชีตรวจ">
      <div className="space-y-4">
        <p className="rounded-xl bg-gray-50 px-4 py-3 text-sm">
          ยอดเงิน <span className="font-semibold">{formatBaht(claim.amount)}</span> บาท
          {' · '}เลขที่ DD {claim.dd_no ? <span className="font-semibold">{claim.dd_no}</span>
            : <span className={missingDd ? 'font-medium text-rose-600' : 'text-gray-500'}>{missingDd ? 'ยังไม่มี' : '-'}</span>}
        </p>
        <Button type="button" onClick={pass} disabled={saving} className={PRIMARY_BTN}>ตรวจผ่าน</Button>
        <div className="space-y-2 border-t border-gray-100 pt-4">
          <label className="block space-y-1 text-sm">เหตุผลที่ส่งกลับแก้ไข
            <Textarea value={remark} onChange={e => setRemark(e.target.value)} disabled={saving} maxLength={1000}
              placeholder="เช่น ใบชั่งเบลอ อ่านเลขบัตรไม่ออก" />
          </label>
          <Button type="button" variant="outline" onClick={sendBack} disabled={saving}
            className="h-11 w-full rounded-xl border-orange-300 text-sun-700 hover:bg-orange-50">
            ส่งกลับแก้ไข
          </Button>
        </div>
      </div>
    </Panel>
  );
}
