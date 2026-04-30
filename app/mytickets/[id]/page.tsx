'use client';
import { Navbar } from '@/components/navbar';
import dynamic from 'next/dynamic';
import { useEffect, useState, useCallback } from 'react';
import { type TabType, type SurveyFilter } from "./ticketstable";
import { useSessionContext } from '@/app/context/SessionContext';
import { useParams, useRouter } from "next/navigation";
import { WaveBackground } from '@/components/wave-background';
import { FormValue } from './types';

const TicketComponent = dynamic(
    () => import('./ticketscontent').then(mod => ({ default: mod.TicketComponent })),
    { ssr: false }
);

const swal = (options: any) =>
    import('sweetalert2').then(({ default: Swal }) => Swal.fire(options));

const showSuccess = (title: string) =>
    swal({ title, icon: 'success', showConfirmButton: false, timer: 2000 });

const showError = (title: string, text?: string) =>
    swal({ title, text, icon: 'error', confirmButtonText: 'ตกลง' });

export type Ticket = {
    form_id: string;
    form_version: number;
    current_level: number;
    submission_id: string;
    form_code: string;
    form_name: string;
    status: string;
    status_approve: string;
    firstname: string;
    lastname: string;
    employee_status: string;
    email: string;
    point: number;
    comment: string;
    survey_at: string;
    created_by: string;
    created_by_email: string;
    action_by_firstname: string;
    action_by_lastname: string;
    department_name_th: string;
    created_at: string;
    action_at: string;
    image_url?: string;
    remark?: string;
    admin_comment?: string;
    values: FormValue[];
};

const getDefaultMonthRange = () => {
    const now = new Date();
    const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    return {
        startMonth: fmt(new Date(now.getFullYear(), now.getMonth() - 2, 1)),
        endMonth: fmt(new Date(now.getFullYear(), now.getMonth(), 1)),
    };
};

const monthToRange = (sMonth: string, eMonth: string) => {
    const [sy, sm] = sMonth.split('-').map(Number);
    const [ey, em] = eMonth.split('-').map(Number);
    const lastDay = new Date(ey, em, 0).getDate();
    return {
        start_date: `${sy}-${String(sm).padStart(2, '0')}-01`,
        end_date: `${ey}-${String(em).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`,
    };
};

