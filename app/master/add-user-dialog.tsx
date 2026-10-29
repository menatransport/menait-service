'use client';

import React, { useState, useCallback, useMemo, memo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle,
    DialogDescription, DialogFooter
} from '@/components/ui/dialog';
import {
    User, Mail, MapPin, Briefcase, AtSign, KeyRound,
    IdCard, Loader2, UserPlus, Plus, type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { AddPositionDialog } from './add-position-dialog';
import { OrgPicker, OrgSelect } from './org-picker';
import type { OrgIndex, OrgDepartment } from './org-structure';
import type { LookupOption, MasterLookups, UserData } from './types';
import type { UserCreate } from '@/components/profile-form';

interface AddUserDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** Resolves true on success, or an error message to show */
    onAdd: (user: Omit<UserCreate, 'id'>) => Promise<true | string>;
    org: OrgIndex;
    lookups?: MasterLookups;
    /** Active users — used to catch a duplicate รหัสพนักงาน/อีเมล before the round trip */
    existingUsers: UserData[];
    onDepartmentCreated?: (department: OrgDepartment) => void;
}

type FormKey = 'employee_id' | 'firstname' | 'lastname' | 'email' | 'username' | 'department_id' | 'site_id' | 'position_id';
type FormState = Record<FormKey, string>;

const INITIAL_FORM: FormState = {
    employee_id: '',
    firstname: '',
    lastname: '',
    email: '',
    username: '',
    department_id: '',
    site_id: '',
    position_id: '',
};

