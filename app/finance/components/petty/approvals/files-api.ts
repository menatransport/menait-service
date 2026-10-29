'use client';

export type ClaimFile = { key: string; fileName?: string; url: string; folder: string };

/** ไฟล์แนบทั้งหมดของใบ (ทุกหมวด) — การ์ดใช้ทั้งโชว์ลิงก์และนับว่าเอกสารครบไหม เรียกครั้งเดียวต่อใบ */
export async function listClaimFiles(formId: string): Promise<ClaimFile[]> {
  try {
    const res = await fetch(`/api/uploads3?form_id=${encodeURIComponent(formId)}`, { cache: 'no-store' });
    if (!res.ok) return [];
    const data = await res.json() as { files?: ClaimFile[] } | ClaimFile[];
    const rows = Array.isArray(data) ? data : (data.files ?? []);
    return rows.map(f => ({ ...f, folder: f.folder ?? 'request' }));
  } catch {
    return [];
  }
}

export function countByFolder(files: readonly ClaimFile[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const f of files) out[f.folder] = (out[f.folder] ?? 0) + 1;
  return out;
}
