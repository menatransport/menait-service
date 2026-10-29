import { expect, test } from 'bun:test';
import { listPaths } from './directory';
import type { UserData } from '@/app/master/types';

const user = (id: number, path: UserData['path']) => ({ id, path } as UserData);

test('listPaths counts people per สายงาน in path_id order', () => {
    const users = [user(1, { path_id: 2, path_th: 'สายงานปฏิบัติการ' }), user(2, { path_id: 1, path_th: 'บริหาร' }), user(3, { path_id: 2 }), user(4, null)];
    expect(listPaths(users)).toEqual([
        { path_id: 1, path_th: 'บริหาร', count: 1 },
        { path_id: 2, path_th: 'สายงานปฏิบัติการ', count: 2 },
    ]);
});
