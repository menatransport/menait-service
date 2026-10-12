# SPEC — เบิกเงินสดย่อย (Petty Cash)

ฉบับ 2026-10-12 · ต่อจาก `REQUIREMENT.md` · สถานะ: **รอผู้ใช้ตรวจก่อนทำแผนพัฒนา**

---

## 1. ขอบเขต

**ทำ**

- หัวข้อใหม่ "เบิกเงินสดย่อย" ในกลุ่ม Finance Service ของ menait-service
- 5 ประเภทการเบิกตั้งต้น (ชั่งน้ำหนัก · ทางด่วน · ปะ-เปลี่ยนยาง · ซ่อมฉุกเฉิน · เดินทางคนขับ)
  โดยกติกาเอกสารของแต่ละประเภทเก็บเป็น master แก้เองได้
- โฟลว์ 7 สถานะ: เจ้าหน้าที่เปิดใบ → ผู้อนุมัติอนุมัติและโอน → ส่งบัญชี → การเงินปิดรอบคืนยอด
- ด่านเอกสาร (บล็อก) และด่านกันซ้ำ (เตือน) ที่ขั้นอนุมัติ
- ตัดยอด/คืนยอด Advance ของผู้อนุมัติ
- พิมพ์ใบสำคัญจ่ายเงินสดย่อย · ใบสรุปปะหน้าแยกตามเจ้าหน้าที่ · ดาวน์โหลด Excel

**ไม่ทำในเฟสนี้**

- ไม่เปิด DD ให้เองใน ATMS (กรอกเลขเอง)
- ไม่คำนวณภาษีหัก ณ ที่จ่าย (TBC — ดู §12)
- ไม่มีหน้าจอสำหรับคนขับ/พจส. และยังไม่รับข้อมูลจาก MenaGO (เฟสถัดไป แต่ออกแบบเผื่อ)
- ไม่ย้ายใบเก่าที่เป็นเล่มกระดาษเข้าระบบ

## 2. สถาปัตยกรรม

ต่อยอดโครงเดิมของ Advance ทั้งหมด ไม่สร้างแพลตฟอร์มใหม่

| ชั้น | ของเดิมที่ใช้ซ้ำ |
|---|---|
| FE | `menait-service` (Next.js, bun) branch **menaIT-v2** · โฟลเดอร์ `app/finance/*`, `lib/finance/*` |
| API route (BFF) | `app/api/finance/*` ใช้ `lib/finance/server.ts` — `requireUser` / `requireFinance` / `beUrl` / `proxy` |
| BE | `api-ncac` (FastAPI + SQLAlchemy + Postgres) · `routes/finance/`, `models/finance_model.py`, `schemas/finance_schema.py` |
| ใบงาน | `form_submissions` (ตัวใบและไฟล์แนบ — **ไม่ใช้ approval engine ของมัน** ดู §4.1) |
| ไฟล์แนบ | กลไก S3 เดิม (`lib/s3`, `FORM_ID_PATTERN`) |
| เลขเอกสาร | `generate_form_id` ใน `routes/forms/form_submission_routes.py` (เพิ่ม branch ของ petty) |

**หลักการ**: ใบเบิกเงินสดย่อย 1 ใบ = `form_submissions` 1 แถว + `fin_petty_claims` 1 แถว
แบบเดียวกับที่ Advance เป็น `form_submissions` + `fin_advances` เพื่อให้ไฟล์แนบ เลขเอกสาร
และ log ใช้ของเดิมได้ · **ต่างกันที่การอนุมัติ** — petty อนุมัติขั้นเดียวจากผู้อนุมัติประจำกองทุน
ไม่ผ่าน approval engine ตามวงเงินของ Advance (§4.1)

## 3. Data model (Postgres · migration ใหม่ `2026-10-12_finance_petty_cash.sql`)

### 3.1 `fin_petty_funds` — master กองทุน

