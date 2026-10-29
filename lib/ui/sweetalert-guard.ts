/**
 * SweetAlert (showConfirm / showAlert) เปิดทับ Radix Dialog ได้ แต่ Radix มองว่าการคลิกใน SweetAlert
 * เป็นการคลิกนอก Dialog แล้วปิด Dialog ทิ้ง ฟังก์ชันนี้ใช้กันกรณีนั้น (บั๊กยืนยันอนุมัติบัญชีรับเงิน 20/10/2026)
 */
type Closestable = { closest?: (selector: string) => unknown } | null | undefined;
type OutsideEvent = { target?: unknown; detail?: { originalEvent?: { target?: unknown } } };

export function isFromSweetAlert(event: OutsideEvent): boolean {
  const target = (event.detail?.originalEvent?.target ?? event.target) as Closestable;
  return typeof target?.closest === 'function' && !!target.closest('.swal2-container');
}

/**
 * Radix Dialog/Sheet ล็อกโฟกัสไว้ในตัวเอง (FocusScope ฟัง focusin/focusout ที่ document) พอ SweetAlert ที่มีช่องพิมพ์
 * เปิดทับ เช่น เหตุผลตีกลับ โฟกัสจะถูกดึงกลับเข้า Dialog จนพิมพ์ไม่ได้ ตัวนี้ดักที่ window ช่วง capture
 * แล้วไม่ส่งต่อ event โฟกัสที่วิ่งเข้า/ออกจาก SweetAlert ไปให้ Radix เห็น (ติดตั้งครั้งเดียว)
 */
export function shouldHideFocusEvent(event: { type: string; target?: unknown; relatedTarget?: unknown }): boolean {
  const inSwal = (node: unknown) => {
    const el = node as Closestable;
    return typeof el?.closest === 'function' && !!el.closest('.swal2-container');
  };
  if (event.type === 'focusin') return inSwal(event.target);
  if (event.type === 'focusout') return inSwal(event.relatedTarget) || inSwal(event.target);
  return false;
}

let focusGuardInstalled = false;
export function installSwalFocusGuard(): void {
  if (focusGuardInstalled || typeof window === 'undefined') return;
  focusGuardInstalled = true;
  const stop = (e: FocusEvent) => { if (shouldHideFocusEvent(e)) e.stopImmediatePropagation(); };
  window.addEventListener('focusin', stop, true);
  window.addEventListener('focusout', stop, true);
}
