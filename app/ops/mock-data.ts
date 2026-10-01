import type { OpsComment, OpsPerson, OpsPriority, OpsReview, OpsStatus, OpsStatusChange, Project, ProjectIssue } from './types';

/**
 * Demo rows used while the backend is not ready (see USE_MOCK in ./api.ts).
 * Dates are relative to today so the Gantt always has bars around "now".
 * Some rows are attributed to the signed-in user so "ของฉัน" has data.
 */

// OPS team snapshots — names/photos are replaced by the live IT-system profile (see team.ts)
const team = (username: string): OpsPerson => ({ employee_id: username, username, name: username, image_url: null });
const NARONGKORN = team('narongkorn.a');
const SUTIWAT = team('sutiwat.c');
const PATCHARAPAN = team('patcharapan.p');
const KITTABOON = team('kittaboon.l');
const IT_OWNER = NARONGKORN;
const DISPATCH: OpsPerson = { employee_id: 'OP042', name: 'สมศรี ขนส่งดี', department: 'Operation', position: 'Dispatcher Lead' };
const FLEET: OpsPerson = { employee_id: 'OP077', name: 'ประเสริฐ ยานยนต์', department: 'Fleet', position: 'Fleet Manager' };

const DAY = 86_400_000;
const isoAgo = (d: number) => new Date(Date.now() - d * DAY).toISOString();
/** YYYY-MM-DD, `d` days from today (negative = past) */
const day = (d: number) => {
    const t = new Date(Date.now() + d * DAY);
    return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
};

const history = (steps: [OpsStatus, number, string?][], requester: OpsPerson): OpsStatusChange[] =>
    steps.map(([status, ago, remark], i) => ({
        status,
        changed_at: isoAgo(ago),
        changed_by: i === 0 ? requester : IT_OWNER,
        remark: remark ?? null,
    }));

interface Seed {
    title: string; objective: string; requirement: string; benefit: string;
    users: number; groups: string | null; priority: OpsPriority; reason: string;
    status: OpsStatus; by: OpsPerson; assignees?: OpsPerson[]; progress?: number;
    /** [start, end] in days from today */
    plan?: [number, number]; target?: number; createdAgo: number;
    steps: [OpsStatus, number, string?][];
    review?: OpsReview;
}

const make = (s: Seed, i: number): Project => ({
    project_id: `OPS-${new Date().getFullYear()}-${String(i + 1).padStart(4, '0')}`,
    title: s.title,
    objective: s.objective,
    requirement: s.requirement,
    expected_benefit: s.benefit,
    estimated_users: s.users,
    user_groups: s.groups,
    priority: s.priority,
    priority_reason: s.reason,
    target_date: s.target != null ? day(s.target) : null,
    status: s.status,
    progress: s.progress ?? (s.status === 'Done' ? 100 : null),
    planned_start: s.plan ? day(s.plan[0]) : null,
    planned_end: s.plan ? day(s.plan[1]) : null,
    requested_by: s.by,
    assignees: s.assignees ?? [],
    attachments: [],
    status_history: history(s.steps, s.by),
    review: s.review ?? null,
    issue_count: 0,
    created_at: isoAgo(s.createdAgo),
    updated_at: isoAgo(s.steps[s.steps.length - 1][1]),
});

