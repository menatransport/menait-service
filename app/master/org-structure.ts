import type { UserData } from './types';

/** สายงาน */
export interface OrgPath {
    path_id: number;
    path_th: string;
    path_code: string | null;
}

/** ฝ่าย */
export interface OrgDivision {
    division_id: number;
    division_th: string | null;
    division_eng: string | null;
    division_code: string | null;
    path_id: number | null;
}

/** แผนก — users only store department_id; ฝ่าย and สายงาน follow from it */
export interface OrgDepartment {
    department_id: number;
    department_name_th: string;
    department_name_en: string;
    division_id: number | null;
}

/** Raw lists from /api/organization/structure */
export interface OrgStructure {
    divisions: OrgDivision[];
    departments: OrgDepartment[];
}

export interface OrgPlacement {
    path: OrgPath | null;
    division: OrgDivision | null;
    department: OrgDepartment;
}

export interface OrgIndex {
    paths: OrgPath[];
    divisions: OrgDivision[];
    departments: OrgDepartment[];
    pathById: Map<number, OrgPath>;
    divisionById: Map<number, OrgDivision>;
    departmentById: Map<number, OrgDepartment>;
    /** Departments per division_id; key null = แผนกที่ยังไม่ผูกฝ่าย (or points at a missing ฝ่าย) */
    departmentsByDivision: Map<number | null, OrgDepartment[]>;
}

export const EMPTY_ORG: OrgStructure = { divisions: [], departments: [] };

export const divisionLabel = (d: OrgDivision | null | undefined) =>
    d ? (d.division_th || d.division_eng || `ฝ่าย #${d.division_id}`) : 'ไม่ระบุฝ่าย';

export const departmentLabel = (d: OrgDepartment) =>
    d.department_name_th || d.department_name_en || `แผนก #${d.department_id}`;

/**
 * Index the org tree for the pickers.
 * ncacdb has no /paths endpoint, so สายงาน names come from the user rows (`user.path`);
 * a path no user belongs to yet falls back to "สายงาน #id".
 */
export function buildOrgIndex(structure: OrgStructure, users: UserData[]): OrgIndex {
    const pathById = new Map<number, OrgPath>();
    for (const u of users) {
        const p = u.path;
        if (p && !pathById.has(p.path_id)) {
            pathById.set(p.path_id, { path_id: p.path_id, path_th: p.path_th || `สายงาน #${p.path_id}`, path_code: p.path_code ?? null });
        }
    }
    for (const d of structure.divisions) {
        if (d.path_id != null && !pathById.has(d.path_id)) {
            pathById.set(d.path_id, { path_id: d.path_id, path_th: `สายงาน #${d.path_id}`, path_code: null });
        }
    }

    const divisions = [...structure.divisions].sort((a, b) =>
        (a.path_id ?? 99) - (b.path_id ?? 99) || a.division_id - b.division_id);
    const divisionById = new Map(divisions.map(d => [d.division_id, d]));

    const departments = [...structure.departments].sort((a, b) =>
        departmentLabel(a).localeCompare(departmentLabel(b), 'th'));
    const departmentById = new Map(departments.map(d => [d.department_id, d]));
    const departmentsByDivision = new Map<number | null, OrgDepartment[]>();
    for (const d of departments) {
        const key = d.division_id != null && divisionById.has(d.division_id) ? d.division_id : null;
        const list = departmentsByDivision.get(key);
        if (list) list.push(d);
        else departmentsByDivision.set(key, [d]);
    }

    return {
        paths: [...pathById.values()].sort((a, b) => a.path_id - b.path_id),
        divisions,
        departments,
        pathById,
        divisionById,
        departmentById,
        departmentsByDivision,
    };
}

/** Where a แผนก sits: แผนก → ฝ่าย → สายงาน. null when the id is unknown. */
export function placeDepartment(org: OrgIndex, departmentId: number | string | null | undefined): OrgPlacement | null {
    if (departmentId === null || departmentId === undefined || departmentId === '') return null;
    const department = org.departmentById.get(Number(departmentId));
    if (!department) return null;
    const division = department.division_id != null ? org.divisionById.get(department.division_id) ?? null : null;
    const path = division?.path_id != null ? org.pathById.get(division.path_id) ?? null : null;
    return { path, division, department };
}

/** ฝ่าย under a สายงาน (all ฝ่าย when no สายงาน is chosen) */
export function divisionsInPath(org: OrgIndex, pathId: number | null): OrgDivision[] {
    return pathId == null ? org.divisions : org.divisions.filter(d => d.path_id === pathId);
}

/**
 * แผนก the picker may offer: those of the chosen ฝ่าย, else those under the chosen สายงาน, else all.
 * Departments without a ฝ่าย only show when nothing narrows the list.
 */
export function departmentsFor(org: OrgIndex, pathId: number | null, divisionId: number | null): OrgDepartment[] {
    if (divisionId != null) return org.departmentsByDivision.get(divisionId) ?? [];
    if (pathId != null) {
        const ids = new Set(divisionsInPath(org, pathId).map(d => d.division_id));
        return org.departments.filter(d => d.division_id != null && ids.has(d.division_id));
    }
    return org.departments;
}
