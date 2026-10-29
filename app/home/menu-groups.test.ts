import { describe, expect, test } from 'bun:test';
import { MENU_GROUPS, focusGroup } from './menu-groups';

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
