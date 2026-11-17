import { describe, expect, test } from 'bun:test';
import { closeExtraProblem, extraProofProblem, pendingProofBanner } from './extraProof';
import { STATUS_LABELS } from './status';
import { OUTSTANDING_STATUSES } from './outstanding';
import { PRINTABLE_STATUSES } from './cashAdvanceForm';
import { DOC_NO_EDIT_STATUSES } from './docNo';

describe('เบิกเพิ่ม: ปิด (รอแนบหลักฐานจากการเงิน) — ผู้ใช้สั่ง 17/11/2026', () => {
  test('ป้ายสถานะ', () => expect(STATUS_LABELS.CLOSED_PENDING_PROOF).toBe('ปิด (รอแนบหลักฐานจากการเงิน)'));
  test('ไม่นับเป็นยอดค้างเคลียร์ · พิมพ์ได้ · แก้เลขเอกสารได้', () => {
    expect((OUTSTANDING_STATUSES as readonly string[]).includes('CLOSED_PENDING_PROOF')).toBe(false);
    expect(PRINTABLE_STATUSES).toContain('CLOSED_PENDING_PROOF');
    expect(DOC_NO_EDIT_STATUSES).toContain('CLOSED_PENDING_PROOF');
  });
  test('บัญชีปิด: วันโอน+สลิปพร้อมกัน หรือไม่ใส่ทั้งคู่', () => {
    expect(closeExtraProblem('', 0)).toBeNull();
    expect(closeExtraProblem('2026-11-17', 1)).toBeNull();
    expect(closeExtraProblem('2026-11-17', 0)).toContain('แนบสลิป');
    expect(closeExtraProblem('', 2)).toContain('วันที่');
  });
  test('การเงินแนบ: ต้องมีวันที่ไม่เกินวันนี้และสลิป', () => {
    expect(extraProofProblem('2026-11-17', 1, '2026-11-17')).toBeNull();
    expect(extraProofProblem('', 1, '2026-11-17')).not.toBeNull();
    expect(extraProofProblem('2026-11-18', 1, '2026-11-17')).not.toBeNull();
    expect(extraProofProblem('2026-11-17', 0, '2026-11-17')).not.toBeNull();
  });
  test('แถบบอกยอดโอนเพิ่ม เฉพาะสถานะนี้', () => {
    expect(pendingProofBanner('CLOSED_PENDING_PROOF', -600)).toBe('บัญชีปิดรายการแล้ว รอการเงินโอนเงินเพิ่ม 600.00 บาท และแนบหลักฐาน');
    expect(pendingProofBanner('CLOSED', -600)).toBeNull();
  });
});
