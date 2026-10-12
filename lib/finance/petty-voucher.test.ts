import { describe, expect, test } from 'bun:test';
import { itemSummaryHtml, pettyVoucherHtml, receiptSubstituteHtml } from './petty-voucher';
import type { PettyClaim, PettyFund } from '@/app/finance/types-petty';

const fund: PettyFund = {
  id: 1, branch_code: '03', division_code: 'B02',
  holder_employee_id: '12345', fund_limit: null, is_active: true,
};

const claim = {
  id: 1, form_id: 'LB-B02-2610-001', fund_id: 1, expense_type: 'WEIGH',
  expense_date: '2026-09-25', period_from: '2026-09-17', period_to: '2026-09-24',
  driver_employee_id: null, driver_name: null, payee_name: 'อัญชัญ น่วมมี',
  amount: 1640, dd_no: 'LBDD26090931', receipt_no: null, status: 'AWAITING_REVIEW',
  created_by: '55555', approved_by: '12345', approved_at: '2026-09-25T03:00:00Z',
  transfer_date: '2026-09-25', review_remark: null, return_reason: null,
  reviewed_by: null, reviewed_at: null, submitted_to_acc_at: null,
  dup_override_reason: null, batch_id: null,
  items: [
    ...['161', '144'].map((code, i) => ({ line_no: i + 1, event_date: '2026-09-17', truck_code: code,
      truck_plate: '71-4285', truck_type: 'โม่ใหญ่', ref_no: '00005' + i, qty: 1, rate: 100, amount: 100 })),
    { line_no: 3, event_date: '2026-09-24', truck_code: '165', truck_plate: '71-9001',
      truck_type: 'โม่เล็ก', ref_no: '000172', qty: 1, rate: 80, amount: 80 },
  ],
} as unknown as PettyClaim;

describe('pettyVoucherHtml', () => {
  const html = pettyVoucherHtml({ claim, fund, typeName: 'ค่าชั่งน้ำหนัก', payeePosition: 'เจ้าหน้าที่รับแจ้งซ่อม' });

  test('uses the system document number', () => expect(html).toContain('LB-B02-2610-001'));
  test('no printer book/number fields any more', () => {
    expect(html).not.toContain('เล่มที่');
  });
  test('shows the branch and division of the fund', () => {
    expect(html).toContain('B02');
    expect(html).toContain('03');
  });
  test('groups rows by rate and truck type', () => {
    expect(html).toContain('ค่าชั่งน้ำหนักรถโม่ใหญ่ 100 บาท');
    expect(html).toContain('ค่าชั่งน้ำหนักรถโม่เล็ก 80 บาท');
  });
  test('truck codes land in the remark column', () => expect(html).toContain('161, 144'));
  test('total and baht text', () => {
    expect(html).toContain('280.00');
    expect(html).toContain('สองร้อยแปดสิบบาทถ้วน');
  });
  test('names the payee', () => expect(html).toContain('อัญชัญ น่วมมี'));
  test('stamps the approver e-signature', () => expect(html).toContain('e-Signature'));
  test('escapes data into HTML safely', () => {
    const nasty = { ...claim, payee_name: '<script>bad()</script>' } as PettyClaim;
    expect(pettyVoucherHtml({ claim: nasty, fund, typeName: 'x' })).not.toContain('<script>bad()');
  });
});

describe('receiptSubstituteHtml', () => {
  const html = receiptSubstituteHtml({ claim, fund, typeName: 'ค่าชั่งน้ำหนัก', payeePosition: 'เจ้าหน้าที่รับแจ้งซ่อม' });

  test('carries the branch in the five-digit form the paper uses', () =>
    expect(html).toContain('00003'));
  test('states the period, which is why the claim keeps two dates', () => {
    expect(html).toContain('17/09/2026');
    expect(html).toContain('24/09/2026');
  });
  test('includes the certifier position', () => expect(html).toContain('เจ้าหน้าที่รับแจ้งซ่อม'));
  test('baht text again', () => expect(html).toContain('สองร้อยแปดสิบบาทถ้วน'));
  test('a claim with no period falls back to the voucher date', () => {
    const noPeriod = { ...claim, period_from: null, period_to: null } as PettyClaim;
    expect(receiptSubstituteHtml({ claim: noPeriod, fund, typeName: 'x' })).toContain('25/09/2026');
  });
});

