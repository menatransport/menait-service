import { describe, expect, test } from 'bun:test';
import { Wallet } from 'lucide-react';
import { MENU_GROUPS, focusGroup, sectionHeadingAt, visibleItems, type MenuItem } from './menu-groups';

const item = (title: string, section?: string): MenuItem => ({ title, description: '', icon: Wallet, href: '/x', section });

describe('sectionHeadingAt', () => {
    test('พิมพ์หัวข้อเฉพาะรายการแรกของแต่ละ section', () => {
        const items = [item('a', 'Advance'), item('b', 'Advance'), item('c', 'Petty'), item('d', 'Petty')];
        expect(items.map((_, i) => sectionHeadingAt(items, i))).toEqual(['Advance', null, 'Petty', null]);
    });
    test('รายการที่ไม่มี section ไม่มีหัวข้อ และ section เดิมที่กลับมาใหม่พิมพ์ซ้ำได้', () => {
        const items = [item('a'), item('b', 'X'), item('c'), item('d', 'X')];
        expect(items.map((_, i) => sectionHeadingAt(items, i))).toEqual([null, 'X', null, 'X']);
    });
});

describe('เมนูการเงินเป็น 2 กลุ่มย่อยพับได้ (5/11/2026)', () => {
    const finance = MENU_GROUPS.find(g => g.id === 'finance')!;
    test('Advance แล้วค่อยเงินสดย่อย แต่ละกลุ่มมีเมนูย่อย ไม่มีลิงก์ที่ตัวกลุ่มเอง', () => {
        expect(finance.items.map(i => i.title)).toEqual(['เงินทดรองจ่าย (Advance)', 'เงินสดย่อย (Petty Cash)']);
        expect(finance.items.every(i => !i.href && (i.children?.length ?? 0) > 0)).toBe(true);
        expect(finance.items.map(i => i.children!.length)).toEqual([4, 7]);
    });
    test('คนทั่วไปเห็น Advance 3 / เงินสดย่อย 4 · บัญชี-การเงินเห็นครบ 4 / 7', () => {
        expect(visibleItems(finance.items, false).map(i => i.children!.length)).toEqual([3, 4]);
        expect(visibleItems(finance.items, true).map(i => i.children!.length)).toEqual([4, 7]);
    });
    test('กลุ่มที่เมนูย่อยถูกตัดหมดจะหายทั้งกลุ่ม และรายการเดี่ยว financeOnly ก็ถูกตัด', () => {
        const items: MenuItem[] = [
            { title: 'g', description: '', icon: Wallet, children: [{ title: 'x', description: '', icon: Wallet, href: '/x', financeOnly: true }] },
            { title: 'y', description: '', icon: Wallet, href: '/y', financeOnly: true },
            { title: 'z', description: '', icon: Wallet, href: '/z' },
        ];
        expect(visibleItems(items, false).map(i => i.title)).toEqual(['z']);
        expect(visibleItems(items, true).map(i => i.title)).toEqual(['g', 'y', 'z']);
    });
});


const visible = MENU_GROUPS.filter(g => !g.adminOnly);

describe('focusGroup (/home?group=…)', () => {
    test('returns the group whose id matches', () => {
        expect(focusGroup(visible, 'finance')?.id).toBe('finance');
        expect(focusGroup(visible, 'ops')?.id).toBe('ops');
    });

    test('ignores case and spaces in the link', () => {
        expect(focusGroup(visible, ' Finance ')?.id).toBe('finance');
    });

    test('no param or an unknown id shows every group', () => {
        expect(focusGroup(visible, null)).toBeNull();
        expect(focusGroup(visible, '')).toBeNull();
        expect(focusGroup(visible, 'finan')).toBeNull();
    });

    test('a group the user cannot see is not opened by the link', () => {
        expect(focusGroup(visible, 'admin')).toBeNull();
    });
});

describe('เมนูงานเงินสดย่อย', () => {
    const finance = MENU_GROUPS.find(g => g.id === 'finance')!;
    const leaves = finance.items.flatMap(i => i.children ?? [i]);
    test('บัญชีกับการเงินใช้รายการเดียว "งานเงินสดย่อย" ไปหน้า /finance/petty/accounting', () => {
        const items = leaves.filter(i => i.href === '/finance/petty/accounting');
        expect(items.map(i => i.title)).toEqual(['งานเงินสดย่อย']);
        expect(items[0].financeOnly).toBe(true);
    });
    test('ไม่มีรายการไปหน้าทำจ่ายเดิมแล้ว (redirect มาหน้างานเงินสดย่อย)', () => {
        expect(leaves.some(i => i.href === '/finance/petty/batches')).toBe(false);
    });
});
