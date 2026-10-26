import { describe, expect, test } from 'bun:test';
import { groupWithManagers, managersByDivision } from './division-managers';
import type { UserData } from './types';

let seq = 0;
const user = (over: Partial<UserData>): UserData => ({
    id: ++seq, username: `u${seq}`, email: `u${seq}@mena.co.th`, employee_id: String(600000 + seq), employee_status: 'Active',
    firstname: `ชื่อ${seq}`, lastname: 'นามสกุล', department_id: null, site_id: null, position_id: null,
    department: '', site: 'Bangkok HQ', position: 'Staff', position_level: 'Officer', ...over,
});

const EX = { division_id: 29, division_th: 'คณะกรรมการบริหาร', division_eng: 'Executive Committee', division_code: 'EX' };
const HR = { division_id: 28, division_th: 'ฝ่ายทรัพยากรบุคคล', division_eng: 'Human Resources', division_code: 'HR' };
const OPS = { division_id: 17, division_th: 'ฝ่ายสนับสนุนปฏิบัติการ', division_eng: 'Operation Support', division_code: 'OPS' };
const IT = { division_id: 26, division_th: 'ฝ่ายเทคโนโลยีสารสนเทศ', division_eng: 'Information Technology', division_code: 'IT' };

const users = [
    user({ firstname: 'สุวรรณา', department_id: 30, division: EX, path: { path_id: 1, path_th: 'บริหาร' }, position: 'CEO', position_level: 'Chief Executive Officer' }),
    user({ firstname: 'กอบชัย', department_id: 30, division: EX, path: { path_id: 1, path_th: 'บริหาร' }, position: 'CFO', position_level: 'C-Level' }),
    user({ firstname: 'พัชรพรรณ', department_id: 10, division: OPS, path: { path_id: 2, path_th: 'สายงานปฏิบัติการ' }, position: 'Operation Support Manager', position_level: 'Senior Manager' }),
    user({ firstname: 'ณรงค์กรณ์', department_id: 12, division: OPS, path: { path_id: 2, path_th: 'สายงานปฏิบัติการ' }, position: 'Process Excellence Manager', position_level: 'Manager' }),
    user({ firstname: 'กฤตบุญ', department_id: 12, division: OPS, path: { path_id: 2, path_th: 'สายงานปฏิบัติการ' }, position: 'Process Excellence Supervisor', position_level: 'Supervisor' }),
    user({ firstname: 'ณชญาดา', department_id: 34, division: HR, path: { path_id: 5, path_th: 'สายงานสนับสนุน' }, position: 'OD Manager', position_level: 'Manager' }),
    user({ firstname: 'ศักดิ์ดาเดช', department_id: 22, division: HR, path: { path_id: 5, path_th: 'สายงานสนับสนุน' }, position: 'TA Manager', position_level: 'Manager' }),
    user({ firstname: 'ไอที', department_id: 21, division: IT, path: { path_id: 4, path_th: 'สายงานบัญชีการเงิน' }, position: 'IT Officer', position_level: 'Supervisor' }),
];
const labels = new Map([['10', 'แผนก Operation Support'], ['12', 'แผนก Process Excellence'], ['21', 'แผนกไอที'], ['22', 'แผนกสรรหา'], ['30', 'คณะกรรมการบริหาร'], ['34', 'แผนก OD']]);
const managers = managersByDivision(users, labels);

describe('managersByDivision', () => {
    test('top level of each ฝ่าย, ties kept, below Manager = none', () => {
        expect(managers.get('div:17')?.map(u => u.firstname)).toEqual(['พัชรพรรณ']);
        expect(managers.get('div:28')?.map(u => u.firstname).sort()).toEqual(['ณชญาดา', 'ศักดิ์ดาเดช'].sort());
        expect(managers.has('div:29')).toBe(false); // คณะกรรมการบริหาร: no tag
        expect(managers.has('div:26')).toBe(false); // top is Supervisor
    });
});

describe('groupWithManagers', () => {
    test('managers are listed once (not under their แผนก); emptied แผนก are dropped', () => {
        const { groups: divisions, departmentCount } = groupWithManagers(users, '', labels, managers);
        expect(departmentCount).toBe(6); // counts every แผนก, also those holding only a manager
        const ops = divisions.find(d => d.key === 'div:17')!;
        expect(ops.departments.map(d => d.department)).toEqual(['แผนก Process Excellence']);
        expect(ops.departments[0].users.map(u => u.firstname)).toEqual(['ณรงค์กรณ์', 'กฤตบุญ']);
        const hr = divisions.find(d => d.key === 'div:28')!;
        expect(hr.departments).toEqual([]);
        expect(divisions.find(d => d.key === 'div:29')!.departments[0].users.length).toBe(2);
    });

    test('search keeps the ฝ่าย managers next to the hit', () => {
        const { groups: divisions, totalFiltered } = groupWithManagers(users, 'process excellence supervisor', labels, managers);
        expect(totalFiltered).toBe(1);
        expect(divisions.map(d => d.key)).toEqual(['div:17']);
        expect(divisions[0].managers.map(u => u.firstname)).toEqual(['พัชรพรรณ']);
    });

    test('search hit on a manager only keeps the ฝ่าย with no แผนก rows', () => {
        const { groups: divisions } = groupWithManagers(users, 'พัชรพรรณ', labels, managers);
        expect(divisions.map(d => d.key)).toEqual(['div:17']);
        expect(divisions[0].departments).toEqual([]);
    });
});
