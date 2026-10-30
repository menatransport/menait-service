import { describe, expect, test } from 'bun:test';
import { itemSummaryHtml, pettyVoucherHtml, receiptSubstituteHtml, travelRequestFormHtml } from './petty-voucher';
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
  test('shows the division of the fund — branch is in the form id (สาขาแบบติ๊กเอาออก 29/10/2026)', () => {
    expect(html).toContain('3B02 ศลบ - ยานยนต์');
    expect(html).toContain('LB-B02-2610-001');
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

describe('รหัสค่าใช้จ่ายของบัญชี บนใบสำคัญจ่าย (ตารางบัญชี 2026-10-14)', () => {
  const html = pettyVoucherHtml({ claim, fund, typeName: 'ค่าชั่งน้ำหนัก' });
  test('พิมพ์รหัส + ชื่อแผนกตามบัญชี แทนช่อง Project Code เดิม', () => {
    expect(html).toMatch(/<span class="l">รหัสค่าใช้จ่ายของผู้เบิก \(บัญชี\)<\/span><span class="v">3B02 ศลบ - ยานยนต์<\/span>/);
    expect(html).not.toContain('Project Code');
  });
  test('เลขที่ใบเป็นแบบตัวอักษรสาขา', () => expect(html).toContain('LB-B02-2610-001'));
});

describe('ใบรับรองแทนใบเสร็จไม่มีกล่องเลขที่ (ผู้ใช้สั่ง 2026-10-13)', () => {
  const html = receiptSubstituteHtml({ claim, fund, typeName: 'ค่าชั่งน้ำหนัก' });
  test('กล่อง meta เหลือแค่วันที่', () => {
    expect(html).not.toMatch(/<div class="meta"><div><span>เลขที่<\/span>/);
    expect(html).toMatch(/<div class="meta"><div><span>วันที่<\/span><b>\d{2}\/\d{2}\/\d{4}<\/b><\/div><\/div>/);
  });
  test('ใบสำคัญจ่ายยังมีเลขที่อยู่', () =>
    expect(pettyVoucherHtml({ claim, fund, typeName: 'ค่าชั่งน้ำหนัก' })).toMatch(/<span>เลขที่<\/span><b>LB-B02-2610-001<\/b>/));
});

describe('จ่ายให้ มีธนาคารและเลขบัญชี (ผู้ใช้สั่ง 2026-10-13)', () => {
  test('ใบสำคัญจ่ายพิมพ์ ชื่อ · ธนาคาร เลขบัญชี', () => {
    const withBank = { ...claim, detail: { payee_bank: 'KBANK', payee_account_no: '1234567890' } } as PettyClaim;
    expect(pettyVoucherHtml({ claim: withBank, fund, typeName: 'ค่าชั่งน้ำหนัก' }))
      .toContain(`${claim.payee_name} · ธนาคารกสิกรไทย 123-4-56789-0`);
  });
  test('ใบเก่าไม่มีบัญชี ยังพิมพ์แค่ชื่อ', () =>
    expect(pettyVoucherHtml({ claim, fund, typeName: 'ค่าชั่งน้ำหนัก' })).not.toContain(`${claim.payee_name} ·`));
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
  test('ไม่มีแถวติ๊ก Division และสาขาแล้ว (ผู้ใช้สั่ง 29/10/2026)', () => {
    expect(html).not.toContain('<span class="lbl">Division</span>');
    expect(html).not.toContain('<span class="lbl">สาขา</span>');
    expect(html).not.toContain('class="cbs"');
  });
  test('กล่องยอดรวมสีเขียวพร้อมตัวอักษร', () => {
    expect(html).toContain('<div class="tot">');
    expect(html).toContain('จำนวนเงิน (ตัวอักษร) : สองร้อยแปดสิบบาทถ้วน');
  });
  test('ตารางลงนาม 4 ช่อง ผู้ขอเบิก → หัวหน้าแผนก → ผู้อนุมัติและผู้โอนเงิน → ผู้รับเงิน (flow v3 30/10/2026)', () => {
    expect(html).toContain('<table class="sig">');
    const order = ['ผู้ขอเบิก', 'หัวหน้าแผนก', 'ผู้อนุมัติและผู้โอนเงิน', 'ผู้รับเงิน'].map(t => html.indexOf(`<th>${t}</th>`));
    expect(order[0]).toBeGreaterThan(0);
    expect(order[0]).toBeLessThan(order[1]);
    expect(order[1]).toBeLessThan(order[2]);
    expect(order[2]).toBeLessThan(order[3]);
    const sigHead = html.split('<table class="sig">')[1]?.split('</thead>')[0] ?? '';
    expect(sigHead.match(/<th>/g)?.length).toBe(4);
    expect(html).not.toContain('<th>ผู้จ่ายเงิน</th>');
    expect(html).toContain('ลงนามอิเล็กทรอนิกส์ผ่านระบบ menait-service');
  });
  test('ไม่มีช่องผู้เปิดใบในส่วนข้อมูลแล้ว ชื่อไปอยู่ช่องผู้ขอเบิก', () =>
    expect(html).not.toContain('<span class="l">ผู้เปิดใบ</span>'));
  test('ชื่อเอกสารใน Document Control เป็นแบบ Advance', () =>
    expect(html).toContain('Petty Cash Voucher (PC)'));
  test('ไม่มีโครงกล่องเส้นดำแบบเก่าแล้ว', () => expect(html).not.toContain('class="box"'));
  test('ไม่มีหน้าแนบไฟล์ — เอกสารแนบอยู่ในใบสรุปรายการเท่านั้น (ผู้ใช้สั่ง 29/10/2026)', () => {
    const withAtt = { claim, fund, typeName: 'x', attachmentsHtml: '<section class="att">ATT</section>' };
    expect(pettyVoucherHtml(withAtt)).not.toContain('class="att"');
  });
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
    expect(html).toContain('ไม่อาจเรียกเก็บใบเสร็จรับเงินจากผู้รับได้');
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
    expect((html.match(/>จำนวนเงิน<\/th>/g) ?? []).length).toBe(1); // ไม่มีจำนวน → ราคาเท่ายอด ไม่พิมพ์สองคอลัมน์
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
  test('ลงนามเป็นส่วนสุดท้ายของหน้า ก่อนหน้าแนบไฟล์ (ใบสรุปรายการ)', () => {
    const html = itemSummaryHtml({ claim, fund, typeName: 'x', attachmentsHtml: '<section class="att">A</section>',
      spec: { item_based: true, item_fields: [{ key: 'ref_no', label: 'เลข', type: 'text' }] } });
    expect(html.indexOf('<div class="sign-block">')).toBeGreaterThan(0);
    expect(html.indexOf('<div class="sign-block">')).toBeLessThan(html.indexOf('<section class="att">'));
  });
  test('ใบสรุปรายการเป็นใบเดียวที่ต่อหน้าแนบไฟล์', () => {
    const withAtt = { claim, fund, typeName: 'x', attachmentsHtml: '<section class="att">A</section>' };
    expect(itemSummaryHtml({ ...withAtt, spec: null })).toContain('<section class="att">A</section>');
    expect(receiptSubstituteHtml(withAtt)).not.toContain('class="att"');
    expect(travelRequestFormHtml(withAtt)).not.toContain('class="att"');
  });
});

describe('ชื่อพนักงานบนใบ แทนรหัส (ผู้ใช้สั่ง 2026-10-13)', () => {
  const named = { ...claim, created_by_name: 'กฤตบุญ ลายเงิน', approved_by_name: 'ณรงค์กรณ์ อัจฉริยญาติ' } as PettyClaim;
  const namedFund = { ...fund, holder_name: 'ณรงค์กรณ์ อัจฉริยญาติ' };
  test('ใบสำคัญจ่าย: ผู้ขอเบิก/ผู้อนุมัติ เป็นชื่อ', () => {
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

describe('ตรงกับฟอร์มกระดาษจริง (ดูตัวอย่างที่ผู้ใช้ส่ง 2026-10-13)', () => {
  const html = pettyVoucherHtml({ claim, fund, typeName: 'ค่าชั่งน้ำหนัก' });
  test('ชื่อบริษัทมี (มหาชน)', () => expect(html).toContain('บริษัท มีนาทรานสปอร์ต จำกัด (มหาชน)'));
  test('ตารางมีคอลัมน์ ลำดับ / รายการ / จำนวน (หน่วย) / จำนวนเงิน / หมายเหตุ — ไม่มี Account Code (ผู้ใช้สั่ง 29/10/2026)', () => {
    for (const h of ['ลำดับ', 'รายการ', 'จำนวน (หน่วย)', 'จำนวนเงิน', 'หมายเหตุ']) expect(html).toContain(`>${h}</th>`);
    expect(html).not.toContain('Account Code');
    const firstRow = html.split('<table class="items">')[1]?.split('<tbody>')[1]?.split('</tr>')[0] ?? '';
    expect(firstRow.match(/<td/g)?.length).toBe(5);
    expect(html).not.toContain('>ราคา/หน่วย</th>');
  });
  test('ใบชั่งรวมตามราคา บอกจำนวนแยกประเภทรถในรายการ', () =>
    expect(html).toContain('100 บาท = 2 คัน'));
  test('แถวที่มีรถคันเดียว หมายเหตุเขียน ทะเบียน (เบอร์รถ) แบบใบยางจริง', () => {
    const tyre = { ...claim, items: [{ line_no: 1, event_date: '2026-09-15', truck_code: '6604', truck_plate: '72-8179',
      truck_type: 'โม่ใหญ่', ref_no: 'B-01', qty: 6, rate: 200, amount: 1200, remark: 'เปลี่ยนยาง 6 เส้น' }] } as unknown as PettyClaim;
    expect(pettyVoucherHtml({ claim: tyre, fund, typeName: 'ค่าปะ-เปลี่ยนยาง', unit: 'เส้น' })).toContain('ทะเบียน 72-8179 (6604)');
  });
});

describe('ใบรับรองแทนใบเสร็จ ตรงต้นฉบับ', () => {
  const html = receiptSubstituteHtml({ claim, fund, typeName: 'ค่าชั่งน้ำหนัก', payeePosition: 'เจ้าหน้าที่รับแจ้งซ่อม' });
  test('หัวมี (มหาชน) (สาขา00003) ที่อยู่สาขา และเลขผู้เสียภาษี', () => {
    expect(html).toContain('บริษัท มีนาทรานสปอร์ต จำกัด (มหาชน) (สาขา00003)');
    expect(html).toContain('เลขที่ 1 ซอยแฮปปี้เพลส 16 แขวงคลองสามประเวศ เขตลาดกระบัง จังหวัดกรุงเทพมหานคร 10520');
    expect(html).toContain('เลขประจำตัวผู้เสียภาษี 0107563000207');
  });
  test('ตาราง วัน เดือน ปี / รายละเอียดรายจ่าย / จำนวนเงิน / หมายเหตุ — จำนวนอยู่ในรายละเอียด', () => {
    for (const h of ['วัน เดือน ปี', 'รายละเอียดรายจ่าย', 'จำนวนเงิน', 'หมายเหตุ']) expect(html).toContain(`>${h}</th>`);
    expect(html).not.toContain('>จำนวน</th>');
    expect(html).toContain('100 บาท 2 คัน');
  });
  test('ถ้อยคำรับรองตรงต้นฉบับ', () => {
    expect(html).toContain('ขอรับรองว่า รายจ่ายข้างต้นนี้ไม่อาจเรียกเก็บใบเสร็จรับเงินจากผู้รับได้ และข้าพเจ้าได้จ่ายไปในงานของทางบริษัทฯโดยแท้');
    expect(html).toContain('ตั้งแต่วันที่ 17/09/2026 ถึงวันที่ 24/09/2026');
  });
  test('ลงชื่อ (ผู้เบิกจ่าย) และ (ผู้อนุมัติ)', () => {
    expect(html).toContain('<th>ผู้เบิกจ่าย</th>');
    expect(html).toContain('<th>ผู้อนุมัติ</th>');
  });
});

describe('แบบฟอร์มขอใช้บริการแกร็บแท็กซี่ — ระบบพิมพ์ให้จากข้อมูลที่กรอก', () => {
  const travel = { ...claim, expense_type: 'TRAVEL', amount: 243, payee_name: 'แวน หอมทอง',
    detail: { dept: 'จัดส่ง', leg: 'ขากลับ', route_from: 'อู่ สลบ.', route_to: 'เมกาบางนา คลองตัน', reason: 'เรียกให้ ฮาเล็ง เจเอดี กลับแพลนท์' },
    items: [{ line_no: 1, event_date: '2026-09-01', ref_no: 'jzjw3v', qty: 1, rate: 243, amount: 243, remark: null }] } as unknown as PettyClaim;
  const html = travelRequestFormHtml({ claim: travel, fund, typeName: 'ค่าเดินทางคนขับ' });
  test('หัวเรื่องและเอกสารประกอบ 1', () => {
    expect(html).toContain('แบบฟอร์มขอใช้บริการแกร็บแท็กซี่');
    expect(html).toContain('เอกสารประกอบ 1');
  });
  test('ผู้ใช้ วันที่ แผนก (ติ๊กจัดส่ง) เหตุที่ใช้', () => {
    expect(html).toContain('แวน หอมทอง');
    expect(html).toContain('01/09/2026');
    expect(html).toContain('<span class="cb checked"></span>จัดส่ง');
    expect(html).toContain('<span class="cb"></span>ยานยนต์');
    expect(html).toContain('เรียกให้ ฮาเล็ง เจเอดี กลับแพลนท์');
  });
  test('ขาไป/ขากลับ ติ๊กขากลับ พร้อมรหัส จาก ไป', () => {
    expect(html).toContain('<span class="cb checked"></span>ขากลับ');
    expect(html).toContain('<span class="cb"></span>ขาไป');
    expect(html).toContain('jzjw3v');
    expect(html).toContain('อู่ สลบ.');
    expect(html).toContain('เมกาบางนา คลองตัน');
  });
  test('ลงนาม ผู้อนุมัติ และ ผู้ขอเบิก', () => {
    expect(html).toContain('<th>ผู้ขอเบิก</th>');
    expect(html).toContain('<th>ผู้อนุมัติ</th>');
  });
});

describe('ตราในช่องลงนามของใบสำคัญจ่าย (ผู้ใช้สั่ง 29/10/2026)', () => {
  const named = { ...claim, created_by_name: 'กฤตบุญ ลายเงิน', created_at: '2026-09-24T02:10:00Z',
    approved_by_name: 'ณรงค์กรณ์ อัจฉริยญาติ' } as PettyClaim;
  const cell = (html: string, n: number) => html.split('<td class="space">')[n]?.split('</td>')[0] ?? '';
  test('ผู้ขอเบิก: ตรา e-Signature ชื่อผู้เปิดใบ ตามเวลาเปิดใบ', () => {
    const c = cell(pettyVoucherHtml({ claim: named, fund, typeName: 'x' }), 1);
    expect(c).toContain('✔ e-Signature');
    expect(c).toContain('กฤตบุญ ลายเงิน');
    expect(c).toContain('24/09/2026');
  });
  test('หัวหน้าแผนก: ตราของหัวหน้าตอนอนุมัติใบ', () => {
    const headed = { ...named, head_approved_by: '600050', head_approved_by_name: 'สมชาย หัวหน้า',
      head_approved_at: '2026-09-24T05:00:00Z' } as PettyClaim;
    const c = cell(pettyVoucherHtml({ claim: headed, fund, typeName: 'x' }), 2);
    expect(c).toContain('✔ e-Signature');
    expect(c).toContain('สมชาย หัวหน้า');
    expect(c).toContain('24/09/2026');
  });
  test('ใบเก่าที่ไม่มีขั้นหัวหน้า: ช่องหัวหน้าแผนกว่าง ไม่มีตรา', () => {
    const c = cell(pettyVoucherHtml({ claim: named, fund, typeName: 'x' }), 2);
    expect(c).not.toContain('e-Signature');
  });
  test('ผู้อนุมัติและผู้โอนเงิน: ตราของเจ้าของเงินสดตอนอนุมัติจ่าย', () => {
    const c = cell(pettyVoucherHtml({ claim: named, fund, typeName: 'x' }), 3);
    expect(c).toContain('✔ e-Signature');
    expect(c).toContain('ณรงค์กรณ์ อัจฉริยญาติ');
  });
  test('ผู้รับเงิน: ตราเขียน "รับเงินโอน" กับวันที่โอน', () => {
    const html = pettyVoucherHtml({ claim: named, fund, typeName: 'x' });
    const c = cell(html, 4);
    expect(c).toContain('✔ รับเงินโอน');
    expect(c).not.toContain('e-Signature');
    expect(c).toContain('อัญชัญ น่วมมี');
    expect(c).toContain('25/09/2026');
    expect(c).toContain('LB-B02-2610-001');
  });
  test('ยังไม่โอน: ช่องผู้รับเงินว่าง ไม่มีตรา', () => {
    const c = cell(pettyVoucherHtml({ claim: { ...named, transfer_date: null }, fund, typeName: 'x' }), 4);
    expect(c).not.toContain('รับเงินโอน');
  });
  test('ใบเก่าที่ BE ไม่ส่งเวลาเปิดใบ: ช่องผู้ขอเบิกมีแค่ชื่อ ไม่มีตรา', () => {
    const html = pettyVoucherHtml({ claim: { ...named, created_at: undefined }, fund, typeName: 'x' });
    expect(cell(html, 1)).toBe('');
    expect(html).toContain('<i>กฤตบุญ ลายเงิน</i>');
  });
});

describe('รหัสค่าใช้จ่ายของผู้เบิก = ศูนย์และแผนกที่เลือกตอนเปิดใบ (ผู้ใช้สั่ง 29/10/2026)', () => {
  test('ใบที่เลือกแล้ว พิมพ์รหัสที่เลือก', () =>
    expect(pettyVoucherHtml({ claim: { ...claim, cost_center: '3B04' }, fund, typeName: 'x' }))
      .toMatch(/<span class="l">รหัสค่าใช้จ่ายของผู้เบิก \(บัญชี\)<\/span><span class="v">3B04 ศลบ - ความปลอดภัย<\/span>/));
  test('ใบเก่าที่ไม่มี พิมพ์รหัสแผนกจากวงเงิน format เดียวกัน', () =>
    expect(pettyVoucherHtml({ claim, fund, typeName: 'x' }))
      .toMatch(/<span class="l">รหัสค่าใช้จ่ายของผู้เบิก \(บัญชี\)<\/span><span class="v">3B02 ศลบ - ยานยนต์<\/span>/));
  test('ใบสรุปรายการใช้ช่องเดียวกัน แทน "สาขา · Division"', () => {
    const html = itemSummaryHtml({ claim: { ...claim, cost_center: '3B04' }, fund, typeName: 'x', spec: null });
    expect(html).toMatch(/<span class="l">รหัสค่าใช้จ่ายของผู้เบิก \(บัญชี\)<\/span><span class="v">3B04 ศลบ - ความปลอดภัย<\/span>/);
    expect(html).not.toContain('สาขา · Division');
  });
});

describe('ช่องวงเงินสดย่อยบน PDF แบบเดียวกับหน้าเปิดใบ (ผู้ใช้สั่ง 29/10/2026)', () => {
  const held = { ...fund, holder_name: 'สุทธิพงษ์ แจ่มฟ้า' };
  // ป้ายช่องบอกแล้วว่าวงเงินสดย่อย ค่าไม่ต้องขึ้นต้นซ้ำ (ผู้ใช้สั่ง 29/10/2026)
  const want = /<span class="l">วงเงินสดย่อย<\/span><span class="v">ลาดกระบัง - ยานยนต์ · สุทธิพงษ์ แจ่มฟ้า<\/span>/;
  test('ใบสำคัญจ่าย', () => expect(pettyVoucherHtml({ claim, fund: held, typeName: 'x' })).toMatch(want));
  test('ใบสรุปรายการ', () => expect(itemSummaryHtml({ claim, fund: held, typeName: 'x', spec: null })).toMatch(want));
  test('ไม่มีชื่อผู้ถือเงิน ใช้รหัสพนักงานแทน', () =>
    expect(pettyVoucherHtml({ claim, fund, typeName: 'x' })).toContain('<span class="v">ลาดกระบัง - ยานยนต์ · 12345</span>'));
});
