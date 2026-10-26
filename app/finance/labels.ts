import type { AttachmentFolder } from './types';

export const FIELD_LABELS: Record<string, string> = {
  acc_code: 'รหัสบัญชี', voucher_no: 'เลขที่ตั้งเบิก', voucher_date: 'วันที่ตั้งเบิก', payment_doc_no: 'เลขที่ทำจ่าย',
  purpose: 'วัตถุประสงค์', amount_paid: 'ยอดเงิน', transfer_date: 'วันที่โอนเงิน', clear_due_date: 'กำหนดการเคลียร์',
  clear_date: 'วันที่ส่งเอกสารเคลียร์', amount_actual: 'ยอดใช้จริง', clear_doc_no: 'เลขที่เอกสารเคลียร์เงิน', original_received_date: 'วันที่รับเอกสารตัวจริง',
  settle_amount: 'รับคืน (เบิกเพิ่ม)', settle_date: 'วันที่โอนเงินคืนบริษัท', remark: 'หมายเหตุ',
  items: 'จำนวนรายการค่าใช้จ่าย', items_total: 'ยอดรวมสุทธิ (รายการ)',
  // request fields changed by the requester while ตีกลับ (RESUBMIT log); `<field>_forced` = system took it from the Master
  amount: 'จำนวนเงินที่ขอ', use_date: 'วันที่ใช้เงิน', cost_center: 'ศูนย์ค่าใช้จ่าย', payee_type: 'บัญชีรับเงิน',
  bank: 'ธนาคาร', account_no: 'เลขที่บัญชี', account_name: 'ชื่อบัญชี',
};

export const LOG_ACTION_LABELS: Record<string, string> = {
  VOUCHER: 'ตั้งเบิกทำจ่าย', VOUCHER_EDIT: 'แก้ไขข้อมูลตั้งเบิก',
  PAY: 'บันทึกการจ่ายเงิน', PAY_EDIT: 'แก้ไขข้อมูลการจ่าย', CLEAR_SUBMIT: 'ส่งเคลียร์เงิน',
  CLEAR_EDIT: 'แก้ไขข้อมูลเคลียร์', SEND_BACK: 'ส่งกลับแก้ไข', CONFIRM: 'ยืนยันปิดรายการ',
  VOUCHER_REJECT: 'ส่งกลับให้บัญชีแก้ตั้งเบิก', DOC_NO_EDIT: 'แก้ไขเลขที่เอกสาร',
  RETURN: 'ตีกลับให้ผู้เบิกแก้ไข', RETURNED: 'ตีกลับให้ผู้เบิกแก้ไข', RESUBMITTED: 'ส่งใหม่หลังแก้ไข', RESUBMIT: 'ส่งใหม่หลังแก้ไข',
  APPROVED: 'อนุมัติ', REJECTED: 'ไม่อนุมัติ',
  OVERDUE_REMIND: 'แจ้งเตือนเกินกำหนด',
  CLEAR_REJECT: 'ไม่อนุมัติการเคลียร์',
};

const OVERDUE_REMIND_REMARKS: Record<string, string> = { auto: 'อัตโนมัติ', manual: 'ส่งโดยบัญชี' };

export function logRemarkLabel(action: string, remark: string | null): string | null {
  if (!remark) return null;
  return action === 'OVERDUE_REMIND' ? (OVERDUE_REMIND_REMARKS[remark] ?? remark) : remark;
}

export const FOLDER_LABELS: Record<AttachmentFolder, string> = {
  request: 'เอกสารประกอบการขอเบิก', pay: 'หลักฐานการจ่ายเงิน', clear: 'เอกสารเคลียร์ / สลิปโอนเงิน',
  related: 'เอกสารที่เกี่ยวข้อง', check: 'หลักฐานการเงิน (จ่ายเพิ่ม)',
};

export const CLEAR_ATTACHMENT_REQUIRED = 'มียอดต้องคืนบริษัท กรุณาแนบสลิปโอนเงินอย่างน้อย 1 ไฟล์';
