# Finance Payee Account Master — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** An Accounting-managed Master of employee K-Bank accounts, an in-system request flow with an email to Accounting, and a SELF/SUPPLIER payee choice on the ADV request form.

**Architecture:**
- **BE (api-ncac):** 3 tables, pure rules in `payee_logic.py`, persistence in `payee_repo.py`, routes in `payee_routes.py` (prefix `/finance`), an email via the existing `send_email`, and a hardened ADV submit guard.
- **FE (menait-service):** session-guarded proxy routes, auth'd S3 routes for bookbank files, a `PayeeAccountSection` on the request page, and a `/finance/payee-accounts` management page.

**Tech Stack:**
- **BE:** FastAPI + SQLAlchemy + Postgres. DB-free pytest: `PYTHONDONTWRITEBYTECODE=1 .venv/bin/pytest tests -q`.
- **FE:** Next.js 16.1 + bun + shadcn. Run `bun test lib`, `bunx tsc --noEmit`, `bun run build`.

**Spec:** `docs/superpowers/specs/2026-10-05-finance-payee-accounts-design.md` (the binding authority; read §1–§7).

## Global Constraints

**Repos and branches**
- BE repo is `~/Documents/project/ncac/api-ncac-finance` (branch `feat/finance-advance`, upstream origin/main). The BE is pushed only to branch `menaIT-v2`, never to `main`.
- FE repo is `~/Documents/github/menait-service`, branch `menaIT-v2`.

**Commits and safety**
- Never `git add -A`. Never commit `.pyc`, `__pycache__` or `tmp/`. Never push.
- Never start, stop or restart servers (BE :8001 and FE :4000 are running). Never touch any database. The user runs the SQL in DBeaver.

**Payee data rules**
- An employee or master account is **K-Bank** only, with **exactly 10 digits** after removing spaces and dashes. A supplier may use any of the 16 existing banks, checked by `advance_logic.check_account_no` / FE `accountNoError`.
- Log `changes` must always be `{field: [before, after]}` pairs, never scalars. The FE LogList-style renderer destructures pairs.
- Every interpolated value in the email HTML and the FE must be escaped. No `dangerouslySetInnerHTML`.

**FE**
- On the FE, `employee_id`, `action_by` and `app_origin` come from the **server session / request**, never from the browser body.
- The UI uses v2 theme tokens (`brand-*`, `mint-*`, `sun-*`). No hex teal colours in classNames.

**Exact Thai strings (use verbatim)**
- "เลขที่บัญชีกสิกรไทยต้องมี 10 หลัก"
- "กรุณาระบุชื่อบัญชี"
- "มีคำขอที่รอบัญชีตรวจสอบอยู่แล้ว"
- "คำขอนี้ไม่อยู่ในสถานะรอตรวจสอบ"
- "กรุณาระบุเหตุผลที่ไม่อนุมัติ"
- "ยังไม่มีบัญชีรับเงินที่บัญชีอนุมัติ — กรุณาขอเพิ่มบัญชีรับเงิน"
- "กรุณาเลือกบัญชีรับเงิน"
- "พนักงานนี้มีบัญชีใน Master แล้ว — กรุณาแก้ไขแทน"
- "ไม่พบรหัสพนักงาน"

## Review Focus

1. A SELF submission whose bank, account or name was tampered with in the browser must be saved with the master's values.
2. Two quick clicks on "ส่งคำขอ" must not create two PENDING requests. The partial unique index plus a 409 must hold.
3. Approving a change request for an employee who already has a master row must replace the row in place, not insert a second row. The log must show the before→after account.
4. A non-finance user calling the FE proxy for the master list, approve, or another employee's request files must get 403.
5. A failing SMTP send must not fail the request create.

---

### Task 1: BE — tables, migration SQL, pure payee rules

