'use client';

import { useEffect, useState } from 'react';
import { Check, ChevronDown, Loader2, X } from 'lucide-react';
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from '@/components/ui/command';
import { cn } from '@/lib/utils';

/** Groups that aren't departments — listed above the department list. */
const PRESET_GROUPS = ['พจส.', 'ลูกค้า / ภายนอก (External)', 'ภายในองค์กร (Internal)'];

const SEPARATOR = ', ';

/** user_groups is stored as one comma-joined string (see ProjectRequestInput.user_groups). */
const parse = (value: string) => value.split(',').map(s => s.trim()).filter(Boolean);

type DepartmentOption = { option_value: string; option_label: string };

// shared across mounts — the department list rarely changes within a session
let departmentsCache: Promise<string[]> | null = null;
const loadDepartments = () => {
    departmentsCache ??= fetch('/api/organization/departments')
        .then(r => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
        .then((rows: DepartmentOption[]) => rows.map(d => d.option_label.trim()).filter(Boolean))
        .catch(err => { departmentsCache = null; throw err; });
    return departmentsCache;
};

export function UserGroupPicker({ id, value, onChange, className }: {
    id?: string; value: string; onChange: (value: string) => void; className?: string;
}) {
    const [open, setOpen] = useState(false);
    const [departments, setDepartments] = useState<string[] | null>(null);
    const [failed, setFailed] = useState(false);
    const selected = parse(value);

    useEffect(() => {
        let alive = true;
        loadDepartments()
            .then(list => { if (alive) setDepartments(list); })
            .catch(() => { if (alive) setFailed(true); });
        return () => { alive = false; };
    }, []);

    const toggle = (label: string) => {
        const next = selected.includes(label) ? selected.filter(s => s !== label) : [...selected, label];
        onChange(next.join(SEPARATOR));
    };

    const renderItem = (label: string) => {
        const active = selected.includes(label);
        return (
            <CommandItem key={label} value={label} onSelect={() => toggle(label)} className="cursor-pointer">
                <span className={cn(
                    'grid size-4 shrink-0 place-items-center rounded border transition-colors',
                    active ? 'border-brand-600 bg-brand-600 text-white' : 'border-gray-300 bg-white',
                )}>
                    {active && <Check className="size-3" strokeWidth={3} />}
                </span>
                <span className="truncate">{label}</span>
            </CommandItem>
        );
    };

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverAnchor asChild>
                <div className={cn(
                    'flex min-h-11 w-full flex-wrap items-center gap-1.5 rounded-xl border bg-white py-1.5 pl-2 pr-1 transition-all duration-200',
                    'hover:border-brand-600/40 focus-within:border-brand-600 focus-within:ring-2 focus-within:ring-brand-600/20',
                    className,
                )}>
                    {selected.map(label => (
                        <span key={label} className="inline-flex items-center gap-1 rounded-lg bg-brand-100 py-0.5 pl-2 pr-1 text-xs font-medium text-brand-700">
                            {label}
                            <button
                                type="button"
                                onClick={() => toggle(label)}
                                aria-label={`เอา ${label} ออก`}
                                className="grid size-4 place-items-center rounded hover:bg-brand-200 cursor-pointer"
                            >
                                <X className="size-3" />
                            </button>
                        </span>
                    ))}
                    <PopoverTrigger asChild>
                        <button
                            id={id}
                            type="button"
                            role="combobox"
                            aria-expanded={open}
                            className="flex h-7 min-w-32 flex-1 items-center justify-between gap-2 rounded-lg px-2 text-left text-sm text-gray-400 focus:outline-none cursor-pointer"
                        >
                            {selected.length ? 'เพิ่มกลุ่ม…' : 'เลือกกลุ่มผู้ใช้งาน / แผนก (ถ้ามี)'}
                            <ChevronDown className={cn('size-4 shrink-0 transition-transform', open && 'rotate-180')} />
                        </button>
                    </PopoverTrigger>
                </div>
            </PopoverAnchor>
            <PopoverContent align="start" className="w-(--radix-popover-trigger-width) min-w-64 p-0">
                <Command>
                    <CommandInput placeholder="ค้นหาแผนก…" />
                    <CommandList className="max-h-72">
                        <CommandEmpty>ไม่พบแผนกที่ค้นหา</CommandEmpty>
                        <CommandGroup heading="กลุ่มทั่วไป">{PRESET_GROUPS.map(renderItem)}</CommandGroup>
                        <CommandSeparator />
                        <CommandGroup heading="แผนก">
                            {departments?.filter(d => !PRESET_GROUPS.includes(d)).map(renderItem)}
                            {!departments && !failed && (
                                <div className="flex items-center gap-2 px-2 py-3 text-xs text-gray-500">
                                    <Loader2 className="size-3.5 animate-spin" /> กำลังโหลดรายชื่อแผนก…
                                </div>
                            )}
                            {failed && <div className="px-2 py-3 text-xs text-rose-600">โหลดรายชื่อแผนกไม่สำเร็จ</div>}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}
