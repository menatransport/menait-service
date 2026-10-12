'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { FileText } from 'lucide-react';
import { MascotLoader } from '@/components/loading';
import { useSessionContext } from '@/app/context/SessionContext';
import { isPettyFormId } from '@/lib/finance/petty-access';
import { isItemBased } from '@/lib/finance/petty-spec';
import type { PettyClaim, PettyExpenseType } from '@/app/finance/types-petty';
import { showAlert } from '../../api';
import { getClaim, getExpenseTypes } from '../../petty-api';
import { Field, FinanceCanvas, FinanceHeading, NoAccess, Panel } from '../../components/FinanceShell';
import { ItemGrid } from '../../components/petty/ItemGrid';
import { PettyStatusBadge } from '../../components/petty/ClaimTable';

type FileRow = { key: string; fileName?: string; url: string; folder?: string };

export default function PettyClaimDetailPage() {
  const { loading } = useSessionContext();
  const params = useParams<{ form_id: string }>();
  const formId = params?.form_id ?? '';

  const [claim, setClaim] = useState<PettyClaim | null>(null);
  const [type, setType] = useState<PettyExpenseType | null>(null);
  const [files, setFiles] = useState<FileRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!isPettyFormId(formId)) { setError('หมายเลขเอกสารไม่ถูกต้อง'); return; }
    try {
      const [c, types] = await Promise.all([getClaim(formId), getExpenseTypes()]);
      setClaim(c);
      setType(types.find(t => t.code === c.expense_type) ?? null);
      const res = await fetch(`/api/uploads3?form_id=${encodeURIComponent(formId)}`, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json() as { files?: FileRow[] };
        setFiles(data.files ?? []);
      }
    } catch (err) {
      setError((err as Error).message);
      showAlert({ icon: 'error', title: 'โหลดใบไม่สำเร็จ', text: (err as Error).message });
    }
  }, [formId]);

  useEffect(() => { void load(); }, [load]);

  if (loading) return <MascotLoader />;
  if (error) return <NoAccess text={error} />;
  if (!claim) return <MascotLoader />;

  const spec = type?.spec ?? {};
  const byFolder = files.reduce<Record<string, FileRow[]>>((acc, f) => {
    const key = f.folder ?? 'request';
    (acc[key] ??= []).push(f);
    return acc;
  }, {});

  return (
    <FinanceCanvas title={`ใบเบิก ${claim.form_id}`}>
      <FinanceHeading icon={FileText} title={`ใบเบิก ${claim.form_id}`}
        caption={type?.name_th ?? claim.expense_type}
        actions={<PettyStatusBadge status={claim.status} />} />

      {claim.return_reason && claim.status === 'RETURNED' && (
        <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          ผู้อนุมัติตีกลับ: {claim.return_reason}
        </div>
      )}
      {claim.review_remark && claim.status === 'SENT_BACK' && (
        <div className="mb-3 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-800">
          บัญชีส่งกลับแก้ไข: {claim.review_remark}
        </div>
      )}
      {claim.dup_override_reason && (
        <div className="mb-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-ink-700">
          ผู้อนุมัติยืนยันทับเรื่องรายการซ้ำ: {claim.dup_override_reason}
        </div>
      )}

      <Panel title="หัวใบ">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="จ่ายให้" value={claim.payee_name ?? '-'} />
          <Field label="วันที่บนใบ" value={claim.expense_date} />
          <Field label="ช่วงวันที่ค่าใช้จ่าย"
            value={claim.period_from && claim.period_to ? `${claim.period_from} – ${claim.period_to}` : '-'} />
          <Field label="ยอดรวม"
            value={`${claim.amount.toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท`} />
          <Field label="เลขที่ใบรับสินค้า (DD)" value={claim.dd_no ?? 'ยังไม่กรอก'} />
          <Field label="เจ้าหน้าที่ผู้เปิดใบ" value={claim.created_by} />
          <Field label="ผู้อนุมัติ" value={claim.approved_by ?? '-'} />
          <Field label="วันที่โอน" value={claim.transfer_date ?? '-'} />
          <Field label="บัญชีตรวจเมื่อ"
            value={claim.reviewed_at ? new Date(claim.reviewed_at).toLocaleString('th-TH') : '-'} />
        </div>
      </Panel>

      {isItemBased(spec) && (
        <Panel title={`${spec.item_label ?? 'รายการ'} (${claim.items.length})`}>
          <ItemGrid spec={spec} rows={claim.items as never[]} onChange={() => {}} readOnly />
        </Panel>
      )}

      <Panel title="ไฟล์แนบ">
        {files.length === 0 ? (
          <p className="text-sm text-ink-400">ยังไม่มีไฟล์แนบ</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {Object.entries(byFolder).map(([folder, list]) => {
              const label = (spec.attachments ?? []).find(a => a.key === folder)?.label ?? folder;
              return (
                <div key={folder}>
                  <p className="mb-1 text-sm font-medium">{label} ({list.length})</p>
                  <ul className="space-y-1 text-sm">
                    {list.map(f => (
                      <li key={f.key}>
                        <a href={f.url} target="_blank" rel="noreferrer"
                          className="text-brand-700 hover:underline">{f.fileName ?? f.key}</a>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        )}
      </Panel>
    </FinanceCanvas>
  );
}
