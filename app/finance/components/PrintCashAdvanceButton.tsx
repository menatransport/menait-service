'use client';

import { Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PRINTABLE_STATUSES, printCashAdvance, toCashAdvanceData } from '@/lib/finance/cashAdvanceForm';
import { showAlert } from '../api';
import type { AdvanceDetail } from '../types';

export function PrintCashAdvanceButton({ detail }: { detail: AdvanceDetail }) {
  if (!PRINTABLE_STATUSES.includes(detail.status)) return null;
  const onClick = () => {
    try {
      if (!printCashAdvance(toCashAdvanceData(detail))) showAlert({ icon: 'error', title: 'เบราว์เซอร์บล็อกหน้าต่างพิมพ์' });
    } catch (err) {
      showAlert({ icon: 'error', title: 'พิมพ์ไม่ได้', text: err instanceof Error ? err.message : String(err) });
    }
  };
  return (
    <div className="flex justify-end">
      <Button type="button" variant="outline" size="sm" onClick={onClick}>
        <Printer className="mr-1 h-4 w-4" />พิมพ์ใบคำขอเบิก
      </Button>
    </div>
  );
}
