'use client';

import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { TableSkeleton } from '@/components/ui/loading';
import { adminCreateCycle, adminDeleteCycle, adminListCycles, adminUpdateCycle } from '../api';
import { ActivePill, formatThaiDate } from '../components';
import type { Cycle } from '../types';

const showAlert = (opts: Record<string, unknown>) => import('sweetalert2').then(({ default: Swal }) => Swal.fire({ confirmButtonText: 'ตกลง', ...opts }));
const showConfirm = (opts: Record<string, unknown>) => import('sweetalert2').then(({ default: Swal }) => Swal.fire({
    showCancelButton: true, confirmButtonColor: '#1c6ef2', cancelButtonColor: '#d33', confirmButtonText: 'ยืนยัน', cancelButtonText: 'ยกเลิก', ...opts,
})).then(r => r.isConfirmed);

type DraftCycle = { name: string; start_date: string; end_date: string; is_open: boolean };
const EMPTY: DraftCycle = { name: '', start_date: '', end_date: '', is_open: true };

function CycleDialog({ open, onOpenChange, cycle, onSaved }: { open: boolean; onOpenChange: (v: boolean) => void; cycle: Cycle | null; onSaved: (c: Cycle) => void }) {
    const [draft, setDraft] = useState<DraftCycle>(EMPTY);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (open) setDraft(cycle ? { name: cycle.name, start_date: cycle.start_date.slice(0, 10), end_date: cycle.end_date.slice(0, 10), is_open: cycle.is_open } : EMPTY);
    }, [open, cycle]);

    const save = async () => {
        if (!draft.name.trim() || !draft.start_date || !draft.end_date) {
            return showAlert({ icon: 'warning', title: 'กรุณากรอกชื่อรอบและช่วงวันที่ให้ครบ' });
        }
        setSaving(true);
        try {
            const saved = cycle ? await adminUpdateCycle(cycle.id, draft) : await adminCreateCycle(draft);
            onSaved(saved);
            onOpenChange(false);
        } catch (err) {
            await showAlert({ icon: 'error', title: 'บันทึกไม่สำเร็จ', text: err instanceof Error ? err.message : undefined });
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-3xl">
                <DialogHeader><DialogTitle>{cycle ? 'แก้ไขรอบทบทวน' : 'สร้างรอบทบทวนใหม่'}</DialogTitle></DialogHeader>
                <div className="space-y-3">
                    <label className="block text-sm">ชื่อรอบ
                        <Input value={draft.name} onChange={e => setDraft(d => ({ ...d, name: e.target.value }))} placeholder="เช่น ทบทวนสิทธิ์ครึ่งปี 2569" className="mt-1" />
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                        <label className="block text-sm">วันเริ่ม
                            <Input type="date" value={draft.start_date} onChange={e => setDraft(d => ({ ...d, start_date: e.target.value }))} className="mt-1" />
                        </label>
                        <label className="block text-sm">วันสิ้นสุด
                            <Input type="date" value={draft.end_date} onChange={e => setDraft(d => ({ ...d, end_date: e.target.value }))} className="mt-1" />
                        </label>
                    </div>
                    <label className="flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={draft.is_open} onChange={e => setDraft(d => ({ ...d, is_open: e.target.checked }))} className="size-4 accent-brand-600" />
                        เปิดให้ทบทวน (is_open)
                    </label>
                </div>
                <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>ยกเลิก</Button>
                    <Button type="button" disabled={saving} onClick={save}>บันทึก</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

export function CyclesTab() {
    const [cycles, setCycles] = useState<Cycle[] | null>(null);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editing, setEditing] = useState<Cycle | null>(null);

    const load = () => adminListCycles().then(setCycles).catch(() => setCycles([]));
    useEffect(() => { load(); }, []);

    const upsert = (c: Cycle) => setCycles(prev => {
        const list = prev ?? [];
        const exists = list.some(x => x.id === c.id);
        return exists ? list.map(x => x.id === c.id ? c : x) : [c, ...list];
    });

    const remove = async (c: Cycle) => {
        const ok = await showConfirm({ icon: 'warning', title: `ลบรอบทบทวน "${c.name}"?`, text: 'ลบได้เฉพาะรอบที่ยังไม่มีใครทบทวนสิทธิ์' });
        if (!ok) return;
        try {
            await adminDeleteCycle(c.id);
            setCycles(prev => (prev ?? []).filter(x => x.id !== c.id));
        } catch (err) {
            await showAlert({ icon: 'error', title: 'ลบไม่สำเร็จ', text: err instanceof Error ? err.message : undefined });
        }
    };

    return (
        <div className="space-y-3">
            <div className="flex justify-end">
                <Button type="button" size="sm" onClick={() => { setEditing(null); setDialogOpen(true); }} className="gap-1.5">
                    <Plus className="size-3.5" /> สร้างรอบทบทวน
                </Button>
            </div>

            {cycles === null ? <TableSkeleton rows={3} /> : cycles.length === 0 ? (
                <p className="py-10 text-center text-sm text-gray-400">ยังไม่มีรอบทบทวน</p>
            ) : (
                <div className="overflow-x-auto rounded-xl border border-gray-100">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-gray-50 border-b border-gray-100">
                                {([['ชื่อรอบ', ''], ['เริ่ม', 'w-40'], ['สิ้นสุด', 'w-40'], ['สถานะ', 'w-28'], ['', 'w-24']] as const).map(([h, w]) => (
                                    <th key={h} className={`px-3 py-2 text-left text-xs font-semibold text-gray-500 whitespace-nowrap ${w}`}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {cycles.map(c => (
                                <tr key={c.id} className="border-b border-gray-50 last:border-b-0 hover:bg-gray-50/80">
                                    <td className="px-3 py-2 font-medium text-gray-800">{c.name}</td>
                                    <td className="px-3 py-2 text-gray-500 whitespace-nowrap">{formatThaiDate(c.start_date)}</td>
                                    <td className="px-3 py-2 text-gray-500 whitespace-nowrap">{formatThaiDate(c.end_date)}</td>
                                    <td className="px-3 py-2"><ActivePill active={c.is_open} on="เปิดอยู่" off="ปิดแล้ว" /></td>
                                    <td className="px-3 py-2">
                                        <div className="flex items-center justify-end gap-3">
                                            <button type="button" onClick={() => { setEditing(c); setDialogOpen(true); }} className="whitespace-nowrap text-xs font-medium text-brand-600 hover:underline cursor-pointer">
                                                แก้ไข
                                            </button>
                                            <button type="button" onClick={() => remove(c)} title="ลบ" aria-label={`ลบรอบ ${c.name}`} className="text-gray-400 hover:text-rose-600 cursor-pointer"><Trash2 className="size-3.5" /></button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            <CycleDialog open={dialogOpen} onOpenChange={setDialogOpen} cycle={editing} onSaved={upsert} />
        </div>
    );
}
