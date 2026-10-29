/**
 * UAT A2 / A10 — สร้างเอกสารพิมพ์จากใบจริงใน prod แล้วตรวจเนื้อหา
 * ไม่ใช่การดูหน้ากระดาษ แต่ยืนยันว่าข้อมูลที่จะถูกพิมพ์ถูกต้องครบถ้วน
 * รัน: bun scripts/uat-print-check.ts ADV-2610-001 ADV-2610-006
 */
import { toCashAdvanceData } from '../lib/finance/cashAdvanceForm';
import { toClearingData, claimSummary, formatClaimDiff, CLAIM_COLUMNS, CLAIM_SIGNERS, CLAIM_SUMMARY_LABELS } from '../lib/finance/clearingForm';
import { formatAccountNo } from '../lib/finance/bank';
import type { AdvanceDetail } from '../app/finance/types';

const BASE = 'https://api-ncac.onrender.com';
const ids = process.argv.slice(2);
let pass = 0;
let fail = 0;

function check(label: string, ok: boolean, note = '') {
  if (ok) pass++; else fail++;
  console.log(`  ${ok ? 'ผ่าน ' : 'ไม่ผ่าน'} · ${label}${note ? ' · ' + note : ''}`);
}

for (const id of ids) {
  const res = await fetch(`${BASE}/finance/advances/${id}`);
  if (!res.ok) { console.log(`ดึง ${id} ไม่ได้ HTTP ${res.status}`); fail++; continue; }
  const detail = (await res.json()) as AdvanceDetail;
  console.log(`\n=== ${id} · ${detail.status} ===`);

  // --- A2 ใบขอเบิก ---
  const cash = toCashAdvanceData(detail);
  check('A2 เลขที่เอกสารตรงกับใบ', cash.document_no === id, cash.document_no);
  check('A2 ชื่อผู้เบิกไม่ว่าง', !!cash.employee.name, cash.employee.name);
  check('A2 ยอดเงินตรงกับคำขอ',
    Number(cash.items[0]?.amount) === Number(detail.request.amount),
    `${cash.items[0]?.amount} = ${detail.request.amount}`);
  const printedAcc = (cash.employee as Record<string, unknown>).bank_account_no as string;
  check('A2 เลขบัญชีบนใบตรงกับที่ระบบเก็บ',
    printedAcc === formatAccountNo(detail.request.account_no ?? ''),
    `${printedAcc} ← ${detail.request.account_no}`);
  const ticked = cash.centers.filter(Boolean).length;
  check('A2 ติ๊กศูนย์ไม่เกินหนึ่งช่อง', ticked <= 1, `ติ๊ก ${ticked} ช่อง`);
  check('A2 ผู้ขอเบิกมีลายเซ็น', !!cash.signatures.requester.name);
  check('A2 ช่องผู้จัดการเว้นว่างเสมอ', cash.signatures.manager.name === '');

  // --- A10 ใบเคลียร์ ---
  if (detail.fin?.amount_actual != null) {
    const clearing = toClearingData(detail);
    const rows = clearing.items ?? [];
    check('A10 คอลัมน์ใบเคลียร์ครบ 7 ช่อง', CLAIM_COLUMNS.length === 7, String(CLAIM_COLUMNS.length));
    check('A10 มีรายการค่าใช้จ่าย', rows.length > 0, `${rows.length} รายการ`);
    const sum = claimSummary(rows, Number(detail.fin.amount_paid ?? 0));
    check('A10 ยอดรวมตรงกับยอดใช้จริงที่ระบบเก็บ',
      Math.abs(sum.e - Number(detail.fin.amount_actual)) < 0.005,
      `ใบ ${sum.e} = ระบบ ${detail.fin.amount_actual}`);
    // หัวคอลัมน์คือ "จ่ายเงินคืนพนักงาน /(พนักงานคืนเงินบริษัท)" จึงกลับเครื่องหมายกับ settle_amount โดยตั้งใจ
    const settle = Number(detail.fin.settle_amount ?? 0);
    check('A10 ส่วนต่างในใบกลับเครื่องหมายกับยอดคืนบริษัทถูกต้อง',
      Math.abs(sum.diff + settle) < 0.005,
      `ใบ ${formatClaimDiff(sum.diff)} · ระบบคืนบริษัท ${settle} · หัวคอลัมน์ "${CLAIM_SUMMARY_LABELS.diff}"`);
    if (settle > 0) {
      check('A10 พนักงานต้องคืนเงิน ใบต้องพิมพ์ในวงเล็บ',
        formatClaimDiff(sum.diff).startsWith('('), formatClaimDiff(sum.diff));
    }
    check('A10 ช่องลงนามครบ 5 ช่อง', CLAIM_SIGNERS.length === 5, CLAIM_SIGNERS.join(' · '));
  } else {
    console.log('  (ใบนี้ยังไม่มีข้อมูลเคลียร์ ข้ามส่วน A10)');
  }
}

console.log(`\nสรุป: ผ่าน ${pass} · ไม่ผ่าน ${fail}`);
if (fail > 0) process.exit(1);
