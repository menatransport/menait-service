'use client';

import { useState } from 'react';
import { FileText, Trash2 } from 'lucide-react';
import type { PettySpec } from '@/app/finance/types-petty';
import { displayFileName } from '@/lib/finance/status';
import { pettyFileProblem } from '@/lib/finance/petty-upload';
import { showAlert, showSuccess, uploadFiles } from '../../api';
import { PettyFileDrop } from './PettyFileDrop';
import { pettyConfirm } from './petty-confirm';
import { Button, LINE, Req } from './ui';

export type PettyFile = { key: string; fileName?: string; url: string; folder: string };

/**
 * ไฟล์แนบของใบเงินสดย่อย แยกตามหมวดใน spec — แนบเพิ่มได้ทั้งเจ้าหน้าที่ผู้เปิดใบและผู้ถือเงิน
 * (REQUIREMENT §2.2 ขั้น 4: สลิปโอนแนบโดยผู้อนุมัติหรือผู้เบิก) · สิทธิ์จริงตัดสินที่ /api/uploads3
 */
export function PettyAttachments({ formId, spec, files, canUpload, onChanged }: {
  formId: string; spec: PettySpec; files: PettyFile[]; canUpload: boolean; onChanged: () => void;
}) {
  const [pending, setPending] = useState<Record<string, File[]>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const folders = spec.attachments ?? [];

  async function upload(folder: string, label: string) {
    const picked = pending[folder] ?? [];
    if (!picked.length) return;
    // บอกก่อนส่งว่าไฟล์ไหนรับไม่ได้ (เซิร์ฟเวอร์เช็กซ้ำอีกชั้น)
    const bad = picked.map(f => ({ f, why: pettyFileProblem(f.name, f.size) })).filter(x => x.why);
    if (bad.length) {
      showAlert({ icon: 'warning', title: 'แนบไฟล์นี้ไม่ได้',
        text: bad.map(x => `${x.f.name}: ${x.why}`).join('\n') });
      return;
    }
    const ask = await pettyConfirm({ title: `อัปโหลด ${picked.length} ไฟล์`,
      text: `${label} · ใบ ${formId}`, confirmButtonText: 'อัปโหลด' }) as { isConfirmed?: boolean };
    if (!ask?.isConfirmed) return;
    setBusy(folder);
    try {
      const failed = await uploadFiles(formId, picked, folder as never);
      setPending(p => ({ ...p, [folder]: [] }));
      if (failed.length) showAlert({ icon: 'error', title: 'อัปโหลดไม่สำเร็จ', text: failed.join(', ') });
      else showSuccess('อัปโหลดแล้ว');
      onChanged();
    } finally {
      setBusy(null);
    }
  }

  async function remove(file: PettyFile) {
    const ask = await pettyConfirm({ title: 'ลบไฟล์นี้?', text: displayFileName(file.fileName ?? file.key),
      confirmButtonText: 'ลบ', cancelButtonText: 'ยกเลิก' }, { danger: true });
    if (!ask.isConfirmed) return;
    setBusy(file.folder);
    try {
      const res = await fetch('/api/uploads3', {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ form_id: formId, key: file.key }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string };
        showAlert({ icon: 'error', title: 'ลบไม่สำเร็จ', text: data.error ?? '' });
      } else {
        showSuccess('ลบไฟล์แล้ว');
      }
      onChanged();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
      {folders.map(a => {
        const list = files.filter(f => f.folder === a.key);
        const full = a.max !== undefined && list.length >= a.max;
        const picked = pending[a.key] ?? [];
        return (
          <div key={a.key} className="min-w-0">
            <p className="mb-1.5 flex items-baseline justify-between gap-2 text-sm">
              <span className="font-medium text-ink-900">{a.label}{a.required && <Req />}</span>
              <span className="text-xs tabular-nums text-ink-500">{list.length}{a.max ? `/${a.max}` : ''} ไฟล์</span>
            </p>
            {list.length === 0 ? (
              <p className={`border-t ${LINE} py-2 text-xs text-ink-500`}>ยังไม่มีไฟล์</p>
            ) : (
              <ul className={`divide-y border-t ${LINE} divide-[#f3f6fa] text-sm`}>
                {list.map(f => (
                  <li key={f.key} className="flex items-center justify-between gap-2 py-1.5">
                    <a href={f.url} target="_blank" rel="noreferrer"
                      className="inline-flex min-w-0 items-center gap-1.5 text-ink-900 underline-offset-2 hover:text-brand-700 hover:underline">
                      <FileText className="h-4 w-4 shrink-0 text-ink-300" />
                      <span className="truncate">{displayFileName(f.fileName ?? f.key)}</span>
                    </a>
                    {canUpload && (
                      <button type="button" aria-label={`ลบไฟล์ ${displayFileName(f.fileName ?? f.key)}`} disabled={busy === a.key} onClick={() => void remove(f)}
                        className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-ink-300 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {canUpload && !full && (
              <div className="mt-2 space-y-2">
                <PettyFileDrop label="เพิ่มไฟล์" files={picked} disabled={busy === a.key}
                  tag={picked.length ? `เลือกแล้ว ${picked.length}` : 'เลือกไฟล์'}
                  onChange={fs => setPending(p => ({ ...p, [a.key]: fs }))} />
                {picked.length > 0 && (
                  <Button tone="primary" size="md" disabled={busy === a.key} onClick={() => void upload(a.key, a.label)}>
                    {busy === a.key ? 'กำลังอัปโหลด…' : `อัปโหลด ${picked.length} ไฟล์`}
                  </Button>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
