'use client';

import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { MAX_CLEAR_ITEMS, invalidNumberErrors, rowTotals, sumItems, validateItems, vat7, type ClearItemRow } from '@/lib/finance/clearItems';
import { computeSettle, formatBaht, parseAmount, settleLabel } from '@/lib/finance/status';
import { fetchJson, putAction, showAlert, uploadFiles } from '../api';
import { CLEAR_ATTACHMENT_REQUIRED } from '../labels';
import type { AdvanceDetail, AttachmentFile } from '../types';
import { DateField } from './DateField';
import { FilePicker } from './FilePicker';
import { Panel } from './FinanceShell';

interface DraftRow {
  id: number;
  expense_date: string;
  vehicle: string;
  has_receipt: boolean;
  description: string;
  a: string;
  b: string;
  d: string;
  /** B edited by hand: stop auto-filling 7% (UI state only, never sent) */
  bTouched: boolean;
}

let rowSeq = 0;
const nextId = () => ++rowSeq;
const emptyRow = (): DraftRow => ({ id: nextId(), expense_date: '', vehicle: '', has_receipt: true, description: '', a: '', b: '', d: '', bTouched: false });
const numStr = (n: number) => (n === 0 ? '' : String(n));

function toRow(r: DraftRow): ClearItemRow {
  return {
    expense_date: r.expense_date, vehicle: r.vehicle, has_receipt: r.has_receipt, description: r.description,
    amount_before_vat: parseAmount(r.a), vat_amount: parseAmount(r.b), wht_amount: parseAmount(r.d),
  };
}

