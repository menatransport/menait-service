'use client';

import React, { memo, useState, useCallback, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle,
    DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
    Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
    Route, Network, Building, ChevronsUpDown, Check, ChevronRight, Plus, Loader2,
    type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
    placeDepartment, divisionsInPath, departmentsFor, divisionLabel, departmentLabel,
    type OrgIndex, type OrgDepartment, type OrgDivision, type OrgPlacement,
} from './org-structure';

type Size = 'md' | 'sm';

export interface SelectOption {
    value: string;
    label: string;
    /** Secondary text, e.g. a ฝ่าย code — also searchable */
    hint?: string;
}

const TRIGGER: Record<Size, string> = {
    md: 'h-10 px-3 text-sm rounded-lg',
    sm: 'h-8 px-2.5 text-xs rounded-lg',
};

// ── Searchable single select (Popover + Command) ──
export const OrgSelect = memo(({ value, options, onChange, placeholder, size, error, disabled, clearLabel }: {
    value: string;
    options: SelectOption[];
    onChange: (v: string) => void;
    placeholder: string;
    size: Size;
    error?: boolean;
    disabled?: boolean;
    /** Shows a first item that resets the value to '' */
    clearLabel?: string;
}) => {
    const [open, setOpen] = useState(false);
    const selected = options.find(o => o.value === value);
    const pick = (v: string) => { onChange(v); setOpen(false); };
    const itemCls = size === 'sm' ? 'text-xs' : 'text-sm';

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    disabled={disabled}
                    className={cn(
                        'flex items-center justify-between w-full border bg-white transition-colors cursor-pointer',
                        'hover:border-brand-600/40 focus:border-brand-600 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50',
                        TRIGGER[size],
                        error ? 'border-red-300 bg-red-50/40' : 'border-gray-200',
                        !selected && 'text-gray-400',
                    )}
                >
                    <span className="truncate text-left">
                        {selected ? selected.label : placeholder}
                        {selected?.hint && <span className="ml-1.5 text-gray-400">{selected.hint}</span>}
                    </span>
                    <ChevronsUpDown className="w-3.5 h-3.5 text-gray-400 shrink-0 ml-1" />
                </button>
            </PopoverTrigger>
            <PopoverContent className="w-(--radix-popover-trigger-width) min-w-60 p-0 rounded-lg border shadow-lg" align="start">
                <Command>
                    <CommandInput placeholder="ค้นหา..." className={size === 'sm' ? 'h-8 text-xs' : 'h-9 text-sm'} />
                    <CommandList className="max-h-60">
                        <CommandEmpty className="py-3 text-center text-xs text-gray-400">ไม่พบรายการ</CommandEmpty>
                        <CommandGroup>
                            {clearLabel && (
                                <CommandItem value={`__clear ${clearLabel}`} onSelect={() => pick('')} className={cn(itemCls, 'cursor-pointer text-gray-500')}>
                                    <Check className={cn('w-3.5 h-3.5 mr-1.5', value === '' ? 'opacity-100 text-brand-600' : 'opacity-0')} />
                                    {clearLabel}
                                </CommandItem>
                            )}
                            {options.map(opt => (
                                <CommandItem
                                    key={opt.value}
                                    // cmdk needs unique values; the id suffix keeps same-named items apart
                                    value={`${opt.label} ${opt.hint ?? ''} #${opt.value}`}
                                    onSelect={() => pick(opt.value)}
                                    className={cn(itemCls, 'cursor-pointer')}
                                >
                                    <Check className={cn('w-3.5 h-3.5 mr-1.5 shrink-0', value === opt.value ? 'opacity-100 text-brand-600' : 'opacity-0')} />
                                    <span className="truncate">{opt.label}</span>
                                    {opt.hint && <span className="ml-auto pl-2 text-[11px] text-gray-400 shrink-0">{opt.hint}</span>}
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
});
OrgSelect.displayName = 'OrgSelect';

const FieldLabel = ({ icon: Icon, size, required, children, action }: {
    icon: LucideIcon; size: Size; required?: boolean; children: React.ReactNode; action?: React.ReactNode;
}) => (
    <div className="flex items-center justify-between gap-2 min-h-5">
        <Label className={cn('font-medium flex items-center gap-1.5', size === 'sm' ? 'text-[11px] text-gray-400' : 'text-xs text-gray-600')}>
            <Icon className="w-3.5 h-3.5 text-brand-600" />
            {children}
            {required && <span className="text-red-400">*</span>}
        </Label>
        {action}
    </div>
);

/** "สายงาน › ฝ่าย › แผนก" for a department id */
export const OrgBreadcrumb = memo(({ org, departmentId, className }: {
    org: OrgIndex; departmentId: string | number | null | undefined; className?: string;
}) => {
    const placed = placeDepartment(org, departmentId);
    if (!placed) return null;
    const parts = [
        placed.path?.path_th ?? 'ไม่ระบุสายงาน',
        divisionLabel(placed.division),
        departmentLabel(placed.department),
    ];
    return (
        <div className={cn('flex flex-wrap items-center gap-1 text-[11px] text-gray-500', className)}>
            {parts.map((p, i) => (
                <React.Fragment key={i}>
                    {i > 0 && <ChevronRight className="w-3 h-3 text-gray-300" />}
                    <span className={i === parts.length - 1 ? 'font-medium text-brand-700' : ''}>{p}</span>
                </React.Fragment>
            ))}
        </div>
    );
});
OrgBreadcrumb.displayName = 'OrgBreadcrumb';

interface OrgPickerProps {
    org: OrgIndex;
    /** department_id as a string; '' = not chosen */
    value: string;
    onChange: (departmentId: string) => void;
    /** Enables "เพิ่มแผนกใหม่" under the chosen ฝ่าย */
    onDepartmentCreated?: (department: OrgDepartment) => void;
    size?: Size;
    /** Highlights the แผนก field (required and empty) */
    error?: boolean;
}

/**
 * สายงาน → ฝ่าย → แผนก. Only department_id is saved on the user; สายงาน and ฝ่าย
 * narrow the lists and are re-derived from the แผนก whenever it changes.
 */
export const OrgPicker = memo(({ org, value, onChange, onDepartmentCreated, size = 'md', error }: OrgPickerProps) => {
    // สายงาน only filters when picked by hand; otherwise it just mirrors the ฝ่าย,
    // so moving someone to a ฝ่าย in another สายงาน needs no clearing first
    const [pinnedPath, setPinnedPath] = useState<number | null>(null);
    const [divisionId, setDivisionId] = useState<number | null>(null);
    const [addOpen, setAddOpen] = useState(false);

    const placed = useMemo(() => placeDepartment(org, value), [org, value]);

    const syncFrom = useCallback((p: OrgPlacement) => {
        setDivisionId(p.division?.division_id ?? null);
        setPinnedPath(prev => (prev != null && prev !== (p.path?.path_id ?? null) ? null : prev));
    }, []);

    // A chosen แผนก always wins: pull ฝ่าย from it
    useEffect(() => {
        if (placed) syncFrom(placed);
    }, [placed, syncFrom]);

    const division = divisionId != null ? org.divisionById.get(divisionId) ?? null : null;
    const shownPath = pinnedPath ?? division?.path_id ?? null;

    const pathOptions = useMemo<SelectOption[]>(() => org.paths.map(p => ({
        value: String(p.path_id), label: p.path_th, hint: p.path_code ?? undefined,
    })), [org.paths]);

    const divisionOptions = useMemo<SelectOption[]>(() => divisionsInPath(org, pinnedPath).map(d => ({
        value: String(d.division_id), label: divisionLabel(d), hint: d.division_code ?? undefined,
    })), [org, pinnedPath]);

    const departmentOptions = useMemo<SelectOption[]>(() => departmentsFor(org, pinnedPath, divisionId).map(d => {
        // Without a ฝ่าย filter, show which ฝ่าย each แผนก belongs to
        const div = divisionId == null && d.division_id != null ? org.divisionById.get(d.division_id) : null;
        return {
            value: String(d.department_id),
            label: departmentLabel(d),
            hint: divisionId == null ? (div?.division_code ?? (div ? divisionLabel(div) : 'ไม่ระบุฝ่าย')) : undefined,
        };
    }), [org, pinnedPath, divisionId]);

    const handlePath = useCallback((v: string) => {
        const next = v === '' ? null : Number(v);
        setPinnedPath(next);
        if (next != null && division && division.path_id !== next) {
            setDivisionId(null);
            if (value) onChange('');
        }
    }, [division, value, onChange]);

    const handleDivision = useCallback((v: string) => {
        const next = v === '' ? null : Number(v);
        setDivisionId(next);
        if (next == null) return;
        const depts = org.departmentsByDivision.get(next) ?? [];
        if (depts.length === 1) {
            onChange(String(depts[0].department_id));
        } else if (value && !depts.some(d => String(d.department_id) === value)) {
            onChange('');
        }
    }, [org, value, onChange]);

    const handleDepartment = useCallback((v: string) => {
        // Re-sync even when the same แผนก is picked again after the filters were cleared
        const p = placeDepartment(org, v);
        if (p) syncFrom(p);
        onChange(v);
    }, [org, onChange, syncFrom]);

    const handleCreated = useCallback((d: OrgDepartment) => {
        onDepartmentCreated?.(d);
        onChange(String(d.department_id));
    }, [onDepartmentCreated, onChange]);

    const sm = size === 'sm';

    return (
        <div className="space-y-2">
            <div className={cn('grid gap-3', sm ? 'grid-cols-1 gap-2' : 'grid-cols-1 sm:grid-cols-3')}>
                <div className="space-y-1.5">
                    <FieldLabel icon={Route} size={size}>สายงาน</FieldLabel>
                    <OrgSelect
                        value={shownPath == null ? '' : String(shownPath)}
                        options={pathOptions}
                        onChange={handlePath}
                        placeholder="ทุกสายงาน"
                        clearLabel="ทุกสายงาน"
                        size={size}
                    />
                </div>
                <div className="space-y-1.5">
                    <FieldLabel icon={Network} size={size}>ฝ่าย</FieldLabel>
                    <OrgSelect
                        value={divisionId == null ? '' : String(divisionId)}
                        options={divisionOptions}
                        onChange={handleDivision}
                        placeholder="-- เลือกฝ่าย --"
                        clearLabel={pinnedPath == null ? 'ทุกฝ่าย' : 'ทุกฝ่ายในสายงานนี้'}
                        size={size}
                    />
                </div>
                <div className="space-y-1.5">
                    <FieldLabel
                        icon={Building}
                        size={size}
                        required
                        action={onDepartmentCreated && division && (
                            <button
                                type="button"
                                onClick={() => setAddOpen(true)}
                                className="flex items-center gap-0.5 text-[11px] font-medium text-brand-600 hover:text-brand-800 cursor-pointer"
                            >
                                <Plus className="w-3 h-3" />
                                เพิ่มแผนก
                            </button>
                        )}
                    >
                        แผนก
                    </FieldLabel>
                    <OrgSelect
                        value={value}
                        options={departmentOptions}
                        onChange={handleDepartment}
                        placeholder={departmentOptions.length ? '-- เลือกแผนก --' : 'ฝ่ายนี้ยังไม่มีแผนก'}
                        size={size}
                        error={error}
                        disabled={departmentOptions.length === 0}
                    />
                </div>
            </div>

            {placed ? (
                <OrgBreadcrumb org={org} departmentId={value} className="px-0.5" />
            ) : (
                <p className="text-[11px] text-gray-400 px-0.5">
                    เลือกฝ่ายก่อน รายการแผนกจะเหลือเฉพาะในฝ่ายนั้น · หรือค้นชื่อแผนกได้เลย ระบบเติมฝ่าย/สายงานให้
                </p>
            )}

            {onDepartmentCreated && division && (
                <AddDepartmentDialog
                    open={addOpen}
                    onOpenChange={setAddOpen}
                    division={division}
                    onCreated={handleCreated}
                />
            )}
        </div>
    );
});
OrgPicker.displayName = 'OrgPicker';

// ── เพิ่มแผนกใหม่ใต้ฝ่ายที่เลือก ──
const AddDepartmentDialog = memo(({ open, onOpenChange, division, onCreated }: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    division: OrgDivision;
    onCreated: (department: OrgDepartment) => void;
}) => {
    const [nameTh, setNameTh] = useState('');
    const [nameEn, setNameEn] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const close = useCallback((isOpen: boolean) => {
        if (!isOpen) { setNameTh(''); setNameEn(''); setError(null); }
        onOpenChange(isOpen);
    }, [onOpenChange]);

    const handleSubmit = useCallback(async (e: React.FormEvent) => {
        e.preventDefault();
        // the form is portalled but React still bubbles submit to the outer form
        e.stopPropagation();
        if (!nameTh.trim() || !nameEn.trim()) {
            setError('กรุณากรอกชื่อแผนกภาษาไทยและภาษาอังกฤษ');
            return;
        }
        setSaving(true);
        setError(null);
        try {
            const res = await fetch('/api/organization/departments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    department_name_th: nameTh.trim(),
                    department_name_en: nameEn.trim(),
                    division_id: division.division_id,
                }),
            });
            const data = await res.json();
            if (!res.ok) {
                setError(data?.error || 'ไม่สามารถเพิ่มแผนกได้ กรุณาลองใหม่');
                return;
            }
            onCreated(data);
            close(false);
        } catch {
            setError('เกิดข้อผิดพลาด กรุณาลองใหม่');
        } finally {
            setSaving(false);
        }
    }, [nameTh, nameEn, division.division_id, onCreated, close]);

    return (
        <Dialog open={open} onOpenChange={close}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-brand-600">
                        <Building className="w-5 h-5" />
                        เพิ่มแผนกใหม่
                    </DialogTitle>
                    <DialogDescription>
                        แผนกใหม่จะอยู่ใต้ <span className="font-medium text-gray-700">{divisionLabel(division)}</span>
                        {division.division_code && <span className="text-gray-400"> ({division.division_code})</span>}
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 mt-2">
                    <div className="space-y-1.5">
                        <Label className="text-xs font-medium text-gray-600">
                            ชื่อแผนก (ไทย) <span className="text-red-400">*</span>
                        </Label>
                        <Input
                            value={nameTh}
                            onChange={e => { setNameTh(e.target.value); setError(null); }}
                            placeholder="เช่น แผนกแรงงานสัมพันธ์"
                            className="h-10 text-sm rounded-lg border-gray-200"
                            autoFocus
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label className="text-xs font-medium text-gray-600">
                            ชื่อแผนก (อังกฤษ) <span className="text-red-400">*</span>
                        </Label>
                        <Input
                            value={nameEn}
                            onChange={e => { setNameEn(e.target.value); setError(null); }}
                            placeholder="e.g. Employee Relation"
                            className="h-10 text-sm rounded-lg border-gray-200"
                        />
                    </div>
                    {error && <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
                    <DialogFooter className="pt-2">
                        <Button type="button" variant="outline" onClick={() => close(false)} disabled={saving} className="rounded-xl cursor-pointer">
                            ยกเลิก
                        </Button>
                        <Button type="submit" disabled={saving} className="rounded-xl bg-brand-600 hover:bg-brand-800 text-white cursor-pointer">
                            {saving ? <><Loader2 className="w-4 h-4 animate-spin mr-1.5" />กำลังบันทึก...</> : 'เพิ่มแผนก'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
});
AddDepartmentDialog.displayName = 'AddDepartmentDialog';