export function buildSeed(me: OpsPerson): { projects: Project[]; issues: ProjectIssue[] } {
    const seeds: Seed[] = [
        {
            title: 'ระบบใบงาน (Job Order) บนมือถือ',
            objective: 'คนขับต้องถ่ายรูปใบงานกระดาษส่งกลับ ข้อมูลตกหล่นบ่อย',
            requirement: 'คนขับรับงาน ถ่ายรูป POD และเซ็นรับสินค้าผ่านมือถือ',
            benefit: 'ปิดงานได้ทันที ลดเอกสารสูญหาย ลดค่าพิมพ์เอกสารและเวลาคีย์ข้อมูลย้อนหลัง',
            users: 150, groups: 'คนขับรถ, Admin สาขา', priority: 'Critical',
            reason: 'ลูกค้าหลักกำหนดให้ส่ง POD แบบดิจิทัลภายในไตรมาสนี้',
            status: 'Done', by: DISPATCH, assignees: [SUTIWAT, KITTABOON], plan: [-150, -60], target: -55, createdAgo: 170,
            steps: [['Open', 170], ['To-Do', 160], ['In Progress', 150], ['Review', 70], ['Done', 61]],
            review: { result: 'passed', by: DISPATCH, at: isoAgo(62), note: 'ทดสอบกับคนขับ 10 คันแล้ว ใช้งานได้ตามที่ขอ' },
        },
        {
            title: 'ระบบจองคิวรถขนส่งออนไลน์',
            objective: 'ปัจจุบันจองคิวผ่าน LINE และ Excel ทำให้คิวซ้อนและติดตามงานยาก',
            requirement: '1) ลูกค้าเลือกวัน/เวลาที่ต้องการ\n2) Dispatcher อนุมัติคิว\n3) ระบบแจ้งเตือนคนขับอัตโนมัติ',
            benefit: 'ลดคิวซ้อน ติดตามสถานะรถได้แบบ real-time ลดเวลาจัดคิวประมาณ 2 ชม./วัน และลดค่าล่วงเวลา Dispatcher',
            users: 40, groups: 'Dispatcher, คนขับรถ, ลูกค้าองค์กร', priority: 'High',
            reason: 'กระทบการส่งมอบให้ลูกค้ารายใหญ่ทุกวัน',
            status: 'Review', by: me, assignees: [KITTABOON, PATCHARAPAN, NARONGKORN], progress: 60, plan: [-45, 40], target: 45, createdAgo: 70,
            steps: [['Open', 70], ['To-Do', 60], ['In Progress', 45], ['Review', 2]],
        },
        {
            title: 'เชื่อมต่อ GPS Tracking เข้ากับ ATMS',
            objective: 'ต้องเปิด 2 ระบบเพื่อตรวจตำแหน่งรถและสถานะงาน',
            requirement: 'แสดงตำแหน่งรถล่าสุดบนหน้าใบงานใน ATMS',
            benefit: 'ตอบลูกค้าได้ทันทีว่ารถอยู่ที่ไหน ลดสายโทรถามสถานะจากลูกค้า ~30 สาย/วัน',
            users: 60, groups: 'Customer Service, Dispatcher', priority: 'High',
            reason: 'ลูกค้าร้องเรียนเรื่องการติดตามสถานะบ่อย',
            status: 'In Progress', by: DISPATCH, assignees: [NARONGKORN], progress: 35, plan: [-70, -5], target: -10, createdAgo: 95,
            steps: [['Open', 95], ['To-Do', 80], ['In Progress', 70]],
        },
        {
            title: 'แจ้งเตือนต่อทะเบียน/ประกันรถอัตโนมัติ',
            objective: 'เคยมีรถหมดประกันโดยไม่มีใครทราบ',
            requirement: 'แจ้งเตือนทางอีเมลล่วงหน้า 30/15/7 วันก่อนหมดอายุ',
            benefit: 'ไม่มีรถวิ่งโดยไม่มีประกัน หลีกเลี่ยงค่าปรับและความเสียหายกรณีเกิดอุบัติเหตุ',
            users: 5, groups: 'ฝ่ายยานพาหนะ', priority: 'Medium',
            reason: 'ปัจจุบันมีปฏิทินตรวจด้วยมือทดแทนได้',
            status: 'To-Do', by: FLEET, assignees: [SUTIWAT], plan: [20, 65], createdAgo: 25,
            steps: [['Open', 25], ['To-Do', 12]],
        },
        {
            title: 'Dashboard ต้นทุนน้ำมันรายเที่ยว',
            objective: 'ผู้บริหารต้องรอรายงานต้นทุนน้ำมันสิ้นเดือน ไม่เห็นความผิดปกติทันที',
            requirement: 'ดึงข้อมูลเติมน้ำมันจาก Fleet card และเทียบกับระยะทาง GPS แสดงรายเที่ยว/รายคัน',
            benefit: 'เห็นต้นทุนรายวัน ตรวจจับการเติมน้ำมันผิดปกติได้เร็ว คาดว่าลดค่าน้ำมันที่รั่วไหลได้ 3–5% ต่อเดือน',
            users: 12, groups: 'ผู้บริหาร, ฝ่ายบัญชี', priority: 'Medium',
            reason: 'ช่วยควบคุมต้นทุน แต่ยังมีรายงาน Excel ใช้ทดแทนได้',
            status: 'To-Do', by: me, plan: [45, 110], target: 120, createdAgo: 18,
            steps: [['Open', 18], ['To-Do', 6]],
        },
        {
            title: 'แบบฟอร์มตรวจสภาพรถก่อนออกงาน',
            objective: 'ใช้กระดาษ checklist ตรวจย้อนหลังไม่ได้',
            requirement: 'คนขับติ๊ก checklist + ถ่ายรูปก่อนออกงาน หัวหน้าเห็นรายการที่ไม่ผ่านทันที',
            benefit: 'ลดรถเสียระหว่างทาง ลดค่าซ่อมฉุกเฉินและค่าปรับส่งช้า',
            users: 150, groups: 'คนขับรถ, หัวหน้าสาขา', priority: 'High',
            reason: 'เกี่ยวข้องกับความปลอดภัย',
            status: 'Open', by: me, assignees: [PATCHARAPAN], target: 75, createdAgo: 3,
            steps: [['Open', 3]],
        },
        {
            title: 'ระบบเบิกค่าทางด่วน/ค่าน้ำมันสำรองจ่าย',
            objective: 'คนขับต้องเก็บใบเสร็จส่งบัญชีทุกสัปดาห์ ตกหล่นบ่อย',
            requirement: 'ถ่ายรูปใบเสร็จผ่านมือถือ หัวหน้าอนุมัติ บัญชีดึงรายงานได้',
            benefit: 'เบิกได้เร็วขึ้น ตรวจสอบได้ ลดงานคีย์ของบัญชี ~1 วัน/สัปดาห์',
            users: 160, groups: 'คนขับรถ, บัญชี', priority: 'Low',
            reason: 'ยังใช้วิธีเดิมได้',
            status: 'Open', by: FLEET, createdAgo: 1,
            steps: [['Open', 1]],
        },
        {
            title: 'ย้ายไฟล์ Excel สต็อกยางไปเป็นระบบ',
            objective: 'ต้องการเลิกใช้ไฟล์ Excel ที่แชร์กันหลายคน',
            requirement: 'บันทึกรับ-จ่ายยางรายคัน',
            benefit: 'ข้อมูลไม่ชนกัน ลดเวลาทำงานเล็กน้อย',
            users: 3, groups: null, priority: 'Low', reason: 'ไม่เร่งด่วน',
            status: 'Reject', by: me, createdAgo: 60,
            steps: [['Open', 60], ['Reject', 55, 'ใช้โมดูล Inventory ใน ERP ที่มีอยู่แล้วได้ — IT จะช่วยตั้งค่าให้']],
        },
    ];

    const projects = seeds.map(make);
    const byTitle = (t: string) => projects.find(p => p.title === t)!;
    const jobOrder = byTitle('ระบบใบงาน (Job Order) บนมือถือ');
    const booking = byTitle('ระบบจองคิวรถขนส่งออนไลน์');

    const issues: ProjectIssue[] = [
        {
            issue_id: `ISS-${new Date().getFullYear()}-0001`,
            project_id: jobOrder.project_id,
            project_title: jobOrder.title,
            project_assignees: jobOrder.assignees,
            description: 'กดบันทึกใบงานแล้วขึ้น Error 500 ทุกครั้งที่แนบรูปเกิน 2 รูป คาดว่าควรบันทึกได้ตามปกติ',
            status: 'Review', reported_by: me, attachments: [],
            status_history: history([['Open', 5], ['In Progress', 3], ['Review', 1]], me),
            created_at: isoAgo(5), updated_at: isoAgo(3),
        },
        {
            issue_id: `ISS-${new Date().getFullYear()}-0002`,
            project_id: booking.project_id,
            project_title: booking.title,
            project_assignees: booking.assignees,
            description: 'หน้าเลือกเวลาแสดงเวลาเป็น UTC ทำให้คิวเลื่อนไป 7 ชั่วโมง',
            status: 'Done', reported_by: me, attachments: [],
            status_history: history([['Open', 12], ['In Progress', 11], ['Done', 9]], me),
            created_at: isoAgo(12), updated_at: isoAgo(9),
        },
        {
            issue_id: `ISS-${new Date().getFullYear()}-0003`,
            project_id: jobOrder.project_id,
            project_title: jobOrder.title,
            project_assignees: jobOrder.assignees,
            description: 'ลายเซ็นลูกค้าบน iPhone บางรุ่นบันทึกเป็นภาพว่าง',
            status: 'Open', reported_by: DISPATCH, attachments: [],
            status_history: history([['Open', 1]], DISPATCH),
            created_at: isoAgo(1), updated_at: isoAgo(1),
        },
        {
            issue_id: `ISS-${new Date().getFullYear()}-0004`,
            project_id: booking.project_id,
            project_title: booking.title,
            project_assignees: booking.assignees,
            description: 'อยากให้เพิ่มปุ่ม Export คิวเป็น Excel',
            status: 'Reject', reported_by: me, attachments: [],
            status_history: history([['Open', 20], ['Reject', 18, 'เป็นคำขอฟีเจอร์ใหม่ — กรุณายื่นผ่าน Project Request']], me),
            created_at: isoAgo(20), updated_at: isoAgo(18),
        },
    ];

    return { projects, issues };
}

