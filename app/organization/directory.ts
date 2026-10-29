import type { UserData } from '@/app/master/types';

export interface DirectoryPath {
    path_id: number;
    path_th: string;
    count: number;
}

/** สายงาน filter options, in path_id order */
export function listPaths(users: UserData[]): DirectoryPath[] {
    const map = new Map<number, DirectoryPath>();
    for (const u of users) {
        const p = u.path;
        if (!p) continue;
        const entry = map.get(p.path_id);
        if (entry) entry.count++;
        else map.set(p.path_id, { path_id: p.path_id, path_th: p.path_th || `สายงาน #${p.path_id}`, count: 1 });
    }
    return [...map.values()].sort((a, b) => a.path_id - b.path_id);
}