describe('หน่วยนับบนใบ มาจากประเภท ไม่ใช่ฮาร์ดโค้ด', () => {
  const tyreClaim = {
    ...claim,
    amount: 1200,
    items: [{ line_no: 1, event_date: '2026-09-15', truck_code: '6604', truck_plate: '72-8179',
      truck_type: 'โม่ใหญ่', ref_no: 'B-01', qty: 6, rate: 200, amount: 1200,
      remark: 'เปลี่ยนยาง 6 เส้น' }],
  } as unknown as PettyClaim;

  test('a tyre voucher counts in เส้น', () => {
    const html = pettyVoucherHtml({ claim: tyreClaim, fund, typeName: 'ค่าปะ-เปลี่ยนยาง', unit: 'เส้น' });
    expect(html).toContain('6 เส้น');
    expect(html).toContain('เปลี่ยนยาง 6 เส้น');
  });

  test('weighing still counts in คัน when no unit is given', () =>
    expect(pettyVoucherHtml({ claim, fund, typeName: 'ค่าชั่งน้ำหนัก' })).toContain('คัน'));

  test('the tyre total reads 1,200.00', () =>
    expect(pettyVoucherHtml({ claim: tyreClaim, fund, typeName: 'ค่าปะ-เปลี่ยนยาง', unit: 'เส้น' }))
      .toContain('1,200.00'));
});

describe('Project Code ไม่มีในระบบ — ช่องบนกระดาษเว้นว่าง (ผู้ใช้สั่ง 2026-10-13)', () => {
  const html = pettyVoucherHtml({ claim, fund, typeName: 'ค่าชั่งน้ำหนัก' });
  test('ช่องยังพิมพ์หัวข้อไว้ให้เขียนด้วยมือ', () => expect(html).toMatch(/<span class="l">Project Code<\/span><span class="v"><\/span>/));
  test('เลขที่ใบเป็นแบบตัวอักษรสาขา', () => expect(html).toContain('LB-B02-2610-001'));
});

describe('ของที่เจอตอนพิมพ์จริง 2026-10-13', () => {
  test('วันที่บนหัวใบเป็นวันที่ไทย ไม่ใช่วัน UTC (อนุมัติ 13/10 05:25 น. ต้องขึ้น 13/10)', () => {
    const lateNight = { ...claim, approved_at: '2026-10-12T22:25:51+00:00' } as PettyClaim;
    expect(pettyVoucherHtml({ claim: lateNight, fund, typeName: 'ค่าชั่งน้ำหนัก' }))
      .toContain('<span>วันที่</span><b>13/10/2026</b>');
  });

  test('ใบชั่งนับเป็น "คัน" แม้ spec.atms.unit ของ SKU จะเป็น "งาน"', () => {
    const html = pettyVoucherHtml({ claim, fund, typeName: 'ค่าชั่งน้ำหนัก', unit: undefined });
    expect(html).toMatch(/\d+ คัน/);
    expect(html).not.toMatch(/\d+ งาน/);
  });
});

