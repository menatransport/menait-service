import { describe, expect, test } from 'bun:test';
import type { PettyClaim, PettyExpenseType, PettyFund, PettyRound } from '@/app/finance/types-petty';
import {
  CLAIM_COLUMNS, ROUND_COLUMNS, WORKLIST_TABS, claimHistory, defaultTab, inMonthRange, matchesWorklistFilters,
  payFormError, payPayload, resolveTab, roundActionBody, roundDocChanges, roundDocError, roundDuplicateText,
  roundHistory, roundLogLabel, rowsForTab, searchWorklist, sortWorklist, tabKind, voucherFormError,
  voucherPayload, worklistCounts, worklistSheetRows, worklistStats, type WorklistCtx,
} from './petty-worklist';

let seq = 0;
const claim = (status: PettyClaim['status'], over: Partial<PettyClaim> = {}): PettyClaim => {
  seq += 1;
  return {
    id: seq, form_id: `LB-B02-2610-${String(seq).padStart(3, '0')}`, fund_id: 1, expense_type: 'WEIGH',
    expense_date: '2026-10-20', period_from: '2026-10-18', period_to: '2026-10-20', driver_employee_id: null,
    driver_name: null, payee_name: 'สถานีชั่ง ลาดกระบัง', amount: 420, dd_no: null, receipt_no: null, status,
    created_by: '680043', created_by_name: 'กฤตบุญ ลายเงิน', approved_by: '12345', approved_by_name: 'สมพร ถือเงิน',
    approved_at: '2026-10-21T02:00:00Z', transfer_date: '2026-10-21', review_remark: null, return_reason: null,
    reviewed_by: null, reviewed_at: null, submitted_to_acc_at: null, dup_override_reason: null, batch_id: 6,
    items: [], ...over,
  };
};
const round = (id: number, status: PettyRound['status'], over: Partial<PettyRound> = {}): PettyRound => ({
  id, batch_no: `LB-B02-2610-B${id}`, fund_id: 1, status, status_label: status, branch_code: '03', division_code: 'B02',
  holder_employee_id: '12345', holder_name: 'สมพร ถือเงิน', total_amount: 1000, remark: null, claim_count: 2,
  submitted_by: '12345', submitted_at: '2026-10-27T03:00:00Z', clear_required_level: 5, clear_approved_by: '600100',
  clear_approved_by_name: 'วิชัย ผู้จัดการ', clear_approved_at: '2026-10-27T08:00:00Z', clear_reject_reason: null,
  voucher_no: null, vouchered_by: null, vouchered_at: null, pay_date: null, paid_by: null, paid_at: null,
  closed_by: null, closed_at: null, ...over,
});

const types: PettyExpenseType[] = [
  { code: 'WEIGH', name_th: 'ค่าชั่งน้ำหนัก', atms_sku: null, sort_order: 1, is_active: true, spec: { prints: ['PETTY_VOUCHER', 'DD'] } },
  { code: 'TRIP', name_th: 'ค่าเบี้ยเลี้ยง', atms_sku: null, sort_order: 2, is_active: true, spec: { prints: ['PETTY_VOUCHER'] } },
];
const funds: PettyFund[] = [{ id: 1, branch_code: '03', division_code: 'B02', holder_employee_id: '12345', holder_name: 'สมพร ถือเงิน', fund_limit: 50000, is_active: true }];
const ctx: WorklistCtx = {
  typeName: code => types.find(t => t.code === code)?.name_th ?? code,
  fundOf: id => funds.find(f => f.id === id),
  roundNo: id => (id ? `LB-B02-2610-B${id}` : null),
};

describe('WORKLIST_TABS', () => {
  test('six tabs in the agreed order, Advance words', () => {
    expect(WORKLIST_TABS.map(t => t.label)).toEqual(['รอบัญชีตรวจ', 'ส่งกลับแก้ไข', 'รอตั้งเบิก', 'รอจ่าย', 'ปิดแล้ว', 'ทั้งหมด']);
  });
  test('the first two tabs list claims, the rest list rounds', () => {
    expect(WORKLIST_TABS.map(t => tabKind(t.key))).toEqual(['claim', 'claim', 'round', 'round', 'round', 'round']);
  });
});

