import { describe, expect, test } from 'bun:test';
import type { PettyClaim, PettyRound, PettySpec } from '@/app/finance/types-petty';
import {
  claimOutcome, claimPeriod, clearableClaims, clearedByMe, ddRequired, debtDocButton, debtDocMissing, docsLabel, docsState,
  handledClaims, locateClaim,
  locateRound, parseHeadView, parseHolderView, itemSummaryLabel, pendingClaims, pendingHint, pickSummary, printsFor, roundBlocker, roundOutcome, ruleApplies,
  splitByPrimary, tabLabel, usesDd, type ClearRound,
} from './model';

const base = {
  id: 1, fund_id: 1, expense_type: 'WEIGH', expense_date: '2026-10-10', period_from: '2026-10-06', period_to: '2026-10-09',
  driver_employee_id: null, driver_name: null, payee_name: 'สถานีชั่ง ลาดกระบัง', amount: 420, dd_no: null, receipt_no: null,
  created_by: '680043', created_by_name: 'กฤตบุญ ลายเงิน', approved_by: null, approved_at: null, transfer_date: null,
  review_remark: null, return_reason: null, reviewed_by: null, reviewed_at: null, submitted_to_acc_at: null,
  dup_override_reason: null, batch_id: null, items: [],
} as const;
const claim = (over: Partial<PettyClaim>): PettyClaim =>
  ({ ...base, form_id: `LB-B02-2610-${String(over.id ?? 1).padStart(3, '0')}`, status: 'PENDING_APPROVAL', ...over }) as PettyClaim;

const round = (over: Partial<ClearRound>): ClearRound => ({
  id: 7, batch_no: 'LB-B02-2610-B7', fund_id: 1, status: 'CLEAR_PENDING', status_label: '', branch_code: '03',
  division_code: 'B02', holder_employee_id: '12345', holder_name: 'สมพร ถือเงิน', total_amount: 1200, remark: null,
  claim_count: 2, submitted_by: '12345', submitted_at: '2026-10-27T03:00:00Z', clear_required_level: 5,
  clear_approved_by: null, clear_approved_by_name: null, clear_approved_at: null, clear_reject_reason: null,
  voucher_no: null, vouchered_by: null, vouchered_at: null, pay_date: null, paid_by: null, paid_at: null,
  closed_by: null, closed_at: null, ...over,
}) as ClearRound;

const DD_SPEC: PettySpec = {
  prints: ['PETTY_VOUCHER', 'DD'],
  attachments: [
    { key: 'receipt', label: 'ใบเสร็จ', required: true },
    { key: 'transfer', label: 'สลิปโอน', required: true },
    { key: 'photo', label: 'รูปถ่าย' },
  ],
  rules: [{ when: 'total >= 500', require_field: 'dd_no', at: 'BEFORE_SUBMIT_TO_ACCOUNTING' }],
};

describe('parseHolderView', () => {
  test('default is pending', () => {
    expect(parseHolderView(null)).toBe('pending');
    expect(parseHolderView('pending')).toBe('pending');
    expect(parseHolderView('nonsense')).toBe('pending');
  });
  test('clear link from the claim page still lands on ส่งเคลียร์', () => expect(parseHolderView('clear')).toBe('clear'));
  test('history and the old table tab keys land on อนุมัติแล้ว', () => {
    for (const key of ['history', 'head', 'acc', 'sentback', 'returned', 'closed', 'all']) {
      expect(parseHolderView(key)).toBe('history');
    }
  });
});

describe('parseHeadView', () => {
  test('history or pending', () => {
    expect(parseHeadView('history')).toBe('history');
    expect(parseHeadView(null)).toBe('pending');
    expect(parseHeadView('clear')).toBe('pending');
  });
});

describe('tabLabel', () => {
  test('count shown only when there is something, like Advance', () => {
    expect(tabLabel('รออนุมัติจ่าย', 3)).toBe('รออนุมัติจ่าย (3)');
    expect(tabLabel('รออนุมัติจ่าย', 0)).toBe('รออนุมัติจ่าย');
    expect(tabLabel('อนุมัติแล้ว')).toBe('อนุมัติแล้ว');
  });
});

