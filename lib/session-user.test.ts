import { describe, expect, test } from 'bun:test';
import type { UserInfo } from '@/app/context/SessionContext';
import { buildSessionUser, diffSessionUser } from './session-user';

const ENV = { FINANCE_DEPARTMENT_IDS: '4,6', FINANCE_EMPLOYEE_IDS: '' };

const be = (over: Record<string, unknown> = {}) => ({
  id: 1, username: 'u', firstname: 'สมชาย', lastname: 'ใจดี', employee_id: '600123', site: 'Saraburi', site_id: 3,
  department: 'Procurement', department_id: 5, position: 'Procurement Officer', position_level: 'Officer',
  position_level_id: 1, image_url: null, last_login: '2026-10-12T08:00:00', employee_status: 'Active',
  path: { path_id: 3, path_code: 'CM', path_th: 'สายงานธุรกิจ', path_eng: 'Comercial' },
  division: { division_id: 23, division_code: 'SPR', division_th: 'ฝ่ายจัดซื้อกลยุทธ์', division_eng: 'Strategic Procurement' },
  department_th: 'แผนกสโตร์',
  ...over,
}) as never;

const session = (over: Record<string, unknown> = {}) => buildSessionUser(be(over), ENV);

describe('buildSessionUser — same rules login always used', () => {
  test('IT department → admin', () => expect(session({ department_id: 21 }).role).toBe('a'));
  test('named employee → admin', () => expect(session({ employee_id: '680043' }).role).toBe('a'));
  test('everyone else → user', () => expect(session().role).toBe('u'));
  test('finance department', () => expect(session({ department_id: 6 }).is_finance).toBe(true));
  test('not finance', () => expect(session().is_finance).toBe(false));
  test('no department', () => {
    const u = session({ department_id: null });
    expect([u.role, u.is_finance]).toEqual(['u', false]);
  });
  test('keeps every BE field', () => expect(session().department_th).toBe('แผนกสโตร์'));
});

describe('buildSessionUser — petty cash back office (บัญชีตรวจเอกสาร / การเงินปิดรอบ)', () => {
  const BACK_OFFICE = { ...ENV, ACCOUNTING_DEPARTMENT_IDS: '6', TREASURY_DEPARTMENT_IDS: '4', TREASURY_EMPLOYEE_IDS: '600999' };
  const backOffice = (over: Record<string, unknown> = {}) => buildSessionUser(be(over), BACK_OFFICE);
  test('accounting department', () => {
    const u = backOffice({ department_id: 6 });
    expect([u.is_accounting, u.is_treasury]).toEqual([true, false]);
  });
  test('treasury department', () => {
    const u = backOffice({ department_id: 4 });
    expect([u.is_accounting, u.is_treasury]).toEqual([false, true]);
  });
  test('treasury by employee id', () => expect(backOffice({ employee_id: '600999' }).is_treasury).toBe(true));
  test('no env → nobody, even the finance departments', () => {
    const u = session({ department_id: 6 });
    expect([u.is_accounting, u.is_treasury]).toEqual([false, false]);
  });
});

describe('diffSessionUser', () => {
  test('identical → nothing', () => {
    const d = diffSessionUser(session(), session());
    expect([d.resign, d.changes.length, d.access.length, d.firstTime]).toEqual([false, 0, 0, false]);
  });

  test('last_login alone is ignored', () => {
    expect(diffSessionUser(session(), session({ last_login: '2026-10-13T08:00:00' })).resign).toBe(false);
  });

  test('moved path + division + department + position', () => {
    const after = session({
      path: { path_id: 4, path_code: 'AF', path_th: 'สายงานบัญชีการเงิน', path_eng: 'Accouting & Finance' },
      division: { division_id: 24, division_code: 'ACC', division_th: 'ฝ่ายบัญชี', division_eng: 'Accounting' },
      department: 'Accounting', department_id: 6, department_th: 'แผนกบัญชี', position: 'Senior Accountant',
    });
    const d = diffSessionUser(session(), after);
    expect(d.resign).toBe(true);
    expect(d.changes).toEqual([
      { key: 'path', label: 'สายงาน', before: 'สายงานธุรกิจ', after: 'สายงานบัญชีการเงิน' },
      { key: 'division', label: 'ฝ่าย', before: 'ฝ่ายจัดซื้อกลยุทธ์', after: 'ฝ่ายบัญชี' },
      { key: 'department', label: 'แผนก', before: 'แผนกสโตร์', after: 'แผนกบัญชี' },
      { key: 'position', label: 'ตำแหน่ง', before: 'Procurement Officer', after: 'Senior Accountant' },
    ]);
  });

  test('finance granted, admin removed', () => {
    const d = diffSessionUser(session({ department_id: 21 }), session({ department_id: 4 }));
    expect(d.access).toEqual([{ key: 'role', granted: false }, { key: 'is_finance', granted: true }]);
  });

  test('hidden id change re-signs without telling the user', () => {
    const d = diffSessionUser(session(), session({ site_id: 2 }));
    expect([d.resign, d.changes.length]).toEqual([true, 0]);
  });

  test('old token without org fields → first-time list of the new org info', () => {
    const old = { ...session() } as Record<string, unknown>;
    delete old.path; delete old.division; delete old.department_th;
    const d = diffSessionUser(old as unknown as UserInfo, session());
    expect(d.firstTime).toBe(true);
    expect(d.changes.map(c => [c.label, c.before, c.after])).toEqual([
      ['สายงาน', null, 'สายงานธุรกิจ'], ['ฝ่าย', null, 'ฝ่ายจัดซื้อกลยุทธ์'], ['แผนก', null, 'แผนกสโตร์'],
    ]);
  });

  test('token signed with division but before department_th → first-time list, no fake แผนก change', () => {
    const mid = { ...session() } as Record<string, unknown>;
    delete mid.department_th;
    const d = diffSessionUser(mid as unknown as UserInfo, session());
    expect(d.firstTime).toBe(true);
    expect(d.changes.find(c => c.key === 'department')).toEqual({ key: 'department', label: 'แผนก', before: null, after: 'แผนกสโตร์' });
  });

  test('first time with no org data yet → nothing to show but still re-signs', () => {
    const old = { ...session() } as Record<string, unknown>;
    delete old.path; delete old.division; delete old.department_th;
    const d = diffSessionUser(old as unknown as UserInfo,
      session({ path: null, division: null, department: '', department_th: null }));
    expect([d.firstTime, d.changes.length, d.resign]).toEqual([true, 0, true]);
  });
});
