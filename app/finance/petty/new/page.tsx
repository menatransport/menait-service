'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, IdCard, MapPin, Receipt, User } from 'lucide-react';
import { MascotLoader } from '@/components/loading';
import { useSessionContext } from '@/app/context/SessionContext';
import type { PettyExpenseType, PettyFund } from '@/app/finance/types-petty';
import { claimTotal, periodOf, type PettyItemDraft } from '@/lib/finance/petty-items';
import {
  blankHeader, blankItem, claimPayload, dupCheckParams, headerFields, isHolderAttachment, isItemBased, itemsFrom, missingAtCreate,
} from '@/lib/finance/petty-spec';
import { payeeBankProblem } from '@/lib/finance/petty-payee';
import { fundLabelWithHolder } from '@/lib/finance/petty-fund-label';
import { fundsForExpenseType } from '@/lib/finance/petty-account-code';
import { bangkokToday } from '@/lib/finance/petty-doc';
import {
  COST_CENTER_GROUPS, centerOfSite, costCenterGroupsForSite, defaultCostCenterForUser, fundForCostCenter, fundsInCenter,
} from '@/lib/finance/petty-cost-centers';
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
  // วงเงินเห็นเฉพาะสาขาของศูนย์และแผนกที่เลือก และเลือกวงเงินของแผนกนั้นให้ — "ดูทุกวงเงิน" ถ้าต้องใช้วงอื่น (ผู้ใช้สั่ง 29/10/2026)
  const [fundPicked, setFundPicked] = useState(false);
  const [showAllFunds, setShowAllFunds] = useState(false);
  // ศูนย์และแผนกของผู้เบิก — เลือกตามศูนย์+แผนกของผู้เบิกให้ก่อน ผู้เปิดใบเปลี่ยนเองได้ (ผู้ใช้สั่ง 29/10/2026)
  const [costCenter, setCostCenter] = useState('');
  const [costCenterPicked, setCostCenterPicked] = useState(false);
  // dropdown เห็นเฉพาะศูนย์ของผู้เบิก (เช่น Bangkok HQ → สกท) — กด "ดูทุกศูนย์" ถ้าต้องเบิกให้ศูนย์อื่น
  const [showAllCenters, setShowAllCenters] = useState(false);
  const myCenter = centerOfSite(user?.site);
  const ccGroups = useMemo(
    () => (showAllCenters ? COST_CENTER_GROUPS : costCenterGroupsForSite(user?.site)),
    [showAllCenters, user?.site],
  );
  const [header, setHeader] = useState<Record<string, unknown>>(() => ({ expense_date: bangkokToday() }));
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
  const total = itemBased ? claimTotal(rows) : claimTotal(itemsFrom(header));

  useEffect(() => {
    (async () => {
      try {
        const [t, f] = await Promise.all([getExpenseTypes(), getFunds()]);
        setTypes(t); setFunds(f);
        if (t.length === 1) setTypeCode(t[0].code);
      } catch (err) {
        setTypes([]); setFunds([]);
        showAlert({ icon: 'error', title: 'โหลดข้อมูลตั้งต้นไม่สำเร็จ', text: (err as Error).message });
      }
    })();
  }, []);

  // เปลี่ยนประเภท = เริ่มกรอกใหม่ เพราะช่องและหมวดไฟล์มาจาก spec ของประเภทนั้น — วันที่ขอเบิกกลับเป็นวันนี้เสมอ
  // ช่องที่ spec ตั้งค่าตั้งต้นไว้ (เช่น พจส./พจร. = พจส.) เติมให้ตั้งแต่แรก
  useEffect(() => {
    setHeader(blankHeader(types?.find(t => t.code === typeCode)?.spec, bangkokToday()));
    setRows([]); setFiles({}); setDups([]);
  }, [typeCode, types]);

  // ค่าตั้งต้นจากแผนกของผู้เบิก (map ที่ผู้ใช้อนุมัติ) — อยู่ในศูนย์ของผู้เบิกเสมอ จึงอยู่ในตัวเลือกที่เห็น
  useEffect(() => {
    if (costCenterPicked) return;
    setCostCenter(defaultCostCenterForUser(user));
  }, [user, costCenterPicked]);

  // วงเงินที่เลือกได้: สาขาของศูนย์และแผนก (หรือทั้งหมดถ้ากดดูทุกวงเงิน) และแผนกที่บัญชีให้เบิกประเภทนี้
  const shownFunds = useMemo(() => {
    const base = !funds ? [] : showAllFunds ? funds : fundsInCenter(funds, costCenter, user?.site);
    return fundsForExpenseType(typeCode, base);
  }, [funds, showAllFunds, costCenter, user?.site, typeCode]);
  const fundsFiltered = !showAllFunds && !!funds && fundsInCenter(funds, costCenter, user?.site).length < funds.length;

  // ที่เลือกเองแล้วและยังอยู่ในรายการ = คงไว้ · ไม่งั้นเลือกวงเงินของแผนกนั้น หรือวงเดียวที่มี · ไม่มี = ว่าง
  useEffect(() => {
    setFundId(id => {
      if (fundPicked && shownFunds.some(f => String(f.id) === id)) return id;
      return fundForCostCenter(shownFunds, costCenter) || (shownFunds.length === 1 ? String(shownFunds[0].id) : '');
    });
  }, [shownFunds, costCenter, fundPicked]);

  // เตือนซ้ำขณะกรอก — ด่านจริงอยู่ที่ BE ตอนอนุมัติ ตรงนี้ให้เห็นก่อนจะส่ง
  useEffect(() => {
    if (!typeCode || rows.length === 0) { setDups([]); return; }
    const timer = setTimeout(async () => {
      const hints: DupHint[] = [];
      for (const [index, row] of rows.entries()) {
        const params = dupCheckParams(typeCode, row, header.payee_name);
        if (!params) continue;
        try {
          const res = await checkDuplicate(params);
          res.hard.forEach(d => hints.push({ line_no: index + 1, level: 'hard',
            message: d.message ?? 'เบิกไปแล้ว', form_id: d.form_id }));
          res.soft.forEach(d => hints.push({ line_no: index + 1, level: 'soft',
            message: d.message ?? 'อาจซ้ำ', form_id: d.form_id }));
        } catch { /* ปล่อยผ่าน — BE เป็นผู้ตัดสินจริงตอนอนุมัติ */ }
      }
      setDups(hints);
    }, 600);
    return () => clearTimeout(timer);
  }, [rows, typeCode, header.payee_name]);

  const requiredMissing = (() => {
    if (!type || !fundId) return 'เลือกประเภทการเบิกและวงเงินสดย่อยก่อน';
    if (!costCenter) return 'ยังไม่เลือกศูนย์และแผนก';
    for (const f of headerFields(spec)) {
      if (f.auto) continue;
      const filled = f.type === 'truck'
        ? String(header.truck_code ?? '').trim() !== ''
        : String(header[f.key] ?? '').trim() !== '';
      if (f.required && !filled) return `ยังไม่กรอก ${f.label}`;
      if (f.key === 'payee_name') {
        const problem = payeeBankProblem(spec, header);
        if (problem) return problem;
      }
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
    // สลิปโอนเป็นของเจ้าของเงินสด แนบตอนอนุมัติจ่าย — ตอนเปิดใบไม่บังคับ
    const fileProblem = missingAtCreate(spec, attachedCounts);
    if (fileProblem) return fileProblem;
    const hard = dups.filter(d => d.level === 'hard');
    if (hard.length) return `แถวที่ ${hard[0].line_no} เบิกไปแล้ว — แก้หรือลบแถวนั้นก่อน`;
    return null;
  })();

  async function submit() {
    if (!type) return;
    setSaving(true);
    try {
      const items = itemBased ? rows : itemsFrom(header);
      const body = claimPayload({
        fund_id: Number(fundId),
        expense_type: type.code,
        expense_date: String(header.expense_date || bangkokToday()),
        payee_name: (header.payee_name as string) ?? null,
        driver_employee_id: (header.driver_employee_id as string) ?? null,
        driver_name: (header.driver as string) ?? null,
        receipt_no: (header.receipt_no as string) ?? null,
        dd_no: ddNo.trim() || null,
        cost_center: costCenter,
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
        <Panel title="ยังไม่มีวงเงินสดย่อยที่เปิดใบได้">
          <p className="text-sm text-ink-600">
            ยังไม่มีวงเงินสดย่อยในระบบ ให้ผู้ดูแลระบบตั้งวงเงิน (สาขา · แผนก · ผู้อนุมัติ) ที่หน้าตั้งค่าก่อน
          </p>
        </Panel>
      </FinanceCanvas>
    );
  }

  return (
    <FinanceCanvas title={TITLE}>
      <FinanceHeading icon={Receipt} title={TITLE} caption={CAPTION} />

      <Panel title="ใบเบิก">
        <div className="mb-3 rounded-xl bg-gray-50 p-3 sm:p-4">
          <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-gray-400">ผู้เบิกเงิน</p>
          <div className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
            <span className="flex min-w-0 items-center gap-2 font-medium text-gray-800">
              <User className="h-3.5 w-3.5 shrink-0 text-brand-600" />
              <span className="truncate">{user ? `${user.firstname} ${user.lastname}` : '-'}</span>
            </span>
            <span className="flex min-w-0 items-center gap-2 text-gray-600">
              <IdCard className="h-3.5 w-3.5 shrink-0 text-brand-600" />
              <span className="truncate">{user?.employee_id ?? '-'}</span>
            </span>
            <span className="flex min-w-0 items-center gap-2 text-gray-600">
              <Building2 className="h-3.5 w-3.5 shrink-0 text-brand-600" />
              <span className="truncate">{user?.department ?? '-'}</span>
            </span>
            <span className="flex min-w-0 items-center gap-2 text-gray-600">
              <MapPin className="h-3.5 w-3.5 shrink-0 text-brand-600" />
              <span className="truncate">{user?.site ?? '-'}</span>
            </span>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-sm">ประเภทการเบิก
            <select value={typeCode} onChange={e => setTypeCode(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5">
              <option value="">เลือกประเภท</option>
              {types.map(t => <option key={t.code} value={t.code}>{t.name_th}</option>)}
            </select>
          </label>
          <label className="text-sm">ศูนย์และแผนก
            <select value={costCenter} onChange={e => { setCostCenter(e.target.value); setCostCenterPicked(true); }}
              className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5">
              <option value="">เลือกศูนย์และแผนก</option>
              {ccGroups.map(g => (
                <optgroup key={g.center} label={g.center}>
                  {g.items.map(c => <option key={c.code} value={c.code}>{c.code} {c.name}</option>)}
                </optgroup>
              ))}
            </select>
            {myCenter && !showAllCenters && (
              <span className="mt-1 block text-xs text-ink-400">
                แสดงเฉพาะ {myCenter} ตามศูนย์ของคุณ ·{' '}
                <button type="button" onClick={() => setShowAllCenters(true)} className="text-brand-600 underline">ดูทุกศูนย์</button>
              </span>
            )}
          </label>
          <label className="text-sm">วงเงินสดย่อย
            <select value={fundId} onChange={e => { setFundId(e.target.value); setFundPicked(true); }}
              className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5">
              <option value="">เลือกวงเงินสดย่อย</option>
              {shownFunds.map(f => (
                <option key={f.id} value={f.id}>{fundLabelWithHolder(f)}</option>
              ))}
            </select>
            {typeCode && shownFunds.length === 0 && (
              <span className="mt-1 block text-xs text-amber-700">
                {fundsFiltered ? 'ศูนย์นี้ยังไม่มีวงเงินที่เบิกประเภทนี้ได้' : 'ประเภทนี้ยังไม่มีวงเงินของแผนกที่บัญชีให้เบิกได้'}
              </span>
            )}
            {fundsFiltered && (
              <span className="mt-1 block text-xs text-ink-400">
                แสดงเฉพาะวงเงินของศูนย์ที่เลือก ·{' '}
                <button type="button" onClick={() => setShowAllFunds(true)} className="text-brand-600 underline">ดูทุกวงเงิน</button>
              </span>
            )}
          </label>
          <label className="text-sm">วันที่ขอเบิก
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
                  {a.label}{a.required && !isHolderAttachment(a.key) && <span className="text-rose-500"> *</span>}
                  {a.max && <span className="ml-1 text-xs text-ink-400">ไม่เกิน {a.max} ไฟล์</span>}
                </p>
                <FilePicker files={files[a.key] ?? []}
                  onChange={list => setFiles({ ...files, [a.key]: a.max ? list.slice(0, a.max) : list })} />
                {isHolderAttachment(a.key) && (
                  <p className="mt-1 text-xs text-ink-400">เจ้าของเงินสดแนบตอนอนุมัติจ่าย ถ้ามีสลิปแล้วแนบมาได้เลย</p>
                )}
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
