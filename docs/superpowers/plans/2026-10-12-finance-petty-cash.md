# เบิกเงินสดย่อย (Petty Cash) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** เพิ่มโมดูล "เบิกเงินสดย่อย" ในกลุ่ม Finance Service — เจ้าหน้าที่เปิดใบแทน พจส. ผู้อนุมัติประจำกองทุนอนุมัติและโอน ด่านเอกสารบล็อกใบที่หลักฐานไม่ครบ แล้วการเงินปิดรอบคืนยอด Advance

**Architecture:** ตารางใหม่ 6 ตัวใน Postgres เดียวกับ Advance โดย **ไม่แตะ `fin_advances`** — ยอดคงเหลือคำนวณสด (`advance_outstanding − petty_committed`) ไม่มีการ UPDATE ยอดที่ไหน · กติกาเอกสารของแต่ละประเภทการเบิกเก็บเป็น `jsonb` ใน master ชุดเดียวที่ทั้งฟอร์มและด่านตรวจอ่านร่วมกัน เพิ่มประเภทที่ 6 ได้โดยไม่แก้โค้ด · BE เป็นผู้ตัดสินด่านเสมอ FE แค่สะท้อนผล

**Tech Stack:** BE `api-ncac` — FastAPI + SQLAlchemy + Postgres, pytest · FE `menait-service` — Next.js (App Router) + bun + Tailwind, `bun test` · MongoDB `atms.stockmovement_v5` (อ่านอย่างเดียว) สำหรับรายละเอียด DD

**Spec:** `docs/superpowers/specs/2026-10-12-finance-petty-cash-spec.md` และ `docs/superpowers/specs/2026-10-12-finance-petty-cash-weigh-design.md` (ต้นฉบับที่ผู้ใช้ตรวจอยู่ที่ `~/Documents/cluade_workspace/petty-cash-requirement/SPEC.md` · `DESIGN-WEIGH.md`)

## Global Constraints

- BE repo `api-ncac` branch `main` · FE repo `menait-service` branch **`menaIT-v2`** เท่านั้น (เลิกใช้ `plug` แล้ว)
- `git pull` ก่อน commit ทุกครั้ง · **ห้าม `git push` โดยไม่ถาม**
- **ห้ามเขียน/อัปเดต `fin_advances` หรือ `fin_advance_clear_items`** ทุกกรณี — ยอดที่บัญชีและการเงินกรอกคือค่าจริง
- **ห้ามเขียนอะไรกลับไปที่ MongoDB** — `atms.stockmovement_v5` อ่านอย่างเดียว
- ห้ามรัน query หนัก/ไม่มีขอบเขตกับ Mongo prod · ทุก query ต้องมี filter + `maxTimeMS` + `limit`
- สถานะ 7 ค่าเท่านี้: `PENDING_APPROVAL` `RETURNED` `APPROVED` `TRANSFERRED` `AWAITING_REVIEW` `SENT_BACK` `CLOSED`
- เลขเอกสาร `{branch}-{division}-{YYMM}-{NNN}` รีเซ็ตทุกเดือน แยกต่อสาขา+แผนก · `form_code = "PC-{branch}-{division}"`
- ภาษาไทยในระบบต้องอ่านเหมือนคนเขียน ไม่ใช่ AI — ป้ายสถานะและข้อความเตือนใช้คำเดียวกับที่ `SPEC.md` §4.2 เขียนไว้ตรงตัว
- อนุมัติ **ขั้นเดียวจบ** — ห้ามเรียก `fin_approval_tiers` / `determine_initial_approval` / form approval engine
- ทุกไฟล์ใน `lib/finance/petty-*.ts` ต้องมี `.test.ts` คู่ (แพตเทิร์นเดิมของ `lib/finance`)
- `employee_id` มาจาก session เสมอ ห้ามรับจาก browser (แพตเทิร์น `app/api/finance/advances/route.ts`)
- ด่านซ้ำเข้ม: คีย์ `ref_no` + `truck_code` + `truck_plate` ย้อน 1 ปี = **บล็อก ไม่มีทับ** · ด่านอ่อน: `event_date` + รถ ±7 วัน = **เตือน ทับได้พร้อมเหตุผล**
- เลขที่บัตรชั่ง (`ref_no`) **บังคับทุกแถว** สำหรับประเภท `WEIGH`

## Review Focus

ห้าเรื่องที่สเปกบอกเป็นนัยแต่ไม่มีงานไหนทดสอบตรง ๆ และจะกัดคนใช้จริงที่สุด — แต่ละข้อมีเทสต์ที่ฝังไว้ในงานที่เป็นเจ้าของโค้ดนั้นแล้ว

1. **ทะเบียนคนละฟอร์แมตหลุดด่านซ้ำเข้ม** — `71-4285` / `71 4285` / `71-4285 ` ควรนับเป็นคันเดียวกัน ไม่งั้นเบิกซ้ำได้ด้วยการเว้นวรรค (เทสต์อยู่ Task 2 `normalize_plate`)
2. **สองคนกดเปิดใบพร้อมกันในกองทุน+เดือนเดียวกัน** ต้องได้เลขคนละใบ ไม่ใช่เลขชนแล้วใบหนึ่งหาย (เทสต์อยู่ Task 5)
3. **ปัดเศษยอดรวม** — `qty × rate` ที่มีทศนิยมหลายแถว ผลรวมที่พิมพ์ต้องเท่ากับ `amount` ที่เก็บ ไม่ต่างกัน 0.01 (เทสต์อยู่ Task 2 `claim_total`)
4. **กดปุ่มจากแท็บที่เปิดค้างไว้** — แก้ใบที่สถานะเลยขั้นไปแล้ว หรือกดอนุมัติใบที่อนุมัติแล้ว ต้องได้ 409 พร้อมบอกสถานะปัจจุบัน ไม่ใช่เขียนทับเงียบ ๆ (เทสต์อยู่ Task 2 `assert_transition` และ Task 6)
5. **Mongo ช้าหรือล่มตอนดึง DD** — หน้าจอต้องไม่ค้าง ใบต้องยังส่งบัญชีได้ ขึ้นแค่ข้อความว่าดึงไม่ได้ (เทสต์อยู่ Task 13)

---

## สองข้อที่แผนนี้ต่างจาก SPEC.md (อ่านก่อนเริ่ม)

เจอจากการอ่านโค้ดจริง ทั้งสองข้อลดงานและลดความเสี่ยง:

**1. ไม่สร้างแถวใน `form_submissions`** (SPEC §2 เขียนว่าสร้าง)

เหตุผล: ของที่คิดว่าต้องพึ่ง `form_submissions` จริง ๆ ไม่ได้พึ่ง

| ของที่ต้องใช้ | ความจริงจากโค้ด |
|---|---|
| ไฟล์แนบ | คีย์ด้วย **สตริง** `form_id` ใน S3 (`BASE_PATH/<form_id>/...`) ไม่มี FK ไปตาราง — `lib/s3.ts:15` |
| เลขเอกสาร | `generate_form_id()` ใช้แค่ตาราง `form_sequences` ไม่ต้องมี submission |
| log | petty มี `fin_petty_logs` ของตัวเองอยู่แล้ว (SPEC §3.5) |

และถ้าสร้างจะเกิดบั๊กจริง: `FormSubmission` ต้องผูก `form_master_id` + ชุด question values และ `filterByScope()` (`lib/finance/scope.ts`) แยกได้แค่ `it` กับ `advance` — ใบ petty จะถูกนับเป็นฟอร์ม IT แล้วโผล่ในรายการของทีมไอทีทันที

ผลที่ตามมา: `fin_petty_claims` **ไม่มี** คอลัมน์ `submission_id` · `form_id` เป็น unique key ของใบ

**2. `FORM_ID_PATTERN` รองรับรูปแบบเลขใหม่อยู่แล้ว ไม่ต้องแก้**

`/^[A-Za-z0-9_-]+-\d{4}-\d{3,}$/` ทดกับ `03-B02-2610-001` ผ่าน (`03-B02` ตกใน `[A-Za-z0-9_-]+`) — ห้ามแก้ regex นี้ มันคุมความปลอดภัยของ path ไฟล์แนบทั้งระบบ มีเทสต์ยืนยันใน Task 4

## File Structure

### BE — `api-ncac`

| ไฟล์ | หน้าที่ |
|---|---|
| `scripts/migrations/2026-10-12_finance_petty_cash.sql` | สร้าง 6 ตาราง + index + seed 5 ประเภท |
| `models/finance_petty_model.py` | ORM 6 ตัว — **แยกไฟล์จาก `finance_model.py`** เพราะคนละโฟลว์ และ `finance_model.py` จะโตเกิน |
| `schemas/finance_petty_schema.py` | Pydantic in/out |
| `services/finance/petty_logic.py` | กฎล้วน ไม่มี DB ไม่มี FastAPI — สถานะ ยอดรวม normalize ทะเบียน เลขเอกสาร |
| `services/finance/petty_validate.py` | ด่านเอกสารจาก `spec` jsonb + ด่านซ้ำสองระดับ (ล้วน รับข้อมูลที่ repo ดึงมาแล้ว) |
| `services/finance/petty_repo.py` | query/commit ทั้งหมดของ petty |
| `services/finance/petty_atms.py` | อ่าน DD จาก `atms.stockmovement_v5` (Mongo) |
| `services/finance/petty_mail.py` | แจ้งเจ้าหน้าที่/ผู้อนุมัติ ต่อยอด `finance_mail.py` |
| `routes/finance/petty_routes.py` | endpoint ทั้งหมดใต้ `/finance/petty` |
| `tests/finance/test_petty_*.py` | เทสต์ต่อโมดูล |

### FE — `menait-service`

| ไฟล์ | หน้าที่ |
|---|---|
| `lib/finance/petty-status.ts` (+`.test.ts`) | 7 สถานะ ป้ายไทย สีป้าย การเปลี่ยนสถานะที่อนุญาต |
| `lib/finance/petty-spec.ts` (+`.test.ts`) | อ่าน `spec` jsonb → ช่องที่ต้องเรนเดอร์ · ตรวจซ้ำฝั่ง FE (สะท้อนผล BE) |
| `lib/finance/petty-items.ts` (+`.test.ts`) | ยอดรวมรายการลูก · normalize ทะเบียน · แปลงรหัสรถที่วางมาเป็นแถว ("เพิ่มหลายคัน") |
| `lib/finance/petty-print.ts` (+`.test.ts`) | จัดกลุ่มรายการตามราคา+ประเภทรถ สำหรับใบพิมพ์ |
| `lib/finance/petty-access.ts` (+`.test.ts`) | ใครเห็น/ทำอะไรได้ |
| `app/api/finance/petty/**/route.ts` | BFF guard + proxy เงา 1:1 กับ BE |
| `app/finance/petty/page.tsx` · `new/page.tsx` · `approvals/` · `accounting/` · `batches/` · `master/` · `[form_id]/` | หน้าจอ |
| `app/finance/components/petty/*.tsx` | ItemGrid · AddManyTrucksDialog · GatePanel · BalanceCard · PettyPrintSheet |
| `app/home/menu-groups.ts:99-113` | เพิ่มเมนูในกลุ่ม finance |

**เกณฑ์แบ่งไฟล์** — `petty_logic.py` ห้ามมี import ของ SQLAlchemy/FastAPI (เทสต์ได้โดยไม่ต้องมี DB) · `petty_validate.py` รับ dict ที่ repo เตรียมไว้ ไม่ query เอง · route ไม่มีกฎธุรกิจ เรียก logic/validate/repo เท่านั้น — แพตเทิร์นเดียวกับ `advance_logic` / `advance_repo` / `advance_routes` ที่มีอยู่

---

## S1 — ฐาน

### Task 1: ตารางและ ORM

**Files:**
- Create: `api-ncac/scripts/migrations/2026-10-12_finance_petty_cash.sql`
- Create: `api-ncac/models/finance_petty_model.py`
- Test: `api-ncac/tests/finance/test_petty_model.py`

**Interfaces:**
- Consumes: `database.Base`
- Produces: `FinPettyFund` `FinPettyExpenseType` `FinPettyClaim` `FinPettyClaimItem` `FinPettyBatch` `FinPettyLog` (ชื่อ attribute ตรงกับคอลัมน์ทุกตัว)

- [ ] **Step 1: เขียน migration**

สร้าง `scripts/migrations/2026-10-12_finance_petty_cash.sql`:

```sql
-- เบิกเงินสดย่อย (petty cash) — spec 2026-10-12
CREATE TABLE IF NOT EXISTS fin_petty_funds (
  id                 serial PRIMARY KEY,
  branch_code        varchar(4)  NOT NULL,
  division_code      varchar(8)  NOT NULL,
  holder_employee_id varchar(50) NOT NULL,
  fund_limit         numeric(12,2),
  is_active          boolean     NOT NULL DEFAULT true,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  updated_by         varchar(50)
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_fin_petty_funds_active
  ON fin_petty_funds (branch_code, division_code) WHERE is_active;
CREATE INDEX IF NOT EXISTS ix_fin_petty_funds_holder ON fin_petty_funds (holder_employee_id);

CREATE TABLE IF NOT EXISTS fin_petty_expense_types (
  code       varchar(20) PRIMARY KEY,
  name_th    varchar(120) NOT NULL,
  atms_sku   varchar(20),
  sort_order int NOT NULL DEFAULT 0,
  is_active  boolean NOT NULL DEFAULT true,
  spec       jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by varchar(50)
);

CREATE TABLE IF NOT EXISTS fin_petty_batches (
  id           serial PRIMARY KEY,
  fund_id      int NOT NULL REFERENCES fin_petty_funds(id),
  batch_no     varchar(30) NOT NULL UNIQUE,
  total_amount numeric(12,2) NOT NULL DEFAULT 0,
  remark       text,
  closed_by    varchar(50),
  closed_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS fin_petty_claims (
  id                  serial PRIMARY KEY,
  form_id             varchar(80) NOT NULL UNIQUE,
  fund_id             int NOT NULL REFERENCES fin_petty_funds(id),
  expense_type        varchar(20) NOT NULL REFERENCES fin_petty_expense_types(code),
  expense_date        date NOT NULL,
  period_from         date,
  period_to           date,
  driver_employee_id  varchar(50),
  driver_name         varchar(150),
  payee_name          varchar(150),
  amount              numeric(12,2) NOT NULL DEFAULT 0,
  detail              jsonb NOT NULL DEFAULT '{}'::jsonb,
  dd_no               varchar(50),
  dd_snapshot         jsonb,
  receipt_no          varchar(50),
  wht_applicable      boolean NOT NULL DEFAULT false,
  created_by          varchar(50) NOT NULL,
  source              varchar(10) NOT NULL DEFAULT 'WEB',
  dup_override_reason text,
  return_reason       text,
  approved_by         varchar(50),
  approved_at         timestamptz,
  transfer_date       date,
  transfer_slip_at    timestamptz,
  submitted_to_acc_at timestamptz,
  review_remark       text,
  reviewed_by         varchar(50),
  reviewed_at         timestamptz,
  batch_id            int REFERENCES fin_petty_batches(id),
  status              varchar(30) NOT NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ck_fin_petty_claims_status CHECK (status IN
    ('PENDING_APPROVAL','RETURNED','APPROVED','TRANSFERRED','AWAITING_REVIEW','SENT_BACK','CLOSED')),
  CONSTRAINT ck_fin_petty_claims_amount CHECK (amount >= 0)
);
CREATE INDEX IF NOT EXISTS ix_fin_petty_claims_fund_status ON fin_petty_claims (fund_id, status);
CREATE INDEX IF NOT EXISTS ix_fin_petty_claims_status     ON fin_petty_claims (status);
CREATE INDEX IF NOT EXISTS ix_fin_petty_claims_created_by ON fin_petty_claims (created_by);

CREATE TABLE IF NOT EXISTS fin_petty_claim_items (
  id          serial PRIMARY KEY,
  claim_id    int NOT NULL REFERENCES fin_petty_claims(id) ON DELETE CASCADE,
  line_no     int NOT NULL,
  event_date  date NOT NULL,
  truck_code  varchar(20),
  truck_plate varchar(20),
  truck_type  varchar(30),
  ref_no      varchar(50),
  qty         numeric(10,2) NOT NULL DEFAULT 1,
  rate        numeric(12,2) NOT NULL,
  amount      numeric(12,2) NOT NULL,
  remark      varchar(255)
);
CREATE INDEX IF NOT EXISTS ix_fin_petty_items_claim ON fin_petty_claim_items (claim_id);
CREATE INDEX IF NOT EXISTS ix_fin_petty_items_date_code  ON fin_petty_claim_items (event_date, truck_code);
CREATE INDEX IF NOT EXISTS ix_fin_petty_items_date_plate ON fin_petty_claim_items (event_date, truck_plate);
-- ด่านซ้ำเข้ม: บัตรชั่งใบนั้นของรถคันนั้น
CREATE INDEX IF NOT EXISTS ix_fin_petty_items_hard_dup
  ON fin_petty_claim_items (ref_no, truck_code, truck_plate);

CREATE TABLE IF NOT EXISTS fin_petty_logs (
  id         serial PRIMARY KEY,
  claim_id   int NOT NULL REFERENCES fin_petty_claims(id) ON DELETE CASCADE,
  action     varchar(30) NOT NULL,
  changes    jsonb,
  remark     text,
  action_by  varchar(50),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_fin_petty_logs_claim ON fin_petty_logs (claim_id);
```

- [ ] **Step 2: เขียนเทสต์ที่ยังไม่ผ่าน**

`tests/finance/test_petty_model.py`:

```python
from models.finance_petty_model import (
    FinPettyBatch, FinPettyClaim, FinPettyClaimItem, FinPettyExpenseType, FinPettyFund, FinPettyLog,
)

PETTY_TABLES = {
    FinPettyFund: "fin_petty_funds",
    FinPettyExpenseType: "fin_petty_expense_types",
    FinPettyClaim: "fin_petty_claims",
    FinPettyClaimItem: "fin_petty_claim_items",
    FinPettyBatch: "fin_petty_batches",
    FinPettyLog: "fin_petty_logs",
}


def test_table_names():
    for model, name in PETTY_TABLES.items():
        assert model.__tablename__ == name


def test_claim_has_no_submission_id():
    # แผน ข้อ 1: petty ไม่ผูกกับ form_submissions เลย
    assert "submission_id" not in FinPettyClaim.__table__.columns


def test_claim_columns_match_migration():
    expected = {
        "id", "form_id", "fund_id", "expense_type", "expense_date", "period_from", "period_to",
        "driver_employee_id", "driver_name", "payee_name", "amount", "detail", "dd_no", "dd_snapshot",
        "receipt_no", "wht_applicable", "created_by", "source", "dup_override_reason", "return_reason",
        "approved_by", "approved_at", "transfer_date", "transfer_slip_at", "submitted_to_acc_at",
        "review_remark", "reviewed_by", "reviewed_at", "batch_id", "status", "created_at", "updated_at",
    }
    assert set(FinPettyClaim.__table__.columns.keys()) == expected


def test_item_columns_match_migration():
    expected = {
        "id", "claim_id", "line_no", "event_date", "truck_code", "truck_plate", "truck_type",
        "ref_no", "qty", "rate", "amount", "remark",
    }
    assert set(FinPettyClaimItem.__table__.columns.keys()) == expected


def test_status_check_constraint_lists_seven_statuses():
    ck = [c for c in FinPettyClaim.__table__.constraints if c.name == "ck_fin_petty_claims_status"]
    assert len(ck) == 1
    sql = str(ck[0].sqltext)
    for status in ("PENDING_APPROVAL", "RETURNED", "APPROVED", "TRANSFERRED",
                   "AWAITING_REVIEW", "SENT_BACK", "CLOSED"):
        assert status in sql
```

- [ ] **Step 3: รันให้เห็นว่าไม่ผ่าน**

Run: `cd ~/Documents/project/ncac/api-ncac && python -m pytest tests/finance/test_petty_model.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'models.finance_petty_model'`

- [ ] **Step 4: เขียน ORM**

`models/finance_petty_model.py` — คอลัมน์ให้ตรงกับ migration ทุกตัว (คัดลอกหัวไฟล์สไตล์เดียวกับ `finance_model.py` ที่บอกว่า migration เป็นเจ้าของ schema):

```python
"""Finance — เบิกเงินสดย่อย. Tables are created by scripts/migrations/2026-10-12_finance_petty_cash.sql
(and create_all, which is a no-op once they exist). Keep both in sync.

petty ไม่ผูกกับ form_submissions — form_id เป็นสตริงที่ S3 ใช้เป็น prefix ของไฟล์แนบอยู่แล้ว
"""
from sqlalchemy import (
    Boolean, CheckConstraint, Column, Date, DateTime, ForeignKey, Index, Integer, Numeric, String, Text, func,
)
from sqlalchemy.dialects.postgresql import JSONB

from database import Base

PETTY_STATUSES = (
    "PENDING_APPROVAL", "RETURNED", "APPROVED", "TRANSFERRED", "AWAITING_REVIEW", "SENT_BACK", "CLOSED",
)


class FinPettyFund(Base):
    __tablename__ = "fin_petty_funds"

    id = Column(Integer, primary_key=True)
    branch_code = Column(String(4), nullable=False)
    division_code = Column(String(8), nullable=False)
    holder_employee_id = Column(String(50), nullable=False)
    fund_limit = Column(Numeric(12, 2))
    is_active = Column(Boolean, nullable=False, default=True, server_default="true")
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())
    updated_by = Column(String(50))

    __table_args__ = (Index("ix_fin_petty_funds_holder", "holder_employee_id"),)


class FinPettyExpenseType(Base):
    __tablename__ = "fin_petty_expense_types"

    code = Column(String(20), primary_key=True)
    name_th = Column(String(120), nullable=False)
    atms_sku = Column(String(20))
    sort_order = Column(Integer, nullable=False, default=0, server_default="0")
    is_active = Column(Boolean, nullable=False, default=True, server_default="true")
    spec = Column(JSONB, nullable=False, server_default="{}")
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())
    updated_by = Column(String(50))


class FinPettyBatch(Base):
    __tablename__ = "fin_petty_batches"

    id = Column(Integer, primary_key=True)
    fund_id = Column(Integer, ForeignKey("fin_petty_funds.id"), nullable=False)
    batch_no = Column(String(30), nullable=False, unique=True)
    total_amount = Column(Numeric(12, 2), nullable=False, default=0, server_default="0")
    remark = Column(Text)
    closed_by = Column(String(50))
    closed_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())


class FinPettyClaim(Base):
    __tablename__ = "fin_petty_claims"

    id = Column(Integer, primary_key=True)
    form_id = Column(String(80), nullable=False, unique=True)
    fund_id = Column(Integer, ForeignKey("fin_petty_funds.id"), nullable=False)
    expense_type = Column(String(20), ForeignKey("fin_petty_expense_types.code"), nullable=False)
    expense_date = Column(Date, nullable=False)
    period_from = Column(Date)
    period_to = Column(Date)
    driver_employee_id = Column(String(50))
    driver_name = Column(String(150))
    payee_name = Column(String(150))
    amount = Column(Numeric(12, 2), nullable=False, default=0, server_default="0")
    detail = Column(JSONB, nullable=False, server_default="{}")
    dd_no = Column(String(50))
    dd_snapshot = Column(JSONB)
    receipt_no = Column(String(50))
    wht_applicable = Column(Boolean, nullable=False, default=False, server_default="false")
    created_by = Column(String(50), nullable=False)
    source = Column(String(10), nullable=False, default="WEB", server_default="'WEB'")
    dup_override_reason = Column(Text)
    return_reason = Column(Text)
    approved_by = Column(String(50))
    approved_at = Column(DateTime(timezone=True))
    transfer_date = Column(Date)
    transfer_slip_at = Column(DateTime(timezone=True))
    submitted_to_acc_at = Column(DateTime(timezone=True))
    review_remark = Column(Text)
    reviewed_by = Column(String(50))
    reviewed_at = Column(DateTime(timezone=True))
    batch_id = Column(Integer, ForeignKey("fin_petty_batches.id"))
    status = Column(String(30), nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        CheckConstraint(
            "status IN ('PENDING_APPROVAL','RETURNED','APPROVED','TRANSFERRED',"
            "'AWAITING_REVIEW','SENT_BACK','CLOSED')",
            name="ck_fin_petty_claims_status",
        ),
        CheckConstraint("amount >= 0", name="ck_fin_petty_claims_amount"),
        Index("ix_fin_petty_claims_fund_status", "fund_id", "status"),
        Index("ix_fin_petty_claims_status", "status"),
        Index("ix_fin_petty_claims_created_by", "created_by"),
    )


class FinPettyClaimItem(Base):
    __tablename__ = "fin_petty_claim_items"

    id = Column(Integer, primary_key=True)
    claim_id = Column(Integer, ForeignKey("fin_petty_claims.id", ondelete="CASCADE"), nullable=False)
    line_no = Column(Integer, nullable=False)
    event_date = Column(Date, nullable=False)
    truck_code = Column(String(20))
    truck_plate = Column(String(20))
    truck_type = Column(String(30))
    ref_no = Column(String(50))
    qty = Column(Numeric(10, 2), nullable=False, default=1, server_default="1")
    rate = Column(Numeric(12, 2), nullable=False)
    amount = Column(Numeric(12, 2), nullable=False)
    remark = Column(String(255))

    __table_args__ = (
        Index("ix_fin_petty_items_claim", "claim_id"),
        Index("ix_fin_petty_items_date_code", "event_date", "truck_code"),
        Index("ix_fin_petty_items_date_plate", "event_date", "truck_plate"),
        Index("ix_fin_petty_items_hard_dup", "ref_no", "truck_code", "truck_plate"),
    )


class FinPettyLog(Base):
    __tablename__ = "fin_petty_logs"

    id = Column(Integer, primary_key=True)
    claim_id = Column(Integer, ForeignKey("fin_petty_claims.id", ondelete="CASCADE"), nullable=False, index=True)
    action = Column(String(30), nullable=False)
    changes = Column(JSONB)
    remark = Column(Text)
    action_by = Column(String(50))
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
```

- [ ] **Step 5: รันเทสต์ให้ผ่าน**

Run: `python -m pytest tests/finance/test_petty_model.py -v`
Expected: PASS ทั้ง 5 เทสต์

- [ ] **Step 6: commit**

```bash
cd ~/Documents/project/ncac/api-ncac && git pull
git add scripts/migrations/2026-10-12_finance_petty_cash.sql models/finance_petty_model.py tests/finance/test_petty_model.py
git commit -m "feat(petty): tables and ORM for petty cash claims"
```

> **ยังไม่รัน migration กับ DB ใด ๆ ในขั้นนี้** — รันตอน Task 5 บน DB สำเนา และถามผู้ใช้ก่อนแตะ prod

### Task 2: กฎล้วน — สถานะ ยอดรวม ทะเบียน เลขเอกสาร

**Files:**
- Create: `api-ncac/services/finance/petty_logic.py`
- Test: `api-ncac/tests/finance/test_petty_logic.py`

**Interfaces:**
- Consumes: ไม่มี (ไฟล์นี้ห้าม import SQLAlchemy หรือ FastAPI)
- Produces:
  - `STATUSES: tuple[str, ...]` · `STATUS_LABELS: dict[str, str]` · `ALLOWED: dict[str, tuple[str, ...]]`
  - `assert_transition(current: str, target: str) -> None` (raise `PettyRuleError`)
  - `PettyRuleError(Exception)` มี `.http_status: int`
  - `normalize_plate(raw: str | None) -> str`
  - `normalize_code(raw: str | None) -> str`
  - `line_amount(qty, rate) -> Decimal` · `claim_total(items: Iterable[Mapping]) -> Decimal`
  - `period_of(items: Iterable[Mapping]) -> tuple[date | None, date | None]`
  - `petty_form_code(branch: str, division: str) -> str`
  - `format_form_id(branch: str, division: str, yymm: int, number: int) -> str`
  - `batch_no(branch: str, division: str, yymm: int, number: int) -> str`
  - `hard_dup_key(item: Mapping) -> tuple[str, str, str] | None`

- [ ] **Step 1: เขียนเทสต์ที่ยังไม่ผ่าน**

`tests/finance/test_petty_logic.py`:

