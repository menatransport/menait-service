'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MascotLoader } from '@/components/loading';
import { useSessionContext } from '@/app/context/SessionContext';
import type { PettyExpenseType, PettyFund } from '@/app/finance/types-petty';
import { claimTotal, periodOf, type PettyItemDraft } from '@/lib/finance/petty-items';
import {
  blankHeader, claimPayload, dupCheckParams, headerFields, isHolderAttachment, isItemBased, itemsFrom, missingAtCreate,
} from '@/lib/finance/petty-spec';
import { payeeBankProblem, payeeBankText } from '@/lib/finance/petty-payee';
import { fundLabelWithHolder } from '@/lib/finance/petty-fund-label';
import { fundsForExpenseType } from '@/lib/finance/petty-account-code';
import { bangkokToday } from '@/lib/finance/petty-doc';
import {
  COST_CENTER_GROUPS, centerOfSite, costCenterGroupsForSite, defaultCostCenterForUser, fundForCostCenter, fundsInCenter,
} from '@/lib/finance/petty-cost-centers';
import { requiredDocs } from '@/lib/finance/petty-preset';
import { formatDate } from '@/lib/finance/status';
import { showAlert, showSuccess } from '../../api';
import { checkDuplicate, createClaim, getExpenseTypes, getFunds, uploadPettyFiles } from '../../petty-api';
import { AddManyTrucksDialog } from '../../components/petty/AddManyTrucksDialog';
import { ExpenseTypeCombobox } from '../../components/petty/ExpenseTypeCombobox';
import { HeaderField } from '../../components/petty/HeaderField';
import { ItemGrid, type DupHint } from '../../components/petty/ItemGrid';
import { PettyFileDrop } from '../../components/petty/PettyFileDrop';
import { PettyTypeNote } from '../../components/petty/PettyTypeNote';
import { pettyReview } from '../../components/petty/petty-confirm';
import { Button, EmptyState, FIELD, HeaderMeta, LABEL, PettyPage, Req, Section, StickyBar, baht2 } from '../../components/petty/ui';

type Row = PettyItemDraft & Record<string, unknown>;