describe('claim lists per tab', () => {
  const claims = [
    claim({ id: 1, status: 'PENDING_APPROVAL' }),
    claim({ id: 2, status: 'APPROVED', transfer_date: '2026-10-22' }),
    claim({ id: 3, status: 'APPROVED', transfer_date: '2026-10-21' }),
    claim({ id: 4, status: 'CLEAR_PENDING', approved_at: '2026-10-20T03:00:00Z' }),
    claim({ id: 5, status: 'RETURNED' }),
    claim({ id: 6, status: 'PENDING_APPROVAL', fund_id: 2 }),
    claim({ id: 7, status: 'CLOSED', approved_at: '2026-10-25T03:00:00Z' }),
    claim({ id: 8, status: 'PENDING_APPROVAL' }),
  ];
  test('pending = waiting for the holder, this fund only, newest first', () => {
    expect(pendingClaims(claims, 1).map(c => c.id)).toEqual([8, 1]);
    expect(pendingClaims(claims, 2).map(c => c.id)).toEqual([6]);
  });
  test('clearable = approved but not in a round yet, oldest pay date first', () => {
    expect(clearableClaims(claims, 1).map(c => c.id)).toEqual([3, 2]);
  });
  test('handled = everything past the holder, including returned, latest action first', () => {
    expect(handledClaims(claims, 1).map(c => c.id)).toEqual([7, 4, 5, 3, 2]);
  });
  test('null fund shows nothing', () => expect(pendingClaims(claims, null)).toEqual([]));
});

describe('claimOutcome', () => {
  test('returned vs approved', () => {
    expect(claimOutcome(claim({ status: 'RETURNED' }))).toBe('returned');
    expect(claimOutcome(claim({ status: 'CLOSED' }))).toBe('approved');
    expect(claimOutcome(claim({ status: 'APPROVED' }))).toBe('approved');
  });
});

describe('claimPeriod', () => {
  test('range, single day, fallback to expense date', () => {
    expect(claimPeriod(claim({}))).toBe('06/10/2026 – 09/10/2026');
    expect(claimPeriod(claim({ period_from: '2026-10-06', period_to: '2026-10-06' }))).toBe('06/10/2026');
    expect(claimPeriod(claim({ period_from: null, period_to: null }))).toBe('10/10/2026');
  });
});

const ALL_IN = { ready: true, missing: [], fromClerk: [], fromHolder: [], slipFolder: null };

describe('docsState', () => {
  test('ready when every required folder has a file', () => {
    expect(docsState(DD_SPEC, { receipt: 1, transfer: 2 })).toEqual(ALL_IN);
  });
  test('lists what is missing by label', () => {
    expect(docsState(DD_SPEC, { receipt: 1, photo: 3 }).missing).toEqual(['สลิปโอน']);
  });
  test('no spec = nothing required', () => expect(docsState(undefined, {})).toEqual(ALL_IN));
  test('only the holder\'s transfer slip missing = owed by the holder, upload goes to transfer', () => {
    expect(docsState(DD_SPEC, { receipt: 1 })).toEqual({
      ready: false, missing: ['สลิปโอน'], fromClerk: [], fromHolder: ['สลิปโอน'], slipFolder: 'transfer',
    });
  });
  test('clerk files missing are kept apart from the holder slip', () => {
    expect(docsState(DD_SPEC, {})).toEqual({
      ready: false, missing: ['ใบเสร็จ', 'สลิปโอน'], fromClerk: ['ใบเสร็จ'], fromHolder: ['สลิปโอน'], slipFolder: 'transfer',
    });
    expect(docsState(DD_SPEC, { transfer: 1 })).toEqual({
      ready: false, missing: ['ใบเสร็จ'], fromClerk: ['ใบเสร็จ'], fromHolder: [], slipFolder: null,
    });
  });
  test('a rule that asks for the transfer slip before approve still counts as the holder\'s', () => {
    const spec: PettySpec = {
      attachments: [{ key: 'receipt', label: 'ใบเสร็จ', required: true }, { key: 'transfer', label: 'หลักฐานโอนเงิน' }],
      rules: [{ when: 'always', require_attachment: 'transfer', at: 'BEFORE_APPROVE' }],
    };
    const out = docsState(spec, { receipt: 1 }, claim({}));
    expect(out.fromClerk).toEqual([]);
    expect(out.fromHolder).toEqual(['หลักฐานโอนเงิน']);
    expect(out.slipFolder).toBe('transfer');
  });
  test('conditional attachment rules before approve count when the claim matches (same as the BE gate)', () => {
    const spec: PettySpec = {
      attachments: [{ key: 'receipt', label: 'ใบเสร็จ', required: true }, { key: 'id_card', label: 'สำเนาบัตรประชาชน' }],
      rules: [
        { when: 'payment_method == โอนเงิน && payee_type == บุคคล/ร้านเงินสด', require_attachment: 'id_card', at: 'BEFORE_APPROVE' },
        { when: 'always', require_attachment: 'receipt', at: 'BEFORE_APPROVE' },
      ],
    };
    const cash = claim({ detail: { payment_method: 'โอนเงิน', payee_type: 'บุคคล/ร้านเงินสด' } });
    const company = claim({ detail: { payment_method: 'โอนเงิน', payee_type: 'นิติบุคคล' } });
    expect(docsState(spec, { receipt: 1 }, cash)).toMatchObject({ ready: false, missing: ['สำเนาบัตรประชาชน'], fromClerk: ['สำเนาบัตรประชาชน'] });
    expect(docsState(spec, { receipt: 1 }, company)).toEqual(ALL_IN);
    expect(docsState(spec, {}, company)).toMatchObject({ ready: false, missing: ['ใบเสร็จ'], fromClerk: ['ใบเสร็จ'] });
  });
});