| คอลัมน์ | ชนิด | หมายเหตุ |
|---|---|---|
| id | serial PK | |
| branch_code | varchar(4) | `01`–`05` (สกท/สสบ/สลบ/ศรย/สขก) |
| division_code | varchar(8) | `B01`–`B04`, `A01`–`A05`, `PJS` |
| holder_employee_id | varchar(50) | ผู้อนุมัติประจำกองทุน |
| fund_limit | numeric(12,2) | วงเงินกองทุน |
| is_active | boolean default true | |
| created_at / updated_at / updated_by | | |

- unique `(branch_code, division_code)` เฉพาะแถวที่ `is_active`
- ผู้อนุมัติ 1 คนถือได้หลายกองทุน

### 3.2 `fin_petty_expense_types` — master ประเภทการเบิก

| คอลัมน์ | ชนิด | หมายเหตุ |
|---|---|---|
| code | varchar(20) PK | `WEIGH`, `TOLL`, `TIRE`, `REPAIR`, `TRAVEL` |
| name_th | varchar(120) | ชื่อที่แสดง |
| atms_sku | varchar(20) | รหัสสินค้า ATMS เช่น `LB00038` (null ได้) |
| sort_order | int | |
| is_active | boolean | |
| **spec** | **jsonb** | นิยามช่องกรอกและเอกสารที่บังคับ |

`spec` (jsonb) — กติกาที่ด่านเอกสารใช้ตรวจ อ่านชุดเดียวกับที่ฟอร์มใช้เรนเดอร์

```jsonc
{
  "fields": [
    { "key": "weigh_date", "label": "วันที่ชั่ง", "type": "date", "required": true },
    { "key": "truck_plate", "label": "ทะเบียนรถ", "type": "plate", "required": true },
    { "key": "truck_type",  "label": "ประเภทรถ", "type": "text", "required": true },
    { "key": "weigh_no",    "label": "เลขใบชั่ง", "type": "text", "required": true }
  ],
  "attachments": [
    { "key": "weigh_slip", "label": "ใบชั่งน้ำหนัก (สำเนา)", "required": true,  "max": 3 },
    { "key": "transfer",   "label": "หลักฐานโอนเงิน",        "required": true,  "max": 3 },
    { "key": "other",      "label": "อื่นๆ",                 "required": false, "max": 3 }
  ],
  "rules": [
    { "when": "amount >= 500", "require_field": "dd_no", "at": "BEFORE_SUBMIT_TO_ACCOUNTING" },
    { "when": "payee_is_person && bill_is_company", "require_attachment": "id_card", "at": "BEFORE_APPROVE" }
  ],
  "duplicate_check": { "keys": ["expense_date", "truck_plate"], "days": 7 }
}
```

- `at` มี 2 ค่า: `BEFORE_APPROVE` (บล็อกการอนุมัติ) และ `BEFORE_SUBMIT_TO_ACCOUNTING` (บล็อกตอนส่งบัญชี)
  — เลข DD ใช้ค่าหลังตามที่ตกลง
- ใช้ jsonb แทนตารางย่อย เพราะกติกาเป็นชุดที่อ่าน-เขียนทั้งก้อนเสมอ และต้องเพิ่มประเภทใหม่ได้โดยไม่ migrate

### 3.3 `fin_petty_claims` — ใบเบิก