describe('resolveTab / defaultTab', () => {
  test('a known ?tab= wins', () => expect(resolveTab('pay', 'review')).toBe('pay'));
  test('an unknown or empty ?tab= falls back', () => {
    expect(resolveTab('nope', 'review')).toBe('review');
    expect(resolveTab(null, 'voucher')).toBe('voucher');
  });
  test('accounting lands on รอบัญชีตรวจ, treasury on รอจ่าย, admin on รอบัญชีตรวจ', () => {
    expect(defaultTab({ review: true, voucher: true, pay: false })).toBe('review');
    expect(defaultTab({ review: false, voucher: false, pay: true })).toBe('pay');
    expect(defaultTab({ review: true, voucher: true, pay: true })).toBe('review');
  });
});

describe('rowsForTab', () => {
  const claims = [claim('AWAITING_REVIEW'), claim('SENT_BACK'), claim('AWAITING_REVIEW')];
  const rounds = [round(1, 'CLEAR_PENDING'), round(2, 'AWAITING_REVIEW'), round(3, 'REVIEWED'), round(4, 'VOUCHERED'),
    round(5, 'CLOSED'), round(6, 'CLEAR_REJECTED')];
  test('claim tabs filter claims by status', () => {
    expect(rowsForTab('review', claims, rounds)).toEqual({ kind: 'claim', rows: [claims[0], claims[2]] });
    expect(rowsForTab('sentback', claims, rounds)).toEqual({ kind: 'claim', rows: [claims[1]] });
  });
  test('round tabs filter rounds by status', () => {
    expect(rowsForTab('voucher', claims, rounds)).toEqual({ kind: 'round', rows: [rounds[2]] });
    expect(rowsForTab('pay', claims, rounds)).toEqual({ kind: 'round', rows: [rounds[3]] });
    expect(rowsForTab('closed', claims, rounds)).toEqual({ kind: 'round', rows: [rounds[4]] });
  });
  test('ทั้งหมด = every round that reached accounting (not the ones still with the head or rejected)', () => {
    expect(rowsForTab('all', claims, rounds).rows.map(r => r.id)).toEqual([2, 3, 4, 5]);
  });
  test('counts follow the same rules', () => {
    expect(worklistCounts(claims, rounds)).toEqual({ review: 2, sentback: 1, voucher: 1, pay: 1, closed: 1, all: 4 });
  });
});

describe('worklistStats', () => {
  test('six tiles: money owed back, then each queue, then claims missing DD', () => {
    const claims = [claim('AWAITING_REVIEW', { amount: 640 }), claim('AWAITING_REVIEW', { amount: 100, dd_no: 'LBDD1' }),
      claim('AWAITING_REVIEW', { expense_type: 'TRIP', amount: 50 }), claim('SENT_BACK')];
    const rounds = [round(2, 'AWAITING_REVIEW', { total_amount: 790 }), round(3, 'REVIEWED', { total_amount: 1883 }),
      round(4, 'VOUCHERED', { total_amount: 2200 }), round(5, 'CLOSED', { total_amount: 5100 }), round(1, 'CLEAR_PENDING', { total_amount: 9 })];
    const stats = worklistStats(claims, rounds, types);
    expect(stats.map(s => s.label)).toEqual(['ยอดรอจ่ายคืน (บาท)', 'รอบัญชีตรวจ', 'ส่งกลับแก้ไข', 'รอตั้งเบิก', 'รอจ่าย', 'ยังไม่มีเลข DD']);
    expect(stats[0].value).toBe('4,873.00');
    expect(stats.slice(1).map(s => s.value)).toEqual([3, 1, 1, 1, 1]);
    // only types that print a DD need one — the TRIP claim is not counted
    expect(stats[5].alert).toBe(true);
  });
});

