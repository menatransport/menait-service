# Finance Advance — Payee Account Master (บัญชีรับเงิน) — Design

Date: 2026-10-05 · Status: approved in chat ("ok - let do it")
Builds on: `2026-09-29-finance-advance-v2-design.md` (§4 payee fields, `lib/finance/bank.ts`, BE `advance_logic.BANKS`)

## 1. Requirements and decisions

The user's brief: a payee account Master managed by Accounting, filled from user requests. Employee ID comes from the login, the bank is **K-Bank only**, and new requests go to บัญชี (accountbkk@menatransport.co.th) by email. The payee is either the employee's **own account** (from the Master) or a **Supplier account** (no Master, attachment required).

| # | Decision (user's answer) |
|---|---|
| D1 | A new account is requested **inside the system**, and Accounting gets an email. The account becomes usable **only after Accounting approves it** ("บัญชีตรวจสอบผ่านจึงเริ่มใช้ได้"). |
| D2 | **One K-Bank account per employee.** Approving a new request replaces the old account. |
| D3 | A Supplier can use **any of the 16 banks** already supported, with the existing account-number check. A bookbank or an invoice showing the account number is required. |
| D4 | The Master **starts empty**. Accounting adds accounts on the management page, or employees request them. |

## 2. Data model (BE, ncacdb — the user runs `2026-10-05_finance_payee_accounts.sql` in DBeaver)

**`fin_payee_accounts`** (Master):
- Columns:
  - `id` serial PK
  - `employee_id` varchar(50) NOT NULL **UNIQUE**
  - `bank` varchar(20) NOT NULL DEFAULT 'KBANK', with CHECK `bank = 'KBANK'`
  - `account_no` varchar(20) NOT NULL (digits only, 10 digits)
  - `account_name` varchar(150) NOT NULL
  - `status` varchar(10) NOT NULL DEFAULT 'ACTIVE', with CHECK IN ('ACTIVE','INACTIVE')
  - `source_request_id` int NULL (FK → requests, ON DELETE SET NULL)
  - `created_by` varchar(50), `created_at` timestamptz NOT NULL DEFAULT now()
  - `updated_by` varchar(50), `updated_at` timestamptz NOT NULL DEFAULT now()
- An employee's account is usable only when `status = 'ACTIVE'`.

**`fin_payee_account_requests`**:
- Columns:
  - `id` serial PK
  - `employee_id` varchar(50) NOT NULL
  - `bank` NOT NULL DEFAULT 'KBANK', with CHECK `bank = 'KBANK'`
  - `account_no` varchar(20) NOT NULL
  - `account_name` varchar(150) NOT NULL
  - `remark` text
  - `status` varchar(10) NOT NULL DEFAULT 'PENDING', with CHECK IN ('PENDING','APPROVED','REJECTED','CANCELLED')
  - `review_remark` text
  - `reviewed_by` varchar(50), `reviewed_at` timestamptz
  - `created_at` timestamptz NOT NULL DEFAULT now()
- **At most one PENDING request per employee**, enforced by a partial unique index `ON (employee_id) WHERE status = 'PENDING'`.

**`fin_payee_account_logs`** (audit — this is payment data):
- Columns:
  - `id` serial PK
  - `employee_id` varchar(50) NOT NULL
  - `action` varchar(30) NOT NULL
  - `changes` jsonb (`{field: [before, after]}` pairs, the same convention as `fin_advance_logs` — never scalars)
  - `remark` text
  - `action_by` varchar(50)
  - `created_at` timestamptz NOT NULL DEFAULT now()
- Actions:
  - REQUEST, REQUEST_CANCEL, REQUEST_REJECT
  - APPROVE — writes the master from a request
  - CREATE, UPDATE, DEACTIVATE, REACTIVATE — manual changes by Accounting
- Index on `employee_id`.

**ADV form question:** add `adv_payee_type` (dropdown, required) with options `SELF` = "บัญชีตัวเอง" and `SUPPLIER` = "บัญชี Supplier". It sits at sort_order 5; `adv_bank`, `adv_account_no` and `adv_account_name` shift to 6/7/8. The same migration does both. The bank, account and name values are still stored on every submission as a **snapshot**, so voucher, pay and print keep working unchanged.

