import { formatDate } from '@/lib/finance/status';
import { FIELD_LABELS, LOG_ACTION_LABELS } from '../labels';
import type { ApprovalLog, FinLog } from '../types';
import { Panel } from './FinanceShell';

const show = (v: unknown) => (v === null || v === undefined || v === '' ? '-' : String(v));

export function LogList({ approvalLogs, finLogs }: { approvalLogs: ApprovalLog[]; finLogs: FinLog[] }) {
  if (approvalLogs.length === 0 && finLogs.length === 0) return null;
  return (
    <Panel title="ประวัติ">
      <ol className="space-y-3 text-sm">
        {approvalLogs.map((log, i) => (
          <li key={`a-${i}`} className="border-l-2 border-[#8ce4cb] pl-3">
            <p className="font-medium">{LOG_ACTION_LABELS[log.action] ?? log.action} · {log.actor_name ?? '-'}</p>
            <p className="text-xs text-gray-500">{formatDate(log.action_at)}{log.remark ? ` · ${log.remark}` : ''}</p>
          </li>
        ))}
        {finLogs.map((log, i) => (
          <li key={`f-${i}`} className="border-l-2 border-[#026a75] pl-3">
            <p className="font-medium">{LOG_ACTION_LABELS[log.action] ?? log.action} · {log.action_by ?? '-'}</p>
            <p className="text-xs text-gray-500">{formatDate(log.created_at)}{log.remark ? ` · ${log.remark}` : ''}</p>
            {log.changes && Object.keys(log.changes).length > 0 && (
              <ul className="mt-1 text-xs text-gray-600">
                {Object.entries(log.changes).map(([field, [before, after]]) => (
                  <li key={field}>{FIELD_LABELS[field] ?? field}: {show(before)} → {show(after)}</li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ol>
    </Panel>
  );
}
