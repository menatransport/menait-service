'use client';

import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { fetchJson } from '../api';

const baht = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 2 });

interface Tier { clause: string; amount_max: number | null; min_level: number; approver_label: string; sort_order: number }

/** TOA (Table of Authority) clause 6.1–6.7: who may approve a cash advance of a given amount. */
export function ToaDialog({ open, onOpenChange, clause, requiredLevel }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** the clause that applies to the amount being requested — highlighted */
  clause?: string;
  /** level actually required for this requester (tier level, raised to above the requester) */
  requiredLevel?: number;
}) {
  const [tiers, setTiers] = useState<Tier[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open || tiers) return;
    fetchJson<Tier[]>('/api/finance/approval-tiers')
      .then(t => setTiers([...t].sort((a, b) => a.sort_order - b.sort_order)))
      .catch(err => setError(err.message));
  }, [open, tiers]);

  const current = tiers?.find(t => t.clause === clause);
  const prevMax = (i: number) => (i > 0 ? tiers?.[i - 1]?.amount_max ?? null : null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto rounded-2xl sm:max-w-xl">
        <DialogHeader className="text-left">
          <DialogTitle className="text-lg font-semibold text-brand-800">ตาราง TOA — อำนาจอนุมัติเบิกเงินล่วงหน้า</DialogTitle>
          <DialogDescription className="text-xs text-gray-500">ข้อ 6.1–6.7 · ระบบเลือกผู้อนุมัติตามวงเงินที่ขอ</DialogDescription>
        </DialogHeader>

        {error && <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        {!tiers && !error && <p className="py-6 text-center text-sm text-gray-500">กำลังโหลด...</p>}

        <p className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2 text-xs text-gray-600">
          อนุมัติ 2 ขั้น: ขั้น 1 หัวหน้าถัดไป (ระดับสูงกว่าผู้เบิก 1 ระดับ) แล้วขั้น 2 ผู้มีอำนาจตามตารางนี้ ถ้าหัวหน้าขั้น 1 มีระดับถึงขั้น 2 อยู่แล้ว จะอนุมัติจบในขั้นเดียว
        </p>

        {tiers && (
          <div className="overflow-x-auto rounded-xl border">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-600">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold">ข้อ</th>
                  <th className="px-3 py-2 text-right font-semibold">วงเงิน (บาท)</th>
                  <th className="px-3 py-2 text-left font-semibold">ผู้อนุมัติขั้นต่ำ</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {tiers.map((t, i) => {
                  const hit = t.clause === clause;
                  const from = prevMax(i);
                  const range = t.amount_max === null
                    ? `มากกว่า ${baht(from ?? 0)}`
                    : from === null ? `ไม่เกิน ${baht(t.amount_max)}` : `${baht(from)} – ${baht(t.amount_max)}`;
                  return (
                    <tr key={t.clause} className={hit ? 'bg-mint-300/25 font-semibold text-brand-800' : ''}>
                      <td className="whitespace-nowrap px-3 py-2">{t.clause}{hit && <span className="ml-1.5 rounded-md bg-brand-600 px-1.5 py-0.5 text-[10px] font-semibold text-white">ยอดนี้</span>}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{range}</td>
                      <td className="px-3 py-2">{t.approver_label}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <ul className="list-disc space-y-1 pl-5 text-xs text-gray-600">
          <li>ผู้อนุมัติต้องมีระดับ<strong>ไม่ต่ำกว่าขั้นในตาราง</strong> และ<strong>สูงกว่าผู้ขอเบิก</strong></li>
          <li>ระดับ 9 ขึ้นไป (นโยบายระดับ 9/10/11) อนุมัติได้ทุกแผนก</li>
          {current && requiredLevel !== undefined && requiredLevel > current.min_level && (
            <li className="font-medium text-brand-800">
              ยอดนี้ (ข้อ {current.clause}) ขั้นต่ำระดับ {current.min_level} — แต่ต้องสูงกว่าผู้ขอ จึงต้องอนุมัติโดยระดับ {requiredLevel} ขึ้นไป
            </li>
          )}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
