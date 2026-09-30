import { describe, expect, test } from 'bun:test';
import { approvalLink, approvalMessage, lineShareUrl, safeNextPath } from './shareLink';

const detail = { form_id: 'ADV-2569-0001', request: { amount: 12345.5, purpose: 'ค่าเดินทาง\nไปสระบุรี' } };

describe('shareLink', () => {
  test('approvalLink builds deep link and trims trailing slash', () => {
    expect(approvalLink('https://x.test/', 'ADV-1')).toBe('https://x.test/finance/approvals?doc=ADV-1');
  });
  test('message format and amount', () => {
    const m = approvalMessage(detail, 'https://x.test/l');
    expect(m).toBe('ขออนุมัติเบิกเงิน Advance ADV-2569-0001\nจำนวน 12,345.50 บาท\nเพื่อ ค่าเดินทาง\nไปสระบุรี\nhttps://x.test/l');
  });
  test('missing purpose/amount', () => {
    expect(approvalMessage({ form_id: 'A', request: { amount: null, purpose: null } }, 'L')).toBe('ขออนุมัติเบิกเงิน Advance A\nจำนวน - บาท\nเพื่อ -\nL');
  });
  test('lineShareUrl encodes Thai, newlines, & and ?', () => {
    const url = lineShareUrl('ก\nb&c?d=e');
    expect(url.startsWith('https://line.me/R/msg/text/?')).toBe(true);
    expect(url).not.toContain('\n');
    expect(url.split('?').length).toBe(2);
    expect(decodeURIComponent(url.split('?')[1])).toBe('ก\nb&c?d=e');
    expect(url).toContain('%0A');
  });
  test('safeNextPath', () => {
    expect(safeNextPath('/finance/approvals?doc=ADV-1')).toBe('/finance/approvals?doc=ADV-1');
    expect(safeNextPath('//evil.com')).toBeNull();
    expect(safeNextPath('https://evil.com')).toBeNull();
    expect(safeNextPath('/\\evil.com')).toBeNull();
    expect(safeNextPath('/login?x=1')).toBeNull();
    expect(safeNextPath(null)).toBeNull();
  });
});
