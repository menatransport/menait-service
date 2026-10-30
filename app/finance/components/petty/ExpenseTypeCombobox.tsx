'use client';

import { useId, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { PettyExpenseType } from '@/app/finance/types-petty';
import { FIELD } from './ui';

/** ประเภทการเบิก = dropdown ค้นได้ (ประเภทมาจาก DB และจะเพิ่มเรื่อย ๆ — ไม่ใช้แถวชิป) */
export function ExpenseTypeCombobox({ types, value, onChange, id }: {
  types: PettyExpenseType[];
  value: string;
  onChange: (code: string) => void;
  id?: string;
}) {
  const [open, setOpen] = useState(false);
  const listId = useId();
  const current = types.find(t => t.code === value) ?? null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button id={id} type="button" role="combobox" aria-expanded={open} aria-haspopup="listbox" aria-controls={listId}
          className={`${FIELD} flex items-center justify-between gap-2 py-2.5 text-left`}>
          {current ? (
            <span className="flex min-w-0 items-center gap-2">
              <span className="truncate font-medium text-ink-900">{current.name_th}</span>
              <span className="shrink-0 rounded-md border border-[#dbe4f3] px-1.5 text-[11px] font-medium leading-5 text-ink-500">{current.code}</span>
            </span>
          ) : (
            <span className="text-ink-300">เลือกหรือพิมพ์ค้นประเภท</span>
          )}
          <ChevronDown className="h-4 w-4 shrink-0 text-ink-300" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] min-w-64 rounded-[10px] border-[#dbe4f3] p-0 shadow-[0_12px_28px_-12px_rgba(15,39,72,0.25)]">
        <Command filter={(itemValue, search) => (itemValue.toLowerCase().includes(search.trim().toLowerCase()) ? 1 : 0)}>
          <CommandInput placeholder="ค้นชื่อหรือรหัสประเภท" className="text-sm" />
          <CommandList id={listId} className="max-h-72">
            <CommandEmpty className="py-6 text-center text-sm text-ink-500">ไม่พบประเภทนี้</CommandEmpty>
            {types.map(t => (
              <CommandItem key={t.code} value={`${t.name_th} ${t.code}`}
                onSelect={() => { onChange(t.code); setOpen(false); }}
                className="flex items-center gap-2 rounded-none px-3 py-2 data-[selected=true]:bg-[#f3f7fd]">
                <Check className={`h-4 w-4 shrink-0 ${t.code === value ? 'text-brand-600' : 'opacity-0'}`} aria-hidden />
                <span className="min-w-0 flex-1 truncate text-ink-900">{t.name_th}</span>
                <span className="shrink-0 text-[11px] text-ink-500">{t.code}</span>
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
