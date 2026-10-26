'use client';

import { useEffect, useRef, useState } from 'react';
import { ClipboardCheck, Clock, Info } from 'lucide-react';
import { Mascot } from '@/components/mascot';
import { MascotLoader } from '@/components/loading';
import { formatBaht, formatDate, settleLabel } from '@/lib/finance/status';
import { splitByTab, stepBadge, type QueueTab } from '@/lib/finance/approvalSteps';
import type { ClearPendingItem } from '../types';
import { AdvanceSheet } from './AdvanceSheet';

const CARD = 'rounded-2xl border border-gray-100 bg-white p-4 shadow-sm transition-shadow hover:shadow-md sm:p-5';
const BTN_OPEN = 'inline-flex items-center gap-1.5 rounded-xl bg-linear-to-r from-brand-600 to-brand-500 px-5 py-2 text-sm font-semibold text-white shadow-md transition-all hover:from-brand-700 hover:to-brand-600 hover:shadow-lg';

function Money({ label, value, strong = false }: { label: string; value: number | null | undefined; strong?: boolean }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`tabular-nums ${strong ? 'font-display text-xl font-semibold text-brand-800' : 'text-sm text-gray-800'}`}>
        {formatBaht(value)} <span className="text-xs font-normal text-gray-500">บาท</span>
      </p>
    </div>
  );
}

/**
 * แท็บรออนุมัติเคลียร์ในหน้าอนุมัติ — หัวหน้าเห็นใบที่ผู้เบิกส่งเคลียร์แล้วรอตัวเอง กดเปิดแผงข้างดูรายการ ใบเสร็จ
 * แล้วอนุมัติหรือตีกลับในแผงนั้น (ClearApprovalPanel) ลิงก์ในอีเมล ?tab=clear&doc= เปิดใบให้เลย (ผู้ใช้สั่ง 20/10/2026)
 * แยก รอฉันอนุมัติ / อนุมัติแทนได้ แบบเดียวกับแท็บขอเบิก (ผู้ใช้สั่ง 26/10/2026)
 */
export function ClearApprovalQueue({ items, doc, onChanged, onNotice }: {
  items: ClearPendingItem[] | null;
  doc: string | null;
  onChanged: () => void;
  onNotice: (text: string) => void;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [subTab, setSubTab] = useState<QueueTab>('mine');
  const handledDoc = useRef<string | null>(null);

  useEffect(() => {
    if (!doc || items === null || handledDoc.current === doc) return;
    handledDoc.current = doc;
    const hit = items.find(i => i.form_id === doc);
    if (hit) {
      setSubTab(hit.tab === 'delegable' ? 'delegable' : 'mine');
      setOpenId(doc);
    } else onNotice(`รายการ ${doc} ไม่อยู่ในคิวอนุมัติเคลียร์ของคุณแล้ว อาจมีคนอนุมัติหรือตีกลับไปก่อน`);
  }, [doc, items, onNotice]);

  if (items === null) return <div className="py-8"><MascotLoader text="กำลังโหลดรายการ" size={80} /></div>;

  const { mine, delegable } = splitByTab(items);
  const shown = subTab === 'mine' ? mine : delegable;
  const pill = (active: boolean) =>
    `rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${active ? 'bg-brand-600 text-white shadow-sm' : 'text-gray-600 hover:text-brand-600'}`;

  return (
    <>
      <div className="mb-4 inline-flex items-center gap-0.5 rounded-full bg-gray-100 p-0.5">
        <button type="button" onClick={() => setSubTab('mine')} className={pill(subTab === 'mine')}>
          {`รอฉันอนุมัติ (${mine.length})`}
        </button>
        <button type="button" onClick={() => setSubTab('delegable')} className={pill(subTab === 'delegable')}>
          {`อนุมัติแทนได้ (${delegable.length})`}
        </button>
      </div>
      {shown.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-8 text-center">
          <Mascot size={80} />
          <p className="text-sm text-ink-500">{subTab === 'mine' ? 'ไม่มีใบเคลียร์ที่รอคุณอนุมัติ' : 'ไม่มีใบเคลียร์ที่อนุมัติแทนได้'}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {shown.map(item => {
            const settle = item.settle_amount;
            const badge = stepBadge(item.step, item.total_steps);
            return (
              <div key={item.form_id} id={`clr-${item.form_id}`} className={`${CARD} ${doc === item.form_id ? 'ring-2 ring-mint-500' : ''}`}>
                <div className="mb-3 flex flex-wrap items-start justify-between gap-2 border-b border-gray-100 pb-3">
                  <div>
                    <p className="text-sm font-semibold text-brand-800">{item.form_id}</p>
                    <p className="text-xs text-gray-500">
                      {item.requester_name?.trim() || item.requester_employee_id}{item.requester_department ? ` · ${item.requester_department}` : ''}
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700">
                    <Clock className="h-3 w-3" /> รออนุมัติเคลียร์{badge ? ` · ${badge}` : ''}
                  </span>
                </div>
                {item.tab === 'delegable' && (
                  <p className="mb-2 flex items-center gap-1.5 text-xs text-gray-500"><Info className="h-3.5 w-3.5 text-brand-600" /> อนุมัติแทนได้ — มีผู้มีสิทธิ์{item.step_required_level ? `ระดับ ${item.step_required_level}+ ` : ''}ที่ใกล้กว่า</p>
                )}
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <Money label="ยอดใช้จริง" value={item.amount_actual} strong />
                  <Money label="จ่ายไปแล้ว" value={item.amount_paid} />
                  {settle !== null && settle !== undefined && settle !== 0
                    ? <Money label={settleLabel(settle) === 'รับคืน' ? 'คืนบริษัท' : 'บริษัทจ่ายเพิ่ม'} value={Math.abs(settle)} />
                    : <div><p className="text-xs text-gray-500">ส่วนต่าง</p><p className="text-sm text-gray-800">พอดี</p></div>}
                  <div className="min-w-0">
                    <p className="text-xs text-gray-500">ส่งเคลียร์เมื่อ</p>
                    <p className="text-sm text-gray-800">{formatDate(item.clear_submitted_at)}</p>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs text-gray-500">{item.clause ? `TOA ข้อ ${item.clause}` : ''}</p>
                  <button type="button" onClick={() => setOpenId(item.form_id)} className={BTN_OPEN}>
                    <ClipboardCheck className="h-4 w-4" /> ดูรายการและอนุมัติ
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      <AdvanceSheet mode="mine" formId={openId} isOpen={openId !== null} hideFullPage
        onClose={() => setOpenId(null)} onChanged={onChanged} />
    </>
  );
}
