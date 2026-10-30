'use client';

import { useCallback, useId, useMemo } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Tag, X } from 'lucide-react';
import type { PettyExpenseType } from '@/app/finance/types-petty';
import { ALL_TYPES_LABEL, TYPE_PARAM, resolveTypeParam, typeOptions, withTypeParam } from '@/lib/finance/petty-type-filter';

// โทนเดียวกับช่องเลือกศูนย์ค่าใช้จ่าย/แผนกของตารางฝ่ายการเงิน Advance (AdvanceListView) — เลือกแล้วขอบน้ำเงิน
const selectTone = (active: boolean) =>
  `max-w-[13rem] cursor-pointer rounded-lg border bg-white px-3 py-1.5 text-sm transition-colors focus:outline-none ${active ? 'border-brand-600 font-medium text-brand-600 ring-1 ring-brand-600/30' : 'border-gray-300 text-gray-700 hover:border-gray-400'}`;

/**
 * ประเภทการเบิกที่เลือกอยู่ เก็บใน ?type= — แชร์ลิงก์ได้ กดย้อนกลับ/ไปข้างหน้าได้ · '' = ทุกประเภท
 * ต้องอยู่ใต้ <Suspense> เพราะอ่าน useSearchParams
 */
export function usePettyTypeFilter(types: readonly PettyExpenseType[]) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const code = resolveTypeParam(params.get(TYPE_PARAM), types);
  const name = code ? types.find(t => t.code === code)?.name_th ?? code : '';
  const setCode = useCallback((next: string) => {
    const qs = withTypeParam(params.toString(), next);
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [params, pathname, router]);
  return { code, name, setCode };
}

/**
 * ช่องเลือกประเภทการเบิก — ชิ้นเดียวกันทุกหน้า (ผู้ขอเบิก เจ้าของเงินสด หัวหน้า บัญชี/การเงิน)
 * onCanvas = วางบนพื้นน้ำเงิน (ป้ายสีขาว) · compact = จอแคบซ่อนป้าย ให้วางข้างหัวข้อการ์ดได้
 */
export function TypeFilter({ types, value, onChange, onCanvas = false, compact = false, className = '' }: {
  types: readonly PettyExpenseType[];
  value: string;
  onChange: (code: string) => void;
  onCanvas?: boolean;
  compact?: boolean;
  className?: string;
}) {
  const id = useId();
  const options = useMemo(() => typeOptions(types), [types]);
  if (options.length === 0) return null;
  const active = value !== '';
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <label htmlFor={id} className={`shrink-0 text-xs font-medium ${onCanvas ? 'text-white/80' : 'text-gray-500'} ${compact ? 'hidden sm:inline' : ''}`}>
        ประเภทการเบิก
      </label>
      <select id={id} aria-label="ประเภทการเบิก" value={value} onChange={e => onChange(e.target.value)} className={selectTone(active)}>
        <option value="">{ALL_TYPES_LABEL}</option>
        {options.map(o => <option key={o.code} value={o.code}>{o.label}</option>)}
      </select>
      {active && (
        <button type="button" onClick={() => onChange('')} aria-label="ดูทุกประเภท" title="ดูทุกประเภท"
          className={`flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-lg transition-colors ${onCanvas ? 'text-white/80 hover:bg-white/15 hover:text-white' : 'text-gray-500 hover:bg-red-50 hover:text-red-600'}`}>
          <X size={14} />
        </button>
      )}
    </div>
  );
}

/** ป้ายเล็กบนการ์ด/แถวรอบ เช่น "มีค่าชั่งน้ำหนัก 2 จาก 5 ใบ" */
export function RoundTypeChip({ text }: { text: string | null | undefined }) {
  if (!text) return null;
  return (
    <span className="inline-flex max-w-full items-center gap-1 rounded-full border border-brand-200 bg-brand-50 px-2 py-0.5 text-[11px] font-medium text-brand-700">
      <Tag size={11} className="shrink-0" /> <span className="truncate">{text}</span>
    </span>
  );
}
