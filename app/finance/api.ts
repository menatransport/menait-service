'use client';

import { uniqueFileName } from '@/lib/finance/status';
import type { AdvanceDetail } from './types';

export async function fetchJson<T>(url: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(url, {
    cache: 'no-store',
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error ?? `เกิดข้อผิดพลาด (${res.status})`);
  return data as T;
}

export type AdvanceAction = 'voucher' | 'pay' | 'clear' | 'send-back' | 'confirm' | 'reject-voucher';

export function putAction(formId: string, action: AdvanceAction, body: Record<string, unknown>) {
  return fetchJson<AdvanceDetail>(`/api/finance/advances/${encodeURIComponent(formId)}`, {
    method: 'PUT',
    body: JSON.stringify({ action, ...body }),
  });
}

/** Uploads sequentially; returns names of files that failed. */
export async function uploadFiles(formId: string, files: File[], folder?: 'voucher' | 'pay' | 'clear' | 'check'): Promise<string[]> {
  const failed: string[] = [];
  for (const file of files) {
    const fd = new FormData();
    fd.append('form_id', formId);
    if (folder) fd.append('folder', folder);
    fd.append('file', new File([file], uniqueFileName(file.name, Date.now()), { type: file.type }));
    try {
      const res = await fetch('/api/uploads3', { method: 'POST', body: fd });
      if (!res.ok) failed.push(file.name);
    } catch {
      failed.push(file.name);
    }
  }
  return failed;
}

export const showAlert = (options: Record<string, unknown>) =>
  import('sweetalert2').then(({ default: Swal }) => Swal.fire({ confirmButtonText: 'ตกลง', ...options }));

export const showConfirm = (options: Record<string, unknown>) =>
  import('sweetalert2').then(({ default: Swal }) => Swal.fire({
    showCancelButton: true, confirmButtonColor: '#1c6ef2', cancelButtonColor: '#d33',
    confirmButtonText: 'ยืนยัน', cancelButtonText: 'ยกเลิก', ...options,
  }));

/** Uploads bookbank files to a payee request one by one (multipart field "file"); returns names that failed. */
export async function uploadPayeeFiles(requestId: number | string, files: File[]): Promise<string[]> {
  const failed: string[] = [];
  for (const file of files) {
    const fd = new FormData();
    fd.append('file', file);
    try {
      const res = await fetch(`/api/finance/payee-requests/${encodeURIComponent(String(requestId))}/files`, { method: 'POST', body: fd });
      if (!res.ok) failed.push(file.name);
    } catch {
      failed.push(file.name);
    }
  }
  return failed;
}
