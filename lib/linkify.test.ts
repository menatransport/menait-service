import { describe, expect, test } from 'bun:test';
import { isHttpUrl, linkifyText } from './linkify';

const SHEET = 'https://docs.google.com/spreadsheets/d/12biZgDtzeEYJJLBhpEahLTzirGcEp6MY5q7WuFRfKCU/edit?gid=1315123135#gid=1315123135';
const links = (s: string) => linkifyText(s).filter(p => p.href).map(p => p.href);
const joined = (s: string) => linkifyText(s).map(p => p.text).join('');

describe('linkifyText', () => {
    test('a bare link is one link part', () => {
        expect(linkifyText(SHEET)).toEqual([{ text: SHEET, href: SHEET }]);
    });
    test('plain text has no links', () => {
        expect(linkifyText('ไม่มีลิงก์')).toEqual([{ text: 'ไม่มีลิงก์' }]);
        expect(linkifyText('')).toEqual([]);
    });
    test('links among Thai text and lines', () => {
        const s = `ไฟล์อยู่ที่ ${SHEET}\nอีกอัน https://a.com/x ครับ`;
        expect(links(s)).toEqual([SHEET, 'https://a.com/x']);
        expect(joined(s)).toBe(s);
    });
    test('Thai letters right after a link are not part of it', () => {
        expect(links('ดูที่https://a.com/xครับ')).toEqual(['https://a.com/x']);
    });
    test('trailing punctuation and unmatched brackets stay text', () => {
        expect(links('ดู https://a.com/x.')).toEqual(['https://a.com/x']);
        expect(links('(https://a.com/x), ok')).toEqual(['https://a.com/x']);
        expect(links('https://en.wikipedia.org/wiki/A_(b)')).toEqual(['https://en.wikipedia.org/wiki/A_(b)']);
        expect(joined('(https://a.com/x), ok')).toBe('(https://a.com/x), ok');
    });
    test('only http(s) becomes a link', () => {
        expect(links('javascript:alert(1) ftp://a.com www.a.com')).toEqual([]);
        expect(links('https:// nothing')).toEqual([]);
    });
});

describe('isHttpUrl', () => {
    test('accepts http(s) with a host only', () => {
        expect(isHttpUrl('https://a.com')).toBe(true);
        expect(isHttpUrl('javascript:alert(1)')).toBe(false);
        expect(isHttpUrl('https://')).toBe(false);
    });
});
