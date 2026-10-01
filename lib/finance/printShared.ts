import { displayFileName } from './status';

export type PrintParts = 'part1' | 'part2' | 'both';

export const esc = (v: unknown) =>
  String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));

export const money = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** ISO datetime → Bangkok { date: 'dd/mm/yyyy', time: 'HH:mm:ss' }; blanks when invalid. */
export function formatBkkDateTime(iso: string | null | undefined): { date: string; time: string } {
  const dt = iso ? new Date(iso) : null;
  if (!dt || Number.isNaN(dt.getTime())) return { date: '', time: '' };
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Bangkok', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(dt).map(x => [x.type, x.value]));
  return { date: `${p.day}/${p.month}/${p.year}`, time: `${p.hour}:${p.minute}:${p.second}` };
}

/** "Printed" cell of the Document Control table: dd/mm/yyyy HH:mm (Bangkok). */
export function printedNow(now: Date = new Date()): string {
  const t = formatBkkDateTime(now.toISOString());
  return `${t.date} ${t.time.slice(0, 5)}`;
}

export interface ESign { name: string; timestamp: string; ref: string }

/** e-Signature stamp; empty when there is no esign or its timestamp is invalid. */
export function stampHtml(esign: ESign | null | undefined): string {
  if (!esign) return '';
  const t = formatBkkDateTime(esign.timestamp);
  if (!t.date) return '';
  return `<div class="esign"><div class="esign-title">✔ e-Signature</div><div>${esc(esign.name || '-')}</div><div>${esc(t.date)}</div><div>${esc(t.time)} น.</div><div class="esign-ref">${esc(esign.ref)}</div></div>`;
}

export interface DocumentControl {
  ref: string; name: string; owner: string; approvedBy: string; approvedDate: string; printed: string;
}

export const VERSION_NO = '01';

/** NC-style "Document Control & Revision History" table (6 columns, 3 rows), all values escaped. */
export function documentControlFooter(d: DocumentControl): string {
  const v = (s: string) => esc(s || ' ');
  return `<div class="dc"><table>
<thead><tr><th colspan="6">Document Control &amp; Revision History</th></tr></thead>
<tbody>
<tr><td class="lb" style="width:15%">Document Ref</td><td style="width:33%">${v(d.ref)}</td><td class="lb" style="width:15%">Document Name</td><td colspan="3">${v(d.name)}</td></tr>
<tr><td class="lb">Document Owner</td><td>${v(d.owner)}</td><td class="lb">Version No</td><td style="width:8%">${VERSION_NO}</td><td class="lb" style="width:14%">Revision Date</td><td style="width:13%"> </td></tr>
<tr><td class="lb">Approved By</td><td>${v(d.approvedBy)}</td><td class="lb">Approved Date</td><td>${v(d.approvedDate)}</td><td class="lb">Printed</td><td>${v(d.printed)}</td></tr>
</tbody></table></div>`;
}

const IMAGE_RE = /\.(jpe?g|png|gif|webp)$/i;
export const isImageFile = (name: string) => IMAGE_RE.test(name);

export interface PrintFile { fileName: string; url: string; folder: string }

/** Image pages (2 per row, caption "folder label · file name") + a list of non-image files. '' when nothing is attached. */
export function attachmentPagesHtml(files: PrintFile[], folders: string[], labels: Record<string, string>): string {
  const picked = folders.flatMap(f => files.filter(x => x.folder === f));
  if (!picked.length) return '';
  const images = picked.filter(f => isImageFile(f.fileName));
  const others = picked.filter(f => !isImageFile(f.fileName));
  const cap = (f: PrintFile) => `${esc(labels[f.folder] ?? f.folder)} · ${esc(displayFileName(f.fileName))}`;
  const imgs = images.length
    ? `<div class="att-grid">${images.map(f => `<figure><img src="${esc(f.url)}" alt=""><figcaption>${cap(f)}</figcaption></figure>`).join('')}</div>`
    : '';
  const list = others.length
    ? `<div class="att-other"><div class="att-h">ไฟล์แนบอื่น ๆ (ไม่แสดงเป็นรูป)</div><ul>${others.map(f => `<li>${cap(f)}</li>`).join('')}</ul></div>`
    : '';
  return `<section class="att"><div class="att-title">เอกสารแนบ <small>Attachments</small></div>${imgs}${list}</section>`;
}

