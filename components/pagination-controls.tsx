export const PaginationControls = ({ currentPage, totalPages, onPageChange, variant = 'light' }: {
    currentPage: number;
    totalPages: number;
    onPageChange: (page: number) => void;
    variant?: 'light' | 'dark';
}) => {
    const isDark = variant === 'dark';
    const btnClass = isDark
        ? "px-3 py-1 border text-white rounded hover:bg-gray-100 hover:text-gray-600 disabled:opacity-40"
        : "px-3 py-1 border rounded hover:bg-gray-100 disabled:opacity-40";
    const textClass = isDark ? "text-gray-200" : "text-gray-600";

    return (
        <div className="flex items-center gap-2 text-sm">
            <button disabled={currentPage === 1} onClick={() => onPageChange(currentPage - 1)} className={btnClass}>
                ก่อนหน้า
            </button>
            <span className={textClass}>หน้า {currentPage} จาก {totalPages || 1}</span>
            <button disabled={currentPage >= totalPages} onClick={() => onPageChange(currentPage + 1)} className={btnClass}>
                ถัดไป
            </button>
        </div>
    );
};
