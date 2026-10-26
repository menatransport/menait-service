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

export type AdvanceAction = 'voucher' | 'pay' | 'clear' | 'send-back' | 'confirm' | 'return' | 'reject-voucher' | 'resubmit'
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

/** แจ้งบันทึกสำเร็จแล้วปิดเอง — ผู้ใช้ยืนยันมาแล้วรอบหนึ่ง ไม่ต้องกด "ตกลง" ซ้ำอีกรอบ */
export const showSuccess = (title: string, text?: string) =>
  fire({ icon: 'success', title, text, timer: text ? 2200 : 1500, showConfirmButton: false });

export const showConfirm = (options: Record<string, unknown>) => fire({
  showCancelButton: true, confirmButtonColor: '#1c6ef2', cancelButtonColor: '#d33',
  confirmButtonText: 'ยืนยัน', cancelButtonText: 'ยกเลิก', ...options,
});

const escapeHtml = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** [หัวข้อ, ค่า] — ค่าว่างแสดงเป็น "-" */
export type ReviewRow = [label: string, value: string | number | null | undefined];

/**
 * ป๊อปอัปทบทวนก่อนบันทึก/ส่ง: ตารางสรุปค่าที่จะบันทึกให้ผู้ใช้ตรวจอีกรอบ กดยืนยันแล้วค่อยบันทึกจริง
 * (Bew 26/10/2026: ปุ่มบันทึก/ส่งทุกจุดใน Finance ต้องมีป๊อปอัปทบทวนก่อน)
 */
export async function confirmReview({ title, rows, note, warning, confirmButtonText = 'ยืนยันบันทึก' }: {
  title: string; rows: ReviewRow[]; note?: string;
  /** คำเตือนที่ต้องเห็นก่อนยืนยัน เช่น เลขเอกสารซ้ำ — รวมไว้ในป๊อปอัปเดียว ไม่ถามแยกอีกรอบ */
  warning?: string | null; confirmButtonText?: string;
}): Promise<boolean> {
  const body = rows.map(([label, value]) => {
    const text = value === null || value === undefined || String(value).trim() === '' ? '-' : String(value);
    return `<tr><th style="padding:6px 12px 6px 0;width:40%;vertical-align:top;font-weight:400;color:#64748b">${escapeHtml(label)}</th>`
      + `<td style="padding:6px 0;color:#1e293b;font-weight:500;white-space:pre-line;word-break:break-word">${escapeHtml(text)}</td></tr>`;
  }).join('');
  const html = (warning ? `<p style="margin:0 0 12px;padding:8px 12px;border:1px solid #f59e0b;border-radius:6px;font-size:13px;color:#92400e;text-align:left">${escapeHtml(warning)}</p>` : '')
    + `<table style="width:100%;border-collapse:collapse;font-size:14px;text-align:left;border-top:1px solid #e2e8f0;border-bottom:1px solid #e2e8f0">${body}</table>`
    + (note ? `<p style="margin:12px 0 0;font-size:12px;color:#64748b;text-align:left">${escapeHtml(note)}</p>` : '');
  const res = await showConfirm({ icon: warning ? 'warning' : 'question', title, html, confirmButtonText, cancelButtonText: 'กลับไปแก้ไข' });
  return Boolean(res.isConfirmed);
}

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

/**
 * เลขซ้ำกับใบอื่นไหม (ผู้ใช้สั่ง 21/10/2026 แจ้งเมื่อเลขซ้ำ) · คืนข้อความเตือนให้ใส่ใน confirmReview ป๊อปอัปเดียวกัน
 * (26/10/2026: เดิมถามเลขซ้ำแยกอีกป๊อปอัป ผู้ใช้ต้องยืนยันสองรอบ) · null = ไม่ซ้ำ หรือเช็กไม่ได้
 */
export async function duplicateDocNoWarning(field: DocNoField, value: string | null | undefined, formId: string): Promise<string | null> {
  const text = (value ?? '').trim();
  if (!text) return null;
  try {
    const qs = new URLSearchParams({ field, value: text, exclude_form_id: formId });
    const data = await fetchJson<{ form_ids: string[] }>(`/api/finance/advances/duplicate-doc-no?${qs}`);
    const formIds = data.form_ids ?? [];
    return formIds.length ? `เลขนี้ซ้ำกับใบอื่น: ${duplicateText(field, text, formIds)} ตรวจให้แน่ใจก่อนยืนยัน` : null;
  } catch {
    return null;
  }
}