describe('columns', () => {
  test('claim columns read like the Advance sheet', () => {
    expect(CLAIM_COLUMNS.map(c => c.label)).toEqual([
      'ลำดับ', 'เลขที่ใบเบิก', 'ผู้เปิดใบ', 'สาขา', 'แผนก', 'สถานะ', 'รอบ', 'ประเภท', 'จ่ายให้', 'ช่วงวันที่',
      'ยอดเงิน', 'เลขที่ DD', 'วันที่จ่าย', 'เจ้าของเงินสด', 'หมายเหตุ',
    ]);
  });
  test('round columns reuse the Advance names for the same data', () => {
    expect(ROUND_COLUMNS.map(c => c.label)).toEqual([
      'ลำดับ', 'เลขที่รอบ', 'เจ้าของเงินสด', 'สาขา', 'แผนก', 'สถานะ', 'เลขที่ตั้งเบิก', 'วันที่ตั้งเบิก', 'เลขที่ทำจ่าย',
      'จำนวนใบ', 'ยอดเงิน', 'วันที่ส่งเคลียร์', 'หัวหน้าที่อนุมัติเคลียร์', 'วันที่โอนเงิน', 'ปิดรอบเมื่อ',
    ]);
  });
  test('claim cell text', () => {
    const c = claim('SENT_BACK', { review_remark: 'ใบชั่งเบลอ', dd_no: 'LBDD26100012' });
    const text = Object.fromEntries(CLAIM_COLUMNS.map(col => [col.label, col.text(c, ctx)]));
    expect(text['เลขที่ใบเบิก']).toBe(c.form_id);
    expect(text['สาขา']).toBe('03');
    expect(text['สถานะ']).toBe('ส่งกลับแก้ไข');
    expect(text['รอบ']).toBe('LB-B02-2610-B6');
    expect(text['ช่วงวันที่']).toBe('18/10/2026 – 20/10/2026');
    expect(text['ยอดเงิน']).toBe('420.00');
    expect(text['หมายเหตุ']).toBe('ใบชั่งเบลอ');
  });
  test('round cell text tolerates an older BE without voucher_date / pay_doc_no', () => {
    const r = round(4, 'VOUCHERED', { voucher_no: 'PV-2610-014' });
    const text = Object.fromEntries(ROUND_COLUMNS.map(col => [col.label, col.text(r, ctx)]));
    expect(text['เลขที่ตั้งเบิก']).toBe('PV-2610-014');
    expect(text['วันที่ตั้งเบิก']).toBe('');
    expect(text['เลขที่ทำจ่าย']).toBe('');
    expect(text['สถานะ']).toBe('รอจ่าย');
    expect(text['จำนวนใบ']).toBe('2');
  });
});

describe('matchesWorklistFilters', () => {
  const r1 = round(3, 'REVIEWED', { total_amount: 1883 });
  const r2 = round(4, 'VOUCHERED', { total_amount: 2200, voucher_no: 'PV-2610-014' });
  test('text contains, case and comma blind', () => {
    expect(matchesWorklistFilters(r2, ROUND_COLUMNS, { 'เลขที่ตั้งเบิก': 'pv-2610' }, ctx)).toBe(true);
    expect(matchesWorklistFilters(r1, ROUND_COLUMNS, { 'เลขที่ตั้งเบิก': 'pv-2610' }, ctx)).toBe(false);
    expect(matchesWorklistFilters(r2, ROUND_COLUMNS, { 'ยอดเงิน': '2200' }, ctx)).toBe(true);
  });
  test('money columns take > < >= <= =', () => {
    expect(matchesWorklistFilters(r1, ROUND_COLUMNS, { 'ยอดเงิน': '>2000' }, ctx)).toBe(false);
    expect(matchesWorklistFilters(r2, ROUND_COLUMNS, { 'ยอดเงิน': '>2000' }, ctx)).toBe(true);
  });
  test('"-" finds empty cells', () => {
    expect(matchesWorklistFilters(r1, ROUND_COLUMNS, { 'เลขที่ตั้งเบิก': '-' }, ctx)).toBe(true);
    expect(matchesWorklistFilters(r2, ROUND_COLUMNS, { 'เลขที่ตั้งเบิก': '-' }, ctx)).toBe(false);
  });
  test('status filter takes the status code from the dropdown', () => {
    expect(matchesWorklistFilters(r2, ROUND_COLUMNS, { 'สถานะ': 'VOUCHERED' }, ctx)).toBe(true);
    expect(matchesWorklistFilters(r1, ROUND_COLUMNS, { 'สถานะ': 'VOUCHERED' }, ctx)).toBe(false);
  });
  test('blank filters pass everything', () => {
    expect(matchesWorklistFilters(r1, ROUND_COLUMNS, { 'เลขที่ตั้งเบิก': '  ' }, ctx)).toBe(true);
  });
});

