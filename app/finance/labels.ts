export const FIELD_LABELS: Record<string, string> = {
  acc_code: 'รหัสบัญชี', voucher_no: 'เลขที่ใบเบิก', voucher_date: 'วันที่ตั้งเบิก', payment_doc_no: 'เลขที่เอกสารจ่าย',
  purpose: 'วัตถุประสงค์', amount_paid: 'ยอดเงิน', transfer_date: 'วันที่โอนเงิน', clear_due_date: 'กำหนดการเคลียร์',
  clear_date: 'วันที่ส่งเอกสารเคลียร์', amount_actual: 'ยอดใช้จริง', clear_doc_no: 'เอกสารเคลียร์',
  settle_amount: 'รับคืน (เบิกเพิ่ม)', settle_date: 'วันที่โอนเงินคืนบริษัท', remark: 'หมายเหตุ',
  items: 'จำนวนรายการค่าใช้จ่าย', items_total: 'ยอดรวมสุทธิ (รายการ)',
};

export const LOG_ACTION_LABELS: Record<string, string> = {
  VOUCHER: 'ตั้งเบิกทำจ่าย', VOUCHER_EDIT: 'แก้ไขข้อมูลตั้งเบิก',
  PAY: 'บันทึกการจ่ายเงิน', PAY_EDIT: 'แก้ไขข้อมูลการจ่าย', CLEAR_SUBMIT: 'ส่งเคลียร์เงิน',
  CLEAR_EDIT: 'แก้ไขข้อมูลเคลียร์', SEND_BACK: 'ส่งกลับแก้ไข', CONFIRM: 'ยืนยันปิดรายการ',
  VOUCHER_REJECT: 'ตีกลับไปตั้งเบิกใหม่',
  RETURN: 'ตีกลับให้ผู้เบิกแก้ไข', RETURNED: 'ตีกลับให้ผู้เบิกแก้ไข', RESUBMITTED: 'ส่งใหม่หลังแก้ไข',
  APPROVED: 'อนุมัติ', REJECTED: 'ไม่อนุมัติ',
};

export const FOLDER_LABELS: Record<string, string> = {
  request: 'เอกสารประกอบการขอเบิก', pay: 'หลักฐานการจ่ายเงิน', clear: 'เอกสารเคลียร์ / สลิปคืนเงิน',
  check: 'หลักฐานการเงิน (จ่ายเพิ่ม)',
};

export const CLEAR_ATTACHMENT_REQUIRED = 'กรุณาแนบใบเสร็จ / สลิปคืนเงินอย่างน้อย 1 ไฟล์';
