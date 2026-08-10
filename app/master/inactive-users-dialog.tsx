'use client';

import React, { useState, useEffect, useMemo, useCallback, memo } from 'react';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import {
    UserX, Search, X, ChevronDown, Building2, MapPin,
    Briefcase, Mail, Loader2, RotateCcw, AlertCircle,
} from 'lucide-react';
import { UserAvatar } from '@/components/ui/user-avatar';
import type { UserData } from './types';

interface InactiveUsersDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

// ── Minimal detail rows shown when a card is expanded ──
const DETAIL_FIELDS = [
    { key: 'department', label: 'ฝ่าย', icon: Building2 },
    { key: 'site', label: 'สาขา', icon: MapPin },
    { key: 'position', label: 'ตำแหน่ง', icon: Briefcase },
    { key: 'email', label: 'อีเมล', icon: Mail },
] as const;

// วันที่อัปเดตล่าสุด — คืน null ถ้าไม่มี/ไม่ใช่วันที่ที่ถูกต้อง
const formatUpdatedAt = (value?: string | null) => {
    if (!value) return null;
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return null;
    d.setHours(d.getHours() + 7); // ชดเชยเป็นเวลาไทย (UTC+7)
    // เช่น 12 ส.ค. 69 14:32
    return d.toLocaleString('th-TH', {
        day: 'numeric',
        month: 'short',
        year: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    });
};

// ===================== ROW (accordion) =====================

const InactiveUserRow = memo(({
    user, isOpen, onToggle
}: {
    user: UserData;
    isOpen: boolean;
    onToggle: () => void;
}) => {
    const updatedAt = formatUpdatedAt(user.updated_at);
    return (
    <div className={`rounded-xl border transition-colors ${isOpen ? 'border-rose-200 bg-rose-50/40' : 'border-gray-100 bg-white hover:border-gray-200'}`}>
        <button
            onClick={onToggle}
            aria-expanded={isOpen}
            className="w-full flex items-center gap-3 px-3 py-2.5 text-left cursor-pointer"
        >
            <UserAvatar
                imageUrl={user.image_url}
                name={`${user.firstname ?? ''} ${user.lastname ?? ''}`}
                email={user.email}
                className="w-8 h-8 shrink-0 grayscale"
                rounded="rounded-lg"
                fallbackClassName="bg-gray-200 text-gray-500"
                textClassName="text-[10px] font-bold"
            />
            <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-800 truncate">
                    {user.firstname} {user.lastname}
                </p>
                <p className="text-[11px] text-gray-400 truncate">
                    <span className="font-mono">{user.employee_id || '-'}</span>
                    {updatedAt && <span className="ml-1.5">· {updatedAt}</span>}
                </p>
            </div>
            <span className="hidden sm:block text-[11px] text-gray-400 truncate max-w-40">
                {user.department || 'ไม่ระบุฝ่าย'}
            </span>
            <ChevronDown
                className={`w-4 h-4 shrink-0 text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-180 text-rose-500' : ''}`}
            />
        </button>

        {isOpen && (
            <div className="px-3 pb-3 pt-0.5 ml-11 grid gap-1.5 sm:grid-cols-2">
                {DETAIL_FIELDS.map(({ key, label, icon: Icon }) => (
                    <div key={key} className="flex items-center gap-2 min-w-0">
                        <Icon className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                        <span className="text-[11px] text-gray-400 w-12 shrink-0">{label}</span>
                        <span
                            className="text-xs text-gray-700 truncate"
                            title={String(user[key] ?? '')}
                        >
                            {user[key] || '-'}
                        </span>
                    </div>
                ))}
            </div>
        )}
    </div>
    );
});
InactiveUserRow.displayName = 'InactiveUserRow';

// ===================== DIALOG =====================

