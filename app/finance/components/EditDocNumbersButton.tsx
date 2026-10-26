'use client';

import { useState } from 'react';
import { PencilLine } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  CLEAR_DOC_NO_MAX, DOC_NO_LABELS, DOC_NO_MAX, docNoChanges, docNoEditError, editableDocFields, type DocNoField,
} from '@/lib/finance/docNo';
import { duplicateDocNoWarning, putAction, showSuccess } from '../api';
import type { AdvanceDetail } from '../types';

/**
 * การเงินแก้เลขที่ตั้งเบิก / เลขที่ทำจ่าย / เลขที่เคลียร์ที่กรอกผิด (ผู้ใช้สั่ง 26/10/2026) — ใบไม่เปลี่ยนสถานะ
 * เลขซ้ำกับใบอื่นเตือนในกล่องนี้เลย กดบันทึกอีกครั้งเพื่อยืนยัน (ป๊อปอัปซ้อนบน Dialog กดไม่ได้)
 */
export function EditDocNumbersButton({ detail, onSaved }: { detail: AdvanceDetail; onSaved: (d: AdvanceDetail) => void }) {
  const fields = editableDocFields(detail.fin);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Partial<Record<DocNoField, string>>>({});
  const [remark, setRemark] = useState('');
  const [error, setError] = useState('');
  const [warning, setWarning] = useState<{ key: string; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  if (!fields.length) return null;

  const start = () => {
    setDraft(Object.fromEntries(fields.map(f => [f, detail.fin?.[f] ?? ''])));
    setRemark(''); setError(''); setWarning(null);
    setOpen(true);
  };

  const save = async () => {
    const changes = docNoChanges(detail.fin, draft);
    const err = docNoEditError(changes, remark);
    if (err) { setError(err); return; }
    setError('');
    const key = JSON.stringify(changes);
    if (warning?.key !== key) {
      const found = (await Promise.all((Object.keys(changes) as DocNoField[])
        .map(f => duplicateDocNoWarning(f, changes[f], detail.form_id)))).filter(Boolean);
      if (found.length) { setWarning({ key, text: found.join(' · ') }); return; }
    }
    setSaving(true);
    try {
      const saved = await putAction(detail.form_id, 'doc-numbers', { ...changes, remark: remark.trim() });
      setOpen(false);
      await showSuccess('แก้ไขเลขที่เอกสารแล้ว');
      onSaved(saved);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const pending = warning !== null && warning.key === JSON.stringify(docNoChanges(detail.fin, draft));

  return (
    <>
      <Button type="button" variant="outline" onClick={start}>
        <PencilLine className="mr-1 h-4 w-4" /> แก้ไขเลขที่เอกสาร
      </Button>
      <Dialog open={open} onOpenChange={v => { if (!saving) setOpen(v); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>แก้ไขเลขที่เอกสาร</DialogTitle>
            <DialogDescription>{detail.form_id} · แก้ได้เฉพาะเลขที่กรอกไว้แล้ว ประวัติจะเก็บเลขเดิมกับเหตุผลไว้</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {fields.map(f => (
              <label key={f} className="block space-y-1 text-sm">
                <span>{DOC_NO_LABELS[f]} <span className="text-xs text-gray-400">เดิม {detail.fin?.[f]}</span></span>
                <Input value={draft[f] ?? ''} disabled={saving} maxLength={f === 'clear_doc_no' ? CLEAR_DOC_NO_MAX : DOC_NO_MAX}
                  onChange={e => setDraft(d => ({ ...d, [f]: f === 'clear_doc_no' ? e.target.value.replace(/\s/g, '') : e.target.value }))} />
              </label>
            ))}
            <label className="block space-y-1 text-sm">
              <span>เหตุผลที่แก้ *</span>
              <Textarea value={remark} onChange={e => setRemark(e.target.value)} maxLength={1000} disabled={saving}
                placeholder="เช่น บัญชีพิมพ์เลขผิด" rows={2} />
            </label>
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
