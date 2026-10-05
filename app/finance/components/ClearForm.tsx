'use client';

import { useEffect, useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { MAX_CLEAR_ITEMS, carryOverDefaults, invalidNumberErrors, rowTotals, savedAmount, sumItems, validateItems } from '@/lib/finance/clearItems';
import { formatDateThaiShort } from '@/lib/finance/dates';
import { computeSettle, formatBaht, parseAmount, settleLabel } from '@/lib/finance/status';
import { fetchJson, putAction, showAlert, showConfirm, uploadFiles } from '../api';
import { CLEAR_ATTACHMENT_REQUIRED } from '../labels';
import type { AdvanceDetail, AttachmentFile } from '../types';
import { ClearItemDialog, toRow, type DraftRow } from './ClearItemDialog';
import { DateField } from './DateField';
import { FilePicker } from './FilePicker';
import { Panel } from './FinanceShell';

let rowSeq = 0;
const nextId = () => ++rowSeq;
const newRow = (d: { expense_date: string; vehicle: string }): DraftRow => ({ id: nextId(), ...d, has_receipt: true, description: '', a: '', d: '' });
const numStr = (n: number) => (n === 0 ? '' : String(n));

export function ClearForm({ detail, onSaved }: { detail: AdvanceDetail; onSaved: (d: AdvanceDetail) => void }) {
  const fin = detail.fin!;
  const [clearDate, setClearDate] = useState(fin.clear_date ?? '');
  const [rows, setRows] = useState<DraftRow[]>(() =>
    fin.clear_items?.length
      ? fin.clear_items.map(i => ({
        id: nextId(),
        expense_date: i.expense_date, vehicle: i.vehicle ?? '', has_receipt: i.has_receipt, description: i.description,
        // old rows may carry VAT: ยอดเงิน = the saved total, re-sent as A = total, B = 0 (sums stay identical)
        a: numStr(savedAmount(i)), d: numStr(i.wht_amount),
      }))
      : []);
  const [settleDate, setSettleDate] = useState(fin.settle_date ?? '');
  const [remark, setRemark] = useState(fin.remark ?? '');
  const [files, setFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [existingClear, setExistingClear] = useState(0);
  useEffect(() => {
    fetchJson<{ files?: AttachmentFile[] } | AttachmentFile[]>(`/api/uploads3?form_id=${encodeURIComponent(detail.form_id)}`)
      .then(data => {
        const list = Array.isArray(data) ? data : data.files ?? [];
        setExistingClear(list.filter(f => f.folder === 'clear').length);
      })
      .catch(() => setExistingClear(0));
  }, [detail.form_id]);

  /** popup state: a NEW item (appended on save) or an existing one being edited */
  const [editor, setEditor] = useState<{ key: number; index: number; isNew: boolean; row: DraftRow } | null>(null);
  const openNew = (list: DraftRow[]) => setEditor({ key: nextId(), index: list.length, isNew: true, row: newRow(carryOverDefaults(list)) });
  const openEdit = (i: number) => setEditor({ key: nextId(), index: i, isNew: false, row: rows[i] });
  const saveItem = (row: DraftRow, addNext: boolean) => {
    const next = editor?.isNew ? [...rows, row] : rows.map(r => (r.id === row.id ? row : r));
    setRows(next);
    if (addNext && next.length < MAX_CLEAR_ITEMS) openNew(next);
    else setEditor(null);
  };

  const itemRows = rows.map(toRow);
  const totals = sumItems(itemRows);
  const actualNum = totals.e;
  const settle = computeSettle(fin.amount_paid ?? 0, actualNum);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clearDate) return showAlert({ icon: 'warning', title: 'กรุณาระบุวันที่ส่งเอกสารเคลียร์' });
    const itemErrors = [...invalidNumberErrors(rows, parseAmount), ...validateItems(itemRows)];
    if (itemErrors.length) return showAlert({ icon: 'warning', title: 'กรุณาตรวจรายการค่าใช้จ่าย', text: itemErrors.slice(0, 5).join('\n') });
    if (settle !== null && settle > 0 && !settleDate) {
      return showAlert({ icon: 'warning', title: 'มียอดต้องคืนบริษัท', text: 'กรุณาระบุวันที่โอนเงินคืนบริษัท' });
    }
    if (files.length === 0 && existingClear === 0) return showAlert({ icon: 'warning', title: CLEAR_ATTACHMENT_REQUIRED });
    const ok: any = await showConfirm({
      icon: 'question', title: 'ยืนยันส่งเคลียร์เงิน',
      text: `ยอดใช้จริง ${formatBaht(totals.e)} บาท (${rows.length} รายการ) — ส่งแล้วแก้ไขไม่ได้ จนกว่าบัญชีจะส่งกลับแก้ไข`,
      confirmButtonText: 'ส่งเคลียร์เงิน',
    });
    if (!ok?.isConfirmed) return;
    setSaving(true);
    try {
      const failed = await uploadFiles(detail.form_id, files, 'clear');
      if (failed.length) {
        await showAlert({ icon: 'error', title: 'อัปโหลดไฟล์ไม่สำเร็จ ยังไม่ได้ส่งเคลียร์', text: failed.join(', ') });
        return;
      }
      // Uploaded files now exist server-side: count them so a retry after a failed save does not re-upload duplicates.
      setExistingClear(n => n + files.length);
      setFiles([]);
      const saved = await putAction(detail.form_id, 'clear', {
        clear_date: clearDate,
        items: itemRows.map(r => ({
          expense_date: r.expense_date,
          vehicle: r.vehicle.trim() || null,
          has_receipt: r.has_receipt,
          description: r.description.trim(),
          amount_before_vat: r.amount_before_vat ?? 0,
          vat_amount: r.vat_amount ?? 0,
          wht_amount: r.wht_amount ?? 0,
        })),
        settle_date: settle !== null && settle > 0 ? settleDate : null,
        remark,
      });
      await showAlert({ icon: 'success', title: 'ส่งเคลียร์เงินแล้ว รอบัญชีตรวจ' });
      onSaved(saved);
    } catch (err) {
      showAlert({ icon: 'error', title: 'บันทึกไม่สำเร็จ', text: (err as Error).message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Panel title="เคลียร์เงิน (ผู้เบิกกรอก)">
      {editor && (
        <ClearItemDialog key={editor.key} initial={editor.row} index={editor.index} isNew={editor.isNew}
          canAddNext={rows.length + 1 < MAX_CLEAR_ITEMS} onSave={saveItem} onCancel={() => setEditor(null)} />
      )}
      <form onSubmit={submit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="space-y-1 text-sm">วันที่ส่งเอกสารเคลียร์ *
          <DateField value={clearDate} onChange={setClearDate} disabled={saving} />
        </label>
        <div className="space-y-1 text-sm">
          <p>ยอดใช้จริง (บาท) — รวมสุทธิจากรายการ</p>
          <p className="rounded-xl border bg-gray-50 px-4 py-2.5 font-semibold">{formatBaht(totals.e)}</p>
        </div>
        <div className="sm:col-span-2">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-sm">รายการค่าใช้จ่าย * <span className="text-xs text-gray-500">(1–{MAX_CLEAR_ITEMS} รายการ)</span></p>
            <Button type="button" variant="outline" size="sm" disabled={saving || rows.length >= MAX_CLEAR_ITEMS} onClick={() => openNew(rows)}>
              <Plus className="mr-1 h-4 w-4" /> เพิ่มรายการ
            </Button>
          </div>
          {rows.length === 0 ? (
            <div className="rounded-xl border-2 border-dashed px-4 py-8 text-center text-sm text-gray-500">ยังไม่มีรายการ — กด + เพิ่มรายการ ทีละใบเสร็จ</div>
          ) : (
            <ul className="divide-y rounded-xl border">
              {rows.map((r, i) => (
                <li key={r.id} className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50">
                  <button type="button" disabled={saving} onClick={() => openEdit(i)}
                    className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-0.5 text-left">
                    <span className="w-6 text-gray-500">{i + 1}</span>
                    <span className="whitespace-nowrap text-gray-600">{formatDateThaiShort(r.expense_date)}</span>
                    <span className="min-w-0 flex-1 truncate basis-40">{r.description}</span>
                    {r.vehicle && <span className="text-xs text-gray-500">{r.vehicle}</span>}
                    <span className={`rounded-md px-1.5 py-0.5 text-xs font-semibold ${r.has_receipt ? 'bg-brand-50 text-brand-700' : 'bg-gray-100 text-gray-500'}`}>{r.has_receipt ? 'Y' : 'N'}</span>
                    <span className="ml-auto w-full text-right font-semibold tabular-nums sm:w-28">{formatBaht(rowTotals(itemRows[i]).net)}</span>
                  </button>
                  <Button type="button" variant="ghost" size="icon" aria-label={`แก้ไขรายการที่ ${i + 1}`} disabled={saving} onClick={() => openEdit(i)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button type="button" variant="ghost" size="icon" aria-label={`ลบรายการที่ ${i + 1}`} disabled={saving}
                    onClick={() => setRows(rs => rs.filter(x => x.id !== r.id))}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-2 flex items-center justify-between text-sm">
            <span className="text-gray-600">รวม {rows.length} รายการ</span>
            <span className="font-semibold">ยอดใช้จริง <span className="tabular-nums text-brand-700">{formatBaht(totals.e)}</span> บาท</span>
          </div>
        </div>
        <div className="space-y-1 text-sm">
          <p>รับคืน (เบิกเพิ่ม) — คำนวณอัตโนมัติ</p>
          <p className={`rounded-xl border px-4 py-2.5 font-semibold ${settle !== null && settle < 0 ? 'text-orange-700' : 'text-brand-600'}`}>
            {settle === null ? '-' : `${settleLabel(settle)} ${formatBaht(Math.abs(settle))}`}
          </p>
        </div>
        {settle !== null && settle > 0 && (
          <label className="space-y-1 text-sm">วันที่โอนเงินคืนบริษัท *
            <DateField value={settleDate} onChange={setSettleDate} disabled={saving} />
          </label>
        )}
        {settle !== null && settle < 0 && (
          <p className="text-xs text-orange-700 sm:col-span-2">ใช้เกินยอดที่เบิก การเงินจะโอนส่วนต่างให้และบันทึกวันที่โอนตอนตรวจ</p>
        )}
        <label className="space-y-1 text-sm sm:col-span-2">หมายเหตุ
          <Textarea value={remark} onChange={e => setRemark(e.target.value)} disabled={saving} />
        </label>
        <div className="sm:col-span-2">
          <p className="mb-1 text-sm">แนบใบเสร็จ / สลิปคืนเงิน *</p>
          {existingClear > 0 && <p className="text-xs text-gray-500">มีไฟล์แนบแล้ว {existingClear} ไฟล์ (แนบเพิ่มได้)</p>}
          <FilePicker files={files} onChange={setFiles} disabled={saving} />
        </div>
        <div className="sm:col-span-2">
          <Button type="submit" disabled={saving} className="w-full h-11 rounded-xl bg-linear-to-r from-brand-600 to-brand-500 hover:from-brand-700 hover:to-brand-600 text-white font-semibold shadow-md hover:shadow-lg transition-all disabled:opacity-60">
            {saving ? 'กำลังบันทึก...' : 'ส่งเคลียร์เงิน'}
          </Button>
        </div>
      </form>
    </Panel>
  );
}