export const InactiveUsersDialog = memo(({ open, onOpenChange }: InactiveUsersDialogProps) => {
    const [users, setUsers] = useState<UserData[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [expandedId, setExpandedId] = useState<number | null>(null);
    const [selectedDept, setSelectedDept] = useState<string | null>(null);

    const fetchInactive = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const res = await fetch('/api/organization/user?status=Inactive');
            const data = await res.json();
            if (!res.ok) {
                setError(data?.error || 'เกิดข้อผิดพลาดในการโหลดข้อมูล');
                return;
            }
            setUsers(Array.isArray(data) ? data : []);
        } catch {
            setError('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้');
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Lazy load on first open
    useEffect(() => {
        if (open) fetchInactive();
        else {
            setSearchTerm('');
            setExpandedId(null);
            setSelectedDept(null);
        }
    }, [open, fetchInactive]);

    // กรองด้วยคำค้นหา — คงลำดับจาก API ไว้ (updated_at ล่าสุด → เก่าสุด)
    const searched = useMemo(() => {
        const term = searchTerm.trim().toLowerCase();
        if (!term) return users;
        return users.filter(u =>
            u.employee_id?.toLowerCase().includes(term) ||
            u.firstname?.toLowerCase().includes(term) ||
            u.lastname?.toLowerCase().includes(term) ||
            u.department?.toLowerCase().includes(term) ||
            u.site?.toLowerCase().includes(term) ||
            u.position?.toLowerCase().includes(term) ||
            u.email?.toLowerCase().includes(term)
        );
    }, [users, searchTerm]);

    // จำนวนคนที่ออกต่อแผนก — เรียงจากมากไปน้อย
    const deptSummary = useMemo(() => {
        const counts = new Map<string, number>();
        for (const u of searched) {
            const dept = u.department?.trim() || 'ไม่ระบุฝ่าย';
            counts.set(dept, (counts.get(dept) ?? 0) + 1);
        }
        return [...counts.entries()]
            .map(([department, count]) => ({ department, count }))
            .sort((a, b) => b.count - a.count || a.department.localeCompare(b.department, 'th'));
    }, [searched]);

    const filtered = useMemo(() => (
        !selectedDept
            ? searched
            : searched.filter(u => (u.department?.trim() || 'ไม่ระบุฝ่าย') === selectedDept)
    ), [searched, selectedDept]);

    const toggleDept = useCallback((dept: string) => {
        setExpandedId(null);
        setSelectedDept(prev => (prev === dept ? null : dept));
    }, []);

    const toggleRow = useCallback((id: number) => {
        setExpandedId(prev => (prev === id ? null : id));
    }, []);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-2xl p-0 gap-0 overflow-hidden rounded-2xl" showCloseButton={false}>
                {/* Header */}
                <DialogHeader className="bg-linear-to-r from-slate-700 to-slate-600 px-5 py-4 space-y-0">
                    <DialogTitle className="text-base font-bold text-white flex items-center gap-2">
                        <UserX className="w-5 h-5" />
                        พนักงานลาออก
                    </DialogTitle>
                    <DialogDescription className="text-white/60 text-xs mt-0.5">
                        {isLoading
                            ? 'กำลังโหลด...'
                            : `${filtered.length.toLocaleString()} คน${searchTerm ? ` (จาก ${users.length.toLocaleString()} คน)` : ''} · กดที่รายชื่อเพื่อดูรายละเอียด`}
                    </DialogDescription>
                    {/* label by department 3 column */}
                    {deptSummary.length > 0 && (
                        <ul className="grid grid-cols-6 gap-1 mt-2.5 max-h-19 overflow-y-auto pr-0.5">
                            {deptSummary.map(({ department, count }) => {
                                const active = selectedDept === department;
                                return (
                                    <li key={department}>
                                        <button
                                            type="button"
                                            onClick={() => toggleDept(department)}
                                            aria-pressed={active}
                                            title={`${department} · ${count.toLocaleString()} คน`}
                                            className={`w-full flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] leading-4 transition-colors cursor-pointer ${active
                                                ? 'bg-white text-slate-700 font-medium'
                                                : 'bg-white/10 text-white/70 hover:bg-white/20'
                                                }`}
                                        >
                                            <span className="truncate flex-1 text-left">{department}</span>
                                            <span className={`px-1 rounded tabular-nums font-semibold ${active ? 'bg-slate-700 text-white' : 'bg-white/15 text-white'
                                                }`}>
                                                {count.toLocaleString()}
                                            </span>
                                        </button>
                                    </li>
                                );
                            })}
                        </ul>
                    )}

                    {/* Search */}
                    <div className="relative mt-3">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            placeholder="ค้นหาชื่อ, รหัส, ฝ่าย..."
                            className="w-full h-10 pl-10 pr-10 bg-white/95 border border-white/15 rounded-xl text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-white/40 transition-all"
                        />
                        {searchTerm && (
                            <button
                                onClick={() => setSearchTerm('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                </DialogHeader>

                {/* Body */}
                <div className="max-h-[60vh] overflow-y-auto p-3 space-y-2 bg-gray-50/50">
                    {isLoading ? (
                        <div className="flex flex-col items-center gap-3 py-16">
                            <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
                            <p className="text-sm text-gray-400">กำลังโหลดข้อมูล...</p>
                        </div>
                    ) : error ? (
                        <div className="flex flex-col items-center gap-3 py-14">
                            <div className="w-12 h-12 bg-red-50 rounded-2xl flex items-center justify-center">
                                <AlertCircle className="w-5 h-5 text-red-400" />
                            </div>
                            <p className="text-sm text-gray-600">{error}</p>
                            <button
                                onClick={fetchInactive}
                                className="inline-flex items-center gap-1.5 text-xs font-medium text-[#026a75] hover:underline cursor-pointer"
                            >
                                <RotateCcw className="w-3.5 h-3.5" />
                                ลองใหม่
                            </button>
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="flex flex-col items-center gap-3 py-16">
                            <div className="w-12 h-12 bg-gray-100 rounded-2xl flex items-center justify-center">
                                <UserX className="w-5 h-5 text-gray-400" />
                            </div>
                            <p className="text-sm text-gray-500 font-medium">
                                {searchTerm ? 'ไม่พบพนักงานที่ค้นหา' : 'ไม่มีพนักงานที่ไม่ใช้งาน'}
                            </p>
                        </div>
                    ) : (
                        filtered.map(user => (
                            <InactiveUserRow
                                key={user.id}
                                user={user}
                                isOpen={expandedId === user.id}
                                onToggle={() => toggleRow(user.id)}
                            />
                        ))
                    )}
                </div>

                {/* Footer */}
                <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-end bg-white">
                    <button
                        onClick={() => onOpenChange(false)}
                        className="px-4 py-2 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer"
                    >
                        ปิด
                    </button>
                </div>
            </DialogContent>
        </Dialog>
    );
});
InactiveUsersDialog.displayName = 'InactiveUsersDialog';