**Files:**
- Modify `models/finance_model.py`: add `FinPayeeAccount`, `FinPayeeAccountRequest`, `FinPayeeAccountLog` exactly per spec §2. Include the CHECKs, the UNIQUE `employee_id` on accounts, the partial unique index `uq_fin_payee_requests_one_pending ON fin_payee_account_requests (employee_id) WHERE status = 'PENDING'` (`Index(..., unique=True, postgresql_where=...)`), and `ix_fin_payee_account_logs_employee_id`.
- Create `scripts/migrations/2026-10-05_finance_payee_accounts.sql`:
  - One transaction, idempotent (`IF NOT EXISTS`, NOT EXISTS guards), DBeaver-safe.
  - Creates the 3 tables, constraints and indexes.
  - Adds the ADV question `adv_payee_type` (dropdown, required, label "บัญชีรับเงิน") with options SELF "บัญชีตัวเอง" (sort 1) and SUPPLIER "บัญชี Supplier" (sort 2) to the latest ADV form master (`form_code='ADV' AND is_latest`).
  - Sets sort_order to 5 for payee_type and 6/7/8 for `adv_bank` / `adv_account_no` / `adv_account_name`.
  - Mirror the column names and the insert pattern of `scripts/migrations/2026-09-29_finance_advance_v2.sql`; read it first.
  - End with read-only verify SELECTs.
  - Copy the file to `~/Desktop/finance_payee_accounts_ncacdb.sql`.
- Create `services/finance/payee_logic.py` (pure, no DB):
  - `PAYEE_BANK = "KBANK"`, `PAYEE_SELF = "SELF"`, `PAYEE_SUPPLIER = "SUPPLIER"`.
  - `check_kbank_account(raw) -> str` returns normalized digits. Otherwise it raises `AdvanceRuleError("เลขที่บัญชีกสิกรไทยต้องมี 10 หลัก")`.
  - `check_account_name(name) -> str` returns the stripped name, ≤150 chars. Empty raises "กรุณาระบุชื่อบัญชี".
  - `check_request_open(status)` raises `InvalidTransition("คำขอนี้ไม่อยู่ในสถานะรอตรวจสอบ")` unless status is PENDING.
  - `check_reject_remark(remark) -> str`. Empty raises "กรุณาระบุเหตุผลที่ไม่อนุมัติ".
  - `check_master_status(status)` accepts only ACTIVE or INACTIVE.
  - `diff_pairs(before: dict, after: dict) -> dict` returns `{k: [before, after]}` for changed keys only, with values made JSON-safe (str for Decimal/dates).
  - `resolve_payee(payee_type, master, submitted) -> dict`, used by the ADV guard:
    - `payee_type` None or empty raises "กรุณาเลือกบัญชีรับเงิน". An unknown value raises the same message.
    - `SELF`: when `master` is None or not ACTIVE it raises "ยังไม่มีบัญชีรับเงินที่บัญชีอนุมัติ — กรุณาขอเพิ่มบัญชีรับเงิน". Otherwise it returns `{"bank": "KBANK", "account_no": master.account_no, "account_name": master.account_name}`.
    - `SUPPLIER` returns None; the caller keeps the existing bank/account checks.
  - Reuse `advance_logic.AdvanceRuleError` / `InvalidTransition`.
- **Tests:** `tests/finance/test_payee_logic.py` covers every function, every message verbatim, and the edges: dashes or spaces in the number, 9 or 11 digits, letters, None, name of 151 chars, SELF with an INACTIVE master. Extend the existing model↔SQL parity tests (see `tests/finance/test_finance_model.py`) to the 3 new tables and the partial index.
- **Commit:** `feat(finance): payee account master tables + rules`

**Interfaces produced:** the model classes and payee_logic functions above, used by Task 2.

### Task 2: BE — repo, routes, email, ADV submit guard

**Files:**
- Create `services/finance/payee_repo.py`. It does the DB work and serialization. Reuse the people lookup that `advance_repo` already uses for name, department and position (find it; do not duplicate the SQL).
  - `serialize_account(row, people)` returns `{id, employee_id, employee_name, department, bank, account_no, account_name, status, source_request_id, created_by, created_at, updated_by, updated_by_name, updated_at}`. Timestamps are ISO strings.
  - `serialize_request(row, people, current_account)` returns `{id, employee_id, employee_name, department, position, bank, account_no, account_name, remark, status, review_remark, reviewed_by, reviewed_by_name, reviewed_at, created_at, current_account: {account_no, account_name, status} | null}`.
  - Load people for a list in one query, with no N+1.