| คอลัมน์ | ชนิด | หมายเหตุ |
|---|---|---|
| id | serial PK | |
| submission_id | int FK → form_submissions.id, unique | |
| form_id | varchar(80) unique | `03-B02-2610-001` |
| fund_id | int FK → fin_petty_funds.id | |
| expense_type | varchar(20) FK → fin_petty_expense_types.code | |
| expense_date | date not null | วันที่บนใบ (วันที่เปิด/อนุมัติ) — วันที่เกิดค่าใช้จ่ายจริงอยู่ที่รายการลูก |
| driver_employee_id | varchar(50) | พจส. เจ้าของค่าใช้จ่าย |
| driver_name | varchar(150) | snapshot ตอนเปิดใบ |
| period_from / period_to | date | ช่วงวันที่ของค่าใช้จ่ายในใบ (ใบจริงครอบหลายวัน) |
| amount | numeric(12,2) not null | **ยอดรวม คำนวณจาก `fin_petty_claim_items` ไม่ใช่ช่องกรอก** |
| toll_amount | numeric(12,2) | เฉพาะค่าเดินทาง |
| detail | jsonb | ค่าของ `spec.fields` ทั้งชุด |
| dd_no | varchar(50) | เลขใบรับสินค้า ATMS |
| receipt_no | varchar(50) | เลขที่ใบเสร็จ/บิลเงินสด |
| wht_applicable | boolean default false | ติ๊กว่าเข้าเงื่อนไขหัก (บัญชีทำต่อ) |
| created_by | varchar(50) | **เจ้าหน้าที่ผู้กรอก** |
| source | varchar(10) default `'WEB'` | `WEB` / `MENAGO` — เผื่อเฟสถัดไป |
| dup_override_reason | text | เหตุผลเมื่ออนุมัติทับกรณีซ้ำ |
| approved_by / approved_at | | ขั้น 3 |
| transfer_date / transfer_slip_at | | ขั้น 4 |
| submitted_to_acc_at | | ขั้น 5 |
| review_remark / reviewed_by / reviewed_at | | ขั้น 6 |
| batch_id | int FK → fin_petty_batches.id | ขั้น 7 |
| status | varchar(30) not null | ดู §4 |
| created_at / updated_at | | |

index: `(fund_id, status)` · `(status)` · `(created_by)`

### 3.3.1 `fin_petty_claim_items` — รายการในใบ

ใบจริงใบเดียวมีได้หลายรายการ (ตัวอย่างค่าชั่งน้ำหนัก: 16 คัน 3 ราคา ในใบเดียว)
จึงต้องมีตารางลูก — รายละเอียดเต็มและที่มาอยู่ใน `DESIGN-WEIGH.md` §3.1

| คอลัมน์ | ชนิด |
|---|---|
| id serial PK · claim_id FK ON DELETE CASCADE · line_no int |
| event_date date not null — **วันที่เกิดค่าใช้จ่ายจริง ใช้ตรวจซ้ำ** |
| truck_code varchar(20) · truck_plate varchar(20) · truck_type varchar(30) |
| ref_no varchar(50) — เลขอ้างอิง (ใบชั่ง / ใบเสร็จ / Trip Code) |
| qty numeric(10,2) · rate numeric(12,2) · amount numeric(12,2) = qty × rate |
| remark varchar(255) |

index: `(claim_id)` · `(event_date, truck_code)` · `(event_date, truck_plate)`

ประเภทที่เป็นยอดเดียว (`item_based: false` เช่น ค่าทางด่วน ค่าเดินทาง) ให้ระบบสร้างรายการลูก
1 แถวอัตโนมัติ ตารางเดียวจึงรองรับทั้งสองแบบ ไม่ต้องแยก schema

### 3.4 `fin_petty_batches` — รอบคืนยอด

| คอลัมน์ | ชนิด |
|---|---|
| id serial PK · fund_id FK · batch_no varchar(30) · closed_by · closed_at · total_amount numeric(12,2) · remark text |

`batch_no` = `{branch}-{division}-{YYMM}-B{n}`

### 3.5 `fin_petty_logs`

เหมือน `fin_advance_logs`: `claim_id`, `action`, `changes jsonb`, `remark`, `action_by`, `created_at`
action: `CREATE` / `SUBMIT` / `RETURN` / `APPROVE` / `TRANSFER` / `SUBMIT_ACC` / `SEND_BACK` / `ACC_PASS` / `CLOSE`

### 3.6 เลขเอกสาร

`{branch_code}-{division_code}-{YYMM}-{NNN}` · รีเซ็ตทุกเดือน · แยกต่อสาขา+แผนก