describe('มาตรฐานเดียวกับใบ Advance (ผู้ใช้สั่ง 2026-10-13)', () => {
  const html = pettyVoucherHtml({ claim, fund, typeName: 'ค่าชั่งน้ำหนัก', logoUrl: 'http://x/mena.png' });

  test('แถบสีหัวกระดาษ + โลโก้ + ชื่อไทย/อังกฤษ', () => {
    expect(html).toContain('class="doc-band"');
    expect(html).toContain('<img class="logo" src="http://x/mena.png"');
    expect(html).toContain('<div class="t1">ใบสำคัญจ่ายเงินสดย่อย</div>');
    expect(html).toContain('(Petty Cash Voucher)');
  });
  test('กล่อง meta เลขที่/วันที่ แบบเดียวกับ Advance', () =>
    expect(html).toMatch(/<div class="meta"><div><span>เลขที่<\/span><b>LB-B02-2610-001<\/b><\/div>/));
  test('หัวข้อมีเลขลำดับ', () => {
    expect(html).toContain('<div class="sec"><span class="n">1</span><h2>ข้อมูลการจ่าย</h2>');
    expect(html).toContain('<span class="n">2</span><h2>รายการ</h2>');
    expect(html).toContain('<span class="n">3</span><h2>ลงนามและอนุมัติ</h2>');
  });
  test('Division เป็น checkbox แบบ Advance ติ๊ก B02', () => {
    expect(html).toContain('<span class="cb checked"></span>B02');
    expect(html).toContain('<span class="cb"></span>B01');
    expect(html).not.toContain('[x]');
  });
  test('กล่องยอดรวมสีเขียวพร้อมตัวอักษร', () => {
    expect(html).toContain('<div class="tot">');
    expect(html).toContain('จำนวนเงิน (ตัวอักษร) : สองร้อยแปดสิบบาทถ้วน');
  });
  test('ตารางลงนาม 4 ช่องตามฟอร์มกระดาษ', () => {
    expect(html).toContain('<table class="sig">');
    for (const t of ['ผู้จ่ายเงิน', 'ผู้รับเงิน', 'หัวหน้าแผนก', 'ผู้อนุมัติ']) expect(html).toContain(`<th>${t}</th>`);
    expect(html).toContain('ลงนามอิเล็กทรอนิกส์ผ่านระบบ menait-service');
  });
  test('ชื่อเอกสารใน Document Control เป็นแบบ Advance', () =>
    expect(html).toContain('Petty Cash Voucher (PC)'));
  test('ไม่มีโครงกล่องเส้นดำแบบเก่าแล้ว', () => expect(html).not.toContain('class="box"'));
  test('หน้าแนบไฟล์ต่อท้ายได้', () =>
    expect(pettyVoucherHtml({ claim, fund, typeName: 'x', attachmentsHtml: '<section class="att">ATT</section>' }))
      .toContain('<section class="att">ATT</section>'));
  test('ไม่มีโลโก้ก็ยังพิมพ์ได้', () => expect(pettyVoucherHtml({ claim, fund, typeName: 'x' })).not.toContain('<img class="logo"'));
});

describe('ใบรับรองแทนใบเสร็จ มาตรฐานเดียวกัน', () => {
  const html = receiptSubstituteHtml({ claim, fund, typeName: 'ค่าชั่งน้ำหนัก', payeePosition: 'เจ้าหน้าที่รับแจ้งซ่อม' });
  test('หัวเอกสาร', () => {
    expect(html).toContain('<div class="t1">ใบรับรองแทนใบเสร็จรับเงิน</div>');
    expect(html).toContain('(Receipt Substitute)');
  });
  test('คำรับรองอยู่ในกล่องข้อตกลงแบบ Advance', () => {
    expect(html).toContain('<ol class="clauses">');
    expect(html).toContain('ไม่สามารถเรียกใบเสร็จรับเงินจากผู้รับเงินได้');
  });
  test('ลงนาม 2 ช่อง', () => {
    expect(html).toContain('<th>ผู้เบิกจ่าย</th>');
    expect(html).toContain('<th>ผู้อนุมัติ</th>');
  });
  test('ชื่อเอกสาร', () => expect(html).toContain('Receipt Substitute (PC)'));
});

