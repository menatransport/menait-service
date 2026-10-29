import { describe, expect, test } from 'bun:test';
import { groupUsersByDivision } from './group-users';
import type { UserData } from './types';

const HR = { division_id: 28, division_th: 'ฝ่ายทรัพยากรบุคคล', division_eng: 'Human Resources', division_code: 'HR' };
const EX = { division_id: 29, division_th: 'คณะกรรมการบริหาร', division_eng: 'Executive Committee', division_code: 'EX' };

let seq = 0;
const u = (over: Partial<UserData>): UserData => ({
    id: ++seq, username: `u${seq}`, email: '', employee_id: String(600000 + seq), employee_status: 'Active',
    firstname: 'ก', lastname: 'ข', department_id: null, site_id: null, position_id: null,
    department: '', site: '', position: '', position_level: 'Officer', ...over,
});

const labels = new Map([['22', 'แผนกสรรหา Mass'], ['7', 'แผนกค่าจ้างและสวัสดิการ'], ['1', 'ผู้บริหาร']]);

describe('groupUsersByDivision', () => {
    const data = [
        u({ department_id: 22, department: 'Recruitment - Mass', division: HR, path: { path_id: 5 } }),
        u({ department_id: 7, department: 'Compensation & Benefits', division: HR, path: { path_id: 5 }, position_level: 'Manager' }),
        u({ department_id: 7, department: 'Compensation & Benefits', division: HR, path: { path_id: 5 } }),
        u({ department_id: 1, department: 'Chief-Level', division: EX, path: { path_id: 1 } }),
        u({ department_id: 9, department: 'Sales & Driver Partner', division: null }),
    ];

    test('ฝ่าย → แผนก, sorted by path then id, unknown last', () => {
        const { groups, totalFiltered, departmentCount } = groupUsersByDivision(data, '', labels);
        expect(groups.map(g => g.code)).toEqual(['EX', 'HR', null]);
        expect(groups[1].departments.map(d => d.department)).toEqual(['แผนกค่าจ้างและสวัสดิการ', 'แผนกสรรหา Mass']);
        expect(groups[2].division).toBe('ไม่ระบุฝ่าย');
        expect([totalFiltered, departmentCount]).toEqual([5, 4]);
    });

    test('users sorted by level, high first', () => {
        const hr = groupUsersByDivision(data, '', labels).groups[1];
        expect(hr.departments[0].users[0].position_level).toBe('Manager');
    });

    test('search matches ฝ่าย and Thai แผนก names', () => {
        expect(groupUsersByDivision(data, 'ทรัพยากร', labels).totalFiltered).toBe(3);
        expect(groupUsersByDivision(data, 'สรรหา', labels).groups[0].departments).toHaveLength(1);
    });

    test('old backend without division → one group per แผนก', () => {
        const old = data.map(({ division, path, ...rest }) => rest as UserData);
        const { groups } = groupUsersByDivision(old, '', labels);
        expect(groups).toHaveLength(4);
        expect(groups.every(g => g.departments.length === 1)).toBe(true);
    });
});
