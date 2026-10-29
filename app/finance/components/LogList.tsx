import { bankLabel, formatAccountNo } from '@/lib/finance/bank';
import { formatBaht, formatDate } from '@/lib/finance/status';
import { formatBkkDateTime } from '@/lib/finance/printShared';
import { FIELD_LABELS, logRemarkLabel } from '../labels';
import type { ApprovalLog, FinLog } from '../types';
import { fullHistory, type ClearLog } from '@/lib/finance/historyLog';
import { Panel } from './FinanceShell';

const show = (v: unknown) => (v === null || v === undefined || v === '' ? '-' : String(v));

const DATE_FIELDS = new Set(['voucher_date', 'transfer_date', 'clear_due_date', 'clear_date', 'settle_date', 'use_date']);
const MONEY_FIELDS = new Set(['amount', 'amount_paid', 'amount_actual', 'settle_amount', 'items_total']);

/** วันที่และเวลา ให้เห็นลำดับขั้นที่เกิดในวันเดียวกัน */
function when(at: string | null): string {
  if (!at) return '-';
  const t = formatBkkDateTime(at);
  return t.date ? `${formatDate(at)} ${t.time.slice(0, 5)} น.` : formatDate(at);
}

const PAYEE_TYPE_LABELS: Record<string, string> = { SELF: 'บัญชีตัวเอง', SUPPLIER: 'บัญชี Supplier' };

/** "account_no_forced" → base field + note that the system took the value from the payee Master. */
function fieldLabel(field: string): string {
  const forced = field.endsWith('_forced');
  const base = forced ? field.slice(0, -'_forced'.length) : field;
  const label = FIELD_LABELS[base] ?? base;
  return forced ? `${label} (ระบบดึงจาก Master)` : label;
}

function showValue(field: string, v: unknown): string {
  if (v === null || v === undefined || v === '') return '-';
  const base = field.replace(/_forced$/, '');
  if (base === 'payee_type') return PAYEE_TYPE_LABELS[String(v)] ?? String(v);
  if (base === 'bank') return bankLabel(String(v)) || String(v);
  if (base === 'account_no') return formatAccountNo(String(v));
  // BE ส่งวันที่เป็น YYYY-MM-DD และยอดเงินเป็นตัวเลขดิบ แปลงให้อ่านแบบเดียวกับหน้าจอ
  if (DATE_FIELDS.has(base)) return formatDate(String(v));
  if (MONEY_FIELDS.has(base) && Number.isFinite(Number(v))) return formatBaht(Number(v));
  return show(v);
}

export function LogList({ approvalLogs, finLogs, clearLogs }: { approvalLogs: ApprovalLog[]; finLogs: FinLog[]; clearLogs?: ClearLog[] }) {
  const rows = fullHistory(approvalLogs, finLogs, clearLogs);
  if (rows.length === 0) return null;
  return (
    <Panel title="ประวัติ">
      <ol className="space-y-3 text-sm">
        {rows.map(log => (
          <li key={log.key} className={`border-l-2 pl-3 ${log.key.startsWith('a-') || log.action === 'CLEAR_APPROVE' ? 'border-mint-400' : 'border-brand-600'}`}>
            <p className="font-medium">{log.label} · {log.actor ?? '-'}</p>
            <p className="text-xs text-gray-500">{when(log.at)}{logRemarkLabel(log.action, log.remark) ? ` · ${logRemarkLabel(log.action, log.remark)}` : ''}</p>
            {log.changes && Object.keys(log.changes).length > 0 && (
              <ul className="mt-1 text-xs text-gray-600">
                {Object.entries(log.changes).map(([field, v]) => {
                  const label = fieldLabel(field);
                  if (!Array.isArray(v)) return <li key={field}>{label}: {showValue(field, v)}</li>;
                  return <li key={field}>{label}: {showValue(field, v[0])} → {showValue(field, v[1])}</li>;
                })}
              </ul>
            )}
          </li>
        ))}
      </ol>
    </Panel>
  );
}
