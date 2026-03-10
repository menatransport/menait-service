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
    AlertCircle, User, IdCard, ChevronsUpDown, Check, type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { UserData } from '@/components/profile-form';
import { useSessionContext } from '@/app/context/SessionContext';

interface UserDetailSheetProps {
    user: UserData | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onUpdate?: (data: UserData) => Promise<boolean>;
    /** All users — used to derive dropdown options */
    allUsers?: UserData[];
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
interface InfoField {
    label: string;
    field: keyof UserData;
    icon: LucideIcon;
    editable: boolean;
    /** 'dropdown' uses Popover/Command; 'input' uses text input */
    editType: 'input' | 'dropdown';
}

const STATUS_OPTIONS = [
    { option_value: 'Active', option_label: 'Active' },
    { option_value: 'Inactive', option_label: 'Inactive' },
    { option_value: 'Probation', option_label: 'Probation' },
];

const INFO_FIELDS: InfoField[] = [
    { label: 'รหัสพนง.', field: 'employee_id', icon: IdCard, editable: true, editType: 'input' },
    { label: 'ชื่อ', field: 'firstname', icon: User, editable: true, editType: 'input' },
    { label: 'นามสกุล', field: 'lastname', icon: User, editable: true, editType: 'input' },
    { label: 'สถานะ', field: 'employee_status', icon: BadgeCheck, editable: true, editType: 'dropdown' },
    { label: 'อีเมล', field: 'email', icon: Mail, editable: true, editType: 'input' },
    { label: 'แผนก', field: 'department', icon: Building, editable: true, editType: 'dropdown' },
    { label: 'สถานที่', field: 'site', icon: MapPin, editable: true, editType: 'dropdown' },
    { label: 'ตำแหน่ง', field: 'position', icon: Briefcase, editable: true, editType: 'dropdown' },
    { label: 'ระดับ', field: 'position_level', icon: Shield, editable: true, editType: 'dropdown' },
];

/** Build unique sorted options from all users for a given field */
function buildOptions(users: UserData[], field: keyof UserData) {
    const set = new Set<string>();
    for (const u of users) {
        const v = u[field];
        if (v != null && String(v).trim()) set.add(String(v).trim());
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'th'))
        .map(v => ({ option_value: v, option_label: v }));
}

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
            <Icon className="w-3.5 h-3.5 text-[#026a75]" />
            {label}
        </label>
        <Input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="h-8 text-xs bg-white border-gray-200 focus:border-[#026a75] px-2.5 rounded-lg"
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
    return (
        <div className="space-y-1 py-1">
            <label className="text-[11px] text-gray-400 flex items-center gap-1.5">
                <Icon className="w-3.5 h-3.5 text-[#026a75]" />
                {label}
            </label>
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <button
                        type="button"
                        className={cn(
                            'flex items-center justify-between w-full h-8 px-2.5 text-xs rounded-lg border bg-white transition-colors cursor-pointer',
                            'border-gray-200 hover:border-[#026a75]/40 focus:border-[#026a75]',
                            !value && 'text-gray-400',
                        )}
                    >
                        <span className="truncate">{value || '-- เลือก --'}</span>
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
                                        <Check className={cn('w-3 h-3 mr-1.5', value === opt.option_value ? 'opacity-100 text-[#026a75]' : 'opacity-0')} />
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

export const UserDetailSheet = memo(({ user, open, onOpenChange, onUpdate, allUsers = [] }: UserDetailSheetProps) => {
    const { user: sessionUser } = useSessionContext();
    const employeeId = sessionUser?.employee_id ?? null;
    const role = sessionUser?.role ?? null;

    const [activeTab, setActiveTab] = useState<MenuTab | null>('computer');
    const [isEditing, setIsEditing] = useState(false);
    const [editData, setEditData] = useState<Partial<UserData>>({});
    const [isSaving, setIsSaving] = useState(false);
    const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');

    // Derive dropdown options from all users
    const dropdownOptions = useMemo(() => ({
        employee_status: STATUS_OPTIONS,
        department: buildOptions(allUsers, 'department'),
        site: buildOptions(allUsers, 'site'),
        position: buildOptions(allUsers, 'position'),
        position_level: buildOptions(allUsers, 'position_level'),
    }), [allUsers]);

    const handleFieldChange = useCallback((field: keyof UserData, value: string) => {
        setEditData(prev => ({ ...prev, [field]: value }));
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
        if (field in editData) return String(editData[field]);
        return String(user?.[field] ?? '');
    }, [editData, user]);

    if (!user) return null;

    const isDirty = Object.keys(editData).length > 0;

    return (
        <Dialog open={open} onOpenChange={(v) => { if (!v) { setIsEditing(false); setEditData({}); setSaveStatus('idle'); } onOpenChange(v); }}>
            <DialogContent
                showCloseButton
                className="max-w-5xl w-[95vw] h-[85vh] p-0 flex flex-col overflow-hidden"
            >
                {/* ── Header ── */}
                <DialogHeader className="bg-linear-to-br from-[#026a75] to-[#037a86] px-6 pt-5 pb-4 space-y-2 rounded-t-lg shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-11 h-11 bg-white/15 backdrop-blur rounded-xl flex items-center justify-center text-white text-sm font-bold shrink-0">
                            {user.email?.charAt(0).toUpperCase()}{user.email?.charAt(user.email.indexOf('@') - 1).toUpperCase()}
                        </div>
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
                                {INFO_FIELDS.map(({ label, field, icon, editable, editType }) =>
                                    isEditing && editable ? (
                                        editType === 'dropdown' ? (
                                            <DropdownEditRow
                                                key={field}
                                                icon={icon}
                                                label={label}
                                                value={getValue(field)}
                                                options={dropdownOptions[field as keyof typeof dropdownOptions] ?? []}
                                                onChange={(v) => handleFieldChange(field, v)}
                                            />
                                        ) : (
                                            <EditRow
                                                key={field}
                                                icon={icon}
                                                label={label}
                                                value={getValue(field)}
                                                onChange={(v) => handleFieldChange(field, v)}
                                            />
                                        )
                                    ) : (
                                        <InfoRow
                                            key={field}
                                            icon={icon}
                                            label={label}
                                            value={String(user[field] ?? '')}
                                        />
                                    )
                                )}
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
                                            disabled={isSaving || !isDirty}
                                            className="flex-1 h-8 text-xs bg-[#026a75] hover:bg-[#025f68] text-white cursor-pointer"
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
                                        className="w-full h-8 text-xs text-[#026a75] border-[#026a75]/30 hover:bg-[#026a75]/5 cursor-pointer"
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
                                            ? 'bg-[#026a75] text-white shadow-md'
                                            : 'bg-white border border-gray-200 text-gray-600 hover:border-[#026a75]/40 hover:text-[#026a75]'
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
