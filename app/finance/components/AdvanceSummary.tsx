import { sumItems, type ClearItemRow } from '@/lib/finance/clearItems';
import { formatBaht, formatDate, settleLabel } from '@/lib/finance/status';
import { formatBkkDateTime } from '@/lib/finance/printShared';
import { bankLabel, formatAccountNo } from '@/lib/finance/bank';
import type { AdvanceDetail, AdvanceItem, ApprovalTierInfo, ClearItem } from '../types';
import { CLAIM_TITLE } from '@/lib/finance/clearingForm';
import { sentBackLabel } from '@/lib/finance/historyLog';
import { PrintDocumentButton } from './PrintDocumentButton';
import { Field, Panel } from './FinanceShell';
import { StatusBadge } from './StatusBadge';
import { PayeeTypeBadge } from './PayeeTypeBadge';

const toClearRow = (i: ClearItem): ClearItemRow => ({
  expense_date: i.expense_date, vehicle: i.vehicle ?? '', has_receipt: i.has_receipt, description: i.description,
  amount_before_vat: i.amount_before_vat, vat_amount: i.vat_amount, wht_amount: i.wht_amount,
});

export function AdvanceSummary({ item, detail }: { item: AdvanceItem & { approval?: ApprovalTierInfo | null }; detail?: AdvanceDetail }) {
  const fin = item.fin;
  // ใบที่ไม่อนุมัติ: บอกให้เห็นตั้งแต่ด้านบนว่าใครไม่อนุมัติและเพราะอะไร ไม่ต้องไล่หาในประวัติ
  const rejection = item.status === 'REJECTED'
    ? [...(detail?.approval_logs ?? [])].reverse().find(l => l.action === 'REJECTED') ?? null
    : null;
  return (
    <>
      {rejection && (
        <p className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          ไม่อนุมัติโดย {rejection.actor_name ?? '-'}{rejection.action_at ? ` เมื่อ ${formatDate(rejection.action_at)}` : ''}
          {rejection.remark ? ` · เหตุผล: ${rejection.remark}` : ''}
        </p>
      )}
      <Panel title={`คำขอเบิกเงิน ${item.form_id}`} actions={<StatusBadge status={item.status} overdue={item.overdue} />}>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Field label="ผู้เบิกเงิน" value={item.requester.name ?? item.requester.employee_id} />
          <Field label="แผนก" value={item.requester.department} />
          <Field label="ศูนย์" value={item.requester.site_code ?? item.requester.site} />
          <Field label="จำนวนเงินที่ขอ" value={formatBaht(item.request.amount)} />
          <Field label="วันที่ใช้เงิน" value={formatDate(item.request.use_date)} />
          <Field label="วันที่ขอ" value={formatDate(item.created_at)} />
          <Field label="ค่าใช้จ่ายรายศูนย์" value={item.request.cost_center ?? '-'} />
          {item.request.payee_type && (
            <div className="col-span-2 sm:col-span-3"><Field label="ประเภทบัญชีรับเงิน" value={<PayeeTypeBadge payeeType={item.request.payee_type} withHint />} /></div>
          )}
          <Field label="ธนาคาร" value={item.request.bank ? bankLabel(item.request.bank) : '-'} />
          <Field label="เลขที่บัญชี" value={item.request.account_no ? formatAccountNo(item.request.account_no) : '-'} />
          <Field label="ชื่อบัญชี" value={item.request.account_name ?? '-'} />
          {item.approval && (
            <div className="col-span-2 sm:col-span-3">
              <Field label="ขั้นอนุมัติ" value={`ข้อ ${item.approval.clause} · ${item.approval.approver_label} — ผู้อนุมัติระดับ ${item.approval.required_level} ขึ้นไป`} />
              {(item.approval.steps?.length ?? 0) >= 2 && (
                <ol className="mt-2 space-y-1.5">
                  {item.approval.steps!.map(st => {
                    const done = item.approval!.step_approvals?.find(a => a.step === st.step && a.action_at);
                    const waiting = item.status === 'PENDING_APPROVAL' && item.approval!.current_step === st.step; // only the current step waits
                    const rejectedHere = !done && rejection && item.approval!.current_step === st.step;
                    const when = done?.action_at ? formatBkkDateTime(done.action_at) : null;
                    return (
                      <li key={st.step} className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2 text-sm text-gray-800">
                        <span className="font-medium">ขั้น {st.step}</span> · {st.label}
                        {' — '}
                        {done
                          ? <span className="text-emerald-700">{done.name ?? '-'}{when ? ` · ${when.date} ${when.time.slice(0, 5)} น.` : ''}</span>
                          : rejectedHere ? <span className="text-rose-700">ไม่อนุมัติ · {rejection!.actor_name ?? '-'}</span>
                          : waiting ? <span className="text-amber-700">รอ</span> : <span className="text-gray-400">-</span>}
                      </li>
                    );
                  })}
                </ol>
              )}
            </div>
          )}
          <div className="col-span-2 sm:col-span-3"><Field label="เบิกเงิน Advance สำหรับ" value={item.request.purpose} copyText={item.request.purpose} /></div>
        </div>
      </Panel>

      {/* ใบที่ตีกลับหรือรออนุมัติรอบใหม่ มีแถว fin แต่ยังไม่มีเลขตั้งเบิก/การจ่าย ไม่ต้องโชว์แผงที่มีแต่ขีด */}
      {fin && (fin.voucher_no || fin.voucher_date || fin.amount_paid !== null && fin.amount_paid !== undefined) && (
        <Panel title="ข้อมูลตั้งเบิก / การจ่ายเงิน">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Field label="เลขที่ตั้งเบิก" value={fin.voucher_no} />
            <Field label="วันที่ตั้งเบิก" value={formatDate(fin.voucher_date)} />
            <Field label="เลขที่ทำจ่าย" value={fin.payment_doc_no} />
            <Field label="ยอดเงิน" value={formatBaht(fin.amount_paid)} />
            <Field label="วันที่โอนเงิน" value={formatDate(fin.transfer_date)} />
            <Field label="กำหนดการเคลียร์" value={formatDate(fin.clear_due_date)} />
            {fin.acc_code && <Field label="บัญชี" value={`${fin.acc_code} ${fin.acc_name ?? ''}`} />}
            <div className="col-span-2"><Field label="วัตถุประสงค์" value={fin.purpose} copyText={fin.purpose} /></div>
          </div>
        </Panel>
      )}

      {fin?.clear_date && (
        <Panel title="ข้อมูลการเคลียร์เงิน" actions={detail ? <PrintDocumentButton detail={detail} initial="part2" compact label={`พิมพ์${CLAIM_TITLE}`} /> : undefined}>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Field label="วันที่ส่งเอกสารเคลียร์" value={formatDate(fin.clear_date)} />
            <Field label="ยอดใช้จริง" value={formatBaht(fin.amount_actual)} />
            <Field label="เลขที่เอกสารเคลียร์เงิน" value={fin.clear_doc_no} />
            {fin.original_received_date && <Field label="วันที่รับเอกสารตัวจริง" value={formatDate(fin.original_received_date)} />}
            <Field label={`รับคืน (เบิกเพิ่ม) · ${settleLabel(fin.settle_amount)}`}
              value={fin.settle_amount === null || fin.settle_amount === undefined ? '-' : formatBaht(Math.abs(fin.settle_amount))} />
            {/* เบิกเพิ่ม: วันที่นี้คือวันที่การเงินโอนส่วนต่างให้ผู้เบิก ไม่ใช่วันที่ผู้เบิกโอนคืน */}
            <Field label={(fin.settle_amount ?? 0) < 0 ? 'วันที่การเงินโอนเงินเพิ่ม' : 'วันที่โอนเงินคืนบริษัท'} value={formatDate(fin.settle_date)} />
            <Field label="หมายเหตุ" value={fin.remark} />
          </div>
          {fin.clear_items && fin.clear_items.length > 0 && (
            <>
            {/* มือถือ: การ์ดทีละรายการ ไม่ต้องปัดตารางไปด้านข้างเพื่อดูยอด */}
            <ul className="mt-4 space-y-2 sm:hidden">
              {fin.clear_items.map(i => (
                <li key={i.line_no} className="rounded-xl border px-3 py-2 text-sm">
                  <div className="flex items-start justify-between gap-3">
                    <p className="min-w-0 text-gray-800">{i.description}</p>
                    <p className="shrink-0 font-semibold tabular-nums">{formatBaht(i.net_amount)}</p>
                  </div>
                  <p className="mt-0.5 text-xs text-gray-500">
                    {formatDate(i.expense_date)}{i.vehicle ? ` · ${i.vehicle}` : ''} · ใบกำกับ {i.has_receipt ? 'มี' : 'ไม่มี'}
                    {Number(i.wht_amount) ? ` · หัก ณ ที่จ่าย ${formatBaht(i.wht_amount)}` : ''}
                  </p>
                </li>
              ))}
              <li className="flex justify-between rounded-xl bg-gray-50 px-3 py-2 text-sm font-semibold">
                <span>รวมสุทธิ</span>
                <span className="tabular-nums">{formatBaht(sumItems(fin.clear_items.map(toClearRow)).e)}</span>
              </li>
            </ul>
            <div className="mt-4 hidden overflow-x-auto rounded-xl border sm:block">
              <table className="w-full min-w-[720px] text-sm">
                <thead className="bg-gray-50 text-xs text-gray-600">
                  <tr>
                    <th className="px-2 py-2 text-left">วันที่</th>
                    <th className="px-2 py-2 text-left">ทะเบียนรถและประเภท</th>
                    <th className="px-2 py-2 text-center">ใบกำกับ</th>
                    <th className="px-2 py-2 text-left">รายละเอียด</th>
                    <th className="px-2 py-2 text-right">ยอดเงิน</th>
                    <th className="px-2 py-2 text-right">หัก ณ ที่จ่าย</th>
                    <th className="px-2 py-2 text-right">สุทธิ</th>
                  </tr>
                </thead>
                <tbody>
                  {fin.clear_items.map(i => (
                    <tr key={i.line_no} className="border-t">
                      <td className="whitespace-nowrap px-2 py-2">{formatDate(i.expense_date)}</td>
                      <td className="px-2 py-2">{i.vehicle || '-'}</td>
                      <td className="px-2 py-2 text-center">{i.has_receipt ? 'Y' : 'N'}</td>
                      <td className="px-2 py-2">{i.description}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{formatBaht(i.total_amount)}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{formatBaht(i.wht_amount)}</td>
                      <td className="px-2 py-2 text-right font-semibold tabular-nums">{formatBaht(i.net_amount)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t bg-gray-50 font-semibold">
                  <tr>
                    <td colSpan={4} className="px-2 py-2 text-right">รวม</td>
                    {(['c', 'd', 'e'] as const).map(k => (
                      <td key={k} className="px-2 py-2 text-right tabular-nums">{formatBaht(sumItems(fin.clear_items!.map(toClearRow))[k])}</td>
                    ))}
                  </tr>
                </tfoot>
              </table>
            </div>
            </>
          )}
        </Panel>
      )}

      {item.status === 'SENT_BACK' && fin?.review_remark && (
        <div className="rounded-2xl border border-orange-200 bg-orange-50 p-4 text-sm text-sun-700">
          <span className="font-semibold">{sentBackLabel(detail?.fin_logs ?? [])}:</span> {fin.review_remark}
        </div>
      )}
    </>
  );
}