describe('pendingHint (line above the buttons on the holder\'s pending card)', () => {
  test('nothing to say while loading or when everything is in', () => {
    expect(pendingHint(null)).toBeNull();
    expect(pendingHint(docsState(DD_SPEC, { receipt: 1, transfer: 1 }))).toBeNull();
  });
  test('only the holder slip missing: tell the holder to pay, attach the slip, then approve — with an attach button', () => {
    expect(pendingHint(docsState(DD_SPEC, { receipt: 1 }))).toEqual({
      text: 'โอนเงินแล้วแนบสลิปโอนก่อน แล้วค่อยกดอนุมัติจ่าย', attachFolder: 'transfer',
    });
  });
  test('clerk files missing: keep the old message, no attach button (even if the slip is missing too)', () => {
    const clerk = { text: 'เอกสารยังไม่ครบ ให้คนเปิดใบแนบเพิ่มก่อน หรือกดตีกลับพร้อมบอกว่าขาดอะไร', attachFolder: null };
    expect(pendingHint(docsState(DD_SPEC, { transfer: 1 }))).toEqual(clerk);
    expect(pendingHint(docsState(DD_SPEC, {}))).toEqual(clerk);
  });
});

describe('docsLabel (เอกสาร field on the pending card)', () => {
  test('loading / ready', () => {
    expect(docsLabel(null)).toEqual({ text: 'กำลังตรวจ…', tone: 'muted' });
    expect(docsLabel(docsState(DD_SPEC, { receipt: 1, transfer: 1 }))).toEqual({ text: 'ครบ', tone: 'ok' });
  });
  test('only the holder slip missing = waiting on you, not an error', () =>
    expect(docsLabel(docsState(DD_SPEC, { receipt: 1 }))).toEqual({ text: 'รอสลิปโอนจากคุณ', tone: 'warn' }));
  test('clerk files missing = count of everything missing', () => {
    expect(docsLabel(docsState(DD_SPEC, {}))).toEqual({ text: 'ไม่ครบ ขาด 2 อย่าง', tone: 'bad' });
    expect(docsLabel(docsState(DD_SPEC, { transfer: 1 }))).toEqual({ text: 'ไม่ครบ ขาด 1 อย่าง', tone: 'bad' });
  });
});

