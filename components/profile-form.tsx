'use client';

import React, { useState, useCallback, useMemo, memo } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
    User, Mail, Building, MapPin, Briefcase, Shield, Save,
    Loader2, IdCard, AlertCircle, CheckCircle2, type LucideIcon
} from 'lucide-react';

// ===================== SHARED TYPES =====================
export interface UserData {
    id: number;
    username: string;
    email: string;
    employee_id: string;
    employee_status: string | null;
    firstname: string;
    lastname: string;
    department: string;
    site: string;
    position: string;
    position_level: string;
}

// ===================== FIELD CONFIG (rendering-hoist-jsx) =====================
interface ProfileField {
    label: string;
    field: keyof UserData;
    Icon: LucideIcon;
    editable: boolean;
    group: 'personal' | 'work';
}

const PROFILE_FIELDS: ProfileField[] = [
    { label: 'ชื่อ', field: 'firstname', Icon: User, editable: true, group: 'personal' },
    { label: 'นามสกุล', field: 'lastname', Icon: User, editable: true, group: 'personal' },
    { label: 'อีเมล', field: 'email', Icon: Mail, editable: true, group: 'personal' },
    { label: 'แผนก', field: 'department', Icon: Building, editable: true, group: 'work' },
    { label: 'สถานที่ปฏิบัติงาน', field: 'site', Icon: MapPin, editable: true, group: 'work' },
    { label: 'ตำแหน่ง', field: 'position', Icon: Briefcase, editable: true, group: 'work' },
    { label: 'ระดับตำแหน่ง', field: 'position_level', Icon: Shield, editable: true, group: 'work' },
];

// ===================== PROPS =====================
export interface ProfileFormProps {
    /** The original user data (read source) */
    data: UserData;
    /** Whether editing is allowed */
    editable: boolean;
    /** Optional: show role label (for settings page) */
    role?: string | null;
    /** Layout variant */
    variant?: 'full' | 'compact';
    /** Called when save is triggered — receives merged data. Return a promise. */
    onSave?: (merged: UserData) => Promise<boolean>;
}

// ===================== SUB-COMPONENTS =====================

