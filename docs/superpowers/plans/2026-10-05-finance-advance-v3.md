# Finance Advance v3 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Ship the 7 approved v3 changes, plus the final-review security fix I1 on `/api/formsubmit`.

**Architecture:**
- BE (api-ncac) has three sequential tasks: approval chain and doc number → return/resubmit → emails.
- FE (menait-service) has four sequential tasks: formsubmit auth → print and items → approval UI → return UI.
- The two tracks run in parallel because they live in separate repos.

**Tech Stack:**
- BE: FastAPI and SQLAlchemy. Run the DB-free tests with `PYTHONDONTWRITEBYTECODE=1 .venv/bin/pytest tests -q`.
- FE: Next.js 16.1 and bun. Verify with `bun test lib`, `bunx tsc --noEmit` and `bun run build`.

**Spec:** `docs/superpowers/specs/2026-10-05-finance-advance-v3-design.md`. It is binding; read it all.

## Global Constraints

**Repos and git**
- BE repo: `~/Documents/project/ncac/api-ncac-finance`, branch `feat/finance-advance`. Push only to `menaIT-v2` (the controller does this, never `main`).
- FE repo: `~/Documents/github/menait-service`, branch `menaIT-v2`.
- Never `git add -A`. Never commit `.pyc`, `__pycache__` or `tmp/`. Never push.

**Running environment**
- Never start, stop or restart servers: BE :8001 runs against PROD and FE :4000 is the dev server.
- Never touch any DB. The user runs the SQL in DBeaver.

**Data rules**
- `status_approve` is limited to `'In Progress' | 'Approved' | 'Rejected'` by a prod CHECK, so never add values.
- `form_approval_logs.action` has no CHECK. The new markers `RETURNED` and `RESUBMITTED` use `level_no = 0`.
- Log `changes` are always `{field: [before, after]}` pairs.

**UI and copy**
- Escape everything in HTML and email output. No `dangerouslySetInnerHTML`.
- Use v2 theme tokens only, with no hex teal.
- Use these Thai strings verbatim:
  - "ตีกลับให้ผู้เบิกแก้ไข"
  - "แก้ไขและส่งใหม่"
  - "ตีกลับผู้เบิก"
  - "ต้องแก้ไข"
  - "หัวหน้าระดับ {n} ขึ้นไป"
  - "ระดับ {n} ขึ้นไป (ข้อ {clause} · {approver_label})"
  - "กรุณาระบุเหตุผลที่ตีกลับ"
  - "6. กรณีมีการจ่ายเงินค่าบริการ รบกวนติดต่อทางบัญชี accountbkk@menatransport.co.th"

## Review Focus
1. Two-step approval:
   - A level-5 requester asking for 15,000 must need step 1 at level 6. Step 2 at level 6 is not needed: `max(5, 6) = 6`, which is not > 6, so this is one step.
   - The step-1 approver can never also approve step 2.
   - The dynamic skip completes the approval at step 1 when the approver's level is ≥ step 2's level.
2. After a return and resubmit, the round-1 logs never satisfy round-2 checks. The step-2 "different person" check only looks at current-round logs.
3. A requester can edit their request **only** at In Progress or RETURNED. At RETURNED the payee SELF guard still overwrites the account.
4. When `FINANCE_EMAIL_ENABLED` is unset or false, no SMTP connection is ever opened, including for the payee email.
5. A forged `/api/formsubmit` PUT, whether unauthenticated or using another user's id, can no longer edit an ADV.

---

### Task V1 (BE): ADV-YYMM-NNN + two-step approval

**Doc number**
- In `routes/forms/form_submission_routes.py` `generate_form_id`, when `form_code == 'ADV'`:
  - Use `yymm = int(now_bkk.strftime('%y%m'))` as the sequence `year` key.
  - Format the id as `f"ADV-{yymm:04d}-{n:03d}"`.
- Other codes are unchanged. Test both.

**Approval logic** (`services/finance/approval_logic.py`, pure)
- Add `plan_steps(requester_level, tier) -> list[dict]`:
  - Returns `[{step:1, required_level:min(req+1,9), label}]`.
  - Appends `{step:2, required_level:max(tier.min_level, req+1), label}` only when that level is greater than step 1's.
  - Labels follow the spec §5 strings.
- Add `next_after_approval(steps, current_step, approver_level) -> ('approved'|'step', next_step)`. The dynamic skip lives here.
- Extend `evaluate` / `can_approve` so they work per step's `required_level`.
- Add `excluded_approver` so step 2 cannot be approved by the employee who approved step 1 in the current round.
- Test the spec examples, the Review Focus 1 example, level 9 requesters, and the skip.

**Approval repo** (`services/finance/approval_repo.py`)
- `describe()` returns its existing keys plus `steps`.
- `can_approve_submission` uses the submission's current step plus the excluded step-1 approver from the current round.
- `pending_for` lists only items whose current step this user can approve. Each item carries `step` and `total_steps`, and the mine/delegable tab is computed per step.
- `suggested_approvers` covers the current step.
- Add the helper `current_round_logs(db, submission_id)`. It returns logs after the latest `RESUBMITTED` marker, or all logs when there is no marker.

