/** ประวัติของใบ: การอนุมัติเคลียร์ต้องขึ้นเป็นคำไทย และเรียงตามเวลาร่วมกับขั้นตอนการเงิน (UAT A12, G1–G4) */
import { describe, expect, test } from 'bun:test';
import { clearSubmittedTitle, financeHistory, sentBackLabel, voucherInboxHref } from './historyLog';
import { LOG_ACTION_LABELS } from '@/app/finance/labels';

const fin = (action: string, at: string, remark: string | null = null) =>
  ({ action, changes: null, remark, action_by: '580285', created_at: at });
const clr = (step: number, action: string, at: string, remark: string | null = null) =>
  ({ step, action, clause: '6.5', remark, action_by: '600181', created_at: at });

describe('financeHistory', () => {
  test('การอนุมัติเคลียร์แต่ละขั้นขึ้นในประวัติ แทรกตามเวลา', () => {
    const rows = financeHistory(
      [fin('CLEAR_SUBMIT', '2026-10-19T03:00:00Z'), fin('CONFIRM', '2026-10-19T06:00:00Z')],
      [clr(1, 'SUBMITTED', '2026-10-19T03:00:00Z'), clr(1, 'APPROVED', '2026-10-19T04:00:00Z'), clr(2, 'APPROVED', '2026-10-19T05:00:00Z')],
    );
    expect(rows.map(r => r.label)).toEqual(['ส่งเคลียร์เงิน', 'อนุมัติการเคลียร์ ขั้น 1', 'อนุมัติการเคลียร์ ขั้น 2', 'ยืนยันปิดรายการ']);
  });

  test('ไม่อนุมัติการเคลียร์ขึ้นครั้งเดียว พร้อมเหตุผล ไม่เป็นรหัสดิบ', () => {
    const rows = financeHistory(
      [fin('CLEAR_SUBMIT', '2026-10-19T03:00:00Z'), fin('CLEAR_REJECT', '2026-10-19T04:00:00Z', 'ใบเสร็จไม่ครบ')],
      [clr(1, 'SUBMITTED', '2026-10-19T03:00:00Z'), clr(1, 'REJECTED', '2026-10-19T04:00:00Z', 'ใบเสร็จไม่ครบ')],
    );
    expect(rows.map(r => r.label)).toEqual(['ส่งเคลียร์เงิน', 'ไม่อนุมัติการเคลียร์']);
    expect(rows[1].remark).toBe('ใบเสร็จไม่ครบ');
    expect(rows.some(r => /^[A-Z_]+$/.test(r.label))).toBe(false);
  });

  test('ใบเก่าที่ไม่มี clear_logs ยังแสดงได้', () => {
    expect(financeHistory([fin('PAY', '2026-10-19T03:00:00Z')], undefined).map(r => r.label)).toEqual(['บันทึกการจ่ายเงิน']);
  });

  test('CLEAR_REJECT มีคำไทยในตารางคำ', () => {
    expect(LOG_ACTION_LABELS.CLEAR_REJECT).toBe('ไม่อนุมัติการเคลียร์');
  });
});

describe('clearSubmittedTitle', () => {
  test('ไปรอหัวหน้าอนุมัติเคลียร์ ต้องไม่บอกว่ารอบัญชีตรวจ', () => {
    expect(clearSubmittedTitle('CLEARING_APPROVAL')).toBe('ส่งเคลียร์เงินแล้ว รอหัวหน้าอนุมัติการเคลียร์');
  });
  test('ส่งใหม่โดยไม่ต้องอนุมัติซ้ำ ไปถึงบัญชีเลย', () => {
    expect(clearSubmittedTitle('AWAITING_REVIEW')).toBe('ส่งเคลียร์เงินแล้ว รอบัญชีตรวจ');
  });
  test('ไม่รู้สถานะ ไม่เดา', () => expect(clearSubmittedTitle(undefined)).toBe('ส่งเคลียร์เงินแล้ว'));
});

