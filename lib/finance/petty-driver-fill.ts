import type { DriverOption } from '@/app/finance/petty-api';

/** เติมค่าจาก master ลงแถว/หัวใบ แบบ "ค่าแนะนำ": ของที่คนกรอกไว้แล้วไม่ทับ ยกเว้นชื่อ/รหัสคนขับที่เพิ่งเลือก (ผู้ใช้สั่ง 7/11/2026) */
export type DriverFields = {
  driver_name?: unknown; driver_code?: unknown; driver_role?: unknown; fleet?: unknown;
  truck_code?: unknown; truck_plate?: unknown; truck_type?: unknown;
};

export function applyDriver<T extends Record<string, unknown>>(row: T, driver: DriverOption): T & DriverFields {
  const keep = (key: string) => String(row[key] ?? '').trim() !== '';
  return {
    ...row,
    driver_name: driver.driver_name ?? row.driver_name,
    driver_code: driver.driver_code ?? null,
    driver_role: keep('driver_role') ? row.driver_role : (driver.driver_role || row.driver_role),
    fleet: driver.fleet || row.fleet,
    truck_code: keep('truck_code') ? row.truck_code : driver.truck_code,
    truck_plate: keep('truck_code') ? row.truck_plate : driver.truck_plate,
    truck_type: keep('truck_type') ? row.truck_type : (driver.truck_type || row.truck_type),
  };
}

/** หลังเลือกรถ: ฟลีท ณ วันนั้นลงแถว · ประเภทรถและคนขับเติมเฉพาะช่องที่ยังว่าง (ข้อ 10) */
export function applyFleet<T extends Record<string, unknown>>(row: T, info: DriverOption | null): T & DriverFields {
  if (!info) return { ...row, fleet: null };
  const keep = (key: string) => String(row[key] ?? '').trim() !== '';
  return {
    ...row,
    fleet: info.fleet || null,
    truck_type: keep('truck_type') ? row.truck_type : (info.truck_type || row.truck_type),
    driver_name: keep('driver_name') ? row.driver_name : (info.driver_name ?? row.driver_name),
    driver_code: keep('driver_name') ? row.driver_code : (info.driver_code ?? null),
    driver_role: keep('driver_role') ? row.driver_role : (info.driver_role || row.driver_role),
  };
}
