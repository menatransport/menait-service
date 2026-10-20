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
