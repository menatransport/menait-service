'use client';

import type { PettyClaim, PettySpec } from '@/app/finance/types-petty';
import { ApiError } from '@/lib/finance/api-error';
import { DEBT_DOC_MAX, debtDocProblem, needsDebtDoc } from '@/lib/finance/petty-debt';
import { bangkokDate } from '@/lib/finance/petty-doc';
import { transferCalc } from '@/lib/finance/petty-transfer';
import { pettyFileProblem } from '@/lib/finance/petty-upload';
import { showAlert } from '../../api';
import { countAttachments, getBalance, payeeMonth, postAction, uploadPettyFiles, type PettyAction } from '../../petty-api';
import { payeeWarning } from '@/lib/finance/petty-wht';
import { pettyConfirm, pettyReview } from './petty-confirm';

type Prompt = { isConfirmed?: boolean; value?: string };

/** ของที่ runPettyAction เรียกออกไปข้างนอก (กล่อง SweetAlert + API) — เทสต์ส่งตัวปลอมมาแทนได้ */
export type PettyActionDeps = {
  /** theme.danger = ปุ่มยืนยันสีแดง (งานที่ย้อนไม่ได้ เช่น ตีกลับ) */
  confirm: (options: Record<string, unknown>, theme?: { danger?: boolean }) => Promise<unknown>;
  alert: (options: Record<string, unknown>) => unknown;
  post: typeof postAction;
  countAttachments: typeof countAttachments;
  getBalance: typeof getBalance;
  /** อัปโหลดสลิปโอนจากกล่องอนุมัติจ่าย (ไม่ส่งมา = ตัวจริง) */
  upload?: typeof uploadPettyFiles;
  /** ยอดเดือนนี้ของผู้รับเงิน — เตือนควรหัก ณ ที่จ่าย (ข้อ 13) · ไม่ส่งมา = ไม่เตือน */
  payeeMonth?: typeof payeeMonth;
};
const LIVE: PettyActionDeps = { confirm: pettyConfirm, alert: showAlert, post: postAction, countAttachments, getBalance, upload: uploadPettyFiles, payeeMonth };

/** หมวดไฟล์สลิปโอนของเจ้าของเงินสด (ตรงกับ isHolderAttachment ใน petty-spec) */
const SLIP_FOLDER = 'transfer';
/** ค่าที่กล่องอนุมัติจ่ายคืนมา: วันที่จ่าย + สลิปที่เพิ่งเลือก (ว่างได้ถ้าแนบไว้แล้ว) */
export type ApproveFormValue = { transfer_date: string; files: File[] };

/**
 * เปลี่ยนสถานะใบหนึ่งใบจากปุ่มลัดในตารางหรือแผงรายละเอียด — ถามสิ่งที่ต้องกรอก (เหตุผล วันที่จ่าย เลข DD เลขรับสภาพหนี้)
 * แล้วส่งให้ BE ตัดสิน · ด่านเอกสาร/ซ้ำตอบกลับมาเป็นรายการให้คนอ่าน ซ้ำอ่อนขอเหตุผลแล้วยิงซ้ำให้เอง
 * คืน true เมื่อสถานะเปลี่ยน (ผู้เรียกค่อยโหลดใหม่)
 */