## 3. Rules (BE, pure logic `services/finance/payee_logic.py`, DB-free tests)

**Account number:**
- An employee or master account is K-Bank and exactly 10 digits after normalizing, which removes spaces and dashes.
- Messages:
  - "เลขที่บัญชีกสิกรไทยต้องมี 10 หลัก"
  - "กรุณาระบุชื่อบัญชี"

**Requests:**
- **Create:**
  - Rejects with 409 "มีคำขอที่รอบัญชีตรวจสอบอยู่แล้ว" when the employee already has a PENDING request.
  - Rejects when the employee is unknown.
- **Approve** (Finance) runs in one transaction:
  - The request becomes APPROVED, with reviewed_by and reviewed_at set.
  - The master is upserted: if a row exists for that employee, its number, name and source are replaced and it becomes ACTIVE.
  - A log entry is written, with `changes` carrying before/after pairs.
- **Reject** (Finance): `review_remark` is required.
- **Cancel:** the requester can cancel their own request, only while it is PENDING.
- Any action on a request that is not PENDING gets 409 "คำขอนี้ไม่อยู่ในสถานะรอตรวจสอบ".

**Manual master changes (Finance):**
- Create uses the same validation as a request. It gets 409 when the employee already has a row; Accounting must edit that row instead.
- Update can change the number, the name and the status. Every change is logged.

**ADV submit guard (`_guard_advance_values`):**
- When the form has `adv_payee_type`, the value is **required**.
- **`SELF`:**
  - The employee must have an ACTIVE master row, or the guard returns 400 "ยังไม่มีบัญชีรับเงินที่บัญชีอนุมัติ — กรุณาขอเพิ่มบัญชีรับเงิน".
  - The BE **overwrites** the submitted bank, account_no and account_name values with the master's values. A client can never redirect a SELF payment.
  - If any of those value rows is missing, the guard returns 400.
- **`SUPPLIER`:** keeps today's checks, which allow any of the 16 banks with the account-number format check and require a name.

## 4. Email to Accounting (create request)

- **Mechanism:** a background task (FastAPI `BackgroundTasks`) calls the existing `services/email_service.send_email` (HTML, no attachments).
- **To:** env `FINANCE_ACCOUNT_EMAIL`, default `accountbkk@menatransport.co.th`.
- **Subject:** `[ขอเพิ่มบัญชีรับเงิน] {ชื่อ-สกุล} ({employee_id})`.
- **Body:**
  - A short Thai HTML template with the requester's name, รหัสพนักงาน, แผนก and ตำแหน่ง.
  - "ธนาคารกสิกรไทย", the account number formatted `xxx-x-xxxxx-x`, the account name and the remark.
  - A button-link to `{app_origin}/finance/payee-accounts?request={id}`.
  - The note "ไฟล์ bookbank ดูได้ในระบบ".
- **Link origin:** `app_origin` comes from the FE **server route** (`req.nextUrl.origin`), never from the browser body.
- **Escaping:** every interpolated value is HTML-escaped.
- **Failure:** a send error is logged and swallowed, so the request stays saved.

## 5. Bookbank files

- **Storage:** request attachments live under S3 `menait-service/payee-requests/{request_id}/`.
- **Access:** they go through **new FE routes with auth**, never through `/api/uploads3`, which is unauthenticated.
  - Upload: allowed for the owner, only while PENDING.
  - List and view: allowed for the owner or Finance, using presigned URLs that expire in 1 h.
- **Files:** JPG, PNG, WebP or PDF, at most 10 MB each. A file is required when the request is created; the FE uploads it right after the create call. A PENDING request without a file can still receive more files from the requester's panel.

## 6. FE

