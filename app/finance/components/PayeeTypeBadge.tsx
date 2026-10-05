import { Landmark, User } from 'lucide-react';
import type { RequestInfo } from '../types';

/** "บัญชีตัวเอง" / "บัญชี Supplier" badge from request.payee_type (renders nothing when unknown). */
export function PayeeTypeBadge({ payeeType, withHint = false }: { payeeType: RequestInfo['payee_type']; withHint?: boolean }) {
  if (payeeType !== 'SELF' && payeeType !== 'SUPPLIER') return null;
  const supplier = payeeType === 'SUPPLIER';
  const Icon = supplier ? Landmark : User;
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ${supplier ? 'bg-violet-50 text-violet-700 border-violet-200' : 'bg-emerald-50 text-mint-700 border-emerald-200'}`}>
        <Icon className="size-3" />
        {supplier ? 'บัญชี Supplier' : 'บัญชีตัวเอง'}
      </span>
      {withHint && supplier && <span className="text-xs text-violet-700">ตรวจ bookbank/ใบแจ้งหนี้ในไฟล์แนบ</span>}
    </span>
  );
}
