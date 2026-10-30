import {
  Banknote, CircleCheck, CircleX, CornerUpLeft, FileCheck2, FilePen, Hourglass, SearchCheck, ShieldCheck, ThumbsUp, Undo2, UserCheck,
  type LucideIcon,
} from 'lucide-react';
import { PETTY_STATUS_STYLES, type PettyRoundStatus, type PettyStatus } from '@/lib/finance/petty-status';
import { CLAIM_STATUS_LABELS, ROUND_STATUS_LABELS, ROUND_STATUS_STYLES } from '@/lib/finance/petty-worklist';

// ไอคอนชุดเดียวกับ StatusBadge ของ Advance ในขั้นที่ตรงกัน
const ROUND_ICONS: Record<PettyRoundStatus, LucideIcon> = {
  CLEAR_PENDING: ShieldCheck,
  CLEAR_REJECTED: CircleX,
  AWAITING_REVIEW: SearchCheck,
  REVIEWED: FilePen,
  VOUCHERED: Banknote,
  CLOSED: CircleCheck,
};

const CLAIM_ICONS: Record<PettyStatus, LucideIcon> = {
  PENDING_HEAD: UserCheck,
  PENDING_APPROVAL: Hourglass,
  RETURNED: CornerUpLeft,
  APPROVED: ThumbsUp,
  CLEAR_PENDING: UserCheck,
  AWAITING_REVIEW: SearchCheck,
  SENT_BACK: Undo2,
  REVIEWED: FileCheck2,
  CLOSED: CircleCheck,
  TRANSFERRED: Banknote,
};

const PILL = 'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap';

/** ป้ายสถานะรอบ — คำของ Advance (รอตั้งเบิกทำจ่าย · รอจ่าย · ปิดแล้ว) */
export function RoundBadge({ status }: { status: PettyRoundStatus }) {
  const Icon = ROUND_ICONS[status];
  return (
    <span className={`${PILL} ${ROUND_STATUS_STYLES[status] ?? ''}`}>
      {Icon && <Icon className="size-3" />}
      {ROUND_STATUS_LABELS[status] ?? status}
    </span>
  );
}

/** ป้ายสถานะใบในหน้างาน — ส่งกลับแก้ไขใช้คำของ Advance */
export function ClaimBadge({ status }: { status: PettyStatus }) {
  const Icon = CLAIM_ICONS[status];
  return (
    <span className={`${PILL} ${PETTY_STATUS_STYLES[status] ?? ''}`}>
      {Icon && <Icon className="size-3" />}
      {CLAIM_STATUS_LABELS[status] ?? status}
    </span>
  );
}
