import { Ticket } from '@/app/mytickets/[id]/page';
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


export function exportToExcel_Submissions(data: Ticket[]) {
    const workbook = XLSX.utils.book_new();

    const baseColumns: ExcelColumn<Ticket>[] = [
        { header: 'รหัสฟอร์ม', key: 'form_code', width: 16 },
        { header: 'ชื่อฟอร์ม', key: 'form_name', width: 30 },
        { header: 'รหัสคำร้อง', key: 'form_id', width: 22 },
        { header: 'รหัสพนักงาน', key: 'created_by', width: 22 },
        { header: 'ผู้สร้าง', key: (r) => `${r.firstname || ''} ${r.lastname || ''}`.trim() || r.created_by || '', width: 22 },
        { header: 'อีเมล', key: 'email', width: 26 },
        { header: 'ฝ่าย', key: 'department_name_th', width: 22 },
        { header: 'สถานะ', key: 'status', width: 14 },
        { header: 'ผู้อนุมัติ', key: (r) => `${r.action_by_firstname || ''} ${r.action_by_lastname || ''}`.trim() || '-', width: 22 },
        { header: 'สถานะอนุมัติ', key: (r) => r.status_approve || '-', width: 14 },
        { header: 'หมายเหตุผู้อนุมัติ', key: (r) => r.remark || '-', width: 30 },
        { header: 'วันที่อนุมัติ', key: (r) => r.action_at ? new Date(r.action_at).toLocaleDateString('th-TH') : '', width: 16 },
        { header: 'วันที่สร้าง', key: (r) => r.created_at ? new Date(r.created_at).toLocaleDateString('th-TH') : '', width: 16 },
        { header: 'หมายเหตุไอที', key: (r) => r.admin_comment || '-', width: 30 },
    ];

    // Helper: get the display value from a FormValue
    function getFormValueDisplay(fv: { value_text: string | null; value_number: number | null; value_date: string | null; value_boolean: boolean | null }): string {
        if (fv.value_text != null && fv.value_text !== '') return fv.value_text;
        if (fv.value_number != null) return String(fv.value_number);
        if (fv.value_date != null && fv.value_date !== '') {
            const d = new Date(fv.value_date);
            if (!isNaN(d.getTime())) {
                const day = String(d.getDate()).padStart(2, '0');
                const month = String(d.getMonth() + 1).padStart(2, '0');
                const buddhistYear = d.getFullYear() + 543;
                return `${day}/${month}/${buddhistYear}`;
            }
            return fv.value_date;
        }
        if (fv.value_boolean != null) return fv.value_boolean ? 'Yes' : 'No';
        return '';
    }

    // Helper: build a worksheet for a set of tickets
    function buildSheet(tickets: Ticket[]): XLSX.WorkSheet {
        // Collect all unique question_names in order, with their labels
        const questionMap = new Map<string, string>(); // question_name -> question_label
        for (const t of tickets) {
            for (const v of (t.values || [])) {
                if (!questionMap.has(v.question_name)) {
                    questionMap.set(v.question_name, v.question_label);
                }
            }
        }

        // Build headers: base headers + dynamic question headers
        const baseHeaders = baseColumns.map(col => col.header);
        const questionNames = Array.from(questionMap.keys());
        const questionHeaders = questionNames.map(name => questionMap.get(name) || name);
        const allHeaders = [...baseHeaders, ...questionHeaders];

        // Build rows
        const rows = tickets.map(ticket => {
            // Base values
            const baseRow = baseColumns.map(col => {
                if (typeof col.key === 'function') return col.key(ticket);
                const value = ticket[col.key];
                return value ?? '';
            });

            // Dynamic question values
            const valuesMap = new Map<string, string>();
            for (const v of (ticket.values || [])) {
                valuesMap.set(v.question_name, getFormValueDisplay(v));
            }
            const questionRow = questionNames.map(name => valuesMap.get(name) || '');

            return [...baseRow, ...questionRow];
        });

        const worksheetData = [allHeaders, ...rows];
        const ws = XLSX.utils.aoa_to_sheet(worksheetData);

        // Set column widths
        const baseWidths = baseColumns.map(col => ({ wch: col.width ?? 18 }));
        const questionWidths = questionHeaders.map(h => ({ wch: Math.max(h.length * 2, 20) }));
        ws['!cols'] = [...baseWidths, ...questionWidths];

        return ws;
    }

    // Sheet "ข้อมูลทั้งหมด" — base columns only, no dynamic question values
    const allHeaders = baseColumns.map(col => col.header);
    const allRows = data.map(ticket =>
        baseColumns.map(col => {
            if (typeof col.key === 'function') return col.key(ticket);
            const value = ticket[col.key];
            return value ?? '';
        })
    );
    const allWs = XLSX.utils.aoa_to_sheet([allHeaders, ...allRows]);
    allWs['!cols'] = baseColumns.map(col => ({ wch: col.width ?? 18 }));
    XLSX.utils.book_append_sheet(workbook, allWs, 'ข้อมูลทั้งหมด');

    const grouped = new Map<string, Ticket[]>();
    for (const ticket of data) {
        const code = ticket.form_code || 'unknown';
        if (!grouped.has(code)) grouped.set(code, []);
        grouped.get(code)!.push(ticket);
    }

    for (const [formCode, tickets] of grouped) {
        const sheetName = formCode.slice(0, 31);
        XLSX.utils.book_append_sheet(workbook, buildSheet(tickets), sheetName);
    }

    const timestamp = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(workbook, `คำร้อง_${timestamp}.xlsx`);
}
