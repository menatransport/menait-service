# Finance Advance Cash (เบิกเงิน Advance): Design

- **Date:** 2026-09-28
- **Status:** Draft v2, waiting for user review
- **Repos:**
  - FE: `menatransport/menait-service`, branch `feat/finance-advance`
  - BE: `nrk16p/api-ncac`, branch `feat/finance-advance`, in a separate git worktree
- **DB:** Postgres `ncacdb` (production, chosen by the user for local testing)

## 1. Goal

Move the Finance team's advance-cash process off the Excel sheet and onto menait-service, as a Finance
module that reuses the existing form + approval engine (the one the IT service uses). Files can be attached at
every step.

| Step | Who | Fields | Attachments |
|---|---|---|---|
| 1. Request | Requester | เลขที่เอกสาร (auto), ผู้เบิกเงิน / แผนก / ศูนย์ (from the requester's profile), เบิกเงิน Advance สำหรับ, จำนวนเงิน, วันที่ใช้เงิน | ✅ |
| 2. Approve | Approver (one step) | approve / reject + remark | – |
| 3. Pay | Finance | เลขที่ใบเบิก, วันที่ตั้งเบิก, เลขที่เอกสารจ่าย, วัตถุประสงค์, ยอดเงิน, วันที่โอนเงิน, กำหนดการเคลียร์ (**auto = วันที่โอนเงิน + 7 days**, editable), petty-cash account | ✅ transfer slip |
| 4. Clear | **Requester** | วันที่เคลียร์, ยอดใช้จริง, เอกสารเคลียร์, รับคืน (เบิกเพิ่ม) (**auto-calculated**), วันที่โอนเงินคืน, หมายเหตุ | ✅ receipts / return slip |
| 5. Check | Finance | Confirm, which closes the advance, or Send back with a remark, which returns it to step 4. For เบิกเพิ่ม, Finance records the date it paid the extra. | ✅ extra-payment slip |

This phase is for **local testing of the flow**. Nothing is pushed or deployed.

## 2. Decisions already made (from the user)

| # | Decision |
|---|---|
| D1 | The Finance module lives **inside menait-service** (option A). There is no separate FE repo. |
| D2 | One approval step. Requester level 1–4 → approver level 5–6. Requester level 5–6 → approver level 7–8. The approver must be in the same department, or mapped to it in `form_approver_departments`. |
| D3 | **No email or LINE notifications** for advance forms yet (the user must create an email token first). |
| D4 | The local FE and BE point at **production `ncacdb`**. New tables are additive. Test data is kept minimal and cleaned up afterwards. |
| D5 | Finance fills in the payment fields only **after** the approval is done. |
| D6 | กำหนดการเคลียร์ defaults to **วันที่โอนเงิน + 7 days**. |
| D7 | The **requester** fills in the clearing fields. Finance then **checks**: Confirm closes it, Send back returns it to the requester. |
| D8 | Files can be attached at every step (request, pay, clear, check). |

## 3. Defaults chosen by me (the user may override during review)

| # | Default | Why |
|---|---|---|
| A1 | The request document number (เลขที่เอกสาร) is the existing system `form_id`, e.g. `ADV-2026-0001`. Finance **types** the voucher number (เลขที่ใบเบิก, e.g. `SADV2607-005`) by hand when paying. | The two sample sheets use different formats. This avoids changing the shared `generate_form_id`. |
| A2 | The account code is the **petty-cash account the advance is paid from**. Finance picks it when paying. | The account list contains only petty-cash accounts, 110101–110111. |
| A3 | `รับคืน (เบิกเพิ่ม) = ยอดเงิน (paid) − ยอดใช้จริง`. It is calculated and shown read-only. A positive value is รับคืน (the employee returns money). A negative value is เบิกเพิ่ม (the company pays extra). Zero means nothing is owed. | This matches the "รับคืน (เบิกเพิ่ม)" column. |
| A4 | วันที่โอนเงินคืน is filled by the requester when รับคืน > 0 (required when they submit the clearing). When it's เบิกเพิ่ม (< 0), Finance fills the date it paid the extra when confirming. | Whoever moves the money records the date. |
| A5 | The Finance role is users in **department 4 (แผนกการเงิน) or 6 (แผนกบัญชี)**, plus an env list of extra employee IDs for testers. | Department IDs come from `GET /departments`. |
| A6 | Requesters at level 7–9 (Deputy C-level, C-level, CEO) match no rule, so they are **auto-approved** (existing engine behaviour). | Only D2's two rules were requested. |
| A7 | An employee may have several open advances at once. There is no block on overdue employees. | YAGNI. It can be added later. |
| A8 | Finance can correct payment fields until the requester submits the clearing. The requester can edit the clearing until Finance confirms it, while it is at "submitted" or "sent back". | This allows fixing typos without re-opening closed records. |

## 4. Architecture

```
Requester ─► /finance/advance/new (renderForm + file upload)
                │  POST /api/formsubmit ─► BE POST /forms/submit           (existing, form_type='Advance')
                │  POST /api/uploads3   ─► S3 mn-bucket/<base>/<form_id>/…   (existing route)
Approver ──► /mytickets "อนุมัติ" tab ─► BE /forms/{id}/approve|reject      (existing)
Requester ─► /finance/advance, /finance/advance/[form_id]  (my advances + clearing form)
Finance  ──► /finance, /finance/[form_id], /finance/accounts
                │  /api/finance/*  (new Next routes; they verify the session cookie and check owner or finance role)
                ▼
            BE /finance/*  (new router, api-ncac) ─► ncacdb: fin_accounts, fin_advances, fin_advance_logs
                                                   + reads form_submissions / values / approval logs / users
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

| column | type | step | notes |
|---|---|---|---|
| id | serial PK | | |
| submission_id | int not null **unique** FK → form_submissions.id | | |
| form_id | varchar(50) not null unique | | e.g. `ADV-2026-0001` |
| acc_code | varchar(20) FK → fin_accounts | pay | |
| voucher_no | varchar(50) | pay | เลขที่ใบเบิก |
| voucher_date | date | pay | วันที่ตั้งเบิก |
| payment_doc_no | varchar(50) | pay | เลขที่เอกสารจ่าย |
| purpose | text | pay | วัตถุประสงค์, pre-filled from the request |
| amount_paid | numeric(12,2) not null, ≥ 0 | pay | ยอดเงิน, pre-filled from จำนวนเงิน |
| transfer_date | date not null | pay | วันที่โอนเงิน |
| clear_due_date | date not null | pay | กำหนดการเคลียร์, default transfer_date + 7 |
| paid_by / paid_at | varchar(50) / timestamptz | pay | |
| clear_date | date | clear | วันที่เคลียร์ |
| amount_actual | numeric(12,2), ≥ 0 | clear | ยอดใช้จริง |
| clear_doc_no | varchar(100) | clear | เอกสารเคลียร์ |
| settle_amount | numeric(12,2) | clear | รับคืน (+) / เบิกเพิ่ม (−), computed on the server |
| settle_date | date | clear / check | วันที่โอนเงินคืน (see A4) |
| remark | text | clear | หมายเหตุ from the requester |
| clear_submitted_at | timestamptz | clear | |
| review_remark | text | check | the reason Finance gives when sending back |
| closed_by / closed_at | varchar(50) / timestamptz | check | |
| fin_status | varchar(30) not null | | `PAID` / `CLEARING_SUBMITTED` / `SENT_BACK` / `CLOSED` |
| created_at / updated_at | timestamptz default now() | | |

Indexes: `fin_status`, `clear_due_date`.

**`fin_advance_logs`**: an audit trail of money changes.

| column | type | notes |
|---|---|---|
| id | serial PK | |
| advance_id | int not null FK → fin_advances.id | |
| action | varchar(30) | `PAY` / `PAY_EDIT` / `CLEAR_SUBMIT` / `CLEAR_EDIT` / `SEND_BACK` / `CONFIRM` |
| changes | jsonb | `{field: [old, new]}` |
| remark | text | |
| action_by | varchar(50) | employee_id |
| created_at | timestamptz default now() | |

## 6. Backend (api-ncac)

### 6.1 Status model

The display status is derived as follows, in one pure function `derive_status()`:

| Condition | Status | Thai label | Whose turn |
|---|---|---|---|
| `status_approve = 'In Progress'` | PENDING_APPROVAL | รออนุมัติ | approver |
| `status_approve = 'Rejected'` | REJECTED | ไม่อนุมัติ | – (end) |
| Approved and no `fin_advances` row | AWAITING_PAYMENT | รอจ่าย | Finance |
| `fin_status = PAID` | AWAITING_CLEARING | จ่ายแล้วรอเคลียร์ (**overdue** flag if today > `clear_due_date`) | requester |
| `fin_status = SENT_BACK` | SENT_BACK | ส่งกลับแก้ไข (**overdue** flag as above) | requester |
| `fin_status = CLEARING_SUBMITTED` | AWAITING_REVIEW | รอการเงินตรวจ | Finance |
| `fin_status = CLOSED` | CLOSED | ปิดแล้ว | – (end) |

These transitions live in the pure module `services/finance/advance_logic.py`, which is unit-tested:

- **pay** (Finance):
  - Allowed at AWAITING_PAYMENT (creates the row) or AWAITING_CLEARING (a correction, logged as `PAY_EDIT`).
  - Requires `acc_code` (active), `amount_paid ≥ 0` and `transfer_date`.
  - `clear_due_date` defaults to `transfer_date + 7 days` and must be ≥ `transfer_date`.
  - Sets `fin_status = PAID`.
- **clear** (requester, i.e. `action_by` = `created_by` of the submission):
  - Allowed at AWAITING_CLEARING or SENT_BACK. Also allowed at AWAITING_REVIEW as an edit (A8).
  - Requires `clear_date` and `amount_actual ≥ 0`.
  - Computes `settle_amount = amount_paid − amount_actual`.
  - Requires `settle_date` when `settle_amount > 0`.
  - Sets `fin_status = CLEARING_SUBMITTED` and `clear_submitted_at`.
- **send_back** (Finance): allowed only at AWAITING_REVIEW. Requires `review_remark`. Sets `fin_status = SENT_BACK`.
- **confirm** (Finance):
  - Allowed only at AWAITING_REVIEW.
  - When `settle_amount < 0` (เบิกเพิ่ม), it requires `settle_date`, the date Finance paid the extra.
  - Sets `fin_status = CLOSED`, `closed_by` and `closed_at`.
- Every write takes `SELECT … FOR UPDATE` on the `fin_advances` row, or relies on the unique `submission_id` for
  the first pay, and writes one `fin_advance_logs` row with the field diff.

### 6.2 New router `routes/finance/advance_routes.py` (prefix `/finance`)

| Method | Path | Actor | Purpose |
|---|---|---|---|
| GET | `/finance/accounts?active=` | any | List accounts |
| POST | `/finance/accounts` | Finance | Create an account |
| PUT | `/finance/accounts/{acc_code}` | Finance | Update the name or active flag |
| GET | `/finance/advances?status=&overdue=&employee_id=&acc_code=&date_from=&date_to=` | Finance, or the requester (filtered by `employee_id`) | List: requester info (user, department, site), request values, fin fields, derived status |
| GET | `/finance/advances/{form_id}` | Finance or owner | Detail: request values, approval logs, the fin row and fin logs |
| PUT | `/finance/advances/{form_id}/pay` | Finance | Step 3 |
| PUT | `/finance/advances/{form_id}/clear` | owner | Step 4 |
| PUT | `/finance/advances/{form_id}/send-back` | Finance | Step 5, reject the clearing |
| PUT | `/finance/advances/{form_id}/confirm` | Finance | Step 5, close |
| GET | `/finance/summary` | Finance | Outstanding (not closed) totals by employee and by account |

- Write bodies include `action_by` (employee_id).
- The BE checks that `action_by` is the owner for `clear`.
- **Known limitation:** like every other api-ncac route today, these endpoints have no auth, so `action_by` is not
  verified by the BE. That's acceptable for local testing only. Production launch is gated on the security work
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
- Add a seed script `scripts/finance/seed_fin_accounts.py`, which is idempotent (upsert by `acc_code`) and loads
  the 11 accounts.
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
- The navbar shows "เบิกเงิน Advance" (new request and my advances) to everyone, and a "การเงิน" section when
  `is_finance` is true.

### 7.2 New Next API routes (`app/api/finance/…`)

- They proxy to `${URL_API}/finance/…` with `encodeURIComponent` on every path and query part.
- **They verify the `session-token` cookie server-side** (`verifyToken`):
  - Finance actions (pay, send-back, confirm, accounts, queue, summary) require `is_finance`.
  - `clear` and the "my advances" list use the session's own `employee_id`.
  - `action_by` is always taken from the verified session, never from the client.
- This way we don't copy the existing pattern of trusting the client.

### 7.3 Pages

| Page | Who | What |
|---|---|---|
| `/finance/advance/new` | everyone | Renders the latest Active `ADV` form with `renderForm` and uses `file-dropzone` for multi-file upload. Submits through the existing `/api/formsubmit`, then uploads each file to `/api/uploads3`. |
| `/finance/advance` | everyone | My advances: status, amounts, due date, overdue badge, "เคลียร์" button when it's my turn |
| `/finance/advance/[form_id]` | owner | Request, approval and payment info (read-only) + payment attachments. **Clearing form** (step 4) with auto-calculated รับคืน/เบิกเพิ่ม and receipt upload. Shows Finance's send-back remark. |
| `/finance` | Finance | Queue with tabs: รอจ่าย, จ่ายแล้วรอเคลียร์, เกินกำหนด, รอการเงินตรวจ, ส่งกลับแก้ไข, ปิดแล้ว, ทั้งหมด. Columns follow the current Excel sheet (ลำดับ … หมายเหตุ + บัญชี). Excel export uses the existing `xlsx` library. |
| `/finance/[form_id]` | Finance | Full detail + attachments from all steps + approval history. **Pay card** (step 3: account picker, due date auto +7, slip upload). **Check card** (step 5: Confirm / Send back with remark; for เบิกเพิ่ม, extra-payment date + slip). Change log. |
| `/finance/accounts` | Finance | Account master: list, add, edit, deactivate |

Approvals use the existing `/mytickets` approval tab. Advance forms already appear there, because the approve buttons
show for every `form_type` other than `Issue`.

### 7.4 Small shared changes

- Builder: add `Advance` to the form-type options, so an admin opening the seeded ADV form doesn't lose its
  type.
- `app/api/uploads3`:
  - Accept an optional `folder` param from the allowlist `pay` | `clear` | `check`, which produces the key
    `<base>/<form_id>/<folder>/<file>`.
  - Listing returns the folder, so the pages can group files by step.

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
  - After testing, a cleanup list of test `form_id`s (submissions, values, logs, approval logs, fin rows, S3
    objects) is shown for approval before deleting.
  - The ADV form is set to Inactive until launch.
- **Nothing is pushed.** No Render or Vercel deploy.

## 9. Out of scope (later)

- **Launch gate, which must be done before production:** auth on the api-ncac `/forms/*`, `/users/*` and `/finance/*`
  routes; auth middleware on the FE `/api/*` routes; replacing the raw-SQL `/api/form`; stopping auto-approval when
  the requester's level is unknown.
- Email and LINE for advances: request, approval, payment done, due-date reminder, sent back, closed (after the
  email token exists).
- Automatic `SADVyymm-nnn` numbering.
- A reminder job for due or overdue clearing.
- Importing historical rows from Excel.
- GL/journal posting.
- Fixing the builder bug where deleting a rule renumbers `level_no` into multiple approval steps.

## 10. Testing

- **BE unit (pytest, new `tests/finance/`):**
  - `derive_status` (every branch, including overdue for PAID and SENT_BACK)
  - pay, clear, send_back and confirm guards (wrong status, wrong actor)
  - `clear_due_date` default of +7
  - settle-amount sign cases (+, −, 0)
  - `settle_date` required when > 0 at clear, and when < 0 at confirm
- **FE:** `bun run build` and `bun run lint` pass.
- **Manual end-to-end flow on local FE (4000) + BE (8001):**
  1. A level 1–4 requester submits with 2 attachments. Their department's level 5–6 manager sees it and approves it.
  2. It appears in รอจ่าย. Finance pays with account 110103, and the due date auto-fills to +7. Finance attaches a
     slip, then it appears in จ่ายแล้วรอเคลียร์.
  3. Set the due date in the past. The advance appears in เกินกำหนด, and the requester sees an overdue badge.
  4. The requester clears with actual < paid (รับคืน > 0), so a return date is required. They attach receipts, then
     it appears in รอการเงินตรวจ.
  5. Finance sends it back with a remark. The requester sees the remark, edits and resubmits. Finance confirms,
     so it is ปิดแล้ว.
  6. Clear with actual > paid (เบิกเพิ่ม). Finance confirms with the extra-payment date and a slip, then it closes.
  7. Clear with actual = paid. Finance confirms and it closes.
  8. Reject path: the request shows ไม่อนุมัติ and never enters the Finance queue.
  9. A level 5–6 requester is routed to a level 7–8 approver.
  10. Guards: a non-owner can't clear. A non-finance user can't open `/finance` or call the finance APIs.
  11. The BE log shows no email or LINE was sent for the ADV submissions.
  12. The IT Service form still submits and approves as before (regression check).