ใช้ `form_sequences` เดิม โดย `form_code = "PC-{branch}-{division}"` และ `year = YYMM (Bangkok)`
เพิ่มสาขาใน `generate_form_id` ให้คืนรูปแบบนี้ ใช้ `SELECT … FOR UPDATE` ตัวเดิม จึงกันเลขชนกันได้อยู่แล้ว

## 4. การอนุมัติ และสถานะ

### 4.1 อนุมัติขั้นเดียวจบ — ไม่ใช้ TOA

**ผู้อนุมัติถูกระบุไว้ในแผนก (กองทุน) และมีคนเดียว** กดอนุมัติแล้วจบ ไม่มีขั้นที่ 2

- ผู้อนุมัติมาจาก `fin_petty_funds.holder_employee_id` ของสาขา+แผนกบนใบนั้น ไม่ได้มาจากระดับตำแหน่งหรือวงเงิน
- **ไม่ใช้ `fin_approval_tiers` / TOA ของ Advance** และไม่ผูกกับ form approval engine เดิม
  — ต่างจากที่เคยคุยกันไว้ตอนแรก ย่อหน้านี้คือข้อสรุป
- ผลตามมา: ตัดยอดที่การกดอนุมัติครั้งเดียวนั้นได้เลย ไม่ต้องรอหลายขั้น (ง่ายกว่าของ Advance มาก)
- ไม่มีวงเงินที่ทำให้ต้องขึ้นผู้อนุมัติระดับสูงกว่า — ตัวคุมคือวงเงินกองทุนกับยอดคงเหลือใน §6 แทน

### 4.2 สถานะและการเปลี่ยนสถานะ

| ค่า | ป้ายไทย | ใครทำให้เปลี่ยน |
|---|---|---|
| `PENDING_APPROVAL` | รออนุมัติ | เจ้าหน้าที่กดส่ง |
| `RETURNED` | ตีกลับผู้เบิก | ผู้อนุมัติ |
| `APPROVED` | อนุมัติแล้ว / รอโอน | ผู้อนุมัติ · **ตัดยอดที่นี่** |
| `TRANSFERRED` | โอนแล้ว รอเคลียร์เอกสาร | ผู้อนุมัติ (แนบสลิป) |
| `AWAITING_REVIEW` | รอบัญชีตรวจ | ผู้อนุมัติกดส่งบัญชี |
| `SENT_BACK` | ส่งกลับแก้ไข | บัญชี |
| `CLOSED` | คืนยอดแล้ว / ปิด | การเงินปิดรอบ · **คืนยอดที่นี่** |

```
PENDING_APPROVAL ─approve─► APPROVED ─transfer─► TRANSFERRED ─submit─► AWAITING_REVIEW
        ▲   └─return──► RETURNED ─resubmit─┘                                  │
        │                                                      ┌──pass────────┤
        └──────────────────────────────────────────────────────┘              │
                                   CLOSED ◄──close batch── (การเงิน)           │
                       AWAITING_REVIEW ◄─resubmit─ SENT_BACK ◄───send back────┘
```

ใช้ชื่อสถานะ/ป้ายคู่กับ `lib/finance/status.ts` เดิม แยกเป็น `lib/finance/petty-status.ts` ชุดใหม่
(ไม่ปนกับ `AdvanceStatus` เพราะเส้นทางต่างกัน)

## 5. ด่านตรวจก่อนอนุมัติ

ฟังก์ชันเดียวใช้ร่วม FE/BE: `validateClaim(claim, typeSpec, stage)` → `{ missing: Field[], warnings: Warning[] }`