```python
from datetime import date
from decimal import Decimal

import pytest

from services.finance import petty_logic as L


class TestTransitions:
    def test_submit_to_approved(self):
        assert L.assert_transition("PENDING_APPROVAL", "APPROVED") is None

    def test_returned_can_be_resubmitted(self):
        assert L.assert_transition("RETURNED", "PENDING_APPROVAL") is None

    def test_sent_back_goes_to_awaiting_review_again(self):
        assert L.assert_transition("SENT_BACK", "AWAITING_REVIEW") is None

    def test_cannot_approve_twice(self):
        # Review Focus 4: แท็บที่เปิดค้างไว้กดอนุมัติซ้ำ
        with pytest.raises(L.PettyRuleError) as exc:
            L.assert_transition("APPROVED", "APPROVED")
        assert exc.value.http_status == 409
        assert "อนุมัติแล้ว" in str(exc.value)

    def test_cannot_skip_transfer(self):
        with pytest.raises(L.PettyRuleError):
            L.assert_transition("APPROVED", "AWAITING_REVIEW")

    def test_closed_is_terminal(self):
        with pytest.raises(L.PettyRuleError):
            L.assert_transition("CLOSED", "AWAITING_REVIEW")

    def test_unknown_status_is_rejected(self):
        with pytest.raises(L.PettyRuleError):
            L.assert_transition("WHATEVER", "APPROVED")


class TestLabels:
    def test_seven_statuses(self):
        assert len(L.STATUSES) == 7

    def test_labels_cover_every_status(self):
        assert set(L.STATUS_LABELS) == set(L.STATUSES)

    def test_label_wording_matches_spec(self):
        assert L.STATUS_LABELS["APPROVED"] == "อนุมัติแล้ว รอโอน"
        assert L.STATUS_LABELS["TRANSFERRED"] == "โอนแล้ว รอเคลียร์เอกสาร"
        assert L.STATUS_LABELS["CLOSED"] == "คืนยอดแล้ว"


class TestNormalizePlate:
    # Review Focus 1: ทะเบียนคนละฟอร์แมตต้องเป็นคันเดียวกัน
    def test_strips_spaces_and_dashes(self):
        assert L.normalize_plate("71-4285") == L.normalize_plate("71 4285") == "714285"

    def test_strips_trailing_space(self):
        assert L.normalize_plate("71-4285 ") == "714285"

    def test_keeps_thai_letters(self):
        assert L.normalize_plate("70-ขก 1234") == "70ขก1234"

    def test_uppercases_latin(self):
        assert L.normalize_plate("f014") == "F014"

    def test_none_is_empty(self):
        assert L.normalize_plate(None) == ""


class TestTotals:
    # Review Focus 3: ปัดเศษแล้วยอดรวมต้องตรง
    def test_line_amount_rounds_half_up(self):
        assert L.line_amount(Decimal("1.5"), Decimal("33.333")) == Decimal("50.00")

    def test_real_voucher_total(self):
        items = (
            [{"qty": 1, "rate": 100}] * 12 + [{"qty": 1, "rate": 120}] * 3 + [{"qty": 1, "rate": 80}]
        )
        assert L.claim_total(items) == Decimal("1640.00")

    def test_total_equals_sum_of_rounded_lines(self):
        items = [{"qty": "1", "rate": "0.005"}] * 3
        assert L.claim_total(items) == sum(L.line_amount(i["qty"], i["rate"]) for i in items)

    def test_empty_is_zero(self):
        assert L.claim_total([]) == Decimal("0.00")


class TestPeriod:
    def test_min_max_of_event_dates(self):
        items = [{"event_date": date(2026, 9, 24)}, {"event_date": date(2026, 9, 17)}]
        assert L.period_of(items) == (date(2026, 9, 17), date(2026, 9, 24))

    def test_empty_is_none(self):
        assert L.period_of([]) == (None, None)


class TestDocNumbers:
    def test_form_code_per_branch_division(self):
        assert L.petty_form_code("03", "B02") == "PC-03-B02"

    def test_form_id_format(self):
        assert L.format_form_id("03", "B02", 2610, 1) == "03-B02-2610-001"

    def test_form_id_grows_past_999(self):
        assert L.format_form_id("03", "B02", 2610, 1000) == "03-B02-2610-1000"

    def test_form_id_matches_frontend_pattern(self):
        import re
        pattern = re.compile(r"^[A-Za-z0-9_-]+-\d{4}-\d{3,}$")  # lib/s3.ts FORM_ID_PATTERN
        assert pattern.match(L.format_form_id("03", "B02", 2610, 7))

    def test_batch_no_format(self):
        assert L.batch_no("03", "B02", 2610, 2) == "03-B02-2610-B2"


class TestHardDupKey:
    def test_key_is_ref_plus_both_truck_fields(self):
        item = {"ref_no": "000055", "truck_code": "161", "truck_plate": "71-4285"}
        assert L.hard_dup_key(item) == ("000055", "161", "714285")

    def test_no_ref_no_means_no_key(self):
        assert L.hard_dup_key({"ref_no": "", "truck_code": "161", "truck_plate": "71-4285"}) is None
```

- [ ] **Step 2: รันให้เห็นว่าไม่ผ่าน**

Run: `python -m pytest tests/finance/test_petty_logic.py -v`
Expected: FAIL — `No module named 'services.finance.petty_logic'`

- [ ] **Step 3: เขียน `petty_logic.py`**

```python
"""กฎล้วนของเบิกเงินสดย่อย — ไม่มี DB ไม่มี FastAPI (เทสต์ได้โดยไม่ต้องต่อฐาน)

อนุมัติขั้นเดียวจบ ไม่ใช้ TOA/approval engine — spec §4.1
"""
from __future__ import annotations

import re
from datetime import date
from decimal import ROUND_HALF_UP, Decimal
from typing import Iterable, Mapping

PENDING_APPROVAL = "PENDING_APPROVAL"
RETURNED = "RETURNED"
APPROVED = "APPROVED"
TRANSFERRED = "TRANSFERRED"
AWAITING_REVIEW = "AWAITING_REVIEW"
SENT_BACK = "SENT_BACK"
CLOSED = "CLOSED"

STATUSES = (PENDING_APPROVAL, RETURNED, APPROVED, TRANSFERRED, AWAITING_REVIEW, SENT_BACK, CLOSED)

STATUS_LABELS = {
    PENDING_APPROVAL: "รออนุมัติ",
    RETURNED: "ตีกลับผู้เบิก",
    APPROVED: "อนุมัติแล้ว รอโอน",
    TRANSFERRED: "โอนแล้ว รอเคลียร์เอกสาร",
    AWAITING_REVIEW: "รอบัญชีตรวจ",
    SENT_BACK: "ส่งกลับแก้ไข",
    CLOSED: "คืนยอดแล้ว",
}

ALLOWED = {
    PENDING_APPROVAL: (APPROVED, RETURNED),
    RETURNED: (PENDING_APPROVAL,),
    APPROVED: (TRANSFERRED,),
    TRANSFERRED: (AWAITING_REVIEW,),
    AWAITING_REVIEW: (CLOSED, SENT_BACK),
    SENT_BACK: (AWAITING_REVIEW,),
    CLOSED: (),
}


class PettyRuleError(Exception):
    def __init__(self, message: str, http_status: int = 422):
        super().__init__(message)
        self.http_status = http_status


def assert_transition(current: str, target: str) -> None:
    """ปล่อยผ่านเมื่อเปลี่ยนสถานะได้ · ไม่ได้ก็ 409 พร้อมบอกสถานะปัจจุบันเป็นคำไทย"""
    if current not in ALLOWED:
        raise PettyRuleError(f"สถานะปัจจุบันไม่ถูกต้อง ({current})", 409)
    if target not in ALLOWED[current]:
        label = STATUS_LABELS.get(current, current)
        raise PettyRuleError(f"ทำรายการนี้ไม่ได้ ใบนี้สถานะ {label} อยู่แล้ว", 409)
    return None


_PLATE_STRIP = re.compile(r"[^0-9A-Za-z฀-๿]")


def normalize_plate(raw: str | None) -> str:
    """ทะเบียน/รหัสรถให้เทียบกันได้: ตัดช่องว่าง ขีด จุด แล้วทำตัวอังกฤษเป็นพิมพ์ใหญ่

    มีไว้เพราะด่านซ้ำเข้มใช้ทะเบียนเป็นคีย์ ถ้าไม่ล้างก่อน '71 4285' กับ '71-4285' จะกลายเป็นสองคัน
    """
    if not raw:
        return ""
    return _PLATE_STRIP.sub("", str(raw)).upper()


normalize_code = normalize_plate  # รหัสรถภายในใช้กฎเดียวกัน (F014 / f014 / F-014)

_CENT = Decimal("0.01")


def line_amount(qty, rate) -> Decimal:
    return (Decimal(str(qty)) * Decimal(str(rate))).quantize(_CENT, rounding=ROUND_HALF_UP)


def claim_total(items: Iterable[Mapping]) -> Decimal:
    """ยอดรวมของใบ = ผลรวมของยอดรายบรรทัด *ที่ปัดแล้ว* เพื่อให้ตรงกับที่พิมพ์ออกกระดาษ"""
    total = sum((line_amount(i.get("qty", 1), i["rate"]) for i in items), Decimal("0"))
    return total.quantize(_CENT)


def period_of(items: Iterable[Mapping]) -> tuple[date | None, date | None]:
    dates = [i["event_date"] for i in items if i.get("event_date")]
    return (min(dates), max(dates)) if dates else (None, None)


def petty_form_code(branch: str, division: str) -> str:
    return f"PC-{branch}-{division}"


def format_form_id(branch: str, division: str, yymm: int, number: int) -> str:
    return f"{branch}-{division}-{yymm:04d}-{number:03d}"


def batch_no(branch: str, division: str, yymm: int, number: int) -> str:
    return f"{branch}-{division}-{yymm:04d}-B{number}"


def hard_dup_key(item: Mapping) -> tuple[str, str, str] | None:
    """คีย์ด่านซ้ำเข้ม: เลขที่บัตรชั่ง + เบอร์รถ + ทะเบียนรถ · ไม่มีเลขบัตร = ไม่มีคีย์ (ใช้ด่านอ่อนแทน)"""
    ref = (item.get("ref_no") or "").strip()
    if not ref:
        return None
    return (ref, normalize_code(item.get("truck_code")), normalize_plate(item.get("truck_plate")))
```

- [ ] **Step 4: รันเทสต์ให้ผ่าน**

Run: `python -m pytest tests/finance/test_petty_logic.py -v`
Expected: PASS ทุกเทสต์

- [ ] **Step 5: commit**

```bash
git pull && git add services/finance/petty_logic.py tests/finance/test_petty_logic.py
git commit -m "feat(petty): pure rules for statuses, totals, plate normalising and doc numbers"
```

### Task 3: master กองทุน + ประเภทการเบิก (BE)

**Files:**
- Create: `api-ncac/schemas/finance_petty_schema.py`
- Create: `api-ncac/services/finance/petty_repo.py`
- Create: `api-ncac/routes/finance/petty_routes.py`
- Modify: `api-ncac/main.py:110-111` (import) และ `main.py:177-178` (include_router)
- Modify: `api-ncac/scripts/migrations/2026-10-12_finance_petty_cash.sql` (ต่อท้าย: seed 5 ประเภท)
- Test: `api-ncac/tests/finance/test_petty_master.py`

**Interfaces:**
- Consumes: `models.finance_petty_model.*` · `services.finance.petty_logic as L`
- Produces:
  - `petty_repo.list_expense_types(db, active_only: bool) -> list[FinPettyExpenseType]`
  - `petty_repo.get_expense_type(db, code: str) -> FinPettyExpenseType | None`
  - `petty_repo.upsert_expense_type(db, code, payload: dict, actor: str) -> FinPettyExpenseType`
  - `petty_repo.list_funds(db, holder: str | None, active_only: bool) -> list[FinPettyFund]`
  - `petty_repo.get_fund(db, fund_id: int) -> FinPettyFund | None`
  - `petty_repo.create_fund(db, payload: dict, actor: str) -> FinPettyFund`
  - `petty_repo.update_fund(db, fund_id: int, payload: dict, actor: str) -> FinPettyFund`
  - route: `GET/PUT /finance/petty/expense-types[/{code}]` · `GET/POST/PUT /finance/petty/funds[/{id}]`
  - `router` object ชื่อ `router` (prefix `/finance/petty`, tag `Finance - Petty Cash`)

- [ ] **Step 1: เขียนเทสต์ที่ยังไม่ผ่าน**

`tests/finance/test_petty_master.py` — เทสต์ schema validation + payload shaping โดยไม่ต้องมี DB (แพตเทิร์นเดียวกับ `tests/finance/test_finance_schema.py`):

```python
import pytest
from pydantic import ValidationError

from schemas.finance_petty_schema import ExpenseTypeUpdate, FundCreate, FundUpdate


class TestFundCreate:
    def test_minimal(self):
        f = FundCreate(branch_code="03", division_code="B02", holder_employee_id="12345")
        assert f.is_active is True
        assert f.fund_limit is None

    def test_branch_code_is_two_digits(self):
        with pytest.raises(ValidationError):
            FundCreate(branch_code="3", division_code="B02", holder_employee_id="12345")

    def test_holder_is_required(self):
        with pytest.raises(ValidationError):
            FundCreate(branch_code="03", division_code="B02")

    def test_negative_limit_rejected(self):
        with pytest.raises(ValidationError):
            FundCreate(branch_code="03", division_code="B02", holder_employee_id="1", fund_limit=-1)


class TestExpenseTypeUpdate:
    def test_spec_must_be_object(self):
        with pytest.raises(ValidationError):
            ExpenseTypeUpdate(name_th="x", spec=[1, 2, 3])

    def test_item_based_spec_requires_item_fields(self):
        with pytest.raises(ValidationError) as exc:
            ExpenseTypeUpdate(name_th="ค่าชั่งน้ำหนัก", spec={"item_based": True, "item_fields": []})
        assert "item_fields" in str(exc.value)

    def test_weigh_spec_accepted(self):
        spec = {
            "item_based": True,
            "item_fields": [{"key": "ref_no", "label": "เลขที่บัตรชั่ง", "type": "text", "required": True}],
            "attachments": [{"key": "weigh_slip", "label": "ใบชั่ง", "required": True, "max": 10}],
            "duplicate_check": {
                "scope": "item",
                "hard": {"keys": ["ref_no", "truck_code", "truck_plate"], "days": 365, "action": "block"},
                "soft": {"keys": ["event_date", "truck"], "days": 7, "action": "warn"},
            },
        }
        assert ExpenseTypeUpdate(name_th="ค่าชั่งน้ำหนัก", spec=spec).spec["item_based"] is True

    def test_unknown_attachment_shape_rejected(self):
        with pytest.raises(ValidationError):
            ExpenseTypeUpdate(name_th="x", spec={"attachments": [{"label": "ไม่มี key"}]})


class TestFundUpdate:
    def test_all_fields_optional(self):
        assert FundUpdate().model_dump(exclude_unset=True) == {}

    def test_deactivate(self):
        assert FundUpdate(is_active=False).is_active is False
```

- [ ] **Step 2: รันให้เห็นว่าไม่ผ่าน**

Run: `python -m pytest tests/finance/test_petty_master.py -v`
Expected: FAIL — `No module named 'schemas.finance_petty_schema'`

- [ ] **Step 3: เขียน schema**

`schemas/finance_petty_schema.py`:

```python
"""Pydantic schema ของเบิกเงินสดย่อย"""
from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import Any, Literal, Optional

from pydantic import BaseModel, Field, field_validator


class FundCreate(BaseModel):
    branch_code: str = Field(min_length=2, max_length=4, pattern=r"^\d{2,4}$")
    division_code: str = Field(min_length=2, max_length=8)
    holder_employee_id: str = Field(min_length=1, max_length=50)
    fund_limit: Optional[Decimal] = Field(default=None, ge=0)
    is_active: bool = True
    updated_by: Optional[str] = None


class FundUpdate(BaseModel):
    holder_employee_id: Optional[str] = Field(default=None, min_length=1, max_length=50)
    fund_limit: Optional[Decimal] = Field(default=None, ge=0)
    is_active: Optional[bool] = None
    updated_by: Optional[str] = None


def _check_spec(spec: Any) -> dict:
    if not isinstance(spec, dict):
        raise ValueError("spec ต้องเป็น object")
    if spec.get("item_based") and not spec.get("item_fields"):
        raise ValueError("ประเภทที่กรอกเป็นรายการต้องมี item_fields อย่างน้อย 1 ช่อง")
    for group in ("header_fields", "item_fields", "attachments"):
        for entry in spec.get(group, []) or []:
            if not isinstance(entry, dict) or not entry.get("key"):
                raise ValueError(f"{group} ทุกรายการต้องมี key")
    return spec


class ExpenseTypeUpdate(BaseModel):
    name_th: str = Field(min_length=1, max_length=120)
    atms_sku: Optional[str] = Field(default=None, max_length=20)
    sort_order: int = 0
    is_active: bool = True
    spec: dict = Field(default_factory=dict)
    updated_by: Optional[str] = None

    @field_validator("spec")
    @classmethod
    def validate_spec(cls, v: Any) -> dict:
        return _check_spec(v)


class ClaimItemIn(BaseModel):
    event_date: date
    truck_code: Optional[str] = Field(default=None, max_length=20)
    truck_plate: Optional[str] = Field(default=None, max_length=20)
    truck_type: Optional[str] = Field(default=None, max_length=30)
    ref_no: Optional[str] = Field(default=None, max_length=50)
    qty: Decimal = Field(default=Decimal("1"), gt=0)
    rate: Decimal = Field(ge=0)
    remark: Optional[str] = Field(default=None, max_length=255)


class ClaimIn(BaseModel):
    fund_id: int
    expense_type: str = Field(min_length=1, max_length=20)
    expense_date: date
    driver_employee_id: Optional[str] = Field(default=None, max_length=50)
    driver_name: Optional[str] = Field(default=None, max_length=150)
    payee_name: Optional[str] = Field(default=None, max_length=150)
    detail: dict = Field(default_factory=dict)
    dd_no: Optional[str] = Field(default=None, max_length=50)
    receipt_no: Optional[str] = Field(default=None, max_length=50)
    wht_applicable: bool = False
    items: list[ClaimItemIn] = Field(min_length=1)
    created_by: str = Field(min_length=1, max_length=50)


class ApproveIn(BaseModel):
    employee_id: str = Field(min_length=1, max_length=50)
    dup_override_reason: Optional[str] = None
    # จำนวนไฟล์ที่แนบจริงต่อหมวด เช่น {"weigh_slip": 16, "transfer": 1}
    # BE ไม่มี client S3 ของตัวเอง (ของเดิมก็เป็นแบบนี้) FE นับจาก lib/s3 แล้วส่งมาให้ด่านตรวจ
    attachments: dict[str, int] = Field(default_factory=dict)


class ReturnIn(BaseModel):
    employee_id: str = Field(min_length=1, max_length=50)
    reason: str = Field(min_length=1)


class TransferIn(BaseModel):
    employee_id: str = Field(min_length=1, max_length=50)
    transfer_date: date


class SubmitAccIn(BaseModel):
    employee_id: str = Field(min_length=1, max_length=50)
    dd_no: Optional[str] = Field(default=None, max_length=50)
    attachments: dict[str, int] = Field(default_factory=dict)


class ReviewIn(BaseModel):
    employee_id: str = Field(min_length=1, max_length=50)
    action: Literal["PASS", "SEND_BACK"]
    remark: Optional[str] = None


class BatchIn(BaseModel):
    employee_id: str = Field(min_length=1, max_length=50)
    fund_id: int
    claim_ids: list[int] = Field(min_length=1)
    remark: Optional[str] = None
```

- [ ] **Step 4: รันเทสต์ให้ผ่าน**

Run: `python -m pytest tests/finance/test_petty_master.py -v`
Expected: PASS

- [ ] **Step 5: เขียน repo ส่วน master**

`services/finance/petty_repo.py` (ไฟล์นี้จะโตต่อใน Task 5–7 — เริ่มด้วย master):

```python
"""ทุก query/commit ของเบิกเงินสดย่อย — กฎอยู่ที่ petty_logic/petty_validate ไม่ใช่ที่นี่"""
from __future__ import annotations

from typing import Optional

from sqlalchemy.orm import Session

from models.finance_petty_model import FinPettyExpenseType, FinPettyFund


def list_expense_types(db: Session, active_only: bool = True) -> list[FinPettyExpenseType]:
    q = db.query(FinPettyExpenseType)
    if active_only:
        q = q.filter(FinPettyExpenseType.is_active.is_(True))
    return q.order_by(FinPettyExpenseType.sort_order, FinPettyExpenseType.code).all()


def get_expense_type(db: Session, code: str) -> Optional[FinPettyExpenseType]:
    return db.query(FinPettyExpenseType).filter(FinPettyExpenseType.code == code).first()


def upsert_expense_type(db: Session, code: str, payload: dict, actor: str) -> FinPettyExpenseType:
    row = get_expense_type(db, code)
    if row is None:
        row = FinPettyExpenseType(code=code)
        db.add(row)
    for key, value in payload.items():
        setattr(row, key, value)
    row.updated_by = actor
    db.commit()
    db.refresh(row)
    return row


def list_funds(db: Session, holder: Optional[str] = None, active_only: bool = True) -> list[FinPettyFund]:
    q = db.query(FinPettyFund)
    if active_only:
        q = q.filter(FinPettyFund.is_active.is_(True))
    if holder:
        q = q.filter(FinPettyFund.holder_employee_id == holder)
    return q.order_by(FinPettyFund.branch_code, FinPettyFund.division_code).all()


def get_fund(db: Session, fund_id: int) -> Optional[FinPettyFund]:
    return db.query(FinPettyFund).filter(FinPettyFund.id == fund_id).first()


def create_fund(db: Session, payload: dict, actor: str) -> FinPettyFund:
    row = FinPettyFund(**payload, updated_by=actor)
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def update_fund(db: Session, fund_id: int, payload: dict, actor: str) -> FinPettyFund:
    row = get_fund(db, fund_id)
    if row is None:
        raise LookupError("ไม่พบกองทุน")
    for key, value in payload.items():
        setattr(row, key, value)
    row.updated_by = actor
    db.commit()
    db.refresh(row)
    return row
```

- [ ] **Step 6: เขียน route ส่วน master และต่อเข้า main**

`routes/finance/petty_routes.py`:

```python
"""Finance — เบิกเงินสดย่อย.

auth ยังเป็นแบบเดียวกับ advance_routes (ไม่มี auth ที่ชั้นนี้ FE เป็นคนการ์ด) — ดู launch gate ใน spec
"""
import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from database import get_db
from schemas.finance_petty_schema import ExpenseTypeUpdate, FundCreate, FundUpdate
from services.finance import petty_repo as repo

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/finance/petty", tags=["Finance - Petty Cash"])


def _type_dict(t) -> dict:
    return {"code": t.code, "name_th": t.name_th, "atms_sku": t.atms_sku,
            "sort_order": t.sort_order, "is_active": t.is_active, "spec": t.spec}


def _fund_dict(f) -> dict:
    return {"id": f.id, "branch_code": f.branch_code, "division_code": f.division_code,
            "holder_employee_id": f.holder_employee_id,
            "fund_limit": float(f.fund_limit) if f.fund_limit is not None else None,
            "is_active": f.is_active}


@router.get("/expense-types")
def list_expense_types(active: bool = True, db: Session = Depends(get_db)):
    return [_type_dict(t) for t in repo.list_expense_types(db, active_only=active)]


@router.put("/expense-types/{code}")
def put_expense_type(code: str, payload: ExpenseTypeUpdate, db: Session = Depends(get_db)):
    data = payload.model_dump(exclude={"updated_by"})
    row = repo.upsert_expense_type(db, code, data, payload.updated_by or "")
    return _type_dict(row)


@router.get("/funds")
def list_funds(holder: Optional[str] = Query(default=None), active: bool = True,
               db: Session = Depends(get_db)):
    return [_fund_dict(f) for f in repo.list_funds(db, holder=holder, active_only=active)]


@router.post("/funds", status_code=201)
def create_fund(payload: FundCreate, db: Session = Depends(get_db)):
    data = payload.model_dump(exclude={"updated_by"})
    try:
        return _fund_dict(repo.create_fund(db, data, payload.updated_by or ""))
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="สาขาและแผนกนี้มีกองทุนอยู่แล้ว")


@router.put("/funds/{fund_id}")
def update_fund(fund_id: int, payload: FundUpdate, db: Session = Depends(get_db)):
    data = payload.model_dump(exclude_unset=True, exclude={"updated_by"})
    try:
        return _fund_dict(repo.update_fund(db, fund_id, data, payload.updated_by or ""))
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
```

ใน `main.py` ต่อท้ายบรรทัด 111:

```python
from routes.finance.petty_routes import router as finance_petty_router
```

และต่อท้ายบรรทัด 178:

```python
app.include_router(finance_petty_router)
```

- [ ] **Step 7: seed 5 ประเภทต่อท้าย migration**

ต่อท้าย `scripts/migrations/2026-10-12_finance_petty_cash.sql` — `WEIGH` ได้ spec เต็มตาม `DESIGN-WEIGH.md` §3.2 อีก 4 ประเภทลง spec ว่างไว้ก่อน (เติมใน Task 11):

```sql
INSERT INTO fin_petty_expense_types (code, name_th, atms_sku, sort_order, spec) VALUES
('WEIGH', 'ค่าชั่งน้ำหนัก', 'LB00038', 1, '{
  "item_based": true,
  "item_label": "รายการชั่ง",
  "header_fields": [
    {"key":"period_from","label":"ตั้งแต่วันที่","type":"date","required":true,"auto":"min(item.event_date)"},
    {"key":"period_to","label":"ถึงวันที่","type":"date","required":true,"auto":"max(item.event_date)"},
    {"key":"payee_name","label":"จ่ายให้","type":"employee","required":true}
  ],
  "item_fields": [
    {"key":"event_date","label":"วันที่ชั่ง","type":"date","required":true},
    {"key":"truck","label":"รถ","type":"truck","required":true,"search":["code","plate"]},
    {"key":"truck_type","label":"ประเภทรถ","type":"select","options":["โม่ใหญ่","โม่เล็ก"],"required":true,"auto_from":"truck"},
    {"key":"ref_no","label":"เลขที่บัตรชั่ง","type":"text","required":true},
    {"key":"rate","label":"ราคา/ครั้ง","type":"money","required":true}
  ],
  "attachments": [
    {"key":"weigh_slip","label":"ใบชั่งน้ำหนัก (สำเนา)","required":true,"max":10},
    {"key":"transfer","label":"หลักฐานโอนเงิน","required":true,"max":3},
    {"key":"other","label":"อื่นๆ","required":false,"max":3}
  ],
  "rules": [
    {"when":"total >= 500","require_field":"dd_no","at":"BEFORE_SUBMIT_TO_ACCOUNTING"},
    {"when":"always","require_attachment":"weigh_slip","at":"BEFORE_APPROVE"},
    {"when":"always","require_attachment":"transfer","at":"BEFORE_APPROVE"}
  ],
  "duplicate_check": {
    "scope": "item",
    "hard": {"keys":["ref_no","truck_code","truck_plate"],"days":365,"action":"block","override":false},
    "soft": {"keys":["event_date","truck"],"days":7,"action":"warn","override":"reason"}
  },
  "prints": ["PETTY_VOUCHER","RECEIPT_SUBSTITUTE","DD"],
  "atms": {"sku":"LB00038","product_group":"ค่าแรง","unit":"งาน","vat":0}
}'::jsonb),
('TOLL',   'ค่าทางด่วน',      NULL,       2, '{}'::jsonb),
('TIRE',   'ค่าปะ-เปลี่ยนยาง', 'LB00009',  3, '{}'::jsonb),
('REPAIR', 'ค่าซ่อมฉุกเฉิน',   NULL,       4, '{}'::jsonb),
('TRAVEL', 'ค่าเดินทางคนขับ',  NULL,       5, '{}'::jsonb)
ON CONFLICT (code) DO NOTHING;
```

- [ ] **Step 8: รันเทสต์ทั้งชุด finance ว่าไม่พังของเดิม**

Run: `python -m pytest tests/finance -q`
Expected: PASS ทั้งหมด (ของ Advance เดิมต้องไม่กระทบ)

- [ ] **Step 9: commit**

```bash
git pull && git add schemas/finance_petty_schema.py services/finance/petty_repo.py routes/finance/petty_routes.py main.py scripts/migrations/2026-10-12_finance_petty_cash.sql tests/finance/test_petty_master.py
git commit -m "feat(petty): master endpoints for funds and expense types, seed 5 types"
```

### Task 4: lib ฝั่ง FE + BFF ของ master + หน้า master

**Files:**
- Create: `menait-service/lib/finance/petty-status.ts` + `petty-status.test.ts`
- Create: `menait-service/lib/finance/petty-items.ts` + `petty-items.test.ts`
- Create: `menait-service/lib/finance/petty-access.ts` + `petty-access.test.ts`
- Create: `menait-service/app/api/finance/petty/expense-types/route.ts`
- Create: `menait-service/app/api/finance/petty/expense-types/[code]/route.ts`
- Create: `menait-service/app/api/finance/petty/funds/route.ts`
- Create: `menait-service/app/api/finance/petty/funds/[id]/route.ts`
- Create: `menait-service/app/finance/petty/master/page.tsx`
- Create: `menait-service/app/finance/types-petty.ts`