**New request page `/finance/advance/new` → section "บัญชีรับเงิน"**. The section is a custom `PayeeAccountSection`. `adv_payee_type`, `adv_bank`, `adv_account_no` and `adv_account_name` are no longer rendered by the generic loop.
- **Radio:** (●) บัญชีตัวเอง / ( ) บัญชี Supplier. Default is SELF.
- **SELF with an ACTIVE master:** a read-only card showing "ธนาคารกสิกรไทย · 123-4-56789-0 · ชื่อบัญชี", plus the hint "หากต้องการเปลี่ยนบัญชี กดขอเปลี่ยนบัญชี". The section fills the three values from the master.
- **SELF with no master:**
  - An amber box: "ยังไม่มีบัญชีรับเงินในระบบ" with the button **ขอเพิ่มบัญชีรับเงิน**.
  - **The dialog** has:
    - เลขที่บัญชีกสิกรไทย* (10 digits, live format check)
    - ชื่อบัญชี* (pre-filled with the user's full name)
    - แนบ bookbank* (FilePicker, at least 1)
    - หมายเหตุ
    - a submit button
  - **Submitting** creates the request, uploads the file(s), then shows a success message.
  - **With a pending request:** the box shows "ส่งคำขอแล้ว รอบัญชีตรวจสอบ (ส่งเมื่อ dd/mm/yy)" with the details and two actions, **ยกเลิกคำขอ** and **แนบไฟล์เพิ่ม**.
  - **After a rejection:** the box shows the reason and lets the user request again.
  - The ADV **submit button stays disabled** until a master is ACTIVE, unless the user switches to Supplier.
- **SELF with a master and a pending change request:** the card shows the current account plus "มีคำขอเปลี่ยนบัญชีรอตรวจสอบ".
- **SUPPLIER:**
  - Inputs: ธนาคาร (16-bank select), เลขที่บัญชี (existing `accountNoError` check), ชื่อบัญชี (the supplier name).
  - The attachment label changes to "แนบ bookbank หรือใบแจ้งหนี้ที่มีเลขบัญชี *", and at least 1 file is required before submit.

**Management page `/finance/payee-accounts`** "บัญชีรับเงินพนักงาน" is Finance only; anyone else sees `NoAccess`. It uses the `FinanceCanvas` + `FinanceHeading` style.
- **Tab "คำขอรอตรวจ (N)"** shows a list of PENDING requests: requester (name, department), account number formatted, account name, request date, and the current master account if this is a change ("เปลี่ยนจาก …").
  - **Opening a request** shows its files (presigned links that open in a new tab), then two actions:
    - **อนุมัติ:** asks for confirmation, then shows success.
    - **ไม่อนุมัติ:** the reason is required.
  - The deep link `?request={id}` opens that request.
- **Tab "Master":**
  - Search by name or ID.
  - Columns: employee (name and department) · ธนาคาร · เลขที่บัญชี · ชื่อบัญชี · สถานะ · แก้ไขล่าสุด.
  - **เพิ่มบัญชี:** enter รหัสพนักงาน and the name is looked up and shown, then the account number and name.
  - **แก้ไข:** change the number or name.
  - **ปิดใช้งาน / เปิดใช้งาน**, and **ประวัติ**, which lists log entries from the `changes` pairs.
- **Navigation:** the `/finance` heading gets an action link "บัญชีรับเงินพนักงาน", with a pending-count badge when N > 0.

**FE API routes** (all session-guarded; `employee_id` and `action_by` always come from the session):

| Route | Access |
|---|---|
| `GET /api/finance/payee-accounts/me` | the user |
| `GET /api/finance/payee-accounts` | Finance |
| `POST /api/finance/payee-accounts` | Finance |
| `PUT /api/finance/payee-accounts/[id]` | Finance |
| `GET /api/finance/payee-accounts/[id]/logs` | Finance |
| `POST /api/finance/payee-requests` | user, adds `app_origin` |
| `GET /api/finance/payee-requests` | Finance |
| `GET /api/finance/payee-requests/[id]` | owner or Finance |
| `PUT /api/finance/payee-requests/[id]/approve` | Finance |
| `PUT /api/finance/payee-requests/[id]/reject` | Finance |
| `PUT /api/finance/payee-requests/[id]/cancel` | owner |
| `GET /api/finance/payee-requests/[id]/files` | owner or Finance |
| `POST /api/finance/payee-requests/[id]/files` | owner while PENDING |

## 7. Out of scope / launch gate

- **BE auth:** the routes have none, which is the known launch gate. The new master makes it far more sensitive. The **BE stays on branch `menaIT-v2`, not `main`**, until BE auth lands. The FE routes are guarded today.
- **Notifications:** the requester gets no email or LINE message on approve or reject; they see the status in the UI.
- **Data:** no import of existing ADV accounts (D4).