describe('ใบสรุปรายการประกอบ — คอลัมน์ตาม spec ของประเภท (ผู้ใช้สั่ง 2026-10-13)', () => {
  const weighSpec = {
    item_based: true,
    item_fields: [
      { key: 'event_date', label: 'วันที่ชั่ง', type: 'date', required: true },
      { key: 'truck', label: 'รถ', type: 'truck', required: true },
      { key: 'truck_type', label: 'ประเภทรถ', type: 'select', required: true },
      { key: 'driver_name', label: 'พจส.', type: 'text' },
      { key: 'ref_no', label: 'เลขที่บัตรชั่ง', type: 'text', required: true },
      { key: 'rate', label: 'ราคา/ครั้ง', type: 'money', required: true },
    ],
  };
  const twoDays = {
    ...claim, amount: 300,
    items: [
      { line_no: 1, event_date: '2026-09-17', truck_code: '161', truck_plate: '71-4285', truck_type: 'โม่ใหญ่', ref_no: '000055', qty: 1, rate: 100, amount: 100, remark: null, driver_name: 'สมชาย ใจดี' },
      { line_no: 2, event_date: '2026-09-17', truck_code: '144', truck_plate: '71-4286', truck_type: 'โม่ใหญ่', ref_no: '000056', qty: 1, rate: 100, amount: 100, remark: null, driver_name: null },
      { line_no: 3, event_date: '2026-09-18', truck_code: '165', truck_plate: '71-9001', truck_type: 'โม่เล็ก', ref_no: '000172', qty: 1, rate: 100, amount: 100, remark: null, driver_name: 'วิชัย' },
    ],
  } as unknown as PettyClaim;
  const html = itemSummaryHtml({ claim: twoDays, fund, typeName: 'ค่าชั่งน้ำหนัก', spec: weighSpec });

  test('หัวเอกสารมาตรฐานเดียวกัน', () => {
    expect(html).toContain('<div class="t1">ใบสรุปรายการ ค่าชั่งน้ำหนัก</div>');
    expect(html).toContain('(Item Summary)');
    expect(html).toContain('Item Summary (PC)');
  });
  test('คอลัมน์มาจาก spec: รถแตกเป็นเบอร์รถ+ทะเบียน', () => {
    for (const h of ['วันที่ชั่ง', 'เบอร์รถ', 'ทะเบียน', 'ประเภทรถ', 'พจส.', 'เลขที่บัตรชั่ง', 'จำนวนเงิน']) {
      expect(html).toContain(`>${h}</th>`);
    }
  });
  test('ทุกแถวพิมพ์ครบ พจส. ที่ว่างเป็นขีด', () => {
    expect(html).toContain('000055');
    expect(html).toContain('สมชาย ใจดี');
    expect(html).toContain('71-9001');
  });
  test('สรุปแยกรายวัน + รวมทั้งสิ้น', () => {
    expect(html).toContain('รวม 17/09/2026');
    expect(html).toContain('2 รายการ');
    expect(html).toContain('รวม 18/09/2026');
    expect(html).toContain('3 รายการ');
    expect(html).toContain('รวมทั้งสิ้น');
    expect(html).toContain('300.00');
  });
  test('ประเภทที่ไม่ใช่รายการรถ พิมพ์เป็นตารางหัวใบ', () => {
    const travelSpec = { item_based: false, header_fields: [
      { key: 'event_date', label: 'วันที่เดินทาง', type: 'date' }, { key: 'route_from', label: 'จาก', type: 'text' },
      { key: 'route_to', label: 'ไป', type: 'text' }, { key: 'rate', label: 'จำนวนเงิน', type: 'money' } ] };
    const travel = { ...claim, expense_type: 'TRAVEL', amount: 243, detail: { route_from: 'คลองตัน', route_to: 'เมกาบางนา' },
      items: [{ line_no: 1, event_date: '2026-09-29', ref_no: 'TRIP-8891', qty: 1, rate: 243, amount: 243, remark: 'ขากลับ' }] } as unknown as PettyClaim;
    const out = itemSummaryHtml({ claim: travel, fund, typeName: 'ค่าเดินทาง', spec: travelSpec });
    expect(out).toContain('คลองตัน');
    expect(out).toContain('เมกาบางนา');
    expect(out).toContain('243.00');
  });
});

