'use client';

import { useEffect, useState } from 'react';
import { useSessionContext } from '@/app/context/SessionContext';
import type { ClearPendingItem } from './types';

/** ใบที่รอเราอนุมัติการเคลียร์ พร้อมข้อมูลไว้แสดงการ์ดในแท็บรออนุมัติเคลียร์ */
export function useClearPendingItems(refreshKey: unknown = 0): ClearPendingItem[] | null {
  const { user } = useSessionContext();
  const [items, setItems] = useState<ClearPendingItem[] | null>(null);
  useEffect(() => {
    if (!user?.employee_id) return;
    let alive = true;
    fetch('/api/finance/clear-approvals/pending', { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : []))
      .then((rows: ClearPendingItem[]) => { if (alive) setItems(Array.isArray(rows) ? rows : []); })
      .catch(() => { if (alive) setItems([]); });
    return () => { alive = false; };
  }, [user?.employee_id, refreshKey]);
  return items;
}

/** เลขที่ใบที่รอเราอนุมัติการเคลียร์ — ใช้ตัดสินว่าจะโชว์แผงอนุมัติไหม */
export function useClearApprovals(refreshKey: unknown = 0): string[] | null {
  const items = useClearPendingItems(refreshKey);
  return items === null ? null : items.map(i => i.form_id);
}
