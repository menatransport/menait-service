/**
 * ชิ้นส่วนร่วมของเอกสารเงินสดย่อย — ใช้โครงและ CSS ชุดเดียวกับใบ Advance (cashAdvanceForm)
 * เพื่อให้ทุกใบที่ออกจากระบบการเงินหน้าตาเดียวกัน: แถบสีหัวกระดาษ โลโก้ ชื่อไทย/อังกฤษ
 * กล่องเลขที่/วันที่ หัวข้อมีเลขลำดับ ตารางหัวมินต์ กล่องยอดรวม ตารางลงนามพร้อมตรา e-Signature
 */
import { CASH_ADVANCE_CSS, dmy } from '@/lib/finance/cashAdvanceForm';
import { esc, formatBkkDateTime, stampHtml, type ESign } from '@/lib/finance/printShared';

export const PETTY_DOC_CSS = CASH_ADVANCE_CSS + `
/* ลงนามอยู่ด้านล่างของหน้าเสมอ (ผู้ใช้สั่ง 2026-10-13): หน้าเป็น flex คอลัมน์ บล็อกลงนามดันตัวเองลงไปชิดขอบล่าง
   247mm = A4 297mm − หัวกระดาษ 12mm − Document Control + ขอบล่าง ~38mm · ใบที่ยาวเกินหนึ่งหน้า บล็อกตามท้ายเนื้อหา */
.doc-part { display: flex; flex-direction: column; min-height: 247mm; }
.sign-block { margin-top: auto; padding-top: 6mm; break-inside: avoid; }
table.items td.nw { white-space: nowrap; }
table.items th.c, table.items td.c { text-align: center; }
table.items td.sub { background: var(--mint); font-weight: 600; }
table.items td.sub.a { text-align: right; }
table.items td.nw { white-space: nowrap; }
.kv { display: grid; grid-template-columns: 1fr 1fr; column-gap: 22px; row-gap: 5px; }
`;

export type PettySignature = {
  title: string; name?: string | null; esign?: ESign | null;
  /** ตรา "รับเงินโอน" แทน e-Signature — ผู้รับเงินได้เงินทางโอน ไม่ได้เซ็นในระบบ · date = 'YYYY-MM-DD' */
  received?: { date: string; ref: string } | null;
};

/** หัวเอกสาร: แถบสี + โลโก้ + ชื่อไทย/อังกฤษ + กล่อง meta (เลขที่/วันที่/…) */
export function docHead(opts: {
  title: string; english: string; logoUrl?: string | null;
  meta: [string, string][];
}): string {
  const logo = opts.logoUrl ? `<img class="logo" src="${esc(opts.logoUrl)}" alt="MENA Transport">` : '<span></span>';
  const meta = opts.meta.map(([k, v]) => `<div><span>${esc(k)}</span><b>${esc(v)}</b></div>`).join('');
  return `<div class="doc-band"></div>
<header class="head">${logo}<div><div class="t1">${esc(opts.title)}</div><div class="t2">${esc(opts.english)}</div></div>
<div class="meta">${meta}</div></header>`;
}

export const sec = (n: number, th: string, en: string) =>
  `<div class="sec"><span class="n">${n}</span><h2>${esc(th)}</h2><small>${esc(en)}</small></div>`;

export const field = (label: string, value: unknown) =>
  `<div class="f"><span class="l">${esc(label)}</span><span class="v">${esc(value ?? '')}</span></div>`;

/** กล่อง checkbox แบบเดียวกับ "ศูนย์" บนใบ Advance */
export function checkboxes(label: string, options: readonly string[], picked: string): string {
  const items = options.map(o =>
    `<span class="cbi"><span class="cb${o === picked ? ' checked' : ''}"></span>${esc(o)}</span>`).join('');
  return `<div class="cbs"><span class="lbl">${esc(label)}</span>${items}</div>`;
}

/** กล่องยอดรวมสีเขียวพร้อมตัวอักษร */
export function totalBox(label: string, amount: string, words: string): string {
  return `<div class="tot"><div class="k">${esc(label)}</div><div class="amt">${amount}<span>บาท</span></div>` +
    `<div class="words">จำนวนเงิน (ตัวอักษร) : ${esc(words)}</div></div>`;
}

/** ตรา "✔ รับเงินโอน" หน้าตาเดียวกับตรา e-Signature แต่มีแค่วันที่โอน ไม่มีเวลา */
function receivedStamp(name: string | null | undefined, r: { date: string; ref: string }): string {
  return `<div class="esign"><div class="esign-title">✔ รับเงินโอน</div><div>${esc(name || '-')}</div>` +
    `<div>${esc(thaiDate(r.date))}</div><div class="esign-ref">${esc(r.ref)}</div></div>`;
}

const validEsign = (e?: ESign | null) => (e && formatBkkDateTime(e.timestamp).date ? e : null);

/** ตารางลงนาม: หัวช่องตามฟอร์มกระดาษ ช่องว่างสำหรับเซ็นหรือตรา e-Signature และบรรทัด ชื่อ/วันที่ */
export function signatureTable(cols: PettySignature[]): string {
  const heads = cols.map(c => `<th>${esc(c.title)}</th>`).join('');
  const stamps = cols.map(c => `<td class="space">${c.received?.date ? receivedStamp(c.name, c.received) : stampHtml(validEsign(c.esign))}</td>`).join('');
  const lines = cols.map(c => {
    const e = validEsign(c.esign);
    const date = c.received?.date ? thaiDate(c.received.date) : e ? dmy(e.timestamp) : '';
    return `<td><div class="row"><span class="k">ชื่อ</span><i>${esc(c.name ?? '')}</i></div>` +
      `<div class="row"><span class="k">วันที่</span><i>${esc(date)}</i></div></td>`;
  }).join('');
  const any = cols.some(c => validEsign(c.esign) || c.received?.date);
  return `<table class="sig"><thead><tr>${heads}</tr></thead><tbody><tr>${stamps}</tr><tr>${lines}</tr></tbody></table>` +
    (any ? '<div class="esign-note">ลงนามอิเล็กทรอนิกส์ผ่านระบบ menait-service · เวลาประเทศไทย (UTC+7)</div>' : '');
}

/** ส่วนลงนามทั้งก้อน (หัวข้อ + ตาราง + หมายเหตุ e-Signature) ห่อไว้ให้ดันลงขอบล่างของหน้า */
export function signBlock(n: number, th: string, en: string, cols: PettySignature[]): string {
  return `<div class="sign-block">${sec(n, th, en)}
${signatureTable(cols)}</div>`;
}

/** วันที่ (ไม่ใช่เวลา) ของ timestamp ตามเวลาไทย — ตัด 10 ตัวแรกของ UTC จะได้วันก่อนหน้าหลังสี่ทุ่ม */
export function bangkokDate(timestamp: string | null | undefined): string {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return timestamp.slice(0, 10);
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' })
    .formatToParts(date);
  const get = (type: string) => parts.find(p => p.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/** วันนี้ตามเวลาไทย 'YYYY-MM-DD' — ค่าเริ่มต้นของช่องวันที่ในฟอร์ม (ใส่ now ในเทสต์) */
export function bangkokToday(now: Date = new Date()): string {
  return bangkokDate(now.toISOString());
}

/** '2026-09-17' → '17/09/2026' */
export function thaiDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return y && m && d ? `${d}/${m}/${y}` : '';
}
