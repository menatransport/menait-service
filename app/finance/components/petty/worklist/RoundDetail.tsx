'use client';

import { useCallback, useEffect, useState } from 'react';
import { FileStack } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MascotLoader } from '@/components/loading';
import { useSessionContext } from '@/app/context/SessionContext';
import type { PettyClaim, PettyExpenseType, PettyFund, PettyRound } from '@/app/finance/types-petty';
import { canUploadRoundSlip, worklistPerms } from '@/lib/finance/petty-access';
import { roundHistory } from '@/lib/finance/petty-worklist';
import { formatBaht, formatDate } from '@/lib/finance/status';
import { getExpenseTypes, getFunds, getRound } from '../../../petty-api';
import { Field, NoAccess, Panel } from '../../FinanceShell';
import { printRoundCover } from '../round-actions';
import { HistoryPanel } from './HistoryPanel';
import { RoundClearPanel } from './RoundClearPanel';
import { RoundDocNumbersButton } from './RoundDocNumbersButton';
import { RoundFiles } from './RoundFiles';
import { RoundPayForm } from './RoundPayForm';
import { RoundVoucherForm } from './RoundVoucherForm';
import { ClaimBadge, RoundBadge } from './StatusBadges';

const TH = 'px-3 py-2 text-left text-xs font-semibold text-gray-700 whitespace-nowrap';
const TD = 'px-3 py-2 text-sm whitespace-nowrap align-top';

const at = (iso: string | null | undefined) => (iso ? formatDate(iso) : '-');

