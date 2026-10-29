'use client';

import { FileText } from 'lucide-react';
import type { PettySpec } from '@/app/finance/types-petty';
import { displayFileName } from '@/lib/finance/status';
import type { ClaimFile } from './files-api';

/** ไฟล์แนบบนการ์ด (อ่านอย่างเดียว) — หน้าตาแบบ AttachmentPanel ของ Advance แต่บอกหมวดตาม spec ด้วย */
export function ClaimFiles({ spec, files, missing }: { spec?: PettySpec | null; files: ClaimFile[] | undefined; missing: string[] }) {
  const label = (folder: string) => spec?.attachments?.find(a => a.key === folder)?.label ?? folder;
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-gray-600">เอกสารแนบ</p>
      {files === undefined ? (
        <p className="text-xs text-gray-400">กำลังโหลดไฟล์…</p>
      ) : files.length === 0 ? (
        <p className="text-xs text-gray-400">ยังไม่มีไฟล์</p>
      ) : (
        <ul className="grid gap-1 sm:grid-cols-2">
          {files.map(f => (
            <li key={f.key} className="min-w-0">
              <a href={f.url} target="_blank" rel="noreferrer" className="inline-flex max-w-full items-center gap-1.5 text-sm text-brand-600 hover:underline">
                <FileText className="h-4 w-4 shrink-0" />
                <span className="truncate">{displayFileName(f.fileName ?? f.key)}</span>
                <span className="shrink-0 text-xs text-gray-400">· {label(f.folder)}</span>
              </a>
            </li>
          ))}
        </ul>
      )}
      {files !== undefined && missing.length > 0 && (
        <p className="text-xs text-rose-600">ยังไม่มี: {missing.join(', ')}</p>
      )}
    </div>
  );
}
