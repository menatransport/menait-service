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


type ClosedInfo = { closed_at: string | null; closed_by: string | null };

type FormSubmitLog = {
    action: string;
    field_name: string;
    old_value: string | null;
    new_value: string;
    action_by: string;
    action_at: string;
};

// ดึงข้อมูล "วันที่ปิดเคส/ผู้ปิดเคส" จาก log การเปลี่ยนสถานะ เนื่องจาก API รายการคำร้อง ไม่มี field นี้มาให้โดยตรง
async function fetchClosedInfoMap(tickets: Ticket[]): Promise<Map<string, ClosedInfo>> {
    const map = new Map<string, ClosedInfo>();
    await Promise.all(tickets.map(async (ticket) => {
        try {
            const res = await fetch(`/api/formsubmit-log?form_id=${ticket.form_id}`);
            const logs = await res.json();
            if (!Array.isArray(logs)) return;
            const closeLogs = (logs as FormSubmitLog[]).filter(
                (l) => l.action === 'STATUS_CHANGE' && l.new_value === 'Done'
            );
            const lastClose = closeLogs[closeLogs.length - 1];
            if (lastClose) {
                map.set(ticket.form_id, { closed_at: lastClose.action_at, closed_by: lastClose.action_by });
            }
        } catch {
            // ไม่พบ log ก็ปล่อยว่าง ไม่ให้กระทบ export รายการอื่น
        }
    }));
    return map;
}

export async function exportToExcel_Submissions(data: Ticket[]) {
    const workbook = XLSX.utils.book_new();
    const closedInfoMap = await fetchClosedInfoMap(data);

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
        { header: 'วันที่ปิดเคส', key: (r) => { const c = closedInfoMap.get(r.form_id)?.closed_at; return c ? new Date(c).toLocaleDateString('th-TH') : ''; }, width: 16 },
        { header: 'ผู้ปิดเคส', key: (r) => closedInfoMap.get(r.form_id)?.closed_by || '-', width: 18 },
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
        const constantMap = {
            it_equipment_request: 'เบิกอุปกรณ์ด้าน IT',
            request_mouse: 'ขอเบิก Mouse',
            request_keyboard: 'ขอเบิก Keyboard',
            request_printer_ink: 'ขอเบิก หมึก Printer',
            install_uninstall_program: 'ขอติดตั้ง/ขอลบ โปรแกรม',
            ms_office_issue: 'ปัญหาการใช้งาน Microsoft Office',
            vpn_issue: 'ปัญหาการใช้งาน VPN',
            grab_access: 'ขอสิทธิ/ปัญหาการใช้งาน Grab',
            'สร้างคลัง ใน ATMS': 'สร้างคลัง ใน ATMS',
            'สร้างสินค้า ใน ATMS': 'สร้างสินค้า ใน ATMS',
            line_issue: 'ปัญหาการใช้งาน LINE',
            atms_issue: 'ปัญหาการใช้งาน ATMS',
            winspeed_issue: 'ปัญหาการใช้งาน Winspeed',
            google_drive_issue: 'ปัญหาการใช้งาน Google Drive (G)',
            internet_wifi_issue: 'ปัญหาการใช้งาน Internet/WiFi',
            password_locked: 'Password Locked / ลืมรหัสผ่าน',
            print_scan_issue: 'ปัญหาการใช้งาน Print/Scan',
            website_update: 'อัพเดท/แก้ไข Website',
            group_mail_access: 'ขอสิทธิ Group Mail',
            meeting_room_setup: 'จัดเตรียมห้องประชุม/อาคารสถานที่',
            share_drive_issue: 'ปัญหาการใช้งาน Share Drive',
            ad_system_issue: 'ระบบ AD ขัดข้อง',
            it_equipment_damage: 'อุปกรณ์ด้าน IT ชำรุดหรือเสียหาย',
            google_meet_issue: 'ปัญหาการใช้งาน Google Meet',
            install_print_scan: 'ขอติดตั้ง Print/Scan',
            atms_add_branch: 'เพิ่มคลัง/สาขา ใน ATMS',
            atms_add_data: 'สร้าง/เพิ่ม ข้อมูล ใน ATMS',
            wifi_guest_access: 'ขอสิทธิใช้งาน WiFi Guest',
            'ปัญหาการใช้งาน  E-Mail': 'ปัญหาการใช้งาน  E-Mail'
        } as Record<string, string>;

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
                const raw = getFormValueDisplay(v);
                const display = v.question_name === 'sub_name'
                    ? (constantMap[raw] ?? raw)
                    : raw;
                valuesMap.set(v.question_name, display);
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
