/**
 * ทุกหน้าเงินสดย่อยใช้ธีมเขียว (ผู้ใช้สั่ง 7/11/2026 "เปลี่ยนสีธีมสำหรับวงเงินสดย่อยเป็นสีเขียว และเบิก Advance เป็นสีน้ำเงินเหมือนเดิม
 * เพื่อป้องกันความสับสน") — คลาส .theme-petty ใน globals.css สลับตัวแปร --brand-* ที่ยูทิลิตี้ brand-* อ้างถึง
 * คอมโพเนนต์ที่ใช้ร่วมกับ Advance (FinanceCanvas, ปุ่ม, ป้าย) จึงเปลี่ยนสีตามโดยไม่ต้องแก้ทีละไฟล์
 */
export default function PettyLayout({ children }: { children: React.ReactNode }) {
  return <div className="theme-petty contents">{children}</div>;
}
