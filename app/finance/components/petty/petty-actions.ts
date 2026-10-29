'use client';

import type { PettyClaim, PettySpec } from '@/app/finance/types-petty';
import { ApiError } from '@/lib/finance/api-error';
import { bangkokDate } from '@/lib/finance/petty-doc';
import { showAlert, showConfirm } from '../../api';
import { countAttachments, postAction, type PettyAction } from '../../petty-api';

type Prompt = { isConfirmed?: boolean; value?: string };

/**
 * เปลี่ยนสถานะใบหนึ่งใบจากปุ่มลัดในตารางหรือแผงรายละเอียด — ถามสิ่งที่ต้องกรอก (เหตุผล วันที่จ่าย เลข DD)
 * แล้วส่งให้ BE ตัดสิน · ด่านเอกสาร/ซ้ำตอบกลับมาเป็นรายการให้คนอ่าน ซ้ำอ่อนขอเหตุผลแล้วยิงซ้ำให้เอง
 * คืน true เมื่อสถานะเปลี่ยน (ผู้เรียกค่อยโหลดใหม่)
 */
export async function runPettyAction(claim: PettyClaim, action: PettyAction, opts: {
  spec?: PettySpec | null;
  /** review เท่านั้น: ผ่าน (true) หรือส่งกลับ (false) */
  pass?: boolean;
} = {}): Promise<boolean> {
  const body: Record<string, unknown> = {};
  const baht = claim.amount.toLocaleString('th-TH', { minimumFractionDigits: 2 });

  if (action === 'approve') {
    // flow v2: อนุมัติ = จ่ายเงินในจังหวะเดียวกัน — ถามวันที่จ่าย (สลิปโอนอยู่ในด่านเอกสารอยู่แล้ว)
    body.attachments = await countAttachments(claim.form_id);
    const res = await showConfirm({ title: `อนุมัติจ่าย ${baht} บาท`, text: `ใบ ${claim.form_id} · ${claim.payee_name ?? ''}`,
      input: 'date', inputLabel: 'วันที่จ่ายเงิน', inputValue: bangkokDate(new Date().toISOString()),
      inputValidator: (v: string) => (!v ? 'ต้องระบุวันที่จ่าย' : null), confirmButtonText: 'อนุมัติจ่าย' }) as Prompt;
    if (!res?.isConfirmed) return false;
    body.transfer_date = res.value;
  }

  if (action === 'return') {
    const res = await showConfirm({ title: `ตีกลับใบ ${claim.form_id}`, input: 'textarea',
      inputLabel: 'เหตุผล (เจ้าหน้าที่จะเห็นข้อความนี้)',
      inputValidator: (v: string) => (!v || !v.trim()) ? 'ต้องระบุเหตุผล' : null, confirmButtonText: 'ตีกลับ' }) as Prompt;
    if (!res?.isConfirmed) return false;
    body.reason = res.value;
  }
  if (action === 'dd') {
    const res = await showConfirm({ title: `เลข DD ของใบ ${claim.form_id}`, input: 'text',
      inputLabel: 'เลขที่ใบรับสินค้า (DD) จาก ATMS', inputPlaceholder: 'LBDD26090931', inputValue: claim.dd_no ?? '',
      inputValidator: (v: string) => (!v || !v.trim()) ? 'ต้องกรอกเลข DD' : null, confirmButtonText: 'บันทึก' }) as Prompt;
    if (!res?.isConfirmed) return false;
    body.dd_no = (res.value ?? '').trim().toUpperCase();
  }
  if (action === 'review') {
    body.action = opts.pass ? 'PASS' : 'SEND_BACK';
    if (opts.pass) {
      const res = await showConfirm({ title: `ตรวจผ่าน ใบ ${claim.form_id}`,
        text: `${baht} บาท · ผ่านครบทั้งรอบเมื่อไร ตั้งเบิกได้เลย`, confirmButtonText: 'ผ่าน' }) as Prompt;
      if (!res?.isConfirmed) return false;
    } else {
      const res = await showConfirm({ title: `ตีกลับใบ ${claim.form_id}`, input: 'textarea',
        inputLabel: 'เหตุผล (เจ้าหน้าที่ผู้เปิดใบจะเห็น แก้แล้วส่งกลับมาที่บัญชีได้เลย)',
        inputValidator: (v: string) => (!v || !v.trim()) ? 'ต้องระบุเหตุผล' : null, confirmButtonText: 'ตีกลับ' }) as Prompt;
      if (!res?.isConfirmed) return false;
      body.remark = res.value;
    }
  }

  try {
    await postAction(claim.form_id, action, body);
    return true;
  } catch (err) {
    // 403 = เอกสารไม่ครบ · 409 = ซ้ำเข้ม หรือสถานะเปลี่ยนไปแล้ว · 422 = ซ้ำอ่อน ต้องกรอกเหตุผล
    const api = err instanceof ApiError ? err : null;
    const lines = [
      ...(api?.missing ?? []).map(m => `• ${m.label ?? m.key}`),
      ...(api?.duplicates ?? []).map(d => `• ${d.message}${d.form_id ? ` (ใบ ${d.form_id})` : ''}`),
    ];
    if (api?.status === 422 && api.duplicates?.length && action === 'approve') {
      const res = await showConfirm({ icon: 'warning', title: 'มีรายการที่อาจซ้ำ', text: lines.join('\n'),
        input: 'textarea', inputLabel: 'เหตุผลที่ยืนยันทับ',
        inputValidator: (v: string) => (!v || !v.trim()) ? 'ต้องระบุเหตุผล' : null, confirmButtonText: 'ยืนยันอนุมัติ' }) as Prompt;
      if (!res?.isConfirmed) return false;
      try {
        await postAction(claim.form_id, 'approve', { ...body, dup_override_reason: res.value });
        return true;
      } catch (err2) {
        showAlert({ icon: 'error', title: 'อนุมัติไม่สำเร็จ', text: (err2 as Error).message });
        return false;
      }
    }
    showAlert({ icon: 'error', title: api?.message ?? 'ทำรายการไม่สำเร็จ',
      text: lines.length ? lines.join('\n') : (err as Error).message });
    return false;
  }
}
