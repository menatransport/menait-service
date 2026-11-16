'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowRight } from 'lucide-react';
import { AccessReviewError, adminGetReviewChanges } from '../api';
import { SYSTEM_META, SystemIcon } from '../components';
import type { ReviewChangeLine, ReviewChanges, RoleItem } from '../types';

const itemLabel = (it: RoleItem) => [it.category, it.item, it.permission].filter(Boolean).join(' › ');

function ChangeBadge({ line }: { line: ReviewChangeLine }) {
    if (line.change === 'role') {
        return <span className="whitespace-nowrap rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-700">ถอดทั้งกลุ่ม</span>;
    }
    if (line.change === 'items') {
        return <span className="whitespace-nowrap rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">ถอด {line.removed.length} รายการ</span>;
    }
    return <span className="whitespace-nowrap rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-[11px] font-medium text-gray-500">ไม่เปลี่ยน</span>;
}

function ItemList({ title, items, tone }: { title: string; items: RoleItem[]; tone: 'removed' | 'added' | 'retired' | 'requested' }) {
    if (items.length === 0) return null;
    const cls = tone === 'removed' ? 'text-rose-700 line-through decoration-rose-300' : tone === 'added' ? 'text-sky-700'
        : tone === 'requested' ? 'text-mint-700' : 'text-gray-400';
    return (
        <div className="mt-1.5">
            <p className="text-[11px] font-semibold text-gray-500">{title} ({items.length})</p>
            <ul className="mt-0.5 grid gap-x-6 gap-y-0.5 sm:grid-cols-2">
                {items.map(it => <li key={it.id} className={`truncate text-xs ${cls}`} title={itemLabel(it)}>{itemLabel(it)}</li>)}
            </ul>
        </div>
    );
}

