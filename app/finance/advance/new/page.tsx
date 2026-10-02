'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, BadgeCheck, Building2, HandCoins, IdCard, Landmark, MapPin, Paperclip, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Loading, { MascotLoader } from '@/components/loading';
import { Mascot } from '@/components/mascot';
import { buildSubmitValues, renderFormField } from '@/components/renderForm';
import type { Question } from '@/app/service/[[...slug]]/page';
import { useSessionContext } from '@/app/context/SessionContext';
import { accountNoError, normalizeAccountNo } from '@/lib/finance/bank';
import { isBeforeToday } from '@/lib/finance/dates';
import { parseAmount, todayBkk } from '@/lib/finance/status';
import { fetchJson, showAlert, uploadFiles } from '../../api';
import { FilePicker } from '../../components/FilePicker';
import { FinanceShell } from '../../components/FinanceShell';

interface AdvForm { form_code: string; form_name: string; form_status: string; questions: Question[] }

const isBlank = (v: unknown) => v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0);

// The "adv_use_date" question by name, falling back to the first datetime/date question.
const findUseDateQuestion = (questions: Question[]): Question | undefined =>
  questions.find(q => q.name === 'adv_use_date') ??
  questions.find(q => q.type === 'datetime' || q.type === 'date');

export default function NewAdvancePage() {
  const router = useRouter();
  const { user } = useSessionContext();
  const [form, setForm] = useState<AdvForm | null>(null);
  const [values, setValues] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const useDateQuestion = useMemo(
    () => (form ? findUseDateQuestion(form.questions) : undefined),
    [form]
  );

  const [hint, setHint] = useState<{ text: string; error: boolean } | null>(null);
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
      fetchJson<{ clause: string; approver_label: string; required_level: number }>(
        `/api/finance/approval-preview?amount=${encodeURIComponent(String(amount))}`)
        .then(r => { if (!cancelled) setHint({ text: `ต้องอนุมัติโดยระดับ ${r.required_level} ขึ้นไป (ข้อ ${r.clause} · ${r.approver_label})`, error: false }); })
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

  const onInputChange = useCallback((name: string, value: any) => {
    setValues(prev => ({ ...prev, [name]: value }));
    setErrors(prev => {
      if (!prev[name]) return prev;
      const { [name]: _removed, ...rest } = prev;
      return rest;
    });
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;
    if (!user?.employee_id) {
      return showAlert({ icon: 'error', title: 'ไม่พบข้อมูลผู้ใช้', text: 'กรุณาเข้าสู่ระบบใหม่' });
    }
    const next: Record<string, string> = {};
    for (const q of form.questions) {
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
    if (accountQ && !next[accountQ.name] && !isBlank(values[accountQ.name])) {
      const msg = accountNoError(bankQ ? values[bankQ.name] : null, values[accountQ.name]);
      if (msg) next[accountQ.name] = msg;
    }
    if (Object.keys(next).length) { setErrors(next); return; }

    setSubmitting(true);
    try {
      const normalized = { ...values };
      for (const q of form.questions) {
        if (q.type === 'number' && !isBlank(normalized[q.name])) normalized[q.name] = parseAmount(normalized[q.name]);
        if (q.name === 'adv_account_no' && !isBlank(normalized[q.name])) normalized[q.name] = normalizeAccountNo(normalized[q.name]);
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
      showAlert({ icon: 'error', title: 'ส่งคำขอไม่สำเร็จ', text: (err as Error).message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <FinanceShell title="ขอเบิกเงิน Advance">
      {submitting && (
        <div className="fixed inset-0 z-9999 flex items-center justify-center v2-loader-overlay">
          <Loading text="กำลังส่งคำขอ" />
        </div>
      )}
      <section className="rounded-2xl sm:rounded-3xl bg-white shadow-xl p-4 sm:p-6 lg:p-8">
        <div className="mb-6 pb-4 border-b border-gray-200 flex items-center gap-3">
          <div className="v2-tile-mint w-10 h-10 rounded-xl flex items-center justify-center shrink-0">
            <HandCoins className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h2 className="font-display text-xl font-semibold text-brand-800">{form?.form_name ?? 'ขอเบิกเงิน Advance'}</h2>
            <p className="text-xs text-gray-500">เงินทดรองจ่าย — กรอกข้อมูลแล้วส่งให้ผู้มีอำนาจอนุมัติ</p>
          </div>
        </div>

        {loading ? (
          <div className="py-10"><MascotLoader text="กำลังโหลดแบบฟอร์ม" /></div>
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
            {form.questions.map((q, index) =>
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
                {amountQuestion && q.id === amountQuestion.id && hint && (
                  <p className={`mt-2 inline-flex items-start gap-1.5 rounded-lg px-2.5 py-1.5 text-xs ${hint.error ? 'bg-rose-50 text-rose-700' : 'bg-mint-300/25 text-mint-700'}`}>
                    {hint.error ? <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-px" /> : <BadgeCheck className="w-3.5 h-3.5 shrink-0 mt-px" />}
                    {hint.text}
                  </p>
                )}
              </div>
            )}
            <div>
              <p className="mb-1.5 flex items-center gap-2 text-sm font-medium text-gray-700">
                <Paperclip className="w-4 h-4 text-brand-600" /> เอกสารประกอบ <span className="text-gray-400 font-normal">(ถ้ามี)</span>
              </p>
              <FilePicker files={files} onChange={setFiles} disabled={submitting} />
            </div>
            <Button
              type="submit"
              disabled={submitting}
              className="w-full h-12 sm:h-14 bg-linear-to-r from-brand-600 to-brand-500 hover:from-brand-700 hover:to-brand-600 text-white font-semibold rounded-xl sm:rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 disabled:opacity-60"
            >
              {submitting ? 'กำลังส่ง...' : 'ส่งคำขอเบิกเงิน'}
            </Button>
          </form>
        )}
      </section>
    </FinanceShell>
  );
}
