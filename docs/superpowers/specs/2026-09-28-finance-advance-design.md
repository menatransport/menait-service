# Finance Advance Cash (เบิกเงิน Advance): Design

- **Date:** 2026-09-28
- **Status:** Draft, waiting for user review
- **Repos:**
  - FE: `menatransport/menait-service`, branch `feat/finance-advance`
  - BE: `nrk16p/api-ncac`, branch `feat/finance-advance`, in a separate git worktree
- **DB:** Postgres `ncacdb` (production, chosen by the user for local testing)

## 1. Goal

Move the Finance team's advance-cash process off the Excel sheet and onto menait-service, as a Finance
module that reuses the existing form + approval engine (the one the IT service uses):

1. An employee requests an advance: purpose, amount, date needed, and attachments.
2. One approval step, using the existing approval rules.
3. After approval, Finance pays: petty-cash account, withdrawal voucher number and date (เลขที่ใบเบิก / วันที่ตั้งเบิก),
   payment document number (เลขที่เอกสารจ่าย), amount, transfer date, and clearing due date (กำหนดการเคลียร์).
4. The employee clears the advance: Finance records the clearing date, the actual amount spent (ยอดใช้จริง) and the
   clearing documents.
5. The difference is settled. Either the employee returns money (รับคืน) or the company pays extra (เบิกเพิ่ม).
   Finance records the transfer date (วันที่โอนเงินคืน), then the advance is closed.

This phase is for **local testing of the flow**. Nothing is pushed or deployed.

## 2. Decisions already made (from the user)

| # | Decision |
|---|---|
| D1 | The Finance module lives **inside menait-service** (option A). There is no separate FE repo. |
| D2 | One approval step. Requester level 1–4 → approver level 5–6. Requester level 5–6 → approver level 7–8. The approver must be in the same department, or mapped to it in `form_approver_departments`. |
| D3 | **No email or LINE notifications** for advance forms yet (the user must create an email token first). |
| D4 | The local FE and BE point at **production `ncacdb`**. New tables are additive. Test data is kept minimal and cleaned up afterwards. |

## 3. Defaults chosen by me (the user may override during review)

| # | Default | Why |
|---|---|---|
| A1 | The request document number is the existing system `form_id`, e.g. `ADV-2026-0001`. Finance **types** the voucher number (เลขที่ใบเบิก, e.g. `SADV2607-005`) by hand when paying. | The two sample sheets use different formats (`No.26/09-01`, `SADV2607-005`). This avoids a numbering change in the shared `generate_form_id`. |
| A2 | The account code is the **petty-cash account the advance is paid from**. Finance picks it when paying. | The account list contains only petty-cash accounts, 110101–110111. |
| A3 | **Finance** records the clearing. The employee can add receipts as attachments. | It matches the current sheet, which Finance maintains. |
| A4 | The Finance role is users in **department 4 (แผนกการเงิน) or 6 (แผนกบัญชี)**, plus an env list of extra employee IDs for testers. | Department IDs come from `GET /departments`. |
| A5 | Requesters at level 7–9 (Deputy C-level, C-level, CEO) match no rule, so they are **auto-approved** (existing engine behaviour). | Only D2's two rules were requested. |
| A6 | An employee may have **several open advances** at once. There is no block on overdue employees. | YAGNI. It can be added later. |
| A7 | `settle_amount = amount_paid − amount_actual`. A positive value means the employee returns money (รับคืน). A negative value means the company pays extra (เบิกเพิ่ม). Zero closes the advance immediately. | This matches the "รับคืน (เบิกเพิ่ม)" column. |

## 4. Architecture

```
Employee ──► /finance/advance/new (renderForm + file upload)
                 │  POST /api/formsubmit ─► BE POST /forms/submit        (existing, form_type='Advance')
                 │  POST /api/uploads3   ─► S3 mn-bucket/<base>/<form_id>/…
Approver ──► /mytickets (existing "อนุมัติ" tab) ─► BE /forms/{id}/approve|reject   (existing)
Finance  ──► /finance, /finance/[form_id], /finance/accounts
                 │  /api/finance/*  (new Next routes; they check the session cookie and the finance role)
                 ▼
             BE /finance/*  (new router, api-ncac) ─► ncacdb: fin_accounts, fin_advances, fin_advance_logs
                                                    + reads form_submissions / values / users (existing)
```

