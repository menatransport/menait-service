import { parseLevelNum } from './constants';
import type { UserData, DepartmentGroup, DivisionGroup } from './types';

const NO_DIVISION = 'ไม่ระบุฝ่าย';
const NO_DEPARTMENT = 'ไม่ระบุแผนก';

interface Bucket {
    group: DivisionGroup;
    sortPath: number;
    sortId: number;
    depts: Map<string, DepartmentGroup>;
}

/**
 * Filter + group users as ฝ่าย → แผนก in one pass.
 * - `deptLabels` maps department_id → Thai name (the user row only carries the English one).
 * - Users from an old backend (no `division` key) get one ฝ่าย per แผนก, i.e. the old flat list.
 * - ฝ่าย follow path then division id (คณะกรรมการบริหาร first); unknown ฝ่าย last.
 *   แผนก sort by Thai name, users by position level (high → low).
 */
export function groupUsersByDivision(
    data: UserData[],
    searchTerm: string,
    deptLabels: Map<string, string>,
): { groups: DivisionGroup[]; totalFiltered: number; departmentCount: number; hasDivisions: boolean } {
    const term = searchTerm.trim().toLowerCase();
    const buckets = new Map<string, Bucket>();
    let totalFiltered = 0;
    const hasDivisions = data.some(u => u.division !== undefined);

    for (const user of data) {
        const deptId = user.department_id == null ? '' : String(user.department_id);
        const deptEn = user.department || '';
        const deptTh = deptLabels.get(deptId) || deptEn || NO_DEPARTMENT;
        const div = user.division;
        const divTh = div?.division_th || div?.division_eng || '';

        if (term) {
            const matches = [
                user.employee_id, user.firstname, user.lastname, user.email,
                user.site, user.position, deptEn, deptTh,
                div?.division_th, div?.division_eng, div?.division_code,
            ].some(v => v?.toLowerCase().includes(term));
            if (!matches) continue;
        }

        let divKey: string;
        let bucketInit: () => Bucket;
        if (div === undefined) {
            divKey = `dep:${deptId}`;
            bucketInit = () => ({
                group: { key: divKey, division: deptTh, divisionEn: deptEn, code: null, departments: [], total: 0 },
                sortPath: 0, sortId: 0, depts: new Map(),
            });
        } else if (div === null) {
            divKey = 'div:none';
            bucketInit = () => ({
                group: { key: divKey, division: NO_DIVISION, divisionEn: '', code: null, departments: [], total: 0 },
                sortPath: Infinity, sortId: Infinity, depts: new Map(),
            });
        } else {
            divKey = `div:${div.division_id}`;
            bucketInit = () => ({
                group: { key: divKey, division: divTh, divisionEn: div.division_eng || '', code: div.division_code, departments: [], total: 0 },
                sortPath: user.path?.path_id ?? 99, sortId: div.division_id, depts: new Map(),
            });
        }

        let bucket = buckets.get(divKey);
        if (!bucket) {
            bucket = bucketInit();
            buckets.set(divKey, bucket);
        }

        const deptKey = `${divKey}/dep:${deptId}`;
        let dept = bucket.depts.get(deptKey);
        if (!dept) {
            dept = { key: deptKey, department: deptTh, departmentEn: deptEn, users: [] };
            bucket.depts.set(deptKey, dept);
        }
        dept.users.push(user);
        bucket.group.total++;
        totalFiltered++;
    }

    let departmentCount = 0;
    const sorted = [...buckets.values()].sort((a, b) =>
        a.sortPath - b.sortPath || a.sortId - b.sortId || a.group.division.localeCompare(b.group.division, 'th'));
    const groups = sorted.map(({ group, depts }) => {
        group.departments = [...depts.values()].sort((a, b) => a.department.localeCompare(b.department, 'th'));
        for (const d of group.departments) {
            d.users.sort((a, b) => parseLevelNum(b.position_level) - parseLevelNum(a.position_level));
        }
        departmentCount += group.departments.length;
        return group;
    });

    return { groups, totalFiltered, departmentCount, hasDivisions };
}
