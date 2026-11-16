import * as XLSX from 'xlsx';
import { adminGetReviewChanges, adminGetReviews, adminListRoleItems, adminListUserRoles } from '../api';
import { SYSTEM_META, formatThaiDate } from '../components';
import type { AdminRoleItem, AdminUserRole, Cycle, ReviewChangeLine, ReviewChanges, RoleItem, SystemCode } from '../types';

/**
 * "Master ข้อมูลทบทวนรอบ {ชื่อรอบ}" — the cycle's outcome as a workbook IT can apply to the master data:
 *   Transaction       one row per change (ถอดกลุ่ม / ถอดสิทธิ์ / เพิ่มสิทธิ์ / เพิ่มกลุ่ม), old master + these rows = new master
 *   Master หลังทบทวน  one row per person × role, the role assignment after the review
 * plus exportPersonMaster below: the whole item-level master per person after the review, one sheet per system.
 * Built from existing admin endpoints (reviews/{id}/changes, user-roles, roles/{id}/items) — no new backend endpoint.
 */

type Action = 'REMOVE_ROLE' | 'REMOVE_ITEM' | 'ADD_ITEM' | 'ADD_ROLE';

const ACTION_LABEL: Record<Action, string> = {
    REMOVE_ROLE: 'ถอดทั้งกลุ่มสิทธิ์',
    REMOVE_ITEM: 'ถอดสิทธิ์',
    ADD_ITEM: 'เพิ่มสิทธิ์',
    ADD_ROLE: 'เพิ่มกลุ่มสิทธิ์',
};

const STATUS_LABEL: Record<string, string> = {
    not_started: 'ยังไม่เริ่ม', draft: 'ยังไม่ส่ง', pending: 'รออนุมัติ', approved: 'อนุมัติแล้ว', rejected: 'ไม่อนุมัติ',
};

/** Runs fn over items with at most `limit` requests in flight (one changes call per review). */
async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
    const out: R[] = new Array(items.length);
    let next = 0;
    const worker = async () => {
        while (next < items.length) {
            const i = next++;
            out[i] = await fn(items[i]);
        }
    };
    await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
    return out;
}

function sheet(headers: string[], rows: (string | number)[][], widths: number[]) {
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    ws['!cols'] = widths.map(wch => ({ wch }));
    ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: rows.length, c: headers.length - 1 } }) };
    return ws;
}

/** Windows forbids \ / : * ? " < > | in file names; a cycle name like "รอบ 1/2569" would break the download. */
const fileName = (cycle: Cycle, ext: string) =>
    `Master ข้อมูลทบทวนรอบ ${cycle.name.replace(/[\\/:*?"<>|]+/g, '-').trim()}_${new Date().toISOString().slice(0, 10)}.${ext}`;

/** Changes of the cycle's approved reviews (+ pending when asked) — the only ones whose result counts. */
async function loadReviews(cycle: Cycle, includePending: boolean) {
    const { items } = await adminGetReviews({ cycle_id: cycle.id });
    const wanted = items.filter(r => r.review_id != null && (r.status === 'approved' || (includePending && r.status === 'pending')));
    const reviews: ReviewChanges[] = await mapLimit(wanted, 6, r => adminGetReviewChanges(r.review_id!));
    return { rows: items, reviews };
}

