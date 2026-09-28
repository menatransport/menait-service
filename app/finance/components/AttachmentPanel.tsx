'use client';

import { useCallback, useEffect, useState } from 'react';
import { FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { displayFileName } from '@/lib/finance/status';
import { FOLDER_LABELS } from '../labels';
import { showAlert, uploadFiles } from '../api';
import type { AttachmentFile, AttachmentFolder } from '../types';
import { FilePicker } from './FilePicker';

export function AttachmentPanel({ formId, folder, canUpload = false, refreshKey = 0 }: {
  formId: string; folder: AttachmentFolder; canUpload?: boolean; refreshKey?: number;
}) {
  const [files, setFiles] = useState<AttachmentFile[]>([]);
  const [pending, setPending] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/uploads3?form_id=${encodeURIComponent(formId)}`, { cache: 'no-store' });
    const data = await res.json().catch(() => ({ files: [] }));
    setFiles(((data.files ?? []) as AttachmentFile[]).filter(f => f.folder === folder));
  }, [formId, folder]);

  useEffect(() => { load(); }, [load, refreshKey]);

  const upload = async () => {
    setUploading(true);
    const failed = await uploadFiles(formId, pending, folder === 'request' ? undefined : folder);
    setUploading(false);
    setPending([]);
    if (failed.length) showAlert({ icon: 'error', title: 'อัปโหลดไม่สำเร็จ', text: failed.join(', ') });
    load();
  };

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-gray-600">{FOLDER_LABELS[folder]}</p>
      {files.length === 0 ? (
        <p className="text-xs text-gray-400">ยังไม่มีไฟล์</p>
      ) : (
        <ul className="space-y-1">
          {files.map(f => (
            <li key={f.key}>
              <a href={f.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-sm text-[#026a75] hover:underline">
                <FileText className="h-4 w-4" /> {displayFileName(f.fileName)}
              </a>
            </li>
          ))}
        </ul>
      )}
      {canUpload && (
        <div className="space-y-2">
          <FilePicker files={pending} onChange={setPending} disabled={uploading} />
          {pending.length > 0 && (
            <Button type="button" size="sm" disabled={uploading} onClick={upload} className="bg-[#026a75] hover:bg-[#055058]">
              {uploading ? 'กำลังอัปโหลด...' : `อัปโหลด ${pending.length} ไฟล์`}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
