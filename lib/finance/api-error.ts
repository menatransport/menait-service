type Detail = { label?: string; key?: string; line_no?: number; message?: string; form_id?: string | null };

/** ร่าง body ของ error response จากสิ่งที่ BE ตอบมา
 *  BE ของด่านเอกสารตอบ detail เป็น object ({error, missing, duplicates}) — ถ้ายุบเป็นสตริง
 *  หน้าจอจะบอกไม่ได้ว่าขาดอะไร ซึ่งเป็นทั้งหมดที่ด่านนี้มีไว้ทำ */
export function errorBodyFrom(data: unknown, fallback: string): { error: string } & Record<string, unknown> {
  const detail = (data as { detail?: unknown } | null)?.detail;
  if (typeof detail === 'string') return { error: detail };
  if (detail && typeof detail === 'object' && !Array.isArray(detail)) {
    const obj = detail as Record<string, unknown>;
    const error = typeof obj.error === 'string' ? obj.error : fallback;
    return { ...obj, error };
  }
  return { error: fallback };
}

export class ApiError extends Error {
  status: number;
  missing?: Detail[];
  duplicates?: Detail[];
  body: Record<string, unknown> | null;

  constructor(status: number, message: string, body: Record<string, unknown> | null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
    this.missing = Array.isArray(body?.missing) ? body!.missing as Detail[] : undefined;
    this.duplicates = Array.isArray(body?.duplicates) ? body!.duplicates as Detail[] : undefined;
  }
}

export function apiErrorFrom(status: number, body: unknown): ApiError {
  const obj = (body && typeof body === 'object') ? body as Record<string, unknown> : null;
  const message = typeof obj?.error === 'string' ? obj.error : `เกิดข้อผิดพลาด (${status})`;
  return new ApiError(status, message, obj);
}
