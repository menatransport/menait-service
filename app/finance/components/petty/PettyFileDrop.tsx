'use client';

import { useId, useState, type DragEvent } from 'react';
import { FileText, Upload, X } from 'lucide-react';
import { Req, Tag } from './ui';

/**
 * ช่องแนบไฟล์หนึ่งหมวด (แบบที่ Bew อนุมัติ): กล่องเส้นประ ไอคอนเทา ชื่อหมวด + ป้าย "แนบแล้ว N / ต้องแนบ / ไม่บังคับ"
 * คลิกหรือลากไฟล์มาวาง · กฎขนาดไฟล์เหมือน FilePicker (ไม่เกิน maxSizeMB ต่อไฟล์) · max = จำนวนไฟล์สูงสุดของหมวด
 */
export function PettyFileDrop({ label, required = false, max, note, files, onChange, disabled = false, maxSizeMB = 10, tag }: {
  label: string;
  /** ข้อความในป้ายขวา — ไม่ระบุ = แนบแล้ว N / ต้องแนบ / ไม่บังคับ */
  tag?: string;
  required?: boolean;
  max?: number;
  note?: string;
  files: File[];
  onChange: (files: File[]) => void;
  disabled?: boolean;
  maxSizeMB?: number;
}) {
  const id = useId();
  const [warning, setWarning] = useState('');
  const [over, setOver] = useState(false);

  const pick = (list: FileList | null) => {
    const picked = Array.from(list ?? []);
    if (!picked.length) return;
    const limit = maxSizeMB * 1024 * 1024;
    const tooBig = picked.filter(f => f.size > limit);
    setWarning(tooBig.length ? `ไฟล์ใหญ่เกิน ${maxSizeMB}MB: ${tooBig.map(f => f.name).join(', ')}` : '');
    const next = [...files, ...picked.filter(f => f.size <= limit)];
    onChange(max ? next.slice(0, max) : next);
  };

  const onDrop = (e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault(); setOver(false);
    if (!disabled) pick(e.dataTransfer.files);
  };

  const status = tag ?? (files.length > 0 ? `แนบแล้ว ${files.length}` : required ? 'ต้องแนบ' : 'ไม่บังคับ');
  const hint = [max ? `ไม่เกิน ${max} ไฟล์` : null, `${maxSizeMB}MB/ไฟล์`].filter(Boolean).join(' · ');

  return (
    <div className="min-w-0">
      <label htmlFor={id}
        onDragOver={e => { e.preventDefault(); if (!disabled) setOver(true); }}
        onDragLeave={() => setOver(false)} onDrop={onDrop}
        className={`flex min-h-16 items-center gap-3 rounded-xl border-[1.5px] border-dashed bg-white px-3.5 py-3 transition-colors ${
          disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:border-ink-300'} ${
          over ? 'border-brand-600 bg-[#f6f9fe]' : 'border-[#dbe4f3]'} focus-within:border-brand-600 focus-within:ring-2 focus-within:ring-brand-600/15`}>
        <Upload className="h-[18px] w-[18px] shrink-0 text-ink-500" aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13.5px] text-ink-700">{label}{required && <Req />}</span>
          <span className="block truncate text-[11.5px] text-ink-500">{note || hint}</span>
        </span>
        <Tag strong={files.length === 0 && required}>{status}</Tag>
        <input id={id} type="file" multiple className="sr-only" disabled={disabled}
          onChange={e => { pick(e.target.files); e.target.value = ''; }} />
      </label>
      {warning && <p className="mt-1.5 border-l-2 border-rose-600 pl-2 text-xs text-rose-700">{warning}</p>}
      {files.length > 0 && (
        <ul className="mt-2 space-y-1">
          {files.map((f, i) => (
            <li key={`${f.name}-${i}`} className="flex items-center gap-2 text-xs text-ink-700">
              <FileText className="h-3.5 w-3.5 shrink-0 text-ink-300" aria-hidden />
              <span className="min-w-0 flex-1 truncate">{f.name}</span>
              {!disabled && (
                <button type="button" aria-label={`เอาไฟล์ ${f.name} ออก`} onClick={() => onChange(files.filter((_, j) => j !== i))}
                  className="inline-flex size-6 items-center justify-center rounded text-ink-300 hover:bg-rose-50 hover:text-rose-600">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
