// Formal A4 report of one ticket (คำร้อง) — opened in a new window and sent to the
// browser's print dialog, so "Save as PDF" keeps Thai text shaping intact without
// embedding fonts in a JS PDF library.
import type { Ticket } from "@/app/mytickets/[id]/page";
import type { Question, formSubmitLog } from "@/app/service/[[...slug]]/page";

type ReportInput = {
    ticket: Ticket;
    detail?: { status_approve?: string; remark?: string; form_type?: string } | null;
    questions: Question[];
    formValues: Record<string, any>;
    logs: formSubmitLog[];
    imageUrls: string[];
    adminComment: string;
};

const STATUS_TH: Record<string, string> = {
    'Open': 'เปิดคำร้อง',
    'In Progress': 'กำลังดำเนินการ',
    'Coordinate': 'ส่งประสานงาน',
    'Done': 'ดำเนินการเสร็จสิ้น',
    'Backlog': 'Backlog',
    'Rejected': 'ปฏิเสธคำร้อง',
};

const APPROVE_TH: Record<string, string> = {
    'Approved': 'อนุมัติแล้ว',
    'In Progress': 'รออนุมัติ',
    'Rejected': 'ไม่อนุมัติ',
};

const esc = (v: unknown): string =>
    String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

const dash = (v: unknown) => {
    const s = String(v ?? '').trim();
    return s ? esc(s) : '-';
};

const fmtDateTime = (d?: string | null) => {
    if (!d) return '-';
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return esc(d);
    return dt.toLocaleString('th-TH', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }) + ' น.';
};

const fmtDate = (d: string) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d);
    const dt = m ? new Date(+m[1], +m[2] - 1, +m[3]) : new Date(d);
    if (isNaN(dt.getTime())) return esc(d);
    return dt.toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' });
};

const formatAnswer = (q: Question, raw: any): string => {
    if (raw === null || raw === undefined || raw === '' || (Array.isArray(raw) && raw.length === 0)) return '-';
    const labelOf = (v: string) => q.options?.find(o => o.value === v)?.label ?? v;
    switch (q.type) {
        case 'multiselect':
            return (Array.isArray(raw) ? raw : String(raw).split(','))
                .map(v => `<div class="li">• ${esc(labelOf(String(v).trim()))}</div>`).join('');
        case 'dropdown':
            return esc(labelOf(String(raw)));
        case 'datetime':
        case 'date':
            return fmtDate(String(raw));
        case 'checkbox':
        case 'boolean':
            return raw === true || raw === 'true' ? 'ใช่' : 'ไม่ใช่';
        default:
            return esc(raw);
    }
};

const logLabel = (log: formSubmitLog) => {
    if (log.action === 'STATUS_CHANGE') {
        return log.new_value === 'Open' ? 'สร้างคำร้อง'
            : log.new_value === 'Done' ? 'ปิดคำร้อง'
            : `เปลี่ยนสถานะเป็น "${STATUS_TH[log.new_value] ?? log.new_value}"`;
    }
    if (log.action === 'UPDATE_VALUE') return 'แก้ไขข้อมูลแบบฟอร์ม';
    return log.action;
};

const kvRows = (rows: [string, string][]) =>
    rows.map(([k, v]) => `<tr><th>${esc(k)}</th><td>${v}</td></tr>`).join('');