describe('search / month / sort', () => {
  test('claim search: form id, opener, payee, DD, type, round', () => {
    const c = claim('AWAITING_REVIEW', { dd_no: 'LBDD26100012' });
    for (const q of [c.form_id, 'กฤตบุญ', 'ลาดกระบัง', 'lbdd2610', 'ชั่ง', 'B6']) {
      expect(searchWorklist('claim', c, q, ctx)).toBe(true);
    }
    expect(searchWorklist('claim', c, 'ไม่มีคำนี้', ctx)).toBe(false);
  });
  test('round search: round no, holder, voucher no, pay doc no', () => {
    const r = round(4, 'CLOSED', { voucher_no: 'PV-1', pay_doc_no: 'PAY-77' });
    for (const q of ['B4', 'สมพร', 'pv-1', 'pay-77']) expect(searchWorklist('round', r, q, ctx)).toBe(true);
  });
  test('month range: claims by expense date, rounds by the BKK day they were sent', () => {
    expect(inMonthRange('claim', claim('AWAITING_REVIEW'), '2026-10', '2026-10')).toBe(true);
    expect(inMonthRange('claim', claim('AWAITING_REVIEW'), '2026-11', '2026-12')).toBe(false);
    // 31 Oct 20:00 UTC is already 1 Nov in Bangkok
    expect(inMonthRange('round', round(1, 'CLOSED', { submitted_at: '2026-10-31T20:00:00Z' }), '2026-11', '2026-11')).toBe(true);
  });
  test('newest first by default, flip for oldest first', () => {
    const rows = [round(1, 'CLOSED'), round(3, 'CLOSED'), round(2, 'CLOSED')];
    expect(sortWorklist(rows, 'desc').map(r => r.id)).toEqual([3, 2, 1]);
    expect(sortWorklist(rows, 'asc').map(r => r.id)).toEqual([1, 2, 3]);
  });
});

describe('worklistSheetRows', () => {
  test('Excel rows use the table columns, money as numbers', () => {
    const rows = worklistSheetRows('round', [round(4, 'VOUCHERED', { total_amount: 2200, voucher_no: 'PV-1' })], ctx);
    expect(Object.keys(rows[0])).toEqual(ROUND_COLUMNS.map(c => c.label));
    expect(rows[0]['ลำดับ']).toBe(1);
    expect(rows[0]['ยอดเงิน']).toBe(2200);
    expect(rows[0]['เลขที่ตั้งเบิก']).toBe('PV-1');
  });
});

describe('voucher / pay payloads', () => {
  test('voucher: number optional (blank → null), date required', () => {
    expect(voucherPayload('  SADV-1 ', '2026-10-29')).toEqual({ voucher_no: 'SADV-1', voucher_date: '2026-10-29' });
    expect(voucherPayload('   ', '2026-10-29')).toEqual({ voucher_no: null, voucher_date: '2026-10-29' });
    expect(voucherFormError('', '')).toBe('กรุณาระบุวันที่ตั้งเบิก');
    expect(voucherFormError('x'.repeat(51), '2026-10-29')).toBe('เลขที่ตั้งเบิกยาวได้ไม่เกิน 50 ตัว');
    expect(voucherFormError('', '2026-10-29')).toBeNull();
  });
  test('pay: transfer date required, pay doc no optional', () => {
    expect(payPayload('2026-10-29', ' PAY-1 ')).toEqual({ pay_date: '2026-10-29', pay_doc_no: 'PAY-1' });
    expect(payPayload('2026-10-29', '')).toEqual({ pay_date: '2026-10-29', pay_doc_no: null });
    expect(payFormError('', '')).toBe('กรุณาระบุวันที่โอนเงิน');
    expect(payFormError('2026-10-29', 'x'.repeat(51))).toBe('เลขที่ทำจ่ายยาวได้ไม่เกิน 50 ตัว');
    expect(payFormError('2026-10-29', '')).toBeNull();
  });
});

describe('doc-number edit', () => {
  const r = round(4, 'CLOSED', { voucher_no: 'PV-1', voucher_date: '2026-10-28', pay_doc_no: 'PAY-1' });
  test('only fields that really changed are sent', () => {
    expect(roundDocChanges(r, { voucher_no: 'PV-1', voucher_date: '2026-10-28', pay_doc_no: ' PAY-2 ' }, ['voucher_no', 'voucher_date', 'pay_doc_no']))
      .toEqual({ pay_doc_no: 'PAY-2' });
  });
  test('fields the user may not edit are ignored even if typed', () => {
    expect(roundDocChanges(r, { voucher_no: 'PV-9', pay_doc_no: 'PAY-9' }, ['pay_doc_no'])).toEqual({ pay_doc_no: 'PAY-9' });
  });
  test('a number may be filled in for the first time', () => {
    expect(roundDocChanges(round(4, 'VOUCHERED'), { voucher_no: 'PV-3' }, ['voucher_no', 'voucher_date'])).toEqual({ voucher_no: 'PV-3' });
  });
  test('errors: nothing changed, blank date, too long', () => {
    expect(roundDocError({})).toBe('ยังไม่ได้แก้อะไร');
    expect(roundDocError({ voucher_date: '' })).toBe('กรุณาระบุวันที่ตั้งเบิก');
    expect(roundDocError({ pay_doc_no: 'x'.repeat(51) })).toBe('เลขที่ทำจ่ายยาวได้ไม่เกิน 50 ตัว');
    expect(roundDocError({ voucher_no: '' })).toBeNull(); // clearing an optional number is allowed
  });
  test('duplicate text names the other rounds', () => {
    expect(roundDuplicateText('voucher_no', 'PV-1', ['LB-B02-2610-B1'])).toBe('เลขที่ตั้งเบิก PV-1 ซ้ำกับรอบ LB-B02-2610-B1');
    expect(roundDuplicateText('pay_doc_no', 'P', ['A', 'B', 'C', 'D', 'E', 'F'])).toBe('เลขที่ทำจ่าย P ซ้ำกับรอบ A, B, C, D, E และอีก 1 รอบ');
  });
});

