import { describe, expect, test } from 'bun:test';
import { buildOrgIndex, placeDepartment, divisionsInPath, departmentsFor } from './org-structure';
import type { UserData } from './types';

const structure = {
    divisions: [
        { division_id: 28, division_th: 'ฝ่ายทรัพยากรบุคคล', division_eng: 'Human Resources', division_code: 'HR', path_id: 5 },
        { division_id: 26, division_th: 'ฝ่ายเทคโนโลยีสารสนเทศ', division_eng: 'Information Technology', division_code: 'IT', path_id: 4 },
        { division_id: 29, division_th: 'คณะกรรมการบริหาร', division_eng: 'Executive Committee', division_code: 'EX', path_id: 1 },
    ],
    departments: [
        { department_id: 22, department_name_th: 'แผนกสรรหา Mass', department_name_en: 'Recruitment - Mass', division_id: 28 },
        { department_id: 7, department_name_th: 'แผนกค่าจ้างและสวัสดิการ', department_name_en: 'Compensation & Benefits', division_id: 28 },
        { department_id: 21, department_name_th: 'แผนกเทคโนโลยีสารสนเทศ', department_name_en: 'Information Technology', division_id: 26 },
        // points at a ฝ่าย that has no divisions row (prod dept 9 → 14)
        { department_id: 9, department_name_th: 'แผนกขายรถร่วม', department_name_en: 'Sales & Driver Partner', division_id: 14 },
    ],
};

const users = [
    { path: { path_id: 5, path_th: 'สายงานสนับสนุน', path_code: 'CS' } },
    { path: { path_id: 4, path_th: 'สายงานบัญชีการเงิน', path_code: 'AF' } },
    { path: null },
] as unknown as UserData[];

describe('org index', () => {
    const org = buildOrgIndex(structure, users);

    test('paths take names from users, unknown ones fall back to the id', () => {
        expect(org.paths.map(p => [p.path_id, p.path_th])).toEqual([
            [1, 'สายงาน #1'], [4, 'สายงานบัญชีการเงิน'], [5, 'สายงานสนับสนุน'],
        ]);
    });

    test('placeDepartment walks แผนก → ฝ่าย → สายงาน', () => {
        const p = placeDepartment(org, '22');
        expect(p?.division?.division_code).toBe('HR');
        expect(p?.path?.path_code).toBe('CS');
        expect(placeDepartment(org, 9)?.division).toBeNull();
        expect(placeDepartment(org, 999)).toBeNull();
        expect(placeDepartment(org, '')).toBeNull();
    });

    test('pickers narrow by สายงาน and ฝ่าย', () => {
        expect(divisionsInPath(org, 5).map(d => d.division_id)).toEqual([28]);
        expect(divisionsInPath(org, null)).toHaveLength(3);
        expect(departmentsFor(org, null, 28).map(d => d.department_id).sort()).toEqual([22, 7].sort());
        expect(departmentsFor(org, 4, null).map(d => d.department_id)).toEqual([21]);
        // orphan แผนก only shows in the unfiltered list
        expect(departmentsFor(org, null, null).map(d => d.department_id)).toContain(9);
        expect(org.departmentsByDivision.get(null)?.map(d => d.department_id)).toEqual([9]);
    });
});
