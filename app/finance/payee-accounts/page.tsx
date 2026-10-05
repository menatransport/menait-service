'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Landmark } from 'lucide-react';
import { MascotLoader } from '@/components/loading';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useSessionContext } from '@/app/context/SessionContext';
import type { PayeeAccount, PayeeRequest } from '@/lib/finance/payee';
import { fetchJson, showAlert } from '../api';
import { FinanceCanvas, FinanceHeading, NoAccess } from '../components/FinanceShell';
import { MasterTab } from '../components/payee/MasterTab';
import { RequestReviewDialog, RequestsTab } from '../components/payee/RequestsTab';

const TITLE = 'บัญชีรับเงินพนักงาน';
const CAPTION = 'ตรวจคำขอและจัดการบัญชีรับเงิน (K-Bank) ของพนักงาน';

function PayeeAccountsContent() {
  const { user, loading } = useSessionContext();
  const router = useRouter();
  const param = useSearchParams().get('request');
  const deepId = param && /^\d+$/.test(param) ? Number(param) : null;

  const [tab, setTab] = useState<'requests' | 'master'>('requests');
  const [requests, setRequests] = useState<PayeeRequest[] | null>(null);
  const [accounts, setAccounts] = useState<PayeeAccount[] | null>(null);
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [openId, setOpenId] = useState<number | null>(deepId);

  const isFinance = !!user?.is_finance;

  useEffect(() => { if (deepId !== null) { setOpenId(deepId); setTab('requests'); } }, [deepId]);
  useEffect(() => { const t = setTimeout(() => setDebounced(query.trim()), 300); return () => clearTimeout(t); }, [query]);

  const loadRequests = useCallback(async () => {
    try { setRequests(await fetchJson<PayeeRequest[]>('/api/finance/payee-requests?status=PENDING')); }
    catch (err) { setRequests([]); showAlert({ icon: 'error', title: 'โหลดคำขอไม่สำเร็จ', text: (err as Error).message }); }
  }, []);
  const loadAccounts = useCallback(async () => {
    try {
      const qs = debounced ? `?q=${encodeURIComponent(debounced)}` : '';
      setAccounts(await fetchJson<PayeeAccount[]>(`/api/finance/payee-accounts${qs}`));
    } catch (err) { setAccounts([]); showAlert({ icon: 'error', title: 'โหลดบัญชีไม่สำเร็จ', text: (err as Error).message }); }
  }, [debounced]);

  useEffect(() => { if (isFinance) loadRequests(); }, [isFinance, loadRequests]);
  useEffect(() => { if (isFinance) loadAccounts(); }, [isFinance, loadAccounts]);

  const refetchBoth = async () => { await Promise.all([loadRequests(), loadAccounts()]); };

  const closeReview = () => {
    setOpenId(null);
    if (deepId !== null) router.replace('/finance/payee-accounts');
  };

  if (!loading && !isFinance) {
    return (
      <FinanceCanvas title={TITLE} width="max-w-lg">
        <NoAccess />
      </FinanceCanvas>
    );
  }

  return (
    <FinanceCanvas title={TITLE}>
      <FinanceHeading icon={Landmark} title={TITLE} caption={CAPTION} />
      <Tabs value={tab} onValueChange={v => setTab(v as 'requests' | 'master')}>
        <TabsList className="mb-4 max-w-full justify-start overflow-x-auto rounded-full bg-gray-800/50 p-1 backdrop-blur-sm">
          {([['requests', `คำขอรอตรวจ (${requests?.length ?? 0})`], ['master', 'Master']] as const).map(([key, label]) => (
            <TabsTrigger key={key} value={key} className="shrink-0 rounded-full px-5 py-2 font-medium text-white/70 transition-all hover:text-white data-[state=active]:bg-white data-[state=active]:text-brand-700 data-[state=active]:shadow-md">
              {label}
            </TabsTrigger>
          ))}
        </TabsList>
        <section className="relative overflow-hidden rounded-2xl border border-white/30 bg-white shadow-xl">
          {tab === 'requests' ? (
            <RequestsTab requests={requests} loading={requests === null} onOpen={setOpenId} />
          ) : (
            <MasterTab accounts={accounts} loading={accounts === null} query={query} onQueryChange={setQuery} onChanged={refetchBoth} />
          )}
        </section>
      </Tabs>
      <RequestReviewDialog requestId={openId} onClose={closeReview} onChanged={refetchBoth} />
    </FinanceCanvas>
  );
}

export default function PayeeAccountsPage() {
  return (
    <Suspense fallback={<FinanceCanvas title={TITLE}><div className="py-8"><MascotLoader text="กำลังโหลด" size={80} /></div></FinanceCanvas>}>
      <PayeeAccountsContent />
    </Suspense>
  );
}
