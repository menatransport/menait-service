'use client';

import { Check, FileText, Printer, Scale } from 'lucide-react';
import type { PettySpec } from '@/app/finance/types-petty';
import { printableDocs, requiredDocs, ruleSentences } from '@/lib/finance/petty-preset';

/** ชุดเอกสารของประเภทที่เลือก — อ่านจาก spec ตัวเดียวกับที่ด่านตรวจใช้
 *  เพิ่มประเภทใหม่ใน master แผงนี้ขึ้นเองโดยไม่ต้องแก้โค้ด */
export function DocumentPreset({ spec, counts = {}, typeName }: {
  spec: PettySpec;
  counts?: Record<string, number>;
  typeName: string;
}) {
  const docs = requiredDocs(spec, counts);
  const prints = printableDocs(spec);
  const rules = ruleSentences(spec);

  if (docs.length === 0 && prints.length === 0 && rules.length === 0) return null;

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <p className="mb-3 text-sm font-medium">ชุดเอกสารของ {typeName}</p>
      <div className="grid gap-4 md:grid-cols-3">
        <Box icon={<FileText className="h-4 w-4" />} title="ต้องแนบ">
          <ul className="space-y-1">
            {docs.map(d => (
              <li key={d.key} className="flex items-start gap-1.5">
                <span className={`mt-0.5 inline-flex h-4 w-4 flex-none items-center justify-center rounded border ${
                  d.done ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-slate-300 bg-white'}`}>
                  {d.done && <Check className="h-3 w-3" />}
                </span>
                <span className={d.done ? 'text-ink-400 line-through' : ''}>
                  {d.label}
                  {!d.required && <span className="ml-1 text-xs text-ink-400">({d.condition ?? 'ไม่บังคับ'})</span>}
                </span>
              </li>
            ))}
            {docs.length === 0 && <li className="text-ink-400">ประเภทนี้ไม่บังคับไฟล์แนบ</li>}
          </ul>
        </Box>

        <Box icon={<Printer className="h-4 w-4" />} title="ระบบจะพิมพ์ให้">
          <ul className="space-y-1">
            {prints.map(name => <li key={name}>{name}</li>)}
          </ul>
        </Box>

        <Box icon={<Scale className="h-4 w-4" />} title="กฎของประเภทนี้">
          <ul className="space-y-1">
            {rules.map((line, i) => <li key={i}>{line}</li>)}
            {rules.length === 0 && <li className="text-ink-400">ไม่มีกฎเพิ่มเติม</li>}
          </ul>
        </Box>
      </div>
    </div>
  );
}

function Box({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 inline-flex items-center gap-1.5 text-xs font-medium text-ink-500">
        {icon} {title}
      </p>
      <div className="text-sm text-ink-700">{children}</div>
    </div>
  );
}