export async function runPettyAction(claim: PettyClaim, action: PettyAction, opts: {
  spec?: PettySpec | null;
  /** review เท่านั้น: ผ่าน (true) หรือส่งกลับ (false) */
  pass?: boolean;
} = {}, deps: PettyActionDeps = LIVE): Promise<boolean> {
  const { confirm: showConfirm, alert: showAlert, post: postAction, countAttachments, getBalance } = deps;
  const body: Record<string, unknown> = {};
  const baht = claim.amount.toLocaleString('th-TH', { minimumFractionDigits: 2 });

  if (action === 'approve') {
    // อนุมัติ = จ่ายเงินในจังหวะเดียวกัน: กล่องเดียวถามวันที่จ่าย + แนบสลิปโอน แล้วกดยืนยันทีเดียว (ผู้ใช้สั่ง 5/11/2026
    // "แนบสลิปและอนุมัติทำเป็นขั้นตอนเดียวกัน") · แนบไว้ก่อนจากการ์ดก็ได้ กล่องจะบอกว่ามีแล้วกี่ไฟล์
    const [counts, balance, payeeInfo] = await Promise.all([
      countAttachments(claim.form_id), getBalance(claim.fund_id).catch(() => null),
      claim.payee_name && deps.payeeMonth
        ? deps.payeeMonth(claim.payee_name, claim.expense_date.slice(0, 7), claim.id).catch(() => null) : Promise.resolve(null),
    ]);
    const payeeNote = payeeWarning(payeeInfo, claim.amount, claim.wht_amount ?? 0);
    const slips = counts[SLIP_FOLDER] ?? 0;
    const ids = approveFormIds(claim.form_id);
    // ใบมี พจร. ไม่ถามเลขรับสภาพหนี้ตรงนี้แล้ว — เจ้าของเงินสดใส่หลังโอนเงิน (action debt-doc) ก่อนติ๊กเข้ารอบ (ผู้ใช้สั่ง 29/10/2026)
    // หน้าตาเดียวกับกล่อง "ยืนยันอนุมัติคำขอเบิกเงิน Advance" (หัวเรื่อง + ฟอร์ม + ยืนยัน/ยกเลิก) แล้วเติมตัวเลขของเงินสดย่อย
    const res = await showConfirm({ title: 'ยืนยันอนุมัติจ่ายเงินสดย่อย',
      html: approveDialogHtml(claim, balance) + (payeeNote && !(claim.wht_amount && claim.wht_amount > 0)
        ? `<div style="margin-top:8px;padding:8px 10px;border-radius:10px;background:#fff7ed;color:#9a3412;font-size:12px;text-align:left">${escapeHtml(payeeNote)} · เจ้าหน้าที่แก้ยอดหักในใบได้ก่อนคุณอนุมัติ</div>` : '')
        + approveFormHtml(ids, slips),
      focusConfirm: false,
      preConfirm: () => readApproveForm(ids, slips) }) as { isConfirmed?: boolean; value?: ApproveFormValue | string };
    if (!res?.isConfirmed) return false;
    // เทสต์/กล่องเก่าส่ง value เป็นวันที่ล้วน ๆ ก็ยังรับ
    const form: ApproveFormValue = typeof res.value === 'string' ? { transfer_date: res.value, files: [] } : (res.value ?? { transfer_date: '', files: [] });
    if (form.files.length) {
      const failed = await (deps.upload ?? uploadPettyFiles)(claim.form_id, SLIP_FOLDER, form.files);
      if (failed.length) {
        showAlert({ icon: 'error', title: 'แนบสลิปไม่สำเร็จ', text: `ไฟล์ที่ไม่ขึ้น: ${failed.join(', ')} ลองใหม่อีกครั้ง ใบยังไม่ถูกอนุมัติ` });
        return false;
      }
      body.attachments = await countAttachments(claim.form_id);
    } else {
      body.attachments = counts;
    }
    body.transfer_date = form.transfer_date;
  }

  if (action === 'head-approve') {
    // หัวหน้าอนุมัติใบ ยังไม่มีการโอน — ใบไปรอเจ้าของเงินสดอนุมัติจ่ายต่อ
    const who = claim.created_by_name?.trim() || claim.created_by;
    const res = await showConfirm({ title: 'ยืนยันอนุมัติใบเบิกเงินสดย่อย', html: headApproveHtml(claim, who, baht),
      confirmButtonText: 'อนุมัติ' }) as Prompt;
    if (!res?.isConfirmed) return false;
  }

  if (action === 'return') {
    // แบบกล่อง "ยืนยันไม่อนุมัติ" ของ Advance: บังคับหมายเหตุ ใบกลับไปให้คนเปิดใบแก้แล้วส่งใหม่
    const res = await showConfirm({ title: 'ยืนยันตีกลับใบเบิกเงินสดย่อย', text: `ฟอร์ม ${claim.form_id} · ${baht} บาท`, input: 'textarea',
      inputLabel: 'หมายเหตุ (ระบุเหตุผล)', inputPlaceholder: 'คนเปิดใบจะเห็นข้อความนี้ เช่น ใบชั่งเบลอ อ่านเลขไม่ออก',
      inputValidator: (v: string) => (!v || !v.trim()) ? 'กรุณาระบุหมายเหตุ' : null, confirmButtonText: 'ตีกลับ' }, { danger: true }) as Prompt;
    if (!res?.isConfirmed) return false;
    body.reason = res.value;
  }
  if (action === 'dd') {
    const res = await showConfirm({ title: claim.dd_no ? 'แก้เลข DD' : 'ใส่เลข DD', text: `ฟอร์ม ${claim.form_id}`, input: 'text',
      inputLabel: 'เลขที่ใบรับสินค้า (DD) จาก ATMS', inputPlaceholder: 'เช่น LBDD26090931', inputValue: claim.dd_no ?? '',
      inputValidator: (v: string) => (!v || !v.trim()) ? 'กรุณากรอกเลข DD' : null, confirmButtonText: 'บันทึก' }) as Prompt;
    if (!res?.isConfirmed) return false;
    body.dd_no = (res.value ?? '').trim().toUpperCase();
  }
  if (action === 'debt-doc') {
    // หน้าตาเดียวกับกล่องเลข DD · BE รับเฉพาะเจ้าของเงินสด ใบที่อนุมัติจ่ายแล้ว และใบที่มี พจร.
    const res = await showConfirm({ title: claim.debt_doc_no ? 'แก้เลขรับสภาพหนี้' : 'ใส่เลขรับสภาพหนี้',
      text: `ฟอร์ม ${claim.form_id} · ใบนี้มี พจร.`, input: 'text',
      inputLabel: 'เลขที่ใบรับสภาพหนี้', inputPlaceholder: 'เลขที่เอกสาร', inputValue: claim.debt_doc_no ?? '',
      inputAttributes: { maxlength: String(DEBT_DOC_MAX) },
      inputValidator: (v: string) => debtDocProblem(v), confirmButtonText: 'บันทึก' }) as Prompt;
    if (!res?.isConfirmed) return false;
    body.debt_doc_no = (res.value ?? '').trim();
  }
  if (action === 'review') {
    body.action = opts.pass ? 'PASS' : 'SEND_BACK';
    if (opts.pass) {
      const ok = await pettyReview({ title: `ตรวจผ่าน ใบ ${claim.form_id}`,
        rows: [['จ่ายให้', claim.payee_name ?? '-'], ['ยอด', `${baht} บาท`], ['เลข DD', claim.dd_no ?? '-']],
        note: 'ผ่านครบทั้งรอบแล้วตั้งเบิกได้', confirmButtonText: 'ผ่าน' });
      if (!ok) return false;
    } else {
      const res = await showConfirm({ title: `ตีกลับใบ ${claim.form_id}`, text: `${baht} บาท`, input: 'textarea',
        inputLabel: 'เหตุผล (ผู้เปิดใบจะเห็น แก้แล้วส่งกลับมาที่บัญชี)',
        inputValidator: (v: string) => (!v || !v.trim()) ? 'ต้องระบุเหตุผล' : null, confirmButtonText: 'ตีกลับ' }, { danger: true }) as Prompt;
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

/** ข้อความแจ้งสำเร็จหลัง runPettyAction คืน true — ผู้เรียกเป็นคนแจ้ง (หน้าอนุมัติมีข้อความของตัวเอง) */
export function actionDoneText(action: PettyAction, pass?: boolean): string {
  if (action === 'head-approve') return 'อนุมัติแล้ว ใบไปรอเจ้าของเงินสดอนุมัติจ่าย';
  return action === 'approve' ? 'อนุมัติจ่ายแล้ว' : action === 'return' ? 'ตีกลับแล้ว' : action === 'dd' ? 'บันทึกเลข DD แล้ว'
    : action === 'debt-doc' ? 'บันทึกเลขรับสภาพหนี้แล้ว' : pass ? 'ตรวจผ่านแล้ว' : 'ตีกลับแล้ว';
}

const escapeHtml = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const money = (n: number) => n.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** เนื้อหากล่องยืนยันของหัวหน้า: ใครขอ เท่าไร จ่ายใคร แล้วบอกว่าขั้นถัดไปคือเจ้าของเงินสดโอนเงิน */
function headApproveHtml(claim: PettyClaim, who: string, baht: string): string {
  const row = (k: string, v: string) =>
    `<div style="display:flex;justify-content:space-between;gap:12px"><span>${escapeHtml(k)}</span><b>${escapeHtml(v)}</b></div>`;
  return `<div style="margin:0 0 12px;font-size:16px;color:#334155">ฟอร์ม ${escapeHtml(claim.form_id)}</div>`
    + `<div style="text-align:left;font-size:14px;line-height:1.7">${row('ผู้ขอเบิก', who)}${row('จ่ายให้', claim.payee_name ?? '-')}`
    + `${row('ยอดเบิก', `${baht} บาท`)}`
    + `<div style="margin-top:8px;font-size:12px;color:#6b7f9e">อนุมัติแล้วใบไปที่เจ้าของเงินสด เพื่ออนุมัติจ่ายและโอนเงิน</div></div>`;
}

/** id ของช่องในกล่องอนุมัติจ่าย (ต่อใบ กันชนกันเมื่อเปิดซ้อน) */
export function approveFormIds(formId: string): { date: string; file: string } {
  const key = formId.replace(/[^A-Za-z0-9]/g, '');
  return { date: `petty-pay-date-${key}`, file: `petty-pay-slip-${key}` };
}

/** ฟอร์มท้ายกล่องอนุมัติจ่าย: วันที่จ่าย + แนบสลิปโอน — สองอย่างนี้กับปุ่มยืนยันคือขั้นเดียวกัน */
export function approveFormHtml(ids: { date: string; file: string }, slipsAttached: number): string {
  const today = bangkokDate(new Date().toISOString());
  const slipNote = slipsAttached > 0
    ? `แนบไว้แล้ว ${slipsAttached} ไฟล์ จะแนบเพิ่มหรือไม่แนบก็ได้`
    : 'โอนเงินแล้วแนบสลิปตรงนี้ แล้วกดยืนยันทีเดียว (รูปหรือ PDF ไม่เกิน 10 MB)';
  const label = 'display:block;font-size:13px;color:#5a6a80;margin:0 0 4px;text-align:left';
  return `<div style="margin-top:12px;padding-top:12px;border-top:1px solid #edf1f7;text-align:left">`
    + `<label for="${ids.date}" style="${label}">วันที่จ่ายเงิน <span style="color:#6b7f9e">(โอนไปก่อนแล้วใส่วันจริงย้อนหลังได้ รายงานยึดวันนี้)</span></label>`
    + `<input id="${ids.date}" type="date" value="${today}" max="${today}" style="display:block;width:100%;box-sizing:border-box;height:40px;margin:0 0 12px;padding:0 10px;border:1px solid #dbe4f3;border-radius:10px;font-size:14px;color:#10233f">`
    + `<label for="${ids.file}" style="${label}">สลิปโอนเงิน${slipsAttached > 0 ? '' : ' <span style="color:#be123c">*</span>'}</label>`
    + `<input id="${ids.file}" type="file" multiple accept="image/*,application/pdf" style="display:block;width:100%;font-size:13px;color:#10233f">`
    + `<div style="font-size:12px;color:#6b7f9e;margin-top:4px">${slipNote}</div></div>`;
}

/**
 * อ่านค่าจากฟอร์มในกล่อง (preConfirm ของ SweetAlert): วันที่ต้องมี · สลิปต้องมีถ้ายังไม่เคยแนบ · ไฟล์ต้องผ่านกติกาขนาด/ชนิด
 * คืน false = ยังปิดกล่องไม่ได้ พร้อมข้อความใต้ปุ่ม
 */
export async function readApproveForm(ids: { date: string; file: string }, slipsAttached: number): Promise<ApproveFormValue | false> {
  const dateEl = document.getElementById(ids.date) as HTMLInputElement | null;
  const fileEl = document.getElementById(ids.file) as HTMLInputElement | null;
  const transfer_date = dateEl?.value ?? '';
  const files = Array.from(fileEl?.files ?? []);
  const fail = async (msg: string) => {
    const { default: Swal } = await import('sweetalert2');
    Swal.showValidationMessage(msg);
    return false as const;
  };
  if (!transfer_date) return fail('กรุณาระบุวันที่จ่าย');
  if (transfer_date > bangkokDate(new Date().toISOString())) return fail('วันที่จ่ายเป็นวันข้างหน้าไม่ได้ ใส่วันที่โอนจริง');
  if (!files.length && slipsAttached === 0) return fail('แนบสลิปโอนเงินก่อนยืนยัน');
  const bad = files.map(f => ({ f, why: pettyFileProblem(f.name, f.size) })).find(x => x.why);
  if (bad) return fail(`${bad.f.name}: ${bad.why}`);
  return { transfer_date, files };
}

/** เนื้อหากล่องยืนยันอนุมัติจ่าย: บรรทัด "ฟอร์ม …" แบบ Advance แล้วตามด้วยตัวเลขของเงินสดย่อย */
export function approveDialogHtml(claim: PettyClaim, balance: { available: number } | null,
  debtDocNo: string | null | undefined = claim.debt_doc_no): string {
  return `<div style="margin:0 0 12px;font-size:16px;color:#334155">ฟอร์ม ${escapeHtml(claim.form_id)}</div>`
    + approveSummaryHtml(claim, balance, debtDocNo);
}

/**
 * เนื้อหากล่องอนุมัติจ่าย: ยอดคงเหลือของเจ้าของเงินสดก่อน/หลังอนุมัติ และยอดที่ต้องโอนจริงตามผู้รับเงิน
 * (ผู้ใช้สั่ง 29/10/2026) · ตัวเลขภาษีแสดงให้ดูเท่านั้น ไม่บันทึก
 */
export function approveSummaryHtml(claim: PettyClaim,
  balance: { available: number } | null, debtDocNo: string | null | undefined = claim.debt_doc_no): string {
  const payeeType = typeof claim.detail?.payee_type === 'string' ? claim.detail.payee_type : null;
  const calc = transferCalc(claim.amount, payeeType, claim.wht_amount);
  const rows: string[] = [];
  if (balance) {
    const after = balance.available - claim.amount;
    rows.push(`<div style="display:flex;justify-content:space-between"><span>ยอดคงเหลือของคุณ</span><b>${money(balance.available)} บาท</b></div>`);
    rows.push(`<div style="display:flex;justify-content:space-between"><span>หลังอนุมัติใบนี้</span><b style="color:${after < 0 ? '#be123c' : '#0f2748'}">${money(after)} บาท</b></div>`);
    if (after < 0) rows.push('<div style="color:#be123c;font-size:12px">ติดลบ อนุมัติได้ แต่ควรเร่งส่งเคลียร์ให้การเงินทำจ่ายคืน</div>');
  } else {
    rows.push('<div style="color:#6b7f9e;font-size:12px">โหลดยอดคงเหลือไม่ได้ตอนนี้</div>');
  }
  const transfer = `<div style="margin-top:10px;padding:10px 0 0;border-top:1px solid #edf1f7">
<div style="display:flex;justify-content:space-between"><span>ยอดตามบิล</span><span>${money(calc.bill)} บาท</span></div>
<div style="display:flex;justify-content:space-between;font-size:16px"><span>ยอดที่ต้องโอนจริง</span><b>${money(calc.transfer)} บาท</b></div>
<div style="font-size:12px;color:#6b7f9e;margin-top:4px">${escapeHtml(calc.note)}</div></div>`;
  // เลขรับสภาพหนี้ไม่ต้องมีตอนอนุมัติ ใส่หลังโอนได้ แต่ต้องมีก่อนส่งเคลียร์
  const debtText = debtDocNo ? `ใบรับสภาพหนี้เลขที่ ${escapeHtml(debtDocNo)}` : 'ใส่เลขรับสภาพหนี้หลังโอนเงินได้ ต้องมีก่อนส่งเคลียร์';
  const debt = debtDocNo || needsDebtDoc(claim)
    ? `<div style="margin-top:8px;font-size:12px;color:#33476b">ใบนี้มี พจร. · ${debtText}</div>` : '';
  return `<div style="text-align:left;font-size:14px;line-height:1.7">${rows.join('')}${transfer}${debt}</div>`;
}
