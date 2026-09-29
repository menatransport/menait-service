# Finance Advance v2 — amount-based approval, payee fields, clearing rules: Design

- **Date:** 2026-09-29
- **Status:** Draft v1, waiting for user review
- **Builds on:** `2026-09-28-finance-advance-design.md` (v1, all code done, local only)
- **Repos / branches (same as v1, still local only):**
  - FE: `menatransport/menait-service`, branch `feat/finance-advance` (head e5a6339)
  - BE: `nrk16p/api-ncac` worktree `~/Documents/project/ncac/api-ncac-finance`, branch `feat/finance-advance` (head 3ede73a)
- **DB:** Postgres `ncacdb` (production). The user runs the SQL in DBeaver, as in v1.

## 1. Goal

Three changes to the ADV (เบิกเงิน Advance) flow:

1. **Approval by amount.** Replace the v1 rule "requester level → approver level" (D2 in v1) with the company's
   authority table, clause 6 (การอนุมัติเงินทดรองจ่ายทั่วไป).
2. **Payee fields on the request.** Add ค่าใช้จ่ายรายศูนย์ (cost center) and บัญชีรับเงิน (bank, account number, account
   name) to `/finance/advance/new`. The account number is format-checked.
3. **Remove รหัสบัญชี (เงินสดย่อยที่จ่าย)** from Finance's pay form.
4. **Clearing form:** rename วันที่เคลียร์ → **วันที่ส่งเอกสารเคลียร์**, and make **แนบใบเสร็จ / สลิปคืนเงิน mandatory**.
5. **Pay-form dates:** วันที่ตั้งเบิก defaults to today and is required. วันที่โอนเงิน defaults to the request's
   วันที่ใช้เงิน. Finance date inputs display as **dd/mm/yyyy**.

Email/LINE for ADV stays **off**. v1 already gates every send path on `ADVANCE_NOTIFY_ENABLED` (default false),
so this needs no work (see §8 for the live-deploy caveat).

## 2. Decisions (from the user, 2026-09-29)

| # | Decision |
|---|---|
| E1 | Tiers follow clause 6.1–6.7 (table in §3.1). |
| E2 | The system only has position levels 1–9 (9 = Chief Executive Officer, 2 people). Policy levels 9/10/11 (DCEO/CEO/ExC) **all collapse to system level 9 for now**. The tiers are **data**, so they can be split later without a code change. |
| E3 | Approver must be **at or above the tier's level AND above the requester's level**. A higher level can always approve in place of a lower one. |
| E4 | Department scope: levels 1–8 keep the v1 rule (same department, or mapped in `form_approver_departments`). **Level 9 is company-wide**. This applies to ADV only; IT forms are untouched. |
| E5 | The approvals queue has **two tabs**: "รอฉันอนุมัติ" (I am the lowest level that can approve it) and "อนุมัติแทนได้" (someone below me can also approve it). |
| E6 | Bank is a **dropdown** (the user wrote "กรอก"; a dropdown is needed for the per-bank format check). |
| E7 | Remove the petty-cash account code from the pay form. |
| E8 | Label วันที่เคลียร์ → วันที่ส่งเอกสารเคลียร์ (the user typed "เครียร์"; the standard spelling เคลียร์ is used). |
| E9 | At least one receipt / return slip is required to submit a clearing. |

## 3. Part 1 — approval by amount

### 3.1 Tier table `fin_approval_tiers` (new)

| clause | amount_max (≤) | min_level | approver_label | sort_order |
|---|---|---|---|---|
| 6.7 | 2,000 | 2 | Asst. Sup (ระดับ 2) | 1 |
| 6.6 | 5,000 | 3 | Sup / Asst.M (ระดับ 3–4) | 2 |
| 6.5 | 20,000 | 5 | MGR / SM / DPCL (ระดับ 5–7) | 3 |
| 6.4 | 100,000 | 8 | CL (ระดับ 8) | 4 |
| 6.3 | 500,000 | 9 | DCEO (นโยบายระดับ 9) | 5 |
| 6.2 | 1,000,000 | 9 | CEO (นโยบายระดับ 10 → ระบบใช้ 9) | 6 |
| 6.1 | NULL (no cap) | 9 | ExC (นโยบายระดับ 11 → ระบบใช้ 9) | 7 |

Columns: `clause varchar(10) PK`, `amount_max numeric(14,2) NULL`, `min_level int NOT NULL CHECK (min_level BETWEEN 1 AND 20)`,
`approver_label varchar(120) NOT NULL`, `sort_order int NOT NULL`. There is no edit UI; changes are made with SQL.

