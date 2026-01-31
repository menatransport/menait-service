import { FileText, CircleX, Clock, MessageSquareQuote, Check } from "lucide-react";


export const StatCards = ({ stats }: any) => {

    const StatCard = ({ label, value, icon: Icon, colorClass }: {
        label: string;
        value: number;
        icon: React.ElementType;
        colorClass: { text: string; bg: string };
    }) => (
        <div className="bg-white rounded-xl shadow-lg border border-white/30 p-4">
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-sm text-gray-600">{label}</p>
                    <p className={`text-2xl font-bold ${colorClass.text}`}>{value}</p>
                </div>
                <div className={`${colorClass.bg} p-3 rounded-full`}>
                    <Icon className={colorClass.text} size={24} />
                </div>
            </div>
        </div>
    );
    return (
        <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 lg:gap-4 mb-6">
            <StatCard label="รายการทั้งหมด" value={stats.total} icon={FileText} colorClass={{ text: 'text-gray-800', bg: 'bg-blue-100' }} />
            <StatCard label="ยกเลิก" value={stats.cancelled} icon={CircleX} colorClass={{ text: 'text-red-600', bg: 'bg-red-100' }} />
            <StatCard label="รอดำเนินการ" value={stats.pending} icon={Clock} colorClass={{ text: 'text-yellow-600', bg: 'bg-yellow-100' }} />
            <StatCard label="กำลังดำเนินการ" value={stats.inProgress} icon={MessageSquareQuote} colorClass={{ text: 'text-blue-600', bg: 'bg-blue-100' }} />
            <StatCard label="เสร็จสิ้น" value={stats.completed} icon={Check} colorClass={{ text: 'text-green-600', bg: 'bg-green-100' }} />
        </section>
    );
}