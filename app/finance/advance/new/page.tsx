'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { AlertCircle, BadgeCheck, Building2, ChevronRight, ScrollText, HandCoins, IdCard, Landmark, MapPin, Paperclip, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Loading, { MascotLoader } from '@/components/loading';
import { Mascot } from '@/components/mascot';
import { buildSubmitValues, prefillFormValues, renderFormField } from '@/components/renderForm';
import type { Question } from '@/app/service/[[...slug]]/page';
import { useSessionContext } from '@/app/context/SessionContext';
import { accountNoError, normalizeAccountNo } from '@/lib/finance/bank';
import { isBeforeToday } from '@/lib/finance/dates';
import { parseAmount, todayBkk } from '@/lib/finance/status';
import { stepChainText } from '@/lib/finance/approvalSteps';
import type { AdvanceDetail, ApprovalTierInfo, AttachmentFile } from '../../types';
import { fetchJson, putAction, showAlert, uploadFiles } from '../../api';
import { AttachmentPanel } from '../../components/AttachmentPanel';
import { FilePicker } from '../../components/FilePicker';
import { PayeeAccountSection, type PayeeSectionStatus } from '../../components/PayeeAccountSection';
import { canSubmitPayee, PAYEE_SELF, PAYEE_SUPPLIER } from '@/lib/finance/payee';
import { FinanceShell } from '../../components/FinanceShell';
import { ToaDialog } from '../../components/ToaDialog';

interface AdvForm { form_code: string; form_name: string; form_status: string; questions: Question[] }

const payeeNames = ['adv_payee_type', 'adv_bank', 'adv_account_no', 'adv_account_name'];

const isBlank = (v: unknown) => v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0);

// The "adv_use_date" question by name, falling back to the first datetime/date question.
const findUseDateQuestion = (questions: Question[]): Question | undefined =>
  questions.find(q => q.name === 'adv_use_date') ??
  questions.find(q => q.type === 'datetime' || q.type === 'date');

