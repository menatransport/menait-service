'use client';

import { useEffect, useState } from 'react';
import { useSessionContext } from '@/app/context/SessionContext';
import type { PermissionState } from '@/lib/finance/permissions';

/** สิทธิ์ตามหน้าที่ของผู้ใช้ปัจจุบัน — null ระหว่างโหลด (ยังไม่ซ่อนปุ่ม) */
export function useFinancePermissions(): PermissionState | null {
  const { user } = useSessionContext();
  const [state, setState] = useState<PermissionState | null>(null);

  useEffect(() => {
    if (!user?.is_finance) return;
    let alive = true;
    fetch('/api/finance/permissions/me', { cache: 'no-store' })
      .then(res => (res.ok ? res.json() : { permissions: [], unavailable: true }))
      .then(data => { if (alive) setState({ permissions: data?.permissions ?? [], unavailable: data?.unavailable }); })
      .catch(() => { if (alive) setState({ permissions: [], unavailable: true }); });
    return () => { alive = false; };
  }, [user?.is_finance]);

  return state;
}
