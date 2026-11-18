import { describe, expect, test } from 'bun:test';
import { waitingLabel } from './approvalWaiting';

describe('ขั้นที่รออนุมัติ บอกชื่อคนที่รอ', () => {
  test('คนเดียว', () => expect(waitingLabel([{ name: 'ศักดิ์ดาเดช แสงดิษฐ' }])).toBe('รอ ศักดิ์ดาเดช แสงดิษฐ อนุมัติ'));
  test('หลายคน = คนใดคนหนึ่ง · ชื่อซ้ำ/ว่างตัดทิ้ง', () =>
    expect(waitingLabel([{ name: 'ก' }, { name: 'ข' }, { name: 'ก' }, { name: null }])).toBe('รอ ก หรือ ข อนุมัติ'));
  test('เกิน 3 คน บอกจำนวนที่เหลือ', () =>
    expect(waitingLabel([{ name: 'ก' }, { name: 'ข' }, { name: 'ค' }, { name: 'ง' }, { name: 'จ' }])).toBe('รอ ก หรือ ข หรือ ค (และอีก 2 คน) อนุมัติ'));
  test('ไม่รู้ชื่อ', () => {
    expect(waitingLabel([])).toBe('รออนุมัติ');
    expect(waitingLabel(null)).toBe('รออนุมัติ');
  });
});
