'use client';

import { Check, ChevronDown, FileText } from 'lucide-react';
import type { PettySpec } from '@/app/finance/types-petty';
import { printableDocs, requiredDocs, ruleSentences } from '@/lib/finance/petty-preset';
import { Tag } from './ui';

/** ชุดเอกสารของประเภทที่เลือก — อ่านจาก spec ตัวเดียวกับที่ด่านตรวจใช้
 *  เพิ่มประเภทใหม่ใน master แผงนี้ขึ้นเองโดยไม่ต้องแก้โค้ด
 *  collapsible = พับไว้ (หน้าเปิดใบ) ให้ฟอร์มสั้น แถบหัวบอกยอดแนบแล้วไว้ให้เห็นตอนพับ
 *  หน้าตา: กรอบเดียว 3 ช่องคั่นเส้น (ต้องแนบ · ระบบพิมพ์ให้ · กฎ) — Bew 30/10/2026
 *  หน้าเปิดใบใช้ PettyTypeNote แทน (แนบไฟล์ที่เดียวในส่วนหลักฐาน) */
export function DocumentPreset({ spec, counts = {}, typeName, collapsible = false }: {
  spec: PettySpec;
  counts?: Record<string, number>;
  typeName: string;
  collapsible?: boolean;
}) {
  const docs = requiredDocs(spec, counts);
  const prints = printableDocs(spec);
  const rules = ruleSentences(spec);

  if (docs.length === 0 && prints.length === 0 && rules.length === 0) return null;

  const must = docs.filter(d => d.required);
  const summary = must.length
    ? `แนบแล้ว ${must.filter(d => d.done).length}/${must.length} ที่บังคับ`
    : 'ไม่บังคับไฟล์แนบ';
  const title = <>ชุดเอกสารและกฎของ <span className="text-ink-900">{typeName}</span></>;

  const body = (
    <div className="grid divide-y divide-[#edf1f7] text-sm md:grid-cols-[1.35fr_1fr_1.35fr] md:divide-x md:divide-y-0">
      <Col title="เอกสารที่ต้องแนบ" count={docs.length}>
        {docs.map(d => {
          // "สำเนาบัตร… (เมื่อโอนเข้าชื่อบุคคล/ร้านเงินสด)" → ชื่อเอกสารบรรทัดแรก วงเล็บเป็นบรรทัดรองสีเทา
          const [, name = d.label, note] = d.label.match(/^(.*?)\s*\((.+)\)$/) ?? [];
          return (
            <li key={d.key} className="flex items-start gap-2.5">
              <span className={`mt-0.5 inline-flex size-4 flex-none items-center justify-center rounded border ${d.done ? 'border-brand-600 bg-brand-600 text-white' : 'border-ink-300 bg-white'}`}>
                {d.done && <Check className="size-3" strokeWidth={3} />}
              </span>
              <span className="min-w-0 flex-1">
                <span className={`block ${d.done ? 'text-ink-500' : 'text-ink-900'}`}>{name}</span>
                {(note || d.condition) && (
                  <span className="mt-0.5 block text-xs leading-relaxed text-ink-500">
                    {d.condition ?? note}
                  </span>
                )}
                {d.byHolder && !d.done && (
                  <span className="mt-0.5 block text-xs leading-relaxed text-ink-500">เจ้าของเงินสดแนบตอนอนุมัติจ่าย</span>
                )}
              </span>
              <Tag strong={d.required} className="mt-px">{d.required ? 'บังคับ' : d.condition ? 'มีเงื่อนไข' : 'ไม่บังคับ'}</Tag>
            </li>
          );
        })}
        {docs.length === 0 && <li className="text-ink-500">ไม่บังคับไฟล์แนบ</li>}
      </Col>
      <Col title="ระบบพิมพ์ให้" count={prints.length}>
        {prints.map(name => (
          <li key={name} className="flex items-start gap-2.5 text-ink-900">
            <FileText className="mt-0.5 size-4 flex-none text-ink-500" aria-hidden />{name}
          </li>
        ))}
        {prints.length === 0 && <li className="text-ink-500">-</li>}
      </Col>
      <Col title="กฎของประเภทนี้" count={rules.length}>
        {rules.map((line, i) => (
          <li key={i} className="flex items-start gap-2.5 text-ink-700">
            <span className="w-4 flex-none text-right tabular-nums text-ink-500">{i + 1}.</span>
            <span className="min-w-0">{line}</span>
          </li>
        ))}
        {rules.length === 0 && <li className="text-ink-500">ไม่มีกฎเพิ่มเติม</li>}
      </Col>
    </div>
  );

  if (!collapsible) return <div className="overflow-hidden rounded-lg border border-[#dbe4f3]">{body}</div>;
  return (
    <details className="group overflow-hidden rounded-lg border border-[#dbe4f3]">
      <summary className="flex cursor-pointer list-none items-center gap-3 bg-[#f7f9fc] px-4 py-2.5 hover:bg-[#f2f6fc] [&::-webkit-details-marker]:hidden">
        <FileText className="size-4 flex-none text-brand-700" aria-hidden />
        <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-ink-700">{title}</span>
        <span className="hidden text-xs text-ink-500 sm:inline">{summary}</span>
        <ChevronDown className="size-4 flex-none text-ink-500 transition-transform group-open:rotate-180" aria-hidden />
      </summary>
      <div className="border-t border-[#dbe4f3]">{body}</div>
    </details>
  );
}

function Col({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <div className="px-4 py-3.5">
      <p className="mb-2.5 flex items-center gap-1.5 text-xs font-semibold text-ink-700">
        {title}<span className="font-normal tabular-nums text-ink-500">({count})</span>
      </p>
      <ul className="space-y-2.5">{children}</ul>
    </div>
  );
}