export default function TicketsPage() {
    const { user } = useSessionContext();
    const { id: formIdFromUrl } = useParams<{ id: string }>();
    const router = useRouter();
    const employeeId = user?.employee_id ?? null;
    const role = user?.role ?? null;

    const [tickets, setTickets] = useState<Ticket[]>([]);
    const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<TabType>('apv');

    // Auto-open from URL (/mytickets/{form_id})
    const [autoOpenTicket, setAutoOpenTicket] = useState<Ticket | null>(null);
    const [isAutoOpenSheetOpen, setIsAutoOpenSheetOpen] = useState(false);
    const [isAutoOpenLoading, setIsAutoOpenLoading] = useState(false);

    const [surveyFilter, setSurveyFilter] = useState<SurveyFilter>('evaluated');
    const [surveyEvaluated, setSurveyEvaluated] = useState<Ticket[]>([]);
    const [surveyNotEvaluated, setSurveyNotEvaluated] = useState<Ticket[]>([]);

    const [{ startMonth, endMonth }, setMonthRange] = useState(getDefaultMonthRange);

    const handleMonthRangeChange = useCallback((sMonth: string, eMonth: string) => {
        setMonthRange(sMonth > eMonth
            ? { startMonth: eMonth, endMonth: sMonth }
            : { startMonth: sMonth, endMonth: eMonth });
    }, []);

    const fetchTickets = useCallback(async (tab: TabType) => {
        if (!employeeId) return;
        setIsLoading(true);
        const { start_date, end_date } = monthToRange(startMonth, endMonth);
        const dateQS = `&start_date=${start_date}&end_date=${end_date}`;
        try {
            if (tab === 'suv') {
                const [evalRes, notEvalRes] = await Promise.all([
                    fetch(`/api/survey-it?employee_id=${employeeId}&tab=${tab}&role=${role}`),
                    fetch(`/api/tickets?employee_id=${employeeId}&tab=suv&role=${role}&status=Done${dateQS}`),
                ]);
                const [evalData, notEvalData] = await Promise.all([evalRes.json(), notEvalRes.json()]);
                setSurveyEvaluated(Array.isArray(evalData) ? evalData : []);
                setSurveyNotEvaluated(Array.isArray(notEvalData) ? notEvalData : []);
                setTickets(Array.isArray(evalData) ? evalData : []);
            } else {
                const response = await fetch(`/api/tickets?employee_id=${employeeId}&tab=${tab}&role=${role}${dateQS}`);
                const data = await response.json();
                setTickets(Array.isArray(data) ? data : []);
            }
        } catch (error) {
            console.error('Error fetching tickets data:', error);
            setTickets([]);
        } finally {
            setIsLoading(false);
        }
    }, [employeeId, role, startMonth, endMonth]);

    useEffect(() => {
        if (!employeeId) return;
        fetchTickets(activeTab);
    }, [employeeId, activeTab, fetchTickets]);

    // Fetch ticket directly by form_id from URL (for /mytickets/{form_id})
    useEffect(() => {
        if (!formIdFromUrl || formIdFromUrl === 'all' || !employeeId) return;

        (async () => {
            setIsAutoOpenLoading(true);
            try {
                const res = await fetch(`/api/formselect?path=${formIdFromUrl}`);
                const data = await res.json();
                if (res.ok && data?.[0]) {
                    setAutoOpenTicket(data[0]);
                    setIsAutoOpenSheetOpen(true);
                } else {
                    console.error('Ticket not found for form_id:', formIdFromUrl);
                }
            } catch (error) {
                console.error('Error fetching ticket by ID:', error);
            } finally {
                setIsAutoOpenLoading(false);
            }
        })();
    }, [formIdFromUrl, employeeId]);

    const handleAutoOpenClose = useCallback(() => {
        setIsAutoOpenSheetOpen(false);
        setAutoOpenTicket(null);
        router.replace('/mytickets/all', { scroll: false });
    }, [router]);

    const handleTabChange = useCallback((tab: TabType) => {
        setActiveTab(tab);
        if (tab === 'suv') setSurveyFilter('evaluated');
    }, []);

    const handleSurveyFilterChange = useCallback((filter: SurveyFilter) => {
        setSurveyFilter(filter);
        if (filter === 'evaluated') setTickets(surveyEvaluated);
        else if (filter === 'not-evaluated') setTickets(surveyNotEvaluated);
        else setTickets([...surveyEvaluated, ...surveyNotEvaluated]);
    }, [surveyEvaluated, surveyNotEvaluated]);

    const handleSelected = useCallback(async (ticket: Ticket) => {
        const res = await fetch(`/api/formselect?path=${ticket.form_id}`, { cache: "no-store" });
        const data = await res.json();
        setSelectedTicket(data[0]);
    }, []);

    const submitAction = useCallback(async (
        ticket: Ticket,
        remark: string,
        action: 'approve' | 'reject',
    ) => {
        const successMsg = action === 'approve' ? 'อนุมัติคำร้องสำเร็จ' : 'ปฏิเสธคำร้องสำเร็จ';
        const errorMsg = action === 'approve' ? 'เกิดข้อผิดพลาดในการอนุมัติ' : 'เกิดข้อผิดพลาดในการปฏิเสธ';
        const newStatus = action === 'approve' ? 'Approved' : 'Rejected';

        try {
            const res = await fetch('/api/tickets', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    form_id: ticket.form_id,
                    employee_id: employeeId,
                    remark: remark || '',
                    action,
                }),
            });

            if (res.ok) {
                setTickets(prev => prev.map(t =>
                    t.form_id === ticket.form_id ? { ...t, status: newStatus } : t
                ));
                setSelectedTicket(prev =>
                    prev && prev.form_id === ticket.form_id ? { ...prev, status: newStatus } : prev
                );
                await showSuccess(successMsg);
            } else {
                const errorData = await res.json().catch(() => ({}));
                await showError(errorMsg, errorData.error || res.statusText);
            }
        } catch (error) {
            console.error(`Error ${action} ticket:`, error);
            await showError(errorMsg);
        }
    }, [employeeId]);

    const handleApprove = useCallback((ticket: Ticket, remark: string) =>
        submitAction(ticket, remark, 'approve'), [submitAction]);

    const handleReject = useCallback((ticket: Ticket, remark: string) =>
        submitAction(ticket, remark, 'reject'), [submitAction]);

    const handleUpdateStatus = useCallback((ticket: Ticket, newStatus: string) => {
        setTickets(prev => prev.map(t =>
            t.form_id === ticket.form_id ? { ...t, status: newStatus } : t
        ));
    }, []);

    if (isLoading) {
        return (
            <Navbar isHome={false} title="ติดตามสถานะคำร้อง">
                <main className="flex-1 min-h-0 bg-[#026a75] rounded-t-[1.5rem] sm:rounded-t-[2rem] lg:rounded-t-[3rem] shadow-2xl overflow-y-auto relative">
                    <WaveBackground />
                    <div className="flex items-center justify-center h-64 relative z-10">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
                    </div>
                </main>
            </Navbar>
        );
    }

    return (
        <Navbar isHome={false} title="ติดตามสถานะคำร้อง">
            <TicketComponent
                tickets={tickets}
                selectTicketBack={selectedTicket}
                onSelect={handleSelected}
                onApprove={handleApprove}
                onReject={handleReject}
                activeTab={activeTab}
                onTabChange={handleTabChange}
                onStatusChange={handleUpdateStatus}
                onFormDataUpdate={handleSelected}
                loading={isLoading}
                role={role}
                autoOpenTicket={autoOpenTicket}
                autoOpenFormData={autoOpenTicket}
                isAutoOpenSheetOpen={isAutoOpenSheetOpen}
                isAutoOpenLoading={isAutoOpenLoading}
                onAutoOpenClose={handleAutoOpenClose}
                surveyFilter={surveyFilter}
                onSurveyFilterChange={handleSurveyFilterChange}
                startMonth={startMonth}
                endMonth={endMonth}
                onMonthRangeChange={handleMonthRangeChange}
            />
        </Navbar>
    );
}
