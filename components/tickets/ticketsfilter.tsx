import { ChevronDown, ChevronUp, Filter } from "lucide-react"
import { useState } from "react";

export const TicketsFilter = ({ filterStatus, handleFilterChange }: { filterStatus: string; handleFilterChange: (status: string) => void }) => {
    const [showFilters, setShowFilters] = useState(true);
    return (
        <section className="bg-white rounded-2xl shadow-xl border border-white/30 p-5 mb-6">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                    <Filter size={22} />
                    ตัวกรองข้อมูล
                </h2>
                <button
                    onClick={() => setShowFilters(!showFilters)}
                    className="md:hidden bg-gray-200 hover:bg-gray-300 p-2 rounded-lg transition-colors"
                >
                    {showFilters ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                </button>
            </div>

            {showFilters && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">สถานะ</label>
                        <select
                            value={filterStatus}
                            onChange={(e) => handleFilterChange(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#026a75] focus:border-transparent"
                        >
                            <option value="all">ทั้งหมด</option>
                            <option value="Open">Open</option>
                            <option value="In Progress">In Progress</option>
                            <option value="Closed">Closed</option>
                        </select>
                    </div>
                </div>
            )}
        </section>
    );
}