Key design choice: **the generic `/forms/*` routes get no finance hooks.** The Finance queue is a query over
`form_submissions` whose form master has `form_type = 'Advance'`, LEFT JOINed to `fin_advances`. A
`fin_advances` row is created the first time Finance records a payment. The IT flow stays untouched. The only
generic-route change is the notification guard (§6.3).

## 5. Data model (new tables in `ncacdb`)

These are created by SQLAlchemy models imported in `models/__init__.py`, so `create_all` picks them up. The
`form_approver_departments` table was missed because it wasn't imported there. On first creation the DDL is
shown to the user and run once, with the user's approval.

**`fin_accounts`**: the account-code master, seeded with the 11 accounts 110101–110111.

| column | type | notes |
|---|---|---|
| acc_code | varchar(20) PK | e.g. `110103` |
| acc_name | varchar(255) not null | Thai name |
| acc_name_en | varchar(255) | |
| is_active | boolean not null default true | |
| created_at / updated_at | timestamptz default now() | |

**`fin_advances`**: one row per paid advance, 1:1 with `form_submissions`.

| column | type | notes |
|---|---|---|
| id | serial PK | |
| submission_id | int not null **unique** FK → form_submissions.id | |
| form_id | varchar(50) not null unique | e.g. `ADV-2026-0001`, denormalised for lookups |
| acc_code | varchar(20) FK → fin_accounts.acc_code | set when paying |
| voucher_no | varchar(50) | เลขที่ใบเบิก |
| voucher_date | date | วันที่ตั้งเบิก |
| payment_doc_no | varchar(50) | เลขที่เอกสารจ่าย |
| purpose | text | วัตถุประสงค์, pre-filled from the request |
| amount_paid | numeric(12,2) not null, ≥ 0 | ยอดเงิน |
| transfer_date | date | วันที่โอนเงิน |
| clear_due_date | date not null | กำหนดการเคลียร์ |
| clear_date | date | วันที่เคลียร์ |
| amount_actual | numeric(12,2), ≥ 0 | ยอดใช้จริง |
| clear_doc_no | varchar(100) | เอกสารเคลียร์ |
| settle_amount | numeric(12,2) | รับคืน (+) / เบิกเพิ่ม (−), computed |
| settle_date | date | วันที่โอนเงินคืน |
| remark | text | หมายเหตุ |
| fin_status | varchar(30) not null | `PAID` / `AWAITING_SETTLEMENT` / `CLOSED` |
| created_by / updated_by | varchar(50) | employee_id |
| created_at / updated_at | timestamptz default now() | |

Indexes: `fin_status`, `clear_due_date`.

**`fin_advance_logs`**: an audit trail of money changes.

| column | type | notes |
|---|---|---|
| id | serial PK | |
| advance_id | int not null FK → fin_advances.id | |
| action | varchar(30) | `PAY` / `PAY_EDIT` / `CLEAR` / `CLEAR_EDIT` / `SETTLE` |
| changes | jsonb | `{field: [old, new]}` |
| action_by | varchar(50) | employee_id |
| created_at | timestamptz default now() | |

## 6. Backend (api-ncac)

### 6.1 Status model

The display status is derived as follows, in one pure function `derive_status()`:

| Condition | Status | Thai label |
|---|---|---|
| `status_approve = 'In Progress'` | PENDING_APPROVAL | รออนุมัติ |
| `status_approve = 'Rejected'` | REJECTED | ไม่อนุมัติ |
| Approved and no `fin_advances` row | AWAITING_PAYMENT | รอจ่าย |
| `fin_status = PAID` | AWAITING_CLEARING | รอเคลียร์ (the `overdue` flag is set if today > `clear_due_date`) |
| `fin_status = AWAITING_SETTLEMENT` | AWAITING_SETTLEMENT | รอรับคืน / จ่ายเพิ่ม |
| `fin_status = CLOSED` | CLOSED | ปิดแล้ว |

These transitions live in the pure module `services/finance/advance_logic.py`, which is unit-tested:

- **pay:** allowed when the status is AWAITING_PAYMENT (creates the row) or AWAITING_CLEARING (a correction, logged as `PAY_EDIT`).
  - Requires `acc_code` (active), `amount_paid ≥ 0` and `clear_due_date ≥ transfer_date`.
  - Sets `fin_status = PAID`.
- **clear:** allowed when the status is AWAITING_CLEARING, or AWAITING_SETTLEMENT (a correction).
  - Requires `clear_date` and `amount_actual ≥ 0`.
  - Computes `settle_amount`.
  - Sets `fin_status` to CLOSED if the difference is zero, otherwise to AWAITING_SETTLEMENT.