**Interfaces:**
- Consumes: `lib/finance/server.ts` → `requireUser` `requireFinance` `beUrl` `proxy` · `lib/s3.ts` → `FORM_ID_PATTERN`
- Produces:
  - `petty-status.ts`: `PettyStatus` (union 7 ค่า) · `PETTY_STATUS_LABELS` · `PETTY_STATUS_STYLES` · `PETTY_ALLOWED` · `canGo(from, to): boolean`
  - `petty-items.ts`: `normalizePlate(raw): string` · `lineAmount(qty, rate): number` · `claimTotal(items): number` · `periodOf(items): {from: string|null, to: string|null}` · `parseTruckPaste(raw): string[]` · `type PettyItemDraft`
  - `petty-access.ts`: `isPettyFormId(id): boolean` · `canApprove(user, fund): boolean` · `canSeeClaim(user, claim): boolean` · `canCloseBatch(user): boolean`
  - `types-petty.ts`: `PettyFund` `PettyExpenseType` `PettyClaim` `PettyClaimItem` `PettySpec`

- [ ] **Step 1: เขียนเทสต์ที่ยังไม่ผ่าน**

`lib/finance/petty-items.test.ts`:

```ts
import { describe, expect, test } from 'bun:test';
import { claimTotal, lineAmount, normalizePlate, parseTruckPaste, periodOf } from './petty-items';

describe('normalizePlate', () => {
  test('dash and space are the same truck', () => {
    expect(normalizePlate('71-4285')).toBe(normalizePlate('71 4285'));
    expect(normalizePlate('71-4285')).toBe('714285');
  });
  test('trailing space ignored', () => expect(normalizePlate('71-4285 ')).toBe('714285'));
  test('thai letters kept', () => expect(normalizePlate('70-ขก 1234')).toBe('70ขก1234'));
  test('latin uppercased', () => expect(normalizePlate('f014')).toBe('F014'));
  test('blank', () => expect(normalizePlate(null)).toBe(''));
});

describe('totals', () => {
  test('real voucher: 16 trucks, 3 rates', () => {
    const items = [
      ...Array(12).fill({ qty: 1, rate: 100 }),
      ...Array(3).fill({ qty: 1, rate: 120 }),
      { qty: 1, rate: 80 },
    ];
    expect(claimTotal(items)).toBe(1640);
  });
  test('line rounds to satang', () => expect(lineAmount(1.5, 33.333)).toBe(50));
  test('total is sum of rounded lines, not rounded sum', () => {
    const items = Array(3).fill({ qty: 1, rate: 0.005 });
    expect(claimTotal(items)).toBe(0.03);
  });
  test('empty is zero', () => expect(claimTotal([])).toBe(0));
  test('blank rate counts as zero, never NaN', () => expect(claimTotal([{ qty: 1, rate: NaN }])).toBe(0));
});

describe('periodOf', () => {
  test('min and max', () => {
    expect(periodOf([{ event_date: '2026-09-24' }, { event_date: '2026-09-17' }]))
      .toEqual({ from: '2026-09-17', to: '2026-09-24' });
  });
  test('empty', () => expect(periodOf([])).toEqual({ from: null, to: null }));
});

describe('parseTruckPaste', () => {
  test('spaces, commas and newlines all split', () => {
    expect(parseTruckPaste('161 144, F014\nF016')).toEqual(['161', '144', 'F014', 'F016']);
  });
  test('keeps duplicates — ของจริงมีรถซ้ำในใบเดียว', () => {
    expect(parseTruckPaste('1093 1093')).toEqual(['1093', '1093']);
  });
  test('drops empty fragments', () => expect(parseTruckPaste(' , ,161,, ')).toEqual(['161']));
  test('blank input', () => expect(parseTruckPaste('')).toEqual([]));
});
```

`lib/finance/petty-status.test.ts`:

```ts
import { describe, expect, test } from 'bun:test';
import { PETTY_ALLOWED, PETTY_STATUS_LABELS, PETTY_STATUS_STYLES, canGo } from './petty-status';

describe('labels', () => {
  test('seven statuses', () => expect(Object.keys(PETTY_STATUS_LABELS)).toHaveLength(7));
  test('wording matches the spec', () => {
    expect(PETTY_STATUS_LABELS.APPROVED).toBe('อนุมัติแล้ว รอโอน');
    expect(PETTY_STATUS_LABELS.TRANSFERRED).toBe('โอนแล้ว รอเคลียร์เอกสาร');
    expect(PETTY_STATUS_LABELS.CLOSED).toBe('คืนยอดแล้ว');
    expect(PETTY_STATUS_LABELS.RETURNED).toBe('ตีกลับผู้เบิก');
  });
  test('every status has a style', () => {
    expect(Object.keys(PETTY_STATUS_STYLES).sort()).toEqual(Object.keys(PETTY_STATUS_LABELS).sort());
  });
});

describe('transitions mirror the backend', () => {
  test('approve', () => expect(canGo('PENDING_APPROVAL', 'APPROVED')).toBe(true));
  test('resubmit after return', () => expect(canGo('RETURNED', 'PENDING_APPROVAL')).toBe(true));
  test('cannot skip transfer', () => expect(canGo('APPROVED', 'AWAITING_REVIEW')).toBe(false));
  test('closed is terminal', () => expect(PETTY_ALLOWED.CLOSED).toEqual([]));
});
```

`lib/finance/petty-access.test.ts`:

```ts
import { describe, expect, test } from 'bun:test';
import { FORM_ID_PATTERN } from '@/lib/s3';
import { canApprove, canCloseBatch, canSeeClaim, isPettyFormId } from './petty-access';

const fund = { id: 1, branch_code: '03', division_code: 'B02', holder_employee_id: '12345' };

describe('isPettyFormId', () => {
  test('accepts the real shape', () => expect(isPettyFormId('03-B02-2610-001')).toBe(true));
  test('rejects an ADV id', () => expect(isPettyFormId('ADV-2610-001')).toBe(false));
  test('rejects a path traversal attempt', () => expect(isPettyFormId('../../etc/passwd')).toBe(false));
  test('the shared S3 pattern already accepts it — do not change that regex', () => {
    expect(FORM_ID_PATTERN.test('03-B02-2610-001')).toBe(true);
  });
});

describe('canApprove', () => {
  test('fund holder may', () => expect(canApprove({ employee_id: '12345' }, fund)).toBe(true));
  test('someone else may not, even finance', () =>
    expect(canApprove({ employee_id: '99999', is_finance: true }, fund)).toBe(false));
  test('no fund means no', () => expect(canApprove({ employee_id: '12345' }, null)).toBe(false));
});

describe('canSeeClaim', () => {
  const claim = { created_by: '55555', fund_id: 1, status: 'PENDING_APPROVAL' as const };
  test('the clerk who opened it', () =>
    expect(canSeeClaim({ employee_id: '55555' }, claim, [])).toBe(true));
  test('the holder of its fund', () =>
    expect(canSeeClaim({ employee_id: '12345' }, claim, [fund])).toBe(true));
  test('another clerk cannot', () =>
    expect(canSeeClaim({ employee_id: '77777' }, claim, [])).toBe(false));
  test('finance sees it only from AWAITING_REVIEW onwards', () => {
    expect(canSeeClaim({ employee_id: '9', is_finance: true }, claim, [])).toBe(false);
    expect(canSeeClaim({ employee_id: '9', is_finance: true }, { ...claim, status: 'AWAITING_REVIEW' }, []))
      .toBe(true);
  });
  test('admin sees everything', () =>
    expect(canSeeClaim({ employee_id: '9', role: 'a' }, claim, [])).toBe(true));
});

describe('canCloseBatch', () => {
  test('finance may', () => expect(canCloseBatch({ employee_id: '9', is_finance: true })).toBe(true));
  test('a clerk may not', () => expect(canCloseBatch({ employee_id: '55555' })).toBe(false));
});
```

- [ ] **Step 2: รันให้เห็นว่าไม่ผ่าน**

Run: `cd ~/Documents/github/menait-service && bun test lib/finance/petty-`
Expected: FAIL — module not found ทั้ง 3 ไฟล์

- [ ] **Step 3: เขียน `petty-status.ts`**

```ts
export type PettyStatus =
  | 'PENDING_APPROVAL' | 'RETURNED' | 'APPROVED' | 'TRANSFERRED'
  | 'AWAITING_REVIEW' | 'SENT_BACK' | 'CLOSED';

export const PETTY_STATUS_LABELS: Record<PettyStatus, string> = {
  PENDING_APPROVAL: 'รออนุมัติ',
  RETURNED: 'ตีกลับผู้เบิก',
  APPROVED: 'อนุมัติแล้ว รอโอน',
  TRANSFERRED: 'โอนแล้ว รอเคลียร์เอกสาร',
  AWAITING_REVIEW: 'รอบัญชีตรวจ',
  SENT_BACK: 'ส่งกลับแก้ไข',
  CLOSED: 'คืนยอดแล้ว',
};

// สีเดียวกับชุดของ Advance (lib/finance/status.ts) เพื่อให้ป้ายสองโมดูลอ่านเหมือนกัน
export const PETTY_STATUS_STYLES: Record<PettyStatus, string> = {
  PENDING_APPROVAL: 'bg-amber-50 text-amber-700 border-amber-200',
  RETURNED: 'bg-amber-50 text-amber-700 border-amber-200',
  APPROVED: 'bg-brand-50 text-brand-700 border-brand-200',
  TRANSFERRED: 'bg-slate-50 text-ink-700 border-slate-200',
  AWAITING_REVIEW: 'bg-violet-50 text-violet-700 border-violet-200',
  SENT_BACK: 'bg-orange-50 text-sun-700 border-orange-200',
  CLOSED: 'bg-emerald-50 text-mint-700 border-emerald-200',
};

/** ต้องตรงกับ services/finance/petty_logic.py ALLOWED — BE เป็นผู้ตัดสินจริง อันนี้ไว้ปิดปุ่ม */
export const PETTY_ALLOWED: Record<PettyStatus, PettyStatus[]> = {
  PENDING_APPROVAL: ['APPROVED', 'RETURNED'],
  RETURNED: ['PENDING_APPROVAL'],
  APPROVED: ['TRANSFERRED'],
  TRANSFERRED: ['AWAITING_REVIEW'],
  AWAITING_REVIEW: ['CLOSED', 'SENT_BACK'],
  SENT_BACK: ['AWAITING_REVIEW'],
  CLOSED: [],
};

export function canGo(from: PettyStatus, to: PettyStatus): boolean {
  return PETTY_ALLOWED[from]?.includes(to) ?? false;
}
```

- [ ] **Step 4: เขียน `petty-items.ts`**

```ts
import { round2 } from '@/lib/finance/status';

export type PettyItemDraft = {
  event_date?: string | null;
  truck_code?: string | null;
  truck_plate?: string | null;
  truck_type?: string | null;
  ref_no?: string | null;
  qty?: number | string | null;
  rate?: number | string | null;
  remark?: string | null;
};

/** ทะเบียน/รหัสรถให้เทียบกันได้ — ด่านซ้ำเข้มใช้ค่านี้เป็นคีย์ '71 4285' จึงต้องเท่ากับ '71-4285' */
export function normalizePlate(raw: string | null | undefined): string {
  if (!raw) return '';
  return raw.replace(/[^0-9A-Za-z฀-๿]/g, '').toUpperCase();
}

function num(v: number | string | null | undefined): number {
  if (v === null || v === undefined || v === '') return 0;
  const n = typeof v === 'number' ? v : Number(String(v).replace(/,/g, '').trim());
  return Number.isFinite(n) ? n : 0;
}

export function lineAmount(qty: number | string | null | undefined, rate: number | string | null | undefined): number {
  return round2(num(qty) * num(rate));
}

/** ยอดรวม = ผลรวมของยอดรายบรรทัดที่ปัดแล้ว ให้ตรงกับใบที่พิมพ์ */
export function claimTotal(items: readonly PettyItemDraft[]): number {
  return round2(items.reduce((sum, i) => sum + lineAmount(i.qty ?? 1, i.rate), 0));
}

export function periodOf(items: readonly PettyItemDraft[]): { from: string | null; to: string | null } {
  const dates = items.map(i => i.event_date).filter((d): d is string => !!d).sort();
  return dates.length ? { from: dates[0], to: dates[dates.length - 1] } : { from: null, to: null };
}

/** "161 144, F014\nF016" → ['161','144','F014','F016'] · คงของซ้ำไว้ ของจริงมีรถซ้ำในใบเดียว */
export function parseTruckPaste(raw: string): string[] {
  return raw.split(/[\s,;]+/).map(s => s.trim()).filter(Boolean);
}
```

- [ ] **Step 5: เขียน `petty-access.ts`**

```ts
import type { PettyStatus } from '@/lib/finance/petty-status';

export const PETTY_FORM_ID = /^\d{2,4}-[A-Z0-9]{2,8}-\d{4}-\d{3,}$/;

export function isPettyFormId(id: unknown): boolean {
  return typeof id === 'string' && PETTY_FORM_ID.test(id);
}

type U = { employee_id?: string | null; is_finance?: boolean | null; role?: string | null };
type F = { id: number; holder_employee_id: string };

/** ผู้อนุมัติคือผู้ถือกองทุนคนเดียว — การเป็นการเงินไม่ทำให้อนุมัติแทนได้ (spec §4.1) */
export function canApprove(user: U | null | undefined, fund: F | null | undefined): boolean {
  return !!user?.employee_id && !!fund && user.employee_id === fund.holder_employee_id;
}

const FINANCE_VISIBLE: PettyStatus[] = ['AWAITING_REVIEW', 'SENT_BACK', 'CLOSED'];

export function canSeeClaim(
  user: U | null | undefined,
  claim: { created_by: string; fund_id: number; status: PettyStatus },
  myFunds: readonly F[],
): boolean {
  if (!user?.employee_id) return false;
  if (user.role === 'a') return true;
  if (claim.created_by === user.employee_id) return true;
  if (myFunds.some(f => f.id === claim.fund_id && f.holder_employee_id === user.employee_id)) return true;
  if (user.is_finance === true) return FINANCE_VISIBLE.includes(claim.status);
  return false;
}

export function canCloseBatch(user: U | null | undefined): boolean {
  return user?.is_finance === true || user?.role === 'a';
}
```

- [ ] **Step 6: รันเทสต์ให้ผ่าน**

Run: `bun test lib/finance/petty-`
Expected: PASS ทั้ง 3 ไฟล์

- [ ] **Step 7: BFF routes ของ master**

`app/api/finance/petty/expense-types/route.ts` — ทุกคนที่ล็อกอินอ่านได้ (ฟอร์มต้องใช้ spec):

```ts
import type { NextRequest } from 'next/server';
import { beUrl, proxy, requireUser } from '@/lib/finance/server';

export async function GET(req: NextRequest) {
  const guard = await requireUser(req);
  if ('error' in guard) return guard.error;
  return proxy(beUrl('/finance/petty/expense-types', { active: req.nextUrl.searchParams.get('active') ?? 'true' }));
}
```

`app/api/finance/petty/expense-types/[code]/route.ts` — แก้ได้เฉพาะบัญชีและแอดมิน (ข้อ 5 ที่ผู้ใช้ตอบ):

```ts
import { NextResponse, type NextRequest } from 'next/server';
import { beUrl, proxy, requireFinance } from '@/lib/finance/server';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const guard = await requireFinance(req);
  if ('error' in guard) return guard.error;
  const { code } = await params;
  if (!/^[A-Z_]{2,20}$/.test(code)) {
    return NextResponse.json({ error: 'รหัสประเภทไม่ถูกต้อง' }, { status: 400 });
  }
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'ข้อมูลไม่ถูกต้อง' }, { status: 400 });
  return proxy(beUrl(`/finance/petty/expense-types/${code}`), {
    method: 'PUT',
    body: JSON.stringify({ ...body, updated_by: guard.user.employee_id }),
  });
}
```

`app/api/finance/petty/funds/route.ts` — ผู้อนุมัติเห็นเฉพาะกองทุนตัวเอง การเงิน/แอดมินเห็นทั้งหมด:

```ts
import type { NextRequest } from 'next/server';
import { beUrl, proxy, requireUser } from '@/lib/finance/server';

export async function GET(req: NextRequest) {
  const guard = await requireUser(req);
  if ('error' in guard) return guard.error;
  const seesAll = guard.user.is_finance === true || guard.user.role === 'a';
  // holder มาจาก session เท่านั้น — ส่ง employee_id จาก browser เข้ามาแล้วดูของคนอื่นไม่ได้
  return proxy(beUrl('/finance/petty/funds', {
    holder: seesAll ? null : guard.user.employee_id,
    active: req.nextUrl.searchParams.get('active') ?? 'true',
  }));
}

export async function POST(req: NextRequest) {
  const guard = await requireUser(req);
  if ('error' in guard) return guard.error;
  if (guard.user.role !== 'a') {
    return Response.json({ error: 'เฉพาะผู้ดูแลระบบ' }, { status: 403 }) as never;
  }
  const body = await req.json().catch(() => null);
  return proxy(beUrl('/finance/petty/funds'), {
    method: 'POST',
    body: JSON.stringify({ ...body, updated_by: guard.user.employee_id }),
  });
}
```

`app/api/finance/petty/funds/[id]/route.ts`:

```ts
import { NextResponse, type NextRequest } from 'next/server';
import { beUrl, proxy, requireUser } from '@/lib/finance/server';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireUser(req);
  if ('error' in guard) return guard.error;
  if (guard.user.role !== 'a') return NextResponse.json({ error: 'เฉพาะผู้ดูแลระบบ' }, { status: 403 });
  const { id } = await params;
  if (!/^\d+$/.test(id)) return NextResponse.json({ error: 'ไม่พบกองทุน' }, { status: 404 });
  const body = await req.json().catch(() => null);
  return proxy(beUrl(`/finance/petty/funds/${id}`), {
    method: 'PUT',
    body: JSON.stringify({ ...body, updated_by: guard.user.employee_id }),
  });
}
```

- [ ] **Step 8: หน้า master**

`app/finance/types-petty.ts` — type ที่ทุกหน้าใช้ร่วม:

```ts
export type PettySpecField = {
  key: string; label: string; type: string; required?: boolean;
  options?: string[]; auto?: string; auto_from?: string; search?: string[];
};
export type PettySpecAttachment = { key: string; label: string; required?: boolean; max?: number; note?: string };
export type PettySpec = {
  item_based?: boolean;
  item_label?: string;
  header_fields?: PettySpecField[];
  item_fields?: PettySpecField[];
  attachments?: PettySpecAttachment[];
  rules?: { when: string; require_field?: string; require_attachment?: string; at: string }[];
  duplicate_check?: {
    scope?: 'item' | 'claim';
    hard?: { keys: string[]; days: number; action: string; override?: boolean };
    soft?: { keys: string[]; days: number; action: string; override?: string };
  };
  prints?: string[];
  atms?: { sku?: string; product_group?: string; unit?: string; vat?: number };
};
export type PettyExpenseType = {
  code: string; name_th: string; atms_sku: string | null; sort_order: number; is_active: boolean; spec: PettySpec;
};
export type PettyFund = {
  id: number; branch_code: string; division_code: string;
  holder_employee_id: string; fund_limit: number | null; is_active: boolean;
};
export type PettyClaimItem = {
  id?: number; line_no?: number; event_date: string;
  truck_code?: string | null; truck_plate?: string | null; truck_type?: string | null;
  ref_no?: string | null; qty: number; rate: number; amount: number; remark?: string | null;
};
export type PettyClaim = {
  id: number; form_id: string; fund_id: number; expense_type: string;
  expense_date: string; period_from: string | null; period_to: string | null;
  driver_employee_id: string | null; driver_name: string | null; payee_name: string | null;
  amount: number; dd_no: string | null; status: import('@/lib/finance/petty-status').PettyStatus;
  created_by: string; items: PettyClaimItem[];
};
```

`app/finance/petty/master/page.tsx` — สองแท็บ (กองทุน / ประเภทการเบิก) ตามโครงของ `app/finance/payee-accounts/page.tsx` ที่มีสองแท็บอยู่แล้ว: แท็บกองทุนเป็นตาราง + ฟอร์มเพิ่ม/แก้ (สาขา แผนก ผู้ถือ วงเงิน เปิด/ปิด) · แท็บประเภทแสดงรายการ 5 ประเภทพร้อม `<textarea>` แก้ `spec` เป็น JSON ที่ validate ด้วย `JSON.parse` ก่อนส่ง และโชว์ error จาก BE ตรง ๆ

- [ ] **Step 9: ตรวจว่า build ผ่านและเทสต์เดิมไม่พัง**

Run: `bun test lib/finance/ && bun --bun next lint`
Expected: เทสต์ PASS ทั้งหมด · lint ไม่มี error ใหม่

- [ ] **Step 10: commit**

```bash
cd ~/Documents/github/menait-service && git pull
git add lib/finance/petty-*.ts app/api/finance/petty app/finance/petty app/finance/types-petty.ts
git commit -m "feat(petty): FE libs, master BFF routes and master page"
```

## S2 — เส้นบาง (ค่าชั่งน้ำหนัก เดินครบ 7 ขั้น)

### Task 5: เปิดใบ + อ่านใบ + รายการใบ (BE)

**Files:**
- Modify: `api-ncac/services/finance/petty_repo.py` (เพิ่มส่วน claims)
- Modify: `api-ncac/routes/finance/petty_routes.py` (เพิ่ม endpoint claims)
- Modify: `api-ncac/routes/forms/form_submission_routes.py:102-111` (`generate_form_id` รองรับ `PC-*`)
- Test: `api-ncac/tests/finance/test_petty_claims.py`
- Test: `api-ncac/tests/finance/test_petty_form_id.py`

**Interfaces:**
- Consumes: `petty_logic` (`claim_total` `period_of` `petty_form_code` `format_form_id`) · `petty_repo` master functions
- Produces:
  - `petty_repo.create_claim(db, payload: dict, items: list[dict], actor: str) -> FinPettyClaim`
  - `petty_repo.get_claim(db, form_id: str) -> FinPettyClaim | None`
  - `petty_repo.claim_items(db, claim_id: int) -> list[FinPettyClaimItem]`
  - `petty_repo.list_claims(db, *, fund_ids: list[int] | None, created_by: str | None, status: str | None, month: str | None, limit: int, offset: int) -> tuple[list[FinPettyClaim], int]`
  - `petty_repo.replace_items(db, claim_id: int, items: list[dict]) -> Decimal` (คืนยอดรวมใหม่)
  - `petty_repo.log(db, claim_id: int, action: str, actor: str, changes: dict | None = None, remark: str | None = None) -> None`
  - route: `POST /finance/petty/claims` · `GET /finance/petty/claims` · `GET /finance/petty/claims/{form_id}` · `PUT /finance/petty/claims/{form_id}`

- [ ] **Step 1: เขียนเทสต์เลขเอกสารที่ยังไม่ผ่าน**

`tests/finance/test_petty_form_id.py` — เลขต้องไม่ชนกันเมื่อเปิดพร้อมกัน (Review Focus 2) โดยใช้ sqlite in-memory เหมือน `tests/finance/test_form_id_and_approval_routes.py` ที่มีอยู่:

```python
from routes.forms.form_submission_routes import generate_form_id
from services.finance import petty_logic as L


def test_petty_code_is_per_branch_and_division():
    assert L.petty_form_code("03", "B02") == "PC-03-B02"


def test_generate_form_id_formats_petty(db_session, monkeypatch):
    # PC-* ต้องได้ {branch}-{division}-{YYMM}-{NNN} ไม่ใช่ PC-03-B02-2026-0001
    import routes.forms.form_submission_routes as mod
    monkeypatch.setattr(mod, "_now_bkk", lambda: __import__("datetime").datetime(2026, 10, 12))
    first = generate_form_id(db_session, "PC-03-B02")
    second = generate_form_id(db_session, "PC-03-B02")
    assert first == "03-B02-2610-001"
    assert second == "03-B02-2610-002"


def test_other_funds_have_their_own_series(db_session, monkeypatch):
    import routes.forms.form_submission_routes as mod
    monkeypatch.setattr(mod, "_now_bkk", lambda: __import__("datetime").datetime(2026, 10, 12))
    assert generate_form_id(db_session, "PC-03-B02") == "03-B02-2610-001"
    assert generate_form_id(db_session, "PC-01-A01") == "01-A01-2610-001"


def test_adv_numbering_unchanged(db_session, monkeypatch):
    import routes.forms.form_submission_routes as mod
    monkeypatch.setattr(mod, "_now_bkk", lambda: __import__("datetime").datetime(2026, 10, 12))
    assert generate_form_id(db_session, "ADV") == "ADV-2610-001"
```

ถ้ายังไม่มี fixture `db_session` ที่ให้ sqlite in-memory ให้เพิ่มใน `tests/conftest.py`:

```python
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

@pytest.fixture
def db_session():
    """sqlite in-memory สำหรับเทสต์ที่ต้องมี session จริง — ไม่แตะ Postgres"""
    from database import Base
    import models.finance_petty_model  # noqa: F401  (ตาราง petty)
    import models.finance_model         # noqa: F401  (fin_advances — อ่านยอดคงเหลือ)
    import models.master_model          # noqa: F401  (form_sequences, form_submissions)
    engine = create_engine("sqlite://")
    Base.metadata.create_all(engine)
    session = sessionmaker(bind=engine)()
    try:
        yield session
    finally:
        session.close()
```

- [ ] **Step 2: รันให้เห็นว่าไม่ผ่าน**

Run: `python -m pytest tests/finance/test_petty_form_id.py -v`
Expected: FAIL — `generate_form_id` คืน `PC-03-B02-2026-0001`

- [ ] **Step 3: แก้ `generate_form_id` ให้รองรับ `PC-*`**

แทนที่ฟังก์ชันที่ `routes/forms/form_submission_routes.py:102`:

```python
PETTY_FORM_PREFIX = "PC-"


def generate_form_id(db: Session, form_code: str) -> str:
    """{code}-{year}-{0000} · ADV = ADV-YYMM-NNN · PC-{branch}-{division} = {branch}-{division}-YYMM-NNN

    petty ใช้ sequence ตัวเดียวกัน (form_sequences + SELECT ... FOR UPDATE) จึงกันเลขชนได้อยู่แล้ว
    แต่คืนเลขที่ไม่มีคำว่า PC- เพราะบนกระดาษเขียนแค่ สาขา-แผนก-เดือน-ลำดับ
    """
    advance = form_code == ADVANCE_FORM_CODE
    petty = form_code.startswith(PETTY_FORM_PREFIX)
    monthly = advance or petty
    year = int(_now_bkk().strftime("%y%m")) if monthly else datetime.utcnow().year
    seq = _locked_sequence(db, form_code, year)

    seq.last_number += 1
    if petty:
        branch_division = form_code[len(PETTY_FORM_PREFIX):]  # "03-B02"
        return f"{branch_division}-{year:04d}-{seq.last_number:03d}"
    if advance:
        return f"{ADVANCE_FORM_CODE}-{year:04d}-{seq.last_number:03d}"  # > 999 simply grows to 4 digits
    return f"{form_code}-{year}-{str(seq.last_number).zfill(4)}"
```

- [ ] **Step 4: รันเทสต์ให้ผ่าน**

Run: `python -m pytest tests/finance/test_petty_form_id.py tests/finance/test_form_id_and_approval_routes.py -v`
Expected: PASS ทั้งหมด — ของ ADV เดิมต้องยังผ่าน

- [ ] **Step 5: เขียนเทสต์ claims ที่ยังไม่ผ่าน**

`tests/finance/test_petty_claims.py`:

