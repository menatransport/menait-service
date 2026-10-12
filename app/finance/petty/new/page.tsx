'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Receipt } from 'lucide-react';
import { MascotLoader } from '@/components/loading';
import { useSessionContext } from '@/app/context/SessionContext';
import type { PettyExpenseType, PettyFund } from '@/app/finance/types-petty';
import { claimTotal, periodOf, type PettyItemDraft } from '@/lib/finance/petty-items';
import { blankItem, claimPayload, headerFields, isItemBased, singleItemFrom } from '@/lib/finance/petty-spec';
import { showAlert } from '../../api';
import { checkDuplicate, createClaim, getExpenseTypes, getFunds, uploadPettyFiles } from '../../petty-api';
import { FinanceCanvas, FinanceHeading, Panel } from '../../components/FinanceShell';
import { FilePicker } from '../../components/FilePicker';
import { AddManyTrucksDialog } from '../../components/petty/AddManyTrucksDialog';
import { DocumentPreset } from '../../components/petty/DocumentPreset';
import { HeaderField } from '../../components/petty/HeaderField';
import { ItemGrid, type DupHint } from '../../components/petty/ItemGrid';

type Row = PettyItemDraft & Record<string, unknown>;

const TITLE = 'เปิดใบเบิกเงินสดย่อย';
const CAPTION = 'เลือกประเภทการเบิก แล้วกรอกรายการให้ครบ — เอกสารต้องครบก่อนผู้อนุมัติจะกดอนุมัติได้';