- Create `routes/finance/payee_routes.py` with `APIRouter(prefix="/finance", tags=["Finance - Payee"])` and register it in `main.py` next to the advance router. Endpoints, with request bodies as pydantic schemas in `schemas/finance_schema.py`:

  | Method | Path | Body / params | Returns |
  |---|---|---|---|
  | GET | `/finance/payee-accounts/me` | `employee_id` | `{account: Account\|null, request: Request\|null}`, where request is the newest request of any status |
  | GET | `/finance/payee-accounts` | `q?` (name or employee id contains), `status?` | `[Account]` sorted by employee name |
  | POST | `/finance/payee-accounts` | `{employee_id, account_no, account_name, action_by}` | 201 `Account`; 404 "ไม่พบรหัสพนักงาน"; 409 "พนักงานนี้มีบัญชีใน Master แล้ว — กรุณาแก้ไขแทน"; logs CREATE |
  | PUT | `/finance/payee-accounts/{id}` | `{account_no?, account_name?, status?, action_by}` | `Account`; logs UPDATE, DEACTIVATE or REACTIVATE with pairs |
  | GET | `/finance/payee-accounts/{id}/logs` | — | `[{action, changes, remark, action_by, action_by_name, created_at}]` newest first, for that account's employee_id |
  | POST | `/finance/payee-requests` | `{employee_id, account_no, account_name, remark?, app_origin?}` | 201 `Request`; 404 unknown employee; 409 "มีคำขอที่รอบัญชีตรวจสอบอยู่แล้ว" (pre-check + IntegrityError → 409); logs REQUEST; queues the email |
  | GET | `/finance/payee-requests` | `status?` (default PENDING) | `[Request]` oldest first |
  | GET | `/finance/payee-requests/{id}` | — | `Request` |
  | PUT | `/finance/payee-requests/{id}/approve` | `{action_by}` | `{request, account}`; FOR UPDATE on the request; upserts the master row (replaces it if it exists, `source_request_id`=id, ACTIVE); logs APPROVE with account pairs |
  | PUT | `/finance/payee-requests/{id}/reject` | `{action_by, review_remark}` | `Request`; logs REQUEST_REJECT |
  | PUT | `/finance/payee-requests/{id}/cancel` | `{action_by}` | `Request`; 403 unless `action_by == employee_id`; logs REQUEST_CANCEL |
  | GET | `/finance/people/{employee_id}` | — | `{employee_id, name, department, position}` via `advance_repo.people_by_employee_id`; 404 "ไม่พบรหัสพนักงาน" (used by the Master "เพิ่มบัญชี" lookup) |

- **Email:**
  - Add `render_payee_request_email(ctx) -> (subject, html)` as a pure function in `payee_logic.py` or a new `payee_email.py`, with tests. Content per spec §4. HTML-escape every value. Format the account `xxx-x-xxxxx-x`. Build the review link as `{app_origin}/finance/payee-accounts?request={id}` only when `app_origin` matches `^https?://[A-Za-z0-9.-]+(:\d+)?$`; otherwise leave the link out.
  - Send it from the create route via FastAPI `BackgroundTasks` → `email_service.send_email(to, subject, html)`. The recipient is env `FINANCE_ACCOUNT_EMAIL`, defaulting to `accountbkk@menatransport.co.th`. Wrap the send in try/except, log the error, and never raise.
- **ADV guard:** in `routes/forms/form_submission_routes.py` `_guard_advance_values`:
  - When the form has an `adv_payee_type` question, read the submitted value and call `payee_logic.resolve_payee`, loading the master for `created_by`.
  - **SELF:** overwrite the `value_text` of the `adv_bank`, `adv_account_no` and `adv_account_name` value objects with the master's values. If any of those value objects is missing, return 400 with the same "ยังไม่มีบัญชีรับเงิน…" message, or a clear Thai message of your choosing; record which one you used in the report. Skip the bank and account format checks for SELF, since the master is already valid.
  - **SUPPLIER:** keep the existing checks unchanged.
  - The guard already runs for submit and update_form_details, so keep both paths.
- **Tests (DB-free):**
  - `render_payee_request_email`: escaping, link present or absent, account formatting.
  - `resolve_payee`: if extended.
  - Schema tests for the new bodies (account_no ≤20, account_name ≤150, remark ≤500, review_remark required for reject).
- **Commit:** `feat(finance): payee account routes, request email, SELF payee guard`

**Interfaces produced** (FE Tasks 3–5 use them exactly): the endpoint table and the JSON shapes above.