**Tier lookup:** order by `sort_order`, take the first row where `amount <= amount_max` or `amount_max IS NULL`.
Boundaries are inclusive ("ไม่เกิน"): exactly 2,000.00 → 6.7, and 1,000,000.01 → 6.1.

### 3.2 Who can approve (pure logic, `services/finance/approval_logic.py`)

```
ORG_WIDE_LEVEL = 9
required_level = max(tier.min_level, min(requester_level + 1, ORG_WIDE_LEVEL))   # a future tier above 9 is kept (E2)

eligible(approver) =
      approver is Active
  and approver.employee_id != requester.employee_id
  and approver_level >= required_level
  and ( approver_level >= ORG_WIDE_LEVEL
        or approver.department_id == requester.department_id
        or approver is mapped to requester.department_id in form_approver_departments )

direct_level = the lowest approver_level among all eligible approvers
tab(approver) = "mine" if approver_level == direct_level else "delegable"
```

- A level-9 requester gets required level 9 and is approved by **another** level-9 person.
- Everything is computed **on the fly** from the current tiers, users and mappings. Nothing is snapshotted, so a tier
  edit also re-routes pending requests. This is intended.
- The pure functions take plain data (dicts), so they can be tested without a DB, like `advance_logic.py`.

### 3.3 Engine changes (ADV-only branch; IT behaviour unchanged)

A helper `is_advance(form_master)` (`form_type == 'Advance'`, from `notify_guard.ADVANCE_FORM_TYPE`) picks the branch.

| Place | Change for ADV |
|---|---|
| `POST /forms/submit` | The requester has no position level → **400** "ไม่พบระดับตำแหน่งของผู้ขอ" (v1 auto-approved). No tier configured, amount ≤ 0, or no eligible approver → 400 with a Thai message. Otherwise `status_approve='In Progress'`, `current_approval_level=1`. The guard runs before the insert, like the v1 use-date guard. |
| `POST /forms/{id}/approve` | Uses `approval_logic` instead of `get_applicable_rule_with_fallback`. Not eligible → 403. Eligible → `Approved` in one step. |
| `POST /forms/{id}/reject` | Same eligibility check as approve. |
| `GET /forms/pending-approvals` | Skips ADV submissions explicitly. ADV has its own endpoint below. |
| `PUT` form details (`update_form_details`) | ADV request values are editable only while `status_approve='In Progress'` and only by the creator (`updated_by == created_by`). Otherwise 400/403. This closes "raise the amount after approval". |
| Prod data | The 2 v1 ADV rows in `form_approval_rules` are set `is_active=false`. |

### 3.4 New BE endpoints (`routes/finance/advance_routes.py`)

- `GET /finance/approval-tiers` → the tier list (read-only).
- `GET /finance/approval-preview?employee_id=&amount=` → `{clause, approver_label, required_level}`, used for the hint
  on the new-request page. Returns 400 for a bad amount.
- `GET /finance/approvals/pending?employee_id=` → ADV `In Progress` items this user can approve. Each item has
  `form_id, submission_id, created_at, requester {employee_id, name, department}, request {purpose, amount,
  use_date, cost_center, bank, account_no, account_name}, tier {clause, approver_label, required_level}, tab`.
  Users with their levels, the mappings and the submissions with their values are **loaded once per request** (no
  N+1). This replaces the per-row `/api/formselect` enrichment on the pending view (the parked v1 Task 13 issue).

### 3.5 FE

- `/finance/advance/new`: a debounced hint under จำนวนเงิน that reads
  "ต้องอนุมัติโดย: MGR / SM / DPCL (ระดับ 5–7) ขึ้นไป — ข้อ 6.5".
- `/finance/approvals` pending view: data comes from the new endpoint. Two pill tabs, "รอฉันอนุมัติ (n)" and
  "อนุมัติแทนได้ (n)". Each row shows the amount and the clause. Approve/reject still go through `/api/tickets` →
  `/forms/{id}/approve|reject`. The history view is unchanged.
- Detail sheets (requester and Finance) show the tier clause and label.

## 4. Part 2 — payee fields on the request

### 4.1 New ADV questions (form 138, `sort_order` 4–7, all required)

