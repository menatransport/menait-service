'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { buildSubmitValues, renderFormField } from '@/components/renderForm';
import type { Question } from '@/app/service/[[...slug]]/page';
import { useSessionContext } from '@/app/context/SessionContext';
import { parseAmount } from '@/lib/finance/status';
import { fetchJson, showAlert, uploadFiles } from '../../api';
import { FilePicker } from '../../components/FilePicker';
import { FinanceShell, Panel } from '../../components/FinanceShell';

interface AdvForm { form_code: string; form_name: string; form_status: string; questions: Question[] }

const isBlank = (v: unknown) => v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0);

export default function NewAdvancePage() {
  const router = useRouter();
  const { user } = useSessionContext();
  const [form, setForm] = useState<AdvForm | null>(null);
  const [values, setValues] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

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
    }
    if (Object.keys(next).length) { setErrors(next); return; }

    setSubmitting(true);
    try {
      const normalized = { ...values };
      for (const q of form.questions) {
        if (q.type === 'number' && !isBlank(normalized[q.name])) normalized[q.name] = parseAmount(normalized[q.name]);
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
      {loading ? (
        <Panel title="กำลังโหลด..."><div className="h-24" /></Panel>
      ) : !form || form.form_status !== 'Active' ? (
        <Panel title="ไม่พบแบบฟอร์ม"><p className="text-sm text-gray-500">ยังไม่มีฟอร์ม ADV หรือฟอร์มปิดใช้งาน</p></Panel>
      ) : (
        <Panel title={form.form_name}>
          <form onSubmit={submit} className="space-y-5">
            <div className="grid grid-cols-2 gap-3 rounded-xl bg-gray-50 p-3 text-sm">
              <p><span className="text-gray-500">ผู้เบิกเงิน:</span> {user ? `${user.firstname} ${user.lastname}` : '-'}</p>
              <p><span className="text-gray-500">แผนก:</span> {user?.department ?? '-'}</p>
              <p><span className="text-gray-500">ศูนย์:</span> {user?.site ?? '-'}</p>
              <p><span className="text-gray-500">รหัสพนักงาน:</span> {user?.employee_id ?? '-'}</p>
            </div>
            {form.questions.map((q, index) =>
              <div key={q.id}>{renderFormField({ question: q, index, formValues: values, errors, onInputChange, allQuestions: form.questions })}</div>
            )}
            <div>
              <p className="mb-1 text-sm font-medium">เอกสารประกอบ</p>
              <FilePicker files={files} onChange={setFiles} disabled={submitting} />
            </div>
            <Button type="submit" disabled={submitting} className="w-full bg-[#026a75] hover:bg-[#055058]">
              {submitting ? 'กำลังส่ง...' : 'ส่งคำขอเบิกเงิน'}
            </Button>
          </form>
        </Panel>
      )}
    </FinanceShell>
  );
}