const REQUIRED: { key: FormKey; label: string }[] = [
    { key: 'employee_id', label: 'รหัสพนักงาน' },
    { key: 'firstname', label: 'ชื่อ' },
    { key: 'lastname', label: 'นามสกุล' },
    { key: 'email', label: 'อีเมล' },
    { key: 'username', label: 'ชื่อผู้ใช้' },
    { key: 'department_id', label: 'แผนก' },
    { key: 'position_id', label: 'ตำแหน่ง' },
    { key: 'site_id', label: 'สถานที่ปฏิบัติงาน' },
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Must match the password page.tsx sets on create */
const defaultPassword = (employeeId: string) => 'Mnt@' + employeeId.slice(-4);

const INPUT_CLS = 'h-10 text-sm rounded-lg bg-white border-gray-200 focus:ring-brand-600 focus:border-brand-600';

const Section = ({ step, title, children }: { step: number; title: string; children: React.ReactNode }) => (
    <section className="space-y-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-700">
            <span className="flex items-center justify-center w-5 h-5 rounded-full bg-brand-600/10 text-brand-700 text-[11px] font-bold">{step}</span>
            {title}
        </h3>
        {children}
    </section>
);

const Field = ({ icon: Icon, label, required, error, hint, action, children }: {
    icon: LucideIcon; label: string; required?: boolean; error?: string | null; hint?: React.ReactNode;
    action?: React.ReactNode; children: React.ReactNode;
}) => (
    <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2 min-h-5">
            <Label className="text-xs font-medium text-gray-600 flex items-center gap-1.5">
                <Icon className="w-3.5 h-3.5 text-brand-600" />
                {label} {required && <span className="text-red-400">*</span>}
            </Label>
            {action}
        </div>
        {children}
        {error ? <p className="text-[11px] text-red-500">{error}</p> : hint && <p className="text-[11px] text-gray-400">{hint}</p>}
    </div>
);

export const AddUserDialog = memo(({
    open, onOpenChange, onAdd, org, lookups, existingUsers, onDepartmentCreated,
}: AddUserDialogProps) => {
    const [form, setForm] = useState<FormState>(INITIAL_FORM);
    // username follows the email's local part until it is typed by hand
    const [usernameTouched, setUsernameTouched] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showAddPosition, setShowAddPosition] = useState(false);
    const [extraPositions, setExtraPositions] = useState<LookupOption[]>([]);

    const positionOptions = useMemo(() => {
        const base = lookups?.positions ?? [];
        const known = new Set(base.map(p => p.option_value));
        return [...base, ...extraPositions.filter(p => !known.has(p.option_value))]
            .sort((a, b) => a.option_label.localeCompare(b.option_label, 'th'))
            .map(p => ({ value: p.option_value, label: p.option_label }));
    }, [lookups?.positions, extraPositions]);

    const siteOptions = useMemo(
        () => (lookups?.sites ?? []).map(s => ({ value: s.option_value, label: s.option_label })),
        [lookups?.sites]
    );

    const taken = useMemo(() => {
        const ids = new Set<string>(), emails = new Set<string>(), usernames = new Set<string>();
        for (const u of existingUsers) {
            if (u.employee_id) ids.add(u.employee_id.trim());
            if (u.email) emails.add(u.email.trim().toLowerCase());
            if (u.username) usernames.add(u.username.trim().toLowerCase());
        }
        return { ids, emails, usernames };
    }, [existingUsers]);

    const fieldErrors = useMemo(() => {
        const e: Partial<Record<FormKey, string>> = {};
        const id = form.employee_id.trim();
        const email = form.email.trim().toLowerCase();
        const username = form.username.trim().toLowerCase();
        if (id && !/^\d+$/.test(id)) e.employee_id = 'ใช้ตัวเลขเท่านั้น';
        else if (taken.ids.has(id)) e.employee_id = 'รหัสพนักงานนี้มีในระบบแล้ว';
        if (email && !EMAIL_RE.test(email)) e.email = 'รูปแบบอีเมลไม่ถูกต้อง';
        else if (taken.emails.has(email)) e.email = 'อีเมลนี้มีในระบบแล้ว';
        if (username && taken.usernames.has(username)) e.username = 'ชื่อผู้ใช้นี้มีในระบบแล้ว';
        if (submitted) {
            for (const f of REQUIRED) if (!form[f.key].trim() && !e[f.key]) e[f.key] = `กรุณาระบุ${f.label}`;
        }
        return e;
    }, [form, taken, submitted]);

    const set = useCallback((key: FormKey, value: string) => {
        setForm(prev => ({ ...prev, [key]: value }));
        setError(null);
    }, []);

    const handleEmail = useCallback((value: string) => {
        setForm(prev => ({
            ...prev,
            email: value,
            username: usernameTouched ? prev.username : value.split('@')[0].trim(),
        }));
        setError(null);
    }, [usernameTouched]);

    const handleUsername = useCallback((value: string) => {
        setUsernameTouched(value !== '');
        set('username', value);
    }, [set]);

    const handlePositionAdded = useCallback((option: LookupOption) => {
        setExtraPositions(prev => [...prev, option]);
        set('position_id', option.option_value);
    }, [set]);

    const reset = useCallback(() => {
        setForm(INITIAL_FORM);
        setUsernameTouched(false);
        setSubmitted(false);
        setError(null);
    }, []);

    const handleClose = useCallback((isOpen: boolean) => {
        if (!isOpen && !saving) reset();
        if (!saving) onOpenChange(isOpen);
    }, [onOpenChange, reset, saving]);

    const handleSubmit = useCallback(async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitted(true);
        const missing = REQUIRED.filter(f => !form[f.key].trim());
        if (missing.length > 0 || Object.keys(fieldErrors).length > 0) {
            setError(missing.length > 0
                ? `กรุณากรอก: ${missing.map(f => f.label).join(', ')}`
                : 'กรุณาแก้ไขช่องที่มีข้อผิดพลาด');
            return;
        }

        setSaving(true);
        setError(null);
        try {
            const result = await onAdd({
                employee_id: form.employee_id.trim(),
                firstname: form.firstname.trim(),
                lastname: form.lastname.trim(),
                email: form.email.trim().toLowerCase(),
                username: form.username.trim(),
                department_id: Number(form.department_id),
                site_id: Number(form.site_id),
                position_id: Number(form.position_id),
                employee_status: 'Active',
                password: defaultPassword(form.employee_id.trim()),
            });
            if (result === true) {
                reset();
                onOpenChange(false);
            } else {
                setError(result);
            }
        } catch {
            setError('เกิดข้อผิดพลาด กรุณาลองใหม่');
        } finally {
            setSaving(false);
        }
    }, [form, fieldErrors, onAdd, onOpenChange, reset]);

    const employeeId = form.employee_id.trim();

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-brand-600">
                        <UserPlus className="w-5 h-5" />
                        เพิ่มพนักงานใหม่
                    </DialogTitle>
                    <DialogDescription>
                        กรอกข้อมูลพนักงาน สังกัด และตำแหน่ง — ฝ่ายกับสายงานผูกตามแผนกที่เลือก
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-6 mt-2" noValidate>
                    <Section step={1} title="ข้อมูลพนักงาน">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <Field icon={IdCard} label="รหัสพนักงาน" required error={fieldErrors.employee_id}>
                                <Input
                                    value={form.employee_id}
                                    onChange={e => set('employee_id', e.target.value)}
                                    inputMode="numeric"
                                    placeholder="เช่น 690338"
                                    className={cn(INPUT_CLS, fieldErrors.employee_id && 'border-red-300')}
                                    autoFocus
                                />
                            </Field>
                            <Field icon={User} label="ชื่อ" required error={fieldErrors.firstname}>
                                <Input
                                    value={form.firstname}
                                    onChange={e => set('firstname', e.target.value)}
                                    className={cn(INPUT_CLS, fieldErrors.firstname && 'border-red-300')}
                                />
                            </Field>
                            <Field icon={User} label="นามสกุล" required error={fieldErrors.lastname}>
                                <Input
                                    value={form.lastname}
                                    onChange={e => set('lastname', e.target.value)}
                                    className={cn(INPUT_CLS, fieldErrors.lastname && 'border-red-300')}
                                />
                            </Field>
                        </div>
                    </Section>

                    <Section step={2} title="บัญชีเข้าระบบ">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <Field icon={Mail} label="อีเมล" required error={fieldErrors.email}>
                                <Input
                                    type="email"
                                    value={form.email}
                                    onChange={e => handleEmail(e.target.value)}
                                    placeholder="name.x@menatransport.co.th"
                                    className={cn(INPUT_CLS, fieldErrors.email && 'border-red-300')}
                                />
                            </Field>
                            <Field
                                icon={AtSign}
                                label="ชื่อผู้ใช้"
                                required
                                error={fieldErrors.username}
                                hint={!usernameTouched && form.username ? 'เติมจากอีเมลให้อัตโนมัติ แก้ได้' : undefined}
                            >
                                <Input
                                    value={form.username}
                                    onChange={e => handleUsername(e.target.value)}
                                    className={cn(INPUT_CLS, fieldErrors.username && 'border-red-300')}
                                />
                            </Field>
                        </div>
                        <p className="flex items-center gap-1.5 text-[11px] text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
                            <KeyRound className="w-3.5 h-3.5 text-brand-600 shrink-0" />
                            รหัสผ่านเริ่มต้น:
                            <code className="font-mono text-gray-700">{employeeId.length >= 4 ? defaultPassword(employeeId) : 'Mnt@ + 4 ตัวท้ายรหัสพนักงาน'}</code>
                        </p>
                    </Section>

                    <Section step={3} title="สังกัด">
                        <OrgPicker
                            org={org}
                            value={form.department_id}
                            onChange={v => set('department_id', v)}
                            onDepartmentCreated={onDepartmentCreated}
                            error={!!fieldErrors.department_id}
                        />
                        {fieldErrors.department_id && <p className="text-[11px] text-red-500">{fieldErrors.department_id}</p>}
                    </Section>

                    <Section step={4} title="ตำแหน่งและสถานที่">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <Field
                                icon={Briefcase}
                                label="ตำแหน่ง"
                                required
                                error={fieldErrors.position_id}
                                hint="ระดับ (level) มาจากตำแหน่ง"
                                action={
                                    <button
                                        type="button"
                                        onClick={() => setShowAddPosition(true)}
                                        className="flex items-center gap-0.5 text-[11px] font-medium text-brand-600 hover:text-brand-800 cursor-pointer"
                                    >
                                        <Plus className="w-3 h-3" />
                                        เพิ่มตำแหน่ง
                                    </button>
                                }
                            >
                                <OrgSelect
                                    value={form.position_id}
                                    onChange={v => set('position_id', v)}
                                    options={positionOptions}
                                    placeholder="-- เลือกตำแหน่ง --"
                                    size="md"
                                    error={!!fieldErrors.position_id}
                                />
                            </Field>
                            <Field icon={MapPin} label="สถานที่ปฏิบัติงาน" required error={fieldErrors.site_id}>
                                <OrgSelect
                                    value={form.site_id}
                                    onChange={v => set('site_id', v)}
                                    options={siteOptions}
                                    placeholder="-- เลือกสถานที่ --"
                                    size="md"
                                    error={!!fieldErrors.site_id}
                                />
                            </Field>
                        </div>
                    </Section>

                    {error && (
                        <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-lg">
                            {error}
                        </p>
                    )}

                    <DialogFooter className="pt-2">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => handleClose(false)}
                            disabled={saving}
                            className="rounded-xl cursor-pointer"
                        >
                            ยกเลิก
                        </Button>
                        <Button
                            type="submit"
                            disabled={saving}
                            className="rounded-xl bg-brand-600 hover:bg-brand-800 text-white cursor-pointer"
                        >
                            {saving ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
                                    กำลังบันทึก...
                                </>
                            ) : (
                                <>
                                    <UserPlus className="w-4 h-4 mr-1.5" />
                                    เพิ่มพนักงาน
                                </>
                            )}
                        </Button>
                    </DialogFooter>
                </form>

                {/* Kept outside <form>: a portalled form's submit still bubbles through the React tree */}
                <AddPositionDialog
                    open={showAddPosition}
                    onOpenChange={setShowAddPosition}
                    onAdded={handlePositionAdded}
                />
            </DialogContent>
        </Dialog>
    );
});
AddUserDialog.displayName = 'AddUserDialog';