export async function exportCycleMaster(cycle: Cycle, includePending: boolean) {
    const { reviews } = await loadReviews(cycle, includePending);

    const tx: (string | number)[][] = [];
    const master: (string | number)[][] = [];

    for (const rv of reviews) {
        const p = rv.requester;
        const person = [p.employee_id, p.name, p.department ?? '', p.division ?? ''];
        const status = STATUS_LABEL[rv.status] ?? rv.status;
        const push = (action: Action, system: string, account: string, roleId: number, roleName: string, it: RoleItem | null, note: string, itDone: string) => {
            tx.push([
                tx.length + 1, rv.review_id, status, ...person,
                system, account, roleId, roleName,
                action, ACTION_LABEL[action],
                it?.id ?? '', it?.category ?? '', it?.item ?? '', it?.permission ?? '',
                note, rv.requester_note ?? '', rv.comment ?? '', rv.decided_by_name ?? '', formatThaiDate(rv.decided_at), itDone,
            ]);
        };

        for (const l of rv.lines) {
            const system = SYSTEM_META[l.system_code]?.label ?? l.system_code;
            const account = l.account_name ?? '';
            if (l.change === 'role') {
                push('REMOVE_ROLE', system, account, l.role_id, l.role_name, null, l.note ?? '', l.user_role_active ? '' : 'ปิดแล้ว');
            } else {
                for (const it of l.removed) push('REMOVE_ITEM', system, account, l.role_id, l.role_name, it, l.note ?? '', '');
            }
            for (const it of l.requested ?? []) push('ADD_ITEM', system, account, l.role_id, l.role_name, it, l.note ?? '', '');

            const requested = l.requested?.length ?? 0;
            const result = l.change === 'role' ? 'ถอดทั้งกลุ่ม' : l.change === 'items' ? 'คงไว้ (ถอดบางรายการ)' : 'คงไว้';
            master.push([
                ...person, system, account, l.role_id, l.role_name, result,
                l.before_count, l.change === 'role' ? 0 : l.after_count, l.change === 'role' ? l.before_count : l.removed.length, requested,
                status,
            ]);
        }
        for (const r of rv.requested_roles ?? []) {
            const system = SYSTEM_META[r.system_code]?.label ?? r.system_code;
            push('ADD_ROLE', system, '', r.id, r.name, null, '', '');
            master.push([...person, system, '', r.id, r.name, 'ขอเพิ่มกลุ่ม', 0, '', 0, '', status]);
        }
    }

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, sheet(
        ['ลำดับ', 'เลขที่ทบทวน', 'สถานะ', 'รหัสพนักงาน', 'ชื่อ-สกุล', 'แผนก', 'ฝ่าย', 'ระบบ', 'บัญชี', 'role_id', 'กลุ่มสิทธิ์',
            'Action', 'รายการ', 'role_item_id', 'หมวด', 'เมนู', 'สิทธิ์', 'หมายเหตุ', 'ข้อเสนอแนะ (ผู้แจ้ง)', 'ข้อเสนอแนะ (ผู้อนุมัติ)',
            'ผู้อนุมัติ', 'วันที่อนุมัติ', 'IT ดำเนินการ'],
        tx,
        [7, 11, 11, 13, 24, 20, 20, 11, 20, 8, 26, 13, 16, 11, 18, 26, 14, 24, 28, 28, 20, 14, 13],
    ), 'Transaction');
    XLSX.utils.book_append_sheet(wb, sheet(
        ['รหัสพนักงาน', 'ชื่อ-สกุล', 'แผนก', 'ฝ่าย', 'ระบบ', 'บัญชี', 'role_id', 'กลุ่มสิทธิ์', 'ผลทบทวน',
            'สิทธิ์ก่อน', 'สิทธิ์หลัง', 'ถอด', 'ขอเพิ่ม', 'สถานะ'],
        master,
        [13, 24, 20, 20, 11, 20, 8, 26, 20, 9, 9, 7, 8, 11],
    ), 'Master หลังทบทวน');

    XLSX.writeFile(wb, fileName(cycle, 'xlsx'));
    return { reviews: reviews.length, transactions: tx.length };
}
type Result = 'คงเดิม' | 'คงไว้' | 'ถอด' | 'ขอเพิ่ม';

