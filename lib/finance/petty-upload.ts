import { canCloseBatch, canSeeRound, canUploadRoundSlip } from './petty-access';
import type { PettyStatus } from '@/lib/finance/petty-status';

/** หมวดไฟล์แนบที่ spec ของประเภทการเบิกใช้ได้ — คุมที่นี่เพราะ /api/uploads3 ไม่รู้จัก spec
 *  เพิ่มหมวดใหม่ใน master ต้องเพิ่มที่นี่ด้วย ไม่งั้นอัปโหลดไม่ได้ (ปลอดภัยกว่าเปิดอิสระ) */
export const PETTY_FOLDERS =
  ['weigh_slip', 'transfer', 'receipt', 'receipt_substitute', 'photo', 'id_card', 'request_form', 'map', 'other'] as const;

export function isPettyFolder(folder: unknown): boolean {
  return typeof folder === 'string' && (PETTY_FOLDERS as readonly string[]).includes(folder);
}

/** สถานะที่ยังรับไฟล์เพิ่มได้ — บัญชีตรวจผ่านแล้ว (REVIEWED/CLOSED) ไม่รับ · ระหว่างรอหัวหน้ายังแนบเพิ่มได้ */
const OPEN_FOR_FILES: PettyStatus[] = [
  'PENDING_HEAD', 'PENDING_APPROVAL', 'RETURNED', 'APPROVED', 'CLEAR_PENDING', 'AWAITING_REVIEW', 'SENT_BACK', 'TRANSFERRED',
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

// ---- สลิปโอนของรอบส่งเคลียร์ (การเงินจ่ายทั้งรอบ) — S3 menait-service/<เลขรอบ>/pay/
// เลขรอบมาพร้อม round_id: route ถามรอบจาก BE ด้วย id แล้วต้องได้เลขรอบตรงกัน ไม่งั้นเขียนข้ามรอบได้

type RoundUser = Parameters<typeof canSeeRound>[0];
type RoundLike = {
  batch_no: string; status: string; holder_employee_id: string | null; clear_approved_by: string | null; can_clear?: boolean | null;
};
export type UploadProblem = { status: number; error: string };

const ROUND_ID = /^\d{1,9}$/;

function roundMismatch(round: RoundLike | null, formId: string, roundId: string | null | undefined): UploadProblem | null {
  if (!roundId || !ROUND_ID.test(roundId)) return { status: 400, error: 'เลขรอบไม่ถูกต้อง' };
  if (!round) return { status: 404, error: 'ไม่พบรอบส่งเคลียร์' };
  if (round.batch_no !== formId) return { status: 400, error: 'เลขรอบไม่ตรงกับรอบที่เลือก' };
  return null;
}

/** แนบสลิปโอนเข้ารอบได้ไหม — null = ได้ */
export function roundUploadProblem(opts: {
  user: RoundUser; round: RoundLike | null; formId: string; folder: string; roundId: string | null | undefined;
}): UploadProblem | null {
  if (opts.folder !== 'pay') return { status: 400, error: 'โฟลเดอร์ไม่ถูกต้อง' };
  const bad = roundMismatch(opts.round, opts.formId, opts.roundId);
  if (bad) return bad;
  if (!canCloseBatch(opts.user)) return { status: 403, error: 'แนบสลิปโอนของรอบได้เฉพาะฝ่ายการเงิน' };
  if (!canUploadRoundSlip(opts.user, opts.round)) return { status: 409, error: 'รอบนี้ยังไม่ถึงขั้นจ่ายเงิน' };
  return null;
}

/** ดูไฟล์ของรอบได้ไหม — คนที่เปิดดูรอบได้ (เจ้าของเงินสด หัวหน้า บัญชี การเงิน แอดมิน) */
export function roundListProblem(opts: {
  user: RoundUser; round: RoundLike | null; formId: string; roundId: string | null | undefined;
}): UploadProblem | null {
  const bad = roundMismatch(opts.round, opts.formId, opts.roundId);
  if (bad) return bad;
  return canSeeRound(opts.user, opts.round!) ? null : { status: 403, error: 'ไม่มีสิทธิ์ดูรอบนี้' };
}
