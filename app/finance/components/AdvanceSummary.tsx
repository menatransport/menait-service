import { formatBaht, formatDate, settleLabel } from '@/lib/finance/status';
import type { AdvanceItem } from '../types';
import { Field, Panel } from './FinanceShell';
import { StatusBadge } from './StatusBadge';

export function AdvanceSummary({ item }: { item: AdvanceItem }) {
  const fin = item.fin;
  return (
    <>
      <Panel title={`คำขอเบิกเงิน ${item.form_id}`} actions={<StatusBadge status={item.status} overdue={item.overdue} />}>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Field label="ผู้เบิกเงิน" value={item.requester.name ?? item.requester.employee_id} />
          <Field label="แผนก" value={item.requester.department} />
          <Field label="ศูนย์" value={item.requester.site_code ?? item.requester.site} />
          <Field label="จำนวนเงินที่ขอ" value={formatBaht(item.request.amount)} />
          <Field label="วันที่ใช้เงิน" value={formatDate(item.request.use_date)} />
          <Field label="วันที่ขอ" value={formatDate(item.created_at)} />
          <div className="col-span-2 sm:col-span-3"><Field label="เบิกเงิน Advance สำหรับ" value={item.request.purpose} /></div>
        </div>
      </Panel>

      {fin && (
        <Panel title="ข้อมูลการจ่ายเงิน (การเงิน)">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Field label="เลขที่ใบเบิก" value={fin.voucher_no} />
            <Field label="วันที่ตั้งเบิก" value={formatDate(fin.voucher_date)} />
            <Field label="เลขที่เอกสารจ่าย" value={fin.payment_doc_no} />
            <Field label="ยอดเงิน" value={formatBaht(fin.amount_paid)} />
            <Field label="วันที่โอนเงิน" value={formatDate(fin.transfer_date)} />
            <Field label="กำหนดการเคลียร์" value={formatDate(fin.clear_due_date)} />
            <Field label="บัญชี" value={fin.acc_code ? `${fin.acc_code} ${fin.acc_name ?? ''}` : '-'} />
            <div className="col-span-2"><Field label="วัตถุประสงค์" value={fin.purpose} /></div>
          </div>
        </Panel>
      )}

      {fin?.clear_date && (
        <Panel title="ข้อมูลการเคลียร์เงิน">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Field label="วันที่เคลียร์" value={formatDate(fin.clear_date)} />
            <Field label="ยอดใช้จริง" value={formatBaht(fin.amount_actual)} />
            <Field label="เอกสารเคลียร์" value={fin.clear_doc_no} />
            <Field label={`รับคืน (เบิกเพิ่ม) · ${settleLabel(fin.settle_amount)}`} value={formatBaht(fin.settle_amount)} />
            <Field label="วันที่โอนเงินคืน" value={formatDate(fin.settle_date)} />
            <Field label="หมายเหตุ" value={fin.remark} />
          </div>
        </Panel>
      )}

      {item.status === 'SENT_BACK' && fin?.review_remark && (
        <div className="rounded-2xl border border-orange-200 bg-orange-50 p-4 text-sm text-orange-800">
          <span className="font-semibold">การเงินส่งกลับแก้ไข:</span> {fin.review_remark}
        </div>
      )}
    </>
  );
}