/** Section header with icon */
const SectionHeader = memo(({ icon: Icon, title, subtitle }: {
    icon: LucideIcon; title: string; subtitle: string;
}) => (
    <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 bg-linear-to-br from-[#026a75] to-[#03969a] rounded-lg flex items-center justify-center shadow-sm">
            <Icon className="w-4 h-4 text-white" />
        </div>
        <div>
            <h3 className="text-sm font-semibold text-[#055058]">{title}</h3>
            <p className="text-[11px] text-gray-400">{subtitle}</p>
        </div>
    </div>
));
SectionHeader.displayName = 'SectionHeader';

/** Single form field row */
const FormField = memo(({ label, icon: Icon, value, readonly, onChange }: {
    label: string; icon: LucideIcon; value: string; readonly: boolean;
    onChange?: (v: string) => void;
}) => (
    <div className="space-y-1.5">
        <Label className="text-xs text-gray-500 flex items-center gap-1.5">
            <Icon className="h-3.5 w-3.5" />
            {label}
        </Label>
        <Input
            value={value}
            onChange={onChange ? (e) => onChange(e.target.value) : undefined}
            readOnly={readonly}
            className={`text-sm transition-colors duration-200 ${readonly
                ? 'bg-gray-50/80'
                : 'bg-white hover:border-[#026a75]/40 focus:border-[#026a75]'
                }`}
        />
    </div>
));
FormField.displayName = 'FormField';

// ===================== MAIN COMPONENT =====================
export const ProfileForm = memo(({
    data, editable, role, variant = 'full', onSave,
}: ProfileFormProps) => {
    const [editData, setEditData] = useState<Partial<UserData>>({});
    const [isSaving, setIsSaving] = useState(false);
    const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');

    // Memoize field groups
    const { personalFields, workFields } = useMemo(() => ({
        personalFields: PROFILE_FIELDS.filter(f => f.group === 'personal'),
        workFields: PROFILE_FIELDS.filter(f => f.group === 'work'),
    }), []);

    const isDirty = useMemo(() => Object.keys(editData).length > 0, [editData]);

    const handleChange = useCallback((field: keyof UserData, value: string) => {
        setEditData(prev => ({ ...prev, [field]: value }));
        setSaveStatus('idle');
    }, []);

    const getValue = useCallback((field: keyof UserData) => {
        if (field in editData) return editData[field] as string;
        return data[field] ?? '';
    }, [editData, data]);

    const handleSubmit = useCallback(async () => {
        if (!editable || !isDirty || !onSave) return;
        setIsSaving(true);
        setSaveStatus('idle');
        try {
            const merged = { ...data, ...editData } as UserData;
            const ok = await onSave(merged);
            if (ok) {
                setSaveStatus('success');
                setEditData({});
                setTimeout(() => setSaveStatus('idle'), 4000);
            } else {
                setSaveStatus('error');
            }
        } catch {
            setSaveStatus('error');
        } finally {
            setIsSaving(false);
        }
    }, [editable, isDirty, onSave, data, editData]);

    const isCompact = variant === 'compact';
    const gridClass = isCompact ? 'grid grid-cols-1 gap-3' : 'grid grid-cols-1 sm:grid-cols-2 gap-4';

    return (
        <div className="space-y-6">

            {/* ── Non-admin notice ── */}
            {!editable && (
                <div className="flex items-start gap-3 rounded-xl bg-amber-50 border border-amber-200/60 px-4 py-3 text-amber-800">
                    <Shield className="h-4 w-4 shrink-0 mt-0.5 text-amber-500" />
                    <p className="text-xs leading-relaxed">
                        <span className="font-medium">สิทธิ์จำกัด — </span>
                        คุณไม่สามารถแก้ไขข้อมูลได้ หากต้องการเปลี่ยนแปลงกรุณาติดต่อ IT
                    </p>
                </div>
            )}

            {/* ── System Info ── */}
            <div className={isCompact ? 'pb-4 border-b border-gray-100' : 'pb-6 border-b border-gray-200'}>
                <SectionHeader
                    icon={IdCard}
                    title="ข้อมูลระบบ"
                    subtitle="รหัสพนักงาน ชื่อผู้ใช้ และสิทธิ์ (ไม่สามารถแก้ไขได้)"
                />
                <div className={isCompact ? 'grid grid-cols-1 gap-3' : 'grid grid-cols-1 sm:grid-cols-3 gap-4'}>
                    <FormField label="รหัสพนักงาน" icon={IdCard} value={String(data.employee_id)} readonly />
                    <FormField label="ชื่อผู้ใช้งาน" icon={User} value={String(data.username)} readonly />
                    {role !== undefined && (
                        <FormField label="สิทธิ์การใช้งาน (Role)" icon={Shield} value={role === 'a' ? 'Admin' : 'User'} readonly />
                    )}
                </div>
            </div>

            {/* ── Personal Info ── */}
            <div className={isCompact ? 'pb-4 border-b border-gray-100' : 'pb-6 border-b border-gray-200'}>
                <SectionHeader
                    icon={User}
                    title="ข้อมูลส่วนตัว"
                    subtitle={editable ? 'แก้ไขข้อมูลส่วนตัวของคุณได้ที่นี่' : 'ข้อมูลส่วนตัว (อ่านอย่างเดียว)'}
                />
                <div className={gridClass}>
                    {personalFields.map(({ label, field, Icon, editable: fieldEditable }) => (
                        <FormField
                            key={field}
                            label={label}
                            icon={Icon}
                            value={String(getValue(field))}
                            readonly={!editable || !fieldEditable}
                            onChange={editable && fieldEditable ? (v) => handleChange(field, v) : undefined}
                        />
                    ))}
                </div>
            </div>

            {/* ── Work Info ── */}
            <div>
                <SectionHeader
                    icon={Building}
                    title="ข้อมูลการทำงาน"
                    subtitle={editable ? 'แก้ไขข้อมูลตำแหน่งและสถานที่ทำงาน' : 'ข้อมูลการทำงาน (อ่านอย่างเดียว)'}
                />
                <div className={gridClass}>
                    {workFields.map(({ label, field, Icon, editable: fieldEditable }) => (
                        <FormField
                            key={field}
                            label={label}
                            icon={Icon}
                            value={String(getValue(field))}
                            readonly={!editable || !fieldEditable}
                            onChange={editable && fieldEditable ? (v) => handleChange(field, v) : undefined}
                        />
                    ))}
                </div>
            </div>

            {/* ── Save Bar ── */}
            {editable && onSave && (
                <div className="pt-4 border-t border-gray-200">
                    <div className={`flex items-center justify-between rounded-xl px-4 sm:px-5 py-3 sm:py-3.5 transition-all duration-300 ${isDirty
                        ? 'bg-[#f0fafa] border border-[#026a75]/20'
                        : 'bg-gray-50 border border-gray-200'
                        }`}>
                        <div className="flex items-center gap-2 min-w-0">
                            {saveStatus === 'success' && (
                                <div className="flex items-center gap-1.5 text-emerald-600">
                                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                                    <span className="text-sm font-medium truncate">บันทึกสำเร็จ</span>
                                </div>
                            )}
                            {saveStatus === 'error' && (
                                <div className="flex items-center gap-1.5 text-red-500">
                                    <AlertCircle className="h-4 w-4 shrink-0" />
                                    <span className="text-sm font-medium truncate">บันทึกไม่สำเร็จ</span>
                                </div>
                            )}
                            {saveStatus === 'idle' && isDirty && (
                                <span className="text-xs text-gray-500 truncate">มีข้อมูลที่ยังไม่ได้บันทึก</span>
                            )}
                            {saveStatus === 'idle' && !isDirty && (
                                <span className="text-xs text-gray-400 truncate">ไม่มีการเปลี่ยนแปลง</span>
                            )}
                        </div>

                        <Button
                            onClick={handleSubmit}
                            disabled={isSaving || !isDirty}
                            className={`shrink-0 h-10 sm:h-12 px-5 sm:px-7 font-semibold rounded-xl transition-all duration-300 ${isDirty
                                ? 'cursor-pointer bg-linear-to-r from-[#026a75] to-[#037a86] hover:from-[#025f68] hover:to-[#026a75] text-white shadow-lg hover:shadow-xl hover:scale-[1.02]'
                                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                }`}
                        >
                            {isSaving ? (
                                <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    กำลังบันทึก...
                                </>
                            ) : (
                                <>
                                    <Save className="h-4 w-4 mr-2" />
                                    บันทึกข้อมูล
                                </>
                            )}
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
});
ProfileForm.displayName = 'ProfileForm';