```python
from datetime import date
from decimal import Decimal

import pytest

from models.finance_petty_model import FinPettyClaim, FinPettyExpenseType, FinPettyFund
from services.finance import petty_repo as repo


@pytest.fixture
def fund(db_session):
    f = FinPettyFund(branch_code="03", division_code="B02", holder_employee_id="12345")
    db_session.add(FinPettyExpenseType(code="WEIGH", name_th="ค่าชั่งน้ำหนัก", spec={"item_based": True}))
    db_session.add(f)
    db_session.commit()
    return f


WEIGH_ITEMS = (
    [{"event_date": date(2026, 9, 17), "truck_code": "161", "truck_plate": "71-4285",
      "truck_type": "โม่ใหญ่", "ref_no": "000055", "qty": 1, "rate": 100}] * 12
    + [{"event_date": date(2026, 9, 20), "truck_code": "153", "truck_plate": "71-4728",
        "truck_type": "โม่ใหญ่", "ref_no": "000101", "qty": 1, "rate": 120}] * 3
    + [{"event_date": date(2026, 9, 24), "truck_code": "165", "truck_plate": "71-9001",
        "truck_type": "โม่เล็ก", "ref_no": "000172", "qty": 1, "rate": 80}]
)


def _payload(fund):
    return {"fund_id": fund.id, "expense_type": "WEIGH", "expense_date": date(2026, 9, 25),
            "payee_name": "อัญชัญ น่วมมี", "created_by": "55555"}


class TestCreateClaim:
    def test_amount_is_computed_from_items(self, db_session, fund):
        claim = repo.create_claim(db_session, _payload(fund), WEIGH_ITEMS, actor="55555")
        assert claim.amount == Decimal("1640.00")

    def test_period_comes_from_items(self, db_session, fund):
        claim = repo.create_claim(db_session, _payload(fund), WEIGH_ITEMS, actor="55555")
        assert (claim.period_from, claim.period_to) == (date(2026, 9, 17), date(2026, 9, 24))

    def test_starts_pending_approval(self, db_session, fund):
        claim = repo.create_claim(db_session, _payload(fund), WEIGH_ITEMS, actor="55555")
        assert claim.status == "PENDING_APPROVAL"

    def test_form_id_shape(self, db_session, fund, monkeypatch):
        import routes.forms.form_submission_routes as mod
        monkeypatch.setattr(mod, "_now_bkk", lambda: __import__("datetime").datetime(2026, 10, 12))
        claim = repo.create_claim(db_session, _payload(fund), WEIGH_ITEMS, actor="55555")
        assert claim.form_id == "03-B02-2610-001"

    def test_items_are_numbered_and_priced(self, db_session, fund):
        claim = repo.create_claim(db_session, _payload(fund), WEIGH_ITEMS, actor="55555")
        items = repo.claim_items(db_session, claim.id)
        assert len(items) == 16
        assert [i.line_no for i in items] == list(range(1, 17))
        assert items[0].amount == Decimal("100.00")

    def test_duplicate_truck_in_one_claim_is_stored(self, db_session, fund):
        # ของจริงมี 1093 สองแถวในใบเดียว — ต้องเก็บได้ ไม่ใช่ถูกยุบ
        items = [dict(WEIGH_ITEMS[0], truck_code="1093", ref_no="000120"),
                 dict(WEIGH_ITEMS[0], truck_code="1093", ref_no="000121")]
        claim = repo.create_claim(db_session, _payload(fund), items, actor="55555")
        assert len(repo.claim_items(db_session, claim.id)) == 2

    def test_creates_a_log_row(self, db_session, fund):
        claim = repo.create_claim(db_session, _payload(fund), WEIGH_ITEMS, actor="55555")
        from models.finance_petty_model import FinPettyLog
        logs = db_session.query(FinPettyLog).filter(FinPettyLog.claim_id == claim.id).all()
        assert [l.action for l in logs] == ["CREATE"]


class TestReplaceItems:
    def test_replacing_items_updates_total(self, db_session, fund):
        claim = repo.create_claim(db_session, _payload(fund), WEIGH_ITEMS, actor="55555")
        total = repo.replace_items(db_session, claim.id, WEIGH_ITEMS[:1])
        assert total == Decimal("100.00")
        assert repo.get_claim(db_session, claim.form_id).amount == Decimal("100.00")

    def test_old_rows_are_gone(self, db_session, fund):
        claim = repo.create_claim(db_session, _payload(fund), WEIGH_ITEMS, actor="55555")
        repo.replace_items(db_session, claim.id, WEIGH_ITEMS[:2])
        assert len(repo.claim_items(db_session, claim.id)) == 2


class TestListClaims:
    def test_filters_by_creator(self, db_session, fund):
        repo.create_claim(db_session, _payload(fund), WEIGH_ITEMS, actor="55555")
        repo.create_claim(db_session, dict(_payload(fund), created_by="77777"), WEIGH_ITEMS, actor="77777")
        rows, total = repo.list_claims(db_session, fund_ids=None, created_by="55555", status=None,
                                       month=None, limit=50, offset=0)
        assert total == 1 and rows[0].created_by == "55555"

    def test_filters_by_fund(self, db_session, fund):
        repo.create_claim(db_session, _payload(fund), WEIGH_ITEMS, actor="55555")
        _, total = repo.list_claims(db_session, fund_ids=[fund.id + 99], created_by=None, status=None,
                                    month=None, limit=50, offset=0)
        assert total == 0

    def test_filters_by_month_on_expense_date(self, db_session, fund):
        repo.create_claim(db_session, _payload(fund), WEIGH_ITEMS, actor="55555")
        _, in_month = repo.list_claims(db_session, fund_ids=None, created_by=None, status=None,
                                       month="2026-09", limit=50, offset=0)
        _, other = repo.list_claims(db_session, fund_ids=None, created_by=None, status=None,
                                    month="2026-08", limit=50, offset=0)
        assert (in_month, other) == (1, 0)

    def test_paging_returns_full_count(self, db_session, fund):
        for _ in range(3):
            repo.create_claim(db_session, _payload(fund), WEIGH_ITEMS[:1], actor="55555")
        rows, total = repo.list_claims(db_session, fund_ids=None, created_by=None, status=None,
                                       month=None, limit=2, offset=0)
        assert (len(rows), total) == (2, 3)
```

- [ ] **Step 6: รันให้เห็นว่าไม่ผ่าน**

Run: `python -m pytest tests/finance/test_petty_claims.py -v`
Expected: FAIL — `module 'services.finance.petty_repo' has no attribute 'create_claim'`

- [ ] **Step 7: เขียนส่วน claims ใน repo**

ต่อท้าย `services/finance/petty_repo.py`:

```python
from datetime import date as _date
from decimal import Decimal

from sqlalchemy import func

from models.finance_petty_model import FinPettyClaim, FinPettyClaimItem, FinPettyLog
from services.finance import petty_logic as L


def log(db: Session, claim_id: int, action: str, actor: str,
        changes: Optional[dict] = None, remark: Optional[str] = None) -> None:
    db.add(FinPettyLog(claim_id=claim_id, action=action, action_by=actor,
                       changes=changes, remark=remark))


def _item_rows(claim_id: int, items: list[dict]) -> list[FinPettyClaimItem]:
    rows = []
    for index, raw in enumerate(items, start=1):
        qty = Decimal(str(raw.get("qty", 1)))
        rate = Decimal(str(raw["rate"]))
        rows.append(FinPettyClaimItem(
            claim_id=claim_id, line_no=index, event_date=raw["event_date"],
            truck_code=raw.get("truck_code"), truck_plate=raw.get("truck_plate"),
            truck_type=raw.get("truck_type"), ref_no=raw.get("ref_no"),
            qty=qty, rate=rate, amount=L.line_amount(qty, rate), remark=raw.get("remark"),
        ))
    return rows


def create_claim(db: Session, payload: dict, items: list[dict], actor: str) -> FinPettyClaim:
    """เปิดใบ: ออกเลขจาก form_sequences → เขียนหัวใบ → เขียนรายการ → สรุปยอดและช่วงวัน"""
    from routes.forms.form_submission_routes import generate_form_id  # นำเข้าในฟังก์ชัน กัน import วน

    fund = get_fund(db, payload["fund_id"])
    if fund is None or not fund.is_active:
        raise LookupError("ไม่พบกองทุน หรือกองทุนถูกปิดอยู่")

    form_id = generate_form_id(db, L.petty_form_code(fund.branch_code, fund.division_code))
    period_from, period_to = L.period_of(items)
    claim = FinPettyClaim(
        form_id=form_id, status=L.PENDING_APPROVAL,
        amount=L.claim_total(items), period_from=period_from, period_to=period_to,
        **payload,
    )
    db.add(claim)
    db.flush()
    for row in _item_rows(claim.id, items):
        db.add(row)
    log(db, claim.id, "CREATE", actor, changes={"amount": str(claim.amount), "items": len(items)})
    db.commit()
    db.refresh(claim)
    return claim


def get_claim(db: Session, form_id: str) -> Optional[FinPettyClaim]:
    return db.query(FinPettyClaim).filter(FinPettyClaim.form_id == form_id).first()


def claim_items(db: Session, claim_id: int) -> list[FinPettyClaimItem]:
    return (db.query(FinPettyClaimItem)
            .filter(FinPettyClaimItem.claim_id == claim_id)
            .order_by(FinPettyClaimItem.line_no).all())


def replace_items(db: Session, claim_id: int, items: list[dict]) -> Decimal:
    db.query(FinPettyClaimItem).filter(FinPettyClaimItem.claim_id == claim_id).delete()
    for row in _item_rows(claim_id, items):
        db.add(row)
    total = L.claim_total(items)
    period_from, period_to = L.period_of(items)
    claim = db.query(FinPettyClaim).filter(FinPettyClaim.id == claim_id).first()
    claim.amount, claim.period_from, claim.period_to = total, period_from, period_to
    db.commit()
    return total


def list_claims(db: Session, *, fund_ids: Optional[list[int]], created_by: Optional[str],
                status: Optional[str], month: Optional[str], limit: int, offset: int):
    q = db.query(FinPettyClaim)
    if fund_ids is not None:
        q = q.filter(FinPettyClaim.fund_id.in_(fund_ids or [-1]))
    if created_by:
        q = q.filter(FinPettyClaim.created_by == created_by)
    if status:
        q = q.filter(FinPettyClaim.status == status)
    if month:
        year, mon = (int(x) for x in month.split("-"))
        start = _date(year, mon, 1)
        end = _date(year + (mon == 12), (mon % 12) + 1, 1)
        q = q.filter(FinPettyClaim.expense_date >= start, FinPettyClaim.expense_date < end)
    total = q.with_entities(func.count(FinPettyClaim.id)).scalar() or 0
    rows = q.order_by(FinPettyClaim.id.desc()).limit(limit).offset(offset).all()
    return rows, total
```

- [ ] **Step 8: รันเทสต์ให้ผ่าน**

Run: `python -m pytest tests/finance/test_petty_claims.py -v`
Expected: PASS ทั้ง 13 เทสต์

- [ ] **Step 9: เพิ่ม endpoint claims**

ต่อท้าย `routes/finance/petty_routes.py` — `_claim_dict` ส่งรายการลูกไปด้วยเสมอ เพราะ FE ต้องใช้คำนวณยอดและแสดงตาราง:

```python
from schemas.finance_petty_schema import ClaimIn

def _item_dict(i) -> dict:
    return {"id": i.id, "line_no": i.line_no, "event_date": str(i.event_date),
            "truck_code": i.truck_code, "truck_plate": i.truck_plate, "truck_type": i.truck_type,
            "ref_no": i.ref_no, "qty": float(i.qty), "rate": float(i.rate),
            "amount": float(i.amount), "remark": i.remark}


def _claim_dict(c, items) -> dict:
    return {
        "id": c.id, "form_id": c.form_id, "fund_id": c.fund_id, "expense_type": c.expense_type,
        "expense_date": str(c.expense_date),
        "period_from": str(c.period_from) if c.period_from else None,
        "period_to": str(c.period_to) if c.period_to else None,
        "driver_employee_id": c.driver_employee_id, "driver_name": c.driver_name,
        "payee_name": c.payee_name, "amount": float(c.amount), "dd_no": c.dd_no,
        "receipt_no": c.receipt_no, "status": c.status, "created_by": c.created_by,
        "approved_by": c.approved_by, "approved_at": c.approved_at.isoformat() if c.approved_at else None,
        "transfer_date": str(c.transfer_date) if c.transfer_date else None,
        "review_remark": c.review_remark, "return_reason": c.return_reason,
        "dup_override_reason": c.dup_override_reason, "batch_id": c.batch_id,
        "items": [_item_dict(i) for i in items],
    }


@router.post("/claims", status_code=201)
def create_claim(payload: ClaimIn, db: Session = Depends(get_db)):
    body = payload.model_dump()
    items = body.pop("items")
    try:
        claim = repo.create_claim(db, body, items, actor=payload.created_by)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    return _claim_dict(claim, repo.claim_items(db, claim.id))


@router.get("/claims")
def list_claims(employee_id: Optional[str] = None, holder: Optional[str] = None,
                status: Optional[str] = None, month: Optional[str] = None,
                limit: int = Query(default=50, le=200), offset: int = 0,
                db: Session = Depends(get_db)):
    """employee_id = ใบที่คนนั้นเปิด · holder = ทุกใบของกองทุนที่คนนั้นถือ · ไม่ส่งทั้งคู่ = ทุกใบ (บัญชี/การเงิน)"""
    fund_ids = [f.id for f in repo.list_funds(db, holder=holder)] if holder else None
    rows, total = repo.list_claims(db, fund_ids=fund_ids, created_by=employee_id, status=status,
                                   month=month, limit=limit, offset=offset)
    return {"total": total, "items": [_claim_dict(c, repo.claim_items(db, c.id)) for c in rows]}


@router.get("/claims/{form_id}")
def get_claim(form_id: str, db: Session = Depends(get_db)):
    claim = repo.get_claim(db, form_id)
    if claim is None:
        raise HTTPException(status_code=404, detail="ไม่พบใบเบิก")
    return _claim_dict(claim, repo.claim_items(db, claim.id))
```

- [ ] **Step 10: รัน migration บน DB สำเนา แล้วลองเปิดใบจริง 1 ใบ**

```bash
# DB สำเนาเท่านั้น — ห้ามชี้ไป prod
python scripts/migrations/run_migration.py scripts/migrations/2026-10-12_finance_petty_cash.sql
```

แล้วยิง smoke ด้วย `curl` 3 คำสั่ง: สร้างกองทุน → เปิดใบ 16 แถว → `GET` กลับมาแล้วเช็กว่า `amount` = `1640.0` และ `form_id` ขึ้นต้นด้วย `03-B02-`

> ก่อนรันกับ DB ที่ไม่ใช่สำเนา **ต้องถามผู้ใช้** ตามกติกาที่ตกลงไว้

- [ ] **Step 11: commit**

```bash
git pull && git add services/finance/petty_repo.py routes/finance/petty_routes.py routes/forms/form_submission_routes.py tests/conftest.py tests/finance/test_petty_claims.py tests/finance/test_petty_form_id.py
git commit -m "feat(petty): create, read and list claims with per-fund monthly numbering"
```

### Task 6: เปลี่ยนสถานะ 6 จังหวะ (BE)

**Files:**
- Modify: `api-ncac/services/finance/petty_repo.py`
- Modify: `api-ncac/routes/finance/petty_routes.py`
- Test: `api-ncac/tests/finance/test_petty_transitions.py`

**Interfaces:**
- Consumes: `petty_logic.assert_transition` · `petty_logic.PettyRuleError` · `petty_repo.get_claim` `log`
- Produces:
  - `petty_repo.set_status(db, claim: FinPettyClaim, target: str, actor: str, action: str, fields: dict | None = None, remark: str | None = None) -> FinPettyClaim`
  - `petty_repo.update_draft(db, claim: FinPettyClaim, payload: dict, items: list[dict], actor: str) -> FinPettyClaim`
  - route: `PUT /claims/{form_id}` · `POST /claims/{form_id}/approve` `/return` `/transfer` `/submit-accounting` `/review`

- [ ] **Step 1: เขียนเทสต์ที่ยังไม่ผ่าน**

`tests/finance/test_petty_transitions.py`:

```python
from datetime import date

import pytest

from services.finance import petty_logic as L
from services.finance import petty_repo as repo
from tests.finance.test_petty_claims import WEIGH_ITEMS, _payload, fund  # noqa: F401 (fixture)


@pytest.fixture
def claim(db_session, fund):
    return repo.create_claim(db_session, _payload(fund), WEIGH_ITEMS, actor="55555")


class TestApprove:
    def test_sets_approver_and_time(self, db_session, claim):
        out = repo.set_status(db_session, claim, L.APPROVED, actor="12345", action="APPROVE",
                              fields={"approved_by": "12345"})
        assert out.status == "APPROVED" and out.approved_by == "12345" and out.approved_at is not None

    def test_second_approve_is_409(self, db_session, claim):
        repo.set_status(db_session, claim, L.APPROVED, actor="12345", action="APPROVE")
        with pytest.raises(L.PettyRuleError) as exc:
            repo.set_status(db_session, claim, L.APPROVED, actor="12345", action="APPROVE")
        assert exc.value.http_status == 409

    def test_logs_the_action(self, db_session, claim):
        repo.set_status(db_session, claim, L.APPROVED, actor="12345", action="APPROVE")
        from models.finance_petty_model import FinPettyLog
        actions = [l.action for l in db_session.query(FinPettyLog)
                   .filter(FinPettyLog.claim_id == claim.id).order_by(FinPettyLog.id).all()]
        assert actions == ["CREATE", "APPROVE"]


class TestReturnAndResubmit:
    def test_return_keeps_the_reason(self, db_session, claim):
        out = repo.set_status(db_session, claim, L.RETURNED, actor="12345", action="RETURN",
                              fields={"return_reason": "ใบชั่งไม่ครบ"}, remark="ใบชั่งไม่ครบ")
        assert out.status == "RETURNED" and out.return_reason == "ใบชั่งไม่ครบ"

    def test_returned_claim_can_be_edited_and_resubmitted(self, db_session, claim):
        repo.set_status(db_session, claim, L.RETURNED, actor="12345", action="RETURN")
        out = repo.update_draft(db_session, claim, {"payee_name": "อัญชัญ น่วมมี"}, WEIGH_ITEMS[:2],
                                actor="55555")
        assert out.amount == 200 and out.status == "PENDING_APPROVAL"

    def test_cannot_edit_after_approval(self, db_session, claim):
        # Review Focus 4: แท็บเก่ากดบันทึก
        repo.set_status(db_session, claim, L.APPROVED, actor="12345", action="APPROVE")
        with pytest.raises(L.PettyRuleError) as exc:
            repo.update_draft(db_session, claim, {}, WEIGH_ITEMS[:1], actor="55555")
        assert exc.value.http_status == 409


class TestFullPath:
    def test_seven_steps_end_at_closed(self, db_session, claim):
        repo.set_status(db_session, claim, L.APPROVED, actor="12345", action="APPROVE")
        repo.set_status(db_session, claim, L.TRANSFERRED, actor="12345", action="TRANSFER",
                        fields={"transfer_date": date(2026, 9, 25)})
        repo.set_status(db_session, claim, L.AWAITING_REVIEW, actor="12345", action="SUBMIT_ACC",
                        fields={"dd_no": "LBDD26090931"})
        repo.set_status(db_session, claim, L.CLOSED, actor="90001", action="CLOSE")
        assert claim.status == "CLOSED" and claim.dd_no == "LBDD26090931"

    def test_accounting_can_send_back_then_pass(self, db_session, claim):
        repo.set_status(db_session, claim, L.APPROVED, actor="12345", action="APPROVE")
        repo.set_status(db_session, claim, L.TRANSFERRED, actor="12345", action="TRANSFER")
        repo.set_status(db_session, claim, L.AWAITING_REVIEW, actor="12345", action="SUBMIT_ACC")
        repo.set_status(db_session, claim, L.SENT_BACK, actor="80001", action="SEND_BACK",
                        fields={"review_remark": "ใบชั่งเบลอ"})
        out = repo.set_status(db_session, claim, L.AWAITING_REVIEW, actor="12345", action="SUBMIT_ACC")
        assert out.status == "AWAITING_REVIEW" and out.review_remark == "ใบชั่งเบลอ"
```

- [ ] **Step 2: รันให้เห็นว่าไม่ผ่าน**

Run: `python -m pytest tests/finance/test_petty_transitions.py -v`
Expected: FAIL — `has no attribute 'set_status'`

- [ ] **Step 3: เขียน `set_status` และ `update_draft`**

ต่อท้าย `services/finance/petty_repo.py`:

```python
from datetime import datetime, timezone

_NOW_FIELDS = {
    "APPROVED": "approved_at",
    "TRANSFERRED": "transfer_slip_at",
    "AWAITING_REVIEW": "submitted_to_acc_at",
}


def set_status(db: Session, claim: FinPettyClaim, target: str, actor: str, action: str,
               fields: Optional[dict] = None, remark: Optional[str] = None) -> FinPettyClaim:
    """จังหวะเดียวที่สถานะเปลี่ยนได้ — ทุก endpoint ต้องผ่านทางนี้ จึงมี log และกฎครบเสมอ"""
    L.assert_transition(claim.status, target)
    before = claim.status
    for key, value in (fields or {}).items():
        setattr(claim, key, value)
    stamp = _NOW_FIELDS.get(target)
    if stamp and getattr(claim, stamp) is None:
        setattr(claim, stamp, datetime.now(timezone.utc))
    if target in ("CLOSED", "SENT_BACK") and claim.reviewed_at is None:
        claim.reviewed_at, claim.reviewed_by = datetime.now(timezone.utc), actor
    claim.status = target
    log(db, claim.id, action, actor, changes={"from": before, "to": target, **{k: str(v) for k, v in (fields or {}).items()}}, remark=remark)
    db.commit()
    db.refresh(claim)
    return claim


_EDITABLE = ("PENDING_APPROVAL", "RETURNED")


def update_draft(db: Session, claim: FinPettyClaim, payload: dict, items: list[dict],
                 actor: str) -> FinPettyClaim:
    """แก้ได้เฉพาะตอนรออนุมัติหรือถูกตีกลับ · แก้แล้วกลับเข้าคิวอนุมัติเสมอ"""
    if claim.status not in _EDITABLE:
        raise L.PettyRuleError(
            f"แก้ไขไม่ได้ ใบนี้สถานะ {L.STATUS_LABELS.get(claim.status, claim.status)} แล้ว", 409)
    for key, value in payload.items():
        setattr(claim, key, value)
    if items:
        replace_items(db, claim.id, items)
        db.refresh(claim)
    was_returned = claim.status == "RETURNED"
    claim.status = L.PENDING_APPROVAL
    log(db, claim.id, "RESUBMIT" if was_returned else "UPDATE", actor,
        changes={"amount": str(claim.amount)})
    db.commit()
    db.refresh(claim)
    return claim
```

- [ ] **Step 4: รันเทสต์ให้ผ่าน**

Run: `python -m pytest tests/finance/test_petty_transitions.py -v`
Expected: PASS ทั้ง 8 เทสต์

- [ ] **Step 5: เพิ่ม endpoint ทั้ง 6**

ต่อท้าย `routes/finance/petty_routes.py` — ทุกตัวเช็ก "คุณคือผู้ถือกองทุนใบนี้ไหม" ก่อน:

```python
from schemas.finance_petty_schema import ApproveIn, ReturnIn, ReviewIn, SubmitAccIn, TransferIn
from services.finance import petty_logic as L


def _claim_or_404(db: Session, form_id: str):
    claim = repo.get_claim(db, form_id)
    if claim is None:
        raise HTTPException(status_code=404, detail="ไม่พบใบเบิก")
    return claim


def _require_holder(db: Session, claim, employee_id: str):
    fund = repo.get_fund(db, claim.fund_id)
    if fund is None or fund.holder_employee_id != employee_id:
        raise HTTPException(status_code=403, detail="เฉพาะผู้อนุมัติของกองทุนนี้เท่านั้น")
    return fund


def _rule_error(exc: L.PettyRuleError) -> HTTPException:
    return HTTPException(status_code=exc.http_status, detail=str(exc))


@router.put("/claims/{form_id}")
def update_claim(form_id: str, payload: ClaimIn, db: Session = Depends(get_db)):
    claim = _claim_or_404(db, form_id)
    if claim.created_by != payload.created_by:
        raise HTTPException(status_code=403, detail="แก้ได้เฉพาะใบที่ตัวเองเปิด")
    body = payload.model_dump(exclude={"created_by", "fund_id", "expense_type"})
    items = body.pop("items")
    try:
        out = repo.update_draft(db, claim, body, items, actor=payload.created_by)
    except L.PettyRuleError as exc:
        raise _rule_error(exc)
    return _claim_dict(out, repo.claim_items(db, out.id))


@router.post("/claims/{form_id}/approve")
def approve_claim(form_id: str, payload: ApproveIn, db: Session = Depends(get_db)):
    claim = _claim_or_404(db, form_id)
    _require_holder(db, claim, payload.employee_id)
    fields = {"approved_by": payload.employee_id}
    if payload.dup_override_reason:
        fields["dup_override_reason"] = payload.dup_override_reason
    try:
        out = repo.set_status(db, claim, L.APPROVED, payload.employee_id, "APPROVE", fields=fields)
    except L.PettyRuleError as exc:
        raise _rule_error(exc)
    return _claim_dict(out, repo.claim_items(db, out.id))


@router.post("/claims/{form_id}/return")
def return_claim(form_id: str, payload: ReturnIn, db: Session = Depends(get_db)):
    claim = _claim_or_404(db, form_id)
    _require_holder(db, claim, payload.employee_id)
    try:
        out = repo.set_status(db, claim, L.RETURNED, payload.employee_id, "RETURN",
                              fields={"return_reason": payload.reason}, remark=payload.reason)
    except L.PettyRuleError as exc:
        raise _rule_error(exc)
    return _claim_dict(out, repo.claim_items(db, out.id))


@router.post("/claims/{form_id}/transfer")
def transfer_claim(form_id: str, payload: TransferIn, db: Session = Depends(get_db)):
    claim = _claim_or_404(db, form_id)
    _require_holder(db, claim, payload.employee_id)
    try:
        out = repo.set_status(db, claim, L.TRANSFERRED, payload.employee_id, "TRANSFER",
                              fields={"transfer_date": payload.transfer_date})
    except L.PettyRuleError as exc:
        raise _rule_error(exc)
    return _claim_dict(out, repo.claim_items(db, out.id))


@router.post("/claims/{form_id}/submit-accounting")
def submit_to_accounting(form_id: str, payload: SubmitAccIn, db: Session = Depends(get_db)):
    claim = _claim_or_404(db, form_id)
    _require_holder(db, claim, payload.employee_id)
    fields = {"dd_no": payload.dd_no} if payload.dd_no else {}
    try:
        out = repo.set_status(db, claim, L.AWAITING_REVIEW, payload.employee_id, "SUBMIT_ACC",
                              fields=fields)
    except L.PettyRuleError as exc:
        raise _rule_error(exc)
    return _claim_dict(out, repo.claim_items(db, out.id))


@router.post("/claims/{form_id}/review")
def review_claim(form_id: str, payload: ReviewIn, db: Session = Depends(get_db)):
    """บัญชีตรวจ — ผ่านแล้วรอการเงินปิดรอบ (ยังไม่ CLOSED) หรือส่งกลับให้ผู้อนุมัติแก้"""
    claim = _claim_or_404(db, form_id)
    if payload.action == "SEND_BACK":
        if not payload.remark:
            raise HTTPException(status_code=422, detail="ส่งกลับต้องระบุเหตุผล")
        try:
            out = repo.set_status(db, claim, L.SENT_BACK, payload.employee_id, "SEND_BACK",
                                  fields={"review_remark": payload.remark}, remark=payload.remark)
        except L.PettyRuleError as exc:
            raise _rule_error(exc)
        return _claim_dict(out, repo.claim_items(db, out.id))
    # PASS: ทำเครื่องหมายว่าบัญชีตรวจแล้ว ใบยังอยู่ AWAITING_REVIEW จนการเงินปิดรอบ
    claim.reviewed_by, claim.review_remark = payload.employee_id, payload.remark
    claim.reviewed_at = datetime.now(timezone.utc)
    repo.log(db, claim.id, "ACC_PASS", payload.employee_id, remark=payload.remark)
    db.commit()
    db.refresh(claim)
    return _claim_dict(claim, repo.claim_items(db, claim.id))
```

เพิ่ม import ที่หัวไฟล์: `from datetime import datetime, timezone`

- [ ] **Step 6: รันเทสต์ทั้งชุด**

Run: `python -m pytest tests/finance -q`
Expected: PASS ทั้งหมด

- [ ] **Step 7: commit**

```bash
git pull && git add services/finance/petty_repo.py routes/finance/petty_routes.py tests/finance/test_petty_transitions.py
git commit -m "feat(petty): status transitions with single-approver guard and audit log"
```

### Task 7: ยอดคงเหลือ Advance + ปิดรอบคืนยอด (BE)

> จุดที่เสี่ยงที่สุดของงานนี้ — ห้ามเขียน `fin_advances` แม้แต่คอลัมน์เดียว ยอดคำนวณสดทุกครั้ง

