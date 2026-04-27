'use client';

import { useMemo } from 'react';
import {
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    LabelList,
    Pie,
    PieChart,
    XAxis,
    YAxis,
} from 'recharts';
import {
    ChartContainer,
    ChartTooltip,
    ChartTooltipContent,
    ChartLegend,
    ChartLegendContent,
    type ChartConfig,
} from '@/components/ui/chart';
import {
    ClipboardList,
    TriangleAlert,
    CircleCheck,
    ListTodo,
    Star,
} from 'lucide-react';
import type { Ticket, Survey } from './page';
import { monthsBetween, labelYM } from './dashboard_filter';

// ===================== HELPERS =====================
const isIssueForm = (t: { form_name?: string; form_code?: string }) =>
    /แจ้งปัญหา|issue|problem|incident/i.test(`${t.form_name ?? ''} ${t.form_code ?? ''}`);

const STATUS_COLORS: Record<string, string> = {
    Open: '#3b82f6',
    'In Progress': '#f59e0b',
    'In-Progress': '#f59e0b',
    Done: '#10b981',
    Rejected: '#ef4444',
    Backlog: '#a855f7',
};

const STATUS_LABEL: Record<string, string> = {
    Open: 'Open',
    'In Progress': 'In Progress',
    'In-Progress': 'In Progress',
    Done: 'Done',
    Rejected: 'Rejected',
    Backlog: 'Backlog',
};

const TYPE_COLORS = { issue: '#ef4444', service: '#0d9488' };

// Render percentage label inside each pie slice
const renderPieValueLabel = (props: {
    cx?: number;
    cy?: number;
    midAngle?: number;
    innerRadius?: number;
    outerRadius?: number;
    percent?: number;
}) => {
    const { cx = 0, cy = 0, midAngle = 0, innerRadius = 0, outerRadius = 0, percent = 0 } = props;
    if (!percent) return null;
    const RADIAN = Math.PI / 180;
    const r = innerRadius + (outerRadius - innerRadius) / 2;
    const x = cx + r * Math.cos(-midAngle * RADIAN);
    const y = cy + r * Math.sin(-midAngle * RADIAN);
    return (
        <text
            x={x}
            y={y}
            fill="#ffffff"
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={11}
            fontWeight={700}
        >
            {`${Math.round(percent * 100)}%`}
        </text>
    );
};

// ===================== METRIC CARD =====================
const MetricCard = ({
    icon: Icon,
    label,
    value,
    accent,
}: {
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    value: number | string;
    accent: string;
}) => (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-5 flex items-center gap-3 sm:gap-4 transition-all hover:shadow-md">
        <div className={`shrink-0 w-11 h-11 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center ${accent}`}>
            <Icon className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
        </div>
        <div className="min-w-0">
            <div className="text-xs sm:text-sm text-gray-500 truncate">{label}</div>
            <div className="text-2xl sm:text-3xl font-bold text-gray-800">{value}</div>
        </div>
    </div>
);