/** Before → after of one review, per role. Rendered inside the overview table's expanded row. */
export function ReviewChangesPanel({ reviewId }: { reviewId: number }) {
    const [data, setData] = useState<ReviewChanges | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [onlyChanged, setOnlyChanged] = useState(true);

    useEffect(() => {
        adminGetReviewChanges(reviewId).then(setData).catch(e => setError(
            e instanceof AccessReviewError && e.status === 404 ? 'API ยังไม่รองรับการดู before → after (รอ deploy backend)' : e.message,
        ));
    }, [reviewId]);

    const lines = useMemo(() => {
        if (!data) return [];
        return onlyChanged ? data.lines.filter(l => l.change || l.requested?.length || l.added_since.length || l.retired_since.length) : data.lines;
    }, [data, onlyChanged]);

    if (error) return <p className="text-xs text-rose-600">{error}</p>;
    if (!data) return <p className="text-xs text-gray-400">กำลังโหลด…</p>;

    const before = data.lines.reduce((n, l) => n + l.before_count, 0);
    const after = data.lines.reduce((n, l) => n + l.after_count, 0);
    const rolesRemoved = data.lines.filter(l => l.change === 'role').length;
    const unchanged = data.lines.length - data.lines.filter(l => l.change || l.requested?.length).length;
    const requested = data.lines.reduce((n, l) => n + (l.requested?.length ?? 0), 0) + (data.requested_roles?.length ?? 0);

    return (
        <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-xs text-gray-600">
                <span>รายการสิทธิ์ <b className="tabular-nums text-gray-800">{before}</b> <ArrowRight className="inline size-3 text-gray-400" /> <b className="tabular-nums text-gray-800">{after}</b></span>
                <span>ถอดทั้งกลุ่ม <b className="tabular-nums text-gray-800">{rolesRemoved}</b> กลุ่ม</span>
                {requested > 0 && <span>ขอเพิ่ม <b className="tabular-nums text-mint-700">{requested}</b> รายการ</span>}
                <span>ไม่เปลี่ยน <b className="tabular-nums text-gray-800">{unchanged}</b> / {data.lines.length} กลุ่ม</span>
                <label className="ml-auto inline-flex cursor-pointer items-center gap-1.5">
                    <input type="checkbox" checked={onlyChanged} onChange={e => setOnlyChanged(e.target.checked)} className="size-3.5 accent-brand-600" />
                    แสดงเฉพาะกลุ่มที่เปลี่ยน
                </label>
            </div>
            {data.requester_note && <p className="text-xs text-gray-600"><span className="font-semibold text-gray-500">ข้อเสนอแนะ (ผู้แจ้ง):</span> {data.requester_note}</p>}
            {data.comment && <p className="text-xs text-gray-600"><span className="font-semibold text-gray-500">ข้อเสนอแนะ (ผู้อนุมัติ):</span> {data.comment}</p>}
            {!data.has_snapshot && data.status !== 'draft' && (
                <p className="flex items-start gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                    <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                    รีวิวนี้ส่งก่อนระบบเริ่มเก็บ before — ค่า before ของบางกลุ่มคำนวณจากกลุ่มสิทธิ์ปัจจุบัน อาจไม่ตรงกับตอนที่ส่ง
                </p>
            )}
            {data.status === 'draft' && <p className="text-xs text-gray-500">ยังไม่ส่ง — before คือกลุ่มสิทธิ์ปัจจุบัน after คือที่ติ๊กไว้ล่าสุด</p>}

            {!!data.requested_roles?.length && (
                <div className="rounded-lg border border-mint-300/70 bg-emerald-50/60 px-3 py-2">
                    <p className="text-[11px] font-semibold text-mint-700">ขอเพิ่มอีเมลกลุ่ม / กลุ่มสิทธิ์ ({data.requested_roles.length})</p>
                    <ul className="mt-0.5 grid gap-x-6 gap-y-0.5 sm:grid-cols-2">
                        {data.requested_roles.map(r => (
                            <li key={r.id} className="flex items-center gap-1.5 truncate text-xs text-mint-700" title={r.name}>
                                <SystemIcon code={r.system_code} className="size-3 shrink-0" />{r.name}
                            </li>
                        ))}
                    </ul>
                </div>
            )}
            {lines.length === 0 ? (
                <p className="py-2 text-xs text-gray-400">ไม่มีการเปลี่ยนแปลง — คงสิทธิ์ทั้งหมด</p>
            ) : (
                <div className="divide-y divide-gray-100 rounded-lg border border-gray-100 bg-white">
                    {lines.map(l => (
                        <div key={l.user_role_id} className="px-3 py-2">
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-gray-500"><SystemIcon code={l.system_code} className="size-3.5" />{SYSTEM_META[l.system_code]?.label ?? l.system_code}</span>
                                <span className="text-sm font-medium text-gray-800">{l.role_name}</span>
                                {l.account_name && <span className="font-mono text-[11px] text-gray-400">{l.account_name}</span>}
                                {(l.change || !l.requested?.length) && <ChangeBadge line={l} />}
                                {!!l.requested?.length && (
                                    <span className="whitespace-nowrap rounded-full border border-mint-300 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-mint-700">ขอเพิ่ม {l.requested.length} รายการ</span>
                                )}
                                {l.before_count > 0 && (
                                    <span className="ml-auto text-xs tabular-nums text-gray-500">{l.before_count} <ArrowRight className="inline size-3 text-gray-400" /> <b className={l.after_count < l.before_count ? 'text-rose-700' : 'text-gray-700'}>{l.after_count}</b> รายการ</span>
                                )}
                            </div>
                            {l.change === 'items' && <ItemList title="ถอดออก" items={l.removed} tone="removed" />}
                            <ItemList title="ขอเพิ่ม (ต้องการเพิ่มสิทธิ์)" items={l.requested ?? []} tone="requested" />
                            <ItemList title="เพิ่มในระบบหลังส่ง (ยังไม่ได้ทบทวน)" items={l.added_since} tone="added" />
                            <ItemList title="ยกเลิกในระบบแล้วหลังส่ง" items={l.retired_since} tone="retired" />
                            {l.note && <p className="mt-1 text-xs text-gray-500">หมายเหตุ: {l.note}</p>}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