describe('DD rules', () => {
  test('usesDd from prints or a dd_no rule', () => {
    expect(usesDd(DD_SPEC)).toBe(true);
    expect(usesDd({ prints: ['DD'] })).toBe(true);
    expect(usesDd({ rules: [{ when: 'always', require_field: 'dd_no', at: 'BEFORE_SUBMIT_TO_ACCOUNTING' }] })).toBe(true);
    expect(usesDd({ prints: ['PETTY_VOUCHER'] })).toBe(false);
    expect(usesDd(undefined)).toBe(false);
  });
  test('ruleApplies mirrors the BE (total >=, total <, always, field ==, unknown = no)', () => {
    const c = claim({ amount: 500, detail: { payee_type: 'นิติบุคคล', payment_method: 'โอนเงิน' } });
    expect(ruleApplies('total >= 500', c)).toBe(true);
    expect(ruleApplies('total >= 501', c)).toBe(false);
    expect(ruleApplies('total < 600', c)).toBe(true);
    expect(ruleApplies('always', c)).toBe(true);
    expect(ruleApplies('', c)).toBe(true);
    expect(ruleApplies('payee_type == นิติบุคคล && payment_method == โอนเงิน', c)).toBe(true);
    expect(ruleApplies('payee_type == บุคคล/ร้านเงินสด', c)).toBe(false);
    expect(ruleApplies('weird thing', c)).toBe(false);
  });
  test('ddRequired only for the before-accounting rule that applies', () => {
    expect(ddRequired(claim({ amount: 480 }), DD_SPEC)).toBe(false);
    expect(ddRequired(claim({ amount: 500 }), DD_SPEC)).toBe(true);
    expect(ddRequired(claim({ amount: 900 }), { rules: [{ when: 'always', require_field: 'dd_no', at: 'BEFORE_APPROVE' }] })).toBe(false);
  });
  test('roundBlocker = DD required but empty', () => {
    expect(roundBlocker(claim({ amount: 900, dd_no: null }), DD_SPEC)).toBe('ต้องใส่ DD ก่อนส่งเคลียร์');
    expect(roundBlocker(claim({ amount: 900, dd_no: '  ' }), DD_SPEC)).toBe('ต้องใส่ DD ก่อนส่งเคลียร์');
    expect(roundBlocker(claim({ amount: 900, dd_no: 'LBDD26100012' }), DD_SPEC)).toBeNull();
    expect(roundBlocker(claim({ amount: 300 }), DD_SPEC)).toBeNull();
  });
});

const PJR_ROW = { event_date: '2026-10-10', qty: 1, rate: 420, amount: 420, driver_role: 'พจร.' };
const PJS_ROW = { ...PJR_ROW, driver_role: 'พจส.' };

