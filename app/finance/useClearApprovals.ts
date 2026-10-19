'use client';

import { useEffect, useState } from 'react';
import { useSessionContext } from '@/app/context/SessionContext';

/** ใบที่รอเราอนุมัติการเคลียร์ — ใช้ตัดสินว่าจะโชว์แผงอนุมัติไหม */
export function useClearApprovals(refreshKey: unknown = 0): string[] | null {
  const { user } = useSessionContext();
  const [ids, setIds] = useState<string[] | null>(null);
  useEffect(() => {
    if (!user?.employee_id) return;
    let alive = true;
    fetch('/api/finance/clear-approvals/pending', { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : []))
      .then((rows: { form_id: string }[]) => { if (alive) setIds(rows.map(r => r.form_id)); })
      .catch(() => { if (alive) setIds([]); });
    return () => { alive = false; };
  }, [user?.employee_id, refreshKey]);
  return ids;
}