| question_name | label | type | options |
|---|---|---|---|
| `adv_cost_center` | ค่าใช้จ่ายรายศูนย์ | dropdown | ศลบ, สกท, สสบ, ศรย, ศขก, ศบก (value = label) |
| `adv_bank` | ธนาคาร | dropdown | see §4.2 |
| `adv_account_no` | เลขที่บัญชี | text | – |
| `adv_account_name` | ชื่อบัญชี | text | – |

The new-request page renders a small heading "บัญชีรับเงิน" above `adv_bank`. Existing ADVs have no values for
these questions and show "-".

### 4.2 Banks and account-number format

| value | label | digits |
|---|---|---|
| BBL | ธนาคารกรุงเทพ | 10 |
| KBANK | ธนาคารกสิกรไทย | 10 |
| KTB | ธนาคารกรุงไทย | 10 |
| SCB | ธนาคารไทยพาณิชย์ | 10 |
| BAY | ธนาคารกรุงศรีอยุธยา | 10 |
| TTB | ธนาคารทหารไทยธนชาต | 10 |
| GSB | ธนาคารออมสิน | 12 |
| BAAC | ธ.ก.ส. | 12 |
| GHB | ธนาคารอาคารสงเคราะห์ | 12 |
| UOB | ธนาคารยูโอบี | 10–12 |
| CIMBT | ธนาคารซีไอเอ็มบี ไทย | 10–12 |
| LHB | ธนาคารแลนด์ แอนด์ เฮ้าส์ | 10–12 |
| KKP | ธนาคารเกียรตินาคินภัทร | 10–12 |
| TISCO | ธนาคารทิสโก้ | 10–12 |
| ICBCT | ธนาคารไอซีบีซี (ไทย) | 10–12 |
| IBANK | ธนาคารอิสลามแห่งประเทศไทย | 10–12 |

- The user may type dashes or spaces. These are stripped, and the result must be digits only with the bank's length.
  The FE validates before submit and sends the normalized digits. The BE submit guard re-checks with the same rule
  (400 "เลขที่บัญชีไม่ถูกต้อง: <bank> ต้องเป็นตัวเลข N หลัก").
- The rule lives in FE `lib/finance/bank.ts` and BE `services/finance/advance_logic.py` (next to
  `pick_request_values`), with identical tables. A test compares them, the same way v1 compared `STATUS_LABELS`.
- Display: 10 digits → `xxx-x-xxxxx-x`, otherwise the raw digits.
- ⚠️ **The per-bank lengths are an assumption. Confirm them with Finance before launch.**

### 4.3 Where the fields show

- BE `pick_request_values` adds `cost_center, bank, account_no, account_name`. List and detail responses include them.
- Finance pay panel: a "โอนเข้าบัญชี" box with bank, formatted account number (with a copy button) and account name.
- Requester and Finance detail sheets: all 4 fields.
- Finance queue: the table gets a ศูนย์ column, and the account filter is replaced by a cost-center filter.
- Excel export: the `รหัสบัญชี` column is replaced by `ศูนย์ค่าใช้จ่าย`. `ธนาคาร`, `เลขที่บัญชี` and `ชื่อบัญชี` are added.

## 5. Part 3 — remove รหัสบัญชี (เงินสดย่อยที่จ่าย)

- FE `PayForm`: remove the select and its required check. Stop sending `acc_code`.
- BE `PayIn.acc_code` becomes `Optional[str] = None`. If it is sent, it is still validated against `fin_accounts`.
- Remove the `รหัสบัญชี` navbar link. The `/finance/accounts` page and the `fin_accounts` table stay but are unused.
- `AdvanceSummary` shows บัญชี only when an old row has one.
- **No DB change.** `fin_advances.acc_code` is already nullable.

## 5b. Part 4 — clearing form (requester)

**Rename (label only).** The field and column stay `clear_date`. "วันที่ส่งเอกสารเคลียร์" replaces "วันที่เคลียร์" in:
`ClearForm` (label and its alert), `app/finance/labels.ts`, `AdvanceSummary`, the export column header (plus
`export.test.ts`), the BE message in `advance_logic.check_clear` ("กรุณาระบุวันที่ส่งเอกสารเคลียร์"), and the model comment.

**Attachment mandatory:**
- The label becomes "แนบใบเสร็จ / สลิปคืนเงิน *".
- FE check: the submit needs at least 1 new file **or** at least 1 file already in the `clear` folder. After a send-back,
  the files uploaded earlier still count.