### Task 3: FE — proxy routes, auth'd bookbank file routes, helpers

**Files:**
- Next route handlers under `app/api/finance/` follow the pattern of the existing `app/api/finance/approval-preview/route.ts` and `lib/finance/server.ts` (`requireUser`, `requireFinance`, `beUrl`, `proxy`):

  | Route | Guard | BE call |
  |---|---|---|
  | `payee-accounts/me/route.ts` GET | user | BE `/me?employee_id=<session>` |
  | `payee-accounts/route.ts` GET, POST | finance | POST injects `action_by` from the session |
  | `payee-accounts/[id]/route.ts` PUT | finance | injects `action_by` |
  | `payee-accounts/[id]/logs/route.ts` GET | finance | — |
  | `payee-requests/route.ts` GET | finance | — |
  | `payee-requests/route.ts` POST | user | body `{account_no, account_name, remark}`; injects `employee_id` from the session and `app_origin = req.nextUrl.origin` |
  | `payee-requests/[id]/route.ts` GET | user | fetches from BE, returns 403 unless `employee_id === session` or finance |
  | `payee-requests/[id]/[action]/route.ts` PUT | approve/reject → finance; cancel → user (BE enforces owner) | `action` must be one of `approve`, `reject`, `cancel`, else 404; injects `action_by` |
  | `payee-requests/[id]/files/route.ts` | see below | — |
  | `people/[employee_id]/route.ts` GET | finance | BE `/finance/people/{employee_id}` |

- **The files route** uses `lib/s3` directly with prefix `${BASE_PATH}/payee-requests/{id}/`, validating `id` as `^\d+$`.
  - **GET:** owner or finance, checked by fetching the request from BE. Lists the files with presigned URLs (1 h).
  - **POST:** owner only, only while the request is PENDING. Allows `image/jpeg`, `image/png`, `image/webp`, `application/pdf`, at most 10 MB. File names are sanitized (keep `[\w.-]` plus Thai; prefix a timestamp).
  - **Never** use `/api/uploads3`.
- Create `lib/finance/payee.ts` (pure):
  - `kbankAccountError(raw): string | null` returns "เลขที่บัญชีกสิกรไทยต้องมี 10 หลัก" or null.
  - `PAYEE_SELF`, `PAYEE_SUPPLIER`.
  - `type PayeeAccount`, `type PayeeRequest` (the BE shapes).
  - `selfPayeeState(me): 'ready' | 'ready_change_pending' | 'pending' | 'rejected' | 'none'`. Rules:
    - account ACTIVE + request PENDING → `ready_change_pending`
    - account ACTIVE → `ready`
    - no ACTIVE account + request PENDING → `pending`
    - no ACTIVE account + newest request REJECTED → `rejected`
    - otherwise → `none`
  - `canSubmitPayee(type, state, supplierFileCount): boolean`.
  - Tests in `lib/finance/payee.test.ts`.
- **Commit:** `feat(finance): payee account API routes + auth'd bookbank storage`

### Task 4: FE — PayeeAccountSection on `/finance/advance/new`

**Files:**
- Create `app/finance/components/PayeeAccountSection.tsx` and `app/finance/components/RequestPayeeDialog.tsx`.
- Modify `app/finance/advance/new/page.tsx`. Read it fully first; it renders questions generically and validates `adv_account_no`.
  - Exclude `adv_payee_type`, `adv_bank`, `adv_account_no` and `adv_account_name` from the generic loop. Render `<PayeeAccountSection>` where the "บัญชีรับเงิน" divider is today.
  - The section owns the radio state: SELF by default, SUPPLIER otherwise. It writes the 4 values into the page `values` (`adv_payee_type` = SELF/SUPPLIER).
  - **SELF:** bank/account/name come from the master, shown read-only as "ธนาคารกสิกรไทย · {formatAccountNo} · {name}".
  - **SUPPLIER:** shows inputs for bank (16-bank select using `BANKS` / `bankLabel` from `lib/finance/bank.ts`), account (live `accountNoError`), and account name.
