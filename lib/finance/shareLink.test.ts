import { describe, expect, test } from 'bun:test';
import { approvalLink, approvalMessage } from './shareLink';

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
});
