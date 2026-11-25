import type { PettySpec } from '@/app/finance/types-petty';

/**
 * QR Code / บาร์โค้ดของผู้รับเงิน (ผู้ใช้สั่ง 25/11/2026 ใช้ได้ทุกประเภท) — ผู้เบิกแนบในช่อง "จ่ายให้"
 * เจ้าของเงินสดเห็นรูปในกล่องอนุมัติจ่าย สแกนโอนได้เลย · ไม่บังคับ ไม่อยู่ใน spec ของประเภท จึงไม่เข้าด่านเอกสาร
 */
export const PAYEE_QR_FOLDER = 'payee_qr';
export const PAYEE_QR_LABEL = 'QR Code / บาร์โค้ดสำหรับโอน';
export const PAYEE_QR_MAX = 2;

/** ชื่อหมวดไฟล์ที่คนอ่าน: จาก spec ก่อน แล้ว QR ผู้รับเงิน ไม่รู้จักก็คืนคีย์ */
export function attachmentLabel(spec: PettySpec | null | undefined, key: string): string {
  return spec?.attachments?.find(a => a.key === key)?.label ?? (key === PAYEE_QR_FOLDER ? PAYEE_QR_LABEL : key);
}

const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const isImage = (name: string) => /\.(png|jpe?g|gif|webp|heic|bmp)$/i.test(name);

/** กล่องรูป QR ในหน้าต่างอนุมัติจ่าย · ไม่มีไฟล์ = '' · PDF/ไฟล์อื่นเป็นลิงก์เปิดดู */
export function payeeQrHtml(files: readonly { url: string; key: string; fileName?: string; folder: string }[]): string {
  const qr = files.filter(f => f.folder === PAYEE_QR_FOLDER);
  if (!qr.length) return '';
  const items = qr.map(f => {
    const name = f.fileName ?? f.key;
    const url = esc(f.url);
    return isImage(name)
      ? `<a href="${url}" target="_blank" rel="noreferrer" style="display:block"><img src="${url}" alt="QR ผู้รับเงิน" style="display:block;max-width:220px;max-height:220px;margin:0 auto;border-radius:8px;border:1px solid #dbe4f3;background:#fff"></a>`
      : `<a href="${url}" target="_blank" rel="noreferrer" style="color:#1d4ed8">เปิดไฟล์ ${esc(name.split('/').pop() ?? name)}</a>`;
  }).join('');
  return `<div style="margin-top:12px;padding:10px;border-radius:12px;background:#f8fafd;border:1px solid #edf1f7;text-align:center">`
    + `<div style="font-size:12px;color:#33476b;margin-bottom:8px">QR Code / บาร์โค้ดของผู้รับเงิน สแกนโอนได้เลย</div>`
    + `<div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap">${items}</div></div>`;
}
