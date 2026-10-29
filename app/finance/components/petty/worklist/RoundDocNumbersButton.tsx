'use client';

import { useState } from 'react';
import { PencilLine } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useSessionContext } from '@/app/context/SessionContext';
import type { PettyRound } from '@/app/finance/types-petty';
import { editableRoundDocFields } from '@/lib/finance/petty-access';
import {
  DOC_NO_MAX, ROUND_DOC_LABELS, roundDocChanges, roundDocError, type RoundDocField, type RoundDupField,
} from '@/lib/finance/petty-worklist';
import { formatDate } from '@/lib/finance/status';
import { showSuccess } from '../../../api';
import { editRoundDocNumbers, roundDuplicateWarning } from '../../../petty-api';
import { DateField } from '../../DateField';

/**
 * แก้เลขที่เอกสารของรอบที่กรอกผิด — แบบ EditDocNumbersButton ของ Advance: บัญชีแก้เลขที่/วันที่ตั้งเบิก (รอจ่าย ปิดแล้ว)
 * การเงินแก้เลขที่ทำจ่าย (ปิดแล้ว) · รอบไม่เปลี่ยนสถานะ ประวัติเก็บค่าเดิม · เลขซ้ำเตือนในกล่องนี้ กดบันทึกอีกครั้งเพื่อยืนยัน
 */
export function RoundDocNumbersButton({ round, onSaved }: { round: PettyRound; onSaved: () => void }) {
  const { user } = useSessionContext();
  const fields = editableRoundDocFields(user, round);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Partial<Record<RoundDocField, string>>>({});
  const [error, setError] = useState('');
  const [warning, setWarning] = useState<{ key: string; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  if (!fields.length) return null;

  const before = (f: RoundDocField) => (f === 'voucher_date' ? formatDate(round.voucher_date) : (round[f] || '-'));

  const start = () => {
    setDraft(Object.fromEntries(fields.map(f => [f, round[f] ?? ''])));
    setError(''); setWarning(null);
    setOpen(true);
  };

  const save = async () => {
    const changes = roundDocChanges(round, draft, fields);
    const err = roundDocError(changes);
    if (err) { setError(err); return; }
    setError('');
    const key = JSON.stringify(changes);
    if (warning?.key !== key) {
      const dupFields = (['voucher_no', 'pay_doc_no'] as RoundDupField[]).filter(f => changes[f]);
      const found = (await Promise.all(dupFields.map(f => roundDuplicateWarning(f, changes[f], round.id)))).filter(Boolean);
      if (found.length) { setWarning({ key, text: found.join(' · ') }); return; }
    }
    setSaving(true);
    try {
      // เลขที่ว่าง = ล้างเลข (เลขที่ตั้งเบิก/ทำจ่ายไม่บังคับ) · วันที่ตั้งเบิกว่างไม่ได้ (เช็กแล้วข้างบน)
      const body: Partial<Record<RoundDocField, string | null>> = {};
      for (const [f, v] of Object.entries(changes) as [RoundDocField, string][]) body[f] = f === 'voucher_date' ? v : (v || null);
      await editRoundDocNumbers(round.id, body);
      setOpen(false);
      await showSuccess('แก้ไขเลขที่เอกสารแล้ว');
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const pending = warning !== null && warning.key === JSON.stringify(roundDocChanges(round, draft, fields));

  return (
    <>
      <Button type="button" variant="outline" onClick={start}>
        <PencilLine className="mr-1 h-4 w-4" /> แก้ไขเลขที่เอกสาร
      </Button>
      <Dialog open={open} onOpenChange={v => { if (!saving) setOpen(v); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>แก้ไขเลขที่เอกสาร</DialogTitle>
            <DialogDescription>{round.batch_no} · ประวัติรอบเก็บค่าเดิมกับค่าใหม่ไว้ให้</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {fields.map(f => (
              <label key={f} className="block space-y-1 text-sm">
                <span>{ROUND_DOC_LABELS[f]} <span className="text-xs text-gray-400">เดิม {before(f)}</span></span>
                {f === 'voucher_date' ? (
                  <DateField value={draft[f] ?? ''} disabled={saving} onChange={v => setDraft(d => ({ ...d, [f]: v }))} />
                ) : (
                  <Input value={draft[f] ?? ''} disabled={saving} maxLength={DOC_NO_MAX}
                    onChange={e => setDraft(d => ({ ...d, [f]: e.target.value }))} />
                )}
              </label>
            ))}
            {error && <p className="text-sm text-rose-600">{error}</p>}
            {pending && <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">{warning?.text}</p>}
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={saving}>ยกเลิก</Button>
            <Button type="button" onClick={save} disabled={saving}>
              {saving ? 'กำลังบันทึก...' : pending ? 'ยืนยันบันทึก (เลขซ้ำ)' : 'บันทึก'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
