import { describe, expect, test } from 'bun:test';
import type { PettyClaim } from '@/app/finance/types-petty';
import { approveDialogHtml, runPettyAction, type PettyActionDeps } from './petty-actions';

const claim = (over: Partial<PettyClaim> = {}): PettyClaim => ({
  id: 1, form_id: 'LB-B02-2610-001', fund_id: 1, expense_type: 'TIRE', expense_date: '2026-10-20',
  period_from: null, period_to: null, driver_employee_id: null, driver_name: null, payee_name: 'ร้านยาง',
  detail: { payee_type: 'บุคคล/ร้านเงินสด' }, amount: 1200, dd_no: null, receipt_no: null, status: 'PENDING_APPROVAL',
  created_by: '680043', approved_by: null, approved_at: null, transfer_date: null, review_remark: null, return_reason: null,
  reviewed_by: null, reviewed_at: null, submitted_to_acc_at: null, dup_override_reason: null, batch_id: null,
  items: [{ event_date: '2026-10-20', qty: 1, rate: 1200, amount: 1200, driver_role: 'พจส.' }], ...over,
});

describe('approveDialogHtml — กล่องยืนยันอนุมัติจ่ายแบบ Advance + ตัวเลขของเงินสดย่อย', () => {
  test('starts with the form line like Advance ("ฟอร์ม …")', () => {
    const html = approveDialogHtml(claim(), { available: 25660 });
    expect(html.indexOf('ฟอร์ม LB-B02-2610-001')).toBeGreaterThan(-1);
    expect(html.indexOf('ฟอร์ม LB-B02-2610-001')).toBeLessThan(html.indexOf('ยอดคงเหลือของคุณ'));
  });
  test('keeps balance, after-approval balance and the real transfer amount', () => {
    const html = approveDialogHtml(claim(), { available: 25660 });
    expect(html).toContain('ยอดคงเหลือของคุณ');
    expect(html).toContain('25,660.00');
    expect(html).toContain('หลังอนุมัติใบนี้');
    expect(html).toContain('24,460.00');
    expect(html).toContain('ยอดที่ต้องโอนจริง');
  });
  test('says when the balance could not be loaded', () => {
    expect(approveDialogHtml(claim(), null)).toContain('โหลดยอดคงเหลือไม่ได้');
  });
  test('shows the debt-acknowledgment number when a row is พจร.', () => {
    const c = claim({ items: [{ event_date: '2026-10-20', qty: 1, rate: 1200, amount: 1200, driver_role: 'พจร.' }] });
    expect(approveDialogHtml(c, { available: 5000 }, 'DA-001')).toContain('ใบรับสภาพหนี้เลขที่ DA-001');
    expect(approveDialogHtml(claim(), { available: 5000 })).not.toContain('ใบรับสภาพหนี้');
  });
  test('พจร. without a number: says it goes in after paying, not "เลขที่ -"', () => {
    const c = claim({ items: [{ event_date: '2026-10-20', qty: 1, rate: 1200, amount: 1200, driver_role: 'พจร.' }] });
    const html = approveDialogHtml(c, { available: 5000 });
    expect(html).toContain('ใส่เลขรับสภาพหนี้หลังโอนเงินได้');
    expect(html).not.toContain('เลขที่ -');
  });
  test('uses the number already on the claim when none is passed', () => {
    const c = claim({ debt_doc_no: 'DA-009', items: [{ event_date: '2026-10-20', qty: 1, rate: 1200, amount: 1200, driver_role: 'พจร.' }] });
    expect(approveDialogHtml(c, null)).toContain('ใบรับสภาพหนี้เลขที่ DA-009');
  });
  test('escapes the form id', () => {
    expect(approveDialogHtml(claim({ form_id: '<b>x</b>' }), null)).toContain('&lt;b&gt;x&lt;/b&gt;');
  });
});

