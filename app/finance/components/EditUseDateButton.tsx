'use client';

import { useState } from 'react';
import { CalendarClock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { formatDate, todayBkk } from '@/lib/finance/status';
import { putAction, showSuccess } from '../api';
import type { AdvanceDetail } from '../types';
import { DateField } from './DateField';

/**
 * บัญชี (สิทธิ์ตั้งเบิก) แก้วันที่ใช้เงินได้เฉพาะตอนรอตั้งเบิก (ผู้ใช้สั่ง 12/11/2026)
 * วันใหม่ต้องเป็นวันนี้หรือหลังจากนี้ เหมือนตอนผู้เบิกยื่น · ใบไม่เปลี่ยนสถานะ ประวัติเก็บวันเดิมไว้
 */
export function EditUseDateButton({ detail, onSaved }: { detail: AdvanceDetail; onSaved: (d: AdvanceDetail) => void }) {
  const current = detail.request.use_date?.slice(0, 10) ?? '';
  const [open, setOpen] = useState(false);
  const [day, setDay] = useState('');
  const [remark, setRemark] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const today = todayBkk();

  const start = () => {
    setDay(current && current >= today ? current : '');
    setRemark(''); setError('');
    setOpen(true);
  };

  const save = async () => {
    if (!day) { setError('เลือกวันที่ใช้เงินก่อน'); return; }
    if (day < today) { setError('วันที่ใช้เงินต้องเป็นวันนี้หรือหลังจากนี้'); return; }
    if (day === current) { setError('ยังเป็นวันเดิมอยู่'); return; }
    setError('');
    setSaving(true);
    try {
      const saved = await putAction(detail.form_id, 'use-date', { use_date: day, ...(remark.trim() ? { remark: remark.trim() } : {}) });
      setOpen(false);
      await showSuccess('แก้วันที่ใช้เงินแล้ว');
      onSaved(saved);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Button type="button" variant="outline" onClick={start}>
        <CalendarClock className="mr-1 h-4 w-4" /> แก้วันที่ใช้เงิน
      </Button>
      <Dialog open={open} onOpenChange={v => { if (!saving) setOpen(v); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>แก้วันที่ใช้เงิน</DialogTitle>
            <DialogDescription>{detail.form_id} · วันเดิม {formatDate(current) || '-'} · เลือกได้ตั้งแต่วันนี้ไป</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1 text-sm">
              <span>วันที่ใช้เงินใหม่</span>
              <DateField value={day} onChange={setDay} min={today} disabled={saving} />
            </div>
            <label className="block space-y-1 text-sm">
              <span>เหตุผล <span className="text-xs text-gray-400">(ไม่บังคับ)</span></span>
              <Textarea value={remark} onChange={e => setRemark(e.target.value)} maxLength={1000} disabled={saving}
                placeholder="เช่น ผู้เบิกเลื่อนวันใช้เงิน" rows={2} />
            </label>
            {error && <p className="text-sm text-rose-600">{error}</p>}
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={saving}>ยกเลิก</Button>
            <Button type="button" onClick={save} disabled={saving}>{saving ? 'กำลังบันทึก...' : 'บันทึก'}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
