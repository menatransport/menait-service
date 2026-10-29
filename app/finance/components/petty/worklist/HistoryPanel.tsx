import type { HistoryEntry } from '@/lib/finance/petty-worklist';
import { formatBkkDateTime } from '@/lib/finance/printShared';
import { formatDate } from '@/lib/finance/status';
import { Panel } from '../../FinanceShell';

const APPROVE_ACTIONS = new Set(['APPROVE', 'CLEAR_APPROVE', 'ACC_PASS']);

/** วันที่และเวลา แบบประวัติของ Advance */
function when(at: string | null): string {
  if (!at) return '-';
  const t = formatBkkDateTime(at);
  return t.date ? `${formatDate(at)} ${t.time.slice(0, 5)} น.` : formatDate(at);
}

/** ประวัติ — หน้าตาเดียวกับ LogList ของ Advance (เส้นซ้ายเขียว = อนุมัติ/ผ่าน · น้ำเงิน = ขั้นอื่น) */
export function HistoryPanel({ entries }: { entries: HistoryEntry[] }) {
  if (entries.length === 0) return null;
  return (
    <Panel title="ประวัติ">
      <ol className="space-y-3 text-sm">
        {entries.map(e => (
          <li key={e.key} className={`border-l-2 pl-3 ${APPROVE_ACTIONS.has(e.action) ? 'border-mint-400' : 'border-brand-600'}`}>
            <p className="font-medium">{e.label} · {e.actor ?? '-'}</p>
            <p className="text-xs text-gray-500">{when(e.at)}{e.remark ? ` · ${e.remark}` : ''}</p>
          </li>
        ))}
      </ol>
    </Panel>
  );
}
