'use client';

import { CheckCircle2, FileText, Paperclip } from 'lucide-react';
import type { PettySpec } from '@/app/finance/types-petty';
import { printableDocs, requiredDocs, ruleSentences } from '@/lib/finance/petty-preset';
import { PETTY_CLAIM_CAP } from '@/lib/finance/petty-rules';
import { typeGuide } from '@/lib/finance/petty-type-guide';
import { Button } from './ui';

/**
 * การ์ดวิธีกรอกของประเภทที่เลือก — ขึ้นทุกครั้งที่เลือกประเภท ต้องกด "รับทราบ" ก่อนขั้นถัดไปจะขึ้น (ผู้ใช้สั่ง 25/11/2026)
 * ซ้าย = ขั้นตอนการกรอก (lib/finance/petty-type-guide) · ขวา = เอกสารที่ต้องแนบ กฎ และเอกสารที่ระบบพิมพ์ให้ ดึงจาก spec ของประเภท
 * onAck ไม่ส่งมา = เปิดดูซ้ำหลังรับทราบแล้ว ปุ่มเป็น "ซ่อน" แทน
 */
export function PettyTypeGuide({ spec, code, typeName, onAck, onClose }: {
  spec: PettySpec; code: string; typeName: string; onAck?: () => void; onClose?: () => void;
}) {
  const guide = typeGuide(code);
  const docs = requiredDocs(spec).filter(d => !d.byHolder && (d.required || d.condition));
  const rules = [`ใบหนึ่งเบิกได้ไม่เกิน ${PETTY_CLAIM_CAP.toLocaleString('th-TH')} บาท เกินนั้นเบิก Advance แทน`, ...ruleSentences(spec)];
  const prints = printableDocs(spec);

  return (
    <section aria-label={`วิธีกรอก${typeName}`} className="rounded-xl border border-brand-200 bg-white shadow-sm">
      <div className="rounded-t-xl border-b border-brand-100 bg-brand-50/60 px-4 py-3">
        <p className="text-[15px] font-semibold text-ink-900">วิธีกรอก · {typeName}</p>
        {guide.summary && <p className="mt-0.5 text-sm text-ink-700">{guide.summary}</p>}
      </div>

      <div className="grid gap-x-8 gap-y-5 px-4 py-4 md:grid-cols-[1.5fr_1fr]">
        <ol className="space-y-2.5">
          {guide.steps.map((s, i) => (
            <li key={i} className="flex items-start gap-3 text-sm text-ink-900">
              <span className="mt-px inline-flex size-6 flex-none items-center justify-center rounded-full bg-brand-600 text-xs font-semibold tabular-nums text-white">{i + 1}</span>
              <span className="min-w-0 leading-6">{s}</span>
            </li>
          ))}
        </ol>

        <div className="space-y-4 text-sm">
          {docs.length > 0 && (
            <div>
              <p className="mb-1.5 text-xs font-medium text-ink-500">ต้องแนบ</p>
              <ul className="space-y-1.5">
                {docs.map(d => (
                  <li key={d.key} className="flex items-start gap-2 text-ink-700">
                    <Paperclip className="mt-0.5 size-4 flex-none text-ink-500" aria-hidden />
                    <span className="min-w-0">{d.label}{d.condition && <span className="block text-xs text-ink-500">{d.condition}</span>}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div>
            <p className="mb-1.5 text-xs font-medium text-ink-500">กฎ</p>
            <ul className="space-y-1.5">
              {rules.map((r, i) => <li key={i} className="text-ink-700">{r}</li>)}
            </ul>
          </div>
          {prints.length > 0 && (
            <div>
              <p className="mb-1.5 text-xs font-medium text-ink-500">ระบบพิมพ์ให้ ไม่ต้องแนบ</p>
              <ul className="space-y-1.5">
                {prints.map(p => (
                  <li key={p} className="flex items-start gap-2 text-ink-700">
                    <FileText className="mt-0.5 size-4 flex-none text-ink-500" aria-hidden />{p}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-end gap-3 border-t border-brand-100 px-4 py-3">
        {onAck ? (<>
          <p className="mr-auto text-xs text-ink-500">อ่านแล้วกดรับทราบ ขั้นถัดไปจะขึ้นให้กรอก</p>
          <Button tone="primary" onClick={onAck}><CheckCircle2 className="size-4" aria-hidden />รับทราบ ทำต่อ</Button>
        </>) : (
          <Button onClick={onClose}>ซ่อน</Button>
        )}
      </div>
    </section>
  );
}
