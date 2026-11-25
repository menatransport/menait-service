import { describe, expect, test } from 'bun:test';
import { PAYEE_QR_FOLDER, attachmentLabel, payeeQrHtml } from './petty-payee-qr';

describe('QR ผู้รับเงิน (25/11/2026 ทุกประเภท)', () => {
  const spec = { attachments: [{ key: 'receipt', label: 'บิล' }] };
  test('labels: spec first, then the QR folder, else the key', () => {
    expect(attachmentLabel(spec, 'receipt')).toBe('บิล');
    expect(attachmentLabel(spec, PAYEE_QR_FOLDER)).toBe('QR Code / บาร์โค้ดสำหรับโอน');
    expect(attachmentLabel(null, 'other')).toBe('other');
  });
  test('no QR file → nothing in the pay box', () =>
    expect(payeeQrHtml([{ url: 'u', key: 'a.png', folder: 'receipt' }])).toBe(''));
  test('image shows as a picture, PDF as a link', () => {
    const html = payeeQrHtml([
      { url: 'https://s3/x/qr.png', key: 'qr.png', folder: PAYEE_QR_FOLDER },
      { url: 'https://s3/x/bar.pdf', key: 'bar.pdf', folder: PAYEE_QR_FOLDER },
    ]);
    expect(html).toContain('<img src="https://s3/x/qr.png"');
    expect(html).toContain('เปิดไฟล์ bar.pdf');
    expect(html).toContain('สแกนโอนได้เลย');
  });
  test('urls and names are escaped', () =>
    expect(payeeQrHtml([{ url: 'x" onerror="bad()', key: '<b>.pdf', folder: PAYEE_QR_FOLDER }])).not.toMatch(/onerror="bad|<b>/));
});