**Approve route** (ADV branch in `routes/forms/form_approval_routes.py`)
- Approve:
  - Writes a log with `level_no = current step`.
  - Asks `next_after_approval` whether to finish (`Approved`) or move on (`current_approval_level = 2`, stays In Progress).
- Reject at any step → Rejected.

**Detail** (`advance_routes` serializer)
- `approval` gains:
  - `steps`.
  - `current_step`.
  - `step_approvals: [{step, employee_id, name, action_at}]` for the current round.

**Commit:** `feat(finance): ADV-YYMM-NNN doc number + two-step approval (หัวหน้าถัดไป → TOA)`.

### Task V2 (BE): return to requester + resubmit + migration v3 + payee_type in request

**Migration** `scripts/migrations/2026-10-05_finance_advance_v3.sql`
- Runs in one transaction and is idempotent.
- Does DROP/ADD on `ck_fin_advances_fin_status`, with the list: VOUCHERED, VOUCHER_REJECTED, RETURNED, RESUBMITTED, PAID, CLEARING_SUBMITTED, SENT_BACK, CLOSED.
- Ends with verify SELECTs.
- Copy it to `~/Desktop/finance_advance_v3_ncacdb.sql`.
- Update the model CHECK and parity tests to match.

**advance_logic**
- Add the `RETURNED` status and its label "ตีกลับให้ผู้เบิกแก้ไข".
- Change the `derive_status` precedence per spec §6, and test every combination.
- `check_return(status, remark)`: allowed only at AWAITING_VOUCHER and AWAITING_PAYMENT. The remark is required: "กรุณาระบุเหตุผลที่ตีกลับ".
- `check_resubmit(status, is_owner)`: only at RETURNED, by the owner.