// ===================== STATUS BREAKDOWN =====================
const StatusBreakdown = ({ data }: { data: { name: string; value: number; color: string }[] }) => {
    const total = data.reduce((s, d) => s + d.value, 0);
    const config: ChartConfig = data.reduce((acc, d) => {
        acc[d.name] = { label: STATUS_LABEL[d.name] || d.name, color: d.color };
        return acc;
    }, {} as ChartConfig);

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <h3 className="text-sm font-semibold text-gray-800 mb-4">สถานะงาน</h3>
            {total === 0 ? (
                <EmptyState />
            ) : (
                <div className="flex items-center gap-4">
                    <ChartContainer config={config} className="aspect-square h-40 w-40 shrink-0">
                        <PieChart>
                            <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                            <Pie
                                data={data}
                                dataKey="value"
                                nameKey="name"
                                innerRadius={45}
                                outerRadius={70}
                                strokeWidth={2}
                                label={renderPieValueLabel}
                                labelLine={false}
                            >
                                {data.map((d) => (
                                    <Cell key={d.name} fill={d.color} />
                                ))}
                            </Pie>
                        </PieChart>
                    </ChartContainer>
                    <div className="flex-1 min-w-0">
                        <div className="text-xs text-gray-500 mb-1">ทั้งหมด</div>
                        <div className="text-2xl font-bold text-gray-800 mb-3">{total} รายการ</div>
                        <div className="space-y-1.5">
                            {data.map((d) => (
                                <div key={d.name} className="flex items-center justify-between text-xs">
                                    <div className="flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: d.color }} />
                                        <span className="text-gray-700">{STATUS_LABEL[d.name] || d.name}</span>
                                    </div>
                                    <span className="font-semibold text-gray-800 tabular-nums">{d.value}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// ===================== TYPE BREAKDOWN =====================
const TypeBreakdown = ({ issue, service }: { issue: number; service: number }) => {
    const total = issue + service;
    const data = [
        { name: 'แจ้งปัญหา', value: issue, color: TYPE_COLORS.issue },
        { name: 'ขอบริการ', value: service, color: TYPE_COLORS.service },
    ];
    const config: ChartConfig = {
        แจ้งปัญหา: { label: 'แจ้งปัญหา', color: TYPE_COLORS.issue },
        ขอบริการ: { label: 'ขอบริการ', color: TYPE_COLORS.service },
    };
    const pct = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0);

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <h3 className="text-sm font-semibold text-gray-800 mb-4">สัดส่วนประเภทงาน</h3>
            {total === 0 ? (
                <EmptyState />
            ) : (
                <div className="flex items-center gap-4">
                    <ChartContainer config={config} className="aspect-square h-40 w-40 shrink-0">
                        <PieChart>
                            <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                            <Pie data={data} dataKey="value" nameKey="name" innerRadius={45} outerRadius={70} strokeWidth={2}>
                                {data.map((d) => (
                                    <Cell key={d.name} fill={d.color} />
                                ))}
                            </Pie>
                        </PieChart>
                    </ChartContainer>
                    <div className="flex-1 space-y-3">
                        {data.map((d) => (
                            <div key={d.name}>
                                <div className="flex items-center justify-between text-xs mb-1">
                                    <div className="flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: d.color }} />
                                        <span className="text-gray-700">{d.name}</span>
                                    </div>
                                    <span className="font-semibold text-gray-800 tabular-nums">
                                        {d.value} ({pct(d.value)}%)
                                    </span>
                                </div>
                                <div className="w-full h-1.5 rounded-full bg-gray-100 overflow-hidden">
                                    <div
                                        className="h-full rounded-full transition-all"
                                        style={{ width: `${pct(d.value)}%`, backgroundColor: d.color }}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

// ===================== MONTHLY TREND =====================
const MonthlyTrend = ({ data }: { data: { month: string; issue: number; service: number }[] }) => {
    const config: ChartConfig = {
        issue: { label: 'แจ้งปัญหา', color: TYPE_COLORS.issue },
        service: { label: 'ขอบริการ', color: TYPE_COLORS.service },
    };
    const empty = data.every((d) => d.issue === 0 && d.service === 0);

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <h3 className="text-sm font-semibold text-gray-800 mb-4">แนวโน้มรายเดือน</h3>
            {empty ? (
                <EmptyState />
            ) : (
                <ChartContainer config={config} className="h-64 w-full">
                    <BarChart data={data} margin={{ top: 5, right: 5, left: -15, bottom: 0 }}>
                        <CartesianGrid vertical={false} strokeDasharray="3 3" />
                        <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} fontSize={11} />
                        <YAxis tickLine={false} axisLine={false} fontSize={11} allowDecimals={false} />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <ChartLegend content={(props) => <ChartLegendContent payload={props.payload} />} />
                        <Bar dataKey="issue" fill="var(--color-issue)" radius={[6, 6, 0, 0]}>
                            <LabelList
                                dataKey="issue"
                                position="insideTop"
                                fontSize={10}
                                fontWeight={600}
                                fill="#ffffff"
                                formatter={(v: React.ReactNode) =>
                                    typeof v === 'number' && v > 0 ? String(v) : ''
                                }
                            />
                        </Bar>
                        <Bar dataKey="service" fill="var(--color-service)" radius={[6, 6, 0, 0]}>
                            <LabelList
                                dataKey="service"
                                position="insideTop"
                                fontSize={10}
                                fontWeight={600}
                                fill="#ffffff"
                                formatter={(v: React.ReactNode) =>
                                    typeof v === 'number' && v > 0 ? String(v) : ''
                                }
                            />
                        </Bar>
                    </BarChart>
                </ChartContainer>
            )}
        </div>
    );
};

// ===================== SATISFACTION =====================
const Satisfaction = ({ surveys }: { surveys: Survey[] }) => {
    const count = surveys.length;
    const avg = count > 0 ? surveys.reduce((s, x) => s + (Number(x.point) || 0), 0) / count : 0;
    const pct = count > 0 ? Math.round((avg / 5) * 100) : 0;
    const stars = Math.round(avg);

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <h3 className="text-sm font-semibold text-gray-800 mb-4">ความพึงพอใจ</h3>
            {count === 0 ? (
                <EmptyState />
            ) : (
                <div className="flex flex-col items-center justify-center py-2">
                    <div className="relative w-32 h-32 mb-3">
                        <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                            <circle cx="50" cy="50" r="42" stroke="#f3f4f6" strokeWidth="10" fill="none" />
                            <circle
                                cx="50"
                                cy="50"
                                r="42"
                                stroke="#0d9488"
                                strokeWidth="10"
                                fill="none"
                                strokeDasharray={`${(pct / 100) * 264} 264`}
                                strokeLinecap="round"
                                className="transition-all duration-500"
                            />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center">
                            <span className="text-2xl font-bold text-teal-700">{pct.toFixed(0)}%</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-1 mb-1">
                        {[1, 2, 3, 4, 5].map((i) => (
                            <Star
                                key={i}
                                className={`w-4 h-4 ${i <= stars ? 'fill-amber-400 text-amber-400' : 'text-gray-300'}`}
                            />
                        ))}
                    </div>
                    <div className="text-sm text-gray-700">
                        <span className="font-bold">{avg.toFixed(2)}</span>
                        <span className="text-gray-400"> / 5.00</span>
                    </div>
                    <div className="text-[11px] text-gray-500 mt-0.5">จาก {count} รีวิว</div>
                </div>
            )}
        </div>
    );
};

const EmptyState = () => (
    <div className="text-center py-10 text-xs text-gray-400">ไม่มีข้อมูลในช่วงเวลาที่เลือก</div>
);

// ===================== MAIN =====================
export const DashboardContent = ({
    tickets,
    surveys,
    loading,
    start,
    end,
}: {
    tickets: Ticket[];
    surveys: Survey[];
    loading: boolean;
    start: string;
    end: string;
}) => {
    const stats = useMemo(() => {
        const total = tickets.length;
        const issue = tickets.filter(isIssueForm).length;
        const service = total - issue;
        const done = tickets.filter((t) => t.status === 'Done').length;

        const statusCount = new Map<string, number>();
        tickets.forEach((t) => {
            const k = t.status || 'Unknown';
            statusCount.set(k, (statusCount.get(k) || 0) + 1);
        });
        const statusData = Array.from(statusCount.entries())
            .map(([name, value]) => ({ name, value, color: STATUS_COLORS[name] || '#6b7280' }))
            .sort((a, b) => b.value - a.value);

        // Build trend across selected month range (1–N months)
        const monthsRange = monthsBetween(start, end);
        const trendMap = new Map<string, { month: string; issue: number; service: number }>();
        monthsRange.forEach((ym) => {
            trendMap.set(ym, { month: labelYM(ym), issue: 0, service: 0 });
        });
        tickets.forEach((t) => {
            if (!t.created_at) return;
            const d = new Date(t.created_at);
            const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            const bucket = trendMap.get(ym);
            if (!bucket) return;
            if (isIssueForm(t)) bucket.issue += 1;
            else bucket.service += 1;
        });
        const trend = monthsRange.map((ym) => trendMap.get(ym)!);

        return { total, issue, service, done, statusData, trend };
    }, [tickets, start, end]);

    if (loading) {
        return (
            <div className="flex items-center justify-center py-32">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-white" />
            </div>
        );
    }

    return (
        <div className="space-y-5">
            {/* Metric cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                <MetricCard icon={ListTodo} label="งานทั้งหมด" value={stats.total} accent="bg-gradient-to-br from-teal-500 to-teal-700" />
                <MetricCard icon={TriangleAlert} label="แจ้งปัญหา" value={stats.issue} accent="bg-gradient-to-br from-rose-500 to-rose-700" />
                <MetricCard icon={ClipboardList} label="ขอบริการ" value={stats.service} accent="bg-gradient-to-br from-sky-500 to-sky-700" />
                <MetricCard icon={CircleCheck} label="เสร็จสิ้น" value={stats.done} accent="bg-gradient-to-br from-emerald-500 to-emerald-700" />
            </div>

            {/* Row 2: status + trend + satisfaction */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                <div className="lg:col-span-4">
                    <StatusBreakdown data={stats.statusData} />
                </div>
                <div className="lg:col-span-5">
                    <MonthlyTrend data={stats.trend} />
                </div>
                <div className="lg:col-span-3">
                    <Satisfaction surveys={surveys} />
                </div>
            </div>

           
        </div>
    );
};