- **BE เป็นผู้ตัดสิน** — `POST /approve` เรียก validate ซ้ำเสมอ ไม่เชื่อ FE
- FE ใช้ผลเดียวกันเพื่อ disable ปุ่มและแสดงว่าขาดอะไร
- stage: `APPROVE` (ขั้น 3) และ `SUBMIT_ACC` (ขั้น 5 — ตรวจ DD และสลิปโอน)
- ขาด → **403 พร้อมรายการที่ขาด** ไม่ใช่ 400 เปล่า ๆ
- **แจ้งเจ้าหน้าที่ผู้เปิดใบ (`created_by`) ทุกครั้งที่ด่านทำงาน** ไม่ใช่แจ้งแต่ผู้อนุมัติ
  เพราะคนที่ต้องแก้คือเจ้าหน้าที่ · ใบขึ้นในแท็บ "ต้องแก้ไข" ของเขาพร้อมรายการที่ขาด
  และส่งอีเมลด้วยกลไกเดิมของ Advance (`services/finance/finance_mail.py`)

**ด่านซ้ำ — ทำงานระดับรายการ ไม่ใช่ระดับใบ และมีสองระดับ**

| ระดับ | คีย์ | ช่วง | ผล |
|---|---|---|---|
| เข้ม | `ref_no` + `truck_code` + `truck_plate` | ย้อน 1 ปี | **บล็อก ไม่มีทับ** |
| อ่อน | `event_date` + รถ | ±7 วัน | **เตือน** ทับได้พร้อมเหตุผล |

ด่านเข้มคือเหตุการณ์เดียวกันแน่นอน (บัตรชั่งใบนั้นของรถคันนั้น) ส่วนด่านอ่อนเป็นสัญญาณ
ให้คนตัดสิน — ชั่ง 2 เที่ยวในวันเดียวกันเกิดขึ้นได้จริง

`GET /finance/petty/claims/duplicate-check?event_date&truck&type`
คืน *รายการ* ที่ `event_date` ห่างไม่เกิน ±7 วัน และรถตรงกัน พร้อม `form_id` ของใบที่มันอยู่
ตรวจทั้งข้ามใบและภายในใบเดียวกัน (ของจริงมีทะเบียนซ้ำในใบเดียวมาแล้ว)
เตือนตอนเปิดใบและตอนเปิดหน้าอนุมัติ · อนุมัติทับได้แต่ต้องส่ง `dup_override_reason` ไม่งั้น 422
**แจ้งทั้งเจ้าหน้าที่ผู้เปิดใบและผู้อนุมัติ** พร้อม `form_id` ของใบที่ซ้ำให้กดดูได้

## 6. ยอด Advance ของผู้อนุมัติ

> จุดที่ต้องระวังที่สุดของงานนี้ เพราะเงินไปผูกกับโมดูลเดิม

**นิยาม** — ยอดคงเหลือของผู้อนุมัติคนหนึ่ง
```
available = advance_outstanding(employee_id) − petty_committed(employee_id)

advance_outstanding = Σ fin_advances.amount_paid ที่ fin_status ∈ (PAID, CLEARING_SUBMITTED, SENT_BACK)
petty_committed     = Σ fin_petty_claims.amount ที่ status ∈ (APPROVED, TRANSFERRED, AWAITING_REVIEW, SENT_BACK)
```

- **ไม่เขียนทับ `fin_advances`** ใด ๆ — petty เป็นชั้นบนที่หักจากยอดที่ Advance จ่ายไว้แล้ว
  ตัดสินใจแบบนี้เพราะยอด Advance เป็นของจริงที่บัญชีกับการเงินเป็นเจ้าของ (กติกาที่เคยตกลงกันไว้ของ AP คือค่าที่ฝ่ายบัญชีกดคือค่าจริง ห้ามระบบเขียนทับ)
- "หักยอด" ที่ขั้น 3 = การที่ใบเข้าสถานะ `APPROVED` ทำให้ `petty_committed` เพิ่ม — ไม่มีการ UPDATE ยอดที่ไหน
- "คืนยอด" ที่ขั้น 7 = ใบเข้าสถานะ `CLOSED` ทำให้ `petty_committed` ลด
- **ติดลบได้** — ถ้า `available < amount` ให้อนุมัติต่อได้ แต่ต้องตอบกลับ `warning: INSUFFICIENT_BALANCE`
  และ FE แสดงกล่องเตือนก่อนกดยืนยัน
