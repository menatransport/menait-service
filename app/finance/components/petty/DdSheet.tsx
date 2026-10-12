'use client';

import { useCallback, useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { getDd, type DdDoc } from '@/app/finance/petty-api';

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
    return <p className="text-sm text-ink-400">ยังไม่กรอกเลขที่ใบรับสินค้า (DD)</p>;
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm">เลขที่ <strong>{ddNo}</strong></p>
        <button type="button" onClick={() => void load()} disabled={loading}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-xs disabled:opacity-40">
          <RefreshCw className="h-3 w-3" /> {loading ? 'กำลังดึง…' : 'ดึงใหม่'}
        </button>
      </div>

      {doc?.error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {doc.error}
        </div>
      )}

      {doc && !doc.found && !doc.error && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          ยังไม่พบใน ATMS อาจรอ sync (ข้อมูลเข้าทุก 4 ชั่วโมง) — ส่งบัญชีได้ตามปกติ
        </div>
      )}

      {doc?.found && (
        <>
          {doc.total_match === false && (
            <div className="mb-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              ยอดใน DD ({baht(doc.total)}) ต่างจากยอดใบเบิก ({baht(claimAmount)}) อยู่{' '}
              <strong>{baht(doc.total_difference ?? 0)}</strong> บาท — ตรวจก่อนส่งบัญชี
            </div>
          )}
          <div className="mb-2 grid gap-2 text-sm sm:grid-cols-3 lg:grid-cols-6">
            <Cell label="วันที่รับ" value={doc.received_date ?? '-'} />
            <Cell label="คลัง" value={doc.warehouse ?? '-'} />
            <Cell label="ผู้ขาย/ผู้รับจ้าง" value={doc.supplier ?? '-'} />
            <Cell label="เลขที่ใบสั่งซื้อ (PO)" value={doc.po ?? '-'} />
            <Cell label="เลขที่ใบขอซื้อ (PR)" value={doc.pr ?? '-'} />
            <Cell label="VAT" value={doc.vat === null ? '-' : `${doc.vat}%`} />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-ink-500">
                <tr>
                  <th className="py-1.5">รหัสสินค้า</th><th className="py-1.5">ชื่อสินค้า</th>
                  <th className="py-1.5">กลุ่มสินค้า</th><th className="py-1.5 text-right">จำนวน</th>
                  <th className="py-1.5">หน่วย</th><th className="py-1.5 text-right">ราคา/หน่วย</th>
                  <th className="py-1.5 text-right">จำนวนเงิน</th><th className="py-1.5">รถ</th>
                </tr>
              </thead>
              <tbody>
                {doc.lines.map((line, i) => (
                  <tr key={i} className="border-t border-slate-100">
                    <td className="py-1.5">{line.sku ?? '-'}</td>
                    <td className="py-1.5">{line.name ?? '-'}</td>
                    <td className="py-1.5">{line.product_group ?? '-'}</td>
                    <td className="py-1.5 text-right tabular-nums">{line.qty}</td>
                    <td className="py-1.5">{line.unit ?? '-'}</td>
                    <td className="py-1.5 text-right tabular-nums">{baht(line.rate)}</td>
                    <td className="py-1.5 text-right tabular-nums">{baht(line.amount)}</td>
                    <td className="py-1.5">
                      {line.truck_code ?? '-'}
                      {line.truck_plate && <span className="text-ink-400"> ({line.truck_plate})</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-200 font-medium">
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
    <div>
      <p className="text-xs text-ink-500">{label}</p>
      <p>{value}</p>
    </div>
  );
}
