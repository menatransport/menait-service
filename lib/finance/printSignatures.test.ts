/**
 * เอกสารพิมพ์ ช่องลายเซ็น — เคส E4 / E5 ของ UAT
 * E4 อนุมัติ 2 ขั้น: ขั้น 1 ลงช่องหัวหน้าหน่วยงาน · ขั้น 2 ลงช่องผู้มีอำนาจอนุมัติ · ผู้จัดการเว้นว่าง
 * E5 อนุมัติขั้นเดียว: ลงช่องผู้มีอำนาจอนุมัติ · หัวหน้าหน่วยงานว่าง
 */
import { describe, expect, it } from 'bun:test';
import { toCashAdvanceData } from './cashAdvanceForm';
import type { AdvanceDetail } from '@/app/finance/types';

function detail(over: Partial<AdvanceDetail> = {}): AdvanceDetail {
  return {
    form_id: 'ADV-2610-001',
    status: 'CLOSED',
    created_at: '2026-10-19T02:00:00+00:00',
    overdue: false,
    requester: { employee_id: '580285', name: 'จุฑารัตน์ จำนงค์สังข์', position: 'ผู้ช่วยหัวหน้าแผนกบัญชี', department: 'ฝ่ายบัญชี', site_code: 'BKK' },
    request: { purpose: '[UAT] ค่าเดินทาง', amount: 12000, use_date: '2026-10-19', cost_center: 'ศลบ', bank: 'KBANK', account_no: '0528532578', account_name: 'จุฑารัตน์ จำนงค์สังข์' },
    fin: null,
    approval_logs: [],
    fin_logs: [],
    ...over,
  } as unknown as AdvanceDetail;
}

const TWO_STEPS = { clause: '6.5', steps: [{ step: 1 }, { step: 2 }] };

describe('E4 · อนุมัติครบ 2 ขั้น', () => {
  const d = toCashAdvanceData(detail({
    approval: {
      ...TWO_STEPS,
      step_approvals: [
        { step: 1, employee_id: '600181', name: 'ศิวพร ม่วงสวย', action_at: '2026-10-19T03:00:00+00:00' },
        { step: 2, employee_id: '690604', name: 'เจษฎา รองศักดิ์', action_at: '2026-10-19T04:00:00+00:00' },
      ],
    },
  } as never));

  it('ขั้น 1 ลงช่องหัวหน้าหน่วยงาน', () => {
    expect(d.signatures.unit_head.name).toBe('ศิวพร ม่วงสวย');
    expect(d.signatures.unit_head.date).not.toBe('');
  });

  it('ขั้น 2 ลงช่องผู้มีอำนาจอนุมัติ', () => {
    expect(d.signatures.approver.name).toBe('เจษฎา รองศักดิ์');
  });

  it('ช่องผู้จัดการเว้นว่าง', () => {
    expect(d.signatures.manager.name).toBe('');
    expect(d.signatures.manager.date).toBe('');
  });

  it('ผู้ขอเบิกมีลายเซ็นอิเล็กทรอนิกส์', () => {
    expect(d.signatures.requester.name).toBe('จุฑารัตน์ จำนงค์สังข์');
    expect(d.signatures.requester.esign?.timestamp).toBeTruthy();
  });
});

describe('E5 · อนุมัติขั้นเดียว', () => {
  const d = toCashAdvanceData(detail({
    approval: { clause: '6.7', steps: [{ step: 1 }] },
    approval_logs: [{ level_no: 1, action: 'APPROVED', action_at: '2026-10-19T03:00:00+00:00', actor_name: 'ศิวพร ม่วงสวย', remark: null }],
  } as never));

  it('ลายเซ็นลงช่องผู้มีอำนาจอนุมัติ', () => {
    expect(d.signatures.approver.name).toBe('ศิวพร ม่วงสวย');
  });

  it('หัวหน้าหน่วยงานและผู้จัดการเว้นว่าง', () => {
    expect(d.signatures.unit_head.name).toBe('');
    expect(d.signatures.manager.name).toBe('');
  });
});

describe('ข้ามขั้น 2 อัตโนมัติ · คนเดียวกดขั้นเดียวจบ', () => {
  const d = toCashAdvanceData(detail({
    approval: {
      ...TWO_STEPS,
      step_approvals: [
        { step: 1, employee_id: '690604', name: 'เจษฎา รองศักดิ์', action_at: '2026-10-19T03:00:00+00:00' },
      ],
    },
  } as never));

  it('ลายเซ็นเดียวต้องอยู่ช่องผู้มีอำนาจ ไม่ใช่ช่องหัวหน้า', () => {
    expect(d.signatures.approver.name).toBe('เจษฎา รองศักดิ์');
    expect(d.signatures.unit_head.name).toBe('');
  });
});

describe('ยังไม่อนุมัติ', () => {
  const d = toCashAdvanceData(detail({
    status: 'PENDING_APPROVAL',
    approval: { ...TWO_STEPS, step_approvals: [] },
  } as never));

  it('ทุกช่องอนุมัติว่าง ผู้ขอเบิกเซ็นแล้ว', () => {
    expect(d.signatures.unit_head.name).toBe('');
    expect(d.signatures.approver.name).toBe('');
    expect(d.signatures.requester.name).toBeTruthy();
  });
});
