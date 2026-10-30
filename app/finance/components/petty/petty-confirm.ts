'use client';

import { confirmReview, showConfirm, type ReviewRow } from '../../api';

/**
 * ป๊อปอัปยืนยันของเงินสดย่อย — ใช้ showConfirm / confirmReview ตัวเดิม แค่ใส่ธีมทางการ
 * (ปุ่มยืนยันน้ำเงิน · ยกเลิกขาวขอบเทา · งานที่ย้อนไม่ได้ เช่น ตีกลับ/ลบ ปุ่มยืนยันสีแดง)
 * สไตล์อยู่ใน petty.css ใต้ class "petty-swal" เท่านั้น ไม่กระทบป๊อปอัปของ Advance
 */
export function pettySwalTheme(danger = false): Record<string, unknown> {
  return {
    customClass: { popup: danger ? 'petty-swal petty-swal--danger' : 'petty-swal' },
    confirmButtonColor: danger ? '#be123c' : '#1c6ef2',
    cancelButtonColor: '#ffffff',
    iconColor: '#6b7f9e',
    reverseButtons: true,
    focusCancel: danger,
  };
}

/** ยืนยันแบบสั้น (ข้อความหรือช่องกรอก) — options เหมือน showConfirm */
export function pettyConfirm(options: Record<string, unknown>, { danger = false }: { danger?: boolean } = {}) {
  return showConfirm({ ...pettySwalTheme(danger), ...options });
}

/** ยืนยันแบบตารางสรุป (เลขใบ ยอด รอบ ผู้รับเงิน) — คืน true เมื่อกดยืนยัน */
export function pettyReview({ danger = false, cancelButtonText = 'ยกเลิก', ...args }: {
  title: string; rows: ReviewRow[]; note?: string; warning?: string | null;
  confirmButtonText?: string; cancelButtonText?: string; danger?: boolean;
}): Promise<boolean> {
  return confirmReview({ ...args, swal: { ...pettySwalTheme(danger), cancelButtonText } });
}
