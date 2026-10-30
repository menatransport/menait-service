'use client';

import { useCallback, useEffect, useState } from 'react';
import { FileStack, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { PettyExpenseType, PettyFund, PettyRound } from '@/app/finance/types-petty';
import { pettyFileProblem } from '@/lib/finance/petty-upload';
import { displayFileName } from '@/lib/finance/status';
import { showAlert } from '../../../api';
import { listRoundFiles, uploadRoundSlips, type RoundFile } from '../../../petty-api';
import { FilePicker } from '../../FilePicker';
import { Panel } from '../../FinanceShell';
import { printRoundCover } from '../round-actions';
import { pettyReview } from '../petty-confirm';

/** สลิปโอนของรอบ — หน้าตาเดียวกับ AttachmentPanel ของ Advance (หัวข้อ · รายการไฟล์ · แนบเพิ่ม) */
function RoundSlips({ round, canUpload, refreshKey }: { round: PettyRound; canUpload: boolean; refreshKey: number }) {
  const [files, setFiles] = useState<RoundFile[]>([]);
  const [pending, setPending] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const load = useCallback(async () => {
    try {
      setFiles((await listRoundFiles(round)).filter(f => f.folder === 'pay'));
      setLoadError(false);
    } catch {
      setFiles([]);
      setLoadError(true);
    }
  }, [round]);

  useEffect(() => { void load(); }, [load, refreshKey]);

  const upload = async () => {
    const bad = pending.map(f => ({ f, why: pettyFileProblem(f.name, f.size) })).filter(x => x.why);
    if (bad.length) {
      showAlert({ icon: 'warning', title: 'แนบไฟล์นี้ไม่ได้', text: bad.map(x => `${x.f.name}: ${x.why}`).join('\n') });
      return;
    }
    if (!(await pettyReview({
      title: 'ยืนยันแนบไฟล์?',
      rows: [['แนบใน', `หลักฐานการจ่ายเงิน · ${round.batch_no}`], ['ไฟล์', pending.map(f => f.name).join('\n')]],
      confirmButtonText: `แนบ ${pending.length} ไฟล์`,
    }))) return;
    setUploading(true);
    try {
      const failed = await uploadRoundSlips(round, pending);
      const count = pending.length;
      setPending([]);
      if (failed.length) showAlert({ icon: 'error', title: 'อัปโหลดไม่สำเร็จ', text: failed.join(', ') });
      else showAlert({ icon: 'success', title: `แนบไฟล์แล้ว ${count} ไฟล์`, timer: 1400, showConfirmButton: false });
    } finally {
      setUploading(false);
    }
    void load();
  };

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-gray-600">หลักฐานการจ่ายเงิน (สลิปโอน)</p>
      {loadError && <p className="text-xs text-rose-600">โหลดรายการไฟล์ไม่สำเร็จ</p>}
      {files.length === 0 ? (
        <p className="text-xs text-gray-400">ยังไม่มีไฟล์</p>
      ) : (
        <ul className="space-y-1">
          {files.map(f => (
            <li key={f.key}>
              <a href={f.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-sm text-brand-600 hover:underline">
                <FileText className="h-4 w-4" /> {displayFileName(f.fileName ?? f.key.split("/").pop() ?? "")}
              </a>
            </li>
          ))}
        </ul>
      )}
      {canUpload && (
        <div className="space-y-2">
          <FilePicker files={pending} onChange={setPending} disabled={uploading} />
          {pending.length > 0 && (
            <Button type="button" size="sm" disabled={uploading} onClick={upload}
              className="rounded-lg bg-linear-to-r from-brand-600 to-brand-500 text-white shadow-sm hover:from-brand-700 hover:to-brand-600">
              {uploading ? 'กำลังอัปโหลด...' : `อัปโหลด ${pending.length} ไฟล์`}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

/** ไฟล์แนบของรอบทุกขั้นตอน: ใบปะหน้า (พิมพ์จากระบบ) + สลิปโอนที่การเงินแนบตอนจ่ายเงิน */
export function RoundFiles({ round, types, funds, canUpload, refreshKey }: {
  round: PettyRound; types: PettyExpenseType[]; funds: PettyFund[]; canUpload: boolean; refreshKey: number;
}) {
  return (
    <Panel title="ไฟล์แนบทุกขั้นตอน">
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <p className="text-xs font-semibold text-gray-600">ใบปะหน้า</p>
          <p className="text-xs text-gray-400">พิมพ์จากใบในรอบนี้ แยกตามเจ้าของเงินสด</p>
          <Button type="button" variant="outline" size="sm" onClick={() => printRoundCover(round, types, funds)}>
            <FileStack className="mr-1 h-4 w-4" /> พิมพ์ใบปะหน้า
          </Button>
        </div>
        <RoundSlips round={round} canUpload={canUpload} refreshKey={refreshKey} />
      </div>
    </Panel>
  );
}
