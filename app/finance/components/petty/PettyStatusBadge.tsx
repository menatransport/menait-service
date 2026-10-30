import { PETTY_STATUS_LABELS, type PettyStatus } from '@/lib/finance/petty-status';
import { Tag } from './ui';

/** สถานะที่ผู้ใช้ต้องลงมือ — ตัวเข้มขึ้น แต่ยังเป็นกรอบเทา (ไม่ใช้สีแยกสถานะ) */
const NEEDS_ACTION: PettyStatus[] = ['RETURNED', 'SENT_BACK'];

export function PettyStatusBadge({ status, note }: { status: PettyStatus; note?: string | null }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <Tag strong={NEEDS_ACTION.includes(status)}>{PETTY_STATUS_LABELS[status]}</Tag>
      {note && <Tag className="text-ink-500">{note}</Tag>}
    </span>
  );
}
