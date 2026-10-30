import { Check } from 'lucide-react';
import { FLOW_STEPS, flowPosition } from '@/lib/finance/petty-list';
import { PETTY_STATUS_LABELS, type PettyStatus } from '@/lib/finance/petty-status';

/** แถบขั้นตอนของใบ: ผ่านแล้ว = ติ๊กเทา · ขั้นปัจจุบัน = วงน้ำเงิน · หลุดราง (ตีกลับ/ส่งกลับ) = วงขอบเข้มพร้อมชื่อสถานะ */
export function FlowSteps({ status }: { status: PettyStatus }) {
  const { index, offTrack } = flowPosition(status);
  return (
    <ol className="flex items-center gap-1.5 overflow-x-auto py-1 text-xs" aria-label="ขั้นตอนของใบ">
      {FLOW_STEPS.map((step, i) => {
        const done = i < index || (status === 'CLOSED' && i === index);
        const current = i === index && status !== 'CLOSED';
        const dot = done ? 'border border-ink-300 text-ink-500'
          : current ? (offTrack ? 'border-2 border-ink-900 text-ink-900' : 'bg-brand-600 text-white')
            : 'border border-[#dbe4f3] text-ink-300';
        return (
          <li key={step.status} className="flex shrink-0 items-center gap-1.5" aria-current={current ? 'step' : undefined}>
            <span className={`inline-flex size-5 items-center justify-center rounded-full text-[10.5px] font-semibold tabular-nums ${dot}`}>
              {done ? <Check className="size-3" /> : i + 1}
            </span>
            <span className={current ? 'font-semibold text-ink-900' : done ? 'text-ink-500' : 'text-ink-300'}>
              {current && offTrack ? PETTY_STATUS_LABELS[status] : step.label}
            </span>
            {i < FLOW_STEPS.length - 1 && <span className={`mx-0.5 h-px w-4 ${i < index ? 'bg-ink-300' : 'bg-[#dbe4f3]'}`} aria-hidden />}
          </li>
        );
      })}
    </ol>
  );
}
