import { describe, expect, test } from 'bun:test';
import { Wallet } from 'lucide-react';
import { MENU_GROUPS, sectionHeadingAt, type MenuItem } from './menu-groups';

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
    test('เมนูการเงินจริง: Advance แล้วค่อยเงินสดย่อย เป็น 2 หัวข้อ', () => {
        const finance = MENU_GROUPS.find(g => g.id === 'finance')!;
        const headings = finance.items.map((_, i) => sectionHeadingAt(finance.items, i)).filter(Boolean);
        expect(headings).toEqual(['เงินทดรองจ่าย (Advance)', 'เงินสดย่อย (Petty Cash)']);
        expect(finance.items.every(i => i.section)).toBe(true);
    });
});