describe('debt doc (เลขรับสภาพหนี้) — ใส่หลังโอนเงิน ต้องมีก่อนติ๊กเข้ารอบ', () => {
  test('debtDocMissing: needed (พจร. row, header, or BE flag) and empty', () => {
    expect(debtDocMissing(claim({ status: 'APPROVED', items: [PJR_ROW] }))).toBe(true);
    expect(debtDocMissing(claim({ status: 'APPROVED', items: [PJR_ROW], debt_doc_no: '  ' }))).toBe(true);
    expect(debtDocMissing(claim({ status: 'APPROVED', items: [PJR_ROW], debt_doc_no: 'DA-001' }))).toBe(false);
    expect(debtDocMissing(claim({ status: 'APPROVED', items: [PJS_ROW] }))).toBe(false);
    expect(debtDocMissing(claim({ status: 'APPROVED', detail: { driver_role: 'พจร.' } }))).toBe(true);
    expect(debtDocMissing(claim({ status: 'APPROVED', items: [PJS_ROW], needs_debt_doc: true }))).toBe(true);
    expect(debtDocMissing(claim({ status: 'APPROVED', items: [PJR_ROW], needs_debt_doc: false }))).toBe(false);
  });
  test('roundBlocker: missing debt doc blocks the tick', () => {
    expect(roundBlocker(claim({ status: 'APPROVED', items: [PJR_ROW] }), undefined)).toBe('ต้องใส่เลขรับสภาพหนี้ก่อนส่งเคลียร์');
    expect(roundBlocker(claim({ status: 'APPROVED', items: [PJR_ROW], debt_doc_no: 'DA-001' }), undefined)).toBeNull();
    expect(roundBlocker(claim({ status: 'APPROVED', items: [PJS_ROW] }), undefined)).toBeNull();
  });
  test('roundBlocker: DD and debt doc both missing = one line naming both', () => {
    expect(roundBlocker(claim({ status: 'APPROVED', amount: 900, items: [PJR_ROW] }), DD_SPEC))
      .toBe('ต้องใส่ DD และเลขรับสภาพหนี้ก่อนส่งเคลียร์');
    expect(roundBlocker(claim({ status: 'APPROVED', amount: 900, items: [PJR_ROW], debt_doc_no: 'DA-001' }), DD_SPEC))
      .toBe('ต้องใส่ DD ก่อนส่งเคลียร์');
  });
  test('debtDocButton: only on approved claims that need it · ใส่ when empty, แก้ when set', () => {
    expect(debtDocButton(claim({ status: 'APPROVED', items: [PJR_ROW] }))).toBe('ใส่เลขรับสภาพหนี้');
    expect(debtDocButton(claim({ status: 'APPROVED', items: [PJR_ROW], debt_doc_no: 'DA-001' }))).toBe('แก้เลขรับสภาพหนี้');
    expect(debtDocButton(claim({ status: 'APPROVED', items: [PJS_ROW] }))).toBeNull();
    expect(debtDocButton(claim({ status: 'PENDING_APPROVAL', items: [PJR_ROW] }))).toBeNull();
    expect(debtDocButton(claim({ status: 'CLEAR_PENDING', items: [PJR_ROW], debt_doc_no: 'DA-001' }))).toBeNull();
  });
});

describe('pickSummary', () => {
  test('only ticked claims that are still shown count', () => {
    const shown = [claim({ id: 1, amount: 420 }), claim({ id: 2, amount: 1200 }), claim({ id: 3, amount: 80.5 })];
    const out = pickSummary(shown, [1, 3, 99]);
    expect(out.picked.map(c => c.id)).toEqual([1, 3]);
    expect(out.sum).toBe(500.5);
  });
});

describe('splitByPrimary', () => {
  test('is_primary false = อนุมัติแทนได้ · true or missing (BE before lane A) = รอฉันอนุมัติ', () => {
    const rows = [round({ id: 1, is_primary: true }), round({ id: 2, is_primary: false }), round({ id: 3 })];
    const { mine, delegable } = splitByPrimary(rows);
    expect(mine.map(r => r.id)).toEqual([1, 3]);
    expect(delegable.map(r => r.id)).toEqual([2]);
  });
});

describe('clearedByMe / roundOutcome', () => {
  test('rounds I approved or rejected, latest first, never the pending ones', () => {
    const rows = [
      round({ id: 1, status: 'AWAITING_REVIEW', clear_approved_by: '600100', clear_approved_at: '2026-10-27T08:00:00Z' }),
      round({ id: 2, status: 'CLEAR_REJECTED', clear_approved_by: '600100', clear_approved_at: '2026-10-28T08:00:00Z', clear_reject_reason: 'ใบชั่งไม่ครบ' }),
      round({ id: 3, status: 'CLOSED', clear_approved_by: '600200', clear_approved_at: '2026-10-29T08:00:00Z' }),
      round({ id: 4, status: 'CLEAR_PENDING', clear_approved_by: '600100' }),
    ];
    expect(clearedByMe(rows, '600100').map(r => r.id)).toEqual([2, 1]);
    expect(clearedByMe(rows, undefined)).toEqual([]);
  });
  test('rejected vs approved', () => {
    expect(roundOutcome(round({ status: 'CLEAR_REJECTED' }))).toBe('rejected');
    expect(roundOutcome(round({ status: 'VOUCHERED' }))).toBe('approved');
  });
});

