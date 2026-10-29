'use client';

import type { PettyExpenseType, PettyFund, PettyRound } from '@/app/finance/types-petty';
import { ApiError } from '@/lib/finance/api-error';
import { coverSheetHtml, roundGroup } from '@/lib/finance/petty-cover';
import { bangkokDate } from '@/lib/finance/petty-doc';
import { openPrintWindow } from '@/lib/finance/printShared';
import { formatBaht } from '@/lib/finance/status';
import { showAlert, showConfirm } from '../../api';
import { postRoundAction, type RoundAction } from '../../petty-api';

type Prompt = { isConfirmed?: boolean; value?: string };

/**
 * ปุ่มของรอบส่งเคลียร์ — ถามสิ่งที่ต้องกรอก (เหตุผล เลขตั้งเบิก วันที่จ่าย) แล้วให้ BE ตัดสิน
 * คืน true เมื่อสถานะรอบเปลี่ยน (ผู้เรียกค่อยโหลดใหม่)
 */
export async function runRoundAction(round: PettyRound, action: RoundAction): Promise<boolean> {
  const count = round.claim_count ?? round.claims?.length ?? 0;
  const what = `${count} ใบ รวม ${formatBaht(round.total_amount)} บาท`;
  const body: Record<string, unknown> = {};

  if (action === 'clear-approve') {
    const res = await showConfirm({ title: `อนุมัติเคลียร์รอบ ${round.batch_no}`,
      text: `${what} · ส่งต่อให้บัญชีตรวจ`, confirmButtonText: 'อนุมัติเคลียร์' }) as Prompt;
    if (!res?.isConfirmed) return false;
  }
  if (action === 'clear-reject') {
    const res = await showConfirm({ title: `ไม่อนุมัติรอบ ${round.batch_no}`, input: 'textarea',
      inputLabel: 'เหตุผล (เจ้าของเงินสดจะเห็นข้อความนี้ แล้วจัดรอบใหม่)',
      inputValidator: (v: string) => (!v || !v.trim()) ? 'ต้องระบุเหตุผล' : null, confirmButtonText: 'ไม่อนุมัติ' }) as Prompt;
    if (!res?.isConfirmed) return false;
    body.reason = res.value;
  }
  if (action === 'voucher') {
    const res = await showConfirm({ title: `ตั้งเบิกรอบ ${round.batch_no}`, text: what, input: 'text',
      inputLabel: 'เลขที่ใบตั้งเบิก', inputValidator: (v: string) => (!v || !v.trim()) ? 'ต้องกรอกเลขที่ใบตั้งเบิก' : null,
      confirmButtonText: 'ตั้งเบิก' }) as Prompt;
    if (!res?.isConfirmed) return false;
    body.voucher_no = (res.value ?? '').trim();
  }
  if (action === 'pay') {
    const res = await showConfirm({ title: `ทำจ่ายรอบ ${round.batch_no}`,
      text: `${what} · จ่ายคืนให้ ${round.holder_name ?? 'เจ้าของเงินสด'} แล้วปิดรอบ`, input: 'date',
      inputLabel: 'วันที่จ่าย', inputValue: bangkokDate(new Date().toISOString()),
      inputValidator: (v: string) => (!v ? 'ต้องระบุวันที่จ่าย' : null), confirmButtonText: 'ทำจ่ายและปิดรอบ' }) as Prompt;
    if (!res?.isConfirmed) return false;
    body.pay_date = res.value;
  }

  try {
    await postRoundAction(round.id, action, body);
    return true;
  } catch (err) {
    const api = err instanceof ApiError ? err : null;
    showAlert({ icon: 'error', title: api?.message ?? 'ทำรายการไม่สำเร็จ', text: api ? '' : (err as Error).message });
    return false;
  }
}

/** ใบปะหน้าของรอบ — แยกตามเจ้าของเงินสด (flow v2) · ต้องมีใบในรอบ (ขอรายละเอียดรอบมาก่อน) */
export function printRoundCover(round: PettyRound, types: PettyExpenseType[], funds: PettyFund[]): void {
  const claims = round.claims ?? [];
  if (claims.length === 0) {
    showAlert({ icon: 'info', title: 'รอบนี้ไม่มีใบให้พิมพ์', text: 'รอบที่หัวหน้าไม่อนุมัติ ใบจะหลุดออกจากรอบแล้ว' });
    return;
  }
  const fund = funds.find(f => f.id === round.fund_id);
  const html = coverSheetHtml({
    group: roundGroup({ holder_employee_id: round.holder_employee_id, claims }), types,
    clerkName: round.holder_name ?? round.holder_employee_id ?? '-',
    branchCode: round.branch_code ?? fund?.branch_code ?? '-', divisionCode: round.division_code ?? fund?.division_code ?? '-',
    batchNo: round.batch_no, mode: 'round', clearApproverName: round.clear_approved_by_name,
    logoUrl: `${window.location.origin}/mena.png`,
  });
  if (!openPrintWindow(html)) {
    showAlert({ icon: 'warning', title: 'เบราว์เซอร์บล็อกหน้าต่างพิมพ์', text: 'อนุญาต pop-up ของเว็บนี้แล้วลองอีกครั้ง' });
  }
}
