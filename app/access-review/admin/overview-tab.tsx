'use client';

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronRight, Eye, FileSpreadsheet, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TableSkeleton } from '@/components/ui/loading';
import { adminGetReviews, adminGetRemovals, adminListCycles } from '../api';
import { ReviewStatusPill, formatThaiDate, formatThaiDateTime } from '../components';
import { MailPreviewDialog } from './mail-preview-dialog';
import { ReviewChangesPanel } from './review-changes';
import { ReviewDialog } from '../review-dialog';
import { exportToExcel } from '@/lib/exportExcel';
import type { AdminReviewRow, AdminReviewRowStatus, Cycle } from '../types';

interface OrgLookup { divisions: { division_id: number; division_th: string | null; division_eng: string | null }[] }

const STATUS_OPTIONS: { value: AdminReviewRowStatus | 'all'; label: string }[] = [
    { value: 'all', label: 'ทุกสถานะ' },
    { value: 'not_started', label: 'ยังไม่เริ่ม' },
    { value: 'draft', label: 'ยังไม่ส่ง' },
    { value: 'pending', label: 'รออนุมัติ' },
    { value: 'approved', label: 'อนุมัติแล้ว' },
    { value: 'rejected', label: 'ไม่อนุมัติ' },
];

/** รออนุมัติ → who decides next; อนุมัติแล้ว / ไม่อนุมัติ → who decided; otherwise nobody yet. */
function ApproverCell({ row }: { row: AdminReviewRow }) {
    if (row.status === 'pending') {
        const names = row.next_approver_names ?? [];
        return names.length
            ? <span className="text-amber-700">รอ {names.join(', ')}</span>
            : <span className="text-gray-400">-</span>;
    }
    if ((row.status === 'approved' || row.status === 'rejected') && row.decided_by_name) {
        return <span>{row.decided_by_name}{row.decided_at ? <span className="block text-[11px] text-gray-400">{formatThaiDate(row.decided_at)}</span> : null}</span>;
    }
    return <span className="text-gray-400">-</span>;
}

/** Whole roles removed and single items unticked are different units — show them separately, against the role count. */
function ChangeCell({ row }: { row: AdminReviewRow }) {
    if (row.review_id == null) return <span className="text-gray-400">-</span>;
    const roles = row.remove_count;
    const items = row.unchecked_count ?? 0;
    return (
        <span className="whitespace-nowrap">
            {roles === 0 && items === 0 ? <span className="text-gray-500">ไม่เปลี่ยน</span> : (
                <span className="text-rose-700">
                    {[roles > 0 && `ถอด ${roles} กลุ่ม`, items > 0 && `${roles > 0 ? '' : 'ถอด '}${items} รายการ`].filter(Boolean).join(' · ')}
                </span>
            )}
            {!!row.requested_count && <span className="block text-mint-700">ขอเพิ่ม {row.requested_count} รายการ</span>}
            <span className="block text-[11px] text-gray-400">จาก {row.total_lines} กลุ่มสิทธิ์</span>
        </span>
    );
}

