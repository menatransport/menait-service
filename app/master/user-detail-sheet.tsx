'use client';
import React, { memo, useState, useCallback, useMemo } from 'react';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
    Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from '@/components/ui/command';
import {
    Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover';
import {
    BadgeCheck, Monitor, Package, Mail, Building, MapPin,
    Briefcase, Shield, Pencil, X, Save, Loader2, CheckCircle2,
    AlertCircle, User, IdCard, ChevronsUpDown, Check, Route, Network,
    ArrowRight, type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { UserData } from '@/components/profile-form';
import type { MasterLookups } from './types';
import { UserAvatar } from '@/components/ui/user-avatar';
import { useSessionContext } from '@/app/context/SessionContext';
import { OrgPicker } from './org-picker';
import {
    placeDepartment, divisionLabel, departmentLabel,
    type OrgIndex, type OrgDepartment, type OrgPlacement,
} from './org-structure';

interface UserDetailSheetProps {
    user: UserData | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onUpdate?: (data: UserData) => Promise<boolean>;
    /** Lookup options (id -> label) for สถานที่ / ตำแหน่ง */
    lookups?: MasterLookups;
    org: OrgIndex;
    onDepartmentCreated?: (department: OrgDepartment) => void;
}

const STATUS_COLORS: Record<string, string> = {
    active: 'bg-emerald-100 text-emerald-700',
    inactive: 'bg-red-100 text-red-700',
    probation: 'bg-amber-100 text-amber-700',
};

const getStatusColor = (s: string | null) =>
    STATUS_COLORS[(s || '').toLowerCase()] || 'bg-gray-100 text-gray-600';

type MenuTab = 'asset' | 'computer';

const MENU_ITEMS: { key: MenuTab; label: string; icon: React.ElementType; description: string }[] = [
    { key: 'computer', label: 'Computer', icon: Monitor, description: 'อุปกรณ์คอมพิวเตอร์ที่ได้รับ' },
    { key: 'asset', label: 'Asset', icon: Package, description: 'จัดการทรัพย์สินของพนักงาน' },
];

// ── Sidebar info fields config ──
type OptionKey = 'employee_status' | 'sites' | 'positions';

interface InfoField {
    label: string;
    /** Field shown in view mode (a joined label such as `department`) */
    field: keyof UserData;
    /** Field actually written on save — defaults to `field`. e.g. `department_id` */
    editField?: keyof UserData;
    icon: LucideIcon;
    /** 'dropdown' uses Popover/Command; 'input' uses text input; 'readonly' is never editable;
     *  'org' is the สายงาน → ฝ่าย → แผนก picker writing department_id */
    editType: 'input' | 'dropdown' | 'readonly' | 'org';
    optionKey?: OptionKey;
}

const STATUS_OPTIONS = [
    { option_value: 'Active', option_label: 'Active' },
    { option_value: 'Inactive', option_label: 'Inactive' }
];

const INFO_FIELDS: InfoField[] = [
    // employee_id keys the PUT /users/{employee_id} route — it cannot be changed here
    { label: 'รหัสพนง.', field: 'employee_id', icon: IdCard, editType: 'readonly' },
    { label: 'ชื่อ', field: 'firstname', icon: User, editType: 'input' },
    { label: 'นามสกุล', field: 'lastname', icon: User, editType: 'input' },
    { label: 'สถานะ', field: 'employee_status', icon: BadgeCheck, editType: 'dropdown', optionKey: 'employee_status' },
    { label: 'อีเมล', field: 'email', icon: Mail, editType: 'input' },
    { label: 'สังกัด', field: 'department', editField: 'department_id', icon: Building, editType: 'org' },
    { label: 'สถานที่', field: 'site', editField: 'site_id', icon: MapPin, editType: 'dropdown', optionKey: 'sites' },
    { label: 'ตำแหน่ง', field: 'position', editField: 'position_id', icon: Briefcase, editType: 'dropdown', optionKey: 'positions' },
    // ระดับ is derived from the selected ตำแหน่ง on the backend
    { label: 'ระดับ', field: 'position_level', icon: Shield, editType: 'readonly' },
];

// ── Compact info row (view mode) ──
const InfoRow = memo(({ icon: Icon, label, value }: {
    icon: LucideIcon; label: string; value: string;
}) => (
    <div className="flex items-center py-1.5">
        <Icon className="w-3.5 h-3.5 mr-2 text-gray-400 shrink-0" />
        <span className="text-[11px] text-gray-400 w-14 shrink-0">{label}</span>
        <span className="text-xs text-gray-700 truncate" title={value}>{value || '-'}</span>
    </div>
));
InfoRow.displayName = 'InfoRow';

// ── Compact edit row (input) ──
const EditRow = memo(({ icon: Icon, label, value, onChange }: {
    icon: LucideIcon; label: string; value: string;
    onChange: (v: string) => void;
}) => (
    <div className="space-y-1 py-1">
        <label className="text-[11px] text-gray-400 flex items-center gap-1.5">
            <Icon className="w-3.5 h-3.5 text-brand-600" />
            {label}
        </label>
        <Input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="h-8 text-xs bg-white border-gray-200 focus:border-brand-600 px-2.5 rounded-lg"
        />
    </div>
));
EditRow.displayName = 'EditRow';

// ── Compact edit row (dropdown) ──
const DropdownEditRow = memo(({ icon: Icon, label, value, options, onChange }: {
    icon: LucideIcon; label: string; value: string;
    options: { option_value: string; option_label: string }[];
    onChange: (v: string) => void;
}) => {
    const [open, setOpen] = useState(false);
    const selectedLabel = options.find(o => o.option_value === value)?.option_label ?? '';
    return (
        <div className="space-y-1 py-1">
            <label className="text-[11px] text-gray-400 flex items-center gap-1.5">
                <Icon className="w-3.5 h-3.5 text-brand-600" />
                {label}
            </label>
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <button
                        type="button"
                        className={cn(
                            'flex items-center justify-between w-full h-8 px-2.5 text-xs rounded-lg border bg-white transition-colors cursor-pointer',
                            'border-gray-200 hover:border-brand-600/40 focus:border-brand-600',
                            !selectedLabel && 'text-gray-400',
                        )}
                    >
                        <span className="truncate">{selectedLabel || '-- เลือก --'}</span>
                        <ChevronsUpDown className="w-3 h-3 text-gray-400 shrink-0 ml-1" />
                    </button>
                </PopoverTrigger>
                <PopoverContent className="w-52 p-0 rounded-lg border shadow-lg" align="start" side="right">
                    <Command>
                        <CommandInput placeholder="ค้นหา..." className="h-8 text-xs" />
                        <CommandList className="max-h-48">
                            <CommandEmpty className="py-3 text-center text-xs text-gray-400">ไม่พบรายการ</CommandEmpty>
                            <CommandGroup>
                                {options.map(opt => (
                                    <CommandItem
                                        key={opt.option_value}
                                        value={opt.option_label}
                                        onSelect={() => { onChange(opt.option_value); setOpen(false); }}
                                        className="text-xs cursor-pointer"
                                    >
                                        <Check className={cn('w-3 h-3 mr-1.5', value === opt.option_value ? 'opacity-100 text-brand-600' : 'opacity-0')} />
                                        {opt.option_label}
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                        </CommandList>
                    </Command>
                </PopoverContent>
            </Popover>
        </div>
    );
});
DropdownEditRow.displayName = 'DropdownEditRow';

// ── สายงาน / ฝ่าย / แผนก rows (view mode) ──
const OrgInfoRows = memo(({ user, org }: { user: UserData; org: OrgIndex }) => {
    const placed = placeDepartment(org, user.department_id);
    // Fall back to the joined labels on the user row while the tree is still loading
    const path = placed ? placed.path?.path_th : user.path?.path_th;
    const division = placed ? divisionLabel(placed.division) : (user.division?.division_th || user.division?.division_eng);
    const department = placed ? departmentLabel(placed.department) : user.department;
    return (
        <>
            <InfoRow icon={Route} label="สายงาน" value={path || ''} />
            <InfoRow icon={Network} label="ฝ่าย" value={division || ''} />
            <InfoRow icon={Building} label="แผนก" value={department || ''} />
        </>
    );
});
OrgInfoRows.displayName = 'OrgInfoRows';

// ── Heads-up when the แผนก changes: department_id drives approvers and finance access ──
const MoveNotice = memo(({ from, to }: { from: OrgPlacement | null; to: OrgPlacement | null }) => {
    if (!to || from?.department.department_id === to.department.department_id) return null;
    const crossDivision = from?.division?.division_id !== to.division?.division_id;
    return (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2 text-[11px] text-amber-800 space-y-1">
            <p className="font-semibold">{crossDivision ? 'ย้ายฝ่าย' : 'ย้ายแผนก'}</p>
            <p className="flex flex-wrap items-center gap-1">
                <span>{from ? departmentLabel(from.department) : 'ไม่ระบุแผนก'}</span>
                <ArrowRight className="w-3 h-3 shrink-0" />
                <span className="font-medium">{departmentLabel(to.department)}</span>
            </p>
            <p className="text-amber-700/80">
                มีผลกับผู้อนุมัติฟอร์ม/ADV และสิทธิ์ตามแผนก (เช่น การเงิน) พนักงานจะเห็นสังกัดใหม่ตอนเปิดแอปครั้งถัดไป
            </p>
        </div>
    );
});
MoveNotice.displayName = 'MoveNotice';

export const UserDetailSheet = memo(({ user, open, onOpenChange, onUpdate, lookups, org, onDepartmentCreated }: UserDetailSheetProps) => {
    const { user: sessionUser } = useSessionContext();
    const employeeId = sessionUser?.employee_id ?? null;
    const role = sessionUser?.role ?? null;

    const [activeTab, setActiveTab] = useState<MenuTab | null>('computer');
    const [isEditing, setIsEditing] = useState(false);
    const [editData, setEditData] = useState<Partial<UserData>>({});
    const [isSaving, setIsSaving] = useState(false);
    const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');

    // Dropdown options come from the org lookup endpoints so we edit real ids, not labels
    const dropdownOptions: Record<OptionKey, { option_value: string; option_label: string }[]> = useMemo(() => ({
        employee_status: STATUS_OPTIONS,
        sites: lookups?.sites ?? [],
        positions: lookups?.positions ?? [],
    }), [lookups]);

    const handleFieldChange = useCallback((field: keyof UserData, value: string) => {
        // *_id columns are numeric on the API — send numbers, not label strings
        const next = field.endsWith('_id') && field !== 'employee_id'
            ? (value === '' ? null : Number(value))
            : value;
        setEditData(prev => ({ ...prev, [field]: next }));
    }, []);

    const handleStartEdit = useCallback(() => {
        setEditData({});
        setSaveStatus('idle');
        setIsEditing(true);
    }, []);

    const handleCancel = useCallback(() => {
        setEditData({});
        setIsEditing(false);
        setSaveStatus('idle');
    }, []);

    const handleSave = useCallback(async () => {
        if (!onUpdate || !user) return;
        setIsSaving(true);
        setSaveStatus('idle');
        try {
            const merged = { ...user, ...editData } as UserData;
            const ok = await onUpdate(merged);
            if (ok) {
                setSaveStatus('success');
                setIsEditing(false);
                setEditData({});
                setTimeout(() => setSaveStatus('idle'), 3000);
            } else {
                setSaveStatus('error');
            }
        } catch {
            setSaveStatus('error');
        } finally {
            setIsSaving(false);
        }
    }, [onUpdate, user, editData]);

    const getValue = useCallback((field: keyof UserData) => {
        const v = field in editData ? editData[field] : user?.[field];
        return v === null || v === undefined ? '' : String(v);
    }, [editData, user]);

    if (!user) return null;

    const isDirty = Object.keys(editData).length > 0;
    const missingDepartment = 'department_id' in editData && editData.department_id == null;

    return (
        <Dialog open={open} onOpenChange={(v) => { if (!v) { setIsEditing(false); setEditData({}); setSaveStatus('idle'); } onOpenChange(v); }}>
            <DialogContent
                showCloseButton
                className="max-w-5xl w-[95vw] h-[85vh] p-0 flex flex-col overflow-hidden"
            >
                {/* ── Header ── */}
                <DialogHeader className="bg-linear-to-br from-brand-600 to-brand-500 px-6 pt-5 pb-4 space-y-2 rounded-t-lg shrink-0">
                    <div className="flex items-center gap-3">
                        <UserAvatar
                            imageUrl={user.image_url}
                            name={`${user.firstname ?? ''} ${user.lastname ?? ''}`}
                            email={user.email}
                            className="w-11 h-11"
                            rounded="rounded-xl"
                            fallbackClassName="bg-white/15 backdrop-blur text-white"
                            textClassName="text-sm font-bold"
                        />
                        <div className="min-w-0 flex-1">
                            <DialogTitle className="text-white text-base font-bold truncate">
                                {user.firstname} {user.lastname}
                            </DialogTitle>
                            <DialogDescription className="text-white/60 text-xs truncate mt-0.5">
                                {user.email}
                            </DialogDescription>
                        </div>
                        <div className="flex flex-wrap gap-1.5 shrink-0">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/10 text-white/80 text-[11px] font-medium">
                                <BadgeCheck className="w-3 h-3" />
                                {user.employee_id}
                            </span>
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium ${getStatusColor(user.employee_status)}`}>
                                {user.employee_status || '-'}
                            </span>
                        </div>
                    </div>
                </DialogHeader>

                {/* ── Body: Sidebar + Content ── */}
                <div className="flex flex-1 min-h-0">

                    {/* Left sidebar — Compact Profile */}
                    <aside className="w-70 shrink-0 border-r border-gray-200 flex flex-col bg-gray-50/40">
                        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
                            ข้อมูลพนักงาน

                            {/* Divider */}
                            <div className="border-t border-gray-100" />

                            {/* Info rows */}
                            <div>
                                {INFO_FIELDS.map(({ label, field, editField, icon, editType, optionKey }) => {
                                    const target = editField ?? field;
                                    if (editType === 'org') {
                                        return isEditing ? (
                                            <div key={field} className="py-1.5 space-y-2">
                                                <OrgPicker
                                                    org={org}
                                                    size="sm"
                                                    value={getValue(target)}
                                                    onChange={(v) => handleFieldChange(target, v)}
                                                    onDepartmentCreated={onDepartmentCreated}
                                                    error={getValue(target) === ''}
                                                />
                                                <MoveNotice
                                                    from={placeDepartment(org, user.department_id)}
                                                    to={placeDepartment(org, getValue(target))}
                                                />
                                            </div>
                                        ) : (
                                            <OrgInfoRows key={field} user={user} org={org} />
                                        );
                                    }
                                    if (!isEditing || editType === 'readonly') {
                                        return (
                                            <InfoRow
                                                key={field}
                                                icon={icon}
                                                label={label}
                                                value={String(user[field] ?? '')}
                                            />
                                        );
                                    }
                                    return editType === 'dropdown' ? (
                                        <DropdownEditRow
                                            key={field}
                                            icon={icon}
                                            label={label}
                                            value={getValue(target)}
                                            options={optionKey ? dropdownOptions[optionKey] : []}
                                            onChange={(v) => handleFieldChange(target, v)}
                                        />
                                    ) : (
                                        <EditRow
                                            key={field}
                                            icon={icon}
                                            label={label}
                                            value={getValue(target)}
                                            onChange={(v) => handleFieldChange(target, v)}
                                        />
                                    );
                                })}
                            </div>

                            {/* Save status feedback */}
                            {saveStatus === 'success' && (
                                <div className="flex items-center gap-1.5 text-emerald-600 text-xs px-1">
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    บันทึกสำเร็จ
                                </div>
                            )}
                            {saveStatus === 'error' && (
                                <div className="flex items-center gap-1.5 text-red-500 text-xs px-1">
                                    <AlertCircle className="w-3.5 h-3.5" />
                                    บันทึกไม่สำเร็จ
                                </div>
                            )}
                        </div>

                        {/* Bottom action bar */}
                        {onUpdate && role == 'a' && (
                            <div className="border-t border-gray-100 px-4 py-2.5 shrink-0">
                                {isEditing ? (
                                    <div className="flex gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={handleCancel}
                                            disabled={isSaving}
                                            className="flex-1 h-8 text-xs cursor-pointer"
                                        >
                                            <X className="w-3.5 h-3.5 mr-1" />
                                            ยกเลิก
                                        </Button>
                                        <Button
                                            size="sm"
                                            onClick={handleSave}
                                            disabled={isSaving || !isDirty || missingDepartment}
                                            className="flex-1 h-8 text-xs bg-brand-600 hover:bg-brand-700 text-white cursor-pointer"
                                        >
                                            {isSaving ? (
                                                <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                                            ) : (
                                                <Save className="w-3.5 h-3.5 mr-1" />
                                            )}
                                            {isSaving ? 'กำลังบันทึก...' : 'บันทึก'}
                                        </Button>
                                    </div>
                                ) : (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={handleStartEdit}
                                        className="w-full h-8 text-xs text-brand-600 border-brand-600/30 hover:bg-brand-600/5 cursor-pointer"
                                    >
                                        <Pencil className="w-3.5 h-3.5 mr-1.5" />
                                        แก้ไขข้อมูล
                                    </Button>
                                )}
                            </div>
                        )}

                        <div className="border-t border-gray-100 px-4 py-1.5">
                            <p className="text-[10px] text-gray-300 text-center">
                                ID: {user.id} · {user.username}
                            </p>
                        </div>
                    </aside>

                    {/* Right content area */}
                    <main className="flex-1 min-w-0 flex flex-col overflow-y-auto">
                        {/* Menu buttons */}
                        <div className="px-6 pt-5 pb-4 border-b border-gray-100">
                            <h3 className="text-sm font-semibold text-gray-700 mb-3">เมนู</h3>
                            <div className="flex gap-2">
                                {MENU_ITEMS.map(({ key, label, icon: Icon }) => (
                                    <button
                                        key={key}
                                        type="button"
                                        onClick={() => setActiveTab(key)}
                                        className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-150 cursor-pointer ${activeTab === key
                                            ? 'bg-brand-600 text-white shadow-md'
                                            : 'bg-white border border-gray-200 text-gray-600 hover:border-brand-600/40 hover:text-brand-600'
                                            }`}
                                    >
                                        <Icon className="w-4 h-4" />
                                        {label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Content area */}
                        <div className="flex-1 px-6 py-5">

                            {activeTab === 'asset' && (
                                <div className="space-y-4">
                                    <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-8 text-center">
                                        <Package className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                                        <p className="text-sm text-gray-500">เนื้อหา Asset ได้ที่นี่</p>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'computer' && (
                                <div className="space-y-4">
                                    <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-8 text-center">
                                        <Monitor className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                                        <p className="text-sm text-gray-500">เนื้อหา Computer ได้ที่นี่</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </main>
                </div>
            </DialogContent>
        </Dialog>
    );
});
UserDetailSheet.displayName = 'UserDetailSheet';
