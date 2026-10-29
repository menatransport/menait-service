'use client';

import type { PettyRound } from '@/app/finance/types-petty';
import { ApiError } from '@/lib/finance/api-error';
import { formatBaht } from '@/lib/finance/status';
import { fetchJson, showAlert, showConfirm, showSuccess } from '../../../api';
import { postRoundAction } from '../../../petty-api';

type Prompt = { isConfirmed?: boolean; value?: string };

const roundLine = (r: PettyRound) =>
  `รอบ ${r.batch_no} · ${r.claim_count ?? r.claims?.length ?? 0} ใบ รวม ${formatBaht(r.total_amount)} บาท`;

/**
 * หัวหน้าอนุมัติ / ไม่อนุมัติเคลียร์ทั้งรอบ — กล่องยืนยันแบบหน้าอนุมัติ Advance (ไม่อนุมัติต้องมีหมายเหตุ)
 * คืน 'done' เมื่อสำเร็จ · 'failed' เมื่อ BE ปฏิเสธ (ผู้เรียกควรโหลดคิวใหม่ เผื่อมีคนกดไปก่อน) · 'cancelled'
 */
export async function decideRound(round: PettyRound, action: 'clear-approve' | 'clear-reject'): Promise<'done' | 'failed' | 'cancelled'> {
  const approve = action === 'clear-approve';
  const res = (approve
    ? await showConfirm({ title: 'ยืนยันอนุมัติเคลียร์เงินสดย่อย', text: roundLine(round) })
    : await showConfirm({
      title: 'ยืนยันไม่อนุมัติเคลียร์เงินสดย่อย', text: roundLine(round), input: 'textarea',
      inputLabel: 'หมายเหตุ (ระบุเหตุผล)', inputPlaceholder: 'เจ้าของเงินสดจะเห็นข้อความนี้ แล้วจัดรอบใหม่',
      inputValidator: (v: string) => (!v || !v.trim() ? 'กรุณาระบุหมายเหตุ' : undefined),
    })) as Prompt;
  if (!res?.isConfirmed) return 'cancelled';
  try {
    await postRoundAction(round.id, action, approve ? {} : { reason: (res.value ?? '').trim() });
    await showSuccess(approve ? 'อนุมัติเคลียร์แล้ว' : 'ไม่อนุมัติรอบนี้แล้ว',
      approve ? 'รอบนี้ไปให้บัญชีตรวจต่อ' : 'ใบกลับไปให้เจ้าของเงินสดจัดรอบใหม่');
    return 'done';
  } catch (err) {
    const api = err instanceof ApiError ? err : null;
    await showAlert({ icon: 'error', title: approve ? 'อนุมัติไม่สำเร็จ' : 'ไม่อนุมัติไม่สำเร็จ',
      text: api?.message ?? (err as Error).message ?? 'ลองใหม่อีกครั้ง' });
    return 'failed';
  }
}

/**
 * รอบที่ฉันอนุมัติ/ไม่อนุมัติไปแล้ว — ต้องให้ BFF รับ view=clear_history แล้วส่ง cleared_by=<ฉัน> ไป BE
 * (ยังไม่มีตอน lane B · BFF ตอนนี้ตีความ view แปลก ๆ เป็นรอบของกองทุนที่ฉันถือ) ผู้เรียกกรอง clear_approved_by อีกชั้นเสมอ
 */
export async function listClearHistory(): Promise<PettyRound[]> {
  return fetchJson<PettyRound[]>('/api/finance/petty/batches?view=clear_history&limit=200');
}