/** Stored shape: who liked it, so the count and "liked by me" can be derived per viewer. */
export type MockComment = Omit<OpsComment, 'like_count' | 'liked_by_me'> & { liked_by: string[] };

export function buildCommentSeed({ projects, issues }: { projects: Project[]; issues: ProjectIssue[] }): MockComment[] {
    const booking = projects.find(p => p.title === 'ระบบจองคิวรถขนส่งออนไลน์');
    const checklist = projects.find(p => p.title === 'แบบฟอร์มตรวจสภาพรถก่อนออกงาน');
    const issue = issues[0];
    const c = (ref_type: 'project' | 'issue', ref_id: string, author: OpsPerson, body: string, minutesAgo: number, liked_by: string[]): MockComment => ({
        comment_id: `cmt-seed-${ref_id}-${minutesAgo}`, ref_type, ref_id, author, body,
        created_at: new Date(Date.now() - minutesAgo * 60_000).toISOString(), liked_by,
    });
    return [
        ...(booking ? [
            c('project', booking.project_id, NARONGKORN, 'ออกแบบหน้าจองคิวเสร็จแล้ว รอ Dispatcher ทดสอบรอบแรกสัปดาห์หน้าครับ', 60 * 26, ['OP042', 'sutiwat.c']),
            c('project', booking.project_id, DISPATCH, 'ขอให้มีปุ่มยกเลิกคิวฝั่งลูกค้าด้วยนะคะ', 60 * 5, ['narongkorn.a']),
            c('project', booking.project_id, KITTABOON, 'รับเรื่องครับ จะเพิ่มในรอบ UAT', 40, []),
        ] : []),
        ...(checklist ? [
            c('project', checklist.project_id, PATCHARAPAN, 'ขอตัวอย่าง checklist กระดาษที่ใช้อยู่ด้วยค่ะ จะได้ทำฟอร์มให้ตรง', 90, []),
        ] : []),
        ...(issue ? [
            c('issue', issue.issue_id, SUTIWAT, 'เจอสาเหตุแล้ว ไฟล์รูปรวมเกินขนาดที่ server รับ กำลังแก้ครับ', 60 * 20, ['E001']),
        ] : []),
    ];
}
