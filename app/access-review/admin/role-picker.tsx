'use client';

import { useEffect, useMemo, useState } from 'react';
import { Check, Search } from 'lucide-react';
import { adminListRoles } from '../api';
import type { AdminRole } from '../types';

/**
 * Pick one role of a system to copy from — a searchable list with item counts, so IT can tell
 * "ACC-Officer (216)" from "ACC-Manager (438)" before copying.
 */
export function RolePicker({ systemId, excludeId, value, onChange }: {
    systemId: number | null;
    excludeId?: number;
    value: AdminRole | null;
    onChange: (role: AdminRole | null) => void;
}) {
    const [roles, setRoles] = useState<{ systemId: number; list: AdminRole[] } | null>(null);
    const [q, setQ] = useState('');

    useEffect(() => {
        if (systemId == null) return;
        let alive = true;
        adminListRoles({ system_id: systemId })
            .then(list => { if (alive) setRoles({ systemId, list }); })
            .catch(() => { if (alive) setRoles({ systemId, list: [] }); });
        return () => { alive = false; };
    }, [systemId]);

    const list = roles && roles.systemId === systemId ? roles.list : null;
    const shown = useMemo(() => {
        const needle = q.trim().toLowerCase();
        return (list ?? []).filter(r => r.id !== excludeId && (!needle || r.name.toLowerCase().includes(needle)));
    }, [list, q, excludeId]);

    return (
        <div className="rounded-lg border border-gray-200">
            <div className="relative border-b border-gray-100">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-gray-400" />
                <input
                    value={q}
                    onChange={e => setQ(e.target.value)}
                    placeholder="ค้นหากลุ่มสิทธิ์ต้นทาง..."
                    className="h-9 w-full rounded-t-lg bg-white pl-8 pr-3 text-sm text-gray-700 placeholder:text-gray-400 outline-none"
                />
            </div>
            <div className="max-h-56 overflow-y-auto">
                {list === null ? (
                    <p className="px-3 py-4 text-center text-xs text-gray-400">กำลังโหลด...</p>
                ) : shown.length === 0 ? (
                    <p className="px-3 py-4 text-center text-xs text-gray-400">ไม่พบกลุ่มสิทธิ์</p>
                ) : shown.map(r => {
                    const selected = value?.id === r.id;
                    return (
                        <button
                            key={r.id}
                            type="button"
                            onClick={() => onChange(selected ? null : r)}
                            className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm cursor-pointer border-b border-gray-50 last:border-b-0 ${selected ? 'bg-brand-50 text-brand-700' : 'text-gray-700 hover:bg-gray-50'}`}
                        >
                            <span className={`flex size-4 shrink-0 items-center justify-center rounded border ${selected ? 'border-brand-600 bg-brand-600 text-white' : 'border-gray-300'}`}>
                                {selected && <Check className="size-3" />}
                            </span>
                            <span className="min-w-0 flex-1 truncate">{r.name}</span>
                            <span className="shrink-0 text-xs text-gray-400 tabular-nums">{r.item_count.toLocaleString()} รายการ</span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