export function ClearForm({ detail, onSaved }: { detail: AdvanceDetail; onSaved: (d: AdvanceDetail) => void }) {
  const fin = detail.fin!;
  const [clearDate, setClearDate] = useState(fin.clear_date ?? '');
  const [rows, setRows] = useState<DraftRow[]>(() =>
    fin.clear_items?.length
      ? fin.clear_items.map(i => ({
        id: nextId(),
        expense_date: i.expense_date, vehicle: i.vehicle ?? '', has_receipt: i.has_receipt, description: i.description,
        a: numStr(i.amount_before_vat), b: numStr(i.vat_amount), d: numStr(i.wht_amount),
        // saved B may be hand-edited: keep it as-is unless it already equals the 7% value
        bTouched: i.vat_amount !== vat7(i.amount_before_vat),
      }))
      : [emptyRow()]);
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

  const patchRow = (i: number, patch: Partial<DraftRow>) => setRows(rs => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const setA = (i: number, a: string) => setRows(rs => rs.map((r, idx) => {
    if (idx !== i) return r;
    if (r.bTouched) return { ...r, a };
    const n = parseAmount(a);
    return { ...r, a, b: n === null ? '' : String(vat7(n)) };
  }));
  const resetVat = (i: number) => setRows(rs => rs.map((r, idx) => {
    if (idx !== i) return r;
    const n = parseAmount(r.a);
    return { ...r, b: n === null ? '' : String(vat7(n)), bTouched: false };
  }));

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
      <form onSubmit={submit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="space-y-1 text-sm">วันที่ส่งเอกสารเคลียร์ *
          <DateField value={clearDate} onChange={setClearDate} disabled={saving} />
        </label>
        <div className="space-y-1 text-sm">
          <p>ยอดใช้จริง (บาท) — รวมสุทธิจากรายการ</p>
          <p className="rounded-xl border bg-gray-50 px-4 py-2.5 font-semibold">{formatBaht(totals.e)}</p>
        </div>
        <div className="sm:col-span-2">
          <p className="mb-1 text-sm">รายการค่าใช้จ่าย * <span className="text-xs text-gray-500">(1–{MAX_CLEAR_ITEMS} รายการ)</span></p>
          <div className="overflow-x-auto rounded-xl border">
            <table className="w-full min-w-[1100px] text-sm">
              <thead className="bg-gray-50 text-xs text-gray-600">
                <tr>
                  <th className="px-2 py-2 text-left">#</th>
                  <th className="px-2 py-2 text-left">วันที่</th>
                  <th className="px-2 py-2 text-left">ทะเบียนรถและประเภท</th>
                  <th className="px-2 py-2 text-center">ใบกำกับ Y/N</th>
                  <th className="px-2 py-2 text-left">รายละเอียด</th>
                  <th className="px-2 py-2 text-right">ยอดก่อน VAT (A)</th>
                  <th className="px-2 py-2 text-right">VAT 7% (B)</th>
                  <th className="px-2 py-2 text-right">รวม (C)</th>
                  <th className="px-2 py-2 text-right">หัก ณ ที่จ่าย (D)</th>
                  <th className="px-2 py-2 text-right">สุทธิ (E)</th>
                  <th className="px-2 py-2" />
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const t = rowTotals(itemRows[i]);
                  return (
                    <tr key={r.id} className="border-t align-top">
                      <td className="px-2 py-2 text-gray-500">{i + 1}</td>
                      <td className="w-40 px-2 py-2"><DateField value={r.expense_date} onChange={v => patchRow(i, { expense_date: v })} disabled={saving} /></td>
                      <td className="w-40 px-2 py-2"><Input maxLength={50} value={r.vehicle} onChange={e => patchRow(i, { vehicle: e.target.value })} disabled={saving} /></td>
                      <td className="px-2 py-2 text-center">
                        <button type="button" disabled={saving} onClick={() => patchRow(i, { has_receipt: !r.has_receipt })}
                          className={`h-9 w-10 rounded-lg border text-sm font-semibold ${r.has_receipt ? 'border-brand-600 bg-brand-600 text-white' : 'bg-white text-gray-500'}`}>
                          {r.has_receipt ? 'Y' : 'N'}
                        </button>
                      </td>
                      <td className="min-w-52 px-2 py-2"><Input maxLength={255} value={r.description} onChange={e => patchRow(i, { description: e.target.value })} disabled={saving} /></td>
                      <td className="w-32 px-2 py-2"><Input className="text-right" inputMode="decimal" placeholder="0.00" value={r.a} onChange={e => setA(i, e.target.value)} disabled={saving} /></td>
                      <td className="w-32 px-2 py-2">
                        <Input className="text-right" inputMode="decimal" placeholder="0.00" value={r.b} onChange={e => patchRow(i, { b: e.target.value, bTouched: true })} disabled={saving} />
                        {r.bTouched && (
                          <button type="button" disabled={saving} onClick={() => resetVat(i)} className="mt-1 text-xs text-brand-600 underline">คำนวณ 7%</button>
                        )}
                      </td>
                      <td className="w-28 px-2 py-2 text-right tabular-nums leading-9">{formatBaht(t.total)}</td>
                      <td className="w-32 px-2 py-2"><Input className="text-right" inputMode="decimal" placeholder="0.00" value={r.d} onChange={e => patchRow(i, { d: e.target.value })} disabled={saving} /></td>
                      <td className="w-28 px-2 py-2 text-right font-semibold tabular-nums leading-9">{formatBaht(t.net)}</td>
                      <td className="px-2 py-2">
                        <Button type="button" variant="ghost" size="icon" aria-label={`ลบรายการที่ ${i + 1}`}
                          disabled={saving || rows.length <= 1} onClick={() => setRows(rs => rs.filter((_, idx) => idx !== i))}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="border-t bg-gray-50 font-semibold">
                <tr>
                  <td colSpan={5} className="px-2 py-2 text-right">รวม</td>
                  <td className="px-2 py-2 text-right tabular-nums">{formatBaht(totals.a)}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{formatBaht(totals.b)}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{formatBaht(totals.c)}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{formatBaht(totals.d)}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{formatBaht(totals.e)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
          <Button type="button" variant="outline" size="sm" className="mt-2" disabled={saving || rows.length >= MAX_CLEAR_ITEMS}
            onClick={() => setRows(rs => [...rs, emptyRow()])}>
            <Plus className="mr-1 h-4 w-4" /> เพิ่มรายการ
          </Button>
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
