/**
 * เบิกเพิ่ม (บริษัทต้องโอนเพิ่มให้ผู้เบิก) — ผู้ใช้สั่ง 17/11/2026
 * บัญชีปิดได้เลยโดยไม่ต้องรอวันโอน → "ปิด (รอแนบหลักฐานจากการเงิน)" แล้วการเงินแนบสลิป + วันที่โอน → ปิดแล้ว
 */
export const PENDING_PROOF = 'CLOSED_PENDING_PROOF';

/** ตอนบัญชีปิด: ใส่วันโอนกับสลิปพร้อมกัน (ปิดเลย) หรือไม่ใส่ทั้งคู่ (รอการเงิน) · null = ผ่าน */
export function closeExtraProblem(extraDate: string, fileCount: number): string | null {
  if (extraDate && fileCount === 0) return 'ใส่วันโอนเพิ่มแล้ว แนบสลิปด้วย หรือเว้นว่างทั้งคู่ให้การเงินแนบทีหลัง';
  if (!extraDate && fileCount > 0) return 'แนบสลิปแล้ว ใส่วันที่การเงินโอนเพิ่มด้วย หรือเอาสลิปออกให้การเงินแนบทีหลัง';
  return null;
}

/** ตอนการเงินแนบหลักฐาน · null = ผ่าน */
export function extraProofProblem(date: string, fileCount: number, today: string): string | null {
  if (!date) return 'ใส่วันที่โอนเงินเพิ่ม';
  if (date > today) return 'วันที่โอนต้องไม่เกินวันนี้';
  if (fileCount === 0) return 'แนบสลิปโอนเงินเพิ่มอย่างน้อย 1 ไฟล์';
  return null;
}

/** แถบบอกทุกคนที่เปิดใบ */
export function pendingProofBanner(status: string | undefined, settleAmount: number | null | undefined): string | null {
  if (status !== PENDING_PROOF) return null;
  const extra = Math.abs(Number(settleAmount ?? 0));
  return `บัญชีปิดรายการแล้ว รอการเงินโอนเงินเพิ่ม ${extra.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} บาท และแนบหลักฐาน`;
}