- **State UI per spec §6:**
  - `ready`
  - `ready_change_pending`
  - `pending`: shows the request details, the sent date, a **ยกเลิกคำขอ** button (with confirm) and **แนบไฟล์เพิ่ม**.
  - `rejected`: shows review_remark and a button to request again.
  - `none`: shows an amber box and **ขอเพิ่มบัญชีรับเงิน**.
  - In `ready`, offer a small "ขอเปลี่ยนบัญชี" link that opens the same dialog.
- **The dialog:**
  - Fields: K-Bank account (10 digits, live check), account name (pre-filled with the session user's full name), FilePicker (required, at least 1), remark.
  - **Submit flow:** POST the request, upload the files to `/api/finance/payee-requests/{id}/files`, refetch `/me`, then show a success alert "ส่งคำขอแล้ว รอบัญชีตรวจสอบ".
  - **If the upload fails:** warn "อัปโหลดไฟล์ไม่สำเร็จ กรุณาแนบไฟล์เพิ่มจากกล่องคำขอ". The request stays and the user re-attaches from the pending box.
  - Errors from the BE (409 etc.) are shown with `showAlert`.
- **Page submit gating:**
  - SELF and state not `ready` / `ready_change_pending`: block with a warning alert "ยังไม่มีบัญชีรับเงินที่บัญชีอนุมัติ — กรุณาขอเพิ่มบัญชีรับเงิน หรือเลือกบัญชี Supplier".
  - SUPPLIER: require at least 1 request attachment and relabel the request FilePicker "แนบ bookbank หรือใบแจ้งหนี้ที่มีเลขบัญชี *". Keep the existing account validation for SUPPLIER only.
  - The submit payload still sends the 4 values.
- Use the v2 tokens. Mobile-first: the stacked radio cards must not scroll horizontally.
- **Commit:** `feat(finance): payee account section (own account from Master / supplier) + request dialog`

### Task 5: FE — `/finance/payee-accounts` management page + nav

**Files:**
- Create `app/finance/payee-accounts/page.tsx` (Finance only, else `NoAccess`) with the `FinanceCanvas` + `FinanceHeading` (icon `Landmark`), title "บัญชีรับเงินพนักงาน" and caption "ตรวจคำขอและจัดการบัญชีรับเงิน (K-Bank) ของพนักงาน".
- Add components under `app/finance/components/payee/` as needed.
- **Tab "คำขอรอตรวจ (N)":**
  - Cards or rows show the employee (name, department), account (formatted), account name, sent date, and "เปลี่ยนจาก {current}" when `current_account` exists.
  - Clicking one opens a Sheet or Dialog with the details, the file list (GET files; open in a new tab), **อนุมัติ** (showConfirm) and **ไม่อนุมัติ** (showConfirm with a required textarea reason).
  - After an action, refetch both tabs.
  - Deep link `?request={id}` opens that request on load.
- **Tab "Master":**
  - Search box (client filter plus server `q`), and a table that becomes cards below `xl`.
  - Columns: พนักงาน (name + department) · ธนาคาร · เลขที่บัญชี · ชื่อบัญชี · สถานะ badge · แก้ไขล่าสุด (date + by).
  - **เพิ่มบัญชี dialog:** รหัสพนักงาน → on blur, `GET /api/finance/people/{employee_id}` shows the name, department and position (or "ไม่พบรหัสพนักงาน"). The dialog also takes เลขที่บัญชี K-Bank and ชื่อบัญชี (pre-filled with the person's name).
  - **แก้ไข dialog:** account and name.
  - **ปิดใช้งาน / เปิดใช้งาน** (confirm).
  - **ประวัติ dialog:** a list of logs with Thai action labels (REQUEST "ส่งคำขอ", REQUEST_CANCEL "ยกเลิกคำขอ", REQUEST_REJECT "ไม่อนุมัติคำขอ", APPROVE "อนุมัติ → Master", CREATE "เพิ่มบัญชี", UPDATE "แก้ไขบัญชี", DEACTIVATE "ปิดใช้งาน", REACTIVATE "เปิดใช้งาน") and `changes` rendered as `field: before → after`, tolerating scalars.
- **Nav:** on `app/finance/page.tsx`, add a `FinanceHeading` action link/button "บัญชีรับเงินพนักงาน" → `/finance/payee-accounts`, with a badge showing the PENDING count (GET `/api/finance/payee-requests`) when greater than 0.
- **Commit:** `feat(finance): payee accounts management page (requests review + master)`
