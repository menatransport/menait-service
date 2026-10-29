import { redirect } from 'next/navigation';

/** หน้าทำจ่ายเดิมรวมเข้า "งานเงินสดย่อย" แล้ว — ลิงก์เก่า (อีเมล บุ๊กมาร์ก) พาไปแถบรอจ่าย */
export default function PettyBatchesRedirect() {
  redirect('/finance/petty/accounting?tab=pay');
}