/** Sheet "Ref คอลัมน์" — what the id and result columns mean, for whoever applies the file in each system. */
const REF_COLUMNS: string[][] = [
    ['คอลัมน์', 'ความหมาย', 'ตัวอย่าง / หมายเหตุ'],
    ['user_role_id', 'รหัส "การถือสิทธิ์" — พนักงาน 1 คน ถือกลุ่มสิทธิ์ 1 กลุ่ม = 1 รหัส (ตาราง ar_user_roles)', 'คนเดียวถือ 3 กลุ่ม = 3 รหัส · ว่าง = ขอเพิ่มกลุ่มใหม่ที่ยังไม่เคยถือ'],
    ['role_id', 'รหัสกลุ่มสิทธิ์ในระบบทบทวนสิทธิ์ (ตาราง ar_roles) — ดูชื่อกลุ่มได้ที่ชีต "Ref กลุ่มสิทธิ์"', 'ทุกคนที่อยู่กลุ่มเดียวกันมี role_id เดียวกัน'],
    ['role_item_id', 'รหัสรายการสิทธิ์ (เมนู / สิทธิ์ / คลังสินค้า) ในกลุ่มนั้น (ตาราง ar_role_items)', 'กลุ่มอีเมลไม่มีรายการย่อย'],
    ['บัญชี', 'ชื่อผู้ใช้ (login) ของพนักงานในระบบนั้น — ใช้ค้นหาคนในระบบต้นทาง', 'ATMS / Winspeed = User ID · อีเมล = ว่าง'],
    ['สถานะทบทวน', 'สถานะใบทบทวนของพนักงานในรอบนี้', 'ยังไม่เริ่ม / ยังไม่ส่ง / รออนุมัติ / อนุมัติแล้ว / ไม่อนุมัติ'],
    ['ผลทบทวน = คงเดิม', 'ยังไม่มีผลทบทวนที่ใช้ได้ (ยังไม่เริ่ม / ยังไม่ส่ง / ไม่อนุมัติ) — คงสิทธิ์ปัจจุบันไว้', 'ไม่ต้องแก้ในระบบ'],
    ['ผลทบทวน = คงไว้', 'ผู้ใช้ติ๊ก "ใช้" และผ่านการอนุมัติ', 'ไม่ต้องแก้ในระบบ'],
    ['ผลทบทวน = ถอด', 'ผู้ใช้เอาติ๊กออก (ทั้งกลุ่ม หรือเฉพาะรายการ) และผ่านการอนุมัติ', 'IT ถอดสิทธิ์นี้ในระบบต้นทาง'],
    ['ผลทบทวน = ขอเพิ่ม', 'ผู้ใช้ขอเพิ่มเมนู / คลังสินค้า / กลุ่มอีเมล และผ่านการอนุมัติ', 'IT เพิ่มสิทธิ์นี้ในระบบต้นทาง'],
    ['ใช้งานหลังทบทวน', 'Y = ต้องมีสิทธิ์นี้หลังทบทวน · N = ต้องไม่มี', 'แถว Y ทั้งหมดของ 1 คน = master ใหม่ของคนนั้น'],
];

/**
 * Master รายคน (Excel) — the full master after the review, one row per person × permission item, one sheet
 * per system (Email groups have no items → one row per group), plus two Ref sheets that explain the ids.
 * Everyone holding a role is included; people whose review does not count yet keep their current items as
 * "คงเดิม". "ใช้งานหลังทบทวน" (Y/N) is the new master; the ids let it be matched back without relying on names.
 */