export const buildTicketReportHtml = (input: ReportInput, origin: string): string => {
    const { ticket, detail, questions, formValues, logs, imageUrls, adminComment } = input;
    const needsApproval = detail?.form_type !== 'Issue';
    const approver = `${ticket.action_by_firstname ?? ''} ${ticket.action_by_lastname ?? ''}`.trim();
    const requester = `${ticket.firstname ?? ''} ${ticket.lastname ?? ''}`.trim();
    const approveStatus = detail?.status_approve ?? ticket.status_approve;
    const printedAt = fmtDateTime(new Date().toISOString());

    const infoRows: [string, string][] = [
        ['เลขที่คำร้อง', `<b>${dash(ticket.form_id)}</b>`],
        ['แบบฟอร์ม', `${dash(ticket.form_name)} <span class="muted">(${dash(ticket.form_code)})</span>`],
        ['วันที่ยื่นคำร้อง', fmtDateTime(ticket.created_at)],
        ['สถานะคำร้อง', `<span class="tag">${esc(STATUS_TH[ticket.status] ?? ticket.status)}</span>`],
        ...(needsApproval ? [
            ['ผลการอนุมัติ', approveStatus ? `<span class="tag">${esc(APPROVE_TH[approveStatus] ?? approveStatus)}</span>` : '-'],
            ['ผู้อนุมัติ', dash(approver)],
            ['วันที่อนุมัติ', ticket.action_at ? fmtDateTime(ticket.action_at) : '-'],
            ['หมายเหตุการอนุมัติ', dash(detail?.remark ?? ticket.remark)],
        ] as [string, string][] : []),
    ];

    const requesterRows: [string, string][] = [
        ['ชื่อ - นามสกุล', dash(requester)],
        ['รหัสพนักงาน', dash(ticket.created_by)],
        ['ฝ่าย / แผนก', dash(ticket.department_name_th)],
        ['อีเมล', dash(ticket.email || ticket.created_by_email)],
    ];

    const answerRows = questions.map((q, i) => `
        <tr>
            <td class="c">${i + 1}</td>
            <td>${esc(q.label)}</td>
            <td class="ans">${formatAnswer(q, formValues[q.name])}</td>
        </tr>`).join('');

    const images = imageUrls.length ? `
        <div class="images">
            ${imageUrls.map((u, i) => `<figure><img src="${esc(u)}" alt="ไฟล์แนบ ${i + 1}"/><figcaption>ไฟล์แนบ ${i + 1}</figcaption></figure>`).join('')}
        </div>` : '';

    const logRows = logs.length
        ? logs.map((l, i) => `
            <tr>
                <td class="c">${i + 1}</td>
                <td>${fmtDateTime(l.action_at?.endsWith('Z') ? l.action_at : `${l.action_at}Z`)}</td>
                <td>${esc(logLabel(l))}</td>
                <td>${dash(l.action_by)}</td>
            </tr>`).join('')
        : `<tr><td class="c">1</td><td>${fmtDateTime(ticket.created_at)}</td><td>สร้างคำร้อง</td><td>${dash(ticket.created_by)}</td></tr>`;

    let sec = 0;
    const h = (t: string) => `<h2><span>${++sec}.</span> ${t}</h2>`;

    return `<!doctype html>
<html lang="th">
<head>
<meta charset="utf-8"/>
<title>รายงานคำร้อง_${esc(ticket.form_id)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
<link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;500;600;700&display=swap" rel="stylesheet"/>
<style>
    @page { size: A4; margin: 12mm; }
    * { box-sizing: border-box; }
    html, body { margin: 0; background: #e5e7eb; color: #111827; font-family: 'Sarabun', 'Noto Sans Thai', sans-serif; font-size: 10pt; line-height: 1.45; }
    .toolbar { position: sticky; top: 0; z-index: 5; display: flex; justify-content: center; gap: 8px; padding: 10px; background: #1f2937; }
    .toolbar button { font: 600 13px Sarabun, sans-serif; padding: 7px 18px; border-radius: 6px; border: 1px solid #4b5563; background: #374151; color: #fff; cursor: pointer; }
    .toolbar button.primary { background: #1c6ef2; border-color: #1c6ef2; }
    .page { width: 210mm; height: 297mm; overflow: hidden; margin: 16px auto; padding: 12mm; background: #fff; box-shadow: 0 1px 6px rgba(0,0,0,.15); }
    header { display: flex; align-items: center; gap: 14px; padding-bottom: 8px; border-bottom: 2px solid #1c3f7a; }
    header img { height: 46px; }
    header .org { flex: 1; }
    header .org b { display: block; font-size: 13pt; color: #1c3f7a; }
    header .org span { font-size: 9.5pt; color: #4b5563; }
    header .docno { text-align: right; font-size: 9pt; color: #4b5563; }
    header .docno b { display: block; font-size: 11pt; color: #111827; }
    .title { text-align: center; margin: 10px 0 2px; }
    .title h1 { margin: 0; font-size: 16pt; font-weight: 700; letter-spacing: .2px; }
    .title p { margin: 2px 0 0; color: #4b5563; font-size: 11pt; }
    h2 { margin: 12px 0 5px; font-size: 11.5pt; font-weight: 700; color: #1c3f7a; padding-bottom: 3px; border-bottom: 1px solid #cbd5e1; }
    h2 span { color: #1c3f7a; }
    table { width: 100%; border-collapse: collapse; }
    .kv th, .kv td { padding: 3px 8px; border: 1px solid #d1d5db; vertical-align: top; text-align: left; }
    .kv th { width: 30%; background: #f3f4f6; font-weight: 600; color: #374151; }
    .grid th, .grid td { padding: 3px 8px; border: 1px solid #d1d5db; vertical-align: top; text-align: left; }
    .grid thead th { background: #1c3f7a; color: #fff; font-weight: 600; }
    .grid tbody tr:nth-child(even) td { background: #f9fafb; }
    .grid .c { text-align: center; width: 9mm; }
    .ans { white-space: pre-wrap; word-break: break-word; }
    .li { white-space: normal; }
    .muted { color: #6b7280; }
    .tag { display: inline-block; padding: 0 8px; border: 1px solid #9ca3af; border-radius: 3px; font-size: 9.5pt; font-weight: 600; }
    .note { min-height: 10mm; padding: 6px 8px; border: 1px solid #d1d5db; white-space: pre-wrap; }
    .images { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px; }
    .images figure { margin: 0; width: calc(33.33% - 6px); border: 1px solid #d1d5db; padding: 4px; break-inside: avoid; }
    .images img { width: 100%; height: 30mm; object-fit: contain; background: #f9fafb; }
    .images figcaption { text-align: center; font-size: 8.5pt; color: #6b7280; }
    footer { margin-top: 12px; padding-top: 6px; border-top: 1px solid #e5e7eb; font-size: 8.5pt; color: #6b7280; display: flex; justify-content: space-between; }
    tr, .kv, h2 { break-inside: avoid; }
    h2 { break-after: avoid; }
    @media print {
        html, body { background: #fff; }
        .toolbar { display: none; }
        .page { width: auto; height: 273mm; margin: 0; padding: 0; box-shadow: none; }
        * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
</style>
</head>
<body>
<div class="toolbar">
    <button class="primary" onclick="window.print()">บันทึก PDF / พิมพ์</button>
    <button onclick="window.close()">ปิด</button>
</div>
<div class="page"><div class="sheet">
    <header>
        <img src="${origin}/mena.png" alt="MENA"/>
        <div class="org">
            <b>บริษัท มีนาทรานสปอร์ต จำกัด (มหาชน)</b>
            <span>MENA Transport Public Company Limited · ระบบบริการงานเทคโนโลยีสารสนเทศ (menaIT)</span>
        </div>
        <div class="docno">เลขที่คำร้อง<b>${esc(ticket.form_id)}</b></div>
    </header>

    <div class="title">
        <h1>รายงานรายละเอียดคำร้อง</h1>
        <p>${esc(ticket.form_name)}</p>
    </div>

    ${h('ข้อมูลผู้ยื่นคำร้อง')}
    <table class="kv"><tbody>${kvRows(requesterRows)}</tbody></table>

    ${h('ข้อมูลคำร้อง')}
    <table class="kv"><tbody>${kvRows(infoRows)}</tbody></table>

    ${h('รายละเอียดตามแบบฟอร์ม')}
    <table class="grid">
        <thead><tr><th class="c">ลำดับ</th><th style="width:38%">หัวข้อ</th><th>ข้อมูลที่ระบุ</th></tr></thead>
        <tbody>${answerRows || '<tr><td colspan="3" class="c" style="width:auto">ไม่พบข้อมูลแบบฟอร์ม</td></tr>'}</tbody>
    </table>
    ${images}

    ${h('หมายเหตุจากฝ่าย IT')}
    <div class="note">${dash(adminComment)}</div>

    ${h('ประวัติการดำเนินการ')}
    <table class="grid">
        <thead><tr><th class="c">ลำดับ</th><th style="width:34%">วันที่ / เวลา</th><th>การดำเนินการ</th><th style="width:22%">ผู้ดำเนินการ</th></tr></thead>
        <tbody>${logRows}</tbody>
    </table>


    <footer>
        <span>เอกสารนี้จัดทำจากระบบ menaIT</span>
        <span>พิมพ์เมื่อ ${printedAt}</span>
    </footer>
</div></div>
<script>
    // Shrink the whole sheet when it is taller than one A4 page (186 x 273mm printable),
    // keeping full width: lay out at 186/scale mm wide, then zoom by scale. Widening
    // reflows the text shorter, so refine the scale a few times before applying it.
    function fitOnePage() {
        var sheet = document.querySelector('.sheet');
        var avail = 270 * 96 / 25.4; // 3mm slack for zoom rounding
        var scale = 1;
        sheet.style.zoom = 1;
        sheet.style.width = '';
        if (sheet.scrollHeight <= avail) return;
        for (var i = 0; i < 4; i++) {
            sheet.style.width = (186 / scale) + 'mm';
            scale = Math.min(1, avail / sheet.scrollHeight);
        }
        sheet.style.width = (186 / scale) + 'mm';
        sheet.style.zoom = Math.min(scale, avail / sheet.scrollHeight);
    }
    // Wait for the Thai font and images so the PDF never captures fallback glyphs.
    window.addEventListener('load', function () {
        (document.fonts ? document.fonts.ready : Promise.resolve()).then(function () {
            fitOnePage();
            setTimeout(function () { window.print(); }, 200);
        });
    });
</script>
</body>
</html>`;
};

/** Opens the report in a new tab and triggers the print dialog. Returns false if the popup was blocked. */
export const openTicketReport = (input: ReportInput): boolean => {
    const win = window.open('', '_blank');
    if (!win) return false;
    win.document.open();
    win.document.write(buildTicketReportHtml(input, window.location.origin));
    win.document.close();
    return true;
};
