import type { PettyBalance, PettyClaim, PettyExpenseType, PettyFund } from './types-petty';
import { uniqueFileName } from '@/lib/finance/status';
import { fetchJson } from './api';

export const getExpenseTypes = () =>
  fetchJson<PettyExpenseType[]>('/api/finance/petty/expense-types');

export const getFunds = () => fetchJson<PettyFund[]>('/api/finance/petty/funds');

export const getBalance = (fundId: number) =>
  fetchJson<PettyBalance>(`/api/finance/petty/funds/${fundId}/balance`);

export type ClaimPage = { total: number; items: PettyClaim[] };

export function listClaims(params: Record<string, string | undefined>) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) qs.set(k, v);
  return fetchJson<ClaimPage>(`/api/finance/petty/claims?${qs.toString()}`);
}

export const getClaim = (formId: string) =>
  fetchJson<PettyClaim>(`/api/finance/petty/claims/${encodeURIComponent(formId)}`);

export const createClaim = (body: Record<string, unknown>) =>
  fetchJson<PettyClaim>('/api/finance/petty/claims', { method: 'POST', body: JSON.stringify(body) });

export const updateClaim = (formId: string, body: Record<string, unknown>) =>
  fetchJson<PettyClaim>(`/api/finance/petty/claims/${encodeURIComponent(formId)}`,
    { method: 'PUT', body: JSON.stringify(body) });

export type PettyAction = 'approve' | 'return' | 'transfer' | 'submit-accounting' | 'review';

export const postAction = (formId: string, action: PettyAction, body: Record<string, unknown> = {}) =>
  fetchJson<PettyClaim>(`/api/finance/petty/claims/${encodeURIComponent(formId)}/${action}`,
    { method: 'POST', body: JSON.stringify(body) });

export const closeBatch = (body: { fund_id: number; claim_ids: number[]; remark?: string }) =>
  fetchJson<{ batch_no: string; total_amount: number }>('/api/finance/petty/batches',
    { method: 'POST', body: JSON.stringify(body) });

/** อัปโหลดไฟล์แนบของใบเงินสดย่อย โฟลเดอร์ = key ของหมวดใน spec (ดู lib/finance/petty-upload.ts) */
export async function uploadPettyFiles(formId: string, folder: string, files: File[]): Promise<string[]> {
  const failed: string[] = [];
  for (const file of files) {
    const fd = new FormData();
    fd.append('form_id', formId);
    fd.append('folder', folder);
    fd.append('file', new File([file], uniqueFileName(file.name, Date.now()), { type: file.type }));
    try {
      const res = await fetch('/api/uploads3', { method: 'POST', body: fd });
      if (!res.ok) failed.push(file.name);
    } catch { failed.push(file.name); }
  }
  return failed;
}

/** จำนวนไฟล์ต่อหมวด — BE ใช้ตัวเลขนี้ตรวจด่านเอกสาร (BE ไม่มี client S3 ของตัวเอง) */
export async function countAttachments(formId: string): Promise<Record<string, number>> {
  try {
    const res = await fetch(`/api/uploads3?form_id=${encodeURIComponent(formId)}`, { cache: 'no-store' });
    if (!res.ok) return {};
    const data = await res.json() as { files?: { folder?: string }[] } | { folder?: string }[];
    const rows = Array.isArray(data) ? data : (data.files ?? []);
    const out: Record<string, number> = {};
    for (const row of rows) {
      const key = row?.folder ?? 'request';
      out[key] = (out[key] ?? 0) + 1;
    }
    return out;
  } catch { return {}; }
}

export type DupResult = {
  hard: { line_no?: number; message?: string; form_id?: string | null }[];
  soft: { line_no?: number; message?: string; form_id?: string | null }[];
};

/** ตรวจซ้ำรายแถวขณะกรอก — ทำงานเมื่อมีวันที่ + รถครบแล้ว */
export function checkDuplicate(params: {
  expense_type: string; event_date: string;
  truck_code?: string | null; truck_plate?: string | null; ref_no?: string | null;
  exclude_claim_id?: number | null;
}) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== null && v !== undefined && v !== '') qs.set(k, String(v));
  return fetchJson<DupResult>(`/api/finance/petty/claims/duplicate-check?${qs.toString()}`);
}

export type TruckOption = { truck_code: string; truck_plate: string; truck_type: string };

/** ค้นรถจาก master — เลือกแล้วเติมทะเบียนให้เอง ด่านซ้ำเข้มจึงเชื่อถือทะเบียนได้ */
export function searchTrucks(q: string) {
  return fetchJson<TruckOption[]>(`/api/finance/petty/trucks?q=${encodeURIComponent(q)}`);
}