- endpoint: `GET /finance/petty/funds/{id}/balance` → `{ advance_outstanding, petty_committed, available, fund_limit }`

## 7. API (BE `api-ncac` · prefix `/finance/petty`)

| Method | Path | ใคร | ทำอะไร |
|---|---|---|---|
| GET | `/expense-types` | ทุกคนที่ล็อกอิน | master ประเภท + spec |
| PUT | `/expense-types/{code}` | แอดมิน/บัญชี | แก้ spec |
| GET | `/funds` | ตามสิทธิ์ | รายการกองทุน (ผู้อนุมัติเห็นเฉพาะของตัวเอง) |
| POST/PUT | `/funds` `/funds/{id}` | แอดมิน | master กองทุน |
| GET | `/funds/{id}/balance` | holder, บัญชี, การเงิน | §6 |
| GET | `/claims` | ตามสิทธิ์ | list + filter (fund, status, month, type, driver, created_by) + paging |
| POST | `/claims` | เจ้าหน้าที่ | เปิดใบ (ออก form_id, สถานะ PENDING_APPROVAL) |
| GET | `/claims/{form_id}` | ตามสิทธิ์ | รายละเอียด + ผลตรวจ validate + ใบที่ซ้ำ |
| PUT | `/claims/{form_id}` | ผู้กรอก (เฉพาะ PENDING_APPROVAL/RETURNED) | แก้แล้วส่งใหม่ |
| POST | `/claims/{form_id}/approve` | ผู้อนุมัติของกองทุน | ตรวจด่าน → APPROVED |
| POST | `/claims/{form_id}/return` | ผู้อนุมัติ | RETURNED + เหตุผล (บังคับ) |
| POST | `/claims/{form_id}/transfer` | ผู้อนุมัติ | วันโอน + สลิป → TRANSFERRED |
| POST | `/claims/{form_id}/submit-accounting` | ผู้อนุมัติ | ตรวจ DD → AWAITING_REVIEW |
| POST | `/claims/{form_id}/review` | บัญชี | `{action: PASS \| SEND_BACK, remark}` |
| GET | `/claims/duplicate-check` | เจ้าหน้าที่/ผู้อนุมัติ | §5 |
| POST | `/batches` | การเงิน | ปิดรอบจากรายการ claim id → CLOSED |
| GET | `/batches` | บัญชี/การเงิน | ประวัติรอบ |
| GET | `/claims/export` | ตามสิทธิ์ | Excel |

FE route เงา 1:1 ใต้ `app/api/finance/petty/*` ทำหน้าที่ guard + proxy เท่านั้น
`employee_id` มาจาก session เสมอ ไม่รับจาก browser (ตามแบบ `advances/route.ts`)

## 8. หน้าจอ (FE)

| path | ใคร | เนื้อหา |
|---|---|---|
| `/finance/petty/new` | เจ้าหน้าที่ | ฟอร์มแบบ `advance/new` + **ช่องเลือกประเภทการเบิก** ด้านบน แล้วเรนเดอร์ช่อง/ชุดรูปจาก `spec` ของประเภทนั้น · เตือนซ้ำทันทีเมื่อกรอกวันที่+ทะเบียนครบ |
| `/finance/petty` | เจ้าหน้าที่ | ใบที่ตัวเองเปิด แยกแท็บตามสถานะ |
| `/finance/petty/approvals` | ผู้อนุมัติ | คิวของกองทุนตัวเอง · การ์ดยอดคงเหลือ · ปุ่มอนุมัติ/ตีกลับ/โอน/ส่งบัญชี · แผงบอกว่าขาดเอกสารอะไร |
| `/finance/petty/accounting` | บัญชี | คิว `AWAITING_REVIEW` ทุกกองทุน · ผ่าน/ส่งกลับ |
| `/finance/petty/batches` | การเงิน | เลือกใบที่ผ่านบัญชี → ปิดรอบ → คืนยอด |
| `/finance/petty/master` | แอดมิน | master กองทุน + master ประเภทการเบิก |
| พิมพ์ | ทุกบทบาทที่เห็นใบ | ใบสำคัญจ่ายเงินสดย่อย · ใบรับรองแทนใบเสร็จ · DD (ต่อใบ) · ใบสรุปปะหน้า (ต่อเจ้าหน้าที่ต่อรอบ) |