- **Order reversed:** the files are uploaded first. If any upload fails, stop and do not send the clearing. After
  that, `PUT …/clear` runs. This fixes the v1 order, where the clearing was saved first and an upload failure
  left it with no files.
- Server-side check: before proxying, the Next route `PUT /api/finance/advances/[form_id]` (action `clear`)
  lists the S3 prefix `menait-service/{form_id}/clear/` (`MaxKeys: 1`). If it is empty, the route returns **400**
  "กรุณาแนบใบเสร็จ / สลิปคืนเงินอย่างน้อย 1 ไฟล์". api-ncac has no S3 access, so this is the enforcement point.
- A small refactor: the S3 client, bucket and base path move from `app/api/uploads3/route.ts` into `lib/s3.ts`,
  shared by uploads3 and the finance route (no behaviour change for uploads3).

**เอกสารเคลียร์ (เลขที่/รายการ) moves to Accounting** (user, 2026-09-29):
- `clear_doc_no` is filled by บัญชี at รอบัญชีตรวจ (AWAITING_REVIEW) in the ReviewPanel. It is optional and prefilled
  with the stored value, and it is saved with "ยืนยันปิดรายการ" (`ConfirmIn.clear_doc_no`, logged in CONFIRM changes).
- The requester's ClearForm no longer shows it. `PUT …/clear` no longer writes `clear_doc_no`, so a resubmission
  after a send-back never wipes Accounting's value. The ClearIn field is ignored for compatibility.

## 5c. Part 5 — วันที่ตั้งเบิก and date inputs

- **วันที่ตั้งเบิก** (`voucher_date`, pay form) **defaults to today** (Bangkok) on a new payment and becomes required
  (`*`). When Finance edits an existing payment, the saved value is kept.
- **วันที่โอนเงิน** (`transfer_date`, already required) **defaults to the request's วันที่ใช้เงิน** (`request.use_date`)
  on a new payment. กำหนดการเคลียร์ therefore starts at use date + 7, through the existing auto rule. Finance can
  change either date. When editing, the saved values are kept. `use_date` arrives as a datetime
  (`2026-10-01T00:00:00+00:00`), so it is converted to a Bangkok `YYYY-MM-DD` before prefilling.
- **ยอดเงิน (บาท) \*** defaults to the requested amount (`request.amount`), and วัตถุประสงค์ to the requested purpose.
  **Both already work in v1** (`PayForm` initial state) and are kept. Verified 2026-09-29: the BE returns
  `request.amount`, e.g. ADV-2026-9001 → 3000.
- **Shown as `dd/mm/yyyy`** (Christian year). Today every finance date input is a native `<input type="date">`, whose
  format depends on the browser locale (often mm/dd/yyyy). A shared `app/finance/components/DateField.tsx`
  (Popover + Calendar, the same pieces `renderForm` uses) shows `dd/mm/yyyy` and still stores `YYYY-MM-DD`.
- It is used for **all 6 finance date inputs** so the forms are consistent: PayForm (วันที่ตั้งเบิก, วันที่โอนเงิน,
  กำหนดการเคลียร์), ClearForm (วันที่ส่งเอกสารเคลียร์, วันที่โอนเงินคืน) and ReviewPanel (the extra-payment date).
  The existing min-date rules (due ≥ transfer) are unchanged.
- BE: `PayIn.voucher_date` becomes required (`date`, not `Optional`). Existing rows are untouched.

## 5d. Part 6 — split payment into ตั้งเบิกทำจ่าย → จ่ายเงิน (user request 2026-09-29)

| Status (new order) | Label | Who acts | Fields |
|---|---|---|---|
| Approved, no fin row | **รอตั้งเบิกทำจ่าย** (`AWAITING_VOUCHER`, new) | บัญชี / การเงิน | เลขที่ใบเบิก, วันที่ตั้งเบิก * (default today) |
| fin_status `VOUCHERED` (new) | **รอจ่าย** (`AWAITING_PAYMENT`) | บัญชี / การเงิน | เลขที่เอกสารจ่าย, ยอดเงิน *, วันที่โอนเงิน *, กำหนดการเคลียร์, วัตถุประสงค์, สลิปโอน |
| fin_status `PAID` | จ่ายแล้วรอเคลียร์ (unchanged) | requester | … |

- **Label rename** (user, 2026-09-29): AWAITING_REVIEW is shown as **รอบัญชีตรวจ** (was รอการเงินตรวจ). This applies
  to the BE/FE STATUS_LABELS, the list tabs and the post-clearing alert.
