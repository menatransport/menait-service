'use client';

import type { PettyClaim, PettySpec } from '@/app/finance/types-petty';
import { ApiError } from '@/lib/finance/api-error';
import { needsDebtDoc } from '@/lib/finance/petty-debt';
import { bangkokDate } from '@/lib/finance/petty-doc';
import { transferCalc } from '@/lib/finance/petty-transfer';
import { showAlert, showConfirm } from '../../api';
import { countAttachments, getBalance, postAction, type PettyAction } from '../../petty-api';

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
    const [counts, balance] = await Promise.all([
      countAttachments(claim.form_id), getBalance(claim.fund_id).catch(() => null),
    ]);
    body.attachments = counts;
    // มี พจร. ในใบ (ทุกประเภท) → ต้องมีเลขที่ใบรับสภาพหนี้ อ้างอิงเลขเอกสารอย่างเดียว
    if (needsDebtDoc(claim) && !claim.debt_doc_no) {
      const res = await showConfirm({ title: 'ใบนี้มี พจร.', text: `กรอกเลขที่ใบรับสภาพหนี้ก่อนอนุมัติจ่าย · ใบ ${claim.form_id}`,
        input: 'text', inputLabel: 'เลขที่ใบรับสภาพหนี้', inputPlaceholder: 'เลขที่เอกสาร',
        inputValidator: (v: string) => (!v || !v.trim()) ? 'ต้องกรอกเลขที่ใบรับสภาพหนี้' : null, confirmButtonText: 'ถัดไป' }) as Prompt;
      if (!res?.isConfirmed) return false;
      body.debt_doc_no = (res.value ?? '').trim();
    }
    const res = await showConfirm({ title: `อนุมัติจ่าย ใบ ${claim.form_id}`,
      html: approveSummaryHtml(claim, balance, (body.debt_doc_no as string | undefined) ?? claim.debt_doc_no),
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

const escapeHtml = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const money = (n: number) => n.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * เนื้อหากล่องอนุมัติจ่าย: ยอดคงเหลือของเจ้าของเงินสดก่อน/หลังอนุมัติ และยอดที่ต้องโอนจริงตามผู้รับเงิน
 * (ผู้ใช้สั่ง 29/10/2026) · ตัวเลขภาษีแสดงให้ดูเท่านั้น ไม่บันทึก
 */
export function approveSummaryHtml(claim: PettyClaim,
  balance: { available: number } | null, debtDocNo?: string | null): string {
  const payeeType = typeof claim.detail?.payee_type === 'string' ? claim.detail.payee_type : null;
  const calc = transferCalc(claim.amount, payeeType);
  const rows: string[] = [];
  if (balance) {
    const after = balance.available - claim.amount;
    rows.push(`<div style="display:flex;justify-content:space-between"><span>ยอดคงเหลือของคุณ</span><b>${money(balance.available)} บาท</b></div>`);
    rows.push(`<div style="display:flex;justify-content:space-between"><span>หลังอนุมัติใบนี้</span><b style="color:${after < 0 ? '#be123c' : '#065f46'}">${money(after)} บาท</b></div>`);
    if (after < 0) rows.push('<div style="color:#be123c;font-size:12px">ติดลบ อนุมัติได้ แต่ควรเร่งส่งเคลียร์ให้การเงินทำจ่ายคืน</div>');
  } else {
    rows.push('<div style="color:#64748b;font-size:12px">โหลดยอดคงเหลือไม่ได้ตอนนี้</div>');
  }
  const transfer = `<div style="margin-top:10px;padding:10px 12px;border-radius:10px;background:#eff6ff;border:1px solid #bfdbfe">
<div style="display:flex;justify-content:space-between"><span>ยอดตามบิล</span><span>${money(calc.bill)} บาท</span></div>
<div style="display:flex;justify-content:space-between;font-size:16px"><span>ยอดที่ต้องโอนจริง</span><b>${money(calc.transfer)} บาท</b></div>
<div style="font-size:12px;color:#475569;margin-top:4px">${escapeHtml(calc.note)}</div></div>`;
  const debt = debtDocNo || needsDebtDoc(claim)
    ? `<div style="margin-top:8px;font-size:12px;color:#92400e">ใบนี้มี พจร. · ใบรับสภาพหนี้เลขที่ ${escapeHtml(debtDocNo || '-')}</div>` : '';
  return `<div style="text-align:left;font-size:14px;line-height:1.7">${rows.join('')}${transfer}${debt}</div>`;
}
