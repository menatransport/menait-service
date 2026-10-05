# Finance Advance v3 — Design

Date: 2026-10-05 · Status: approved in chat ("ok - let do it", after the 7-item table)
Builds on:
- v2 spec `2026-09-29-finance-advance-v2-design.md` (§3 approval tiers, §5d voucher split, §5i clearing items + Expense Claim Form)
- payee spec `2026-10-05-finance-payee-accounts-design.md`

## 1. PDF: ศูนย์ options (Part 1 + Part 2)
The ศูนย์ row keeps only **กรุงเทพ / ลาดกระบัง/ขอนแก่น / สระบุรี/ระยอง/บางปะกง**. **MDD and อื่นๆ are removed**, together with the "อื่นๆ ____" free text. A requester whose site doesn't map to one of the three (unknown or empty) gets no box ticked. `lib/finance/centers.ts` stops returning `อื่นๆ` and other-text.

## 2. Part 1 terms — clause 6 (verbatim; clauses 1–5 unchanged)
"6. กรณีมีการจ่ายเงินค่าบริการ รบกวนติดต่อทางบัญชี accountbkk@menatransport.co.th"

## 3. Clearing items without A/B
The user decided: "กรอกยอดรวมอย่างเดียว ไม่แยก VAT".

**Popup fields:** วันที่* · ทะเบียนรถ/ประเภท · ใบกำกับ/ใบเสร็จ Y/N · รายละเอียด* · **ยอดเงิน*** · หัก ณ ที่จ่าย. The popup shows **สุทธิ = ยอดเงิน − หัก ณ ที่จ่าย** live. VAT auto-fill, the "คำนวณ 7%" reset and `bTouched` are removed.

**Storage:** the BE contract and table are unchanged, so no migration. The FE sends `amount_before_vat = ยอดเงิน` and `vat_amount = 0`, and the BE computes C = A and E = C − D as today. Old rows that have VAT keep their stored values.

**Expense Claim Form (Part 2):**
- Columns are วันที่ | ทะเบียนรถและประเภท | ใบกำกับภาษี/ใบเสร็จรับเงิน Y/N* | รายละเอียด | ยอดเงิน | หัก ณ ที่จ่าย | สุทธิ.
- The ยอดเงิน column prints `total_amount` (C), which is correct for both old and new rows.
- The totals row sums ยอดเงิน, หัก ณ ที่จ่าย and สุทธิ.
- Summary, footnote, signatures and layout are unchanged.
- The `AdvanceSummary` read-only items table uses the same columns.

## 4. Document number `ADV-YYMM-NNN`
- **Scope:** new ADV submissions only, e.g. `ADV-2610-001`. Other form codes keep `{code}-{year}-{0000}`, and existing numbers never change.
- **Generation:** BE `generate_form_id` for `form_code == 'ADV'` uses a sequence key of `form_code='ADV'` with `year = int(YYMM)`, taking YYMM from Asia/Bangkok wall-clock. It keeps the existing row lock, and the number is `zfill(3)`. If a month ever goes past 999, the number simply grows to 4 digits.
- **FE:** `FORM_ID_PATTERN` becomes `/^[A-Za-z0-9_-]+-\d{4}-\d{3,}$/`. Every other form_id regex or parse in both repos is checked.
- **Display:** the Document Control "Document Ref" shows the form_id, so it follows automatically.