**Files:**
- Modify: `api-ncac/services/finance/petty_repo.py`
- Modify: `api-ncac/routes/finance/petty_routes.py`
- Test: `api-ncac/tests/finance/test_petty_balance.py`

**Interfaces:**
- Consumes: `models.finance_model.FinAdvance` (อ่านอย่างเดียว) · `models.finance_petty_model.*`
- Produces:
  - `petty_repo.advance_outstanding(db, employee_id: str) -> Decimal`
  - `petty_repo.petty_committed(db, employee_id: str) -> Decimal`
  - `petty_repo.fund_balance(db, fund_id: int) -> dict` → `{advance_outstanding, petty_committed, available, fund_limit}`
  - `petty_repo.close_batch(db, fund_id: int, claim_ids: list[int], actor: str, remark: str | None) -> FinPettyBatch`
  - route: `GET /funds/{id}/balance` · `POST /batches` · `GET /batches`

- [ ] **Step 1: เขียนเทสต์ที่ยังไม่ผ่าน**

`tests/finance/test_petty_balance.py`:

```python
from datetime import date
from decimal import Decimal

import pytest

from models.finance_model import FinAdvance
from services.finance import petty_logic as L
from services.finance import petty_repo as repo
from tests.finance.test_petty_claims import WEIGH_ITEMS, _payload, fund  # noqa: F401


def _paid_advance(db_session, form_id: str, amount: str, fin_status: str = "PAID",
                  employee_id: str = "12345"):
    """ใบ ADV ที่จ่ายแล้ว 1 ใบ — ต้องมี form_submissions คู่ด้วย เพราะ advance_outstanding
    ผูกเจ้าของยอดผ่าน form_submissions.created_by (fin_advances ไม่มีคอลัมน์ employee_id)"""
    from models.master_model import FormSubmission
    submission = FormSubmission(form_id=form_id, created_by=employee_id, status="Open",
                                status_approve="Approved")
    db_session.add(submission)
    db_session.flush()
    row = FinAdvance(submission_id=submission.id, form_id=form_id, amount_paid=Decimal(amount),
                     fin_status=fin_status)
    db_session.add(row)
    db_session.commit()
    return row


class TestOutstanding:
    def test_counts_paid_and_clearing_states(self, db_session):
        _paid_advance(db_session, "ADV-2609-001", "5000")
        _paid_advance(db_session, "ADV-2609-002", "3000", "CLEARING_SUBMITTED")
        _paid_advance(db_session, "ADV-2609-003", "1000", "SENT_BACK")
        assert repo.advance_outstanding(db_session, "12345") == Decimal("9000.00")

    def test_ignores_closed_advances(self, db_session):
        _paid_advance(db_session, "ADV-2609-004", "5000", "CLOSED")
        assert repo.advance_outstanding(db_session, "12345") == Decimal("0.00")

    def test_no_advance_is_zero_not_none(self, db_session):
        assert repo.advance_outstanding(db_session, "nobody") == Decimal("0.00")


class TestCommitted:
    def test_counts_from_approved_to_sent_back(self, db_session, fund):
        claim = repo.create_claim(db_session, _payload(fund), WEIGH_ITEMS, actor="55555")
        assert repo.petty_committed(db_session, "12345") == Decimal("0.00")  # ยังรออนุมัติ
        repo.set_status(db_session, claim, L.APPROVED, "12345", "APPROVE")
        assert repo.petty_committed(db_session, "12345") == Decimal("1640.00")

    def test_closed_claim_releases_the_money(self, db_session, fund):
        claim = repo.create_claim(db_session, _payload(fund), WEIGH_ITEMS, actor="55555")
        repo.set_status(db_session, claim, L.APPROVED, "12345", "APPROVE")
        repo.set_status(db_session, claim, L.TRANSFERRED, "12345", "TRANSFER")
        repo.set_status(db_session, claim, L.AWAITING_REVIEW, "12345", "SUBMIT_ACC")
        repo.set_status(db_session, claim, L.CLOSED, "90001", "CLOSE")
        assert repo.petty_committed(db_session, "12345") == Decimal("0.00")

    def test_returned_claim_does_not_hold_money(self, db_session, fund):
        claim = repo.create_claim(db_session, _payload(fund), WEIGH_ITEMS, actor="55555")
        repo.set_status(db_session, claim, L.RETURNED, "12345", "RETURN")
        assert repo.petty_committed(db_session, "12345") == Decimal("0.00")


class TestFundBalance:
    def test_available_is_outstanding_minus_committed(self, db_session, fund):
        _paid_advance(db_session, "ADV-2609-005", "5000")
        claim = repo.create_claim(db_session, _payload(fund), WEIGH_ITEMS, actor="55555")
        repo.set_status(db_session, claim, L.APPROVED, "12345", "APPROVE")
        bal = repo.fund_balance(db_session, fund.id)
        assert bal["advance_outstanding"] == Decimal("5000.00")
        assert bal["petty_committed"] == Decimal("1640.00")
        assert bal["available"] == Decimal("3360.00")

    def test_available_can_go_negative(self, db_session, fund):
        claim = repo.create_claim(db_session, _payload(fund), WEIGH_ITEMS, actor="55555")
        repo.set_status(db_session, claim, L.APPROVED, "12345", "APPROVE")
        assert repo.fund_balance(db_session, fund.id)["available"] == Decimal("-1640.00")

    def test_never_writes_to_fin_advances(self, db_session, fund):
        adv = _paid_advance(db_session, "ADV-2609-006", "5000")
        claim = repo.create_claim(db_session, _payload(fund), WEIGH_ITEMS, actor="55555")
        repo.set_status(db_session, claim, L.APPROVED, "12345", "APPROVE")
        repo.fund_balance(db_session, fund.id)
        db_session.refresh(adv)
        assert adv.amount_paid == Decimal("5000") and adv.fin_status == "PAID"


class TestCloseBatch:
    def _ready_claim(self, db_session, fund, actor="55555"):
        claim = repo.create_claim(db_session, _payload(fund), WEIGH_ITEMS, actor=actor)
        repo.set_status(db_session, claim, L.APPROVED, "12345", "APPROVE")
        repo.set_status(db_session, claim, L.TRANSFERRED, "12345", "TRANSFER")
        repo.set_status(db_session, claim, L.AWAITING_REVIEW, "12345", "SUBMIT_ACC")
        return claim

    def test_closes_every_claim_and_sums_the_total(self, db_session, fund):
        a = self._ready_claim(db_session, fund)
        b = self._ready_claim(db_session, fund)
        batch = repo.close_batch(db_session, fund.id, [a.id, b.id], actor="90001", remark=None)
        assert batch.total_amount == Decimal("3280.00")
        assert {a.status, b.status} == {"CLOSED"}
        assert a.batch_id == batch.id

    def test_batch_no_is_sequential_per_fund_and_month(self, db_session, fund):
        a = self._ready_claim(db_session, fund)
        first = repo.close_batch(db_session, fund.id, [a.id], actor="90001", remark=None)
        b = self._ready_claim(db_session, fund)
        second = repo.close_batch(db_session, fund.id, [b.id], actor="90001", remark=None)
        assert first.batch_no.endswith("-B1") and second.batch_no.endswith("-B2")

    def test_claim_not_in_awaiting_review_is_rejected(self, db_session, fund):
        claim = repo.create_claim(db_session, _payload(fund), WEIGH_ITEMS, actor="55555")
        with pytest.raises(L.PettyRuleError) as exc:
            repo.close_batch(db_session, fund.id, [claim.id], actor="90001", remark=None)
        assert exc.value.http_status == 409

    def test_claim_from_another_fund_is_rejected(self, db_session, fund):
        from models.finance_petty_model import FinPettyFund
        other = FinPettyFund(branch_code="01", division_code="A01", holder_employee_id="22222")
        db_session.add(other)
        db_session.commit()
        claim = self._ready_claim(db_session, fund)
        with pytest.raises(L.PettyRuleError):
            repo.close_batch(db_session, other.id, [claim.id], actor="90001", remark=None)
```

- [ ] **Step 2: รันให้เห็นว่าไม่ผ่าน**

Run: `python -m pytest tests/finance/test_petty_balance.py -v`
Expected: FAIL — `has no attribute 'advance_outstanding'`

- [ ] **Step 3: เขียนส่วนยอดเงินใน repo**

ต่อท้าย `services/finance/petty_repo.py`:

```python
from models.finance_model import FinAdvance
from models.finance_petty_model import FinPettyBatch

# ยอดที่ Advance จ่ายออกไปแล้วและยังไม่ปิด — petty หักจากยอดนี้ (spec §6)
OUTSTANDING_FIN_STATUSES = ("PAID", "CLEARING_SUBMITTED", "SENT_BACK")
# สถานะที่ถือเงินไว้ของ petty
COMMITTED_STATUSES = ("APPROVED", "TRANSFERRED", "AWAITING_REVIEW", "SENT_BACK")

_ZERO = Decimal("0.00")


def advance_outstanding(db: Session, employee_id: str) -> Decimal:
    """อ่าน fin_advances เท่านั้น ไม่เขียน — ค่าที่บัญชี/การเงินกรอกคือค่าจริง

    ผูกคนด้วย form_submissions.created_by ของใบ ADV นั้น (petty ไม่มีคอลัมน์ employee_id ใน fin_advances)
    """
    from models.master_model import FormSubmission
    total = (db.query(func.coalesce(func.sum(FinAdvance.amount_paid), 0))
             .join(FormSubmission, FormSubmission.form_id == FinAdvance.form_id)
             .filter(FinAdvance.fin_status.in_(OUTSTANDING_FIN_STATUSES),
                     FormSubmission.created_by == employee_id)
             .scalar())
    return Decimal(str(total or 0)).quantize(Decimal("0.01"))


def petty_committed(db: Session, employee_id: str) -> Decimal:
    """ยอดที่ใบ petty ของกองทุนที่คนนี้ถือกินไว้อยู่"""
    total = (db.query(func.coalesce(func.sum(FinPettyClaim.amount), 0))
             .join(FinPettyFund, FinPettyFund.id == FinPettyClaim.fund_id)
             .filter(FinPettyFund.holder_employee_id == employee_id,
                     FinPettyClaim.status.in_(COMMITTED_STATUSES))
             .scalar())
    return Decimal(str(total or 0)).quantize(Decimal("0.01"))


def fund_balance(db: Session, fund_id: int) -> dict:
    fund = get_fund(db, fund_id)
    if fund is None:
        raise LookupError("ไม่พบกองทุน")
    outstanding = advance_outstanding(db, fund.holder_employee_id)
    committed = petty_committed(db, fund.holder_employee_id)
    return {
        "fund_id": fund.id,
        "holder_employee_id": fund.holder_employee_id,
        "advance_outstanding": outstanding,
        "petty_committed": committed,
        "available": (outstanding - committed).quantize(Decimal("0.01")),
        "fund_limit": fund.fund_limit,
    }


def close_batch(db: Session, fund_id: int, claim_ids: list[int], actor: str,
                remark: Optional[str]) -> FinPettyBatch:
    """การเงินปิดรอบ: ใบที่บัญชีตรวจผ่านแล้ว → CLOSED ทีละรอบ แล้วยอดคืนเข้า available เอง"""
    fund = get_fund(db, fund_id)
    if fund is None:
        raise LookupError("ไม่พบกองทุน")
    claims = db.query(FinPettyClaim).filter(FinPettyClaim.id.in_(claim_ids)).all()
    if len(claims) != len(set(claim_ids)):
        raise L.PettyRuleError("มีใบที่หาไม่พบในรายการที่เลือก", 404)
    for claim in claims:
        if claim.fund_id != fund_id:
            raise L.PettyRuleError(f"ใบ {claim.form_id} ไม่ได้อยู่ในกองทุนนี้", 409)
        if claim.status != L.AWAITING_REVIEW:
            raise L.PettyRuleError(
                f"ใบ {claim.form_id} สถานะ {L.STATUS_LABELS.get(claim.status)} ยังปิดรอบไม่ได้", 409)

    yymm = int(datetime.now(timezone.utc).astimezone().strftime("%y%m"))
    used = (db.query(func.count(FinPettyBatch.id))
            .filter(FinPettyBatch.fund_id == fund_id,
                    FinPettyBatch.batch_no.like(f"%-{yymm:04d}-B%"))
            .scalar() or 0)
    batch = FinPettyBatch(
        fund_id=fund_id, closed_by=actor, remark=remark,
        batch_no=L.batch_no(fund.branch_code, fund.division_code, yymm, used + 1),
        total_amount=sum((c.amount for c in claims), _ZERO),
    )
    db.add(batch)
    db.flush()
    for claim in claims:
        set_status(db, claim, L.CLOSED, actor, "CLOSE", fields={"batch_id": batch.id})
    db.commit()
    db.refresh(batch)
    return batch
```

- [ ] **Step 4: รันเทสต์ให้ผ่าน**

Run: `python -m pytest tests/finance/test_petty_balance.py -v`
Expected: PASS ทั้ง 12 เทสต์ รวมข้อ `test_never_writes_to_fin_advances`

- [ ] **Step 5: เพิ่ม endpoint**

```python
from schemas.finance_petty_schema import BatchIn


@router.get("/funds/{fund_id}/balance")
def fund_balance(fund_id: int, db: Session = Depends(get_db)):
    try:
        bal = repo.fund_balance(db, fund_id)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    return {k: (float(v) if isinstance(v, Decimal) else v) for k, v in bal.items()}


@router.post("/batches", status_code=201)
def create_batch(payload: BatchIn, db: Session = Depends(get_db)):
    try:
        batch = repo.close_batch(db, payload.fund_id, payload.claim_ids, payload.employee_id,
                                 payload.remark)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except L.PettyRuleError as exc:
        raise _rule_error(exc)
    return {"id": batch.id, "batch_no": batch.batch_no, "fund_id": batch.fund_id,
            "total_amount": float(batch.total_amount), "closed_at": batch.closed_at.isoformat()}


@router.get("/batches")
def list_batches(fund_id: Optional[int] = None, limit: int = Query(default=50, le=200),
                 db: Session = Depends(get_db)):
    q = db.query(FinPettyBatch)
    if fund_id:
        q = q.filter(FinPettyBatch.fund_id == fund_id)
    rows = q.order_by(FinPettyBatch.id.desc()).limit(limit).all()
    return [{"id": b.id, "batch_no": b.batch_no, "fund_id": b.fund_id,
             "total_amount": float(b.total_amount), "closed_by": b.closed_by,
             "closed_at": b.closed_at.isoformat(), "remark": b.remark} for b in rows]
```

เพิ่ม import: `from decimal import Decimal` และ `from models.finance_petty_model import FinPettyBatch`

- [ ] **Step 6: รันเทสต์ทั้งชุด แล้ว commit**

Run: `python -m pytest tests/finance -q`

```bash
git pull && git add services/finance/petty_repo.py routes/finance/petty_routes.py tests/finance/test_petty_balance.py
git commit -m "feat(petty): derived advance balance and batch close that never writes fin_advances"
```

### Task 8: หน้าเปิดใบ (FE)

**Files:**
- Create: `menait-service/app/api/finance/petty/claims/route.ts`
- Create: `menait-service/app/api/finance/petty/claims/[form_id]/route.ts`
- Create: `menait-service/app/api/finance/petty/claims/[form_id]/[action]/route.ts`
- Create: `menait-service/app/api/finance/petty/funds/[id]/balance/route.ts`
- Create: `menait-service/app/finance/petty/new/page.tsx`
- Create: `menait-service/app/finance/components/petty/ItemGrid.tsx`
- Create: `menait-service/app/finance/components/petty/AddManyTrucksDialog.tsx`
- Create: `menait-service/app/finance/petty/page.tsx`
- Test: `menait-service/lib/finance/petty-spec.ts` + `petty-spec.test.ts`

**Interfaces:**
- Consumes: `petty-items.ts` (`claimTotal` `lineAmount` `parseTruckPaste` `periodOf`) · `types-petty.ts` · `FilePicker.tsx` · `DateField.tsx` (ของเดิม ใช้ซ้ำ)
- Produces:
  - `petty-spec.ts`: `headerFields(spec)` · `itemFields(spec)` · `isItemBased(spec)` · `requiredAttachments(spec, stage)` · `blankItem(spec): PettyItemDraft` · `claimPayload(form, items): object`

- [ ] **Step 1: เขียนเทสต์ `petty-spec.test.ts` ที่ยังไม่ผ่าน**

```ts
import { describe, expect, test } from 'bun:test';
import type { PettySpec } from '@/app/finance/types-petty';
import { blankItem, claimPayload, headerFields, isItemBased, itemFields, requiredAttachments } from './petty-spec';

const WEIGH: PettySpec = {
  item_based: true,
  header_fields: [{ key: 'payee_name', label: 'จ่ายให้', type: 'employee', required: true }],
  item_fields: [
    { key: 'event_date', label: 'วันที่ชั่ง', type: 'date', required: true },
    { key: 'ref_no', label: 'เลขที่บัตรชั่ง', type: 'text', required: true },
    { key: 'rate', label: 'ราคา/ครั้ง', type: 'money', required: true },
  ],
  attachments: [
    { key: 'weigh_slip', label: 'ใบชั่งน้ำหนัก (สำเนา)', required: true, max: 10 },
    { key: 'transfer', label: 'หลักฐานโอนเงิน', required: true, max: 3 },
    { key: 'other', label: 'อื่นๆ', required: false, max: 3 },
  ],
  rules: [{ when: 'total >= 500', require_field: 'dd_no', at: 'BEFORE_SUBMIT_TO_ACCOUNTING' }],
};

describe('shape', () => {
  test('weigh is item based', () => expect(isItemBased(WEIGH)).toBe(true));
  test('an empty spec is not', () => expect(isItemBased({})).toBe(false));
  test('header fields read back', () => expect(headerFields(WEIGH).map(f => f.key)).toEqual(['payee_name']));
  test('item fields read back', () => expect(itemFields(WEIGH)).toHaveLength(3));
  test('missing groups give empty arrays, never undefined', () => {
    expect(itemFields({})).toEqual([]);
    expect(headerFields({})).toEqual([]);
  });
});

describe('requiredAttachments', () => {
  test('only the required ones', () =>
    expect(requiredAttachments(WEIGH).map(a => a.key)).toEqual(['weigh_slip', 'transfer']));
  test('none when the spec has no attachments', () => expect(requiredAttachments({})).toEqual([]));
});

describe('blankItem', () => {
  test('one key per item field plus qty', () => {
    const row = blankItem(WEIGH);
    expect(Object.keys(row).sort()).toEqual(['event_date', 'qty', 'rate', 'ref_no']);
    expect(row.qty).toBe(1);
  });
});

describe('claimPayload', () => {
  const form = { fund_id: 1, expense_type: 'WEIGH', expense_date: '2026-09-25', payee_name: 'อัญชัญ น่วมมี' };
  const items = [{ event_date: '2026-09-17', ref_no: '000055', qty: 1, rate: 100 }];

  test('carries items through', () => expect(claimPayload(form, items).items).toHaveLength(1));
  test('does not send amount — BE computes it', () =>
    expect('amount' in claimPayload(form, items)).toBe(false));
  test('does not send created_by — the BFF adds it from the session', () =>
    expect('created_by' in claimPayload(form, items)).toBe(false));
  test('drops rows with no rate at all', () =>
    expect(claimPayload(form, [...items, { event_date: '', ref_no: '', qty: 1, rate: '' }]).items)
      .toHaveLength(1));
});
```

- [ ] **Step 2: รันให้เห็นว่าไม่ผ่าน**

Run: `bun test lib/finance/petty-spec.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: เขียน `petty-spec.ts`**

```ts
import type { PettySpec, PettySpecAttachment, PettySpecField } from '@/app/finance/types-petty';
import type { PettyItemDraft } from '@/lib/finance/petty-items';

export function isItemBased(spec: PettySpec | null | undefined): boolean {
  return spec?.item_based === true;
}

export function headerFields(spec: PettySpec | null | undefined): PettySpecField[] {
  return spec?.header_fields ?? [];
}

export function itemFields(spec: PettySpec | null | undefined): PettySpecField[] {
  return spec?.item_fields ?? [];
}

export function requiredAttachments(spec: PettySpec | null | undefined): PettySpecAttachment[] {
  return (spec?.attachments ?? []).filter(a => a.required === true);
}

/** แถวเปล่าตาม spec — ช่อง `truck` แตกเป็น truck_code/truck_plate ตอนบันทึก ไม่ใช่ตอนนี้ */
export function blankItem(spec: PettySpec | null | undefined): PettyItemDraft & Record<string, unknown> {
  const row: Record<string, unknown> = { qty: 1 };
  for (const field of itemFields(spec)) {
    if (field.key === 'truck') { row.truck_code = ''; row.truck_plate = ''; continue; }
    row[field.key] = '';
  }
  return row as PettyItemDraft & Record<string, unknown>;
}

/** payload ที่ส่งไป BFF — ไม่มี amount และไม่มี created_by (BE คำนวณ / BFF เติมจาก session) */
export function claimPayload(
  form: Record<string, unknown>,
  items: readonly PettyItemDraft[],
): Record<string, unknown> & { items: PettyItemDraft[] } {
  const kept = items.filter(i => String(i.rate ?? '').trim() !== '' || String(i.event_date ?? '').trim() !== '');
  const { amount: _amount, created_by: _createdBy, ...rest } = form as Record<string, unknown>;
  return { ...rest, items: kept.filter(i => String(i.rate ?? '').trim() !== '') };
}
```

- [ ] **Step 4: รันเทสต์ให้ผ่าน**

Run: `bun test lib/finance/petty-spec.test.ts`
Expected: PASS

- [ ] **Step 5: BFF ของ claims**

`app/api/finance/petty/claims/route.ts` — ขา GET แยกสามมุมมองด้วย `view`:

```ts
import type { NextRequest } from 'next/server';
import { beUrl, proxy, requireUser } from '@/lib/finance/server';

export async function GET(req: NextRequest) {
  const guard = await requireUser(req);
  if ('error' in guard) return guard.error;
  const sp = req.nextUrl.searchParams;
  const view = sp.get('view') ?? 'mine';
  const seesAll = guard.user.is_finance === true || guard.user.role === 'a';
  const scope =
    view === 'approvals' ? { holder: guard.user.employee_id }
    : view === 'all' && seesAll ? {}
    : { employee_id: guard.user.employee_id };  // ค่าเริ่มต้นแคบสุดเสมอ
  return proxy(beUrl('/finance/petty/claims', {
    ...scope,
    status: sp.get('status'),
    month: sp.get('month'),
    limit: sp.get('limit') ?? '50',
    offset: sp.get('offset') ?? '0',
  }));
}

export async function POST(req: NextRequest) {
  const guard = await requireUser(req);
  if ('error' in guard) return guard.error;
  const body = await req.json().catch(() => null);
  if (!body) return Response.json({ error: 'ข้อมูลไม่ถูกต้อง' }, { status: 400 }) as never;
  // created_by มาจาก session เท่านั้น
  return proxy(beUrl('/finance/petty/claims'), {
    method: 'POST',
    body: JSON.stringify({ ...body, created_by: guard.user.employee_id }),
  });
}
```

`app/api/finance/petty/claims/[form_id]/route.ts` — GET/PUT โดยการ์ดด้วย `isPettyFormId` ก่อนแตะ BE:

```ts
import { NextResponse, type NextRequest } from 'next/server';
import { isPettyFormId } from '@/lib/finance/petty-access';
import { beUrl, proxy, requireUser } from '@/lib/finance/server';

const bad = () => NextResponse.json({ error: 'หมายเลขเอกสารไม่ถูกต้อง' }, { status: 400 });

export async function GET(req: NextRequest, { params }: { params: Promise<{ form_id: string }> }) {
  const guard = await requireUser(req);
  if ('error' in guard) return guard.error;
  const { form_id } = await params;
  if (!isPettyFormId(form_id)) return bad();
  return proxy(beUrl(`/finance/petty/claims/${encodeURIComponent(form_id)}`));
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ form_id: string }> }) {
  const guard = await requireUser(req);
  if ('error' in guard) return guard.error;
  const { form_id } = await params;
  if (!isPettyFormId(form_id)) return bad();
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'ข้อมูลไม่ถูกต้อง' }, { status: 400 });
  return proxy(beUrl(`/finance/petty/claims/${encodeURIComponent(form_id)}`), {
    method: 'PUT',
    body: JSON.stringify({ ...body, created_by: guard.user.employee_id }),
  });
}
```

`app/api/finance/petty/claims/[form_id]/[action]/route.ts` — ปุ่มทั้ง 5 ผ่านทางเดียว:

```ts
import { NextResponse, type NextRequest } from 'next/server';
import { isPettyFormId } from '@/lib/finance/petty-access';
import { beUrl, proxy, requireUser } from '@/lib/finance/server';

const ACTIONS = new Set(['approve', 'return', 'transfer', 'submit-accounting', 'review']);

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ form_id: string; action: string }> },
) {
  const guard = await requireUser(req);
  if ('error' in guard) return guard.error;
  const { form_id, action } = await params;
  if (!isPettyFormId(form_id)) {
    return NextResponse.json({ error: 'หมายเลขเอกสารไม่ถูกต้อง' }, { status: 400 });
  }
  if (!ACTIONS.has(action)) return NextResponse.json({ error: 'คำสั่งไม่ถูกต้อง' }, { status: 400 });
  if (action === 'review' && guard.user.is_finance !== true && guard.user.role !== 'a') {
    return NextResponse.json({ error: 'เฉพาะฝ่ายบัญชีเท่านั้น' }, { status: 403 });
  }
  const body = await req.json().catch(() => ({}));
  // employee_id มาจาก session — BE ใช้ค่านี้ตรวจว่าเป็นผู้ถือกองทุนไหม
  return proxy(beUrl(`/finance/petty/claims/${encodeURIComponent(form_id)}/${action}`), {
    method: 'POST',
    body: JSON.stringify({ ...body, employee_id: guard.user.employee_id }),
  });
}
```

`app/api/finance/petty/funds/[id]/balance/route.ts`:

```ts
import { NextResponse, type NextRequest } from 'next/server';
import { beUrl, proxy, requireUser } from '@/lib/finance/server';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireUser(req);
  if ('error' in guard) return guard.error;
  const { id } = await params;
  if (!/^\d+$/.test(id)) return NextResponse.json({ error: 'ไม่พบกองทุน' }, { status: 404 });
  return proxy(beUrl(`/finance/petty/funds/${id}/balance`));
}
```

- [ ] **Step 6: `ItemGrid.tsx`**

ตารางกรอกรายการ — รับ `spec`, `items`, `onChange`; เรนเดอร์คอลัมน์จาก `itemFields(spec)`; คอลัมน์ขวาสุดเป็นยอดบรรทัดจาก `lineAmount`; แถวท้ายโชว์ยอดรวมจาก `claimTotal`; ปุ่ม `+ เพิ่มแถว` และ `เพิ่มหลายคัน`; ช่อง `type: 'truck'` เป็น input ค้นได้ที่เก็บทั้ง `truck_code` และ `truck_plate` (ต่อ master รถใน Task 11 — เฟสนี้พิมพ์ได้ก่อนแต่ต้องกรอกทั้งสองช่อง)

**กติกาที่ต้องทำให้ถูก** — คอลัมน์ `ref_no` ของประเภท `WEIGH` บังคับ ช่องว่างต้องขึ้นกรอบแดงและปิดปุ่มส่ง

- [ ] **Step 7: `AddManyTrucksDialog.tsx`**

`<textarea>` + วันที่ + ราคา + ประเภทรถ → กด "สร้างแถว" แล้วเรียก `parseTruckPaste` สร้างแถวละคัน โดยเติมวันที่/ราคา/ประเภทเหมือนกันทุกแถว เหลือให้เติมเลขที่บัตรชั่งเอง · ข้อความในกล่อง: "วางรหัสรถคั่นด้วยเว้นวรรคหรือจุลภาค เช่น 161 144 F014 F016"

- [ ] **Step 8: `app/finance/petty/new/page.tsx`**

โครงตาม `app/finance/advance/new/page.tsx`: เลือก **ประเภทการเบิก** (จาก `/api/finance/petty/expense-types`) → เลือก **กองทุน** (จาก `/api/finance/petty/funds`) → ช่องหัวใบจาก `headerFields` → `ItemGrid` → ชุดอัปโหลดจาก `spec.attachments` ด้วย `FilePicker` เดิม → ปุ่มบันทึกร่าง/ส่ง · ช่วงวันที่เติมเองจาก `periodOf(items)` และแสดงแบบอ่านอย่างเดียว

- [ ] **Step 9: `app/finance/petty/page.tsx`**

ตารางใบของตัวเอง แยกแท็บตามสถานะ (`รออนุมัติ` / `ตีกลับผู้เบิก` / `กำลังดำเนินการ` / `ปิดแล้ว`) ใช้ `StatusBadge` เดิมแต่ส่งสี/ป้ายจาก `PETTY_STATUS_*` · แท็บ "ตีกลับผู้เบิก" ต้องโชว์ `return_reason` ทุกใบ เพราะเจ้าหน้าที่คือคนที่ต้องแก้

- [ ] **Step 10: ทดสอบด้วยมือ 1 รอบ แล้ว commit**

Run: `bun --bun next dev -p 8000` แล้วเปิดใบ 16 แถวจากเอกสารจริง ตรวจว่ายอดขึ้น 1,640.00 และ `form_id` เป็น `03-B02-2610-00x`

```bash
git pull && git add app/api/finance/petty app/finance/petty app/finance/components/petty lib/finance/petty-spec.ts lib/finance/petty-spec.test.ts
git commit -m "feat(petty): claim form with item grid, add-many-trucks and clerk list"
```

### Task 9: หน้าอนุมัติ · บัญชี · ปิดรอบ (FE)

**Files:**
- Create: `menait-service/app/finance/petty/approvals/page.tsx`
- Create: `menait-service/app/finance/petty/accounting/page.tsx`
- Create: `menait-service/app/finance/petty/batches/page.tsx`
- Create: `menait-service/app/finance/petty/[form_id]/page.tsx`
- Create: `menait-service/app/finance/components/petty/BalanceCard.tsx`
- Create: `menait-service/app/api/finance/petty/batches/route.ts`

**Interfaces:**
- Consumes: `petty-access.ts` (`canApprove` `canCloseBatch`) · `/api/finance/petty/claims?view=approvals` · `/api/finance/petty/funds/{id}/balance`
- Produces: ไม่มี export ใหม่ (หน้าจอล้วน)

- [ ] **Step 1: `BalanceCard.tsx`**

การ์ดยอดคงเหลือของกองทุน: `ยอด Advance คงเหลือ` − `ใบที่ยังไม่คืนยอด` = `พร้อมอนุมัติ` · ถ้า `available < 0` พื้นการ์ดเป็น `bg-rose-50` และมีบรรทัด "ติดลบอยู่ อนุมัติต่อได้แต่ควรเร่งปิดรอบ"

- [ ] **Step 2: `approvals/page.tsx`**

คิวของกองทุนที่ตัวเองถือ (`view=approvals`) · ปุ่มตามสถานะ: `PENDING_APPROVAL` → อนุมัติ/ตีกลับ · `APPROVED` → บันทึกการโอน · `TRANSFERRED` → ส่งบัญชี · ตีกลับต้องกรอกเหตุผล (บังคับ ไม่งั้นปุ่มปิด) · ทุกปุ่มยิงไป `/api/finance/petty/claims/{form_id}/{action}` แล้ว refresh

**สำคัญ** — ถ้า BE ตอบ 409 ให้แสดงข้อความจาก BE ตรง ๆ แล้ว reload ใบนั้น (นี่คือเคส "แท็บเปิดค้างไว้" ของ Review Focus 4 ไม่ใช่ error ที่ต้องซ่อน)

- [ ] **Step 3: `accounting/page.tsx`**

คิว `AWAITING_REVIEW` ทุกกองทุน · ปุ่ม `ผ่าน` / `ส่งกลับแก้ไข` (ส่งกลับต้องมีเหตุผล) · โชว์ `dd_no` และลิงก์ไฟล์แนบ

- [ ] **Step 4: `batches/page.tsx` + BFF**

`app/api/finance/petty/batches/route.ts`:

```ts
import { NextResponse, type NextRequest } from 'next/server';
import { canCloseBatch } from '@/lib/finance/petty-access';
import { beUrl, proxy, requireUser } from '@/lib/finance/server';

