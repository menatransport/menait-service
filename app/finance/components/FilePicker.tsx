'use client';

import { useState } from 'react';
import { Paperclip, X } from 'lucide-react';

export function FilePicker({ files, onChange, disabled = false, maxSizeMB = 10 }: {
  files: File[]; onChange: (files: File[]) => void; disabled?: boolean; maxSizeMB?: number;
}) {
  const [warning, setWarning] = useState('');

  const pick = (list: FileList | null) => {
    const picked = Array.from(list ?? []);
    const tooBig = picked.filter(f => f.size > maxSizeMB * 1024 * 1024);
    setWarning(tooBig.length ? `ไฟล์ใหญ่เกิน ${maxSizeMB}MB: ${tooBig.map(f => f.name).join(', ')}` : '');
    onChange([...files, ...picked.filter(f => f.size <= maxSizeMB * 1024 * 1024)]);
  };

  return (
    <div className="space-y-2">
      <label className={`flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 px-4 py-4 text-sm text-gray-500 ${disabled ? 'opacity-60' : 'cursor-pointer hover:border-[#026a75]/40'}`}>
        <Paperclip className="h-4 w-4" /> แนบไฟล์ (เลือกได้หลายไฟล์ ไม่เกิน {maxSizeMB}MB/ไฟล์)
        <input type="file" multiple className="hidden" disabled={disabled}
          onChange={(e) => { pick(e.target.files); e.target.value = ''; }} />
      </label>
      {warning && <p className="text-xs text-rose-600">{warning}</p>}
      {files.length > 0 && (
        <ul className="space-y-1">
          {files.map((f, i) => (
            <li key={`${f.name}-${i}`} className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-1.5 text-xs">
              <span className="truncate">{f.name}</span>
              {!disabled && (
                <button type="button" aria-label="ลบไฟล์" onClick={() => onChange(files.filter((_, j) => j !== i))}>
                  <X className="h-3.5 w-3.5 text-gray-400 hover:text-rose-600" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