## 5. Two-step approval (min 1, max 2)
- **Step 1, หัวหน้าถัดไป:** `required_level = min(requester_level + 1, 9)`. Eligibility is the existing `can_approve` rule: active, not self, level ≥ required, and either level ≥ 9 (org-wide) or the same department or a mapped department.
- **Step 2, ผู้มีอำนาจตาม TOA:** `required_level = max(tier.min_level, requester_level + 1)` (today's single-step rule). It exists only if that number is **greater than** step 1's required level. The approver must be eligible **and must not be the step-1 approver of the current round**.
- **Dynamic skip:** when the step-1 approver's own level is ≥ the step-2 required level, approval completes at step 1. The log records that step 2 was satisfied.
- **Examples** (requester level 3):

  | Amount | Steps |
  |---|---|
  | 1,500 (6.7) | step 1 only, level 4 |
  | 15,000 (6.5) | step 1 level 4 → step 2 level 5 |
  | 60,000 (6.4) | step 1 level 4 → step 2 level 8 |

- **Data:** `form_submissions.current_approval_level` holds the current step (1 or 2), and `form_approval_logs.level_no` = step.
- **Approve and reject transitions:**
  - Approving step 1 when step 2 is needed and not skipped sets the level to 2 and status In Progress.
  - Otherwise approval sets status Approved.
  - A reject at either step sets Rejected.
- **`describe()` / detail `approval` / approval-preview** keep the existing keys (`clause`, `approver_label`, `required_level` = the final step's level) and add `steps: [{step, required_level, label}]`.
  - Step 1 label: "หัวหน้าระดับ {n} ขึ้นไป".
  - Step 2 label: "ระดับ {n} ขึ้นไป (ข้อ {clause} · {approver_label})".
- **Queue (`pending_for`) and tabs:** an item is listed for a user only when they are eligible for the item's **current** step. The mine/delegable tab split uses that step's lowest eligible level, the same as today's `direct_level` rule applied per step. Each item carries `step` and `total_steps`.
- **Suggested approvers (share link):** these are for the current step.
- **FE:**
  - The approvals page shows "ขั้น 1/2" or "ขั้น 2/2" per item.
  - The new-request hint shows the chain, e.g. "ขั้น 1: หัวหน้าระดับ 4 ขึ้นไป → ขั้น 2: ระดับ 5 ขึ้นไป (ข้อ 6.5 · …)", and it stays a link to the TOA dialog.
  - The detail approval panel shows both steps with who approved and when.
- **Part 1 signatures:**
  - Two steps: step-1 e-Signature → **หัวหน้าหน่วยงาน**, step-2 → **ผู้มีอำนาจอนุมัติ**.
  - One step: the stamp goes in **ผู้มีอำนาจอนุมัติ**.
  - ผู้จัดการ stays blank.
- **In-flight submissions at deploy** keep `current_approval_level = 1` and continue under these rules.

## 6. ตีกลับให้ผู้เบิกแก้ไข (replaces "ตีกลับไปตั้งเบิกใหม่")
**Who and when:** Finance (dept 4/6) can return the request from **รอตั้งเบิกทำจ่าย** (AWAITING_VOUCHER) or **รอจ่าย** (AWAITING_PAYMENT). The action is labelled "ตีกลับให้ผู้เบิกแก้ไข" and a reason is required.

**fin_status values:** add `RETURNED` (waiting for the requester) and `RESUBMITTED` (the requester sent it again) to the `fin_advances` CHECK, via migration `2026-10-05_finance_advance_v3.sql`. The user runs it in DBeaver. It is idempotent and does DROP/ADD on `ck_fin_advances_fin_status`.

**Return:**
- If the request has no fin row (approved, not yet vouchered), one is created with `fin_status = RETURNED`. An existing fin row is set to `RETURNED`, and its voucher fields are cleared.
- A `RETURN` fin log is written with the remark.
- A form_approval_logs marker `action='RETURNED', level_no=0` is written by the Finance user, so the approval history shows it.

**derive_status (new precedence):**
- `status_approve == 'In Progress'` → PENDING_APPROVAL.
- `'Rejected'` → REJECTED.
- Otherwise (Approved), map fin_status:
  - None, VOUCHER_REJECTED or RESUBMITTED → AWAITING_VOUCHER.
  - **RETURNED → RETURNED** (label "ตีกลับให้ผู้เบิกแก้ไข").
  - All others stay as today.

**Requester edits:**
- At RETURNED, the creator may edit the request: the existing ADV update path, the `_guard_advance_values` guard and the payee rules all apply.
- `PUT /finance/advances/{id}/resubmit {action_by}` (owner only, only at RETURNED) sets `status_approve = 'In Progress'`, `current_approval_level = 1` and `fin_status = 'RESUBMITTED'`, then writes a `RESUBMITTED` marker (level_no 0) and a fin log.
- The FE edit flow is **`/finance/advance/new?edit={form_id}`**. It loads the submission, pre-fills it, saves through the existing update endpoint, then calls resubmit.

**Approval rounds:**
- Approval logic considers only `form_approval_logs` rows **after the latest `RESUBMITTED` marker** (or all rows if there is none). This applies to the step-2 "different person" check and to any "already approved this step" check.
- The history UI shows every round.

**Removed and kept:**
- The FE "ตีกลับไปตั้งเบิกใหม่" button is removed.
- The BE `reject-voucher` endpoint stays for legacy but is unused.
- Existing `VOUCHER_REJECTED` rows still map to AWAITING_VOUCHER.

**Lists:** the finance queue gets a tab "ตีกลับผู้เบิก" and the requester list a tab "ต้องแก้ไข", both showing RETURNED.

**Requester detail:** a banner shows "บัญชีตีกลับให้แก้ไข: {เหตุผล}" with a button **แก้ไขและส่งใหม่**.

## 7. Email notifications — built, switched OFF
**Switch:**
- `FINANCE_EMAIL_ENABLED` (default `false`). When false, every finance email is skipped with an info log. **This includes the payee-request email to accountbkk@**, which is also switched off.
- Sender: `FINANCE_SMTP_USER` / `FINANCE_SMTP_PASSWORD`, falling back to nothing. When enabled but no credentials are set, the email is skipped with a warning.
- The send runs in the background, swallows failures, and uses `timeout=30`.

**Events and recipients:**

| Event | Recipients |
|---|---|
| ADV submitted (or resubmitted) | eligible step-1 approvers |
| Step 1 approved and step 2 needed | eligible step-2 approvers |
| Final approval | requester |
| Rejected | requester (with reason) |
| Returned to requester | requester (with reason) |
| Paid | requester (amount, transfer date, clear due date) |
| Clearing sent back | requester (with reason) |
| Closed | requester |
| Payee request | `FINANCE_ACCOUNT_EMAIL` (existing template) |

**Addresses:** taken from `users.email`. Recipients without an email are skipped.

**Templates:**
- Thai HTML in the style of the MenaIT `templates/form_*_th.html`.
- Every value is escaped.
- Each email links to `{FE_BASE_URL}` + the relevant page: approvals `?doc=` for approvers, `/finance/advance/{id}` for the requester. When `FE_BASE_URL` is unset, the email has no link.

## 8. Out of scope
- No BE auth (launch gate).
- The BE goes to branch `menaIT-v2` only.
- No LINE notifications.
