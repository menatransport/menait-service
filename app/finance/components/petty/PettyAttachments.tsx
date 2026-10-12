'use client';

import { useState } from 'react';
import { FileText } from 'lucide-react';
import type { PettySpec } from '@/app/finance/types-petty';
import { displayFileName } from '@/lib/finance/status';
import { FilePicker } from '../FilePicker';
import { showAlert, uploadFiles } from '../../api';

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

  async function upload(folder: string) {
    const picked = pending[folder] ?? [];
    if (!picked.length) return;
    setBusy(folder);
    try {
      const failed = await uploadFiles(formId, picked, folder as never);
      setPending(p => ({ ...p, [folder]: [] }));
      if (failed.length) showAlert({ icon: 'error', title: 'อัปโหลดไม่สำเร็จ', text: failed.join(', ') });
      onChanged();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {folders.map(a => {
        const list = files.filter(f => f.folder === a.key);
        const full = a.max !== undefined && list.length >= a.max;
        return (
          <div key={a.key} className="rounded-xl border border-slate-100 p-3">
            <p className="mb-1 text-sm font-medium">
              {a.label}{a.required && <span className="text-rose-500"> *</span>}
              <span className="ml-1 text-xs text-ink-400">{list.length}{a.max ? `/${a.max}` : ''}</span>
            </p>
            {list.length === 0 ? (
              <p className="text-xs text-ink-400">ยังไม่มีไฟล์</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {list.map(f => (
                  <li key={f.key}>
                    <a href={f.url} target="_blank" rel="noreferrer"
                      className="inline-flex items-center gap-1.5 text-brand-700 hover:underline">
                      <FileText className="h-4 w-4" /> {displayFileName(f.fileName ?? f.key)}
                    </a>
                  </li>
                ))}
              </ul>
            )}
            {canUpload && !full && (
              <div className="mt-2 space-y-2">
                <FilePicker files={pending[a.key] ?? []} onChange={fs => setPending(p => ({ ...p, [a.key]: fs }))}
                  disabled={busy === a.key} />
                {(pending[a.key]?.length ?? 0) > 0 && (
                  <button type="button" disabled={busy === a.key} onClick={() => upload(a.key)}
                    className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm text-white hover:bg-brand-700 disabled:opacity-50">
                    {busy === a.key ? 'กำลังอัปโหลด…' : `อัปโหลด ${pending[a.key].length} ไฟล์`}
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
