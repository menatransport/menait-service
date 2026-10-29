import { parseLevelNum } from './constants';
import { groupUsersByDivision } from './group-users';
import type { UserData, DivisionGroup, DepartmentGroup } from './types';

/** Lv.5 Manager and up can head a ฝ่าย */
export const MANAGER_LEVEL = 5;
/** Lv.7 Deputy C-level and up = คณะกรรมการบริหาร — everyone there is an executive, so no ผู้จัดการฝ่าย tag */
const EXECUTIVE_LEVEL = 7;

export interface ManagedDivision extends DivisionGroup {
    /** ผู้จัดการฝ่าย: everyone at the top level of the ฝ่าย (Manager or higher), from the unfiltered list */
    managers: UserData[];
}

/**
 * Top-level people of each ฝ่าย (keyed like groupUsersByDivision: `div:<id>` / `div:none` / `dep:<id>`).
 * Several people tie when they share the top level (e.g. HR has four Managers).
 */
export function managersByDivision(users: UserData[], deptLabels: Map<string, string>): Map<string, UserData[]> {
    const map = new Map<string, UserData[]>();
    for (const group of groupUsersByDivision(users, '', deptLabels).groups) {
        const everyone = group.departments.flatMap(d => d.users);
        const top = Math.max(-1, ...everyone.map(u => parseLevelNum(u.position_level)));
        if (top < MANAGER_LEVEL || top >= EXECUTIVE_LEVEL) continue;
        map.set(group.key, everyone.filter(u => parseLevelNum(u.position_level) === top));
    }
    return map;
}

/**
 * groupUsersByDivision + each ฝ่าย's managers, listed first in the ฝ่าย (not repeated under their แผนก).
 * Managers stay listed when the search matched someone else in the ฝ่าย, so a hit always comes with
 * who runs that ฝ่าย. Used by /master and the read-only /organization directory.
 */
export function groupWithManagers(
    users: UserData[],
    searchTerm: string,
    deptLabels: Map<string, string>,
    managers: Map<string, UserData[]>,
): { groups: ManagedDivision[]; totalFiltered: number; departmentCount: number; hasDivisions: boolean } {
    const { groups, ...counts } = groupUsersByDivision(users, searchTerm, deptLabels);
    return {
        ...counts,
        groups: groups.map(group => {
            const heads = managers.get(group.key) ?? [];
            const headIds = new Set(heads.map(u => u.id));
            const departments: DepartmentGroup[] = group.departments
                .map(d => ({ ...d, users: d.users.filter(u => !headIds.has(u.id)) }))
                .filter(d => d.users.length > 0);
            return { ...group, departments, managers: heads };
        }),
    };
}