เมนู `/home`: เพิ่ม 4 รายการในกลุ่ม `finance` ของ `app/home/menu-groups.ts`
(เบิกเงินสดย่อย · ติดตามใบเบิก · อนุมัติเงินสดย่อย · งานเงินสดย่อย ฝ่ายบัญชี-การเงิน)

## 9. เอกสารที่พิมพ์

1. **ใบสำคัญจ่ายเงินสดย่อย** — คุมให้เหมือนฟอร์มกระดาษเดิม: หัวบริษัท · เลขที่ (ของระบบ) · จ่ายให้ · วันที่ ·
   Project Code · ติ๊ก Division · เลือกสาขา · ตารางรายการ 6 บรรทัด (Account Code / รายการ / จำนวน / จำนวนเงิน / หมายเหตุ) ·
   ช่องเซ็น 4 ช่อง โดยช่อง "ผู้อนุมัติ" ประทับ e-Signature จากการกดจริงในระบบ (แบบเดียวกับ Advance)
   ไม่มีช่องเล่มที่/เลขที่โรงพิมพ์อีกต่อไป
2. **ใบรับรองแทนใบเสร็จรับเงิน** — ใบรวมหลายรายการต่อช่วงวัน สำหรับประเภทที่ไม่มีใบเสร็จ (ค่าชั่งน้ำหนัก)
3. **ใบรับสินค้า (DD) FC101-06** — เจ้าหน้าที่กรอกแค่เลข DD ระบบอ่านรายละเอียดจาก
   `atms.stockmovement_v5` (ฟิลด์ `DD`) มาจัดเป็นฟอร์มให้ปริ้น · อ่านอย่างเดียว ไม่เขียนกลับ ·
   เก็บ snapshot ไว้ที่ `fin_petty_claims.dd_snapshot` (jsonb) ตอนปริ้น เพื่อกันค่าเปลี่ยนเมื่อ
   ATMS แก้ย้อนหลัง · ยอดรวมใน DD ไม่ตรงยอดใบเบิก = **เตือน** · ต้องมี index `{DD:1}` ก่อนเปิดใช้
   (รายละเอียด DESIGN-WEIGH.md §6.3)
4. **ใบสรุปปะหน้า** — 1 ชุดต่อเจ้าหน้าที่ต่อรอบ รวมทุกใบที่คนนั้นเปิด พร้อมยอดรวม
5. **Excel** — ใช้ `lib/finance/export.ts` เดิมเป็นแบบ

## 10. สิทธิ์

| บทบาท | เห็น | ทำ |
|---|---|---|
| เจ้าหน้าที่ | ใบที่ตัวเองเปิด | เปิดใบ · แก้เมื่อถูกตีกลับ |
| ผู้อนุมัติ | ทุกใบของกองทุนที่ตัวเองถือ (ตาม `fin_petty_funds.holder_employee_id`) | อนุมัติ · ตีกลับ · โอน · ส่งบัญชี |
| บัญชี | ทุกกองทุน เฉพาะสถานะ ≥ AWAITING_REVIEW | ผ่าน · ส่งกลับ · แก้ master ประเภท |
| การเงิน | ทุกกองทุน | ปิดรอบ · คืนยอด |
| แอดมิน | ทุกอย่าง | master ทั้งสองตัว |

`is_finance` เดิมครอบทั้งบัญชีและการเงิน — ต้อง **แยกสองบทบาทออกจากกัน** (ดู §12 ข้อ 3)

## 11. ลำดับการสร้าง (vertical slice ก่อน)

