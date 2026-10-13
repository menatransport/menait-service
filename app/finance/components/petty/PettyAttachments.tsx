'use client';

import { useState } from 'react';
import { FileText, Trash2 } from 'lucide-react';
import type { PettySpec } from '@/app/finance/types-petty';
import { displayFileName } from '@/lib/finance/status';
import { FilePicker } from '../FilePicker';
import { pettyFileProblem } from '@/lib/finance/petty-upload';
import { showAlert, showConfirm, uploadFiles } from '../../api';

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
    // บอกก่อนส่งว่าไฟล์ไหนรับไม่ได้ (เซิร์ฟเวอร์เช็กซ้ำอีกชั้น)
    const bad = picked.map(f => ({ f, why: pettyFileProblem(f.name, f.size) })).filter(x => x.why);
    if (bad.length) {
      showAlert({ icon: 'warning', title: 'แนบไฟล์นี้ไม่ได้',
        text: bad.map(x => `${x.f.name}: ${x.why}`).join('\n') });
      return;
    }
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

  async function remove(file: PettyFile) {
    const ask = await showConfirm({ title: 'ลบไฟล์นี้?', text: displayFileName(file.fileName ?? file.key),
      confirmButtonText: 'ลบ', cancelButtonText: 'ยกเลิก' });
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
      }
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
                  <li key={f.key} className="flex items-center justify-between gap-2">
                    <a href={f.url} target="_blank" rel="noreferrer"
                      className="inline-flex items-center gap-1.5 text-brand-700 hover:underline">
                      <FileText className="h-4 w-4" /> {displayFileName(f.fileName ?? f.key)}
                    </a>
                    {canUpload && (
                      <button type="button" title="ลบไฟล์" disabled={busy === a.key} onClick={() => void remove(f)}
                        className="rounded p-1 text-ink-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
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