- **settle:** allowed only when the status is AWAITING_SETTLEMENT. Requires `settle_date`, then sets `fin_status = CLOSED`.
- Every write takes `SELECT … FOR UPDATE` on the `fin_advances` row, or relies on the unique `submission_id` for the first pay, and writes one `fin_advance_logs` row.

### 6.2 New router `routes/finance/advance_routes.py` (prefix `/finance`)

| Method | Path | Purpose |
|---|---|---|
| GET | `/finance/accounts?active=` | List accounts |
| POST | `/finance/accounts` | Create an account |
| PUT | `/finance/accounts/{acc_code}` | Update the name or active flag |
| GET | `/finance/advances?status=&overdue=&employee_id=&acc_code=&date_from=&date_to=` | Queue and list. Joins users, department and site for requester info, and form values for the purpose, amount and use date. |
| GET | `/finance/advances/{form_id}` | Detail: request values, approval logs, the fin row and fin logs |
| PUT | `/finance/advances/{form_id}/pay` | Record or correct the payment |
| PUT | `/finance/advances/{form_id}/clear` | Record or correct the clearing |
| PUT | `/finance/advances/{form_id}/settle` | Record the return or extra payment and close |
| GET | `/finance/summary` | Outstanding (paid, not closed) totals by employee and by account |

Write bodies include `action_by` (employee_id). **Known limitation:** like every other api-ncac route today, these
endpoints have no auth. That's acceptable for local testing only. Production launch is gated on the security work
in §9.

### 6.3 Change to shared routes (the only one)

Add a helper `notifications_enabled(form_master)` that returns `False` when `form_type == 'Advance'` and env
`ADVANCE_NOTIFY_ENABLED` is not `'true'`. Guard the existing `send_email` and `send_line_message` background tasks
with it:

- submit (email + LINE)
- approve
- reject
- status Done

IT forms keep sending exactly as today.

### 6.4 Wiring and seeds

- Import the models in `models/__init__.py`.
- Register the router in `main.py`.
- Add a seed script `scripts/finance/seed_fin_accounts.py`, which is idempotent (upsert by `acc_code`).
- Add a seed script `scripts/finance/seed_adv_form.py`, which is idempotent and skips if `ADV` already exists.
  - It creates form master `ADV` ("เบิกเงิน Advance") with `form_type='Advance'`, `need_approval=true` and
    `form_status='Active'`.
  - It creates three questions with fixed `question_name`s:
    - `adv_purpose` (longtext, required, label "เบิกเงิน Advance สำหรับ")
    - `adv_amount` (number, required, label "จำนวนเงิน")
    - `adv_use_date` (date, required, label "วันที่ใช้เงิน")
  - It creates the two D2 rules, both `level_no=1`, `approve_by_type='position_level_range'`:
    - creator 1–4 → approver 5–6
    - creator 5–6 → approver 7–8
  - The form is seeded by script instead of the builder because the builder overwrites `question_name` with the
    label on edit, and deleting a rule renumbers `level_no`.
- The BE reads the request values by `question_name` (`adv_purpose`, `adv_amount`, `adv_use_date`). If a name is
  missing, it falls back to the first question of the matching type (longtext/text, number, date) by
  `sort_order`, so a later label edit in the builder doesn't break the queue.

## 7. Frontend (menait-service)

### 7.1 Session and role

- `/api/login` adds `is_finance` to the session. It is true when `department_id ∈ FINANCE_DEPARTMENT_IDS`
  (env, default `4,6`) or `employee_id ∈ FINANCE_EMPLOYEE_IDS` (env, for testers).
- Existing cookies don't have the flag, so users must log in again.
- The navbar shows a "การเงิน" section when `is_finance` is true. It shows "เบิกเงิน Advance" to all users.

### 7.2 New Next API routes (`app/api/finance/…`)

- They proxy to `${URL_API}/finance/…` with `encodeURIComponent` on every path and query part.
- **They verify the `session-token` cookie server-side** (`verifyToken`) and require `is_finance` for Finance
  endpoints.
- `action_by` is taken from the verified session, never from the client. This way we don't copy the existing
  pattern of trusting the client.

### 7.3 Pages