export async function GET(req: NextRequest) {
  const guard = await requireUser(req);
  if ('error' in guard) return guard.error;
  return proxy(beUrl('/finance/petty/batches', { fund_id: req.nextUrl.searchParams.get('fund_id') }));
}

export async function POST(req: NextRequest) {
  const guard = await requireUser(req);
  if ('error' in guard) return guard.error;
  if (!canCloseBatch(guard.user)) {
    return NextResponse.json({ error: 'เฉพาะฝ่ายการเงินเท่านั้น' }, { status: 403 });
  }
  const body = await req.json().catch(() => null);
  if (!Array.isArray(body?.claim_ids) || body.claim_ids.length === 0) {
    return NextResponse.json({ error: 'ยังไม่ได้เลือกใบที่จะปิดรอบ' }, { status: 400 });
  }
  return proxy(beUrl('/finance/petty/batches'), {
    method: 'POST',
    body: JSON.stringify({ ...body, employee_id: guard.user.employee_id }),
  });
}
```

หน้า: เลือกกองทุน → ตารางใบที่บัญชีตรวจผ่านแล้ว (ติ๊กหลายใบ) → แถบล่างโชว์ยอดรวมที่จะคืน → ปุ่ม "ปิดรอบและคืนยอด" พร้อมกล่องยืนยันที่บอกจำนวนใบและยอดรวม

- [ ] **Step 5: `[form_id]/page.tsx`**

หน้ารายละเอียดใบเดียว: หัวใบ · ตารางรายการ · ไฟล์แนบ · `LogList` เดิม · แผงด่าน (เติมจริงใน Task 10) · ปุ่มพิมพ์ (เติมจริงใน Task 12)

- [ ] **Step 6: เดินครบ 7 ขั้นด้วยมือ แล้ว commit**

เปิดใบ → อนุมัติ → โอน → ส่งบัญชี → บัญชีผ่าน → ปิดรอบ แล้วเช็กว่า `available` กลับมาเท่าเดิม

```bash
git pull && git add app/finance/petty app/finance/components/petty app/api/finance/petty/batches
git commit -m "feat(petty): approver, accounting and batch-close screens"
```

> **จุดพิสูจน์ S2** — ถึงตรงนี้ต้องเดินครบ 7 ขั้นได้โดย **ไม่ได้แก้ไฟล์ใด ๆ ของ Advance** นอกจาก `generate_form_id` และ `main.py` ถ้าต้องแก้มากกว่านั้น หยุดแล้วทบทวน §6 ของสเปกก่อนไปต่อ

## S3 — ด่านตรวจ

### Task 10: ด่านเอกสาร + ด่านซ้ำสองระดับ + คำเตือนยอดติดลบ

**Files:**
- Create: `api-ncac/services/finance/petty_validate.py`
- Modify: `api-ncac/services/finance/petty_repo.py` (เพิ่ม query หาใบซ้ำ + นับไฟล์แนบ)
- Modify: `api-ncac/routes/finance/petty_routes.py` (เรียก validate ใน approve / submit-accounting + endpoint duplicate-check)
- Create: `menait-service/app/finance/components/petty/GatePanel.tsx`
- Create: `menait-service/app/api/finance/petty/claims/duplicate-check/route.ts`
- Test: `api-ncac/tests/finance/test_petty_validate.py`

**Interfaces:**
- Consumes: `petty_logic.hard_dup_key` `normalize_plate` · `fin_petty_expense_types.spec`
- Produces:
  - `petty_validate.validate_claim(claim: Mapping, items: list[Mapping], spec: Mapping, stage: str, attachments: Mapping[str, int]) -> dict` → `{"missing": [...], "warnings": [...]}`
  - `petty_validate.STAGE_APPROVE = "BEFORE_APPROVE"` · `STAGE_SUBMIT_ACC = "BEFORE_SUBMIT_TO_ACCOUNTING"`
  - `petty_validate.split_duplicates(items, prior, spec) -> dict` → `{"hard": [...], "soft": [...]}`
  - `petty_repo.find_prior_items(db, *, expense_type: str, keys: list[dict], days: int, exclude_claim_id: int | None) -> list[dict]`
  - `petty_repo.attachment_counts(db, form_id: str) -> dict[str, int]` (อ่านจาก S3 ผ่าน BE helper เดิม หรือรับจาก FE — ดู Step 5)
  - route: `GET /finance/petty/claims/duplicate-check`

- [ ] **Step 1: เขียนเทสต์ที่ยังไม่ผ่าน**

`tests/finance/test_petty_validate.py`:

```python
from datetime import date

from services.finance import petty_validate as V

WEIGH_SPEC = {
    "item_based": True,
    "item_fields": [
        {"key": "event_date", "label": "วันที่ชั่ง", "required": True},
        {"key": "ref_no", "label": "เลขที่บัตรชั่ง", "required": True},
        {"key": "rate", "label": "ราคา/ครั้ง", "required": True},
    ],
    "attachments": [
        {"key": "weigh_slip", "label": "ใบชั่งน้ำหนัก (สำเนา)", "required": True},
        {"key": "transfer", "label": "หลักฐานโอนเงิน", "required": True},
    ],
    "rules": [
        {"when": "total >= 500", "require_field": "dd_no", "at": "BEFORE_SUBMIT_TO_ACCOUNTING"},
        {"when": "always", "require_attachment": "weigh_slip", "at": "BEFORE_APPROVE"},
    ],
    "duplicate_check": {
        "scope": "item",
        "hard": {"keys": ["ref_no", "truck_code", "truck_plate"], "days": 365, "action": "block"},
        "soft": {"keys": ["event_date", "truck"], "days": 7, "action": "warn"},
    },
}

CLAIM = {"amount": 1640, "dd_no": None, "expense_type": "WEIGH"}
ITEM = {"event_date": date(2026, 9, 17), "truck_code": "161", "truck_plate": "71-4285",
        "ref_no": "000055", "qty": 1, "rate": 100}
FULL_FILES = {"weigh_slip": 16, "transfer": 1}


class TestDocumentGate:
    def test_complete_claim_passes(self):
        out = V.validate_claim(CLAIM, [ITEM], WEIGH_SPEC, V.STAGE_APPROVE, FULL_FILES)
        assert out["missing"] == []

    def test_missing_weigh_slip_blocks(self):
        out = V.validate_claim(CLAIM, [ITEM], WEIGH_SPEC, V.STAGE_APPROVE, {"transfer": 1})
        assert any("ใบชั่งน้ำหนัก" in m["label"] for m in out["missing"])

    def test_missing_transfer_proof_blocks(self):
        out = V.validate_claim(CLAIM, [ITEM], WEIGH_SPEC, V.STAGE_APPROVE, {"weigh_slip": 2})
        assert any(m["key"] == "transfer" for m in out["missing"])

    def test_row_without_ticket_number_blocks_and_names_the_row(self):
        items = [ITEM, dict(ITEM, ref_no="")]
        out = V.validate_claim(CLAIM, items, WEIGH_SPEC, V.STAGE_APPROVE, FULL_FILES)
        missing = [m for m in out["missing"] if m["key"] == "ref_no"]
        assert missing and missing[0]["line_no"] == 2

    def test_dd_is_not_required_at_approval(self):
        out = V.validate_claim(CLAIM, [ITEM], WEIGH_SPEC, V.STAGE_APPROVE, FULL_FILES)
        assert all(m["key"] != "dd_no" for m in out["missing"])

    def test_dd_required_at_submit_when_total_is_500_or_more(self):
        out = V.validate_claim(CLAIM, [ITEM], WEIGH_SPEC, V.STAGE_SUBMIT_ACC, FULL_FILES)
        assert any(m["key"] == "dd_no" for m in out["missing"])

    def test_dd_not_required_under_500(self):
        out = V.validate_claim(dict(CLAIM, amount=400), [ITEM], WEIGH_SPEC, V.STAGE_SUBMIT_ACC, FULL_FILES)
        assert all(m["key"] != "dd_no" for m in out["missing"])

    def test_empty_spec_blocks_nothing(self):
        assert V.validate_claim(CLAIM, [ITEM], {}, V.STAGE_APPROVE, {})["missing"] == []


class TestDuplicates:
    def test_same_ticket_same_truck_is_hard(self):
        prior = [dict(ITEM, form_id="03-B02-2609-001")]
        out = V.split_duplicates([ITEM], prior, WEIGH_SPEC)
        assert len(out["hard"]) == 1
        assert out["hard"][0]["form_id"] == "03-B02-2609-001"

    def test_plate_written_with_a_space_still_matches(self):
        # Review Focus 1
        prior = [dict(ITEM, truck_plate="71 4285", form_id="03-B02-2609-001")]
        assert len(V.split_duplicates([ITEM], prior, WEIGH_SPEC)["hard"]) == 1

    def test_same_ticket_different_truck_is_not_hard(self):
        prior = [dict(ITEM, truck_code="999", truck_plate="99-9999", form_id="03-B02-2609-001")]
        assert V.split_duplicates([ITEM], prior, WEIGH_SPEC)["hard"] == []

    def test_two_rows_in_one_claim_with_the_same_ticket_is_hard(self):
        rows = [ITEM, dict(ITEM)]
        out = V.split_duplicates(rows, [], WEIGH_SPEC)
        assert len(out["hard"]) == 1 and out["hard"][0]["form_id"] is None

    def test_the_real_1093_case_different_tickets_is_only_soft(self):
        rows = [dict(ITEM, truck_code="1093", truck_plate="71-1093", ref_no="000120"),
                dict(ITEM, truck_code="1093", truck_plate="71-1093", ref_no="000121")]
        out = V.split_duplicates(rows, [], WEIGH_SPEC)
        assert out["hard"] == [] and len(out["soft"]) == 1

    def test_soft_window_is_seven_days(self):
        prior = [dict(ITEM, ref_no="999999", event_date=date(2026, 9, 23), form_id="x")]
        near = V.split_duplicates([dict(ITEM, event_date=date(2026, 9, 17))], prior, WEIGH_SPEC)
        far = V.split_duplicates([dict(ITEM, event_date=date(2026, 9, 1))], prior, WEIGH_SPEC)
        assert len(near["soft"]) == 1 and far["soft"] == []

    def test_rows_without_a_ticket_number_fall_back_to_soft_only(self):
        rows = [dict(ITEM, ref_no=""), dict(ITEM, ref_no="")]
        out = V.split_duplicates(rows, [], WEIGH_SPEC)
        assert out["hard"] == [] and len(out["soft"]) == 1
```

- [ ] **Step 2: รันให้เห็นว่าไม่ผ่าน**

Run: `python -m pytest tests/finance/test_petty_validate.py -v`
Expected: FAIL — `No module named 'services.finance.petty_validate'`

- [ ] **Step 3: เขียน `petty_validate.py`**

```python
"""ด่านตรวจของเบิกเงินสดย่อย — ล้วน ไม่ query เอง (repo ส่งข้อมูลที่ต้องใช้มาให้)

สองด่านคนละเรื่องกัน:
  เอกสารไม่ครบ = บล็อก ไม่มีทับ
  ซ้ำ          = เข้ม (บัตรชั่ง+รถ) บล็อก · อ่อน (วันที่+รถ) เตือน ทับได้พร้อมเหตุผล
"""
from __future__ import annotations

from datetime import date, timedelta
from decimal import Decimal
from typing import Iterable, Mapping

from services.finance import petty_logic as L

STAGE_APPROVE = "BEFORE_APPROVE"
STAGE_SUBMIT_ACC = "BEFORE_SUBMIT_TO_ACCOUNTING"


def _rule_applies(when: str, claim: Mapping) -> bool:
    if when in ("always", "", None):
        return True
    if when.startswith("total >="):
        return Decimal(str(claim.get("amount") or 0)) >= Decimal(when.split(">=")[1].strip())
    if when.startswith("total <"):
        return Decimal(str(claim.get("amount") or 0)) < Decimal(when.split("<")[1].strip())
    return False  # เงื่อนไขที่ยังไม่รองรับ = ไม่บังคับ ดีกว่าบล็อกใบด้วยกฎที่อ่านไม่ออก


def validate_claim(claim: Mapping, items: list[Mapping], spec: Mapping, stage: str,
                   attachments: Mapping[str, int]) -> dict:
    """คืน {"missing": [...], "warnings": [...]} — missing ไม่ว่าง = ห้ามผ่านด่านนี้"""
    missing: list[dict] = []
    labels = {a["key"]: a.get("label", a["key"]) for a in spec.get("attachments", []) or []}

    # 1) ไฟล์แนบที่ spec บอกว่าบังคับ (ตรวจที่ขั้นอนุมัติ)
    if stage == STAGE_APPROVE:
        for att in spec.get("attachments", []) or []:
            if att.get("required") and not attachments.get(att["key"]):
                missing.append({"kind": "attachment", "key": att["key"],
                                "label": att.get("label", att["key"])})

    # 2) ช่องบังคับของรายการ
    if stage == STAGE_APPROVE:
        for field in spec.get("item_fields", []) or []:
            if not field.get("required"):
                continue
            key = field["key"]
            for index, item in enumerate(items, start=1):
                value = item.get(key)
                if value is None or str(value).strip() == "":
                    missing.append({"kind": "item_field", "key": key, "line_no": index,
                                    "label": f"{field.get('label', key)} (แถวที่ {index})"})

    # 3) กฎเฉพาะของประเภท
    for rule in spec.get("rules", []) or []:
        if rule.get("at") != stage or not _rule_applies(rule.get("when", "always"), claim):
            continue
        field = rule.get("require_field")
        if field and not str(claim.get(field) or "").strip():
            missing.append({"kind": "field", "key": field, "label": _FIELD_LABELS.get(field, field)})
        att = rule.get("require_attachment")
        if att and not attachments.get(att):
            missing.append({"kind": "attachment", "key": att, "label": labels.get(att, att)})

    return {"missing": _dedupe(missing), "warnings": []}


_FIELD_LABELS = {"dd_no": "เลขที่ใบรับสินค้า (DD)", "receipt_no": "เลขที่ใบเสร็จ"}


def _dedupe(rows: list[dict]) -> list[dict]:
    seen, out = set(), []
    for row in rows:
        token = (row.get("kind"), row.get("key"), row.get("line_no"))
        if token in seen:
            continue
        seen.add(token)
        out.append(row)
    return out


def _soft_key(item: Mapping) -> tuple[str, str]:
    return (L.normalize_code(item.get("truck_code")), L.normalize_plate(item.get("truck_plate")))


def split_duplicates(items: Iterable[Mapping], prior: Iterable[Mapping], spec: Mapping) -> dict:
    """เทียบรายการในใบนี้กับใบอื่น *และกับกันเอง* — ของจริงมีรถซ้ำในใบเดียวมาแล้ว"""
    cfg = spec.get("duplicate_check") or {}
    soft_days = int((cfg.get("soft") or {}).get("days", 7))
    hard, soft = [], []
    pool = list(prior)

    for index, item in enumerate(items, start=1):
        key = L.hard_dup_key(item)
        for other in pool:
            if key is not None and L.hard_dup_key(other) == key:
                hard.append({"line_no": index, "form_id": other.get("form_id"),
                             "ref_no": item.get("ref_no"), "truck_code": item.get("truck_code"),
                             "message": "บัตรชั่งใบนี้ของรถคันนี้เบิกไปแล้ว"})
                break
        else:
            for other in pool:
                if _soft_key(other) != _soft_key(item):
                    continue
                here, there = item.get("event_date"), other.get("event_date")
                if here and there and abs((here - there).days) <= soft_days:
                    soft.append({"line_no": index, "form_id": other.get("form_id"),
                                 "event_date": str(here), "truck_code": item.get("truck_code"),
                                 "message": f"รถคันนี้มีรายการใน {soft_days} วันที่ผ่านมา"})
                    break
        pool.append({**item, "form_id": item.get("form_id")})

    return {"hard": hard, "soft": soft}
```

- [ ] **Step 4: รันเทสต์ให้ผ่าน**

Run: `python -m pytest tests/finance/test_petty_validate.py -v`
Expected: PASS ทั้ง 15 เทสต์

- [ ] **Step 5: เชื่อมด่านเข้า route**

เพิ่มใน `petty_repo.py`:

```python
def find_prior_items(db: Session, *, expense_type: str, keys: list[dict], days: int,
                     exclude_claim_id: Optional[int]) -> list[dict]:
    """ดึงรายการของประเภทเดียวกันที่อาจซ้ำ — จำกัดด้วยช่วงวันและรถที่อยู่ในใบนี้เท่านั้น

    ไม่ดึงทั้งตาราง: สร้าง filter จากรถในใบ (ปกติ ≤ 20 คัน) แล้วปล่อยให้ index
    (event_date, truck_code) กับ (ref_no, truck_code, truck_plate) ทำงาน
    """
    if not keys:
        return []
    dates = [k["event_date"] for k in keys if k.get("event_date")]
    if not dates:
        return []
    low, high = min(dates) - timedelta(days=days), max(dates) + timedelta(days=days)
    codes = {str(k.get("truck_code") or "") for k in keys}
    refs = {str(k.get("ref_no") or "") for k in keys if k.get("ref_no")}

    q = (db.query(FinPettyClaimItem, FinPettyClaim.form_id, FinPettyClaim.id)
         .join(FinPettyClaim, FinPettyClaim.id == FinPettyClaimItem.claim_id)
         .filter(FinPettyClaim.expense_type == expense_type,
                 FinPettyClaim.status != "RETURNED",
                 FinPettyClaimItem.event_date >= low,
                 FinPettyClaimItem.event_date <= high))
    if exclude_claim_id:
        q = q.filter(FinPettyClaim.id != exclude_claim_id)
    rows = q.limit(2000).all()  # ขอบเขตกันหลุด — ปกติได้ไม่กี่สิบแถว
    out = []
    for item, form_id, _cid in rows:
        if item.truck_code and str(item.truck_code) not in codes and (item.ref_no or "") not in refs:
            continue
        out.append({"event_date": item.event_date, "truck_code": item.truck_code,
                    "truck_plate": item.truck_plate, "ref_no": item.ref_no, "form_id": form_id})
    return out
```

เพิ่ม import `from datetime import timedelta` ที่หัวไฟล์

ใน `petty_routes.py` — `approve` และ `submit-accounting` เรียกด่านก่อนเปลี่ยนสถานะ:

```python
from services.finance import petty_validate as validate


def _gate(db: Session, claim, items, stage: str, attachments: dict) -> dict:
    spec = (repo.get_expense_type(db, claim.expense_type).spec) or {}
    item_dicts = [{"event_date": i.event_date, "truck_code": i.truck_code,
                   "truck_plate": i.truck_plate, "ref_no": i.ref_no, "rate": i.rate,
                   "qty": i.qty} for i in items]
    result = validate.validate_claim(
        {"amount": claim.amount, "dd_no": claim.dd_no, "expense_type": claim.expense_type},
        item_dicts, spec, stage, attachments)
    cfg = (spec.get("duplicate_check") or {}).get("soft") or {}
    prior = repo.find_prior_items(db, expense_type=claim.expense_type, keys=item_dicts,
                                  days=int(cfg.get("days", 7)), exclude_claim_id=claim.id)
    result["duplicates"] = validate.split_duplicates(item_dicts, prior, spec)
    return result
```

แล้วใน `approve_claim` ก่อนเรียก `set_status`:

```python
    gate = _gate(db, claim, repo.claim_items(db, claim.id), validate.STAGE_APPROVE,
                 payload.attachments or {})
    if gate["missing"]:
        raise HTTPException(status_code=403, detail={"error": "เอกสารไม่ครบ อนุมัติไม่ได้",
                                                     "missing": gate["missing"]})
    if gate["duplicates"]["hard"]:
        raise HTTPException(status_code=409, detail={"error": "มีรายการที่เบิกไปแล้ว",
                                                     "duplicates": gate["duplicates"]["hard"]})
    if gate["duplicates"]["soft"] and not payload.dup_override_reason:
        raise HTTPException(status_code=422, detail={"error": "มีรายการที่อาจซ้ำ ยืนยันทับได้แต่ต้องระบุเหตุผล",
                                                     "duplicates": gate["duplicates"]["soft"]})
```

`ApproveIn` / `SubmitAccIn` มีช่อง `attachments: dict[str, int]` อยู่แล้วจาก Task 3 — FE นับจำนวนไฟล์ด้วย `ListObjectsV2` ใน `lib/s3.ts` (แพตเทิร์นเดียวกับ `hasFiles`) แล้วส่งมาพร้อมคำสั่ง

เพิ่ม `GET /claims/duplicate-check` ที่รับ `event_date`, `truck_code`, `truck_plate`, `ref_no`, `expense_type` แล้วคืน `{"hard": [...], "soft": [...]}` ของแถวเดียว เพื่อให้หน้ากรอกเตือนทันทีขณะพิมพ์

- [ ] **Step 6: เขียนเทสต์ route ของด่าน**

ต่อใน `tests/finance/test_petty_transitions.py`:

```python
class TestApprovalGate:
    def test_cannot_approve_without_the_weigh_slip(self, db_session, fund):
        # เมื่อ spec บังคับไฟล์ weigh_slip แต่ attachments ว่าง → missing ต้องไม่ว่าง
        from services.finance import petty_validate as V
        spec = {"attachments": [{"key": "weigh_slip", "label": "ใบชั่งน้ำหนัก", "required": True}]}
        out = V.validate_claim({"amount": 100}, [], spec, V.STAGE_APPROVE, {})
        assert out["missing"][0]["key"] == "weigh_slip"
```

- [ ] **Step 7: `GatePanel.tsx` + BFF duplicate-check**

แผงบนหน้าอนุมัติและหน้ารายละเอียด 3 แถบ:

| สภาพ | หน้าตา |
|---|---|
| เอกสารไม่ครบ | แถบแดง หัวข้อ "เอกสารไม่ครบ อนุมัติไม่ได้" + รายการที่ขาดเป็น bullet (ระบุเลขแถว) · ปุ่มอนุมัติปิด |
| ซ้ำเข้ม | แถบแดง "บัตรชั่งใบนี้ของรถคันนี้เบิกไปแล้ว" + ลิงก์ไปใบเดิมด้วย `form_id` · ปุ่มอนุมัติปิด ไม่มีช่องทับ |
| ซ้ำอ่อน | แถบเหลือง "รถคันนี้มีรายการใน 7 วันที่ผ่านมา" + ลิงก์ใบเดิม + `<textarea>` เหตุผล · ปุ่มอนุมัติเปิดเมื่อกรอกเหตุผล |

`app/api/finance/petty/claims/duplicate-check/route.ts` — guard `requireUser` แล้ว proxy พร้อม query ที่ whitelist ไว้ 5 ตัว

- [ ] **Step 8: แจ้งเตือนเจ้าหน้าที่**

`services/finance/petty_mail.py` — ฟังก์ชัน `notify_gate_blocked(claim, missing, clerk_email)` และ `notify_returned(claim, reason, clerk_email)` ใช้ตัวส่งเดิมจาก `finance_mail.py` · เรียกแบบ `BackgroundTasks` เหมือน advance_routes · **ปิดไว้ด้วย `FINANCE_EMAIL_ENABLED` เหมือน Advance** แล้วค่อยเปิดเมื่อผู้ใช้พร้อม

- [ ] **Step 9: รันเทสต์ทั้งสองฝั่ง แล้ว commit**

```bash
cd ~/Documents/project/ncac/api-ncac && python -m pytest tests/finance -q && git pull
git add services/finance/petty_validate.py services/finance/petty_repo.py services/finance/petty_mail.py routes/finance/petty_routes.py tests/finance/test_petty_validate.py tests/finance/test_petty_transitions.py
git commit -m "feat(petty): document gate and two-tier duplicate gate"
cd ~/Documents/github/menait-service && bun test lib/finance/ && git pull
git add app/finance/components/petty/GatePanel.tsx app/api/finance/petty/claims/duplicate-check
git commit -m "feat(petty): gate panel with blocking and overridable warnings"
```

## S4 — ครบ 5 ประเภท

### Task 11: เติม spec อีก 4 ประเภท + master รถ/คนขับจาก MongoDB

> ข้อพิสูจน์ของงานนี้: เพิ่มประเภทโดย**ไม่แก้โค้ดฟอร์มเลย** ถ้าต้องแก้ แปลว่า `spec` ยังขาดอะไร — เติมที่ spec ไม่ใช่ที่ฟอร์ม

**Files:**
- Create: `api-ncac/scripts/migrations/2026-10-13_finance_petty_types.sql`
- Create: `api-ncac/services/finance/petty_master.py` (รถ/คนขับจาก Mongo)
- Modify: `api-ncac/routes/finance/petty_routes.py` (`GET /trucks` `GET /drivers`)
- Create: `menait-service/app/api/finance/petty/trucks/route.ts`
- Test: `api-ncac/tests/finance/test_petty_types_spec.py`
- Test: `api-ncac/tests/finance/test_petty_master_lookup.py`

**Interfaces:**
- Consumes: `atms.truck_master_monthly` (รถ) — อ่านอย่างเดียว
- Produces:
  - `petty_master.search_trucks(query: str, limit: int = 20) -> list[dict]` → `[{"truck_code", "truck_plate", "truck_type"}]`
  - `petty_master.truck_by_code(code: str) -> dict | None`
  - route: `GET /finance/petty/trucks?q=`

- [ ] **Step 1: เขียนเทสต์ spec ของ 4 ประเภทที่ยังไม่ผ่าน**

`tests/finance/test_petty_types_spec.py` — เทสต์ว่า spec ที่ seed ไว้ใช้งานได้จริงกับด่านเดียวกัน โดยไม่ต้องมีโค้ดใหม่:

```python
import json
import pathlib