describe('voucherInboxHref', () => {
  test('ป๊อปอัปรอตั้งเบิกพาไปหน้างานการเงินที่มีปุ่มตั้งเบิก', () => {
    expect(voucherInboxHref('ADV-2610-001')).toBe('/finance/ADV-2610-001');
  });
});

describe('sentBackLabel', () => {
  test('หัวหน้าไม่อนุมัติการเคลียร์ ต้องไม่บอกว่าการเงินส่งกลับ', () => {
    expect(sentBackLabel([fin('CLEAR_SUBMIT', '2026-10-27T02:00:00Z'), fin('CLEAR_REJECT', '2026-10-27T03:00:00Z', 'ใบเสร็จไม่ตรง')]))
      .toBe('หัวหน้าไม่อนุมัติการเคลียร์');
  });
  test('บัญชีตรวจแล้วส่งกลับ', () => {
    expect(sentBackLabel([fin('CLEAR_SUBMIT', '2026-10-27T02:00:00Z'), fin('SEND_BACK', '2026-10-27T03:00:00Z', 'ขาดใบเสร็จ')])).toBe('บัญชีส่งกลับแก้ไข');
  });
  test('ดูครั้งล่าสุด', () => {
    expect(sentBackLabel([fin('CLEAR_REJECT', '2026-10-27T03:00:00Z'), fin('CLEAR_SUBMIT', '2026-10-27T04:00:00Z'), fin('SEND_BACK', '2026-10-27T05:00:00Z')])).toBe('บัญชีส่งกลับแก้ไข');
  });
  test('ไม่มีประวัติ ใช้คำกลาง', () => expect(sentBackLabel([])).toBe('ส่งกลับแก้ไข'));
});

import { fullHistory } from './historyLog';

describe('fullHistory — อนุมัติ + การเงิน + อนุมัติเคลียร์ ในเส้นเวลาเดียว', () => {
  const apv = (action: string, at: string, actor = 'ศิวพร ม่วงสวย') => ({ level_no: 1, action, remark: null, action_at: at, actor_name: actor });
  test('รอบสองหลังตีกลับ อยู่ใต้รอบแรก ไม่ลอยขึ้นบน', () => {
    const rows = fullHistory(
      [apv('APPROVED', '2026-10-05T02:00:00Z'), apv('RESUBMITTED', '2026-10-06T03:00:00Z', 'ผู้เบิก'), apv('APPROVED', '2026-10-06T04:00:00Z')],
      [fin('VOUCHER', '2026-10-05T05:00:00Z'), fin('RETURN', '2026-10-06T01:00:00Z'), fin('RESUBMIT', '2026-10-06T03:00:00Z')],
      undefined,
    );
    expect(rows.map(r => r.label)).toEqual(['อนุมัติ', 'ตั้งเบิกทำจ่าย', 'ตีกลับให้ผู้เบิกแก้ไข', 'ส่งใหม่หลังแก้ไข', 'อนุมัติ']);
  });
  test('ชื่อคนทำแทนรหัสพนักงาน ถ้า BE ส่งชื่อมา', () => {
    const rows = fullHistory([], [{ ...fin('PAY', '2026-10-19T03:00:00Z'), action_by: '610197', action_by_name: 'ณัฐนิชา ใจดี' }], undefined);
    expect(rows[0].actor).toBe('ณัฐนิชา ใจดี');
  });
  test('ไม่โชว์ฟิลด์ภายในของระบบในรายการที่เปลี่ยน', () => {
    const rows = fullHistory([], [{ ...fin('RESUBMIT', '2026-10-19T03:00:00Z'),
      changes: { amount: [5000, 4500], fin_status: ['RETURNED', 'RESUBMITTED'], status_approve: ['Approved', 'In Progress'], current_approval_level: [3, 1] } }], undefined);
    expect(Object.keys(rows[0].changes ?? {})).toEqual(['amount']);
  });
});