1. **S1 ฐาน** — migration + master 2 ตัว + หน้า master + seed 5 ประเภท
2. **S2 เส้นบาง** — ประเภทเดียว (ค่าชั่งน้ำหนัก): เปิดใบ → อนุมัติ → โอน → ส่งบัญชี → บัญชีผ่าน → ปิดรอบ
   ครบทั้ง BE/FE โดยยังไม่มีด่านเอกสาร
3. **S3 ด่าน** — validate ตาม spec + ด่านซ้ำ + ยอดคงเหลือและคำเตือนติดลบ
4. **S4 ครบประเภท** — อีก 4 ประเภทผ่าน master ล้วน ไม่แก้โค้ดฟอร์ม
5. **S5 เอกสาร** — พิมพ์ใบสำคัญจ่าย · ใบรับรองแทนใบเสร็จ · DD จาก Mongo · ใบปะหน้า · Excel
6. **S6 เก็บงาน** — สิทธิ์ · log · เมนู · แจ้งเตือน

> S2 คือจุดพิสูจน์ว่าโครงถูก ถ้า S2 ผ่านได้โดยไม่ต้องแก้ของ Advance เดิม แปลว่าการตัดสินใจใน §6 ใช้ได้

## 12. ข้อที่ยังต้องตอบ (บล็อกการลงมือบางส่วน)

1. ~~ผู้อนุมัติกับ TOA~~ — **ตอบแล้ว: อนุมัติขั้นเดียวจบ** ดู §4.1
2. **ใครแก้ master ประเภทการเบิก** — บัญชี หรือ แอดมินไอที
3. **แยกบทบาทบัญชี/การเงิน** — ตอนนี้ระบบมีแค่ `is_finance` ตัวเดียว ต้องเพิ่ม flag หรือ permission group ใหม่
4. **หัก ณ ที่จ่าย (TBC)** — ระบบคำนวณ gross-up ให้ หรือแค่ติ๊ก `wht_applicable`
5. **master คนขับ/ทะเบียนรถ** — database/collection ใน MongoDB ตัวไหน และเข้าถึงจาก api-ncac ทางไหน
6. **ใครกรอกเลข DD** — เจ้าหน้าที่ หรือ ผู้อนุมัติ
7. **Account Code / Project Code** — เลือกจากรายการหรือบัญชีเติมเอง
8. **ใบเสร็จตัวจริงค่าทางด่วน** — ต้องมีสถานะติดตามว่าบัญชีได้รับตัวจริงแล้วหรือยังไหม

ข้อ 1–3 ต้องตอบก่อนเริ่ม S2 · ข้อ 4–8 ตอบก่อน S4/S5 ได้

## 13. การทดสอบ

- **หน่วย (BE)** — validate ตาม spec ทุกประเภท · ตรวจซ้ำ ±7 วัน · คำนวณ available · เปลี่ยนสถานะตามสิทธิ์ · ออกเลขเอกสารพร้อมกันหลายคน
- **หน่วย (FE)** — `lib/finance/petty-*.ts` ทุกไฟล์มี `.test.ts` คู่ ตามแบบ `lib/finance` เดิม
- **เส้นทางเต็ม** — เปิดใบ → ปิดรอบ 1 รอบ บน Mongo/Postgres สำเนา ไม่แตะ prod
- **ของจริง** — ยิงใบตัวอย่างจากเอกสารชุด `Reference_data/เงินสดย่อย` (ชั่งน้ำหนัก 1,640 บาท · ปะยาง 1,200 บาท)
  แล้วเทียบว่าใบสำคัญจ่ายที่ปริ้นออกมาตรงกับของจริง

---

## ที่มา

`REQUIREMENT.md` ฉบับ 2026-10-12 · โค้ดเดิม `menait-service@menaIT-v2` และ `api-ncac@main` ·
เอกสารตัวอย่างจริงใน `~/Documents/github/Reference_data/เงินสดย่อย/`