describe('ใบสรุปรายการ ครบทุกประเภท (ผู้ใช้สั่ง 2026-10-13)', () => {
  const truckCols = [
    { key: 'event_date', label: 'วันที่', type: 'date', required: true },
    { key: 'truck', label: 'รถ', type: 'truck', required: true },
    { key: 'driver_name', label: 'พจส.', type: 'text' },
  ];
  test('ยาง: มีจำนวนเส้น ราคาต่อเส้น และรายการที่ทำ', () => {
    const spec = { item_based: true, print: { unit: 'เส้น' }, item_fields: [...truckCols,
      { key: 'ref_no', label: 'เลขที่บิล', type: 'text', required: true },
      { key: 'remark', label: 'รายการที่ทำ', type: 'text', required: true },
      { key: 'qty', label: 'จำนวน (เส้น)', type: 'number', required: true },
      { key: 'rate', label: 'ราคา/เส้น', type: 'money', required: true }] };
    const tyre = { ...claim, amount: 1200, items: [{ line_no: 1, event_date: '2026-09-26', truck_code: '6604', truck_plate: '72-8179',
      truck_type: 'โม่ใหญ่', ref_no: 'B-01', qty: 6, rate: 200, amount: 1200, remark: 'เปลี่ยนยาง 6 เส้น', driver_name: 'สมหมาย' }] } as unknown as PettyClaim;
    const html = itemSummaryHtml({ claim: tyre, fund, typeName: 'ค่าปะ-เปลี่ยนยาง', spec, unit: 'เส้น' });
    expect(html).toContain('>จำนวน (เส้น)</th>');
    expect(html).toContain('>ราคา/เส้น</th>');
    expect(html).toContain('>รายการที่ทำ</th>');
    expect(html).toContain('6 เส้น');
    expect(html).toContain('200.00');
    expect(html).toContain('เปลี่ยนยาง 6 เส้น');
    expect(html).toContain('สมหมาย');
  });
  test('ซ่อมฉุกเฉิน: ไม่มีประเภทรถก็พิมพ์ได้ มีอาการ/งานที่ทำ', () => {
    const spec = { item_based: true, item_fields: [...truckCols,
      { key: 'ref_no', label: 'เลขที่ใบเสร็จ/ใบแจ้งซ่อม', type: 'text', required: true },
      { key: 'remark', label: 'อาการ/งานที่ทำ', type: 'text', required: true },
      { key: 'rate', label: 'จำนวนเงิน', type: 'money', required: true }] };
    const repair = { ...claim, amount: 850, items: [{ line_no: 1, event_date: '2026-09-20', truck_code: '1093', truck_plate: '71-1325',
      truck_type: null, ref_no: 'MR-7', qty: 1, rate: 850, amount: 850, remark: 'เปลี่ยนสายพาน', driver_name: null }] } as unknown as PettyClaim;
    const html = itemSummaryHtml({ claim: repair, fund, typeName: 'ค่าซ่อมฉุกเฉิน', spec });
    expect(html).toContain('>อาการ/งานที่ทำ</th>');
    expect(html).toContain('เปลี่ยนสายพาน');
    expect(html).not.toContain('>ประเภทรถ</th>');
    expect(html).toContain('รวม 20/09/2026');
  });
  test('ทางด่วน: ตารางหัวใบ ขึ้นด่าน/ลงด่าน และรถ', () => {
    const spec = { item_based: false, header_fields: [
      { key: 'event_date', label: 'วันที่ใช้ทาง', type: 'date' }, { key: 'payee_name', label: 'ผู้สำรองจ่าย', type: 'employee' },
      { key: 'truck', label: 'รถ', type: 'truck' }, { key: 'driver', label: 'พจส.', type: 'employee' },
      { key: 'route_from', label: 'ขึ้นด่าน', type: 'text' }, { key: 'route_to', label: 'ลงด่าน', type: 'text' },
      { key: 'receipt_no', label: 'เลขที่ใบเสร็จ', type: 'text' }, { key: 'rate', label: 'จำนวนเงิน', type: 'money' } ] };
    const toll = { ...claim, expense_type: 'TOLL', amount: 65, driver_name: 'ประยุทธ', receipt_no: 'R-99',
      detail: { route_from: 'ดินแดง', route_to: 'บางนา' },
      items: [{ line_no: 1, event_date: '2026-09-21', truck_code: '161', truck_plate: '71-4285', ref_no: null, qty: 1, rate: 65, amount: 65, remark: null }] } as unknown as PettyClaim;
    const html = itemSummaryHtml({ claim: toll, fund, typeName: 'ค่าทางด่วน', spec });
    for (const s of ['ดินแดง', 'บางนา', '161 / 71-4285', 'ประยุทธ', 'R-99', '65.00', '21/09/2026']) expect(html).toContain(s);
  });
});