function NewAdvance() {
  const router = useRouter();
  const editId = useSearchParams().get('edit');
  const isEdit = Boolean(editId);
  // edit mode: 'loading' until the submission is read; 'blocked' (with a message) unless RETURNED + owner
  const [editState, setEditState] = useState<{ phase: 'loading' | 'ready' | 'blocked'; message?: string }>({ phase: isEdit ? 'loading' : 'ready' });
  const [existingCount, setExistingCount] = useState(0);
  const [listWarning, setListWarning] = useState(false);
  const { user } = useSessionContext();
  const [form, setForm] = useState<AdvForm | null>(null);
  const [values, setValues] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [payeeStatus, setPayeeStatus] = useState<PayeeSectionStatus>({ loaded: false, state: 'none' });

  const useDateQuestion = useMemo(
    () => (form ? findUseDateQuestion(form.questions) : undefined),
    [form]
  );

  const [hint, setHint] = useState<{ text: string; error: boolean; clause?: string; requiredLevel?: number } | null>(null);
  const [toaOpen, setToaOpen] = useState(false);
  const amountQuestion = useMemo(
    () => form?.questions.find(q => q.name === 'adv_amount') ?? form?.questions.find(q => q.type === 'number'),
    [form]
  );
  const amountValue = amountQuestion ? values[amountQuestion.name] : undefined;
  useEffect(() => {
    const amount = parseAmount(amountValue);
    setHint(null);
    if (amount === null || amount <= 0) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      fetchJson<ApprovalTierInfo>(
        `/api/finance/approval-preview?amount=${encodeURIComponent(String(amount))}`)
        .then(r => { if (!cancelled) setHint({ text: stepChainText(r.steps) ?? `ต้องอนุมัติโดยระดับ ${r.required_level} ขึ้นไป (ข้อ ${r.clause} · ${r.approver_label})`, error: false, clause: r.clause, requiredLevel: r.required_level }); })
        .catch(err => { if (!cancelled) setHint({ text: err.message, error: true }); });
    }, 400);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [amountValue]);

  useEffect(() => {
    fetchJson<AdvForm>('/api/formsubmit?path=ADV')
      .then(setForm)
      .catch(err => showAlert({ icon: 'error', title: 'โหลดแบบฟอร์มไม่สำเร็จ', text: err.message }))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!editId || !form || !user?.employee_id) return;
    let cancelled = false;
    (async () => {
      try {
        const id = encodeURIComponent(editId);
        const [detail, sub, uploads] = await Promise.all([
          fetchJson<AdvanceDetail>(`/api/finance/advances/${id}`),
          fetchJson<any[]>(`/api/formselect?path=${id}`),
          fetchJson<{ files?: AttachmentFile[] }>(`/api/uploads3?form_id=${id}`).catch(() => { if (!cancelled) setListWarning(true); return { files: [] }; }),
        ]);
        if (cancelled) return;
        if (detail.status !== 'RETURNED') {
          return setEditState({ phase: 'blocked', message: 'แก้ไขได้เฉพาะคำขอที่บัญชีตีกลับให้ผู้เบิกแก้ไข (สถานะปัจจุบันไม่ใช่ "ตีกลับให้ผู้เบิกแก้ไข")' });
        }
        if (detail.requester.employee_id !== user.employee_id) {
          return setEditState({ phase: 'blocked', message: 'เฉพาะผู้เบิกเงินเท่านั้นที่แก้ไขคำขอนี้ได้' });
        }
        const submission = Array.isArray(sub) ? sub[0] : null;
        setValues(prefillFormValues(form.questions, submission?.values ?? []));
        setExistingCount((uploads.files ?? []).filter(f => f.folder === 'request').length);
        setEditState({ phase: 'ready' });
      } catch (err) {
        if (!cancelled) setEditState({ phase: 'blocked', message: (err as Error).message || 'โหลดคำขอไม่สำเร็จ' });
      }
    })();
    return () => { cancelled = true; };
  }, [editId, form, user?.employee_id]);

  const onInputChange = useCallback((name: string, value: any) => {
    setValues(prev => ({ ...prev, [name]: value }));
    setErrors(prev => {
      if (!prev[name]) return prev;
      const { [name]: _removed, ...rest } = prev;
      return rest;
    });
  }, []);

  // Payee section: only when the form has adv_payee_type (after the migration); otherwise generic bank/account inputs.
  const hasPayeeType = !!form?.questions.some(q => q.name === 'adv_payee_type');
  const onPayeeChange = useCallback((patch: Record<string, any>) => {
    setValues(prev => ({ ...prev, ...patch }));
    setErrors(prev => {
      if (!payeeNames.some(n => prev[n])) return prev;
      const rest = { ...prev };
      for (const n of payeeNames) delete rest[n];
      return rest;
    });
  }, []);
  const isSupplier = hasPayeeType && values.adv_payee_type === PAYEE_SUPPLIER;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;
    if (!user?.employee_id) {
      return showAlert({ icon: 'error', title: 'ไม่พบข้อมูลผู้ใช้', text: 'กรุณาเข้าสู่ระบบใหม่' });
    }
    const next: Record<string, string> = {};
    for (const q of form.questions) {
      if (hasPayeeType && payeeNames.includes(q.name)) continue;
      if (q.required && isBlank(values[q.name])) next[q.name] = `กรุณาระบุ${q.label}`;
      if (q.type === 'number' && !isBlank(values[q.name])) {
        const amount = parseAmount(values[q.name]);
        if (amount === null || amount <= 0) next[q.name] = 'จำนวนเงินต้องมากกว่า 0';
      }
      if (useDateQuestion && q.id === useDateQuestion.id && !isBlank(values[q.name]) &&
        isBeforeToday(values[q.name], todayBkk())) {
        next[q.name] = 'วันที่ใช้เงินต้องเป็นวันนี้หรือหลังจากนี้';
      }
    }
    const bankQ = form.questions.find(q => q.name === 'adv_bank');
    const accountQ = form.questions.find(q => q.name === 'adv_account_no');
    if (!hasPayeeType && accountQ && !next[accountQ.name] && !isBlank(values[accountQ.name])) {
      const msg = accountNoError(bankQ ? values[bankQ.name] : null, values[accountQ.name]);
      if (msg) next[accountQ.name] = msg;
    }
    if (hasPayeeType) {
      if (isSupplier) {
        if (isBlank(values.adv_bank)) next.adv_bank = 'กรุณาเลือกธนาคาร';
        if (isBlank(values.adv_account_no)) next.adv_account_no = 'กรุณาระบุเลขที่บัญชี';
        else { const msg = accountNoError(values.adv_bank, values.adv_account_no); if (msg) next.adv_account_no = msg; }
        if (isBlank(values.adv_account_name)) next.adv_account_name = 'กรุณาระบุชื่อบัญชี';
      }
      if (!canSubmitPayee(isSupplier ? PAYEE_SUPPLIER : PAYEE_SELF, payeeStatus.loaded ? payeeStatus.state : 'none', files.length + existingCount)) {
        setErrors(next);
        return showAlert(isSupplier
          ? { icon: 'warning', title: 'กรุณาแนบ bookbank หรือใบแจ้งหนี้ที่มีเลขบัญชี' }
          : { icon: 'warning', title: 'ยังไม่มีบัญชีรับเงินที่บัญชีอนุมัติ — กรุณาขอเพิ่มบัญชีรับเงิน หรือเลือกบัญชี Supplier' });
      }
    }
    if (Object.keys(next).length) { setErrors(next); return; }

    setSubmitting(true);
    try {
      const normalized = { ...values };
      for (const q of form.questions) {
        if (q.type === 'number' && !isBlank(normalized[q.name])) normalized[q.name] = parseAmount(normalized[q.name]);
        if (q.name === 'adv_account_no' && !isBlank(normalized[q.name])) normalized[q.name] = normalizeAccountNo(normalized[q.name]);
      }
      if (editId) {
        await fetchJson<unknown>(`/api/formsubmit?form_id=${encodeURIComponent(editId)}`, {
          method: 'PUT',
          body: JSON.stringify({
            updated_by: user.employee_id,
            values: buildSubmitValues(form.questions, normalized).filter(v =>
              v.value_text !== null || v.value_number !== null || v.value_date !== null || v.value_boolean !== null),
          }),
        });
        const failedEdit = await uploadFiles(editId, files);
        // uploaded files must not be re-sent if resubmit fails and the user retries
        const uploaded = files.filter(f => !failedEdit.includes(f.name));
        setFiles(files.filter(f => failedEdit.includes(f.name)));
        setExistingCount(c => c + uploaded.length);
        try {
          await putAction(editId, 'resubmit', {});
        } catch (err) {
          // a lost response on an earlier try may already have resubmitted it: treat "already pending approval" as success
          const now = await fetchJson<{ status?: string }>(`/api/finance/advances/${encodeURIComponent(editId)}`).catch(() => null);
          if (now?.status !== 'PENDING_APPROVAL') throw err;
        }
        await showAlert({
          icon: failedEdit.length ? 'warning' : 'success',
          title: 'ส่งคำขอใหม่แล้ว รออนุมัติ',
          text: failedEdit.length ? `อัปโหลดไม่สำเร็จ: ${failedEdit.join(', ')} (แนบเพิ่มได้ในหน้ารายการ)` : undefined,
        });
        router.push(`/finance/advance/${encodeURIComponent(editId)}`);
        return;
      }
      const payload = {
        form_code: form.form_code,
        created_by: user.employee_id,
        values: buildSubmitValues(form.questions, normalized).filter(v =>
          v.value_text !== null || v.value_number !== null || v.value_date !== null || v.value_boolean !== null),
      };
      const res = await fetchJson<{ form_id: string }>('/api/formsubmit', { method: 'POST', body: JSON.stringify(payload) });
      const failed = await uploadFiles(res.form_id, files);
      await showAlert({
        icon: failed.length ? 'warning' : 'success',
        title: 'ส่งคำขอเบิกเงินแล้ว',
        text: failed.length ? `อัปโหลดไม่สำเร็จ: ${failed.join(', ')} (แนบเพิ่มได้ในหน้ารายการ)` : `เลขที่เอกสาร ${res.form_id}`,
      });
      router.push(`/finance/advance/${encodeURIComponent(res.form_id)}`);
    } catch (err) {
      showAlert({ icon: 'error', title: isEdit ? 'บันทึกและส่งใหม่ไม่สำเร็จ' : 'ส่งคำขอไม่สำเร็จ', text: (err as Error).message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <FinanceShell title={isEdit ? 'แก้ไขคำขอ Advance' : 'ขอเบิกเงิน Advance'}>
      {submitting && (
        <div className="fixed inset-0 z-9999 flex items-center justify-center v2-loader-overlay">
          <Loading text={isEdit ? 'กำลังบันทึกและส่งใหม่' : 'กำลังส่งคำขอ'} />
        </div>
      )}
      <section className="rounded-2xl sm:rounded-3xl bg-white shadow-xl p-4 sm:p-6 lg:p-8">
        <div className="mb-6 pb-4 border-b border-gray-200 flex items-center gap-3">
          <div className="v2-tile-mint w-10 h-10 rounded-xl flex items-center justify-center shrink-0">
            <HandCoins className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h2 className="font-display text-xl font-semibold text-brand-800">{isEdit ? `แก้ไขและส่งใหม่ ${editId}` : form?.form_name ?? 'ขอเบิกเงิน Advance'}</h2>
            <p className="text-xs text-gray-500">{isEdit ? 'แก้ไขตามที่บัญชีตีกลับ แล้วส่งให้ผู้มีอำนาจอนุมัติอีกครั้ง' : 'เงินทดรองจ่าย — กรอกข้อมูลแล้วส่งให้ผู้มีอำนาจอนุมัติ'}</p>
          </div>
        </div>

        {loading || (isEdit && editState.phase === 'loading') ? (
          <div className="py-10"><MascotLoader text={loading ? 'กำลังโหลดแบบฟอร์ม' : 'กำลังโหลดคำขอ'} /></div>
        ) : isEdit && editState.phase === 'blocked' ? (
          <div className="py-8 flex flex-col items-center text-center gap-3">
            <Mascot size={88} />
            <p className="font-display font-semibold text-ink-900">แก้ไขคำขอนี้ไม่ได้</p>
            <p className="text-sm text-ink-500">{editState.message}</p>
            <Link href={editId ? `/finance/advance/${encodeURIComponent(editId)}` : '/finance/advance'} className="v2-btn text-sm">กลับไปหน้าคำขอ</Link>
          </div>
        ) : !form || form.form_status !== 'Active' ? (
          <div className="py-8 flex flex-col items-center text-center gap-3">
            <Mascot size={88} />
            <p className="font-display font-semibold text-ink-900">ยังเปิดให้ขอเบิกไม่ได้</p>
            <p className="text-sm text-ink-500">ยังไม่มีฟอร์ม ADV หรือฟอร์มปิดใช้งานอยู่</p>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-5">
            <div className="rounded-xl bg-gray-50 p-3 sm:p-4">
              <p className="text-[11px] font-medium uppercase tracking-wide text-gray-400 mb-2">ผู้เบิกเงิน</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                <span className="flex items-center gap-2 text-gray-800 font-medium min-w-0">
                  <User className="w-3.5 h-3.5 text-brand-600 shrink-0" />
                  <span className="truncate">{user ? `${user.firstname} ${user.lastname}` : '-'}</span>
                </span>
                <span className="flex items-center gap-2 text-gray-600 min-w-0">
                  <IdCard className="w-3.5 h-3.5 text-brand-600 shrink-0" />
                  <span className="truncate">{user?.employee_id ?? '-'}</span>
                </span>
                <span className="flex items-center gap-2 text-gray-600 min-w-0">
                  <Building2 className="w-3.5 h-3.5 text-brand-600 shrink-0" />
                  <span className="truncate">{user?.department ?? '-'}</span>
                </span>
                <span className="flex items-center gap-2 text-gray-600 min-w-0">
                  <MapPin className="w-3.5 h-3.5 text-brand-600 shrink-0" />
                  <span className="truncate">{user?.site ?? '-'}</span>
                </span>
              </div>
            </div>
            {form.questions.map((q, index) => hasPayeeType && payeeNames.includes(q.name) ? (
              q.name === 'adv_payee_type' ? (
                <PayeeAccountSection key={q.id} errors={errors} onPayeeChange={onPayeeChange} onStatusChange={setPayeeStatus}
                  fullName={user ? `${user.firstname} ${user.lastname}`.trim() : ''} disabled={submitting}
                  initial={isEdit ? { type: values.adv_payee_type, bank: values.adv_bank, no: values.adv_account_no, name: values.adv_account_name } : undefined} />
              ) : null
            ) :
              <div key={q.id}>
                {q.name === 'adv_bank' && (
                  <p className="mb-3 border-t border-gray-100 pt-5 flex items-center gap-2 text-sm font-semibold text-brand-800">
                    <Landmark className="w-4 h-4 text-mint-600" /> บัญชีรับเงิน
                  </p>
                )}
                {renderFormField({
                  question: q, index, formValues: values, errors, onInputChange, allQuestions: form.questions,
                  minDate: useDateQuestion && q.id === useDateQuestion.id ? todayBkk() : undefined,
                  minNumber: amountQuestion && q.id === amountQuestion.id ? 0 : undefined,
                })}
                {amountQuestion && q.id === amountQuestion.id && hint?.error && (
                  <p className="mt-2 inline-flex items-start gap-1.5 rounded-lg bg-rose-50 px-2.5 py-1.5 text-xs text-rose-700">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-px" />{hint.text}
                  </p>
                )}
                {amountQuestion && q.id === amountQuestion.id && hint && !hint.error && (
                  <button type="button" onClick={() => setToaOpen(true)} title="ดูตาราง TOA ระดับขั้นอนุมัติ"
                    className="mt-2 inline-flex items-start gap-1.5 rounded-lg bg-mint-300/25 px-2.5 py-1.5 text-left text-xs text-mint-700 underline decoration-dotted underline-offset-2 hover:bg-mint-300/40">
                    <BadgeCheck className="w-3.5 h-3.5 shrink-0 mt-px" />{hint.text}<ChevronRight className="w-3.5 h-3.5 shrink-0 mt-px" />
                  </button>
                )}
                {amountQuestion && q.id === amountQuestion.id && !hint && (
                  <button type="button" onClick={() => setToaOpen(true)}
                    className="mt-2 inline-flex items-center gap-1 text-xs text-brand-600 underline underline-offset-2 hover:text-brand-700">
                    <ScrollText className="w-3.5 h-3.5" />ดูตาราง TOA ระดับขั้นอนุมัติ
                  </button>
                )}
              </div>
            )}
            <div>
              <p className="mb-1.5 flex items-center gap-2 text-sm font-medium text-gray-700">
                <Paperclip className="w-4 h-4 text-brand-600" /> {isSupplier ? <>แนบ bookbank หรือใบแจ้งหนี้ที่มีเลขบัญชี <span className="text-rose-600">*</span></> : <>เอกสารประกอบ <span className="text-gray-400 font-normal">(ถ้ามี)</span></>}
              </p>
              {isEdit && listWarning && (
                <p className="mb-2 rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs text-amber-800">โหลดรายการไฟล์แนบเดิมไม่สำเร็จ — หากเป็นบัญชี Supplier กรุณาแนบ bookbank อีกครั้ง</p>
              )}
              {isEdit && editId && (
                <div className="mb-2 rounded-xl bg-gray-50 p-3">
                  <AttachmentPanel formId={editId} folder="request" />
                </div>
              )}
              <FilePicker files={files} onChange={setFiles} disabled={submitting} />
            </div>
            <Button
              type="submit"
              disabled={submitting}
              className="w-full h-12 sm:h-14 bg-linear-to-r from-brand-600 to-brand-500 hover:from-brand-700 hover:to-brand-600 text-white font-semibold rounded-xl sm:rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 disabled:opacity-60"
            >
              {submitting ? 'กำลังส่ง...' : isEdit ? 'บันทึกและส่งใหม่' : 'ส่งคำขอเบิกเงิน'}
            </Button>
          </form>
        )}
      </section>
      <ToaDialog open={toaOpen} onOpenChange={setToaOpen} clause={hint?.clause} requiredLevel={hint?.requiredLevel} />
    </FinanceShell>
  );
}

export default function NewAdvancePage() {
  return (
    <Suspense fallback={<FinanceShell title="ขอเบิกเงิน Advance"><div className="py-10"><MascotLoader text="กำลังโหลดแบบฟอร์ม" /></div></FinanceShell>}>
      <NewAdvance />
    </Suspense>
  );
}