- **No role split** (user decision): everyone with `is_finance` (depts 4 Finance and 6 Accounting, plus local 11) can do both steps.
- No รหัสบัญชี in either step (still removed, as in §5).
- **Data:** `PUT /finance/advances/{id}/voucher` creates the `fin_advances` row with `fin_status='VOUCHERED'`. The
  pay columns are empty until payment, so `amount_paid`, `transfer_date` and `clear_due_date` become **nullable**,
  and the fin_status CHECK gains `'VOUCHERED'`. These ALTERs go into the same v2 SQL.
- **One step at a time** (user, 2026-09-29): the detail page shows only the current step's form. รอตั้งเบิกทำจ่าย shows
  `VoucherForm`. รอจ่าย shows `PayForm`, with the voucher data read-only in the summary. จ่ายแล้วรอเคลียร์ shows the
  pay-edit form as in v1. The first save logs `VOUCHER`. The BE still accepts a voucher edit (`VOUCHER_EDIT`) in
  รอจ่าย and จ่ายแล้วรอเคลียร์, but the UI does not offer it.
- **Pay:** `PUT …/pay` is allowed only on a `VOUCHERED` row (create → `PAID`, log `PAY`) or in จ่ายแล้วรอเคลียร์
  (edit, `PAY_EDIT`). Paying with no voucher → 409. `voucher_no`/`voucher_date` leave `PayIn`.
- **The outstanding summary** counts only paid advances (a voucher row with no payment is not outstanding money).
- **FE:** new status in `AdvanceStatus`, labels and styles. The finance queue gets a "รอตั้งเบิก" tab before
  "รอจ่าย"; the requester's "รอจ่าย" tab also matches `AWAITING_VOUCHER`. The detail page shows a
  `VoucherForm` (ตั้งเบิกทำจ่าย) and then `PayForm` (จ่ายเงิน, no voucher fields). `PayForm`'s `is_edit` becomes
  `status === 'AWAITING_CLEARING'`.

## 5e. Part 7 — print ใบคำขอเบิกเงินล่วงหน้า (Cash Advance Request form) (user request 2026-09-29)

- **Who and when:** a "พิมพ์ใบคำขอเบิก" button on both the Finance detail and the requester's detail. It shows for
  statuses รอตั้งเบิกทำจ่าย and later (AWAITING_VOUCHER, AWAITING_PAYMENT, AWAITING_CLEARING, SENT_BACK,
  AWAITING_REVIEW, CLOSED). AWAITING_VOUCHER was added at the user's request on 2026-09-29, from the detail side sheet.
- **How:** like the NC form (mena-safety-ncac `lib/printDocument.ts`). An HTML string opens in a new window and
  `window.print()` runs, so the browser saves an A4 portrait PDF. The browser does the Thai shaping, with Sarabun
  from Google Fonts, and printing waits for `document.fonts.ready`.