export const SHARED_CSS = `
:root { --ink: #17272B; --teal: #055058; --teal-2: #0B6E75; --mint: #EAF4F1; --line: #C7D3D0; --muted: #5E6E71; --stamp: #0F766E; }
@page { size: A4 portrait; margin: 0 0 9mm; @bottom-right { content: "Page " counter(page); font-family: 'IBM Plex Sans Thai', 'Noto Sans Thai', sans-serif; font-size: 9px; font-weight: 600; color: #17272B; margin-right: 14mm; vertical-align: top; padding-top: 1mm; } }
* { box-sizing: border-box; margin: 0; padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
html, body { background: #fff; }
body { position: relative; font-family: 'IBM Plex Sans Thai', 'Noto Sans Thai', 'Thonburi', sans-serif; color: var(--ink); font-size: 11.5px; line-height: 1.42; font-variant-numeric: tabular-nums; }
table.print-wrap { width: 100%; border-collapse: collapse; }
table.print-wrap > thead > tr > td, table.print-wrap > tbody > tr > td, table.print-wrap > tfoot > tr > td { padding: 0 14mm; }
.head-space { height: 12mm; }
.footer-space { visibility: hidden; }
.footer-fixed { position: fixed; left: 0; right: 0; bottom: 0; padding: 0 14mm; }
.dc table { width: 100%; border-collapse: collapse; font-size: 8.5px; line-height: 1.3; }
.dc th, .dc td { border: 1px solid var(--line); padding: 2px 6px; text-align: left; }
.dc th { background: var(--teal); color: #fff; text-align: center; font-weight: 600; }
.dc td.lb { background: var(--mint); color: var(--teal); font-weight: 600; }
.doc-band { position: absolute; top: 0; left: 0; right: 0; height: 5mm; background: var(--teal); }
.doc-part { break-after: auto; }
.doc-part ~ .doc-part, .att { break-before: page; }
.att-title { font-size: 14px; font-weight: 700; color: var(--teal); border-bottom: 1px solid var(--line); padding: 8px 0 5px; margin-bottom: 9px; }
.att-title small { font-size: 10px; color: var(--muted); font-weight: 500; margin-left: 6px; }
.att-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.att-grid figure { break-inside: avoid; border: 1px solid var(--line); border-radius: 3px; padding: 6px; }
.att-grid img { display: block; width: 100%; max-height: 105mm; object-fit: contain; }
.att-grid figcaption { font-size: 9px; color: var(--muted); margin-top: 4px; word-break: break-all; }
.att-other { margin-top: 12px; font-size: 10.5px; }
.att-other .att-h { font-weight: 600; color: var(--teal); margin-bottom: 3px; }
.att-other ul { padding-left: 16px; }
.esign { display: inline-block; border: 1.6px solid var(--stamp); color: var(--stamp); border-radius: 4px; padding: 3px 9px; font-size: 9.5px; line-height: 1.35; transform: rotate(-2.5deg); max-width: 92%; }
.esign-title { font-weight: 700; font-size: 10px; }
.esign-ref { white-space: nowrap; font-weight: 600; }
.esign-note { font-size: 9px; color: var(--stamp); margin-top: 4px; }
`;

const fontLinks = (fontCss?: boolean) => fontCss === false ? '' :
  '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Thai:wght@400;500;600;700&display=swap" rel="stylesheet">';