export function OverviewTab() {
    const [cycles, setCycles] = useState<Cycle[]>([]);
    const [cycleId, setCycleId] = useState<number | null>(null);
    const [status, setStatus] = useState<AdminReviewRowStatus | 'all'>('all');
    const [divisionId, setDivisionId] = useState<number | null>(null);
    const [divisions, setDivisions] = useState<OrgLookup['divisions']>([]);
    const [summary, setSummary] = useState<import('../types').AdminReviewSummaryCounts | null>(null);
    const [rows, setRows] = useState<AdminReviewRow[] | null>(null);
    const [exporting, setExporting] = useState(false);
    const [includePending, setIncludePending] = useState(false);
    const [expanded, setExpanded] = useState<string | null>(null);
    const [mailFor, setMailFor] = useState<number | null>(null);
    // Opens the dialog this person sees, right here on the admin page. Anyone who still owns the next step
    // (not started / draft / sent back) gets their own editable view via the read-only preview endpoints;
    // submitted reviews open the approver view by review id.
    const [preview, setPreview] = useState<AdminReviewRow | null>(null);
    const previewAsEmployee = preview != null && (preview.review_id == null || ['not_started', 'draft', 'rejected'].includes(preview.status));

    useEffect(() => {
        adminListCycles().then(list => {
            setCycles(list);
            setCycleId(prev => prev ?? list.find(c => c.is_open)?.id ?? list[0]?.id ?? null);
        }).catch(() => setCycles([]));
        fetch('/api/organization/structure').then(r => r.ok ? r.json() : null).then(data => {
            if (data?.divisions) setDivisions(data.divisions);
        }).catch(() => null);
    }, []);

    const load = useCallback(() => {
        setRows(null);
        adminGetReviews({
            cycle_id: cycleId ?? undefined,
            status: status === 'all' ? undefined : status,
            division_id: divisionId ?? undefined,
        }).then(res => { setSummary(res.summary); setRows(res.items); }).catch(() => { setRows([]); setSummary(null); });
    }, [cycleId, status, divisionId]);

    useEffect(() => { if (cycleId != null) load(); }, [cycleId, load]);

    const summaryCells = useMemo(() => summary ? [
        ['ทั้งหมด', summary.total_people],
        ['ยังไม่เริ่ม', summary.not_started],
        ['ยังไม่ส่ง', summary.draft],
        ['รออนุมัติ', summary.pending],
        ['อนุมัติแล้ว', summary.approved],
        ['ไม่อนุมัติ', summary.rejected],
    ] as const : [], [summary]);

    const handleExport = async () => {
        setExporting(true);
        try {
            const removals = await adminGetRemovals({ cycle_id: cycleId ?? undefined, include_pending: includePending || undefined });
            exportToExcel({
                data: removals,
                fileName: 'access-review-removals',
                sheetName: 'ถอดสิทธิ์',
                columns: [
                    { header: 'สถานะ', key: r => r.status === 'pending' ? 'รออนุมัติ' : 'อนุมัติแล้ว', width: 12 },
                    { header: 'รหัสพนักงาน', key: 'employee_id', width: 16 },
                    { header: 'ชื่อ-สกุล', key: 'name', width: 26 },
                    { header: 'แผนก', key: 'department', width: 22 },
                    { header: 'ระบบ', key: 'system_code', width: 12 },
                    { header: 'กลุ่มสิทธิ์', key: 'role_name', width: 26 },
                    { header: 'บัญชี', key: 'account_name', width: 22 },
                    { header: 'ประเภทการถอด', key: r => r.removal_type === 'role' ? 'ถอดทั้งกลุ่มสิทธิ์' : 'ถอดเฉพาะสิทธิ์', width: 18 },
                    { header: 'หมวด', key: r => r.category ?? '-', width: 18 },
                    { header: 'รายการที่ถอด', key: r => r.item ?? '(ทั้งกลุ่มสิทธิ์)', width: 26 },
                    { header: 'สิทธิ์', key: r => r.permission ?? '-', width: 14 },
                    { header: 'ข้อเสนอแนะ (ผู้แจ้ง)', key: r => r.requester_note ?? '', width: 28 },
                    { header: 'หมายเหตุ', key: r => r.note ?? '', width: 26 },
                    { header: 'วันที่อนุมัติ', key: r => formatThaiDate(r.decided_at), width: 16 },
                    { header: 'ผู้อนุมัติ', key: r => r.decided_by_name ?? '-', width: 20 },
                    // Only a whole-role removal can be tracked (ar_user_roles.is_active); single items have no done flag.
                    { header: 'ปิดทั้งกลุ่มแล้ว (IT)', key: r => r.removal_type !== 'role' ? '-' : r.user_role_active ? 'ยังไม่ปิด' : 'ปิดแล้ว', width: 18 },
                ],
            });
        } finally {
            setExporting(false);
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
                <select
                    value={cycleId ?? ''}
                    onChange={e => setCycleId(Number(e.target.value))}
                    className="h-9 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-700"
                >
                    {cycles.map(c => <option key={c.id} value={c.id}>{c.name}{c.is_open ? ' (เปิดอยู่)' : ''}</option>)}
                </select>
                <select
                    value={status}
                    onChange={e => setStatus(e.target.value as AdminReviewRowStatus | 'all')}
                    className="h-9 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-700"
                >
                    {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                <select
                    value={divisionId ?? ''}
                    onChange={e => setDivisionId(e.target.value ? Number(e.target.value) : null)}
                    className="h-9 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-700"
                >
                    <option value="">ทุกฝ่าย</option>
                    {divisions.map(d => <option key={d.division_id} value={d.division_id}>{d.division_th || d.division_eng}</option>)}
                </select>
                <label className="ml-auto inline-flex cursor-pointer items-center gap-1.5 text-xs text-gray-600">
                    <input type="checkbox" checked={includePending} onChange={e => setIncludePending(e.target.checked)} className="size-3.5 accent-brand-600" />
                    รวมรออนุมัติ
                </label>
                <Button type="button" size="sm" variant="outline" disabled={exporting} onClick={handleExport} className="gap-1.5">
                    <FileSpreadsheet className="size-3.5" /> Export รายการที่ต้องถอดสิทธิ์
                </Button>
            </div>

            {summary && (
                <div className="flex flex-wrap items-center gap-x-8 gap-y-2 rounded-xl border border-gray-100 bg-gray-50/70 px-4 py-3">
                    {summaryCells.map(([label, value]) => (
                        <div key={label}>
                            <p className="text-xs text-gray-500">{label}</p>
                            <p className="font-display text-xl font-semibold text-brand-800 tabular-nums">{value}</p>
                        </div>
                    ))}
                </div>
            )}

            {rows === null ? (
                <TableSkeleton rows={6} />
            ) : rows.length === 0 ? (
                <p className="py-10 text-center text-sm text-gray-400">ไม่พบข้อมูล</p>
            ) : (
                <div className="overflow-x-auto rounded-xl border border-gray-100">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-gray-50 border-b border-gray-100">
                                {([['', 'w-8'], ['รหัส', 'w-20'], ['ชื่อ-สกุล', ''], ['แผนก', ''], ['ฝ่าย', ''], ['สถานะ', 'w-32'], ['ผู้อนุมัติ', 'min-w-40'], ['ส่งเมื่อ', 'w-36'], ['การเปลี่ยนแปลง', 'w-36 text-right'], [' ', 'w-16']] as const).map(([h, w]) => (
                                    <th key={h} className={`px-3 py-2 text-left text-xs font-semibold text-gray-500 whitespace-nowrap ${w}`}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map(r => {
                                const open = expanded === r.employee_id && r.review_id != null;
                                return (
                                <Fragment key={r.employee_id}>
                                <tr
                                    onClick={r.review_id != null ? () => setExpanded(open ? null : r.employee_id) : undefined}
                                    className={`border-b border-gray-50 last:border-b-0 hover:bg-gray-50/80 ${r.review_id != null ? 'cursor-pointer' : ''} ${open ? 'bg-gray-50/80' : ''}`}
                                >
                                    <td className="py-2 pl-3 pr-0">
                                        {r.review_id != null && (
                                            <ChevronRight aria-label={open ? 'ซ่อน before → after' : 'ดู before → after'} className={`size-4 text-gray-400 transition-transform ${open ? 'rotate-90 text-brand-600' : ''}`} />
                                        )}
                                    </td>
                                    <td className="px-3 py-2 font-mono text-xs text-brand-600 whitespace-nowrap">{r.employee_id}</td>
                                    <td className="px-3 py-2 text-gray-800 whitespace-nowrap">{r.name}</td>
                                    <td className="px-3 py-2 text-xs text-gray-600">{r.department ?? '-'}</td>
                                    <td className="px-3 py-2 text-xs text-gray-600">{r.division ?? '-'}</td>
                                    <td className="px-3 py-2"><ReviewStatusPill status={r.status} /></td>
                                    <td className="px-3 py-2 text-xs text-gray-600"><ApproverCell row={r} /></td>
                                    <td className="px-3 py-2 text-xs text-gray-500 whitespace-nowrap">{formatThaiDateTime(r.submitted_at)}</td>
                                    <td className="px-3 py-2 text-right text-xs tabular-nums"><ChangeCell row={r} /></td>
                                    <td className="px-3 py-2 text-right" onClick={e => e.stopPropagation()}>
                                        <div className="flex items-center justify-end gap-2">
                                            {r.review_id != null && (
                                                <button type="button" onClick={() => setMailFor(r.review_id)} title="ดูอีเมล" className="text-gray-400 hover:text-brand-600 cursor-pointer">
                                                    <Mail className="size-4" />
                                                </button>
                                            )}
                                            <button type="button" onClick={() => setPreview(r)} title="เปิดดูหน้าตา Dialog" className="text-gray-400 hover:text-brand-600 cursor-pointer">
                                                <Eye className="size-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                                {open && (
                                    <tr className="border-b border-gray-100 bg-gray-50/60">
                                        <td colSpan={10} className="px-4 py-3 sm:pl-11"><ReviewChangesPanel reviewId={r.review_id!} /></td>
                                    </tr>
                                )}
                                </Fragment>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            <MailPreviewDialog reviewId={mailFor} open={mailFor != null} onOpenChange={v => !v && setMailFor(null)} />
            {preview != null && (
                <ReviewDialog
                    key={preview.employee_id}
                    dialogId={previewAsEmployee ? 'me' : String(preview.review_id)}
                    previewEmployee={previewAsEmployee ? { employee_id: preview.employee_id, name: preview.name } : undefined}
                    onClose={() => setPreview(null)}
                    onChanged={load}
                />
            )}
        </div>
    );
}
