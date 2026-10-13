'use client';

import type { PettyClaim, PettySpec } from '@/app/finance/types-petty';
import { ApiError } from '@/lib/finance/api-error';
import { showAlert, showConfirm } from '../../api';
import { countAttachments, postAction, type PettyAction } from '../../petty-api';

type Prompt = { isConfirmed?: boolean; value?: string };

/**
 * เปลี่ยนสถานะใบหนึ่งใบจากปุ่มลัดในตารางหรือแผงรายละเอียด — ถามสิ่งที่ต้องกรอก (เหตุผล วันที่โอน เลข DD)
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

  if (action === 'approve' || action === 'submit-accounting') body.attachments = await countAttachments(claim.form_id);

  if (action === 'return') {
    const res = await showConfirm({ title: `ตีกลับใบ ${claim.form_id}`, input: 'textarea',
      inputLabel: 'เหตุผล (เจ้าหน้าที่จะเห็นข้อความนี้)',
      inputValidator: (v: string) => (!v || !v.trim()) ? 'ต้องระบุเหตุผล' : null, confirmButtonText: 'ตีกลับ' }) as Prompt;
    if (!res?.isConfirmed) return false;
    body.reason = res.value;
  }
  if (action === 'transfer') {
    const res = await showConfirm({ title: `บันทึกการโอน ${baht} บาท`, text: `ใบ ${claim.form_id} · ${claim.payee_name ?? ''}`,
      input: 'date', inputLabel: 'วันที่โอน', inputValue: new Date().toISOString().slice(0, 10),
      inputValidator: (v: string) => (!v ? 'ต้องระบุวันที่โอน' : null), confirmButtonText: 'บันทึก' }) as Prompt;
    if (!res?.isConfirmed) return false;
    body.transfer_date = res.value;
  }
  if (action === 'submit-accounting') {
    // ประเภทที่ต้องมี DD (ชั่ง/ยาง/ซ่อม) และยังไม่ได้กรอก — ถามตรงนี้ ไม่ต้องไปแก้ใบ
    const needsDd = (opts.spec?.prints ?? []).includes('DD') && !claim.dd_no;
    if (needsDd) {
      const res = await showConfirm({ title: `ส่งบัญชี ใบ ${claim.form_id}`, input: 'text',
        inputLabel: 'เลขที่ใบรับสินค้า (DD) จาก ATMS — เว้นว่างได้ถ้ายอดต่ำกว่า 500',
        inputPlaceholder: 'LBDD26090931', confirmButtonText: 'ส่งบัญชี' }) as Prompt;
      if (!res?.isConfirmed) return false;
      if (res.value?.trim()) body.dd_no = res.value.trim().toUpperCase();
    } else {
      const res = await showConfirm({ title: `ส่งบัญชี ใบ ${claim.form_id}`, text: `${baht} บาท · เอกสารจะไปอยู่ในคิวตรวจของบัญชี`,
        confirmButtonText: 'ส่งบัญชี' }) as Prompt;
      if (!res?.isConfirmed) return false;
    }
  }
  if (action === 'review') {
    body.action = opts.pass ? 'PASS' : 'SEND_BACK';
    if (opts.pass) {
      const res = await showConfirm({ title: `ตรวจผ่าน ใบ ${claim.form_id}`, text: `${baht} บาท · การเงินจะปิดรอบคืนยอดได้`,
        confirmButtonText: 'ผ่าน' }) as Prompt;
      if (!res?.isConfirmed) return false;
    } else {
      const res = await showConfirm({ title: `ส่งกลับใบ ${claim.form_id}`, input: 'textarea',
        inputLabel: 'เหตุผล (ผู้อนุมัติและเจ้าหน้าที่จะเห็นข้อความนี้)',
        inputValidator: (v: string) => (!v || !v.trim()) ? 'ต้องระบุเหตุผล' : null, confirmButtonText: 'ส่งกลับ' }) as Prompt;
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
