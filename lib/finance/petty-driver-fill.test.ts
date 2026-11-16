import { describe, expect, test } from 'bun:test';
import { applyDriver, applyFleet } from './petty-driver-fill';

const DRIVER = { driver_code: '690648', driver_name: 'สุชาติ วงษ์อนุ', driver_role: 'พจส.', fleet: 'Mixer L',
  truck_code: 'ME166', truck_plate: '70-6310', truck_type: 'โม่ใหญ่', date: '2026-11-05' };

describe('applyDriver — เลือกคนขับจาก master แล้วเติมค่าแนะนำ (ผู้ใช้สั่ง 7/11/2026 ข้อ 7)', () => {
  test('แถวว่าง: ได้ชื่อ รหัส พจส./พจร. ฟลีท และรถที่ขับ', () => {
    expect(applyDriver({ event_date: '2026-11-05' }, DRIVER)).toEqual({
      event_date: '2026-11-05', driver_name: 'สุชาติ วงษ์อนุ', driver_code: '690648', driver_role: 'พจส.',
      fleet: 'Mixer L', truck_code: 'ME166', truck_plate: '70-6310', truck_type: 'โม่ใหญ่',
    });
  });
  test('รถและประเภทคนขับที่กรอกไว้แล้วไม่ถูกทับ (เป็นแค่ค่าแนะนำ)', () => {
    const row = applyDriver({ truck_code: '161', truck_plate: '71-4285', truck_type: 'โม่เล็ก', driver_role: 'พจร.' }, DRIVER);
    expect([row.truck_code, row.truck_plate, row.truck_type, row.driver_role]).toEqual(['161', '71-4285', 'โม่เล็ก', 'พจร.']);
    expect(row.driver_name).toBe('สุชาติ วงษ์อนุ');
  });
});

describe('applyFleet — เลือกรถแล้วรู้ฟลีท ณ วันทำรายการ (ข้อ 10)', () => {
  test('ฟลีทลงแถว ประเภทรถและคนขับเติมเฉพาะที่ว่าง', () => {
    const row = applyFleet({ truck_code: 'ME166', truck_plate: '70-6310' }, DRIVER);
    expect([row.fleet, row.truck_type, row.driver_name, row.driver_code, row.driver_role]).toEqual(['Mixer L', 'โม่ใหญ่', 'สุชาติ วงษ์อนุ', '690648', 'พจส.']);
  });
  test('คนขับที่พิมพ์ไว้แล้วคงเดิม', () => {
    const row = applyFleet({ truck_code: 'ME166', driver_name: 'สมชาย' }, DRIVER);
    expect([row.driver_name, row.driver_code]).toEqual(['สมชาย', undefined]);
  });
  test('ไม่พบใน ATMS → ฟลีทว่าง อย่างอื่นคงเดิม', () =>
    expect(applyFleet({ truck_code: 'X1', driver_role: 'พจส.' }, null)).toEqual({ truck_code: 'X1', driver_role: 'พจส.', fleet: null }));
});

describe('เลือกรถแล้ว พจส./พจร. ตาม ATMS (16/11/2026)', () => {
  test('แถวที่มี พจส. ค่าตั้งต้น + ATMS บอก พจร. → พจร. (รหัสจะเป็นรถร่วม)', async () => {
    const { applyFleet } = await import('./petty-driver-fill');
    const row = applyFleet({ truck_code: 'ME147', driver_role: 'พจส.' }, { fleet: 'Mixer L', driver_role: 'พจร.', driver_name: 'สง่า พัดพรม', driver_code: '072025' } as any);
    expect(row.driver_role).toBe('พจร.');
    expect(row.fleet).toBe('Mixer L');
  });
  test('ATMS ไม่บอกสถานะ → คงค่าเดิมของแถว', async () => {
    const { applyFleet } = await import('./petty-driver-fill');
    expect(applyFleet({ truck_code: 'X', driver_role: 'พจร.' }, { fleet: 'Trailer' } as any).driver_role).toBe('พจร.');
  });
});