**Routes** (`advance_routes.py`)
- `PUT /finance/advances/{id}/return {action_by, remark}`:
  - Requires `require_finance`.
  - Locks the row FOR UPDATE.
  - Creates or updates the fin row to RETURNED and clears the voucher fields.
  - Writes a fin log `RETURN` with pairs, plus a form_approval_logs marker `RETURNED` (level_no 0, action_by = the finance user's users.id, the same as other approval logs).
- `PUT /finance/advances/{id}/resubmit {action_by}`:
  - Owner only, at RETURNED only.
  - Sets `status_approve = 'In Progress'`, `current_approval_level = 1` and `fin_status = 'RESUBMITTED'`.
  - Writes a marker `RESUBMITTED` (level_no 0, requester users.id) and a fin log.

**ADV edit lock** (`form_submission_routes.update_form_details`)
- Allow the creator to edit at In Progress (as today) **or** when the derived status is RETURNED.
- Keep the guard and the duplicate-row check.

**`_REQUEST_FIELDS`**
- Add `payee_type` from `adv_payee_type`, so Finance can see SELF or SUPPLIER.
- The detail `request` gains `payee_type`.

**Tests:** cover all of the above, including round-scoped logs.

**Commit:** `feat(finance): return to requester (RETURNED) + resubmit → re-approval`.

### Task V3 (BE): finance email notifications behind `FINANCE_EMAIL_ENABLED`

**Sender** — new `services/finance/finance_mail.py`:
- `send_finance_email(to, subject, html)` checks the `FINANCE_EMAIL_ENABLED` flag. When it is false, it returns without opening a connection and logs info.
- It uses `FINANCE_SMTP_USER` / `FINANCE_SMTP_PASSWORD` (gmail SMTP, same host as the existing service). Without credentials it skips and logs a warning.
- It uses `timeout=30` and swallows every exception.

**Templates:** pure render functions for each event in spec §7. They escape all values and build the link from `FE_BASE_URL` only when it matches `^https?://[A-Za-z0-9.-]+(:[0-9]+)?$`.

**Wiring:** hook every event through FastAPI `BackgroundTasks`.
- Submit and resubmit go out from the form submission route only for ADV forms; resubmit also from the resubmit route.
- Approval steps and reject go out from the approval route.
- Return, pay, send-back and confirm go out from `advance_routes`.
- The payee request goes out from `payee_routes`: switch its send to `send_finance_email`.
- Recipients are `users.email` of the eligible approvers or the requester. Skip anyone without an email.

**Tests:** flag off means `smtplib` is never called (patch `smtplib.SMTP`). Also test the renders, the recipients selection and escaping.

**Commit:** `feat(finance): finance email notifications (off by default, FINANCE_EMAIL_ENABLED)`.

### Task V0 (FE): `/api/formsubmit` auth (final-review I1)

- `app/api/formsubmit/route.ts` POST/PUT and `app/api/formsubmit-log/route.ts` GET require `requireUser` (401 when there is no session).
- When the target form is ADV (`form_code` or a form_id starting with `ADV-`), force `created_by` / `updated_by` from the session and ignore the browser values.
- Read both routes fully and keep IT-form behaviour, except for the session requirement.
- Check that the IT pages always run with a session; they do, since they are behind login.

**Commit:** `fix(security): /api/formsubmit requires a session; ADV ids come from the session`.

### Task V4 (FE): PDF centers, clause 6, clearing items without A/B, FORM_ID_PATTERN

- **Centers:** `lib/finance/centers.ts` and both prints show only 3 ศูนย์ options, with no MDD, no อื่นๆ and no other-text. Update the tests.
- **Clause 6:** add it verbatim to Part 1 (`lib/finance/cashAdvanceForm.ts` CLAUSES).
- **Clearing items** (spec §3):
  - `ClearItemDialog` shows ยอดเงิน* and หัก ณ ที่จ่าย, with live สุทธิ. Remove VAT, `vat7` usage and `bTouched`.
  - The submit sends `amount_before_vat = ยอดเงิน, vat_amount = 0`.
  - Prefill from old rows reads `total_amount` as ยอดเงิน.
  - Adapt the `lib/finance/clearItems.ts` helpers and messages ("ยอดเงิน").
  - The Part 2 print (`lib/finance/clearingForm.ts`) has 7 columns and the totals described in spec §3.
  - The `AdvanceSummary` items table uses the same columns.
  - Update the tests.
- **`FORM_ID_PATTERN`** in `lib/s3.ts` becomes `/^[A-Za-z0-9_-]+-\d{4}-\d{3,}$/`. Grep both repos' FE for other form_id patterns. Add a test file `lib/s3.test.ts` covering `ADV-2610-001`, `ADV-2026-0004` and `IT-2026-0012`.
- **Sample:** render a Part 2 sample PNG (pattern: `tmp/esign-demo.ts` plus Chrome headless + pdftoppm) and confirm 7 columns on one landscape page.

**Commit:** `feat(finance): v3 print + clearing items (no VAT split) + 3-digit doc ref pattern`.

### Task V5 (FE): two-step approval UI

**Types:** `app/finance/types.ts` gains `approval.steps`, `current_step` and `step_approvals`. Pending items gain `step` and `total_steps`.

**Approvals page**
- Show "ขั้น {step}/{total_steps}" per item. Deep links are unchanged.

**New-request hint:** show the chain, e.g. "ขั้น 1: หัวหน้าระดับ 4 ขึ้นไป → ขั้น 2: ระดับ 5 ขึ้นไป (ข้อ 6.5 · …)". It is still the TOA dialog link. The TOA dialog note explains both steps.

**Detail approval panel:** show each step with its approver and time, or "รอ".

**Share link:** shows suggested approvers for the current step. ShareApprovalLink already uses the BE list.

**Part 1 print:** `toCashAdvanceData` and the signature mapping:
- With two steps, the step-1 stamp goes in หัวหน้าหน่วยงาน and the step-2 stamp in ผู้มีอำนาจอนุมัติ.
- With one step, the stamp goes in ผู้มีอำนาจอนุมัติ.
- Update the tests and the sample render.

**Commit:** `feat(finance): two-step approval UI + Part 1 signature mapping`.

### Task V6 (FE): return to requester UI + payee type badge

**Finance side**
- Replace "ตีกลับไปตั้งเบิกใหม่" with **ตีกลับให้ผู้เบิกแก้ไข**, available at AWAITING_VOUCHER (VoucherForm area) and AWAITING_PAYMENT (PayForm area).
- The action opens showConfirm with a required textarea reason and calls `PUT /api/finance/advances/{id}/return`. Add the proxy route, guarded with requireFinance and with `action_by` taken from the session.

**Labels**
- Status RETURNED gets the label, a StatusBadge style (amber) and an icon.
- The finance list gets a tab "ตีกลับผู้เบิก"; the requester list gets "ต้องแก้ไข".

**Requester side**
- The detail page shows a banner "บัญชีตีกลับให้แก้ไข: {เหตุผล}", taken from the latest RETURN log remark, with the button **แก้ไขและส่งใหม่** linking to `/finance/advance/new?edit={form_id}`.
- In edit mode, the new page:
  - loads the submission (`/api/formsubmit` GET of the submission values; find the existing reader) and prefills every field, including the payee section;
  - saves via the existing update (PUT `/api/formsubmit`);
  - then calls `PUT /api/finance/advances/{id}/resubmit` (proxy route, requireUser, `action_by` from the session);
  - redirects to the detail page with success "ส่งคำขอใหม่แล้ว รออนุมัติ".
- Attachments: the existing request files are listed, and new files are added to the same form_id.

**Payee type badge:** Voucher, Pay and AdvanceSummary show a badge "บัญชีตัวเอง" or "บัญชี Supplier" from `request.payee_type`. For SUPPLIER, add a hint "ตรวจ bookbank/ใบแจ้งหนี้ในไฟล์แนบ".

**Commit:** `feat(finance): return to requester + edit & resubmit + payee type badge`.