describe('locateClaim (?doc= deep link)', () => {
  const lists = {
    pending: [claim({ id: 1, form_id: 'A-1' })],
    clearable: [claim({ id: 2, form_id: 'A-2', status: 'APPROVED' })],
    handled: [
      claim({ id: 3, form_id: 'A-3', status: 'CLEAR_PENDING', approved_at: '2026-10-20T03:00:00Z' }),
      claim({ id: 4, form_id: 'A-4', status: 'RETURNED' }),
    ],
  };
  test('pending card gets focus', () => expect(locateClaim('A-1', lists)).toEqual({ view: 'pending', hit: true }));
  test('approved but not sent yet = ส่งเคลียร์', () => expect(locateClaim('A-2', lists)).toEqual({ view: 'clear', hit: true }));
  test('already handled explains where it went', () => {
    expect(locateClaim('A-3', lists)).toEqual({ view: 'history', hit: true, notice: 'คุณอนุมัติจ่ายใบ A-3 แล้ว เมื่อ 20/10/2026' });
    expect(locateClaim('A-4', lists)).toEqual({ view: 'history', hit: true, notice: 'ใบ A-4 ตีกลับไปแล้ว รอคนเปิดใบแก้แล้วส่งมาใหม่' });
  });
  test('unknown form says so', () => {
    expect(locateClaim('Z-9', lists)).toEqual({ view: 'pending', hit: false, notice: 'ใบ Z-9 ไม่อยู่ในคิวของคุณ อาจไม่ใช่ใบของวงเงินที่คุณถือ' });
  });
});

describe('locateRound (?doc= on the head page)', () => {
  const rounds: ClearRound[] = [round({ id: 7, batch_no: 'LB-B02-2610-B7' }), round({ id: 8, batch_no: 'LB-B02-2610-B8', is_primary: false })];
  test('by id or batch no, picks the right sub-tab', () => {
    expect(locateRound('7', rounds)).toEqual({ id: 7, sub: 'mine' });
    expect(locateRound('LB-B02-2610-B8', rounds)).toEqual({ id: 8, sub: 'delegable' });
  });
  test('missing round = null', () => expect(locateRound('LB-B02-2610-B9', rounds)).toBeNull());
});

describe('printsFor (print menu of one claim)', () => {
  const GENERAL: PettySpec = {
    prints: ['PETTY_VOUCHER', 'RECEIPT_SUBSTITUTE', 'DD'],
    print_when: { RECEIPT_SUBSTITUTE: 'bill_kind == สำเนา' },
  };
  test('receipt substitute only when the cash bill is a copy', () => {
    expect(printsFor(GENERAL, claim({ detail: { bill_kind: 'สำเนา' } }))).toEqual(['PETTY_VOUCHER', 'RECEIPT_SUBSTITUTE', 'DD']);
    expect(printsFor(GENERAL, claim({ detail: { bill_kind: 'ตัวจริง' } }))).toEqual(['PETTY_VOUCHER', 'DD']);
    expect(printsFor(GENERAL, claim({ detail: {} }))).toEqual(['PETTY_VOUCHER', 'DD']);
  });
  test('types without print_when keep every print', () => {
    expect(printsFor({ prints: ['PETTY_VOUCHER', 'RECEIPT_SUBSTITUTE', 'DD'] }, claim({}))).toEqual(['PETTY_VOUCHER', 'RECEIPT_SUBSTITUTE', 'DD']);
  });
  test('no prints listed = the voucher only', () => {
    expect(printsFor({}, claim({}))).toEqual(['PETTY_VOUCHER']);
  });
});

describe('itemSummaryLabel (print menu name of the item summary)', () => {
  const truck = { key: 'truck', label: 'รถ', type: 'truck' };
  test('rows with a required truck = per truck / per day', () =>
    expect(itemSummaryLabel({ item_based: true, item_fields: [{ ...truck, required: true }] })).toBe('ใบสรุปรายการ (รายคัน/รายวัน)'));
  test('rows without a required truck (ค่าใช้จ่ายทั่วไป) do not say per truck', () =>
    expect(itemSummaryLabel({ item_based: true, item_fields: [{ ...truck, required: false }] })).toBe('ใบสรุปรายการ (รายบิล/รายวัน)'));
  test('single-amount types = plain name', () => expect(itemSummaryLabel({ item_based: false })).toBe('ใบสรุปรายการ'));
});

// type-only guard: PettyRound stays assignable (lane A adds is_primary later)
const _r: PettyRound = round({});
void _r;
