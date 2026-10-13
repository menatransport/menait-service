import { Check } from 'lucide-react';
import { FLOW_STEPS, flowPosition } from '@/lib/finance/petty-list';
import { PETTY_STATUS_LABELS, type PettyStatus } from '@/lib/finance/petty-status';

/** แถบขั้นตอนของใบ: ผ่านแล้ว = เขียวติ๊ก · ขั้นปัจจุบัน = น้ำเงิน · หลุดราง (ตีกลับ/ส่งกลับ) = ส้มที่ขั้นที่ต้องทำซ้ำ */
export function FlowSteps({ status }: { status: PettyStatus }) {
  const { index, offTrack } = flowPosition(status);
  return (
    <ol className="flex items-center gap-1 overflow-x-auto py-1 text-xs">
      {FLOW_STEPS.map((step, i) => {
        const done = i < index || (status === 'CLOSED' && i === index);
        const current = i === index && status !== 'CLOSED';
        const tone = done ? 'bg-emerald-500 text-white' : current ? (offTrack ? 'bg-orange-500 text-white' : 'bg-brand-600 text-white') : 'bg-slate-100 text-ink-400';
        return (
          <li key={step.status} className="flex items-center gap-1 shrink-0">
            <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-medium ${tone}`}>
              {done ? <Check className="size-3" /> : <span className="tabular-nums">{i + 1}</span>}
              {current && offTrack ? PETTY_STATUS_LABELS[status] : step.label}
            </span>
            {i < FLOW_STEPS.length - 1 && <span className={`h-px w-4 ${i < index ? 'bg-emerald-400' : 'bg-slate-200'}`} />}
          </li>
        );
      })}
    </ol>
  );
}