import pytest

from services.finance import petty_validate as V

SQL = pathlib.Path("scripts/migrations/2026-10-13_finance_petty_types.sql")


def _specs() -> dict:
    """อ่าน spec ออกจากไฟล์ migration เพื่อให้เทสต์ชี้ไปที่ของจริงที่จะรันกับฐาน"""
    text = SQL.read_text(encoding="utf-8")
    out = {}
    for code in ("TOLL", "TIRE", "REPAIR", "TRAVEL"):
        marker = f"-- spec:{code}"
        body = text.split(marker)[1].split("-- /spec")[0]
        out[code] = json.loads(body.strip())
    return out


@pytest.fixture(scope="module")
def specs():
    return _specs()


class TestToll:
    def test_single_amount_not_item_based(self, specs):
        assert specs["TOLL"].get("item_based") is False

    def test_receipt_required_before_approve(self, specs):
        keys = [a["key"] for a in specs["TOLL"]["attachments"] if a.get("required")]
        assert "receipt" in keys

    def test_no_receipt_substitute_print(self, specs):
        assert "RECEIPT_SUBSTITUTE" not in specs["TOLL"].get("prints", [])


class TestTire:
    def test_item_based_with_atms_sku(self, specs):
        assert specs["TIRE"]["item_based"] is True
        assert specs["TIRE"]["atms"]["sku"] == "LB00009"

    def test_hard_duplicate_uses_receipt_and_truck(self, specs):
        assert specs["TIRE"]["duplicate_check"]["hard"]["keys"] == ["ref_no", "truck_code", "truck_plate"]


class TestRepair:
    def test_requires_a_photo_of_the_work(self, specs):
        keys = [a["key"] for a in specs["REPAIR"]["attachments"] if a.get("required")]
        assert "photo" in keys and "receipt" in keys


class TestTravel:
    def test_not_item_based_and_keyed_on_driver(self, specs):
        assert specs["TRAVEL"]["item_based"] is False
        assert specs["TRAVEL"]["duplicate_check"]["soft"]["keys"] == ["event_date", "driver"]


class TestEveryTypeWorksWithTheSameGate:
    def test_gate_runs_without_error_for_all_four(self, specs):
        claim = {"amount": 1200, "dd_no": None}
        for code, spec in specs.items():
            out = V.validate_claim(claim, [], spec, V.STAGE_APPROVE, {})
            assert isinstance(out["missing"], list), code

    def test_dd_rule_present_on_every_type_over_500(self, specs):
        for code, spec in specs.items():
            rules = [r for r in spec.get("rules", []) if r.get("require_field") == "dd_no"]
            assert rules, f"{code} ยังไม่มีกฎ DD ≥ 500"
```

- [ ] **Step 2: รันให้เห็นว่าไม่ผ่าน**

Run: `python -m pytest tests/finance/test_petty_types_spec.py -v`
Expected: FAIL — ไม่มีไฟล์ migration

- [ ] **Step 3: เขียน migration ของ 4 ประเภท**

`scripts/migrations/2026-10-13_finance_petty_types.sql` — ใส่คอมเมนต์ `-- spec:CODE` / `-- /spec` ครอบ JSON ทุกก้อน เพื่อให้เทสต์อ่านของจริงได้:

```sql
-- ประเภทการเบิกที่เหลือ 4 แบบ — แก้ต่อได้ที่หน้า master ไม่ต้องแก้โค้ด
UPDATE fin_petty_expense_types SET spec =
-- spec:TOLL
'{
  "item_based": false,
  "header_fields": [
    {"key":"event_date","label":"วันที่ใช้ทาง","type":"date","required":true},
    {"key":"truck","label":"รถ","type":"truck","required":true,"search":["code","plate"]},
    {"key":"driver","label":"พจส.","type":"employee","required":true},
    {"key":"rate","label":"จำนวนเงิน","type":"money","required":true},
    {"key":"receipt_no","label":"เลขที่ใบเสร็จ","type":"text","required":false}
  ],
  "attachments": [
    {"key":"receipt","label":"ใบเสร็จค่าทางด่วน","required":true,"max":10},
    {"key":"transfer","label":"หลักฐานโอนเงิน","required":true,"max":3}
  ],
  "rules": [
    {"when":"total >= 500","require_field":"dd_no","at":"BEFORE_SUBMIT_TO_ACCOUNTING"},
    {"when":"always","require_attachment":"receipt","at":"BEFORE_APPROVE"}
  ],
  "duplicate_check": {
    "scope":"item",
    "hard":{"keys":["ref_no","truck_code","truck_plate"],"days":365,"action":"block","override":false},
    "soft":{"keys":["event_date","truck"],"days":7,"action":"warn","override":"reason"}
  },
  "prints": ["PETTY_VOUCHER","DD"]
}'
-- /spec
::jsonb WHERE code = 'TOLL';

UPDATE fin_petty_expense_types SET spec =
-- spec:TIRE
'{
  "item_based": true,
  "item_label": "รายการปะ/เปลี่ยนยาง",
  "item_fields": [
    {"key":"event_date","label":"วันที่","type":"date","required":true},
    {"key":"truck","label":"รถ","type":"truck","required":true,"search":["code","plate"]},
    {"key":"ref_no","label":"เลขที่ใบเสร็จ/บิล","type":"text","required":true},
    {"key":"remark","label":"รายการที่ทำ","type":"text","required":true},
    {"key":"rate","label":"จำนวนเงิน","type":"money","required":true}
  ],
  "attachments": [
    {"key":"receipt","label":"ใบเสร็จ/บิลเงินสด","required":true,"max":10},
    {"key":"photo","label":"รูปยางที่เปลี่ยน","required":false,"max":10},
    {"key":"transfer","label":"หลักฐานโอนเงิน","required":true,"max":3}
  ],
  "rules": [
    {"when":"total >= 500","require_field":"dd_no","at":"BEFORE_SUBMIT_TO_ACCOUNTING"},
    {"when":"always","require_attachment":"receipt","at":"BEFORE_APPROVE"}
  ],
  "duplicate_check": {
    "scope":"item",
    "hard":{"keys":["ref_no","truck_code","truck_plate"],"days":365,"action":"block","override":false},
    "soft":{"keys":["event_date","truck"],"days":7,"action":"warn","override":"reason"}
  },
  "prints": ["PETTY_VOUCHER","DD"],
  "atms": {"sku":"LB00009","product_group":"ค่าแรง","unit":"งาน","vat":0}
}'
-- /spec
::jsonb WHERE code = 'TIRE';

UPDATE fin_petty_expense_types SET spec =
-- spec:REPAIR
'{
  "item_based": true,
  "item_label": "รายการซ่อม",
  "item_fields": [
    {"key":"event_date","label":"วันที่ซ่อม","type":"date","required":true},
    {"key":"truck","label":"รถ","type":"truck","required":true,"search":["code","plate"]},
    {"key":"ref_no","label":"เลขที่ใบเสร็จ/ใบแจ้งซ่อม","type":"text","required":true},
    {"key":"remark","label":"อาการ/งานที่ทำ","type":"text","required":true},
    {"key":"rate","label":"จำนวนเงิน","type":"money","required":true}
  ],
  "attachments": [
    {"key":"receipt","label":"ใบเสร็จ/บิลเงินสด","required":true,"max":10},
    {"key":"photo","label":"รูปหน้างาน","required":true,"max":10},
    {"key":"transfer","label":"หลักฐานโอนเงิน","required":true,"max":3}
  ],
  "rules": [
    {"when":"total >= 500","require_field":"dd_no","at":"BEFORE_SUBMIT_TO_ACCOUNTING"},
    {"when":"always","require_attachment":"receipt","at":"BEFORE_APPROVE"},
    {"when":"always","require_attachment":"photo","at":"BEFORE_APPROVE"}
  ],
  "duplicate_check": {
    "scope":"item",
    "hard":{"keys":["ref_no","truck_code","truck_plate"],"days":365,"action":"block","override":false},
    "soft":{"keys":["event_date","truck"],"days":7,"action":"warn","override":"reason"}
  },
  "prints": ["PETTY_VOUCHER","DD"]
}'
-- /spec
::jsonb WHERE code = 'REPAIR';

UPDATE fin_petty_expense_types SET spec =
-- spec:TRAVEL
'{
  "item_based": false,
  "header_fields": [
    {"key":"event_date","label":"วันที่เดินทาง","type":"date","required":true},
    {"key":"driver","label":"พจส.","type":"employee","required":true},
    {"key":"remark","label":"เส้นทาง/เหตุผล","type":"text","required":true},
    {"key":"rate","label":"จำนวนเงิน","type":"money","required":true}
  ],
  "attachments": [
    {"key":"receipt","label":"ใบเสร็จ (ถ้ามี)","required":false,"max":10},
    {"key":"transfer","label":"หลักฐานโอนเงิน","required":true,"max":3}
  ],
  "rules": [
    {"when":"total >= 500","require_field":"dd_no","at":"BEFORE_SUBMIT_TO_ACCOUNTING"},
    {"when":"always","require_attachment":"transfer","at":"BEFORE_APPROVE"}
  ],
  "duplicate_check": {
    "scope":"item",
    "hard":{"keys":["ref_no","truck_code","truck_plate"],"days":365,"action":"block","override":false},
    "soft":{"keys":["event_date","driver"],"days":7,"action":"warn","override":"reason"}
  },
  "prints": ["PETTY_VOUCHER","RECEIPT_SUBSTITUTE","DD"]
}'
-- /spec
::jsonb WHERE code = 'TRAVEL';
```

- [ ] **Step 4: รันเทสต์ให้ผ่าน**

Run: `python -m pytest tests/finance/test_petty_types_spec.py -v`
Expected: PASS

- [ ] **Step 5: รองรับ `item_based: false` ในฟอร์ม**

ประเภทยอดเดียวยังใช้ตารางลูกเหมือนกัน — FE สร้างรายการลูก 1 แถวจากช่องหัวใบ แล้วส่ง `items` ความยาว 1 เพิ่มใน `lib/finance/petty-spec.ts`:

```ts
/** ประเภทยอดเดียว: หัวใบกลายเป็นรายการลูกหนึ่งแถว ตารางเดียวจึงรองรับทั้งสองแบบ */
export function singleItemFrom(form: Record<string, unknown>): PettyItemDraft {
  return {
    event_date: String(form.event_date ?? ''),
    truck_code: (form.truck_code as string) ?? null,
    truck_plate: (form.truck_plate as string) ?? null,
    ref_no: (form.receipt_no as string) ?? null,
    qty: 1,
    rate: form.rate as number,
    remark: (form.remark as string) ?? null,
  };
}
```

และเทสต์คู่ใน `petty-spec.test.ts`:

```ts
describe('singleItemFrom', () => {
  test('toll claim becomes one row', () => {
    const row = singleItemFrom({ event_date: '2026-09-25', truck_code: '161', rate: 120, receipt_no: 'A1' });
    expect(row).toMatchObject({ event_date: '2026-09-25', qty: 1, rate: 120, ref_no: 'A1' });
  });
  test('missing optional fields become null, not the string "undefined"', () => {
    expect(singleItemFrom({ event_date: '2026-09-25', rate: 100 }).truck_code).toBeNull();
  });
});
```

- [ ] **Step 6: master รถจาก MongoDB**

`services/finance/petty_master.py` — **ไคลเอนต์ Mongo ตัวแรกในกระบวนการ API** จึงต้องระวังเป็นพิเศษ:

```python
"""master รถ/คนขับจาก MongoDB (อ่านอย่างเดียว)

api-ncac ยังไม่เคยต่อ Mongo ในชั้น route มาก่อน (เดิมมีแต่ใน scripts/) — ที่นี่จึงสร้าง client
ครั้งเดียวแบบ lazy พร้อม timeout สั้น และทุก query มี filter + limit + maxTimeMS
cluster เล็ก (cache ~370MB) ห้ามสแกนทั้ง collection
"""
from __future__ import annotations

import os
from functools import lru_cache
from typing import Optional

_TIMEOUT_MS = 3000
_MAX_TIME_MS = 2000


@lru_cache(maxsize=1)
def _db():
    from pymongo import MongoClient
    uri = os.getenv("MONGODB_URI")
    if not uri:
        raise RuntimeError("ไม่ได้ตั้งค่า MONGODB_URI")
    return MongoClient(uri, serverSelectionTimeoutMS=_TIMEOUT_MS,
                       connectTimeoutMS=_TIMEOUT_MS, socketTimeoutMS=_TIMEOUT_MS)["atms"]


def search_trucks(query: str, limit: int = 20) -> list[dict]:
    """ค้นได้ทั้งรหัสรถภายใน (161, F014) และทะเบียน (71-4285) ตามที่ใบจริงเขียนสองแบบ"""
    q = (query or "").strip()
    if len(q) < 2:
        return []
    pattern = {"$regex": q, "$options": "i"}
    rows = (_db()["truck_master_monthly"]
            .find({"$or": [{"เลขรถ": pattern}, {"ทะเบียน": pattern}]},
                  {"_id": 0, "เลขรถ": 1, "ทะเบียน": 1, "ประเภทรถ": 1})
            .limit(limit)
            .max_time_ms(_MAX_TIME_MS))
    seen, out = set(), []
    for row in rows:
        code = str(row.get("เลขรถ") or "").strip()
        if not code or code in seen:
            continue
        seen.add(code)
        out.append({"truck_code": code, "truck_plate": str(row.get("ทะเบียน") or "").strip(),
                    "truck_type": str(row.get("ประเภทรถ") or "").strip()})
    return out


def truck_by_code(code: str) -> Optional[dict]:
    found = search_trucks(code, limit=5)
    return next((t for t in found if t["truck_code"] == code), None)
```

`tests/finance/test_petty_master_lookup.py` — เทสต์โดย monkeypatch `_db` ไม่ต่อ Mongo จริง:

```python
from services.finance import petty_master


class _FakeCursor(list):
    def limit(self, _n): return self
    def max_time_ms(self, _n): return self


class _FakeColl:
    def __init__(self, rows): self.rows, self.last_filter = rows, None
    def find(self, flt, _proj):
        self.last_filter = flt
        return _FakeCursor(self.rows)


def _patch(monkeypatch, rows):
    coll = _FakeColl(rows)
    monkeypatch.setattr(petty_master, "_db", lambda: {"truck_master_monthly": coll})
    return coll


def test_finds_by_internal_code(monkeypatch):
    _patch(monkeypatch, [{"เลขรถ": "161", "ทะเบียน": "71-4285", "ประเภทรถ": "โม่ใหญ่"}])
    assert petty_master.search_trucks("161")[0]["truck_plate"] == "71-4285"


def test_query_always_has_a_filter(monkeypatch):
    coll = _patch(monkeypatch, [])
    petty_master.search_trucks("161")
    assert "$or" in coll.last_filter  # ห้ามยิง find({}) กับ cluster นี้


def test_short_query_does_not_hit_mongo(monkeypatch):
    called = {"n": 0}

    def _boom():
        called["n"] += 1
        raise AssertionError("ไม่ควรเรียก Mongo")

    monkeypatch.setattr(petty_master, "_db", _boom)
    assert petty_master.search_trucks("1") == []
    assert called["n"] == 0


def test_duplicate_months_collapse_to_one_truck(monkeypatch):
    _patch(monkeypatch, [{"เลขรถ": "161", "ทะเบียน": "71-4285"},
                         {"เลขรถ": "161", "ทะเบียน": "71-4285"}])
    assert len(petty_master.search_trucks("161")) == 1
```

เพิ่ม route:

```python
@router.get("/trucks")
def search_trucks(q: str = Query(default="", min_length=0), limit: int = Query(default=20, le=50)):
    from services.finance import petty_master
    try:
        return petty_master.search_trucks(q, limit=limit)
    except Exception as exc:  # Mongo ล่มไม่ควรทำให้ฟอร์มใช้ไม่ได้
        logger.warning("truck master lookup failed: %s", exc)
        return []
```

และ BFF `app/api/finance/petty/trucks/route.ts` (guard `requireUser` → proxy `q`, `limit`)

- [ ] **Step 7: เปิด "รถต้องมาจาก master" ใน ItemGrid**

ช่อง `type: 'truck'` เปลี่ยนเป็น combobox ที่ค้นจาก `/api/finance/petty/trucks` · เลือกแล้วเติม `truck_code` `truck_plate` `truck_type` พร้อมกัน · **พิมพ์เองไม่ได้** ตามที่ตกลงข้อ 1 — ถ้าหาไม่เจอให้ขึ้นข้อความ "ไม่พบรถคันนี้ใน master ให้เพิ่มใน master ก่อน" เพราะด่านซ้ำเข้มต้องมีทะเบียนที่เชื่อถือได้

- [ ] **Step 8: รันทั้งหมด แล้ว commit**

```bash
python -m pytest tests/finance -q && git pull
git add scripts/migrations/2026-10-13_finance_petty_types.sql services/finance/petty_master.py routes/finance/petty_routes.py tests/finance/test_petty_types_spec.py tests/finance/test_petty_master_lookup.py
git commit -m "feat(petty): four more expense types from master, truck lookup from ATMS"
```

## S5 — เอกสาร

### Task 12: พิมพ์ใบสำคัญจ่าย + ใบรับรองแทนใบเสร็จ

**Files:**
- Create: `menait-service/lib/finance/petty-print.ts` + `petty-print.test.ts`
- Create: `menait-service/app/finance/components/petty/PettyVoucherSheet.tsx`
- Create: `menait-service/app/finance/components/petty/ReceiptSubstituteSheet.tsx`
- Create: `menait-service/app/finance/petty/[form_id]/print/page.tsx`

**Interfaces:**
- Consumes: `lib/finance/bahtText.ts` (ของเดิม) · `lib/finance/printShared.ts` (ของเดิม) · `types-petty.ts`
- Produces:
  - `groupForPrint(items): PrintGroup[]` โดย `PrintGroup = { label: string; count: number; rate: number; total: number; truckCodes: string[] }`
  - `paginateGroups(groups, perPage = 6): PrintGroup[][]`
  - `voucherLabel(rate, truckType, typeName): string`

- [ ] **Step 1: เขียนเทสต์ที่ยังไม่ผ่าน**

`lib/finance/petty-print.test.ts` — ยึดใบจริง 1,640 บาทเป็นเกณฑ์:

```ts
import { describe, expect, test } from 'bun:test';
import { groupForPrint, paginateGroups, voucherLabel } from './petty-print';

const REAL = [
  ...Array(8).fill(null).map((_, i) => ({
    event_date: '2026-09-17', truck_code: ['161', '144', 'F014', 'F016', '113', '118', '145', '340'][i],
    truck_type: 'โม่ใหญ่', rate: 100, qty: 1, amount: 100,
  })),
  ...['1126', '1145', '1093', '1093'].map(code => ({
    event_date: '2026-09-20', truck_code: code, truck_type: 'โม่เล็ก', rate: 100, qty: 1, amount: 100,
  })),
  ...['153', '146', '151'].map(code => ({
    event_date: '2026-09-22', truck_code: code, truck_type: 'โม่ใหญ่', rate: 120, qty: 1, amount: 120,
  })),
  { event_date: '2026-09-24', truck_code: '165', truck_type: 'โม่เล็ก', rate: 80, qty: 1, amount: 80 },
];

describe('groupForPrint — ตามที่คนเขียนมือจัดอยู่แล้ว', () => {
  const groups = groupForPrint(REAL, 'ค่าชั่งน้ำหนัก');

  test('groups by rate and truck type', () => expect(groups).toHaveLength(4));
  test('big mixers at 100 baht come to twelve... no, eight', () => {
    const g = groups.find(x => x.rate === 100 && x.label.includes('โม่ใหญ่'))!;
    expect(g.count).toBe(8);
    expect(g.total).toBe(800);
  });
  test('small mixers at 100 baht are their own line', () => {
    const g = groups.find(x => x.rate === 100 && x.label.includes('โม่เล็ก'))!;
    expect(g.count).toBe(4);
  });
  test('grand total matches the real voucher', () =>
    expect(groups.reduce((s, g) => s + g.total, 0)).toBe(1640));
  test('truck codes travel into the remark column', () => {
    const g = groups.find(x => x.rate === 80)!;
    expect(g.truckCodes).toEqual(['165']);
  });
  test('the duplicate 1093 is listed twice, as the paper does', () => {
    const g = groups.find(x => x.rate === 100 && x.label.includes('โม่เล็ก'))!;
    expect(g.truckCodes.filter(c => c === '1093')).toHaveLength(2);
  });
  test('empty input gives no groups, not a crash', () => expect(groupForPrint([], 'x')).toEqual([]));
});

describe('voucherLabel', () => {
  test('includes the type name, truck type and rate', () =>
    expect(voucherLabel(100, 'โม่ใหญ่', 'ค่าชั่งน้ำหนัก')).toBe('ค่าชั่งน้ำหนักรถโม่ใหญ่ 100 บาท'));
  test('no truck type still reads properly', () =>
    expect(voucherLabel(120, null, 'ค่าชั่งน้ำหนัก')).toBe('ค่าชั่งน้ำหนัก 120 บาท'));
});

describe('paginateGroups', () => {
  test('six lines fit one page', () =>
    expect(paginateGroups(Array(6).fill({ label: 'x', count: 1, rate: 1, total: 1, truckCodes: [] })))
      .toHaveLength(1));
  test('seven lines spill to a second page', () =>
    expect(paginateGroups(Array(7).fill({ label: 'x', count: 1, rate: 1, total: 1, truckCodes: [] })))
      .toHaveLength(2));
  test('the real voucher is a single page', () => expect(paginateGroups(groupForPrint(REAL, 'ค่าชั่งน้ำหนัก'))).toHaveLength(1));
});
```

- [ ] **Step 2: รันให้เห็นว่าไม่ผ่าน**

Run: `bun test lib/finance/petty-print.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: เขียน `petty-print.ts`**

```ts
import { round2 } from '@/lib/finance/status';
import type { PettyClaimItem } from '@/app/finance/types-petty';

export type PrintGroup = {
  label: string; count: number; rate: number; total: number; truckCodes: string[];
};

/** "ค่าชั่งน้ำหนักรถโม่ใหญ่ 100 บาท" — ถ้อยคำเดียวกับที่เขียนในใบจริง */
export function voucherLabel(rate: number, truckType: string | null | undefined, typeName: string): string {
  return truckType ? `${typeName}รถ${truckType} ${rate} บาท` : `${typeName} ${rate} บาท`;
}

/** จัดกลุ่มตามราคา + ประเภทรถ แล้วรหัสรถไปอยู่ในหมายเหตุ — เหมือนที่คนทำมือทำอยู่ */
export function groupForPrint(
  items: readonly Partial<PettyClaimItem>[],
  typeName: string,
): PrintGroup[] {
  const buckets = new Map<string, PrintGroup>();
  for (const item of items) {
    const rate = Number(item.rate ?? 0);
    const truckType = item.truck_type ?? null;
    const token = `${rate}|${truckType ?? ''}`;
    let group = buckets.get(token);
    if (!group) {
      group = { label: voucherLabel(rate, truckType, typeName), count: 0, rate, total: 0, truckCodes: [] };
      buckets.set(token, group);
    }
    group.count += 1;
    group.total = round2(group.total + Number(item.amount ?? rate * Number(item.qty ?? 1)));
    if (item.truck_code) group.truckCodes.push(item.truck_code);
  }
  // เรียงราคามากไปน้อย แล้วให้โม่ใหญ่มาก่อนโม่เล็ก ตามลำดับที่ใบจริงเขียน
  return [...buckets.values()].sort((a, b) => b.count - a.count || b.rate - a.rate);
}

/** ตารางบนกระดาษมี 6 บรรทัด เกินนั้นขึ้นแผ่นใหม่ */
export function paginateGroups(groups: readonly PrintGroup[], perPage = 6): PrintGroup[][] {
  if (groups.length === 0) return [];
  const pages: PrintGroup[][] = [];
  for (let i = 0; i < groups.length; i += perPage) pages.push(groups.slice(i, i + perPage));
  return pages;
}
```

- [ ] **Step 4: รันเทสต์ให้ผ่าน**

Run: `bun test lib/finance/petty-print.test.ts`
Expected: PASS ทั้ง 12 เทสต์

- [ ] **Step 5: `PettyVoucherSheet.tsx`**

พิมพ์ด้วย `@media print` แบบเดียวกับ `PrintDialog.tsx`/`printShared.ts` ที่มีอยู่ · วางช่องตามใบจริง: หัวบริษัท · **เลขที่ = `form_id`** (ไม่มีช่องเล่มที่) · จ่ายให้ · วันที่ (วันอนุมัติ) · Project Code (ว่าง) · ติ๊ก Division จาก `fund.division_code` · เลือกสาขาจาก `fund.branch_code` · ตาราง 6 บรรทัดจาก `paginateGroups` คอลัมน์ (รายการ / จำนวน / จำนวนเงิน / หมายเหตุ=รหัสรถ) · ยอดรวม + ตัวอักษรจาก `bahtText` · 4 ช่องเซ็น โดยช่องผู้อนุมัติประทับ e-Signature จาก `approved_by` + `approved_at` · ท้ายกระดาษ "แผ่นที่ n/m" เมื่อมีหลายแผ่น

- [ ] **Step 6: `ReceiptSubstituteSheet.tsx`**

หัวบริษัท + `(สาขา 000xx)` จาก `branch_code` · ตารางกลุ่มเดียวกัน คอลัมน์วันที่ใช้ `period_to` · รวมทั้งสิ้น + ตัวอักษร · ประโยค "ข้าพเจ้า `payee_name` ตำแหน่ง `<ตำแหน่งจาก master พนักงาน>`" · "ตั้งแต่วันที่ `period_from` ถึงวันที่ `period_to`" · ลงชื่อผู้เบิกจ่าย/ผู้อนุมัติ

ตำแหน่งดึงจาก `/api/finance/people/{employee_id}` ที่มีอยู่แล้ว และ **แก้ทับได้** ก่อนพิมพ์ (ข้อ 4 ที่ตกลงไว้)

- [ ] **Step 7: หน้า print**

`app/finance/petty/[form_id]/print/page.tsx` — เลือกเอกสารที่จะพิมพ์จาก `spec.prints` ของประเภทนั้น (`PETTY_VOUCHER` / `RECEIPT_SUBSTITUTE` / `DD`) · ประเภทที่ไม่มี `RECEIPT_SUBSTITUTE` ต้องไม่โชว์ปุ่มนั้น

- [ ] **Step 8: เทียบกับใบจริง แล้ว commit**

พิมพ์ใบตัวอย่าง 1,640 บาท ออก PDF แล้ววางเทียบกับ `Reference_data/เงินสดย่อย/ตัวอย่างค่าชั่งน้ำหนัก.pdf` หน้า 1–2 ทีละช่อง

```bash
git pull && git add lib/finance/petty-print.ts lib/finance/petty-print.test.ts app/finance/components/petty app/finance/petty
git commit -m "feat(petty): printable voucher and receipt-substitute grouped by rate"
```

### Task 13: DD จาก MongoDB

**Files:**
- Create: `api-ncac/services/finance/petty_atms.py`
- Modify: `api-ncac/routes/finance/petty_routes.py` (`GET /dd/{dd_no}` · เก็บ snapshot ตอนส่งบัญชี)
- Create: `menait-service/app/api/finance/petty/dd/[dd_no]/route.ts`
- Create: `menait-service/app/finance/components/petty/DdSheet.tsx`
- Test: `api-ncac/tests/finance/test_petty_atms.py`

**Interfaces:**
- Consumes: `atms.stockmovement_v5` (อ่านอย่างเดียว) — ฟิลด์ `DD` `วันที่` `คลังสินค้า` `ซัพพลายเออร์` `รหัสสินค้า` `ชื่อสินค้า` `กลุ่มสินค้า` `รับ` `ราคาทุน` `ยอดเงิน` `เลขรถ` `ทะเบียน` `พจส.` `หมายเหตุ` `หมายเหตุย่อย` `PR` `PO`
- Produces:
  - `petty_atms.fetch_dd(dd_no: str) -> dict` → `{"found": bool, "dd_no": str, "lines": [...], "total": Decimal, "error": str | None}`
  - `petty_atms.compare_total(dd: dict, claim_amount) -> dict` → `{"match": bool, "difference": Decimal}`
  - route: `GET /finance/petty/dd/{dd_no}`