const head = (title: string, css: string, fontCss?: boolean) =>
  `<!doctype html><html lang="th"><head><meta charset="utf-8"><title>${esc(title)}</title>${fontLinks(fontCss)}<style>${SHARED_CSS}${css}</style></head>`;

/**
 * Wrap part bodies into a print document: fixed Document Control footer + repeating tfoot spacer of the same height.
 * `tableClass` goes on the print-wrap table (e.g. a named-page class, so every page of the document uses it).
 */
export function wrapDocument(opts: { title: string; body: string; footerHtml: string; extraCss?: string; fontCss?: boolean; tableClass?: string }): string {
  const cls = opts.tableClass ? ` ${esc(opts.tableClass)}` : '';
  return `${head(opts.title, opts.extraCss ?? '', opts.fontCss)}<body>
<div class="footer-fixed">${opts.footerHtml}</div>
<table class="print-wrap${cls}"><thead><tr><td><div class="head-space"></div></td></tr></thead><tbody><tr><td>${opts.body}</td></tr></tbody><tfoot><tr><td><div class="footer-space">${opts.footerHtml}</div></td></tr></tfoot></table>
</body></html>`;
}

export interface DocSegment { body: string; className?: string }

/**
 * Several print-wrap tables in one document (each starts a new page), for segments on different page sizes
 * (named @page rules, e.g. portrait Part 1 + landscape Part 2). Chrome lays out position:fixed against the first
 * page's size, so wrapDocument's fixed footer would land off-page on the other orientation; here each segment
 * repeats the Document Control footer as a visible <tfoot> instead (at the page bottom except on the segment's
 * last page, where it follows the content).
 */
export function wrapSegments(opts: { title: string; segments: DocSegment[]; footerHtml: string; extraCss?: string; fontCss?: boolean }): string {
  const tables = opts.segments.map(sg =>
    `<table class="print-wrap seg${sg.className ? ` ${esc(sg.className)}` : ''}"><thead><tr><td><div class="head-space"></div></td></tr></thead><tbody><tr><td>${sg.body}</td></tr></tbody><tfoot><tr><td><div class="seg-footer">${opts.footerHtml}</div></td></tr></tfoot></table>`);
  return `${head(opts.title, (opts.extraCss ?? '') + SEGMENT_CSS, opts.fontCss)}<body>
${tables.join('\n')}
</body></html>`;
}

const SEGMENT_CSS = `
table.print-wrap.seg + table.print-wrap.seg { break-before: page; }
.seg-footer { padding-top: 3mm; }
`;

export const PRINT_READY_TIMEOUT_MS = 15000;

/**
 * Opens the print popup, waits for load + every <img> + fonts, prints, closes after print.
 * Returns false when the browser blocked the popup (caller shows the alert).
 */
export function openPrintWindow(html: string): boolean {
  const w = window.open('', '', 'width=900,height=1000');
  if (!w) return false;
  w.document.open();
  w.document.write(html);
  w.document.close();
  w.onafterprint = () => w.close();
  const loaded = new Promise<void>(resolve => {
    if (w.document.readyState === 'complete') resolve();
    else w.addEventListener('load', () => resolve(), { once: true });
  });
  const imagesReady = () => Promise.all(Array.from(w.document.images).map(img =>
    img.complete ? Promise.resolve() : new Promise<void>(res => { img.onload = () => res(); img.onerror = () => res(); })));
  // A stalled image/font must not hang the popup forever: print anyway after the timeout.
  const ready = loaded.then(() => imagesReady()).then(() => w.document.fonts.ready).then(() => undefined);
  const timeout = new Promise<void>(res => setTimeout(res, PRINT_READY_TIMEOUT_MS));
  Promise.race([ready, timeout])
    .catch(() => undefined)
    .finally(() => {
      if (w.closed) return;
      try { w.focus(); w.print(); } catch { try { w.close(); } catch { /* popup already gone */ } }
    });
  return true;
}
