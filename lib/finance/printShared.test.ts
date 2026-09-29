import { describe, expect, test } from 'bun:test';
import { PRINT_READY_TIMEOUT_MS, attachmentPagesHtml, documentControlFooter, isImageFile, stampHtml, wrapDocument } from './printShared';

const LABELS = { request: 'เอกสารประกอบการขอเบิก', pay: 'หลักฐานการจ่ายเงิน', clear: 'เคลียร์' };

describe('printShared', () => {
  test('Document Control footer has every label and escapes values', () => {
    const html = documentControlFooter({ ref: 'ADV-1', name: 'Cash Advance Request (ADV)', owner: '<b>x</b>', approvedBy: 'A & B', approvedDate: '14/8/2026', printed: '29/09/2026 10:00' });
    for (const l of ['Document Control &amp; Revision History', 'Document Ref', 'Document Name', 'Document Owner', 'Version No', 'Revision Date', 'Approved By', 'Approved Date', 'Printed',
      'ADV-1', 'Cash Advance Request (ADV)', '1 Nov 22', 'A &amp; B', '14/8/2026', '29/09/2026 10:00']) expect(html).toContain(l);
    expect(html).toContain('&lt;b&gt;x&lt;/b&gt;');
    expect(html).not.toContain('<b>x</b>');
  });
  test('isImageFile', () => {
    for (const n of ['a.jpg', 'a.JPEG', 'a.png', 'a.gif', 'a.webp']) expect(isImageFile(n)).toBe(true);
    for (const n of ['a.pdf', 'a.xlsx', 'png']) expect(isImageFile(n)).toBe(false);
  });
  test('attachmentPagesHtml splits images from other files and is empty with nothing attached', () => {
    const files = [
      { folder: 'request', fileName: '1700000000000-a.png', url: 'https://x/a.png' },
      { folder: 'pay', fileName: 'slip.pdf', url: 'https://x/slip.pdf' },
      { folder: 'clear', fileName: 'c.jpg', url: 'https://x/c.jpg' },
    ];
    const html = attachmentPagesHtml(files, ['request', 'pay'], LABELS);
    expect((html.match(/<img /g) ?? []).length).toBe(1);
    expect(html).toContain('เอกสารประกอบการขอเบิก · a.png');
    expect(html).toContain('<li>หลักฐานการจ่ายเงิน · slip.pdf</li>');
    expect(html).not.toContain('c.jpg');
    expect(attachmentPagesHtml(files, ['check'], LABELS)).toBe('');
    expect(attachmentPagesHtml([], ['request'], LABELS)).toBe('');
    expect(attachmentPagesHtml([{ folder: 'pay', fileName: 'x.pdf', url: 'u' }], ['pay'], LABELS)).not.toContain('<img');
  });
  test('stampHtml renders only for a valid timestamp', () => {
    expect(stampHtml(null)).toBe('');
    expect(stampHtml({ name: 'n', timestamp: 'bad', ref: 'r' })).toBe('');
    expect(stampHtml({ name: 'n', timestamp: '2026-09-15T02:12:45Z', ref: 'R' })).toContain('09:12:45 น.');
  });
  test('wrapDocument has fixed footer, tfoot spacer and the page counter', () => {
    const html = wrapDocument({ title: 't', body: '<p>b</p>', footerHtml: '<div class="dc">F</div>', fontCss: false });
    expect(html).toContain('class="footer-fixed"');
    expect(html).toContain('<tfoot>');
    expect((html.match(/class="dc">F/g) ?? []).length).toBe(2);
    expect(html).toContain('counter(page)');
    expect(html).toContain('"Page " counter(page)');
  });
  test('print readiness is bounded by a timeout', () => {
    expect(PRINT_READY_TIMEOUT_MS).toBeGreaterThan(0);
    expect(PRINT_READY_TIMEOUT_MS).toBeLessThanOrEqual(20000);
  });
});