describe('บล็อกลงนามอยู่ด้านล่างของหน้าเสมอ (ผู้ใช้สั่ง 2026-10-13)', () => {
  const docs = {
    voucher: pettyVoucherHtml({ claim, fund, typeName: 'x' }),
    receipt: receiptSubstituteHtml({ claim, fund, typeName: 'x' }),
    summary: itemSummaryHtml({ claim, fund, typeName: 'x', spec: { item_based: true, item_fields: [{ key: 'ref_no', label: 'เลข', type: 'text' }] } }),
  };
  for (const [name, html] of Object.entries(docs)) {
    test(`${name}: ส่วนลงนามอยู่ในบล็อกที่ดันลงล่าง`, () => {
      expect(html).toContain('<div class="sign-block">');
      expect(html).toContain('.sign-block { margin-top: auto;');
      expect(html).toContain('.doc-part { display: flex; flex-direction: column; min-height:');
    });
  }
  test('ลงนามเป็นส่วนสุดท้ายของหน้า ก่อนหน้าแนบไฟล์', () => {
    const html = pettyVoucherHtml({ claim, fund, typeName: 'x', attachmentsHtml: '<section class="att">A</section>' });
    expect(html.indexOf('<div class="sign-block">')).toBeLessThan(html.indexOf('<section class="att">'));
    expect(html.indexOf('<div class="sign-block">')).toBeGreaterThan(html.indexOf('<div class="tot">'));
  });
});

describe('ชื่อพนักงานบนใบ แทนรหัส (ผู้ใช้สั่ง 2026-10-13)', () => {
  const named = { ...claim, created_by_name: 'กฤตบุญ ลายเงิน', approved_by_name: 'ณรงค์กรณ์ อัจฉริยญาติ' } as PettyClaim;
  const namedFund = { ...fund, holder_name: 'ณรงค์กรณ์ อัจฉริยญาติ' };
  test('ใบสำคัญจ่าย: ผู้จ่ายเงิน/ผู้อนุมัติ/ผู้เปิดใบ เป็นชื่อ', () => {
    const html = pettyVoucherHtml({ claim: named, fund: namedFund, typeName: 'x' });
    expect(html).toContain('<i>ณรงค์กรณ์ อัจฉริยญาติ</i>');
    expect(html).toContain('กฤตบุญ ลายเงิน');
    expect(html).not.toContain('<i>670108</i>');
  });
  test('ตรา e-Signature ยังขึ้นชื่อผู้อนุมัติ', () =>
    expect(pettyVoucherHtml({ claim: named, fund: namedFund, typeName: 'x' })).toContain('ณรงค์กรณ์ อัจฉริยญาติ'));
  test('ไม่มีชื่อก็ถอยไปใช้รหัส ไม่ว่าง', () => {
    const html = pettyVoucherHtml({ claim, fund, typeName: 'x' });
    expect(html).toContain('<i>12345</i>');
  });
  test('ใบสรุปรายการ: ผู้เปิดใบเป็นชื่อ', () =>
    expect(itemSummaryHtml({ claim: named, fund: namedFund, typeName: 'x', spec: { item_based: true, item_fields: [{ key: 'ref_no', label: 'เลข', type: 'text' }] } }))
      .toContain('<i>กฤตบุญ ลายเงิน</i>'));
});