- **Generator input:** JSON, exactly the user's schema: `request_date`, `employee{name, employee_id, position,
  department, bank_account_no, bank_name, account_name}`, `centers[]`, `center_other_text`, `items[{description,
  amount}]`, `disbursement_round`, `use_date`, `additional_details`, `signatures{requester, unit_head, manager,
  approver: {name, date}}`.
- **Validation:** at most 4 items, every amount > 0, total = the sum of the items.
- **Layout (verbatim from the user):**
  - **Header:** logo top-left; a bordered box top-right reading "เริ่มใช้ 1 Nov 22"; centered title
    "ใบคำขอเบิกเงินล่วงหน้า" and bold subtitle "(Cash Advance Request form)"; a horizontal rule; right-aligned
    "วันที่ 13-ส.ค.-26" (day, Thai month abbreviation, 2-digit year).
  - **ส่วนที่ 1 ข้อมูลพนักงานผู้เบิกเงิน:** two-column underlined label/value pairs; then a row of ศูนย์ checkboxes
    (กรุงเทพ, ลาดกระบัง/ขอนแก่น, สระบุรี/ระยอง, MDD, อื่นๆ ____), where more than one can be ticked.
  - **ส่วนที่ 2:**
    - "วัตถุประสงค์ในการเบิกเงินล่วงหน้า :" with 4 numbered lines and a boxed "(บาท)" column.
    - "จำนวนเงินรวม" in a box, with the format 5,000.00.
    - "จำนวนเงิน (ตัวอักษร)" in italics, using the Thai baht-text function, which handles satang (Excel BAHTTEXT
      rules).
    - "รอบการเบิกเงิน" and "วันที่จะมีการใช้เงิน" as d/m/yyyy.
    - "รายละเอียดเพิ่มเติม" with 2 lines.
  - **ส่วนที่ 3 เงื่อนไขและข้อตกลง:** the 5 static clauses, reproduced exactly.
  - **ส่วนที่ 4 ลงนามและอนุมัติ:** a 4-column bordered table (ผู้ขอเบิก | หัวหน้าหน่วยงาน | ผู้จัดการ |
    ผู้มีอำนาจอนุมัติ), with signature space and "ชื่อ ____ / วันที่ ____", prefilled when known.
  - **Footer:** "Page 1" bottom-right.
- **Mapping from an ADV:**
  - request_date = the submission date (Bangkok).
  - employee = requester, including position from `position_name_th` (the BE adds `requester.position`).
  - bank_name = the bank label without the "ธนาคาร" prefix; account number formatted.
  - items = one line: the purpose plus the requested amount.
  - disbursement_round = transfer_date, else voucher_date.
  - use_date = the request's use date.
  - Signatures: requester = requester name + request date; approver = the APPROVED actor + date. The other two are blank.
- **ศูนย์ checkbox mapping (assumption, adjust if wrong):**
  - สกท → กรุงเทพ
  - ศลบ, ศขก → ลาดกระบัง/ขอนแก่น
  - สสบ, ศรย → สระบุรี/ระยอง
  - ศบก → อื่นๆ "บางปะกง"
  - MDD is never auto-ticked.
- **Test:** generate a sample PDF from the example JSON. A bun test renders the HTML with headless Chrome when it
  is available (skipped otherwise), writes `tmp/cash-advance-sample.pdf`, and asserts that the file starts with `%PDF`.

## 6. Migration `scripts/migrations/2026-09-29_finance_advance_v2.sql` (user runs it in DBeaver)

One transaction, idempotent, with no `DO $$` blocks (DBeaver-safe, as in v1):

1. `CREATE TABLE IF NOT EXISTS fin_approval_tiers …` and seed the 7 rows (`ON CONFLICT (clause) DO NOTHING`).
2. `UPDATE form_approval_rules SET is_active=false WHERE form_master_id = (SELECT id FROM form_masters WHERE form_code='ADV' AND is_latest)`.
3. Insert the 4 questions into ADV (`WHERE NOT EXISTS` per `question_name`), plus the options for the 2 dropdowns.
4. Read-only verify SELECTs after `COMMIT`.

The BE model `FinApprovalTier` matches the SQL. **Order:** run the SQL before starting the new BE. If the tier table
is empty, ADV submit returns 400 "ยังไม่ได้ตั้งค่าวงเงินอนุมัติ" (it never auto-approves).

## 7. Testing

- **BE, DB-free (pytest):** tier lookup (boundaries 2,000 / 2,000.01 / 1,000,000 / 1,000,000.01), required_level
  (requester above the tier, level-9 requester), eligibility (same dept, mapped, org-wide 9, self excluded),
  tab assignment, account-number rule. Also a model ↔ SQL parity check for `fin_approval_tiers`.
- **FE (bun test):** `bank.ts` normalize/validate/format, BE↔FE bank-table parity, export columns (renamed
  clear-date header, `ศูนย์ค่าใช้จ่าย` plus 3 payee columns, no `รหัสบัญชี`).
- **Local smoke against ncacdb (with the user):** preview endpoint per tier; submit with a bad account number → 400;
  pending endpoint for 670108 (L5) shows tabs; approve by an ineligible user → 403; pay without `acc_code` → 200;
  clearing with no attachment → 400 from the Next route; clearing with 1 slip → OK.
  Uses the v1 mock data flow (`mock_advance_test_data.sql`), with cleanup afterwards.

## 8. Out of scope / carried over

- Auth on FE `/api/*` and BE routes, the `/api/form` raw SQL and uploads3 ownership remain on the v1 **launch gate**.
  Note that `employee_id` is still client-supplied, so the approval checks are only as strong as that gate.
- HR adding levels 10/11 (then only the `fin_approval_tiers` rows change).
- An edit UI for tiers. Prefilling the payee account from the requester's last ADV.
- **Live-deploy caveat:** Render still runs `main`, which has no ADV email guard and none of this code. Form ADV is
  `Active` in prod, so an ADV submitted through the live system today would email and LINE. This is resolved when
  the branch is deployed.
