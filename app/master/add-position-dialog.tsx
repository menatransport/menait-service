'use client';

import React, { useState, useCallback, useEffect, memo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle,
    DialogDescription, DialogFooter
} from '@/components/ui/dialog';
import { Briefcase, Loader2, BarChart3 } from 'lucide-react';
import { DropdownSearch } from '@/components/ui/dropdown/issue';

interface NewPositionOption {
    option_value: string;
    option_label: string;
}

interface AddPositionDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onAdded: (option: NewPositionOption) => void;
}

const INITIAL_FORM = {
    position_name_th: '',
    position_name_en: '',
    position_level_id: '',
};

export const AddPositionDialog = memo(({ open, onOpenChange, onAdded }: AddPositionDialogProps) => {
    const [form, setForm] = useState(INITIAL_FORM);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [levelOptions, setLevelOptions] = useState<NewPositionOption[]>([]);

    useEffect(() => {
        if (!open) return;
        const fetchLevels = async () => {
            try {
                const res = await fetch('/api/organization/position-levels');
                const data = await res.json();
                setLevelOptions(Array.isArray(data) ? data : []);
            } catch (err) {
                console.error('Error fetching position levels:', err);
            }
        };
        fetchLevels();
    }, [open]);

    const handleClose = useCallback((isOpen: boolean) => {
        if (!isOpen) {
            setForm(INITIAL_FORM);
            setError(null);
        }
        onOpenChange(isOpen);
    }, [onOpenChange]);

    const handleSubmit = useCallback(async (e: React.FormEvent) => {
        e.preventDefault();

        if (!form.position_name_th.trim() || !form.position_name_en.trim()) {
            setError('กรุณากรอกชื่อตำแหน่งภาษาไทยและภาษาอังกฤษ');
            return;
        }

        setSaving(true);
        setError(null);
        try {
            const res = await fetch('/api/organization/positions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    position_name_th: form.position_name_th,
                    position_name_en: form.position_name_en,
                    position_level_id: form.position_level_id ? Number(form.position_level_id) : null,
                }),
            });
            const data = await res.json();
            if (!res.ok) {
                setError(data?.error || 'ไม่สามารถเพิ่มตำแหน่งได้ กรุณาลองใหม่');
                return;
            }
            onAdded(data);
            setForm(INITIAL_FORM);
            onOpenChange(false);
        } catch {
            setError('เกิดข้อผิดพลาด กรุณาลองใหม่');
        } finally {
            setSaving(false);
        }
    }, [form, onAdded, onOpenChange]);

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-[#026a75]">
                        <Briefcase className="w-5 h-5" />
                        เพิ่มตำแหน่งใหม่
                    </DialogTitle>
                    <DialogDescription>
                        กรอกชื่อตำแหน่งเพื่อเพิ่มเข้าสู่ระบบ
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4 mt-2">
                    <div className="space-y-1.5">
                        <Label className="text-xs font-medium text-gray-600">
                            ชื่อตำแหน่ง (ไทย) <span className="text-red-400">*</span>
                        </Label>
                        <Input
                            value={form.position_name_th}
                            onChange={e => setForm(prev => ({ ...prev, position_name_th: e.target.value }))}
                            className="h-10 text-sm rounded-lg border-gray-200 focus:ring-[#026a75] focus:border-[#026a75]"
                            autoFocus
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label className="text-xs font-medium text-gray-600">
                            ชื่อตำแหน่ง (อังกฤษ) <span className="text-red-400">*</span>
                        </Label>
                        <Input
                            value={form.position_name_en}
                            onChange={e => setForm(prev => ({ ...prev, position_name_en: e.target.value }))}
                            className="h-10 text-sm rounded-lg border-gray-200 focus:ring-[#026a75] focus:border-[#026a75]"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label className="text-xs font-medium text-gray-600 flex items-center gap-1.5">
                            <BarChart3 className="w-3.5 h-3.5 text-[#026a75]" />
                            ระดับตำแหน่ง
                        </Label>
                        <DropdownSearch
                            value={form.position_level_id}
                            onChange={v => setForm(prev => ({ ...prev, position_level_id: v }))}
                            options={levelOptions}
                            placeholder="-- เลือกระดับตำแหน่ง --"
                            searchPlaceholder="ค้นหาระดับตำแหน่ง..."
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
                                'เพิ่มตำแหน่ง'
                            )}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
});
AddPositionDialog.displayName = 'AddPositionDialog';
