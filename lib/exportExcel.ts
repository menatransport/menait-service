import * as XLSX from 'xlsx';

type ExcelColumn<T> = {
    header: string;
    key: keyof T | ((row: T) => string | number);
    width?: number;
};

/**
 * ส่งออกข้อมูลเป็นไฟล์ Excel (.xlsx)
 */
export function exportToExcel<T extends Record<string, any>>({
    data,
    columns,
    fileName = 'export',
    sheetName = 'data',
}: {
    data: T[];
    columns: ExcelColumn<T>[];
    fileName?: string;
    sheetName?: string;
}) {
    const headers = columns.map(col => col.header);

    const rows = data.map(row =>
        columns.map(col => {
            if (typeof col.key === 'function') {
                return col.key(row);
            }
            const value = row[col.key];
            return value ?? '';
        })
    );

    const worksheetData = [headers, ...rows];
    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);

    // Set column widths
    worksheet['!cols'] = columns.map(col => ({ wch: col.width ?? 18 }));

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

    const timestamp = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(workbook, `${fileName}_${timestamp}.xlsx`);
}
