'use client';

import { uniqueFileName } from '@/lib/finance/status';
import { duplicateText, type DocNoField } from '@/lib/finance/docNo';
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

export type AdvanceAction = 'voucher' | 'pay' | 'clear' | 'send-back' | 'confirm' | 'return' | 'resubmit'
  | 'clear-approve' | 'clear-reject';

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

// SweetAlert จำค่า aria-hidden ตอนเปิด แล้วคืนค่าตอนปิด ถ้าเปิดตอน Dialog/Sheet ของ Radix ยังค้างอยู่ มันจะคืน aria-hidden="true"
// ให้หน้าหลักทั้งที่ Dialog ปิดไปแล้ว โปรแกรมอ่านหน้าจอและ getByRole มองไม่เห็นทั้งหน้า ล้างทิ้งเมื่อไม่มี Dialog เปิดอยู่
export function clearStaleAriaHidden(doc: Document = document): void {
  if (doc.querySelector('[role="dialog"][data-state="open"], .swal2-container')) return;
  for (const el of Array.from(doc.body.children)) {
    if (el.getAttribute('aria-hidden') === 'true' && !el.hasAttribute('data-radix-focus-guard')) el.removeAttribute('aria-hidden');
  }
}

const fire = (options: Record<string, unknown>) =>
  import('sweetalert2').then(({ default: Swal }) => {
    const didDestroy = options.didDestroy as (() => void) | undefined;
    return Swal.fire({ ...options, didDestroy: () => { didDestroy?.(); setTimeout(() => clearStaleAriaHidden(), 0); } });
  });

export const showAlert = (options: Record<string, unknown>) => fire({ confirmButtonText: 'ตกลง', ...options });

export const showConfirm = (options: Record<string, unknown>) => fire({
  showCancelButton: true, confirmButtonColor: '#1c6ef2', cancelButtonColor: '#d33',
  confirmButtonText: 'ยืนยัน', cancelButtonText: 'ยกเลิก', ...options,
});

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

export interface OverdueReminderResult { sent: number; skipped: { form_id: string; reason: string }[]; disabled: boolean }

export function sendOverdueReminders(formIds: string[]) {
  return fetchJson<OverdueReminderResult>('/api/finance/overdue-reminders', {
    method: 'POST',
    body: JSON.stringify({ form_ids: formIds }),
  });
}

/** เลขซ้ำกับใบอื่นไหม ถ้าซ้ำถามก่อนว่าจะใช้ต่อหรือไม่ · true = บันทึกต่อได้ (ผู้ใช้สั่ง 21/10/2026 แจ้งเมื่อเลขซ้ำ) */
export async function confirmUniqueDocNo(field: DocNoField, value: string | null | undefined, formId: string): Promise<boolean> {
  const text = (value ?? '').trim();
  if (!text) return true;
  let formIds: string[] = [];
  try {
    const qs = new URLSearchParams({ field, value: text, exclude_form_id: formId });
    const data = await fetchJson<{ form_ids: string[] }>(`/api/finance/advances/duplicate-doc-no?${qs}`);
    formIds = data.form_ids ?? [];
  } catch {
    return true;
  }
  if (!formIds.length) return true;
  const ok = await showConfirm({ icon: 'warning', title: 'เลขนี้ซ้ำกับใบอื่น', text: `${duplicateText(field, text, formIds)} ใช้เลขนี้ต่อไหม`,
    confirmButtonText: 'ใช้เลขนี้ต่อ', cancelButtonText: 'กลับไปแก้' });
  return Boolean(ok.isConfirmed);
}