- [ ] **Step 1: เขียนเทสต์ที่ยังไม่ผ่าน**

`tests/finance/test_petty_atms.py` — ไม่ต่อ Mongo จริง:

```python
from decimal import Decimal

import pytest

from services.finance import petty_atms


class _FakeCursor(list):
    def max_time_ms(self, _n): return self
    def limit(self, _n): return self


class _FakeColl:
    def __init__(self, rows, raises=None):
        self.rows, self.raises, self.last_filter = rows, raises, None

    def find(self, flt, _proj=None):
        self.last_filter = flt
        if self.raises:
            raise self.raises
        return _FakeCursor(self.rows)


ROWS = [
    {"DD": "LBDD26090931", "วันที่": "25/09/2026", "คลังสินค้า": "ลาดกระบัง",
     "ซัพพลายเออร์": "ลานชั่งภายนอก", "รหัสสินค้า": "LB00038", "ชื่อสินค้า": "ค่าชั่งน้ำหนัก",
     "กลุ่มสินค้า": "ค่าแรง", "รับ": 12, "ราคาทุน": 100, "ยอดเงิน": 1200,
     "เลขรถ": "161", "ทะเบียน": "71-4285", "พจส.": "อัญชัญ น่วมมี", "PR": "", "PO": ""},
    {"DD": "LBDD26090931", "วันที่": "25/09/2026", "รหัสสินค้า": "LB00038",
     "ชื่อสินค้า": "ค่าชั่งน้ำหนัก", "กลุ่มสินค้า": "ค่าแรง", "รับ": 3, "ราคาทุน": 120, "ยอดเงิน": 360},
    {"DD": "LBDD26090931", "วันที่": "25/09/2026", "รหัสสินค้า": "LB00038",
     "ชื่อสินค้า": "ค่าชั่งน้ำหนัก", "กลุ่มสินค้า": "ค่าแรง", "รับ": 1, "ราคาทุน": 80, "ยอดเงิน": 80},
]


def _patch(monkeypatch, rows, raises=None):
    coll = _FakeColl(rows, raises)
    monkeypatch.setattr(petty_atms, "_collection", lambda: coll)
    return coll


class TestFetch:
    def test_reads_every_line_of_the_document(self, monkeypatch):
        _patch(monkeypatch, ROWS)
        out = petty_atms.fetch_dd("LBDD26090931")
        assert out["found"] is True and len(out["lines"]) == 3

    def test_total_matches_the_real_voucher(self, monkeypatch):
        _patch(monkeypatch, ROWS)
        assert petty_atms.fetch_dd("LBDD26090931")["total"] == Decimal("1640.00")

    def test_query_is_keyed_on_the_dd_number(self, monkeypatch):
        coll = _patch(monkeypatch, ROWS)
        petty_atms.fetch_dd("LBDD26090931")
        assert coll.last_filter == {"DD": "LBDD26090931"}

    def test_not_found_is_reported_not_raised(self, monkeypatch):
        _patch(monkeypatch, [])
        out = petty_atms.fetch_dd("LBDD99999999")
        assert out["found"] is False and out["error"] is None

    def test_blank_number_never_touches_mongo(self, monkeypatch):
        def _boom():
            raise AssertionError("ไม่ควรเรียก Mongo")
        monkeypatch.setattr(petty_atms, "_collection", _boom)
        assert petty_atms.fetch_dd("")["found"] is False

    def test_mongo_failure_degrades_instead_of_breaking_the_page(self, monkeypatch):
        # Review Focus 5
        _patch(monkeypatch, [], raises=TimeoutError("server selection timeout"))
        out = petty_atms.fetch_dd("LBDD26090931")
        assert out["found"] is False and "ดึงข้อมูล" in out["error"]

    def test_unit_and_vat_come_from_the_type_spec_not_mongo(self, monkeypatch):
        _patch(monkeypatch, ROWS)
        out = petty_atms.fetch_dd("LBDD26090931", atms_spec={"unit": "งาน", "vat": 0})
        assert out["lines"][0]["unit"] == "งาน" and out["vat"] == 0


class TestCompare:
    def test_equal_totals_match(self):
        dd = {"total": Decimal("1640.00")}
        assert petty_atms.compare_total(dd, Decimal("1640.00")) == {"match": True,
                                                                   "difference": Decimal("0.00")}

    def test_difference_is_reported_with_a_sign(self):
        dd = {"total": Decimal("1540.00")}
        out = petty_atms.compare_total(dd, Decimal("1640.00"))
        assert out["match"] is False and out["difference"] == Decimal("100.00")

    def test_missing_dd_never_claims_a_match(self):
        assert petty_atms.compare_total({"found": False, "total": Decimal("0")},
                                        Decimal("1640.00"))["match"] is False
```

- [ ] **Step 2: รันให้เห็นว่าไม่ผ่าน**

Run: `python -m pytest tests/finance/test_petty_atms.py -v`
Expected: FAIL — `No module named 'services.finance.petty_atms'`

- [ ] **Step 3: เขียน `petty_atms.py`**

```python
"""อ่านใบรับสินค้า (DD) จาก atms.stockmovement_v5 มาจัดเป็นฟอร์มให้พิมพ์

อ่านอย่างเดียว — DD เป็นของ ATMS ค่าในนั้นคือค่าจริง ระบบนี้ไม่เขียนอะไรกลับ
v5 sync ทุก 4 ชม. ใบที่เพิ่งเปิดใน ATMS จึงยังไม่มี → "ไม่พบ" ไม่ใช่ error และไม่บล็อกใบ
"""
from __future__ import annotations

import logging
import os
from decimal import Decimal
from functools import lru_cache
from typing import Optional

logger = logging.getLogger(__name__)

_TIMEOUT_MS = 3000
_MAX_TIME_MS = 2500
_MAX_LINES = 500
_CENT = Decimal("0.01")

PROJECTION = {
    "_id": 0, "DD": 1, "วันที่": 1, "คลังสินค้า": 1, "ซัพพลายเออร์": 1, "รหัสสินค้า": 1,
    "ชื่อสินค้า": 1, "กลุ่มสินค้า": 1, "รับ": 1, "ราคาทุน": 1, "ยอดเงิน": 1,
    "เลขรถ": 1, "ทะเบียน": 1, "พจส.": 1, "หมายเหตุ": 1, "หมายเหตุย่อย": 1, "PR": 1, "PO": 1,
}


@lru_cache(maxsize=1)
def _collection():
    from pymongo import MongoClient
    uri = os.getenv("MONGODB_URI")
    if not uri:
        raise RuntimeError("ไม่ได้ตั้งค่า MONGODB_URI")
    client = MongoClient(uri, serverSelectionTimeoutMS=_TIMEOUT_MS,
                         connectTimeoutMS=_TIMEOUT_MS, socketTimeoutMS=_TIMEOUT_MS)
    return client["atms"]["stockmovement_v5"]


def _money(value) -> Decimal:
    try:
        return Decimal(str(value or 0)).quantize(_CENT)
    except Exception:
        return Decimal("0.00")


def fetch_dd(dd_no: str, atms_spec: Optional[dict] = None) -> dict:
    """คืนรูปทรงเดียวกันเสมอ ไม่ว่าจะเจอ ไม่เจอ หรือ Mongo ล่ม — หน้าจอจึงไม่ต้องเดา"""
    spec = atms_spec or {}
    empty = {"found": False, "dd_no": dd_no, "lines": [], "total": Decimal("0.00"),
             "unit": spec.get("unit"), "vat": spec.get("vat"), "error": None}
    number = (dd_no or "").strip()
    if not number:
        return empty
    try:
        rows = list(_collection().find({"DD": number}, PROJECTION).limit(_MAX_LINES)
                    .max_time_ms(_MAX_TIME_MS))
    except Exception as exc:
        logger.warning("DD lookup failed for %s: %s", number, exc)
        return {**empty, "error": "ดึงข้อมูล DD จาก ATMS ไม่ได้ ลองใหม่อีกครั้ง"}
    if not rows:
        return empty

    lines, total = [], Decimal("0.00")
    for row in rows:
        amount = _money(row.get("ยอดเงิน"))
        total += amount
        lines.append({
            "sku": row.get("รหัสสินค้า"), "name": row.get("ชื่อสินค้า"),
            "product_group": row.get("กลุ่มสินค้า"), "qty": _money(row.get("รับ")),
            "unit": spec.get("unit"), "rate": _money(row.get("ราคาทุน")), "amount": amount,
            "truck_code": row.get("เลขรถ"), "truck_plate": row.get("ทะเบียน"),
            "driver": row.get("พจส."), "remark": row.get("หมายเหตุ"),
            "sub_remark": row.get("หมายเหตุย่อย"), "pr": row.get("PR"), "po": row.get("PO"),
        })
    first = rows[0]
    return {
        "found": True, "dd_no": number, "received_date": first.get("วันที่"),
        "warehouse": first.get("คลังสินค้า"), "supplier": first.get("ซัพพลายเออร์"),
        "lines": lines, "total": total.quantize(_CENT),
        "unit": spec.get("unit"), "vat": spec.get("vat"), "error": None,
    }


def compare_total(dd: dict, claim_amount) -> dict:
    """ยอดใน DD ต้องเท่ายอดใบเบิก — ไม่เท่าไม่บล็อก แต่ต้องเตือนให้คนเห็นส่วนต่าง"""
    if not dd.get("found"):
        return {"match": False, "difference": _money(claim_amount)}
    difference = (_money(claim_amount) - _money(dd.get("total"))).copy_abs()
    return {"match": difference == Decimal("0.00"), "difference": difference}
```

- [ ] **Step 4: รันเทสต์ให้ผ่าน**

Run: `python -m pytest tests/finance/test_petty_atms.py -v`
Expected: PASS ทั้ง 10 เทสต์

- [ ] **Step 5: route + snapshot**

```python
@router.get("/dd/{dd_no}")
def get_dd(dd_no: str, expense_type: Optional[str] = None, claim_amount: Optional[float] = None,
           db: Session = Depends(get_db)):
    from services.finance import petty_atms
    spec = {}
    if expense_type:
        row = repo.get_expense_type(db, expense_type)
        spec = ((row.spec if row else {}) or {}).get("atms", {})
    dd = petty_atms.fetch_dd(dd_no, atms_spec=spec)
    body = {k: (float(v) if isinstance(v, Decimal) else v) for k, v in dd.items() if k != "lines"}
    body["lines"] = [{k: (float(v) if isinstance(v, Decimal) else v) for k, v in line.items()}
                     for line in dd["lines"]]
    if claim_amount is not None:
        cmp = petty_atms.compare_total(dd, Decimal(str(claim_amount)))
        body["total_match"] = cmp["match"]
        body["total_difference"] = float(cmp["difference"])
    return body
```

ใน `submit_to_accounting` หลังเปลี่ยนสถานะสำเร็จ: ถ้ามี `dd_no` ให้ `fetch_dd` แล้วเก็บลง `claim.dd_snapshot` พร้อม `fetched_at` — **ล้มเหลวไม่ทำให้การส่งบัญชีล้ม** ครอบด้วย try/except และ log ไว้

- [ ] **Step 6: BFF + `DdSheet.tsx`**

`app/api/finance/petty/dd/[dd_no]/route.ts` — guard `requireUser` · ตรวจ `dd_no` ด้วย `/^[A-Z]{2}DD\d{8}$/` ก่อนส่งต่อ (กันยิงอะไรก็ได้เข้า Mongo)

`DdSheet.tsx` — ตารางตามฟอร์ม FC101-06 · ถ้า `found: false` โชว์ "ยังไม่พบใน ATMS อาจรอ sync" · ถ้า `total_match: false` โชว์แถบเหลือง "ยอดใน DD ต่างจากใบเบิก x บาท" · ปุ่ม "ดึงใหม่"

- [ ] **Step 7: ยืนยันของจริง — ต้องถามก่อน**

เขียนสคริปต์ครั้งเดียวที่ query `{"DD": "LBDD26090931"}` บน Mongo เพื่อยืนยันว่า DD ของค่าแรงอยู่ใน `stockmovement_v5` จริง และสร้าง index `{DD: 1}` ถ้ายังไม่มี

> **หยุดถามผู้ใช้ก่อนรันทั้งสองอย่าง** · ถ้า DD ค่าแรงไม่อยู่ใน v5 ทางสำรองคือดึงจาก ATMS ตรงด้วย `code=<รหัสสินค้า>` แบบที่ `scripts/atms_stockmovement/` ทำอยู่ — บันทึกผลลงสเปกก่อนเขียนทางสำรอง

- [ ] **Step 8: commit**

```bash
python -m pytest tests/finance -q && git pull
git add services/finance/petty_atms.py routes/finance/petty_routes.py tests/finance/test_petty_atms.py
git commit -m "feat(petty): read DD lines from ATMS stock movement, snapshot on submit"
```

### Task 14: ใบปะหน้า + Excel

**Files:**
- Create: `menait-service/lib/finance/petty-cover.ts` + `petty-cover.test.ts`
- Create: `menait-service/app/finance/components/petty/CoverSheet.tsx`
- Create: `menait-service/app/api/finance/petty/claims/export/route.ts`
- Modify: `api-ncac/routes/finance/petty_routes.py` (`GET /claims/export`)

**Interfaces:**
- Consumes: `lib/finance/export.ts` (ของเดิมเป็นแบบ)
- Produces: `groupByClerk(claims): { clerk: string; claims: PettyClaim[]; total: number }[]` · `coverRows(group)`

- [ ] **Step 1: เขียนเทสต์ที่ยังไม่ผ่าน**

```ts
import { describe, expect, test } from 'bun:test';
import { coverRows, groupByClerk } from './petty-cover';

const CLAIMS = [
  { form_id: '03-B02-2610-001', created_by: '55555', amount: 1640, expense_type: 'WEIGH',
    payee_name: 'อัญชัญ น่วมมี', dd_no: 'LBDD26090931', status: 'AWAITING_REVIEW' as const },
  { form_id: '03-B02-2610-002', created_by: '55555', amount: 1200, expense_type: 'TIRE',
    payee_name: 'สมชาย', dd_no: null, status: 'AWAITING_REVIEW' as const },
  { form_id: '03-B02-2610-003', created_by: '77777', amount: 500, expense_type: 'TOLL',
    payee_name: 'สมหญิง', dd_no: null, status: 'AWAITING_REVIEW' as const },
];

describe('groupByClerk — แยกเอกสารตามชื่อเจ้าหน้าที่', () => {
  test('one group per clerk', () => expect(groupByClerk(CLAIMS)).toHaveLength(2));
  test('totals per clerk', () => {
    const [first] = groupByClerk(CLAIMS);
    expect(first.clerk).toBe('55555');
    expect(first.total).toBe(2840);
  });
  test('sorted by total, biggest first', () =>
    expect(groupByClerk(CLAIMS).map(g => g.total)).toEqual([2840, 500]));
  test('empty input', () => expect(groupByClerk([])).toEqual([]));
});

describe('coverRows', () => {
  test('one row per claim with a running number', () => {
    const rows = coverRows(groupByClerk(CLAIMS)[0]);
    expect(rows).toHaveLength(2);
    expect(rows[0].no).toBe(1);
  });
  test('missing DD shows a dash, not "null"', () =>
    expect(coverRows(groupByClerk(CLAIMS)[0])[1].dd_no).toBe('-'));
});
```

- [ ] **Step 2–4: เขียน `petty-cover.ts` ให้ผ่าน แล้วทำ `CoverSheet.tsx`**

ใบปะหน้า 1 ชุดต่อเจ้าหน้าที่ต่อรอบ: หัว "ใบปะหน้าเอกสารเบิกเงินสดย่อย" · ชื่อเจ้าหน้าที่ · สาขา/แผนก · ตาราง (ลำดับ / เลขที่ใบ / ประเภท / จ่ายให้ / เลข DD / จำนวนเงิน) · ยอดรวม · ช่องเซ็นผู้ส่ง-ผู้รับ

- [ ] **Step 5: Excel**

BE `GET /claims/export` คืน JSON ชุดเดียวกับ list แต่ไม่จำกัดหน้า (เพดาน 5,000 แถว) · FE แปลงเป็นไฟล์ด้วยแนวเดียวกับ `lib/finance/export.ts` · คอลัมน์: เลขที่ใบ · สาขา · แผนก · ประเภท · จ่ายให้ · พจส. · ช่วงวันที่ · จำนวนเงิน · สถานะ · เลข DD · เจ้าหน้าที่ · วันอนุมัติ · รอบที่คืนยอด

- [ ] **Step 6: commit**

```bash
bun test lib/finance/ && git pull
git add lib/finance/petty-cover.* app/finance/components/petty/CoverSheet.tsx app/api/finance/petty/claims/export
git commit -m "feat(petty): cover sheet grouped by clerk and Excel export"
```

## S6 — เก็บงาน

### Task 15: แยกบทบาทบัญชี/การเงิน + เมนู + แจ้งเตือน

**Files:**
- Modify: `menait-service/lib/finance/role.ts` + `role.test.ts`
- Modify: `menait-service/app/home/menu-groups.ts:99-113`
- Modify: `menait-service/lib/finance/petty-access.ts` + `petty-access.test.ts`
- Modify: `api-ncac/routes/finance/petty_routes.py` (เช็กบทบาทบัญชี/การเงินแยกกัน)
- Modify: `api-ncac/services/finance/petty_mail.py`

**Interfaces:**
- Consumes: env `FINANCE_DEPARTMENT_IDS` (เดิม) · env ใหม่ `ACCOUNTING_DEPARTMENT_IDS` `ACCOUNTING_EMPLOYEE_IDS` `TREASURY_DEPARTMENT_IDS` `TREASURY_EMPLOYEE_IDS`
- Produces: `isAccountingUser(user, cfg): boolean` · `isTreasuryUser(user, cfg): boolean` · `accountingConfig(env)`

- [ ] **Step 1: เขียนเทสต์ที่ยังไม่ผ่าน**

ต่อใน `lib/finance/role.test.ts`:

```ts
import { accountingConfig, isAccountingUser, isTreasuryUser } from './role';

describe('บัญชี vs การเงิน แยกกัน', () => {
  const env = {
    ACCOUNTING_DEPARTMENT_IDS: '4',
    TREASURY_DEPARTMENT_IDS: '6',
    ACCOUNTING_EMPLOYEE_IDS: '80001',
    TREASURY_EMPLOYEE_IDS: '90001',
  };
  const cfg = accountingConfig(env);

  test('accounting by department', () =>
    expect(isAccountingUser({ department_id: 4 }, cfg)).toBe(true));
  test('treasury by department', () =>
    expect(isTreasuryUser({ department_id: 6 }, cfg)).toBe(true));
  test('accounting is not treasury', () =>
    expect(isTreasuryUser({ department_id: 4 }, cfg)).toBe(false));
  test('named individuals win over department', () =>
    expect(isAccountingUser({ department_id: 99, employee_id: '80001' }, cfg)).toBe(true));
  test('unset env means nobody — fail closed, not open', () => {
    const empty = accountingConfig({});
    expect(isAccountingUser({ department_id: 4 }, empty)).toBe(false);
    expect(isTreasuryUser({ department_id: 6 }, empty)).toBe(false);
  });
});
```

และต่อใน `petty-access.test.ts`:

```ts
describe('ปิดรอบเป็นงานการเงิน ไม่ใช่บัญชี', () => {
  test('treasury may close', () =>
    expect(canCloseBatch({ employee_id: '90001', is_treasury: true })).toBe(true));
  test('accounting may not close', () =>
    expect(canCloseBatch({ employee_id: '80001', is_accounting: true })).toBe(false));
  test('accounting may review', () =>
    expect(canReview({ employee_id: '80001', is_accounting: true })).toBe(true));
  test('treasury may not review', () =>
    expect(canReview({ employee_id: '90001', is_treasury: true })).toBe(false));
  test('admin may do both', () => {
    expect(canCloseBatch({ employee_id: '1', role: 'a' })).toBe(true);
    expect(canReview({ employee_id: '1', role: 'a' })).toBe(true);
  });
});
```

- [ ] **Step 2: รันให้เห็นว่าไม่ผ่าน**

Run: `bun test lib/finance/role.test.ts lib/finance/petty-access.test.ts`
Expected: FAIL — ยังไม่มี `isAccountingUser` / `canReview`

- [ ] **Step 3: เขียนให้ผ่าน**

ต่อใน `lib/finance/role.ts` (ของเดิมไม่แตะ — `canUseFinance` และ `financeConfig` ยังทำงานเหมือนเดิมเพื่อไม่ให้ Advance กระทบ):

```ts
export type AccountingConfig = {
  accDepts: string[]; accEmployees: string[];
  treDepts: string[]; treEmployees: string[];
};

/** ไม่มีค่า default — ไม่ตั้ง env = ไม่มีใครเป็น ดีกว่าเปิดสิทธิ์ให้คนทั้งแผนกโดยไม่ตั้งใจ */
export function accountingConfig(env: Record<string, string | undefined> = process.env): AccountingConfig {
  return {
    accDepts: parseIdList(env.ACCOUNTING_DEPARTMENT_IDS),
    accEmployees: parseIdList(env.ACCOUNTING_EMPLOYEE_IDS),
    treDepts: parseIdList(env.TREASURY_DEPARTMENT_IDS),
    treEmployees: parseIdList(env.TREASURY_EMPLOYEE_IDS),
  };
}

export function isAccountingUser(
  user: { department_id?: number | null; employee_id?: string | null },
  cfg: AccountingConfig,
): boolean {
  return isFinanceUser(user, cfg.accDepts, cfg.accEmployees);
}

export function isTreasuryUser(
  user: { department_id?: number | null; employee_id?: string | null },
  cfg: AccountingConfig,
): boolean {
  return isFinanceUser(user, cfg.treDepts, cfg.treEmployees);
}
```

แล้วเติม `is_accounting` / `is_treasury` ลง session ตอนล็อกอิน (ที่เดียวกับที่ `is_finance` ถูกเติมอยู่แล้ว) · ขยาย type `U` ใน `petty-access.ts` ให้มีสองคีย์นี้ และ `UserInfo` ใน `app/context/SessionContext` ด้วย แล้วแก้ `petty-access.ts`:

```ts
export function canReview(user: U | null | undefined): boolean {
  return user?.is_accounting === true || user?.role === 'a';
}

export function canCloseBatch(user: U | null | undefined): boolean {
  return user?.is_treasury === true || user?.role === 'a';
}
```

> ถ้า `is_accounting` / `is_treasury` ยังไม่มีในเซสชัน ให้ fallback เป็น `is_finance` ชั่วคราว **แต่ต้องเขียนคอมเมนต์ TODO ชี้ไปที่ข้อนี้** ไม่ใช่ปล่อยเงียบ

- [ ] **Step 4: อัปเดต BFF ที่ใช้ `requireFinance`**

เทสต์ที่เขียนไว้ใน Task 4 (`canSeeClaim` ข้อ "finance sees it only from AWAITING_REVIEW onwards") ต้องแก้ให้ใช้ `is_accounting` ด้วย — อัปเดตพร้อมกันในขั้นนี้ ไม่ปล่อยให้เทสต์เก่าทดสอบสิทธิ์ที่เลิกใช้แล้ว

`claims/[form_id]/[action]/route.ts` — `review` เช็ก `canReview` · `batches/route.ts` POST เช็ก `canCloseBatch` · `expense-types/[code]` PUT เช็ก `canReview` (บัญชีแก้ master ประเภทได้ ตามข้อ 5)

- [ ] **Step 5: เมนู**

ใน `app/home/menu-groups.ts` กลุ่ม `finance` เพิ่ม 4 รายการต่อท้าย 4 รายการเดิมของ Advance:

```ts
            { title: 'เบิกเงินสดย่อย', description: 'เปิดใบเบิกแทน พจส. ตามประเภทค่าใช้จ่าย', icon: Receipt, href: '/finance/petty/new' },
            { title: 'ติดตามใบเบิกเงินสดย่อย', description: 'ดูสถานะใบที่คุณเปิด และแก้ใบที่ถูกตีกลับ', icon: ClipboardCheck, href: '/finance/petty' },
            { title: 'อนุมัติเบิกเงินสดย่อย', description: 'ใบที่รอคุณอนุมัติ โอนเงิน และส่งบัญชี', icon: BadgeCheck, href: '/finance/petty/approvals' },
            { title: 'งานเงินสดย่อย (บัญชี/การเงิน)', description: 'ตรวจเอกสาร ปิดรอบ และคืนยอด', icon: Landmark, href: '/finance/petty/accounting', financeOnly: true },
```

เพิ่ม `Receipt` ใน import ของ `lucide-react` ที่หัวไฟล์

- [ ] **Step 6: แจ้งเตือน**

`petty_mail.py` ส่งสามจังหวะ โดยปลายทาง**รวมเจ้าหน้าที่ผู้เปิดใบทุกครั้ง** ไม่ใช่แค่ผู้อนุมัติ:

| จังหวะ | ถึงใคร | เนื้อหา |
|---|---|---|
| ด่านบล็อก | เจ้าหน้าที่ + ผู้อนุมัติ | ขาดอะไร เป็นข้อ ๆ พร้อมเลขแถว |
| ซ้ำ | เจ้าหน้าที่ + ผู้อนุมัติ | ซ้ำกับใบไหน พร้อมเลขที่ใบ |
| ตีกลับ | เจ้าหน้าที่ | เหตุผลที่ผู้อนุมัติกรอก |

ปิดด้วย `FINANCE_EMAIL_ENABLED` เหมือน Advance · เรียกผ่าน `BackgroundTasks`

- [ ] **Step 7: รันทุกอย่าง แล้ว commit**

```bash
cd ~/Documents/project/ncac/api-ncac && python -m pytest tests -q
cd ~/Documents/github/menait-service && bun test && bun --bun next lint && bun --bun next build
git pull && git add lib/finance/role.ts lib/finance/role.test.ts lib/finance/petty-access.ts lib/finance/petty-access.test.ts app/home/menu-groups.ts app/api/finance/petty
git commit -m "feat(petty): split accounting and treasury roles, add menu entries"
```

---

## ตรวจก่อนส่ง

เมื่อครบทั้ง 15 งาน ให้เดินรายการนี้บน DB สำเนา:

- [ ] ใบตัวอย่างจริง **1,640.00** (16 คัน 3 ราคา 17–24/9) เดินครบ 7 ขั้นจนคืนยอด
- [ ] ใบที่ไม่แนบใบชั่ง **อนุมัติไม่ได้** และเจ้าหน้าที่เห็นว่าขาดอะไร
- [ ] บัตรชั่งเลขเดียวกัน + รถคันเดียวกัน **บล็อก ไม่มีช่องให้ทับ**
- [ ] รถ 1093 สองแถว เลขบัตรต่างกัน **เตือนอย่างเดียว** ทับได้เมื่อกรอกเหตุผล
- [ ] ทะเบียน `71 4285` เทียบกับ `71-4285` **ติดด่านเดียวกัน**
- [ ] ยอด `available` ลดตอนอนุมัติ และกลับเท่าเดิมตอนปิดรอบ
- [ ] `fin_advances` ไม่มีแถวใดถูกแก้เลย (เทียบ `updated_at` ก่อน-หลัง)
- [ ] ใบสำคัญจ่ายที่พิมพ์ออกมา **เทียบช่องต่อช่องกับ PDF ตัวอย่างได้ครบ**
- [ ] ใบ DD ที่กรอกเลขแล้วดึงขึ้นมาได้ และยอดตรงกับใบเบิก
- [ ] เมนูใหม่ 4 รายการขึ้นในกลุ่ม Finance Service และเปิดได้ทุกหน้า

## ที่ยังไม่ทำในแผนนี้ (รอข้อมูลจากผู้ใช้)

| เรื่อง | ติดอะไร |
|---|---|
| หัก ณ ที่จ่าย | ยังเป็น TBC — ตอนนี้แค่ติ๊ก `wht_applicable` ไว้ให้บัญชีทำต่อ |
| Account Code / Project Code | ยังไม่รู้ว่าเลือกจากรายการหรือพิมพ์เอง — ช่องว่างไว้ก่อน |
| "ใบที่ x ในรอบ 1 เดือน" | ตกลงว่ายังไม่ทำ |
| รับข้อมูลจาก MenaGO | เฟสถัดไป · คอลัมน์ `source` เตรียมไว้แล้ว |
| ใบเสร็จตัวจริงค่าทางด่วน | ยังไม่มีสถานะติดตามว่าบัญชีได้รับตัวจริงหรือยัง |
