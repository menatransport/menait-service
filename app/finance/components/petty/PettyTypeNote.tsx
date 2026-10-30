'use client';

import { FileText, Info } from 'lucide-react';
import type { PettySpec } from '@/app/finance/types-petty';
import { printableDocs, ruleSentences } from '@/lib/finance/petty-preset';

/**
 * ข้อควรทราบของประเภทที่เลือก (หน้าเปิดใบ วางใต้ช่องประเภท): กฎ + เอกสารที่ระบบพิมพ์ให้
 * อ่านอย่างเดียว ไม่มีอะไรให้กด — การแนบไฟล์มีที่เดียวคือส่วนหลักฐาน กัน user งงว่าต้องกดตรงไหน (Bew 30/10/2026)
 */
export function PettyTypeNote({ spec, typeName }: { spec: PettySpec; typeName: string }) {
  const rules = ruleSentences(spec);
  const prints = printableDocs(spec);
  if (rules.length === 0 && prints.length === 0) return null;

  return (
    <aside aria-label={`ข้อควรทราบของ${typeName}`} className="rounded-lg border border-[#dbe4f3] bg-[#f7f9fc] px-4 py-3.5 text-sm">
      <p className="flex items-center gap-2 text-[13px] font-semibold text-ink-700">
        <Info className="size-4 flex-none text-brand-700" aria-hidden />
        ข้อควรทราบ · {typeName}
      </p>
      <div className="mt-3 grid gap-x-8 gap-y-4 md:grid-cols-[1.6fr_1fr]">
        {rules.length > 0 && (
          <div>
            <p className="mb-1.5 text-xs font-medium text-ink-500">กฎของประเภทนี้</p>
            <ol className="space-y-1.5">
              {rules.map((line, i) => (
                <li key={i} className="flex items-start gap-2 text-ink-700">
                  <span className="w-4 flex-none text-right tabular-nums text-ink-500">{i + 1}.</span>
                  <span className="min-w-0">{line}</span>
                </li>
              ))}
            </ol>
          </div>
        )}
        {prints.length > 0 && (
          <div>
            <p className="mb-1.5 text-xs font-medium text-ink-500">ระบบพิมพ์ให้ — ไม่ต้องแนบ</p>
            <ul className="space-y-1.5">
              {prints.map(name => (
                <li key={name} className="flex items-start gap-2 text-ink-700">
                  <FileText className="mt-0.5 size-4 flex-none text-ink-500" aria-hidden />{name}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </aside>
  );
}