type Opts = Record<string, unknown>;
/** ตัวปลอมของ SweetAlert/API — จดทุกกล่องที่เปิดและทุกคำสั่งที่ยิง */
function fakeDeps(answers: { isConfirmed?: boolean; value?: string }[]) {
  const dialogs: Opts[] = [];
  const posts: { formId: string; action: string; body: Record<string, unknown> }[] = [];
  const deps: PettyActionDeps = {
    confirm: async (o: Opts) => { dialogs.push(o); return answers.shift() ?? { isConfirmed: false }; },
    alert: async (o: Opts) => { dialogs.push({ alert: true, ...o }); },
    post: async (formId, action, body = {}) => { posts.push({ formId, action, body }); return {} as PettyClaim; },
    countAttachments: async () => ({ transfer: 1 }),
    getBalance: async () => ({ fund_id: 1, holder_employee_id: '1', advance_outstanding: 0, petty_committed: 0, available: 5000, fund_limit: null }),
  };
  return { deps, dialogs, posts };
}
const PJR_ITEMS = [{ event_date: '2026-10-20', qty: 1, rate: 1200, amount: 1200, driver_role: 'พจร.' }];

describe('runPettyAction approve — ไม่ถามเลขรับสภาพหนี้แล้ว (ใส่หลังโอนเงิน)', () => {
  test('พจร. claim without a number: only the pay-date confirm opens, and approve goes through', async () => {
    const { deps, dialogs, posts } = fakeDeps([{ isConfirmed: true, value: '2026-10-29' }]);
    expect(await runPettyAction(claim({ items: PJR_ITEMS }), 'approve', {}, deps)).toBe(true);
    expect(dialogs).toHaveLength(1);
    expect(dialogs[0].input).toBe('date');
    expect(JSON.stringify(dialogs)).not.toContain('กรอกเลขที่ใบรับสภาพหนี้');
    expect(posts).toHaveLength(1);
    expect(posts[0].action).toBe('approve');
    expect(posts[0].body.transfer_date).toBe('2026-10-29');
    expect('debt_doc_no' in posts[0].body).toBe(false);
  });
  test('cancel on the pay-date confirm = nothing sent', async () => {
    const { deps, posts } = fakeDeps([{ isConfirmed: false }]);
    expect(await runPettyAction(claim({ items: PJR_ITEMS }), 'approve', {}, deps)).toBe(false);
    expect(posts).toHaveLength(0);
  });
});

describe('runPettyAction debt-doc — เจ้าของเงินสดใส่/แก้เลขรับสภาพหนี้หลังโอน', () => {
  const approved = (over: Partial<PettyClaim> = {}) => claim({ status: 'APPROVED', items: PJR_ITEMS, ...over });
  test('empty: "ใส่เลขรับสภาพหนี้" dialog, max 50, posts the trimmed number to debt-doc', async () => {
    const { deps, dialogs, posts } = fakeDeps([{ isConfirmed: true, value: '  DA-2610-001 ' }]);
    expect(await runPettyAction(approved(), 'debt-doc', {}, deps)).toBe(true);
    expect(dialogs[0].title).toBe('ใส่เลขรับสภาพหนี้');
    expect(dialogs[0].input).toBe('text');
    expect(dialogs[0].inputAttributes).toEqual({ maxlength: '50' });
    expect(dialogs[0].inputValue).toBe('');
    const validate = dialogs[0].inputValidator as (v: string) => string | null;
    expect(validate('')).toBe('กรุณากรอกเลขรับสภาพหนี้');
    expect(validate('DA-1')).toBeNull();
    expect(posts).toEqual([{ formId: 'LB-B02-2610-001', action: 'debt-doc', body: { debt_doc_no: 'DA-2610-001' } }]);
  });
  test('already set: "แก้เลขรับสภาพหนี้" with the old number filled in', async () => {
    const { deps, dialogs } = fakeDeps([{ isConfirmed: true, value: 'DA-2610-002' }]);
    await runPettyAction(approved({ debt_doc_no: 'DA-2610-001' }), 'debt-doc', {}, deps);
    expect(dialogs[0].title).toBe('แก้เลขรับสภาพหนี้');
    expect(dialogs[0].inputValue).toBe('DA-2610-001');
  });
  test('cancel = nothing sent', async () => {
    const { deps, posts } = fakeDeps([{ isConfirmed: false }]);
    expect(await runPettyAction(approved(), 'debt-doc', {}, deps)).toBe(false);
    expect(posts).toHaveLength(0);
  });
});
