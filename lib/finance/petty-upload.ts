import type { PettyStatus } from '@/lib/finance/petty-status';

/** หมวดไฟล์แนบที่ spec ของประเภทการเบิกใช้ได้ — คุมที่นี่เพราะ /api/uploads3 ไม่รู้จัก spec
 *  เพิ่มหมวดใหม่ใน master ต้องเพิ่มที่นี่ด้วย ไม่งั้นอัปโหลดไม่ได้ (ปลอดภัยกว่าเปิดอิสระ) */
export const PETTY_FOLDERS =
  ['weigh_slip', 'transfer', 'receipt', 'photo', 'id_card', 'request_form', 'map', 'other'] as const;

export function isPettyFolder(folder: unknown): boolean {
  return typeof folder === 'string' && (PETTY_FOLDERS as readonly string[]).includes(folder);
}

/** สถานะที่ยังรับไฟล์เพิ่มได้ — ปิดรอบแล้วไม่รับ เพราะบัญชีตรวจไปแล้ว */
const OPEN_FOR_FILES: PettyStatus[] = [
  'PENDING_APPROVAL', 'RETURNED', 'APPROVED', 'TRANSFERRED', 'AWAITING_REVIEW', 'SENT_BACK',
];

/**
 * ใครแนบไฟล์เข้าใบเงินสดย่อยได้: เจ้าหน้าที่ผู้เปิดใบ, ผู้ถือกองทุนของใบนั้น (ต้องแนบสลิปโอน), แอดมิน
 * การเป็นฝ่ายบัญชี/การเงินไม่ให้สิทธิ์แนบ เพราะหลักฐานเป็นของสองคนนั้น
 * โหลดใบไม่ได้ = ปฏิเสธ (fail closed)
 */
export function canUploadPettyFile(opts: {
  user: { employee_id?: string | null; is_finance?: boolean | null; role?: string | null };
  claim: { created_by: string; fund_id: number; status: PettyStatus } | null;
  fund: { id: number; holder_employee_id: string } | null;
}): boolean {
  const { user, claim, fund } = opts;
  if (!user?.employee_id || !claim) return false;
  if (!OPEN_FOR_FILES.includes(claim.status)) return false;
  if (user.role === 'a') return true;
  if (claim.created_by === user.employee_id) return true;
  return !!fund && fund.id === claim.fund_id && fund.holder_employee_id === user.employee_id;
}

/** ใบเงินสดย่อยรับแค่รูปกับ PDF — หลักฐานจริงมีแค่นั้น ไฟล์โปรแกรม/ซิปไม่ใช่หลักฐาน */
export const PETTY_EXTENSIONS = ['jpg', 'jpeg', 'png', 'heic', 'heif', 'webp', 'pdf'] as const;
export const PETTY_MAX_BYTES = 10 * 1024 * 1024;

/** ข้อความบอกว่าทำไมรับไฟล์นี้ไม่ได้ — null = รับได้ */
export function pettyFileProblem(name: string, size: number): string | null {
  const ext = name.includes('.') ? name.slice(name.lastIndexOf('.') + 1).toLowerCase() : '';
  if (!(PETTY_EXTENSIONS as readonly string[]).includes(ext)) {
    return 'รับเฉพาะรูปภาพ (jpg, png, heic, webp) หรือ PDF';
  }
  if (size > PETTY_MAX_BYTES) return 'ไฟล์ใหญ่เกิน 10 MB';
  return null;
}

type SpecLike = { attachments?: { key: string; max?: number }[] | null } | null | undefined;

/** หมวดนี้เต็มตาม max ของ spec แล้วหรือยัง — หมวดที่ spec ไม่กำหนด max (หรือไม่รู้จัก) ไม่มีวันเต็ม */
export function folderIsFull(spec: SpecLike, folder: string, existing: number): boolean {
  const entry = spec?.attachments?.find(a => a.key === folder);
  return entry?.max !== undefined && existing >= entry.max;
}

/** กุญแจ S3 ที่จะลบต้องเป็นไฟล์ใต้ใบนี้เท่านั้น ไม่ใช่ใบอื่น ไม่ใช่โฟลเดอร์ ไม่มี .. */
export function pettyKeyBelongsTo(key: string, formId: string, basePath = 'menait-service'): boolean {
  const prefix = `${basePath}/${formId}/`;
  if (!key.startsWith(prefix) || key.endsWith('/')) return false;
  return !key.split('/').some(seg => seg === '' || seg === '.' || seg === '..');
}
