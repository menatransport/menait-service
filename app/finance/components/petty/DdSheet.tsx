'use client';

import { useCallback, useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { getDd, type DdDoc } from '@/app/finance/petty-api';
import { Button, LINE, Notice } from './ui';

const baht = (n: number) => n.toLocaleString('th-TH', { minimumFractionDigits: 2 });

/** ใบรับสินค้า (DD) FC101-06 — กรอกเลขแล้วระบบดึงรายละเอียดจาก ATMS มาจัดฟอร์มให้ */
export function DdSheet({ ddNo, expenseType, claimAmount }: {
  ddNo: string | null;
  expenseType: string;
  claimAmount: number;
}) {
  const [doc, setDoc] = useState<DdDoc | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!ddNo) { setDoc(null); return; }
    setLoading(true);
    try {
      setDoc(await getDd(ddNo, { expense_type: expenseType, claim_amount: claimAmount }));
    } catch (err) {
      setDoc({
        found: false, dd_no: ddNo, received_date: null, warehouse: null, supplier: null,
        pr: null, po: null, lines: [], total: 0, unit: null, vat: null,
        error: (err as Error).message,
      });
    } finally { setLoading(false); }
  }, [ddNo, expenseType, claimAmount]);

  useEffect(() => { void load(); }, [load]);

  if (!ddNo) {
    return <p className="text-sm text-ink-500">ยังไม่กรอกเลข DD</p>;
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-sm text-ink-700">เลขที่ <span className="font-semibold text-ink-900">{ddNo}</span></p>
        <Button size="sm" onClick={() => void load()} disabled={loading}>
          <RefreshCw className="h-3 w-3 text-ink-500" /> {loading ? 'กำลังดึง…' : 'ดึงใหม่'}
        </Button>
      </div>

      {doc?.error && (
        <Notice tone="error">{doc.error}</Notice>
      )}

      {doc && !doc.found && !doc.error && (
        <Notice>ยังไม่พบใน ATMS (sync ทุก 4 ชม.) — ส่งบัญชีได้ตามปกติ</Notice>
      )}

      {doc?.found && (
        <>
          {doc.total_match === false && (
            <div className="mb-3">
              <Notice>
                ยอด DD ({baht(doc.total)}) ต่างจากใบเบิก ({baht(claimAmount)}) อยู่{' '}
                <strong className="text-ink-900">{baht(doc.total_difference ?? 0)}</strong> บาท — ตรวจก่อนส่งบัญชี
              </Notice>
            </div>
          )}
          <dl className="mb-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3 lg:grid-cols-6">
            <Cell label="วันที่รับ" value={doc.received_date ?? '-'} />
            <Cell label="คลัง" value={doc.warehouse ?? '-'} />
            <Cell label="ผู้ขาย/ผู้รับจ้าง" value={doc.supplier ?? '-'} />
            <Cell label="เลขที่ใบสั่งซื้อ (PO)" value={doc.po ?? '-'} />
            <Cell label="เลขที่ใบขอซื้อ (PR)" value={doc.pr ?? '-'} />
            <Cell label="VAT" value={doc.vat === null ? '-' : `${doc.vat}%`} />
          </dl>
          <div className={`overflow-x-auto rounded-xl border ${LINE}`}>
            <table className="w-full text-sm">
              <thead className={`border-b ${LINE} text-left text-xs text-ink-500 [&_th]:px-3 [&_th]:font-medium`}>
                <tr>
                  <th className="py-1.5">รหัสสินค้า</th><th className="py-1.5">ชื่อสินค้า</th>
                  <th className="py-1.5">กลุ่มสินค้า</th><th className="py-1.5 text-right">จำนวน</th>
                  <th className="py-1.5">หน่วย</th><th className="py-1.5 text-right">ราคา/หน่วย</th>
                  <th className="py-1.5 text-right">จำนวนเงิน</th><th className="py-1.5">รถ</th>
                </tr>
              </thead>
              <tbody>
                {doc.lines.map((line, i) => (
                  <tr key={i} className="border-t border-[#f3f6fa] text-ink-900 [&_td]:px-3">
                    <td className="py-1.5">{line.sku ?? '-'}</td>
                    <td className="py-1.5">{line.name ?? '-'}</td>
                    <td className="py-1.5">{line.product_group ?? '-'}</td>
                    <td className="py-1.5 text-right tabular-nums">{line.qty}</td>
                    <td className="py-1.5">{line.unit ?? '-'}</td>
                    <td className="py-1.5 text-right tabular-nums">{baht(line.rate)}</td>
                    <td className="py-1.5 text-right tabular-nums">{baht(line.amount)}</td>
                    <td className="py-1.5">
                      {line.truck_code ?? '-'}
                      {line.truck_plate && <span className="text-ink-500"> ({line.truck_plate})</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className={`border-t ${LINE} font-semibold text-ink-900 [&_td]:px-3`}>
                  <td colSpan={6} className="py-1.5 text-right">รวม</td>
                  <td className="py-1.5 text-right tabular-nums">{baht(doc.total)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-ink-500">{label}</dt>
      <dd className="break-words text-ink-900">{value}</dd>
    </div>
  );
}