export async function exportPersonMaster(cycle: Cycle, includePending: boolean) {
    const [{ rows: reviewRows, reviews }, userRoles] = await Promise.all([
        loadReviews(cycle, includePending),
        (async () => {
            const all: AdminUserRole[] = [];
            for (let page = 1; ; page++) {
                const res = await adminListUserRoles({ include_inactive: true, page, page_size: 500 });
                all.push(...res.items);
                if (all.length >= res.total || res.items.length === 0) return all;
            }
        })(),
    ]);

    const statusOf = new Map(reviewRows.map(r => [r.employee_id, STATUS_LABEL[r.status] ?? r.status]));
    const lineOf = new Map<number, ReviewChangeLine>();
    for (const rv of reviews) for (const l of rv.lines) lineOf.set(l.user_role_id, l);

    // IT may already have closed a removed role — keep it in the file (as ถอด) only when this cycle's review removed it.
    const holdings = userRoles.filter(u => (u.is_active && u.role_is_active !== false) || lineOf.has(u.id));
    const itemsOf = new Map<number, AdminRoleItem[]>();
    await mapLimit([...new Set(holdings.map(u => u.role_id))], 6, async id => { itemsOf.set(id, await adminListRoleItems(id)); });

    type Person = Pick<AdminUserRole, 'employee_id' | 'employee_name' | 'department' | 'division' | 'system_code'>;
    const bySystem = new Map<SystemCode, (string | number)[][]>();
    const roleRef = new Map<number, { system: SystemCode; name: string; holders: Set<string> }>();
    const row = (u: Person, account: string, userRoleId: number | '', roleId: number, roleName: string, it: AdminRoleItem | null, result: Result) => {
        const ref = roleRef.get(roleId) ?? { system: u.system_code, name: roleName, holders: new Set<string>() };
        if (userRoleId !== '') ref.holders.add(u.employee_id);
        roleRef.set(roleId, ref);
        const rows = bySystem.get(u.system_code) ?? [];
        rows.push([
            u.employee_id, u.employee_name, u.department ?? '', u.division ?? '', statusOf.get(u.employee_id) ?? STATUS_LABEL.not_started,
            account, userRoleId, roleId, roleName,
            ...(u.system_code === 'EMAIL' ? [] : [it?.id ?? '', it?.category ?? '', it?.item ?? '', it?.permission ?? '']),
            result, result === 'ถอด' ? 'N' : 'Y',
        ]);
        bySystem.set(u.system_code, rows);
    };

    for (const u of holdings) {
        const line = lineOf.get(u.id);
        const removed = new Set(line?.removed.map(i => i.id));
        const items = itemsOf.get(u.role_id) ?? [];
        const keep: Result = line ? 'คงไว้' : 'คงเดิม';
        const account = u.account_name ?? '';
        if (items.length === 0) row(u, account, u.id, u.role_id, u.role_name, null, line?.change === 'role' ? 'ถอด' : keep);
        for (const it of items) row(u, account, u.id, u.role_id, u.role_name, it, line?.change === 'role' || removed.has(it.id) ? 'ถอด' : keep);
        for (const it of line?.requested ?? []) row(u, account, u.id, u.role_id, u.role_name, it, 'ขอเพิ่ม');
    }
    for (const rv of reviews) {
        const p = rv.requester;
        for (const r of rv.requested_roles ?? []) {
            row({ employee_id: p.employee_id, employee_name: p.name, department: p.department, division: p.division, system_code: r.system_code },
                '', '', r.id, r.name, null, 'ขอเพิ่ม');
        }
    }

    const wb = XLSX.utils.book_new();
    let total = 0;
    for (const code of Object.keys(SYSTEM_META) as SystemCode[]) {
        const rows = bySystem.get(code);
        if (!rows?.length) continue;
        // Person → role, so one person's master reads top to bottom.
        rows.sort((a, b) => String(a[0]).localeCompare(String(b[0])) || String(a[8]).localeCompare(String(b[8]), 'th'));
        total += rows.length;
        const email = code === 'EMAIL';
        XLSX.utils.book_append_sheet(wb, sheet(
            ['รหัสพนักงาน', 'ชื่อ-สกุล', 'แผนก', 'ฝ่าย', 'สถานะทบทวน', 'บัญชี', 'user_role_id', 'role_id', email ? 'กลุ่มอีเมล' : 'กลุ่มสิทธิ์',
                ...(email ? [] : ['role_item_id', 'หมวด', 'เมนู', 'สิทธิ์']), 'ผลทบทวน', 'ใช้งานหลังทบทวน'],
            rows,
            [13, 24, 20, 20, 12, 20, 12, 9, 28, ...(email ? [] : [12, 18, 28, 14]), 11, 15],
        ), SYSTEM_META[code].label);
    }
    XLSX.utils.book_append_sheet(wb, sheet(REF_COLUMNS[0], REF_COLUMNS.slice(1), [20, 70, 50]), 'Ref คอลัมน์');
    const refRoles = [...roleRef.entries()]
        .map(([id, r]) => [id, SYSTEM_META[r.system]?.label ?? r.system, r.name, itemsOf.get(id)?.length ?? '', r.holders.size])
        .sort((a, b) => String(a[1]).localeCompare(String(b[1])) || String(a[2]).localeCompare(String(b[2]), 'th'));
    XLSX.utils.book_append_sheet(wb, sheet(['role_id', 'ระบบ', 'กลุ่มสิทธิ์', 'จำนวนรายการสิทธิ์', 'จำนวนผู้ถือ'], refRoles, [9, 12, 36, 16, 12]), 'Ref กลุ่มสิทธิ์');

    XLSX.writeFile(wb, fileName(cycle, 'xlsx').replace(/\.xlsx$/, ' (รายคน).xlsx'));
    return { people: new Set([...bySystem.values()].flat().map(r => r[0])).size, rows: total };
}