const TITLE = 'เปิดใบเบิกเงินสดย่อย';

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

  // ทบทวนก่อนส่ง (ปุ่ม action ทุกปุ่มต้องมีป๊อปอัปยืนยัน — Bew 30/10/2026)
  async function confirmSubmit() {
    if (!type || requiredMissing) return;
    const fund = funds?.find(f => String(f.id) === fundId);
    const payee = String(header.payee_name ?? '').trim();
    const bank = payeeBankText(header);
    const fileCount = Object.values(files).reduce((s, list) => s + list.length, 0);
    const soft = dups.filter(d => d.level === 'soft');
    const ok = await pettyReview({
      title: 'ส่งใบเบิกให้ผู้อนุมัติ',
      rows: [
        ['ประเภท', type.name_th],
        ['ศูนย์และแผนก', costCenter],
        ['วงเงินสดย่อย', fund ? fundLabelWithHolder(fund) : '-'],
        ['วันที่ขอเบิก', formatDate(String(header.expense_date ?? '')) || String(header.expense_date ?? '')],
        ...(payee ? [['จ่ายให้', bank ? `${payee}\n${bank}` : payee] as [string, string]] : []),
        ...(itemBased ? [['รายการ', `${rows.length} รายการ`] as [string, string]] : []),
        ['ยอดรวม', `${baht2(total)} บาท`],
        ['ไฟล์แนบ', `${fileCount} ไฟล์`],
        ['เลข DD', ddNo.trim() || 'กรอกทีหลัง'],
      ],
      warning: soft.length ? `มี ${soft.length} แถวที่อาจซ้ำ — ผู้อนุมัติจะเห็นคำเตือนนี้` : null,
      confirmButtonText: 'ส่งให้ผู้อนุมัติ',
      cancelButtonText: 'กลับไปแก้ไข',
    });
    if (ok) await submit();
  }

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
        showSuccess(`เปิดใบ ${claim.form_id} แล้ว`);
      }
      router.push('/finance/petty');
    } catch (err) {
      showAlert({ icon: 'error', title: 'เปิดใบไม่สำเร็จ', text: (err as Error).message });
    } finally { setSaving(false); }
  }

  const requester = (
    <HeaderMeta primary={user ? `${user.firstname} ${user.lastname}` : '-'}
      secondary={[user?.employee_id, user?.department_th || user?.department, user?.site].filter(Boolean).join(' · ')} />
  );

  // โหลดอยู่ในโครงหน้าเดียวกับหน้าจริง — หัวเรื่อง/Navbar/ผู้เบิกไม่กระพริบหรือขยับตอนข้อมูลตั้งต้นมาถึง
  if (loading || types === null || funds === null) {
    return (
      <PettyPage title={TITLE} aside={user ? requester : undefined}>
        <Section band index={1} label="ข้อมูลการเบิก">
          <div className="py-10"><MascotLoader text="กำลังเตรียมแบบฟอร์ม" size={80} /></div>
        </Section>
      </PettyPage>
    );
  }

  if (funds.length === 0) {
    return (
      <PettyPage title={TITLE} aside={requester}>
        <EmptyState title="ยังไม่มีวงเงินสดย่อยที่เปิดใบได้" text="ให้ผู้ดูแลระบบตั้งวงเงิน (สาขา · แผนก · ผู้อนุมัติ) ที่หน้าตั้งค่าก่อน" />
      </PettyPage>
    );
  }

  const visibleHeader = headerFields(spec).filter(f => !f.auto);
  const needsDd = total >= 500 && !ddNo.trim();
  const hasFiles = (spec.attachments ?? []).length > 0;
  // หมวดที่บังคับเฉพาะบางกรณี (เช่น สำเนาบัตรเมื่อโอนเข้าบุคคล) — บอกเงื่อนไขบนช่องแนบเลย
  const conditionOf = Object.fromEntries(requiredDocs(spec).filter(d => d.condition).map(d => [d.key, d.condition!]));
  const fileIndex = type && itemBased ? 3 : 2;

  const footer = type ? (
    <StickyBar>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-x-4 gap-y-2.5 sm:flex sm:items-center sm:justify-between sm:gap-6">
        <label className="flex min-w-0 flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
          <span className="shrink-0 text-xs font-medium text-ink-500">เลขที่ใบรับสินค้า (DD)</span>
          <input value={ddNo} onChange={e => setDdNo(e.target.value)} placeholder="กรอกทีหลังได้"
            className={`${FIELD} py-2 sm:w-44`} />
        </label>
        <div className="text-right sm:ml-auto">
          <p className="text-xs text-ink-500">ยอดรวม</p>
          <p className="font-display text-xl font-semibold leading-tight tabular-nums text-ink-900 sm:text-2xl">{baht2(total)}</p>
        </div>
        <div className="col-span-2 flex flex-col gap-1.5 sm:items-end">
          {requiredMissing
            ? <p className="text-xs text-ink-500" aria-live="polite">{requiredMissing}</p>
            : needsDd && <p className="text-xs text-ink-500">ยอดตั้งแต่ 500 ใส่ DD ก่อนส่งบัญชี</p>}
          <Button tone="primary" size="lg" disabled={saving || !!requiredMissing} onClick={() => void confirmSubmit()}
            className="w-full sm:w-auto">
            {saving ? 'กำลังส่ง…' : 'ส่งให้ผู้อนุมัติ'}
          </Button>
        </div>
      </div>
    </StickyBar>
  ) : undefined;

  return (
    <PettyPage title={TITLE} aside={requester} footer={footer}>
      <Section band index={1} label="ข้อมูลการเบิก">
        <div className="max-w-xl">
          <label htmlFor="petty-type" className={LABEL}>ประเภทการเบิก<Req /></label>
          <ExpenseTypeCombobox id="petty-type" types={types} value={typeCode} onChange={setTypeCode} />
        </div>
        {type && <div className="mt-4"><PettyTypeNote spec={spec} typeName={type.name_th} /></div>}

        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          <label className="block">
            <span className={LABEL}>ศูนย์และแผนก<Req /></span>
            <select value={costCenter} onChange={e => { setCostCenter(e.target.value); setCostCenterPicked(true); }} className={FIELD}>
              <option value="">เลือกศูนย์และแผนก</option>
              {ccGroups.map(g => (
                <optgroup key={g.center} label={g.center}>
                  {g.items.map(c => <option key={c.code} value={c.code}>{c.code} {c.name}</option>)}
                </optgroup>
              ))}
            </select>
            {myCenter && !showAllCenters && (
              <span className="mt-1 block text-xs text-ink-500">
                แสดงเฉพาะ {myCenter} ตามศูนย์ของคุณ ·{' '}
                <button type="button" onClick={() => setShowAllCenters(true)} className="font-medium text-ink-700 underline underline-offset-2 hover:text-ink-900">ดูทุกศูนย์</button>
              </span>
            )}
          </label>
          <label className="block">
            <span className={LABEL}>วงเงินสดย่อย<Req /></span>
            <select value={fundId} onChange={e => { setFundId(e.target.value); setFundPicked(true); }} className={FIELD}>
              <option value="">เลือกวงเงินสดย่อย</option>
              {shownFunds.map(f => (
                <option key={f.id} value={f.id}>{fundLabelWithHolder(f)}</option>
              ))}
            </select>
            {typeCode && shownFunds.length === 0 && (
              <span className="mt-1 block text-xs text-ink-500">
                {fundsFiltered ? 'ศูนย์นี้ยังไม่มีวงเงินที่เบิกประเภทนี้ได้' : 'ประเภทนี้ยังไม่มีวงเงินของแผนกที่บัญชีให้เบิกได้'}
              </span>
            )}
            {fundsFiltered && (
              <span className="mt-1 block text-xs text-ink-500">
                แสดงเฉพาะวงเงินของศูนย์ที่เลือก ·{' '}
                <button type="button" onClick={() => setShowAllFunds(true)} className="font-medium text-ink-700 underline underline-offset-2 hover:text-ink-900">ดูทุกวงเงิน</button>
              </span>
            )}
          </label>
          <label className="block">
            <span className={LABEL}>วันที่ขอเบิก<Req /></span>
            <input type="date" value={String(header.expense_date ?? '')}
              onChange={e => setHeader({ ...header, expense_date: e.target.value })}
              className={FIELD} />
          </label>
        </div>

        {type && visibleHeader.length > 0 && (
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            {visibleHeader.map(f => (
              <HeaderField key={f.key} field={f} value={header[f.key]} form={header}
                onChange={patch => setHeader({ ...header, ...patch })} />
            ))}
          </div>
        )}
      </Section>

      {type && itemBased && (
        <Section band index={2} label={spec.item_label ?? 'รายการ'}
          actions={period.from ? <span className="text-xs text-ink-500">ช่วงวันที่ {formatDate(period.from)} – {formatDate(period.to ?? period.from)}</span> : undefined}>
          <ItemGrid spec={spec} rows={rows} onChange={setRows} onAddMany={() => setAddMany(true)}
            dups={dups} />
        </Section>
      )}

      {type && hasFiles && (
        <Section band index={fileIndex} label="หลักฐานประกอบการเบิก">
          <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
            {(spec.attachments ?? []).map(a => (
              <PettyFileDrop key={a.key} label={a.label} required={a.required && !isHolderAttachment(a.key)} max={a.max}
                note={isHolderAttachment(a.key) ? 'เจ้าของเงินสดแนบตอนอนุมัติจ่าย ถ้ามีสลิปแล้วแนบมาได้เลย' : a.note || conditionOf[a.key]}
                tag={conditionOf[a.key] && !files[a.key]?.length ? 'มีเงื่อนไข' : undefined}
                files={files[a.key] ?? []}
                onChange={list => setFiles({ ...files, [a.key]: a.max ? list.slice(0, a.max) : list })} />
            ))}
          </div>
        </Section>
      )}

      {!type && (
        <p className="mt-2 text-sm text-ink-500">เลือกประเภทการเบิกก่อน แล้วช่องที่ต้องกรอกจะขึ้นตามประเภท</p>
      )}

      {addMany && type && (
        <AddManyTrucksDialog spec={spec} onClose={() => setAddMany(false)}
          onAdd={extra => setRows([...rows, ...extra])} />
      )}
    </PettyPage>
  );
}