describe('roundActionBody (proxy whitelist)', () => {
  test('keeps only what each action takes', () => {
    expect(roundActionBody('voucher', { voucher_no: 'A', voucher_date: '2026-10-29', employee_id: 'x', status: 'CLOSED' }))
      .toEqual({ voucher_no: 'A', voucher_date: '2026-10-29' });
    expect(roundActionBody('pay', { pay_date: '2026-10-29', pay_doc_no: null, amount: 9 })).toEqual({ pay_date: '2026-10-29', pay_doc_no: null });
    expect(roundActionBody('clear-reject', { reason: 'ไม่ครบ', x: 1 })).toEqual({ reason: 'ไม่ครบ' });
    expect(roundActionBody('clear-approve', { anything: 1 })).toEqual({});
    expect(roundActionBody('doc-numbers', { voucher_no: 'A', remark: 'พิมพ์ผิด', batch_no: 'X' })).toEqual({ voucher_no: 'A', remark: 'พิมพ์ผิด' });
  });
  test('a non-object body becomes empty', () => expect(roundActionBody('pay', null)).toEqual({}));
});

describe('history', () => {
  test('round log codes read in Thai, unknown codes pass through', () => {
    expect(roundLogLabel('SUBMIT_ROUND')).toBe('ส่งเคลียร์');
    expect(roundLogLabel('CLEAR_APPROVE')).toBe('อนุมัติเคลียร์');
    expect(roundLogLabel('CLEAR_REJECT')).toBe('ไม่อนุมัติรอบ');
    expect(roundLogLabel('VOUCHER')).toBe('ตั้งเบิกทำจ่าย');
    expect(roundLogLabel('PAY')).toBe('จ่ายเงิน');
    expect(roundLogLabel('CLOSE')).toBe('ปิดรอบ');
    expect(roundLogLabel('EDIT_DOC_NUMBERS')).toBe('แก้ไขเลขที่เอกสาร');
    expect(roundLogLabel('SOMETHING_NEW')).toBe('SOMETHING_NEW');
  });
  test('roundHistory keeps oldest first and falls back to the actor id', () => {
    const rows = roundHistory([
      { action: 'VOUCHER', actor: '660548', actor_name: null, at: '2026-10-28T03:00:00Z', remark: null },
      { action: 'SUBMIT_ROUND', actor: '12345', actor_name: 'สมพร ถือเงิน', at: '2026-10-27T03:00:00Z', remark: null },
    ]);
    expect(rows.map(r => [r.label, r.actor])).toEqual([['ส่งเคลียร์', 'สมพร ถือเงิน'], ['ตั้งเบิกทำจ่าย', '660548']]);
  });
  test('roundHistory of an older BE without logs is empty', () => expect(roundHistory(undefined)).toEqual([]));
  test('claimHistory is pieced together from the dates on the claim when the BE sends no logs', () => {
    const c = claim('SENT_BACK', { submitted_to_acc_at: '2026-10-27T08:00:00Z', reviewed_at: '2026-10-28T02:00:00Z', reviewed_by: '660548', review_remark: 'ใบชั่งเบลอ' });
    expect(claimHistory(c).map(r => [r.label, r.remark])).toEqual([
      ['อนุมัติจ่าย', 'จ่าย 21/10/2026'],
      ['ส่งถึงบัญชี', null],
      ['ส่งกลับแก้ไข', 'ใบชั่งเบลอ'],
    ]);
  });
  test('claimHistory prefers BE logs when present', () => {
    const c = claim('REVIEWED', { logs: [{ action: 'ACC_PASS', actor: '660548', actor_name: 'ชญาดา', at: '2026-10-28T02:00:00Z', remark: null }] });
    expect(claimHistory(c).map(r => r.label)).toEqual(['บัญชีตรวจผ่าน']);
  });
});