export default function NewPettyClaimPage() {
  const { user, loading } = useSessionContext();
  const router = useRouter();

  const [types, setTypes] = useState<PettyExpenseType[] | null>(null);
  const [funds, setFunds] = useState<PettyFund[] | null>(null);
  const [typeCode, setTypeCode] = useState('');
  const [fundId, setFundId] = useState('');
  const [header, setHeader] = useState<Record<string, unknown>>({});
  const [rows, setRows] = useState<Row[]>([]);
  const [files, setFiles] = useState<Record<string, File[]>>({});
  const [ddNo, setDdNo] = useState('');
  const [addMany, setAddMany] = useState(false);
  const [dups, setDups] = useState<DupHint[]>([]);
  const [saving, setSaving] = useState(false);

  const type = useMemo(() => types?.find(t => t.code === typeCode) ?? null, [types, typeCode]);
  const spec = type?.spec ?? {};
  const itemBased = isItemBased(spec);
  const period = periodOf(rows);
  const attachedCounts = Object.fromEntries(
    Object.entries(files).map(([key, list]) => [key, list.length]),
  );
  const total = itemBased ? claimTotal(rows) : claimTotal([singleItemFrom(header)]);

  useEffect(() => {
    (async () => {
      try {
        const [t, f] = await Promise.all([getExpenseTypes(), getFunds()]);
        setTypes(t); setFunds(f);
        if (t.length === 1) setTypeCode(t[0].code);
        if (f.length === 1) setFundId(String(f[0].id));
      } catch (err) {
        setTypes([]); setFunds([]);
        showAlert({ icon: 'error', title: 'โหลดข้อมูลตั้งต้นไม่สำเร็จ', text: (err as Error).message });
      }
    })();
  }, []);

  // เปลี่ยนประเภท = เริ่มกรอกใหม่ เพราะช่องและหมวดไฟล์มาจาก spec ของประเภทนั้น
  useEffect(() => { setHeader({}); setRows([]); setFiles({}); setDups([]); }, [typeCode]);

  // เตือนซ้ำขณะกรอก — ด่านจริงอยู่ที่ BE ตอนอนุมัติ ตรงนี้ให้เห็นก่อนจะส่ง
  useEffect(() => {
    if (!typeCode || rows.length === 0) { setDups([]); return; }
    const timer = setTimeout(async () => {
      const hints: DupHint[] = [];
      for (const [index, row] of rows.entries()) {
        const date = String(row.event_date ?? '');
        const code = String(row.truck_code ?? '');
        if (!date || !code) continue;
        try {
          const res = await checkDuplicate({
            expense_type: typeCode, event_date: date,
            truck_code: code, truck_plate: String(row.truck_plate ?? ''),
            ref_no: String(row.ref_no ?? ''),
          });
          res.hard.forEach(d => hints.push({ line_no: index + 1, level: 'hard',
            message: d.message ?? 'เบิกไปแล้ว', form_id: d.form_id }));
          res.soft.forEach(d => hints.push({ line_no: index + 1, level: 'soft',
            message: d.message ?? 'อาจซ้ำ', form_id: d.form_id }));
        } catch { /* ปล่อยผ่าน — BE เป็นผู้ตัดสินจริงตอนอนุมัติ */ }
      }
      setDups(hints);
    }, 600);
    return () => clearTimeout(timer);
  }, [rows, typeCode]);

  const requiredMissing = (() => {
    if (!type || !fundId) return 'เลือกประเภทการเบิกและกองทุนก่อน';
    for (const f of headerFields(spec)) {
      if (f.auto) continue;
      const filled = f.type === 'truck'
        ? String(header.truck_code ?? '').trim() !== ''
        : String(header[f.key] ?? '').trim() !== '';
      if (f.required && !filled) return `ยังไม่กรอก ${f.label}`;
    }
    if (itemBased) {
      if (rows.length === 0) return 'ยังไม่มีรายการ';
      for (const [i, row] of rows.entries()) {
        for (const f of (spec.item_fields ?? [])) {
          if (f.key === 'truck') {
            if (f.required && !String(row.truck_code ?? '').trim()) return `แถวที่ ${i + 1} ยังไม่ระบุรถ`;
            continue;
          }
          if (f.required && String(row[f.key] ?? '').trim() === '') {
            return `แถวที่ ${i + 1} ยังไม่กรอก ${f.label}`;
          }
        }
      }
    } else if (!String(header.rate ?? '').trim()) {
      return 'ยังไม่กรอกจำนวนเงิน';
    }
    for (const a of (spec.attachments ?? [])) {
      if (a.required && (files[a.key]?.length ?? 0) === 0) return `ยังไม่แนบ ${a.label}`;
    }
    const hard = dups.filter(d => d.level === 'hard');
    if (hard.length) return `แถวที่ ${hard[0].line_no} เบิกไปแล้ว — แก้หรือลบแถวนั้นก่อน`;
    return null;
  })();

  async function submit() {
    if (!type) return;
    setSaving(true);
    try {
      const items = itemBased ? rows : [singleItemFrom(header)];
      const body = claimPayload({
        fund_id: Number(fundId),
        expense_type: type.code,
        expense_date: String(header.expense_date ?? new Date().toISOString().slice(0, 10)),
        payee_name: (header.payee_name as string) ?? null,
        driver_employee_id: (header.driver_employee_id as string) ?? null,
        driver_name: (header.driver as string) ?? null,
        receipt_no: (header.receipt_no as string) ?? null,
        dd_no: ddNo.trim() || null,
        detail: header,
      }, items);

      const claim = await createClaim(body);

      const failed: string[] = [];
      for (const [folder, list] of Object.entries(files)) {
        if (list.length) failed.push(...await uploadPettyFiles(claim.form_id, folder, list));
      }
      if (failed.length) {
        showAlert({ icon: 'warning', title: 'เปิดใบแล้ว แต่มีไฟล์ขึ้นไม่ครบ',
          text: `ไฟล์ที่ไม่ขึ้น: ${failed.join(', ')} — เปิดใบแล้วแนบเพิ่มได้` });
      } else {
        showAlert({ icon: 'success', title: `เปิดใบ ${claim.form_id} แล้ว`, timer: 1600, showConfirmButton: false });
      }
      router.push('/finance/petty');
    } catch (err) {
      showAlert({ icon: 'error', title: 'เปิดใบไม่สำเร็จ', text: (err as Error).message });
    } finally { setSaving(false); }
  }

  if (loading || types === null || funds === null) return <MascotLoader />;

  if (funds.length === 0) {
    return (
      <FinanceCanvas title={TITLE}>
        <FinanceHeading icon={Receipt} title={TITLE} caption={CAPTION} />
        <Panel title="ยังไม่มีกองทุนที่เปิดใบได้">
          <p className="text-sm text-ink-600">
            ยังไม่มีกองทุนเงินสดย่อยในระบบ ให้ผู้ดูแลระบบตั้งกองทุน (สาขา · แผนก · ผู้อนุมัติ) ที่หน้าตั้งค่าก่อน
          </p>
        </Panel>
      </FinanceCanvas>
    );
  }

  return (
    <FinanceCanvas title={TITLE}>
      <FinanceHeading icon={Receipt} title={TITLE} caption={CAPTION} />

      <Panel title="ใบเบิก">
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="text-sm">ประเภทการเบิก
            <select value={typeCode} onChange={e => setTypeCode(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5">
              <option value="">เลือกประเภท</option>
              {types.map(t => <option key={t.code} value={t.code}>{t.name_th}</option>)}
            </select>
          </label>
          <label className="text-sm">กองทุน
            <select value={fundId} onChange={e => setFundId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5">
              <option value="">เลือกกองทุน</option>
              {funds.map(f => (
                <option key={f.id} value={f.id}>
                  สาขา {f.branch_code} · {f.division_code}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">วันที่บนใบ
            <input type="date" value={String(header.expense_date ?? '')}
              onChange={e => setHeader({ ...header, expense_date: e.target.value })}
              className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5" />
          </label>
        </div>

        {type && headerFields(spec).filter(f => !f.auto).length > 0 && (
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            {headerFields(spec).filter(f => !f.auto).map(f => (
              <HeaderField key={f.key} field={f} value={header[f.key]} form={header}
                onChange={patch => setHeader({ ...header, ...patch })} />
            ))}
          </div>
        )}

        {type && itemBased && (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="text-sm text-ink-500">
              ช่วงวันที่ของค่าใช้จ่าย: {period.from ?? '—'} ถึง {period.to ?? '—'}
              <span className="ml-1 text-xs">(เติมเองจากรายการ)</span>
            </div>
          </div>
        )}
      </Panel>

      {type && (
        <div className="mb-4">
          <DocumentPreset spec={spec} counts={attachedCounts} typeName={type.name_th} />
        </div>
      )}

      {type && itemBased && (
        <Panel title={spec.item_label ?? 'รายการ'}>
          <ItemGrid spec={spec} rows={rows} onChange={setRows} onAddMany={() => setAddMany(true)}
            dups={dups} />
        </Panel>
      )}

      {type && (spec.attachments ?? []).length > 0 && (
        <Panel title="หลักฐาน">
          <div className="grid gap-4 sm:grid-cols-2">
            {(spec.attachments ?? []).map(a => (
              <div key={a.key}>
                <p className="mb-1 text-sm">
                  {a.label}{a.required && <span className="text-rose-500"> *</span>}
                  {a.max && <span className="ml-1 text-xs text-ink-400">ไม่เกิน {a.max} ไฟล์</span>}
                </p>
                <FilePicker files={files[a.key] ?? []}
                  onChange={list => setFiles({ ...files, [a.key]: a.max ? list.slice(0, a.max) : list })} />
                {a.note && <p className="mt-1 text-xs text-ink-400">{a.note}</p>}
              </div>
            ))}
          </div>
        </Panel>
      )}

      {type && (
        <Panel title="ส่งใบ">
          <div className="grid gap-3 sm:grid-cols-3 items-end">
            <label className="text-sm">เลขที่ใบรับสินค้า (DD)
              <input value={ddNo} onChange={e => setDdNo(e.target.value)} placeholder="กรอกทีหลังได้"
                className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5" />
              <span className="mt-1 block text-xs text-ink-400">
                ยอดตั้งแต่ 500 บาท ต้องมีเลข DD ก่อนส่งบัญชี แต่ไม่บล็อกการอนุมัติ
              </span>
            </label>
            <div className="text-sm">
              <span className="text-ink-500">ยอดรวม</span>
              <div className="text-2xl font-medium tabular-nums">
                {total.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
              </div>
            </div>
            <div className="text-right">
              {requiredMissing && <p className="mb-1 text-xs text-amber-700">{requiredMissing}</p>}
              <button type="button" disabled={saving || !!requiredMissing} onClick={() => void submit()}
                className="rounded-lg bg-brand-600 px-4 py-2 text-white disabled:opacity-40">
                {saving ? 'กำลังส่ง…' : 'ส่งให้ผู้อนุมัติ'}
              </button>
            </div>
          </div>
        </Panel>
      )}

      {addMany && type && (
        <AddManyTrucksDialog spec={spec} onClose={() => setAddMany(false)}
          onAdd={extra => setRows([...rows, ...extra])} />
      )}
    </FinanceCanvas>
  );
}