| Page | Who | What |
|---|---|---|
| `/finance/advance/new` | all | Renders the latest Active `ADV` form with `renderForm` and uses `file-dropzone` for multi-file upload. Submits through the existing `/api/formsubmit`, then uploads each file to `/api/uploads3`. |
| `/finance/advance` | all | My advances: status, amounts, due date, overdue badge |
| `/finance` | finance | Queue with tabs: รอจ่าย, รอเคลียร์, เกินกำหนด, รอรับคืน/จ่ายเพิ่ม, ปิดแล้ว, ทั้งหมด. Columns follow the current Excel sheet. Excel export uses the existing `xlsx` library. |
| `/finance/[form_id]` | finance | Request details + attachments + approval history. Three step cards: จ่ายเงิน, เคลียร์, รับคืน/เบิกเพิ่ม. Clearing-document upload goes to the S3 subfolder `clear/`. Change log. |
| `/finance/accounts` | finance | Account master: list, add, edit, deactivate |

Approvals use the existing `/mytickets` approval tab. Advance forms already appear there, because the approve buttons
show for every `form_type` other than `Issue`.

### 7.4 Small shared changes

- Builder: add `Advance` to the form-type options, so an admin opening the seeded ADV form doesn't lose its
  type.
- `app/api/uploads3`: accept an optional `folder` param. Only `clear` is allowed, which produces the key
  `<base>/<form_id>/clear/<file>`.

## 8. Test environment and safety (local only)

- **BE:**
  - A git worktree `~/Documents/project/ncac/api-ncac-finance` on branch `feat/finance-advance`, so it doesn't
    collide with other sessions using the main checkout.
  - A new macOS venv (the repo's `venv/` is Windows-style).
  - `.env` with `DATABASE_URL` pointing at ncacdb, `SECRET_KEY`, `GOOGLE_CLIENT_ID`, and `DB_POOL_SIZE=1`,
    `DB_MAX_OVERFLOW=1` (the cluster's `max_connections` is 25).
  - **No** `SMTP_*` or `LINE_TOKEN` variables, so nothing can be sent.
  - Runs on port 8001.
- **FE:** `.env.local` `URL_API=http://localhost:8001` while testing. The 4 organization routes still hardcode the
  Render URL; they are read-only master data, which is fine. The dev server runs on port 4000 (Google OAuth callback).
- **DDL and seeds:** the exact `CREATE TABLE` SQL, the 11 account rows, and the ADV form + rules seed are shown to
  the user and run only after approval.
- **Test data in prod:**
  - The `ADV` form master is created by `seed_adv_form.py` with `form_type='Advance'`. It won't appear on the live
    home page, which lists only `Service` forms.
  - Test requests **will** appear in the chosen approver's live approval tab. The user picks a willing requester
    and approver pair.
  - After testing, a cleanup list of test `form_id`s (submissions, values, logs, approval logs, fin rows) is shown
    for approval before deleting.
  - The ADV form is set to Inactive until launch.
- **Nothing is pushed.** No Render or Vercel deploy.

## 9. Out of scope (later)

- **Launch gate, which must be done before production:** auth on the api-ncac `/forms/*`, `/users/*` and `/finance/*`
  routes; auth middleware on the FE `/api/*` routes; replacing the raw-SQL `/api/form`; stopping auto-approval when
  the requester's level is unknown.
- Email and LINE templates for advances (after the email token exists).
- Automatic `SADVyymm-nnn` numbering.
- A reminder job for due or overdue clearing.
- Importing historical rows from Excel.
- GL/journal posting.
- Fixing the builder bug where deleting a rule renumbers `level_no` into multiple approval steps.

## 10. Testing

- **BE unit (pytest, new `tests/finance/`):**
  - `derive_status` (every branch, including overdue)
  - pay, clear and settle transition guards
  - settle-amount sign cases (+, −, 0)
  - validation errors
- **FE:** `bun run build` and `bun run lint` pass.
- **Manual end-to-end flow on local FE (4000) + BE (8001):**
  1. A level 1–4 requester submits with 2 attachments. Their department's level 5–6 manager sees it and approves it.
  2. It appears in รอจ่าย. Finance pays with account 110103, then it appears in รอเคลียร์.
  3. Set `clear_due_date` in the past. The advance appears in เกินกำหนด.
  4. Clear with actual < paid, so it goes to รอรับคืน. Settle it, so it is ปิดแล้ว.
  5. Clear with actual > paid (เบิกเพิ่ม, negative settle), then settle.
  6. Clear with actual = paid. It closes directly.
  7. Reject path: the request shows ไม่อนุมัติ and never enters the Finance queue.
  8. A level 5–6 requester is routed to a level 7–8 approver.
  9. The BE log shows no email or LINE was sent for the ADV submissions.
  10. The IT Service form still submits and approves as before (regression check).
