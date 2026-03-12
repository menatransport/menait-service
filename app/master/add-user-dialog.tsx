'use client';

import React, { useState, useCallback, useMemo, memo, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle,
    DialogDescription, DialogFooter
} from '@/components/ui/dialog';
import {
    User, Mail, Building, MapPin, Briefcase,
    IdCard, Loader2, UserPlus
} from 'lucide-react';
import { DropdownSearch } from '@/components/ui/dropdown/issue';
import type { UserData } from './types';
import { UserCreate } from '@/components/profile-form';

interface AddUserDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onAdd: (user: Omit<UserCreate, 'id'>) => Promise<boolean>;
}

const INITIAL_FORM = {
    username: '',
    email: '',
    employee_id: '',
    firstname: '',
    lastname: '',
    department_id: 0,
    site_id: 0,
    position_id: 0,
    employee_status: 'Active',
    password: '',
};

interface Option {
    option_value: string
    option_label: string;
}

export const AddUserDialog = memo(({ open, onOpenChange, onAdd }: AddUserDialogProps) => {
    const [form, setForm] = useState(INITIAL_FORM);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [dropdownOptions, setDropdownOptions] = useState<{
        department: Option[];
        site: Option[];
        position: Option[];
    }>({
        department: [],
        site: [],
        position: [],
    });

    useEffect(() => {
        const fetchDropdownOptions = async () => {
            try {
                const [deptRes, siteRes, posRes] = await Promise.all([
                    fetch('/api/organization/departments'),
                    fetch('/api/organization/sites'),
                    fetch('/api/organization/positions'),
                ]);
                const [departments, sites, positions] = await Promise.all([
                    deptRes.json(),
                    siteRes.json(),
                    posRes.json(),
                ]);
                setDropdownOptions({
                    department: Array.isArray(departments) ? departments : [],
                    site: Array.isArray(sites) ? sites : [],
                    position: Array.isArray(positions) ? positions : [],
                });
            }
            catch (err) {
                console.error('Error fetching dropdown options:', err);
            }
        };
        fetchDropdownOptions();
    }, []);


    const handleChange = useCallback((key: string, value: string) => {
        setForm(prev => ({ ...prev, [key]: value }));
        setError(null);
    }, []);

    const handleClose = useCallback((isOpen: boolean) => {
        if (!isOpen) {
            setForm(INITIAL_FORM);
            setError(null);
        }
        onOpenChange(isOpen);
    }, [onOpenChange]);

    const handleSubmit = useCallback(async (e: React.FormEvent) => {
        e.preventDefault();

        const requiredFields = [
            { key: 'employee_id', label: 'รหัสพนักงาน' },
            { key: 'firstname', label: 'ชื่อ' },
            { key: 'lastname', label: 'นามสกุล' },
            { key: 'username', label: 'ชื่อผู้ใช้' },
            { key: 'email', label: 'อีเมล' },
            { key: 'department_id', label: 'แผนก' },
            { key: 'site_id', label: 'สถานที่' },
            { key: 'position_id', label: 'ตำแหน่ง' },
        ] as const;

        const missing = requiredFields.filter(f => {
            const value = form[f.key];
            return value === '' || value === 0;
        });
        if (missing.length > 0) {
            setError(`กรุณากรอก: ${missing.map(f => f.label).join(', ')}`);
            return;
        }

        setSaving(true);
        setError(null);
        try {
            const payload = {
                ...form,
                department_id: Number(form.department_id),
                site_id: Number(form.site_id),
                position_id: Number(form.position_id),
            };
            const success = await onAdd(payload);
            if (success) {
                setForm(INITIAL_FORM);
                onOpenChange(false);
            } else {
                setError('ไม่สามารถเพิ่มผู้ใช้ได้ กรุณาลองใหม่');
            }
        } catch {
            setError('เกิดข้อผิดพลาด กรุณาลองใหม่');
        } finally {
            setSaving(false);
        }
    }, [form, onAdd, onOpenChange]);

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-[#026a75]">
                        <UserPlus className="w-5 h-5" />
                        เพิ่มผู้ใช้ใหม่
                    </DialogTitle>
                    <DialogDescription>
                        กรอกข้อมูลพนักงานเพื่อเพิ่มเข้าสู่ระบบ
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-5 mt-2">
                    {/* Row 1: รหัสพนักงาน */}
                    <div className="space-y-1.5">
                        <Label className="text-xs font-medium text-gray-600 flex items-center gap-1.5">
                            <IdCard className="w-3.5 h-3.5 text-[#026a75]" />
                            รหัสพนักงาน <span className="text-red-400">*</span>
                        </Label>
                        <Input
                            value={form.employee_id}
                            onChange={e => handleChange('employee_id', e.target.value)}
                            className="h-10 text-sm rounded-lg border-gray-200 focus:ring-[#026a75] focus:border-[#026a75]"
                        />
                    </div>

                    {/* Row 2: ชื่อ + นามสกุล (same row) */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <Label className="text-xs font-medium text-gray-600 flex items-center gap-1.5">
                                <User className="w-3.5 h-3.5 text-[#026a75]" />
                                ชื่อ <span className="text-red-400">*</span>
                            </Label>
                            <Input
                                value={form.firstname}
                                onChange={e => handleChange('firstname', e.target.value)}
                                className="h-10 text-sm rounded-lg border-gray-200 focus:ring-[#026a75] focus:border-[#026a75]"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs font-medium text-gray-600 flex items-center gap-1.5">
                                <User className="w-3.5 h-3.5 text-[#026a75]" />
                                นามสกุล <span className="text-red-400">*</span>
                            </Label>
                            <Input
                                value={form.lastname}
                                onChange={e => handleChange('lastname', e.target.value)}
                                className="h-10 text-sm rounded-lg border-gray-200 focus:ring-[#026a75] focus:border-[#026a75]"
                            />
                        </div>
                    </div>

                    {/* Row 3: ชื่อผู้ใช้ + อีเมล */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <Label className="text-xs font-medium text-gray-600 flex items-center gap-1.5">
                                <User className="w-3.5 h-3.5 text-[#026a75]" />
                                ชื่อผู้ใช้ <span className="text-red-400">*</span>
                            </Label>
                            <Input
                                value={form.username}
                                onChange={e => handleChange('username', e.target.value)}
                                className="h-10 text-sm rounded-lg border-gray-200 focus:ring-[#026a75] focus:border-[#026a75]"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs font-medium text-gray-600 flex items-center gap-1.5">
                                <Mail className="w-3.5 h-3.5 text-[#026a75]" />
                                อีเมล <span className="text-red-400">*</span>
                            </Label>
                            <Input
                                value={form.email}
                                onChange={e => handleChange('email', e.target.value)}
                                className="h-10 text-sm rounded-lg border-gray-200 focus:ring-[#026a75] focus:border-[#026a75]"
                            />
                        </div>
                    </div>

                    {/* Divider */}
                    <div className="border-t border-gray-100" />

                    {/* Row 4: แผนก + สถานที่ปฏิบัติงาน (Dropdowns) */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <Label className="text-xs font-medium text-gray-600 flex items-center gap-1.5">
                                <Building className="w-3.5 h-3.5 text-[#026a75]" />
                                แผนก
                            </Label>
                            <DropdownSearch
                                value={form.department_id}
                                onChange={v => handleChange('department_id', v)}
                                options={dropdownOptions.department}
                                placeholder="-- เลือกแผนก --"
                                searchPlaceholder="ค้นหาแผนก..."
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs font-medium text-gray-600 flex items-center gap-1.5">
                                <MapPin className="w-3.5 h-3.5 text-[#026a75]" />
                                สถานที่ปฏิบัติงาน
                            </Label>
                            <DropdownSearch
                                value={form.site_id}
                                onChange={v => handleChange('site_id', v)}
                                options={dropdownOptions.site}
                                placeholder="-- เลือกสถานที่ --"
                                searchPlaceholder="ค้นหาสถานที่..."
                            />
                        </div>
                    </div>

                    {/* Row 5: ตำแหน่ง (Dropdown) */}
                    <div className="space-y-1.5">
                        <Label className="text-xs font-medium text-gray-600 flex items-center gap-1.5">
                            <Briefcase className="w-3.5 h-3.5 text-[#026a75]" />
                            ตำแหน่ง
                        </Label>
                        <DropdownSearch
                            value={form.position_id}
                            onChange={v => handleChange('position_id', v)}
                            options={dropdownOptions.position}
                            placeholder="-- เลือกตำแหน่ง --"
                            searchPlaceholder="ค้นหาตำแหน่ง..."
                        />
                    </div>

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
                            className="rounded-xl bg-[#026a75] hover:bg-[#055058] text-white cursor-pointer"
                        >
                            {saving ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
                                    กำลังบันทึก...
                                </>
                            ) : (
                                <>
                                    <UserPlus className="w-4 h-4 mr-1.5" />
                                    เพิ่มผู้ใช้
                                </>
                            )}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
});
AddUserDialog.displayName = 'AddUserDialog';
