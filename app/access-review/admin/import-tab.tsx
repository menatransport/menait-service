'use client';

import { useRef, useState } from 'react';
import { CheckCircle2, FileSpreadsheet, Loader2, Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { adminImport } from '../api';
import { InlineConfirm, SYSTEM_META } from '../components';
import type { ImportReport, SystemCode } from '../types';

const showAlert = (opts: Record<string, unknown>) => import('sweetalert2').then(({ default: Swal }) => Swal.fire({ confirmButtonText: 'ตกลง', ...opts }));

const SYSTEMS: SystemCode[] = ['ATMS', 'WINSPEED', 'EMAIL'];

function ReportCard({ report }: { report: ImportReport }) {
    const cells: [string, number][] = [
        ...(report.employees_in_file != null ? [['พนักงานในไฟล์', report.employees_in_file] as [string, number]] : []),
        ...(report.roles_in_file != null ? [['กลุ่มสิทธิ์ในไฟล์', report.roles_in_file] as [string, number]] : []),
        ['เพิ่มกลุ่มสิทธิ์', report.roles_added],
        ['อัปเดตกลุ่มสิทธิ์', report.roles_updated],
        ['แทนที่รายการสิทธิ์', report.items_replaced],
        ...(report.user_roles_in_file != null ? [['สิทธิ์ของพนักงานในไฟล์', report.user_roles_in_file] as [string, number]] : []),
        ...(report.user_roles_added != null ? [['เพิ่มสิทธิ์ให้พนักงาน', report.user_roles_added] as [string, number]] : []),
        ...(report.user_roles_updated != null ? [['อัปเดตสิทธิ์พนักงาน', report.user_roles_updated] as [string, number]] : []),
        ...(report.user_roles_reactivated != null ? [['เปิดสิทธิ์ที่ปิดไว้กลับมาใช้', report.user_roles_reactivated] as [string, number]] : []),
        ...(report.user_roles_deactivated != null ? [['ปิดสิทธิ์ที่ไม่มีแล้ว', report.user_roles_deactivated] as [string, number]] : []),
    ];
    return (
        <div className="space-y-3 rounded-xl border border-gray-100 bg-gray-50/70 p-4">
            <p className="flex items-center gap-1.5 text-sm font-medium text-gray-700">
                {report.dry_run ? <FileSpreadsheet className="size-4 text-brand-600" /> : <CheckCircle2 className="size-4 text-mint-600" />}
                {report.dry_run ? 'ผลตรวจสอบ (ยังไม่บันทึกจริง)' : 'นำเข้าสำเร็จแล้ว'} — {SYSTEM_META[report.system]?.label ?? report.system}
            </p>
            <div className="flex flex-wrap gap-x-6 gap-y-2">
                {cells.map(([label, value]) => (
                    <div key={label}>
                        <p className="text-xs text-gray-500">{label}</p>
                        <p className="font-display text-lg font-semibold text-brand-800 tabular-nums">{value}</p>
                    </div>
                ))}
            </div>
            {report.warnings && report.warnings.length > 0 && (
                <div className="space-y-1 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                    {report.warnings.map((w, i) => (
                        <p key={i} className="text-xs text-amber-800">{w}</p>
                    ))}
                </div>
            )}
            {report.unmatched.length > 0 && (
                <div>
                    <p className="mb-1 text-xs font-medium text-rose-600">รายการที่จับคู่ไม่ได้ ({report.unmatched.length})</p>
                    <div className="max-h-56 overflow-y-auto rounded-lg border border-rose-100">
                        <table className="w-full text-xs">
                            <thead>
                                <tr className="bg-rose-50 border-b border-rose-100">
                                    <th className="px-2 py-1.5 text-left font-semibold text-rose-700">บัญชี</th>
                                    <th className="px-2 py-1.5 text-left font-semibold text-rose-700">รหัสพนักงาน</th>
                                    <th className="px-2 py-1.5 text-left font-semibold text-rose-700">กลุ่มสิทธิ์</th>
                                    <th className="px-2 py-1.5 text-left font-semibold text-rose-700">สาเหตุ</th>
                                </tr>
                            </thead>
                            <tbody>
                                {report.unmatched.map((u, i) => (
                                    <tr key={i} className="border-b border-rose-50 last:border-b-0 bg-white">
                                        <td className="px-2 py-1.5">{u.account_name}</td>
                                        <td className="px-2 py-1.5 font-mono">{u.employee_id ?? '-'}</td>
                                        <td className="px-2 py-1.5">{u.role_name}</td>
                                        <td className="px-2 py-1.5 text-gray-500">{u.reason}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}

export function ImportTab() {
    const [system, setSystem] = useState<SystemCode>('ATMS');
    const [file, setFile] = useState<File | null>(null);
    const [report, setReport] = useState<ImportReport | null>(null);
    const [checking, setChecking] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    const chooseFile = (f: File | null) => { setFile(f); setReport(null); };

    const runDryRun = async () => {
        if (!file) return showAlert({ icon: 'warning', title: 'กรุณาเลือกไฟล์ .xlsx ก่อน' });
        setChecking(true);
        try {
            const res = await adminImport(system, file, true);
            setReport(res);
        } catch (err) {
            await showAlert({ icon: 'error', title: 'ตรวจสอบไม่สำเร็จ', text: err instanceof Error ? err.message : undefined });
        } finally {
            setChecking(false);
        }
    };

    const runReal = async () => {
        if (!file) return;
        try {
            const res = await adminImport(system, file, false);
            setReport(res);
            await showAlert({ icon: 'success', title: 'นำเข้าข้อมูลสำเร็จ', timer: 1800, showConfirmButton: false });
        } catch (err) {
            await showAlert({ icon: 'error', title: 'นำเข้าไม่สำเร็จ', text: err instanceof Error ? err.message : undefined });
            throw err;
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-end gap-3">
                <label className="block text-sm">เลือกระบบ
                    <select value={system} onChange={e => { setSystem(e.target.value as SystemCode); setReport(null); }} className="mt-1 h-9 rounded-md border border-gray-200 px-3 text-sm">
                        {SYSTEMS.map(s => <option key={s} value={s}>{SYSTEM_META[s]?.label ?? s}</option>)}
                    </select>
                </label>

                <div
                    onClick={() => inputRef.current?.click()}
                    className="flex h-9 min-w-56 cursor-pointer items-center gap-2 rounded-md border border-dashed border-gray-300 bg-white px-3 text-sm text-gray-600 hover:border-brand-400 hover:bg-brand-600/5"
                >
                    <Upload className="size-3.5 text-gray-400" />
                    {file ? <span className="truncate">{file.name}</span> : <span className="text-gray-400">เลือกไฟล์ .xlsx</span>}
                    {file && (
                        <button type="button" onClick={e => { e.stopPropagation(); chooseFile(null); }} className="ml-auto text-gray-400 hover:text-rose-600">
                            <X className="size-3.5" />
                        </button>
                    )}
                    <input
                        ref={inputRef}
                        type="file"
                        accept=".xlsx"
                        className="hidden"
                        onChange={e => chooseFile(e.target.files?.[0] ?? null)}
                    />
                </div>

                <Button type="button" variant="outline" disabled={!file || checking} onClick={runDryRun} className="gap-1.5">
                    {checking ? <Loader2 className="size-3.5 animate-spin" /> : <FileSpreadsheet className="size-3.5" />}
                    ตรวจสอบ (dry-run)
                </Button>
            </div>

            {report && <ReportCard report={report} />}

            {report?.dry_run && (
                <InlineConfirm
                    label="นำเข้าจริง"
                    confirmLabel="ยืนยันนำเข้าจริง"
                    summary={<>ยืนยันนำเข้าข้อมูล {SYSTEM_META[system]?.label ?? system} จริง? การเปลี่ยนแปลงนี้จะมีผลกับบัญชีและกลุ่มสิทธิ์ทันที</>}
                    onConfirm={runReal}
                />
            )}
        </div>
    );
}