/** ใบในรอบ — คลิกแถวเปิดใบนั้น */
function RoundClaims({ claims, typeName, onOpen }: {
  claims: PettyClaim[]; typeName: (code: string) => string; onOpen: (claim: PettyClaim) => void;
}) {
  if (claims.length === 0) return <p className="py-6 text-center text-sm text-gray-400">รอบนี้ไม่มีใบแล้ว (หัวหน้าไม่อนุมัติ ใบกลับไปให้เจ้าของเงินสดจัดรอบใหม่)</p>;
  return (
    <div className="-mx-4 overflow-x-auto sm:-mx-6">
      <table className="w-full">
        <thead className="bg-gray-100">
          <tr>
            <th className={TH}>เลขที่ใบเบิก · ประเภท</th>
            <th className={TH}>จ่ายให้</th>
            <th className={`${TH} text-right`}>ยอดเงิน</th>
            <th className={TH}>เลขที่ DD</th>
            <th className={TH}>สถานะ</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {claims.map(c => (
            <tr key={c.id} onClick={() => onOpen(c)} className="cursor-pointer transition-colors hover:bg-gray-50">
              <td className={TD}>
                <p className="font-medium text-brand-800">{c.form_id}</p>
                <p className="text-xs text-gray-500">{typeName(c.expense_type)}</p>
              </td>
              <td className="px-3 py-2 align-top text-sm"><div className="max-w-40 truncate" title={c.payee_name ?? undefined}>{c.payee_name ?? '-'}</div></td>
              <td className={`${TD} text-right tabular-nums`}>{formatBaht(c.amount)}</td>
              <td className={TD}>{c.dd_no ?? '-'}</td>
              <td className={TD}><ClaimBadge status={c.status} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * รอบส่งเคลียร์หนึ่งรอบ ใช้ทั้งในแผงด้านข้างและหน้าเต็ม — เรียงแบบ FinanceAdvanceDetail:
 * ข้อมูลรอบ · ใบในรอบ · ไฟล์แนบทุกขั้นตอน · กล่องทำงานตามบทบาท (ตั้งเบิก / จ่ายเงิน / อนุมัติเคลียร์) · ประวัติ
 */
export function RoundDetail({ roundId, onChanged, onOpenClaim, onLoaded }: {
  roundId: number;
  onChanged?: () => void;
  onOpenClaim: (claim: PettyClaim) => void;
  onLoaded?: (round: PettyRound) => void;
}) {
  const { user } = useSessionContext();
  const [round, setRound] = useState<PettyRound | null>(null);
  const [types, setTypes] = useState<PettyExpenseType[]>([]);
  const [funds, setFunds] = useState<PettyFund[]>([]);
  const [error, setError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  const load = useCallback(async () => {
    try {
      const [r, t, f] = await Promise.all([getRound(roundId), getExpenseTypes(), getFunds(true)]);
      setRound(r); setTypes(t); setFunds(f); setError('');
      onLoaded?.(r);
    } catch (err) {
      setError((err as Error).message);
    }
  }, [roundId, onLoaded]);

  useEffect(() => { setRound(null); void load(); }, [load]);

  const onSaved = () => { setRefreshKey(k => k + 1); void load(); onChanged?.(); };

  if (error) return <NoAccess text={error} />;
  if (!round) return <Panel title="รอบส่งเคลียร์"><div className="py-8"><MascotLoader text="กำลังโหลดรายละเอียด" size={80} /></div></Panel>;

  const perms = worklistPerms(user);
  const claims = round.claims ?? [];
  const typeName = (code: string) => types.find(t => t.code === code)?.name_th ?? code;
  const notPassed = claims.filter(c => c.status !== 'REVIEWED' && c.status !== 'CLOSED').length;

  return (
    <>
      <div className="flex justify-end">
        <Button type="button" variant="outline" size="sm" onClick={() => printRoundCover(round, types, funds)}>
          <FileStack className="mr-1 h-4 w-4" /> พิมพ์ใบปะหน้า
        </Button>
      </div>
      {round.status === 'CLEAR_REJECTED' && (
        <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          หัวหน้าไม่อนุมัติ: {round.clear_reject_reason ?? '-'} · ใบกลับไปรอส่งเคลียร์ เจ้าของเงินสดจัดรอบใหม่ได้
        </p>
      )}
      <Panel title={`รอบส่งเคลียร์ ${round.batch_no}`} actions={<RoundBadge status={round.status} />}>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Field label="เจ้าของเงินสด" value={round.holder_name ?? round.holder_employee_id ?? '-'} />
          <Field label="สาขา · แผนก" value={`${round.branch_code ?? '-'} · ${round.division_code ?? '-'}`} />
          <Field label="ยอดเงิน" value={`${formatBaht(round.total_amount)} บาท · ${round.claim_count ?? claims.length} ใบ`} />
          <Field label="วันที่ส่งเคลียร์" value={at(round.submitted_at)} />
          <Field label={round.status === 'CLEAR_REJECTED' ? 'หัวหน้าที่ไม่อนุมัติ' : 'หัวหน้าที่อนุมัติเคลียร์'}
            value={round.clear_approved_by_name ?? round.clear_approved_by ?? (round.clear_required_level ? `รอหัวหน้าระดับ ${round.clear_required_level} ขึ้นไป` : '-')} />
          <Field label="วันที่อนุมัติเคลียร์" value={at(round.clear_approved_at)} />
          <Field label="เลขที่ตั้งเบิก" value={round.voucher_no || '-'} />
          <Field label="วันที่ตั้งเบิก" value={at(round.voucher_date ?? null)} />
          <Field label="เลขที่ทำจ่าย" value={round.pay_doc_no || '-'} />
          <Field label="วันที่โอนเงิน" value={at(round.pay_date)} />
          <Field label="ปิดรอบเมื่อ" value={at(round.closed_at)} />
          {round.remark && <Field label="หมายเหตุจากเจ้าของเงินสด" value={round.remark} />}
        </div>
      </Panel>
      <Panel title={`ใบในรอบ (${claims.length})`}>
        {round.status === 'AWAITING_REVIEW' && notPassed > 0 && (
          <p className="mb-3 text-xs text-ink-500">ยังเหลือ {notPassed} ใบที่บัญชียังไม่ผ่าน ผ่านครบทุกใบแล้วรอบจะไปรอตั้งเบิก</p>
        )}
        <RoundClaims claims={claims} typeName={typeName} onOpen={onOpenClaim} />
      </Panel>
      <RoundFiles round={round} types={types} funds={funds} canUpload={canUploadRoundSlip(user, round)} refreshKey={refreshKey} />
      <div className="flex flex-wrap gap-2 empty:hidden">
        <RoundDocNumbersButton key={`doc-${refreshKey}`} round={round} onSaved={onSaved} />
      </div>
      {round.status === 'REVIEWED' && perms.voucher && <RoundVoucherForm key={`v-${refreshKey}`} round={round} onSaved={onSaved} />}
      {round.status === 'VOUCHERED' && perms.pay && <RoundPayForm key={`pay-${refreshKey}`} round={round} onSaved={onSaved} />}
      {round.status === 'CLEAR_PENDING' && round.can_clear && <RoundClearPanel key={`ca-${refreshKey}`} round={round} onSaved={onSaved} />}
      {round.status === 'CLEAR_PENDING' && !round.can_clear && (
        <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          รอหัวหน้าอนุมัติเคลียร์ ยังไม่ถึงคิวบัญชีตรวจ
        </p>
      )}
      <HistoryPanel entries={roundHistory(round.logs)} />
    </>
  );
}
