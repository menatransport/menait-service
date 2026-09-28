# Finance Advance Cash (เบิกเงิน Advance): Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Finance "advance cash" module to menait-service (FE) and api-ncac (BE). It covers request → one-step
approval → Finance pays → requester clears → Finance checks and closes, with file attachments at every step. It is
tested locally against production `ncacdb`.

**Architecture:**
- The request and approval reuse the existing forms engine: an `ADV` form with `form_type='Advance'`, submitted through
  `/forms/submit` and approved through `/forms/{id}/approve`.
- Finance data lives in three new tables (`fin_accounts`, `fin_advances`, `fin_advance_logs`), served by a new
  api-ncac router `/finance/*`. The status is derived from the approval state plus `fin_advances.fin_status`.
- The FE adds `/finance/*` pages and `/api/finance/*` proxy routes. The proxy routes verify the session cookie and take
  `action_by` from the session.
- The only change to shared BE routes is a notification guard, so Advance forms send no email or LINE.

**Tech Stack:**
- BE: FastAPI, SQLAlchemy 2, Pydantic v2, psycopg2, pytest (new, dev-only).
- FE: Next.js 16 (App Router, Turbopack), React 19, TypeScript, Tailwind v4, shadcn/ui, `bun test` for pure helpers,
  `xlsx` (already a dependency).

**Spec:** `docs/superpowers/specs/2026-09-28-finance-advance-design.md` (in menait-service, branch `feat/finance-advance`)

**Refinements to the spec, found while reading the code:**
1. Tables and seed data (accounts, ADV form, rules) ship as **one idempotent SQL migration**,
   `scripts/migrations/2026-09-28_finance_advance.sql`, run with the repo's existing `run_migration.py` (it supports
   `--dry-run`). This replaces the two Python seed scripts in the spec. It is the repo's established pattern.
2. `adv_use_date` uses question type **`datetime`**, not `date`. `components/renderForm.tsx` renders `datetime` as a
   date-picker but has no `date` case.
3. `fin_advances.form_id` is `varchar(80)`, to match `form_submissions.form_id`.

## Global Constraints

- **Repos and branches:**
  - FE: `~/Documents/github/menait-service`, branch `feat/finance-advance`. It already exists and has the spec commits.
  - BE: a **new git worktree** at `~/Documents/project/ncac/api-ncac-finance`, branch `feat/finance-advance`, created
    from `origin/main`. **Never** edit `~/Documents/project/ncac/api-ncac` (the main checkout is shared with other
    sessions).
- **Git:** run `git pull` before committing. Commit locally only. **Never `git push`.** No Render or Vercel deploy.
  Every commit message ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **The database is PRODUCTION `ncacdb`** (DigitalOcean, `max_connections = 25` for the whole cluster).
  - Any statement that writes to it (migration, seed, test-data cleanup) runs **only after the user approves the exact
    SQL** shown in the conversation.
  - The local BE uses `DB_POOL_SIZE=1`, `DB_MAX_OVERFLOW=1`.
- **Notifications:**
  - The local BE `.env` must **not** contain `SMTP_USER`, `SMTP_PASSWORD` or `LINE_TOKEN`.
  - `ADVANCE_NOTIFY_ENABLED` must be unset or `false`.
- **Form identifiers:**
  - form_type string: `Advance`.
  - form_code: `ADV`.
  - Question names: `adv_purpose`, `adv_amount`, `adv_use_date`.
- **Clearing due date:** the default is `transfer_date + 7 days` (`CLEAR_DUE_DAYS = 7`).
- **Status codes and Thai labels** (identical in BE and FE):

  | Code | Label |
  |---|---|
  | PENDING_APPROVAL | รออนุมัติ |
  | REJECTED | ไม่อนุมัติ |
  | AWAITING_PAYMENT | รอจ่าย |
  | AWAITING_CLEARING | จ่ายแล้วรอเคลียร์ |
  | SENT_BACK | ส่งกลับแก้ไข |
  | AWAITING_REVIEW | รอการเงินตรวจ |
  | CLOSED | ปิดแล้ว |

- **`fin_status` values:** `PAID`, `CLEARING_SUBMITTED`, `SENT_BACK`, `CLOSED`.
- **Finance role:** `department_id ∈ FINANCE_DEPARTMENT_IDS` (default `4,6`) or
  `employee_id ∈ FINANCE_EMPLOYEE_IDS`.
- **Settlement:** `settle_amount = amount_paid − amount_actual`. A value > 0 is รับคืน (the requester's return date is
  required at clear). A value < 0 is เบิกเพิ่ม (Finance's payout date is required at confirm).
- **Ports:** FE dev on **4000** (`bun --bun next dev -p 4000`; the Google OAuth callback is registered for 4000). BE on
  **8001**.
- **`bun run lint` is broken** on Next 16 (`next lint` was removed). FE verification is `bunx tsc --noEmit`,
  `bun test lib/finance` and `bun run build`.

## Review Focus

1. **Amount typed with commas or blank:**
   - `"1,000.50"` must parse to `1000.5`.
   - Blank must count as "missing", not `0`.
   - More than 2 decimals must be rounded before sending, or pydantic rejects it with 422.
   - Pinned by `parseAmount` tests in Task 7.
2. **Date boundaries and timezone:**
   - A due date on the last day is **not** overdue. It becomes overdue the next day, in Bangkok time.
   - `+7` must cross month ends correctly.
   - A date-only string like `2026-07-09` must never shift a day when formatted.
   - Pinned by the `derive_status` and `default_due_date` tests in Task 1, and the `addDays` and `formatDate` tests in
     Task 7.
3. **Double submit or two Finance users paying the same advance:**
   - The first pay creates the row. The second must get HTTP 409 with a Thai message, not a 500 error.
   - Buttons disable while saving.
   - Pinned by the `check_pay` status tests in Task 1 and the IntegrityError→409 mapping in Task 5, and exercised in
     the Task 12 E2E step 10.
4. **Someone who is not the owner, or not in Finance:**
   - They must not be able to view another person's advance, clear someone else's advance, or pay, confirm or send back.
   - Pinned by the `check_clear` `NotAllowed` test in Task 1, `require_finance` in Task 5, and the route guards in
     Task 8, and exercised in the Task 12 E2E step 10.
5. **Two uploads with the same file name**, e.g. `slip.jpg` at pay and at clear, or twice at clear:
   - They must not overwrite each other in S3.
   - Pinned by the `uniqueFileName` test in Task 7 plus the per-step folder in Task 8.

---

## File Map

**BE (api-ncac worktree):**

| File | Responsibility |
|---|---|
| `services/finance/__init__.py` | package marker |
| `services/finance/advance_logic.py` | **pure** rules: statuses, due date, settle, transition checks, finance role, request-value picking, diffs |
| `services/finance/advance_repo.py` | DB reads and serialisation: list, detail, summary |
| `services/notify_guard.py` | `notifications_enabled(form_master)` |
| `models/finance_model.py` | `FinAccount`, `FinAdvance`, `FinAdvanceLog` |
| `models/__init__.py` | import the finance models (so `create_all` knows them) |
| `schemas/finance_schema.py` | request bodies |
| `routes/finance/__init__.py`, `routes/finance/advance_routes.py` | `/finance/*` router |
| `main.py` | register the router |
| `routes/forms/form_submission_routes.py`, `routes/forms/form_approval_routes.py` | notification guard only |
| `scripts/migrations/2026-09-28_finance_advance.sql` | DDL + account seed + ADV form/rules seed |
| `requirements-dev.txt`, `tests/conftest.py`, `tests/finance/*`, `tests/test_notify_guard.py` | tests |

**FE (menait-service):**

| File | Responsibility |
|---|---|
| `lib/finance/status.ts` (+ `.test.ts`) | pure helpers: labels, dates, money, settle, file names |
| `lib/finance/role.ts` (+ `.test.ts`) | `isFinanceUser`, `financeConfig` |
| `lib/finance/export.ts` (+ `.test.ts`) | Excel rows and export |
| `lib/finance/server.ts` | server-only: session guard, BE URL builder, JSON proxy |
| `app/api/login/route.ts`, `app/context/SessionContext.tsx` | `is_finance` in the session |
| `app/api/finance/accounts/route.ts`, `app/api/finance/advances/route.ts`, `app/api/finance/advances/[form_id]/route.ts`, `app/api/finance/summary/route.ts` | proxy routes with guards |
| `app/api/uploads3/route.ts` | `folder` param + `folder` in the listing |
| `app/finance/types.ts`, `app/finance/labels.ts`, `app/finance/api.ts` | shared FE types, labels, client fetch helpers |
| `app/finance/components/*.tsx` | FinanceShell, StatusBadge, FilePicker, AttachmentPanel, AdvanceSummary, LogList, ClearForm, PayForm, ReviewPanel, AdvanceTable |
| `app/finance/advance/new/page.tsx`, `app/finance/advance/page.tsx`, `app/finance/advance/[form_id]/page.tsx` | requester pages |
| `app/finance/page.tsx`, `app/finance/[form_id]/page.tsx`, `app/finance/accounts/page.tsx` | Finance pages |
| `components/navbar.tsx`, `app/builder/[[...slug]]/page.tsx`, `tsconfig.json` | menu, form-type option, exclude tests from tsc |

---

### Task 1: BE worktree + pure business rules (`advance_logic`)

**Files:**
- Create: `services/finance/__init__.py`, `services/finance/advance_logic.py`, `requirements-dev.txt`, `tests/conftest.py`, `tests/finance/__init__.py`, `tests/finance/test_advance_logic.py`

**Interfaces:**
- Consumes: nothing.
- Produces, from module `services.finance.advance_logic`:
  - Constants:
    - `CLEAR_DUE_DAYS = 7`
    - statuses: `PENDING_APPROVAL, REJECTED, AWAITING_PAYMENT, AWAITING_CLEARING, SENT_BACK, AWAITING_REVIEW, CLOSED`
    - `fin_status` values: `FIN_PAID, FIN_CLEARING_SUBMITTED, FIN_SENT_BACK, FIN_CLOSED`
    - `STATUS_LABELS: dict[str, str]`
  - Exceptions: `AdvanceRuleError` (`http_status=400`), `InvalidTransition` (409), `NotAllowed` (403).
  - Functions:
    - `derive_status(status_approve: str, fin_status: str | None, clear_due_date: date | None, today: date) -> tuple[str, bool]`
    - `default_due_date(transfer_date: date) -> date`
    - `compute_settle_amount(amount_paid, amount_actual) -> Decimal`
    - `check_pay(status, *, acc_active: bool, amount_paid, transfer_date, clear_due_date) -> date`
    - `check_clear(status, *, is_owner: bool, amount_paid, clear_date, amount_actual, settle_date) -> tuple[Decimal, date | None]`
    - `check_send_back(status, *, review_remark) -> None`
    - `check_confirm(status, *, settle_amount, settle_date) -> date | None`
    - `parse_id_list(raw: str | None) -> list[str]`
    - `is_finance_user(department_id, employee_id, dept_ids, employee_ids) -> bool`
    - `pick_request_values(rows: list[dict]) -> dict` with keys `purpose`, `amount`, `use_date`
    - `diff_fields(before: Mapping, after: Mapping) -> dict[str, list]`

- [ ] **Step 1: Create the BE worktree, venv and dev deps**

```bash
cd ~/Documents/project/ncac/api-ncac
git fetch origin
git worktree add -b feat/finance-advance ../api-ncac-finance origin/main
cd ../api-ncac-finance
git check-ignore -q .env && echo ".env ignored" || echo "WARNING: .env NOT ignored"
git check-ignore -q .venv && echo ".venv ignored" || echo ".venv/" >> .gitignore
python3 -m venv .venv
.venv/bin/pip install -q -r requirements.txt
printf "pytest\n" > requirements-dev.txt
.venv/bin/pip install -q -r requirements-dev.txt
.venv/bin/python -c "import fastapi, sqlalchemy, pydantic; print(sqlalchemy.__version__, pydantic.__version__)"
```

Expected: `.env ignored` and versions printed (SQLAlchemy 2.x, Pydantic 2.x). If `.env` is NOT ignored, add `.env` to
`.gitignore` before continuing. If `pip install` fails on Python 3.14 wheels, retry with
`python3.13 -m venv .venv` (or `python3.12`).

- [ ] **Step 2: Test scaffolding**

`tests/conftest.py`:

```python
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
```

`tests/finance/__init__.py`: empty file. `services/finance/__init__.py`: empty file.

- [ ] **Step 3: Write the failing tests** in `tests/finance/test_advance_logic.py`

```python
from datetime import date, datetime
from decimal import Decimal

import pytest

from services.finance import advance_logic as L

TODAY = date(2026, 9, 28)


class TestDeriveStatus:
    def test_in_progress_is_pending_approval(self):
        assert L.derive_status("In Progress", None, None, TODAY) == (L.PENDING_APPROVAL, False)

    def test_rejected(self):
        assert L.derive_status("Rejected", None, None, TODAY) == (L.REJECTED, False)

    def test_approved_without_fin_row_awaits_payment(self):
        assert L.derive_status("Approved", None, None, TODAY) == (L.AWAITING_PAYMENT, False)

    def test_paid_due_today_is_not_overdue(self):
        assert L.derive_status("Approved", L.FIN_PAID, date(2026, 9, 28), TODAY) == (L.AWAITING_CLEARING, False)

    def test_paid_due_yesterday_is_overdue(self):
        assert L.derive_status("Approved", L.FIN_PAID, date(2026, 9, 27), TODAY) == (L.AWAITING_CLEARING, True)

    def test_sent_back_past_due_is_overdue(self):
        assert L.derive_status("Approved", L.FIN_SENT_BACK, date(2026, 9, 1), TODAY) == (L.SENT_BACK, True)

    def test_submitted_clearing_is_never_overdue(self):
        assert L.derive_status("Approved", L.FIN_CLEARING_SUBMITTED, date(2026, 9, 1), TODAY) == (L.AWAITING_REVIEW, False)

    def test_closed(self):
        assert L.derive_status("Approved", L.FIN_CLOSED, date(2026, 9, 1), TODAY) == (L.CLOSED, False)

    def test_labels(self):
        assert L.STATUS_LABELS[L.AWAITING_CLEARING] == "จ่ายแล้วรอเคลียร์"
        for code in (L.PENDING_APPROVAL, L.REJECTED, L.AWAITING_PAYMENT, L.AWAITING_CLEARING,
                     L.SENT_BACK, L.AWAITING_REVIEW, L.CLOSED):
            assert L.STATUS_LABELS[code]


class TestDueDateAndSettle:
    def test_default_due_is_plus_7(self):
        assert L.default_due_date(date(2026, 6, 25)) == date(2026, 7, 2)

    def test_default_due_crosses_month_end(self):
        assert L.default_due_date(date(2026, 6, 28)) == date(2026, 7, 5)

    def test_settle_return(self):
        assert L.compute_settle_amount(Decimal("1000"), Decimal("800.50")) == Decimal("199.50")

    def test_settle_extra(self):
        assert L.compute_settle_amount(Decimal("1000"), Decimal("1250")) == Decimal("-250.00")

    def test_settle_exact(self):
        assert L.compute_settle_amount(Decimal("1000.00"), Decimal("1000")) == Decimal("0.00")


class TestCheckPay:
    def _pay(self, status=L.AWAITING_PAYMENT, **kw):
        args = dict(acc_active=True, amount_paid=Decimal("1000"),
                    transfer_date=date(2026, 7, 9), clear_due_date=None)
        args.update(kw)
        return L.check_pay(status, **args)

    def test_defaults_due_date(self):
        assert self._pay() == date(2026, 7, 16)

    def test_keeps_explicit_due_date(self):
        assert self._pay(clear_due_date=date(2026, 7, 20)) == date(2026, 7, 20)

    def test_edit_allowed_while_awaiting_clearing(self):
        assert self._pay(L.AWAITING_CLEARING) == date(2026, 7, 16)

    @pytest.mark.parametrize("status", [L.PENDING_APPROVAL, L.REJECTED, L.SENT_BACK, L.AWAITING_REVIEW, L.CLOSED])
    def test_rejects_other_statuses(self, status):
        with pytest.raises(L.InvalidTransition):
            self._pay(status)

    def test_requires_active_account(self):
        with pytest.raises(L.AdvanceRuleError):
            self._pay(acc_active=False)

    def test_rejects_negative_amount(self):
        with pytest.raises(L.AdvanceRuleError):
            self._pay(amount_paid=Decimal("-1"))

    def test_requires_transfer_date(self):
        with pytest.raises(L.AdvanceRuleError):
            self._pay(transfer_date=None)

    def test_rejects_due_before_transfer(self):
        with pytest.raises(L.AdvanceRuleError):
            self._pay(clear_due_date=date(2026, 7, 1))


class TestCheckClear:
    def _clear(self, status=L.AWAITING_CLEARING, **kw):
        args = dict(is_owner=True, amount_paid=Decimal("1000"), clear_date=date(2026, 7, 15),
                    amount_actual=Decimal("800"), settle_date=date(2026, 7, 15))
        args.update(kw)
        return L.check_clear(status, **args)

    def test_return_keeps_requester_settle_date(self):
        assert self._clear() == (Decimal("200.00"), date(2026, 7, 15))

    def test_return_requires_settle_date(self):
        with pytest.raises(L.AdvanceRuleError):
            self._clear(settle_date=None)

    def test_extra_ignores_requester_settle_date(self):
        assert self._clear(amount_actual=Decimal("1200")) == (Decimal("-200.00"), None)

    def test_exact_amount_needs_no_date(self):
        assert self._clear(amount_actual=Decimal("1000"), settle_date=None) == (Decimal("0.00"), None)

    def test_non_owner_is_forbidden(self):
        with pytest.raises(L.NotAllowed):
            self._clear(is_owner=False)

    @pytest.mark.parametrize("status", [L.SENT_BACK, L.AWAITING_REVIEW])
    def test_resubmit_and_edit_allowed(self, status):
        assert self._clear(status)[0] == Decimal("200.00")

    @pytest.mark.parametrize("status", [L.PENDING_APPROVAL, L.REJECTED, L.AWAITING_PAYMENT, L.CLOSED])
    def test_rejects_other_statuses(self, status):
        with pytest.raises(L.InvalidTransition):
            self._clear(status)

    def test_requires_clear_date(self):
        with pytest.raises(L.AdvanceRuleError):
            self._clear(clear_date=None)

    def test_rejects_negative_actual(self):
        with pytest.raises(L.AdvanceRuleError):
            self._clear(amount_actual=Decimal("-5"))


class TestReview:
    def test_send_back_requires_remark(self):
        with pytest.raises(L.AdvanceRuleError):
            L.check_send_back(L.AWAITING_REVIEW, review_remark="   ")

    def test_send_back_ok(self):
        assert L.check_send_back(L.AWAITING_REVIEW, review_remark="ใบเสร็จไม่ครบ") is None

    def test_send_back_wrong_status(self):
        with pytest.raises(L.InvalidTransition):
            L.check_send_back(L.AWAITING_CLEARING, review_remark="x")

    def test_confirm_return_needs_no_date(self):
        assert L.check_confirm(L.AWAITING_REVIEW, settle_amount=Decimal("200"), settle_date=None) is None

    def test_confirm_extra_requires_date(self):
        with pytest.raises(L.AdvanceRuleError):
            L.check_confirm(L.AWAITING_REVIEW, settle_amount=Decimal("-200"), settle_date=None)

    def test_confirm_extra_returns_date(self):
        assert L.check_confirm(L.AWAITING_REVIEW, settle_amount=Decimal("-200"),
                               settle_date=date(2026, 7, 20)) == date(2026, 7, 20)

    def test_confirm_wrong_status(self):
        with pytest.raises(L.InvalidTransition):
            L.check_confirm(L.SENT_BACK, settle_amount=Decimal("0"), settle_date=None)


class TestFinanceRole:
    def test_parse_id_list(self):
        assert L.parse_id_list(" 4, 6 ,,") == ["4", "6"]
        assert L.parse_id_list(None) == []

    def test_department_member(self):
        assert L.is_finance_user(4, "680001", [4, 6], [])

    def test_employee_override(self):
        assert L.is_finance_user(21, "680043", [4, 6], ["680043"])

    def test_not_finance(self):
        assert not L.is_finance_user(21, "680001", [4, 6], [])
        assert not L.is_finance_user(None, None, [4, 6], [])


class TestPickRequestValues:
    ROWS = [
        {"name": "adv_purpose", "type": "longtext", "sort_order": 1, "text": "ค่าเดินทาง", "number": None, "date": None},
        {"name": "adv_amount", "type": "number", "sort_order": 2, "text": None, "number": Decimal("4840"), "date": None},
        {"name": "adv_use_date", "type": "datetime", "sort_order": 3, "text": None, "number": None,
         "date": datetime(2026, 7, 14)},
    ]

    def test_by_question_name(self):
        assert L.pick_request_values(self.ROWS) == {
            "purpose": "ค่าเดินทาง", "amount": Decimal("4840"), "use_date": datetime(2026, 7, 14)}

    def test_falls_back_to_type_when_renamed(self):
        renamed = [dict(r, name=f"q{i}") for i, r in enumerate(self.ROWS)]
        assert L.pick_request_values(renamed)["amount"] == Decimal("4840")

    def test_missing_values_are_none(self):
        assert L.pick_request_values([]) == {"purpose": None, "amount": None, "use_date": None}


class TestDiffFields:
    def test_only_changed_fields_serialized(self):
        before = {"amount_paid": Decimal("1000.00"), "voucher_no": "A", "transfer_date": date(2026, 7, 9)}
        after = {"amount_paid": Decimal("1000"), "voucher_no": "B", "transfer_date": date(2026, 7, 10)}
        assert L.diff_fields(before, after) == {
            "voucher_no": ["A", "B"], "transfer_date": ["2026-07-09", "2026-07-10"]}

    def test_new_row_lists_everything(self):
        assert L.diff_fields({}, {"amount_paid": Decimal("5")}) == {"amount_paid": [None, "5"]}
```

- [ ] **Step 4: Run the tests to verify they fail**

Run: `cd ~/Documents/project/ncac/api-ncac-finance && .venv/bin/pytest tests/finance/test_advance_logic.py -q`
Expected: collection error `ImportError: cannot import name 'advance_logic'`.

- [ ] **Step 5: Implement** `services/finance/advance_logic.py`

```python
"""Pure business rules for the Finance advance-cash flow (no DB, no FastAPI).

The display status is derived from the approval state of the form submission plus the
fin_advances row. See menait-service docs/superpowers/specs/2026-09-28-finance-advance-design.md §6.1.
"""
from __future__ import annotations

from datetime import date, timedelta
from decimal import Decimal
from typing import Iterable, Mapping

CLEAR_DUE_DAYS = 7

PENDING_APPROVAL = "PENDING_APPROVAL"
REJECTED = "REJECTED"
AWAITING_PAYMENT = "AWAITING_PAYMENT"
AWAITING_CLEARING = "AWAITING_CLEARING"
SENT_BACK = "SENT_BACK"
AWAITING_REVIEW = "AWAITING_REVIEW"
CLOSED = "CLOSED"

STATUS_LABELS = {
    PENDING_APPROVAL: "รออนุมัติ",
    REJECTED: "ไม่อนุมัติ",
    AWAITING_PAYMENT: "รอจ่าย",
    AWAITING_CLEARING: "จ่ายแล้วรอเคลียร์",
    SENT_BACK: "ส่งกลับแก้ไข",
    AWAITING_REVIEW: "รอการเงินตรวจ",
    CLOSED: "ปิดแล้ว",
}

FIN_PAID = "PAID"
FIN_CLEARING_SUBMITTED = "CLEARING_SUBMITTED"
FIN_SENT_BACK = "SENT_BACK"
FIN_CLOSED = "CLOSED"

_FIN_TO_STATUS = {
    FIN_PAID: AWAITING_CLEARING,
    FIN_SENT_BACK: SENT_BACK,
    FIN_CLEARING_SUBMITTED: AWAITING_REVIEW,
    FIN_CLOSED: CLOSED,
}

_CENT = Decimal("0.01")


class AdvanceRuleError(Exception):
    """Validation failure → HTTP 400."""
    http_status = 400


class InvalidTransition(AdvanceRuleError):
    """Action not allowed in the current status → HTTP 409."""
    http_status = 409


class NotAllowed(AdvanceRuleError):
    """Actor may not perform this action → HTTP 403."""
    http_status = 403


def derive_status(status_approve, fin_status, clear_due_date, today):
    if fin_status:
        status = _FIN_TO_STATUS[fin_status]
    elif status_approve == "Approved":
        status = AWAITING_PAYMENT
    elif status_approve == "Rejected":
        status = REJECTED
    else:
        status = PENDING_APPROVAL
    overdue = (
        status in (AWAITING_CLEARING, SENT_BACK)
        and clear_due_date is not None
        and today > clear_due_date
    )
    return status, overdue


def default_due_date(transfer_date: date) -> date:
    return transfer_date + timedelta(days=CLEAR_DUE_DAYS)


def compute_settle_amount(amount_paid, amount_actual) -> Decimal:
    return (Decimal(amount_paid) - Decimal(amount_actual)).quantize(_CENT)


def _require(condition, message):
    if not condition:
        raise AdvanceRuleError(message)


def _require_status(current, allowed, action):
    if current not in allowed:
        raise InvalidTransition(
            f"ทำรายการ {action} ไม่ได้ในสถานะ {STATUS_LABELS.get(current, current)}"
        )


def check_pay(status, *, acc_active, amount_paid, transfer_date, clear_due_date):
    _require_status(status, (AWAITING_PAYMENT, AWAITING_CLEARING), "บันทึกการจ่ายเงิน")
    _require(acc_active, "กรุณาเลือกรหัสบัญชีที่ใช้งานอยู่")
    _require(amount_paid is not None and Decimal(amount_paid) >= 0, "ยอดเงินต้องไม่ติดลบ")
    _require(transfer_date is not None, "กรุณาระบุวันที่โอนเงิน")
    due = clear_due_date or default_due_date(transfer_date)
    _require(due >= transfer_date, "กำหนดการเคลียร์ต้องไม่ก่อนวันที่โอนเงิน")
    return due


def check_clear(status, *, is_owner, amount_paid, clear_date, amount_actual, settle_date):
    if not is_owner:
        raise NotAllowed("เฉพาะผู้เบิกเงินเท่านั้นที่บันทึกการเคลียร์ได้")
    _require_status(status, (AWAITING_CLEARING, SENT_BACK, AWAITING_REVIEW), "เคลียร์เงิน")
    _require(clear_date is not None, "กรุณาระบุวันที่เคลียร์")
    _require(amount_actual is not None and Decimal(amount_actual) >= 0, "ยอดใช้จริงต้องไม่ติดลบ")
    settle = compute_settle_amount(amount_paid, amount_actual)
    if settle > 0:
        _require(settle_date is not None, "มียอดต้องคืนบริษัท กรุณาระบุวันที่โอนเงินคืน")
        return settle, settle_date
    return settle, None


def check_send_back(status, *, review_remark):
    _require_status(status, (AWAITING_REVIEW,), "ส่งกลับแก้ไข")
    _require(bool(review_remark and review_remark.strip()), "กรุณาระบุเหตุผลที่ส่งกลับ")


def check_confirm(status, *, settle_amount, settle_date):
    _require_status(status, (AWAITING_REVIEW,), "ยืนยันปิดรายการ")
    if settle_amount is not None and Decimal(settle_amount) < 0:
        _require(settle_date is not None, "มียอดเบิกเพิ่ม กรุณาระบุวันที่การเงินโอนเงินเพิ่ม")
        return settle_date
    return None


def parse_id_list(raw):
    return [part.strip() for part in (raw or "").split(",") if part.strip()]


def is_finance_user(department_id, employee_id, dept_ids: Iterable[int], employee_ids: Iterable[str]) -> bool:
    if department_id is not None and department_id in set(dept_ids):
        return True
    return employee_id is not None and employee_id in set(employee_ids)


# key → (question_name, accepted question types when the name is missing)
_REQUEST_FIELDS = {
    "purpose": ("adv_purpose", ("longtext", "text")),
    "amount": ("adv_amount", ("number",)),
    "use_date": ("adv_use_date", ("datetime", "date")),
}
_ROW_VALUE_KEY = {"purpose": "text", "amount": "number", "use_date": "date"}


def pick_request_values(rows):
    """rows: dicts with keys name, type, sort_order, text, number, date (one per answered question)."""
    ordered = sorted(rows, key=lambda r: r.get("sort_order") or 0)
    picked = {}
    for key, (name, types) in _REQUEST_FIELDS.items():
        row = next((r for r in ordered if r.get("name") == name), None)
        if row is None:
            row = next((r for r in ordered if r.get("type") in types), None)
        picked[key] = row.get(_ROW_VALUE_KEY[key]) if row else None
    return picked


def _jsonable(value):
    if isinstance(value, date):  # datetime is a subclass of date
        return value.isoformat()
    if isinstance(value, Decimal):
        return str(value)
    return value


def diff_fields(before: Mapping, after: Mapping):
    changes = {}
    for field, new in after.items():
        old = before.get(field)
        if old != new:
            changes[field] = [_jsonable(old), _jsonable(new)]
    return changes
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `.venv/bin/pytest tests/finance/test_advance_logic.py -q`
Expected: all passed (about 50 tests).

- [ ] **Step 7: Commit**

```bash
cd ~/Documents/project/ncac/api-ncac-finance && git pull --rebase origin main
git add requirements-dev.txt tests/conftest.py tests/finance services/finance .gitignore
git commit -m "feat(finance): pure advance-cash business rules + tests

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: BE notification guard for Advance forms

**Files:**
- Create: `services/notify_guard.py`, `tests/test_notify_guard.py`
- Modify:
  - `routes/forms/form_submission_routes.py`: the submit handler's email/LINE block and the status-Done email.
  - `routes/forms/form_approval_routes.py`: the approve and reject emails.

**Interfaces:**
- Produces: `services.notify_guard.notifications_enabled(form_master) -> bool` and `ADVANCE_FORM_TYPE = "Advance"`.

- [ ] **Step 1: Write the failing test** in `tests/test_notify_guard.py`

```python
from types import SimpleNamespace

from services.notify_guard import notifications_enabled


def test_it_forms_always_notify(monkeypatch):
    monkeypatch.delenv("ADVANCE_NOTIFY_ENABLED", raising=False)
    assert notifications_enabled(SimpleNamespace(form_type="Service"))
    assert notifications_enabled(SimpleNamespace(form_type="Issue"))


def test_missing_form_keeps_old_behaviour():
    assert notifications_enabled(None)


def test_advance_silent_by_default(monkeypatch):
    monkeypatch.delenv("ADVANCE_NOTIFY_ENABLED", raising=False)
    assert not notifications_enabled(SimpleNamespace(form_type="Advance"))


def test_advance_enabled_by_env(monkeypatch):
    monkeypatch.setenv("ADVANCE_NOTIFY_ENABLED", "true")
    assert notifications_enabled(SimpleNamespace(form_type="Advance"))
```

- [ ] **Step 2: Run it to verify it fails**

Run: `.venv/bin/pytest tests/test_notify_guard.py -q`
Expected: FAIL, `ModuleNotFoundError: No module named 'services.notify_guard'`.

- [ ] **Step 3: Implement** `services/notify_guard.py`

```python
"""Advance (Finance) forms stay silent until the finance email token exists.
Set ADVANCE_NOTIFY_ENABLED=true to turn email/LINE on for them. IT forms are unaffected."""
import os

ADVANCE_FORM_TYPE = "Advance"


def notifications_enabled(form_master) -> bool:
    if form_master is None or getattr(form_master, "form_type", None) != ADVANCE_FORM_TYPE:
        return True
    return os.getenv("ADVANCE_NOTIFY_ENABLED", "false").strip().lower() == "true"
```

- [ ] **Step 4: Run it to verify it passes**

Run: `.venv/bin/pytest tests/test_notify_guard.py -q`
Expected: 4 passed.

- [ ] **Step 5: Guard the submit route**, in `routes/forms/form_submission_routes.py`

1. Add the import below `from services.line_service import send_line_message`:

```python
from services.notify_guard import notifications_enabled
```

2. Add this helper right after `router = APIRouter(prefix="/forms", tags=["Forms - Submission"])`:

```python
def _submit_response(submission, form):
    return {
        "message": "Form submitted",
        "submission_id": submission.id,
        "form_id": submission.form_id,
        "form_master_id": form.id,
        "form_version": form.version,
        "status": submission.status,
        "status_approve": submission.status_approve,
        "current_approval_level": submission.current_approval_level,
    }
```

3. In `submit_form`, directly after `db.refresh(submission)`, insert:

```python
        if not notifications_enabled(form):
            return _submit_response(submission, form)
```

4. In the same function, replace the final `return { "message": "Form submitted", ... }` dict literal (the one after
   `background_tasks.add_task(send_line_message, line_message)`) with:

```python
        return _submit_response(submission, form)
```

5. In the status-change handler, change `if new_status == "Done":` to:

```python
        if new_status == "Done" and notifications_enabled(submission.form):
```

- [ ] **Step 6: Guard the approve and reject routes**, in `routes/forms/form_approval_routes.py`

1. Add the import below `from services.email_service import ...`:

```python
from services.notify_guard import notifications_enabled
```

2. In `approve_submission`, change the line directly after `db.commit()` from `if submission.status_approve == "Approved":` to:

```python
    if submission.status_approve == "Approved" and notifications_enabled(submission.form):
```

3. In `reject_submission`, change the `if creator and creator.email:` that precedes `body = render_form_rejected_th(` to:

```python
    if creator and creator.email and notifications_enabled(submission.form):
```

- [ ] **Step 7: Verify the modules still import and the tests pass**

```bash
DATABASE_URL=postgresql://u:p@localhost:5432/x .venv/bin/python -c "import routes.forms.form_submission_routes, routes.forms.form_approval_routes; print('ok')"
.venv/bin/pytest -q
grep -n "notifications_enabled" routes/forms/*.py
```

Expected:
- `ok` is printed.
- All tests pass.
- grep shows 6 lines: 2 imports, and the 4 guards (submit, Done, approve, reject).

- [ ] **Step 7b: Behaviour test for the submit guard** (confirms the early return skips the heavy approver-email lookup).

Append to `tests/test_notify_guard.py`:

```python
def test_submit_response_shape():
    import os
    os.environ.setdefault("DATABASE_URL", "postgresql://u:p@localhost:5432/x")
    from routes.forms.form_submission_routes import _submit_response
    sub = SimpleNamespace(id=7, form_id="ADV-2026-0001", status="Open", status_approve="In Progress",
                          current_approval_level=1)
    form = SimpleNamespace(id=3, version=1)
    assert _submit_response(sub, form) == {
        "message": "Form submitted", "submission_id": 7, "form_id": "ADV-2026-0001", "form_master_id": 3,
        "form_version": 1, "status": "Open", "status_approve": "In Progress", "current_approval_level": 1,
    }
```

Run: `.venv/bin/pytest tests/test_notify_guard.py -q`. Expected: 5 passed.

- [ ] **Step 8: Commit**

```bash
git pull --rebase origin main
git add services/notify_guard.py tests/test_notify_guard.py routes/forms/form_submission_routes.py routes/forms/form_approval_routes.py
git commit -m "feat(forms): skip email/LINE for Advance forms unless ADVANCE_NOTIFY_ENABLED=true

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: BE finance models + SQL migration (written and dry-run only; NOT executed)

**Files:**
- Create: `models/finance_model.py`, `scripts/migrations/2026-09-28_finance_advance.sql`, `tests/finance/test_finance_model.py`
- Modify: `models/__init__.py` (append the import)

**Interfaces:**
- Produces:
  - `models.finance_model.FinAccount` (table `fin_accounts`)
  - `FinAdvance` (`fin_advances`)
  - `FinAdvanceLog` (`fin_advance_logs`)
  - Columns exactly as in the migration below.

- [ ] **Step 1: Write the failing test** in `tests/finance/test_finance_model.py`

```python
import os

os.environ.setdefault("DATABASE_URL", "postgresql://u:p@localhost:5432/x")

from sqlalchemy.dialects import postgresql  # noqa: E402
from sqlalchemy.schema import CreateTable  # noqa: E402


def test_tables_registered_before_create_all():
    import models  # noqa: F401  (main.py imports models, then calls create_all)
    from database import Base
    for table in ("fin_accounts", "fin_advances", "fin_advance_logs"):
        assert table in Base.metadata.tables


def test_fin_advances_constraints():
    from models.finance_model import FinAdvance
    ddl = str(CreateTable(FinAdvance.__table__).compile(dialect=postgresql.dialect()))
    assert "UNIQUE (submission_id)" in ddl
    assert "UNIQUE (form_id)" in ddl
    assert "amount_paid >= 0" in ddl
    assert "fin_status IN ('PAID','CLEARING_SUBMITTED','SENT_BACK','CLOSED')" in ddl
    assert "NUMERIC(12, 2)" in ddl
```

- [ ] **Step 2: Run it to verify it fails**

Run: `.venv/bin/pytest tests/finance/test_finance_model.py -q`
Expected: FAIL. `fin_accounts` is not in the metadata, or `ModuleNotFoundError: models.finance_model`.

- [ ] **Step 3: Implement** `models/finance_model.py`

```python
"""Finance — เบิกเงิน Advance. Tables are created by scripts/migrations/2026-09-28_finance_advance.sql
(and create_all, which is a no-op once they exist). Keep both in sync."""
from sqlalchemy import (
    Boolean, CheckConstraint, Column, Date, DateTime, ForeignKey, Index, Integer, Numeric, String, Text, func,
)
from sqlalchemy.dialects.postgresql import JSONB

from database import Base


class FinAccount(Base):
    __tablename__ = "fin_accounts"

    acc_code = Column(String(20), primary_key=True)
    acc_name = Column(String(255), nullable=False)
    acc_name_en = Column(String(255))
    is_active = Column(Boolean, nullable=False, default=True, server_default="true")
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())


class FinAdvance(Base):
    __tablename__ = "fin_advances"

    id = Column(Integer, primary_key=True)
    submission_id = Column(Integer, ForeignKey("form_submissions.id"), nullable=False, unique=True)
    form_id = Column(String(80), nullable=False, unique=True)

    # step 3 — Finance pays
    acc_code = Column(String(20), ForeignKey("fin_accounts.acc_code"))
    voucher_no = Column(String(50))          # เลขที่ใบเบิก
    voucher_date = Column(Date)              # วันที่ตั้งเบิก
    payment_doc_no = Column(String(50))      # เลขที่เอกสารจ่าย
    purpose = Column(Text)                   # วัตถุประสงค์
    amount_paid = Column(Numeric(12, 2), nullable=False)   # ยอดเงิน
    transfer_date = Column(Date, nullable=False)           # วันที่โอนเงิน
    clear_due_date = Column(Date, nullable=False)          # กำหนดการเคลียร์
    paid_by = Column(String(50))
    paid_at = Column(DateTime(timezone=True))

    # step 4 — requester clears
    clear_date = Column(Date)                # วันที่เคลียร์
    amount_actual = Column(Numeric(12, 2))   # ยอดใช้จริง
    clear_doc_no = Column(String(100))       # เอกสารเคลียร์
    settle_amount = Column(Numeric(12, 2))   # รับคืน (+) / เบิกเพิ่ม (−)
    settle_date = Column(Date)               # วันที่โอนเงินคืน
    remark = Column(Text)                    # หมายเหตุ
    clear_submitted_at = Column(DateTime(timezone=True))

    # step 5 — Finance checks
    review_remark = Column(Text)
    closed_by = Column(String(50))
    closed_at = Column(DateTime(timezone=True))

    fin_status = Column(String(30), nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        CheckConstraint("amount_paid >= 0", name="ck_fin_advances_amount_paid"),
        CheckConstraint("amount_actual IS NULL OR amount_actual >= 0", name="ck_fin_advances_amount_actual"),
        CheckConstraint("fin_status IN ('PAID','CLEARING_SUBMITTED','SENT_BACK','CLOSED')",
                        name="ck_fin_advances_fin_status"),
        Index("ix_fin_advances_fin_status", "fin_status"),
        Index("ix_fin_advances_clear_due_date", "clear_due_date"),
    )


class FinAdvanceLog(Base):
    __tablename__ = "fin_advance_logs"

    id = Column(Integer, primary_key=True)
    advance_id = Column(Integer, ForeignKey("fin_advances.id", ondelete="CASCADE"), nullable=False, index=True)
    action = Column(String(30), nullable=False)  # PAY / PAY_EDIT / CLEAR_SUBMIT / CLEAR_EDIT / SEND_BACK / CONFIRM
    changes = Column(JSONB)
    remark = Column(Text)
    action_by = Column(String(50))
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
```

- [ ] **Step 4: Register the models.** Append to `models/__init__.py`:

```python

# Finance — เบิกเงิน Advance (ต้องอยู่ใน metadata ก่อน main.py เรียก create_all)
from .finance_model import FinAccount, FinAdvance, FinAdvanceLog
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `.venv/bin/pytest tests/finance/test_finance_model.py -q`
Expected: 2 passed.

- [ ] **Step 6: Write the migration** `scripts/migrations/2026-09-28_finance_advance.sql`

```sql
-- =====================================================================
-- Finance — เบิกเงิน Advance  (28 ก.ย. 2026)
--
-- 1) ตาราง fin_accounts / fin_advances / fin_advance_logs (ตรงกับ models/finance_model.py)
-- 2) seed รหัสบัญชีเงินสดย่อย 11 รายการ
-- 3) seed ฟอร์ม ADV (form_type='Advance') + คำถาม 3 ข้อ + กฎอนุมัติ 2 ข้อ (ขั้นเดียว)
--
-- รันซ้ำได้ (idempotent): CREATE ... IF NOT EXISTS, ON CONFLICT DO NOTHING, ข้ามฟอร์มถ้ามี ADV แล้ว
-- ฟอร์ม ADV ไม่ขึ้นหน้า home ของเว็บจริง (home แสดงเฉพาะ form_type='Service')
-- =====================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS fin_accounts (
    acc_code     varchar(20)  PRIMARY KEY,
    acc_name     varchar(255) NOT NULL,
    acc_name_en  varchar(255),
    is_active    boolean      NOT NULL DEFAULT true,
    created_at   timestamptz  NOT NULL DEFAULT now(),
    updated_at   timestamptz  NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS fin_advances (
    id                  serial        PRIMARY KEY,
    submission_id       integer       NOT NULL UNIQUE REFERENCES form_submissions(id),
    form_id             varchar(80)   NOT NULL UNIQUE,
    acc_code            varchar(20)   REFERENCES fin_accounts(acc_code),
    voucher_no          varchar(50),
    voucher_date        date,
    payment_doc_no      varchar(50),
    purpose             text,
    amount_paid         numeric(12,2) NOT NULL,
    transfer_date       date          NOT NULL,
    clear_due_date      date          NOT NULL,
    paid_by             varchar(50),
    paid_at             timestamptz,
    clear_date          date,
    amount_actual       numeric(12,2),
    clear_doc_no        varchar(100),
    settle_amount       numeric(12,2),
    settle_date         date,
    remark              text,
    clear_submitted_at  timestamptz,
    review_remark       text,
    closed_by           varchar(50),
    closed_at           timestamptz,
    fin_status          varchar(30)   NOT NULL,
    created_at          timestamptz   NOT NULL DEFAULT now(),
    updated_at          timestamptz   NOT NULL DEFAULT now(),
    CONSTRAINT ck_fin_advances_amount_paid   CHECK (amount_paid >= 0),
    CONSTRAINT ck_fin_advances_amount_actual CHECK (amount_actual IS NULL OR amount_actual >= 0),
    CONSTRAINT ck_fin_advances_fin_status    CHECK (fin_status IN ('PAID','CLEARING_SUBMITTED','SENT_BACK','CLOSED'))
);
CREATE INDEX IF NOT EXISTS ix_fin_advances_fin_status     ON fin_advances (fin_status);
CREATE INDEX IF NOT EXISTS ix_fin_advances_clear_due_date ON fin_advances (clear_due_date);

CREATE TABLE IF NOT EXISTS fin_advance_logs (
    id          serial       PRIMARY KEY,
    advance_id  integer      NOT NULL REFERENCES fin_advances(id) ON DELETE CASCADE,
    action      varchar(30)  NOT NULL,
    changes     jsonb,
    remark      text,
    action_by   varchar(50),
    created_at  timestamptz  NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_fin_advance_logs_advance_id ON fin_advance_logs (advance_id);

INSERT INTO fin_accounts (acc_code, acc_name, acc_name_en) VALUES
    ('110101', 'เงินสดย่อย-กรุงเทพฯ - บัญชี คุณอัจฉราพร',       'Petty Cash - Bangkok. - Accounting'),
    ('110102', 'เงินสดย่อย-สระบุรี - บัญชี คุณศิวพร',           'Petty Cash - Saraburi - Accounting'),
    ('110103', 'เงินสดย่อย-ลาดกระบัง - บัญชี คุณวรรษชล',        'Petty Cash - Ladkrabang - Accounting'),
    ('110104', 'เงินสดย่อย-ลาดกระบัง - ยย. คุณนวลจันทร์',       'Petty Cash - Ladkrabang - Automotive'),
    ('110105', 'เงินสดย่อย-สระบุรี - ยย คุณสุทธิพงษ์',           'Petty Cash - Saraburi - Automotive'),
    ('110106', 'เงินสดย่อย-ขอนแก่น - ยย. คุณณัฐณิชา',          'Petty Cash - Khonkaen - Automotive'),
    ('110107', 'เงินสดย่อย-ค่าปรับ คุณธันย์ณภัทร',               'Petty Cash - Fines'),
    ('110108', 'เงินสดย่อย-ลาดกระบัง - พจส. คุณจุฑารัตน์',      'Petty Cash - Ladkrabang - Driver'),
    ('110109', 'เงินสดย่อย-สระบุรี - พจส. คุณกัลยณัฐ',          'Petty Cash - Saraburi - Driver'),
    ('110110', 'เงินสดย่อย-ลาดกระบัง - จป. คุณวรรณา',          'Petty Cash - Ladkrabang - Safety'),
    ('110111', 'เงินสดย่อย-ลาดกระบัง - บุคคล คุณณชญาดา',       'Petty Cash - Ladkrabang - HR')
ON CONFLICT (acc_code) DO NOTHING;

DO $$
DECLARE
    v_form_id integer;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM form_masters WHERE form_code = 'ADV') THEN
        INSERT INTO form_masters (form_type, form_code, form_name, form_status, need_approval,
                                  created_at, version, parent_form_id, is_latest)
        VALUES ('Advance', 'ADV', 'เบิกเงิน Advance', 'Active', true, now(), 1, NULL, true)
        RETURNING id INTO v_form_id;

        INSERT INTO form_questions (form_master_id, question_name, question_label, question_type,
                                    is_required, sort_order, created_at)
        VALUES
            (v_form_id, 'adv_purpose',  'เบิกเงิน Advance สำหรับ', 'longtext', true, 1, now()),
            (v_form_id, 'adv_amount',   'จำนวนเงิน',              'number',   true, 2, now()),
            (v_form_id, 'adv_use_date', 'วันที่ใช้เงิน',            'datetime', true, 3, now());

        -- ขั้นเดียว (level_no = 1 ทั้งคู่): ผู้ขอ 1–4 → ผู้อนุมัติ 5–6 · ผู้ขอ 5–6 → ผู้อนุมัติ 7–8
        -- ผู้ขอระดับ 7–9 ไม่เข้ากฎใด → อนุมัติอัตโนมัติ (พฤติกรรมเดิมของ engine, spec A6)
        INSERT INTO form_approval_rules (form_master_id, creator_min, creator_max, level_no, approve_by_type,
                                         approve_by_min, approve_by_max, same_department, is_active, created_at)
        VALUES
            (v_form_id, 1, 4, 1, 'position_level_range', 5, 6, true, true, now()),
            (v_form_id, 5, 6, 1, 'position_level_range', 7, 8, true, true, now());
    END IF;
END $$;

COMMIT;
```

- [ ] **Step 7: Dry-run only.** This prints the target and the SQL without executing anything.

```bash
set -a; source .env 2>/dev/null; set +a
DATABASE_URL="${DATABASE_URL:-postgresql://u:p@localhost:5432/x}" .venv/bin/python scripts/migrations/run_migration.py scripts/migrations/2026-09-28_finance_advance.sql --dry-run | head -5
```

Expected: `ไฟล์ :` and `ปลายทาง :` lines, then `--- dry run: ไม่ได้รันจริง ---`. **Do not run without `--dry-run`
in this task.**

- [ ] **Step 8: Commit**

```bash
git pull --rebase origin main
git add models/finance_model.py models/__init__.py scripts/migrations/2026-09-28_finance_advance.sql tests/finance/test_finance_model.py
git commit -m "feat(finance): fin_* models + idempotent migration with account and ADV form seeds

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: BE read side: repo, schemas, router (accounts + list/detail/summary), registration

**Files:**
- Create:
  - `services/finance/advance_repo.py`
  - `schemas/finance_schema.py`
  - `routes/finance/__init__.py` (empty)
  - `routes/finance/advance_routes.py`
  - `tests/finance/test_advance_repo.py`
  - `tests/finance/test_finance_schema.py`
- Modify: `main.py`, adding 1 import line after line 109 (`from routes.incident_analytics import ...`) and 2 lines
  after `app.include_router(atms_openjob_router)`.

**Interfaces:**
- Consumes: Task 1 `advance_logic`, Task 3 models.
- Produces:
  - `advance_repo.today_bkk() -> date`
  - `advance_repo.get_advance_submission(db, form_id) -> FormSubmission | None`
  - `advance_repo.serialize_advance(sub, adv, request: dict | None, people: dict, acc_names: dict, today: date) -> dict`
  - `advance_repo.list_advances(db, *, status=None, overdue=None, employee_id=None, acc_code=None, date_from=None, date_to=None) -> list[dict]`
  - `advance_repo.get_advance_detail(db, form_id) -> dict | None`
  - `advance_repo.outstanding_summary(db) -> dict`
  - `schemas.finance_schema`: `AccountCreate`, `AccountUpdate`, `PayIn`, `ClearIn`, `SendBackIn`, `ConfirmIn`
  - `routes.finance.advance_routes`: `router` (prefix `/finance`), `require_finance(db, employee_id) -> User`
  - JSON shape of one advance (the FE `AdvanceItem` type mirrors it):
    ```
    {form_id, submission_id, created_at, status_approve, status, status_label, overdue,
     requester:{employee_id,name,department,site,site_code},
     request:{purpose,amount,use_date},
     fin:null | {acc_code,acc_name,voucher_no,voucher_date,payment_doc_no,purpose,amount_paid,transfer_date,
                 clear_due_date,paid_by,paid_at,clear_date,amount_actual,clear_doc_no,settle_amount,settle_date,
                 remark,clear_submitted_at,review_remark,closed_by,closed_at,fin_status}}
    ```
    Detail adds:
    ```
    approval_logs:[{level_no,action,remark,action_at,actor_name}],
    fin_logs:[{action,changes,remark,action_by,created_at}]
    ```

- [ ] **Step 1: Write the failing tests**

`tests/finance/test_advance_repo.py`:

```python
import os
from datetime import date, datetime, timezone
from decimal import Decimal
from types import SimpleNamespace

os.environ.setdefault("DATABASE_URL", "postgresql://u:p@localhost:5432/x")

from services.finance import advance_repo as repo  # noqa: E402

SUB = SimpleNamespace(id=5, form_id="ADV-2026-0001", created_at=datetime(2026, 7, 7, 3, 0),
                      status_approve="Approved", created_by="670001")
PEOPLE = {"670001": {"employee_id": "670001", "name": "อรณภัชชา จัตุรัส", "department": "HR",
                     "site": "สำนักงานสระบุรี", "site_code": "สสบ."}}
REQUEST = {"purpose": "ค่าแอร์", "amount": Decimal("12740"), "use_date": datetime(2026, 7, 9)}


def _adv(**kw):
    base = dict(acc_code="110102", voucher_no="SADV2607-005", voucher_date=date(2026, 7, 7), payment_doc_no=None,
                purpose="ค่าแอร์", amount_paid=Decimal("12740.00"), transfer_date=date(2026, 7, 9),
                clear_due_date=date(2026, 7, 16), paid_by="680001", paid_at=datetime(2026, 7, 9, tzinfo=timezone.utc),
                clear_date=None, amount_actual=None, clear_doc_no=None, settle_amount=None, settle_date=None,
                remark=None, clear_submitted_at=None, review_remark=None, closed_by=None, closed_at=None,
                fin_status="PAID")
    base.update(kw)
    return SimpleNamespace(**base)


def test_awaiting_payment_without_fin_row():
    item = repo.serialize_advance(SUB, None, REQUEST, PEOPLE, {}, date(2026, 7, 8))
    assert item["status"] == "AWAITING_PAYMENT"
    assert item["status_label"] == "รอจ่าย"
    assert item["fin"] is None
    assert item["request"] == {"purpose": "ค่าแอร์", "amount": 12740.0, "use_date": "2026-07-09T00:00:00+00:00"}
    assert item["created_at"] == "2026-07-07T03:00:00+00:00"
    assert item["requester"]["site_code"] == "สสบ."


def test_paid_overdue_with_account_name():
    item = repo.serialize_advance(SUB, _adv(), REQUEST, PEOPLE, {"110102": "เงินสดย่อย-สระบุรี"}, date(2026, 7, 17))
    assert (item["status"], item["overdue"]) == ("AWAITING_CLEARING", True)
    assert item["fin"]["acc_name"] == "เงินสดย่อย-สระบุรี"
    assert item["fin"]["amount_paid"] == 12740.0
    assert item["fin"]["clear_due_date"] == "2026-07-16"


def test_unknown_requester_falls_back_to_employee_id():
    item = repo.serialize_advance(SUB, None, None, {}, {}, date(2026, 7, 8))
    assert item["requester"] == {"employee_id": "670001", "name": None, "department": None,
                                 "site": None, "site_code": None}
    assert item["request"] == {"purpose": None, "amount": None, "use_date": None}
```

`tests/finance/test_finance_schema.py`:

```python
from datetime import date
from decimal import Decimal

import pytest
from pydantic import ValidationError

from schemas.finance_schema import ClearIn, PayIn


def test_blank_strings_become_none():
    body = PayIn(action_by="680001", acc_code="110103", voucher_no="  ", amount_paid="1000",
                 transfer_date="2026-07-09")
    assert body.voucher_no is None
    assert body.amount_paid == Decimal("1000")
    assert body.transfer_date == date(2026, 7, 9)


def test_blank_action_by_rejected():
    with pytest.raises(ValidationError):
        ClearIn(action_by=" ", clear_date="2026-07-15", amount_actual="10")


def test_more_than_two_decimals_rejected():
    with pytest.raises(ValidationError):
        PayIn(action_by="680001", acc_code="110103", amount_paid="10.123", transfer_date="2026-07-09")
```

- [ ] **Step 2: Run them to verify they fail**

Run: `.venv/bin/pytest tests/finance/test_advance_repo.py tests/finance/test_finance_schema.py -q`
Expected: ImportError for `advance_repo` and `finance_schema`.

- [ ] **Step 3: Implement** `schemas/finance_schema.py`

```python
from datetime import date
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, Field, field_validator


class _Body(BaseModel):
    @field_validator("*", mode="before")
    @classmethod
    def _blank_to_none(cls, value):
        if isinstance(value, str):
            value = value.strip()
            return value or None
        return value


class AccountCreate(_Body):
    action_by: str
    acc_code: str = Field(max_length=20)
    acc_name: str = Field(max_length=255)
    acc_name_en: Optional[str] = Field(default=None, max_length=255)


class AccountUpdate(_Body):
    action_by: str
    acc_name: Optional[str] = Field(default=None, max_length=255)
    acc_name_en: Optional[str] = Field(default=None, max_length=255)
    is_active: Optional[bool] = None


class PayIn(_Body):
    action_by: str
    acc_code: str
    voucher_no: Optional[str] = Field(default=None, max_length=50)
    voucher_date: Optional[date] = None
    payment_doc_no: Optional[str] = Field(default=None, max_length=50)
    purpose: Optional[str] = None
    amount_paid: Decimal = Field(max_digits=12, decimal_places=2)
    transfer_date: date
    clear_due_date: Optional[date] = None


class ClearIn(_Body):
    action_by: str
    clear_date: date
    amount_actual: Decimal = Field(max_digits=12, decimal_places=2)
    clear_doc_no: Optional[str] = Field(default=None, max_length=100)
    settle_date: Optional[date] = None
    remark: Optional[str] = None


class SendBackIn(_Body):
    action_by: str
    review_remark: str


class ConfirmIn(_Body):
    action_by: str
    settle_date: Optional[date] = None
```

- [ ] **Step 4: Implement** `services/finance/advance_repo.py`

```python
"""DB reads + JSON shaping for the Finance advance-cash module. Business rules live in advance_logic."""
from __future__ import annotations

from datetime import date, datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo

from models.finance_model import FinAccount, FinAdvance, FinAdvanceLog
from models.master_model import FormApprovalLog, FormMaster, FormQuestion, FormSubmission, FormSubmissionValue
from models.user_model import Department, Site, User
from services.finance import advance_logic as logic

BKK = ZoneInfo("Asia/Bangkok")
ADVANCE_FORM_TYPE = "Advance"


def today_bkk() -> date:
    return datetime.now(BKK).date()


def _iso(value):
    if value is None:
        return None
    if isinstance(value, datetime) and value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)  # naive timestamps in ncacdb are UTC
    return value.isoformat()


def _num(value):
    return float(value) if value is not None else None


def _full_name(user):
    if user is None:
        return None
    return f"{user.firstname or ''} {user.lastname or ''}".strip() or None


def get_advance_submission(db, form_id):
    return (
        db.query(FormSubmission)
        .join(FormMaster, FormMaster.id == FormSubmission.form_master_id)
        .filter(FormMaster.form_type == ADVANCE_FORM_TYPE, FormSubmission.form_id == form_id)
        .first()
    )


def request_values_by_submission(db, submission_ids):
    if not submission_ids:
        return {}
    rows = (
        db.query(FormSubmissionValue, FormQuestion)
        .join(FormQuestion, FormQuestion.id == FormSubmissionValue.question_id)
        .filter(FormSubmissionValue.submission_id.in_(submission_ids))
        .all()
    )
    grouped = {}
    for value, question in rows:
        grouped.setdefault(value.submission_id, []).append({
            "name": question.question_name,
            "type": question.question_type,
            "sort_order": question.sort_order,
            "text": value.value_text,
            "number": value.value_number,
            "date": value.value_date,
        })
    return {sid: logic.pick_request_values(items) for sid, items in grouped.items()}


def people_by_employee_id(db, employee_ids):
    ids = {e for e in employee_ids if e}
    if not ids:
        return {}
    departments = {d.department_id: d.department_name_th for d in db.query(Department).all()}
    sites = {s.site_id: (s.site_name_th, s.site_code) for s in db.query(Site).all()}
    people = {}
    for user in db.query(User).filter(User.employee_id.in_(ids)).all():
        site_name, site_code = sites.get(user.site_id, (None, None))
        people[user.employee_id] = {
            "employee_id": user.employee_id,
            "name": _full_name(user),
            "department": departments.get(user.department_id),
            "site": site_name,
            "site_code": site_code,
        }
    return people


def account_names(db):
    return {a.acc_code: a.acc_name for a in db.query(FinAccount).all()}


def serialize_fin(adv, acc_names):
    if adv is None:
        return None
    return {
        "acc_code": adv.acc_code,
        "acc_name": acc_names.get(adv.acc_code),
        "voucher_no": adv.voucher_no,
        "voucher_date": _iso(adv.voucher_date),
        "payment_doc_no": adv.payment_doc_no,
        "purpose": adv.purpose,
        "amount_paid": _num(adv.amount_paid),
        "transfer_date": _iso(adv.transfer_date),
        "clear_due_date": _iso(adv.clear_due_date),
        "paid_by": adv.paid_by,
        "paid_at": _iso(adv.paid_at),
        "clear_date": _iso(adv.clear_date),
        "amount_actual": _num(adv.amount_actual),
        "clear_doc_no": adv.clear_doc_no,
        "settle_amount": _num(adv.settle_amount),
        "settle_date": _iso(adv.settle_date),
        "remark": adv.remark,
        "clear_submitted_at": _iso(adv.clear_submitted_at),
        "review_remark": adv.review_remark,
        "closed_by": adv.closed_by,
        "closed_at": _iso(adv.closed_at),
        "fin_status": adv.fin_status,
    }


def serialize_advance(sub, adv, request, people, acc_names, today):
    status, overdue = logic.derive_status(
        sub.status_approve,
        adv.fin_status if adv is not None else None,
        adv.clear_due_date if adv is not None else None,
        today,
    )
    request = request or {}
    requester = people.get(sub.created_by) or {
        "employee_id": sub.created_by, "name": None, "department": None, "site": None, "site_code": None,
    }
    return {
        "form_id": sub.form_id,
        "submission_id": sub.id,
        "created_at": _iso(sub.created_at),
        "status_approve": sub.status_approve,
        "status": status,
        "status_label": logic.STATUS_LABELS[status],
        "overdue": overdue,
        "requester": requester,
        "request": {
            "purpose": request.get("purpose"),
            "amount": _num(request.get("amount")),
            "use_date": _iso(request.get("use_date")),
        },
        "fin": serialize_fin(adv, acc_names),
    }


def list_advances(db, *, status=None, overdue=None, employee_id=None, acc_code=None, date_from=None, date_to=None):
    query = (
        db.query(FormSubmission, FinAdvance)
        .join(FormMaster, FormMaster.id == FormSubmission.form_master_id)
        .outerjoin(FinAdvance, FinAdvance.submission_id == FormSubmission.id)
        .filter(FormMaster.form_type == ADVANCE_FORM_TYPE)
    )
    if employee_id:
        query = query.filter(FormSubmission.created_by == employee_id)
    if acc_code:
        query = query.filter(FinAdvance.acc_code == acc_code)
    if date_from:
        query = query.filter(FormSubmission.created_at >= datetime.combine(date_from, time.min))
    if date_to:
        query = query.filter(FormSubmission.created_at < datetime.combine(date_to + timedelta(days=1), time.min))
    rows = query.order_by(FormSubmission.id.desc()).all()

    requests = request_values_by_submission(db, [sub.id for sub, _ in rows])
    people = people_by_employee_id(db, [sub.created_by for sub, _ in rows])
    acc_names = account_names(db)
    today = today_bkk()
    items = [serialize_advance(sub, adv, requests.get(sub.id), people, acc_names, today) for sub, adv in rows]
    if status:
        items = [item for item in items if item["status"] == status]
    if overdue is not None:
        items = [item for item in items if item["overdue"] == overdue]
    return items


def get_advance_detail(db, form_id):
    sub = get_advance_submission(db, form_id)
    if sub is None:
        return None
    adv = db.query(FinAdvance).filter(FinAdvance.submission_id == sub.id).first()
    item = serialize_advance(
        sub, adv,
        request_values_by_submission(db, [sub.id]).get(sub.id),
        people_by_employee_id(db, [sub.created_by]),
        account_names(db),
        today_bkk(),
    )
    approval_rows = (
        db.query(FormApprovalLog, User)
        .outerjoin(User, User.id == FormApprovalLog.action_by)
        .filter(FormApprovalLog.submission_id == sub.id)
        .order_by(FormApprovalLog.id.asc())
        .all()
    )
    item["approval_logs"] = [
        {"level_no": log.level_no, "action": log.action, "remark": log.remark,
         "action_at": _iso(log.action_at), "actor_name": _full_name(user)}
        for log, user in approval_rows
    ]
    fin_logs = []
    if adv is not None:
        fin_logs = [
            {"action": log.action, "changes": log.changes, "remark": log.remark,
             "action_by": log.action_by, "created_at": _iso(log.created_at)}
            for log in db.query(FinAdvanceLog).filter(FinAdvanceLog.advance_id == adv.id)
            .order_by(FinAdvanceLog.id.asc()).all()
        ]
    item["fin_logs"] = fin_logs
    return item


def outstanding_summary(db):
    items = [i for i in list_advances(db) if i["fin"] is not None and i["status"] != logic.CLOSED]
    by_employee, by_account = {}, {}
    for item in items:
        amount = item["fin"]["amount_paid"] or 0.0
        person = item["requester"]
        emp = by_employee.setdefault(person["employee_id"], {
            "employee_id": person["employee_id"], "name": person["name"], "department": person["department"],
            "count": 0, "amount_paid": 0.0, "overdue": 0,
        })
        emp["count"] += 1
        emp["amount_paid"] = round(emp["amount_paid"] + amount, 2)
        emp["overdue"] += 1 if item["overdue"] else 0
        acc = by_account.setdefault(item["fin"]["acc_code"], {
            "acc_code": item["fin"]["acc_code"], "acc_name": item["fin"]["acc_name"], "count": 0, "amount_paid": 0.0,
        })
        acc["count"] += 1
        acc["amount_paid"] = round(acc["amount_paid"] + amount, 2)
    return {
        "total_count": len(items),
        "total_amount": round(sum((i["fin"]["amount_paid"] or 0.0) for i in items), 2),
        "by_employee": sorted(by_employee.values(), key=lambda e: -e["amount_paid"]),
        "by_account": sorted(by_account.values(), key=lambda a: -a["amount_paid"]),
    }
```

- [ ] **Step 5: Implement** `routes/finance/advance_routes.py` (read side + accounts). Also create an empty
  `routes/finance/__init__.py`.

```python
"""Finance — เบิกเงิน Advance.

ยังไม่มี auth เหมือน route อื่นของ api-ncac ในตอนนี้ (ใช้ทดสอบ local เท่านั้น) — ต้องทำ launch gate
ด้านความปลอดภัยก่อนขึ้น production ดู spec §9 ใน menait-service
"""
import os
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from models.finance_model import FinAccount
from models.user_model import User
from schemas.finance_schema import AccountCreate, AccountUpdate
from services.finance import advance_logic as logic
from services.finance import advance_repo as repo

router = APIRouter(prefix="/finance", tags=["Finance - Advance"])


def _finance_ids():
    depts = [int(x) for x in logic.parse_id_list(os.getenv("FINANCE_DEPARTMENT_IDS", "4,6")) if x.isdigit()]
    emps = logic.parse_id_list(os.getenv("FINANCE_EMPLOYEE_IDS"))
    return depts, emps


def require_finance(db: Session, employee_id: str) -> User:
    user = db.query(User).filter(User.employee_id == employee_id).first()
    depts, emps = _finance_ids()
    if user is None or not logic.is_finance_user(user.department_id, user.employee_id, depts, emps):
        raise HTTPException(status_code=403, detail="เฉพาะฝ่ายการเงินเท่านั้น")
    return user


def _rule_error(exc: logic.AdvanceRuleError) -> HTTPException:
    return HTTPException(status_code=exc.http_status, detail=str(exc))


def _account_dict(acc: FinAccount) -> dict:
    return {"acc_code": acc.acc_code, "acc_name": acc.acc_name, "acc_name_en": acc.acc_name_en,
            "is_active": acc.is_active}


# ---------------------------- accounts ----------------------------

@router.get("/accounts")
def list_accounts(active: Optional[bool] = None, db: Session = Depends(get_db)):
    query = db.query(FinAccount)
    if active is not None:
        query = query.filter(FinAccount.is_active == active)
    return [_account_dict(a) for a in query.order_by(FinAccount.acc_code).all()]


@router.post("/accounts", status_code=201)
def create_account(body: AccountCreate, db: Session = Depends(get_db)):
    require_finance(db, body.action_by)
    if db.get(FinAccount, body.acc_code) is not None:
        raise HTTPException(status_code=409, detail="รหัสบัญชีนี้มีอยู่แล้ว")
    acc = FinAccount(acc_code=body.acc_code, acc_name=body.acc_name, acc_name_en=body.acc_name_en, is_active=True)
    db.add(acc)
    db.commit()
    return _account_dict(acc)


@router.put("/accounts/{acc_code}")
def update_account(acc_code: str, body: AccountUpdate, db: Session = Depends(get_db)):
    require_finance(db, body.action_by)
    acc = db.get(FinAccount, acc_code)
    if acc is None:
        raise HTTPException(status_code=404, detail="ไม่พบรหัสบัญชี")
    for field in ("acc_name", "acc_name_en", "is_active"):
        value = getattr(body, field)
        if value is not None:
            setattr(acc, field, value)
    db.commit()
    return _account_dict(acc)


# ---------------------------- advances (read) ----------------------------

@router.get("/advances")
def list_advances(
    status: Optional[str] = None,
    overdue: Optional[bool] = None,
    employee_id: Optional[str] = None,
    acc_code: Optional[str] = None,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    db: Session = Depends(get_db),
):
    return repo.list_advances(db, status=status, overdue=overdue, employee_id=employee_id,
                              acc_code=acc_code, date_from=date_from, date_to=date_to)


@router.get("/summary")
def summary(db: Session = Depends(get_db)):
    return repo.outstanding_summary(db)


@router.get("/advances/{form_id}")
def get_advance(form_id: str, db: Session = Depends(get_db)):
    detail = repo.get_advance_detail(db, form_id)
    if detail is None:
        raise HTTPException(status_code=404, detail="ไม่พบรายการเบิกเงิน")
    return detail
```

- [ ] **Step 6: Register the router in `main.py`**

After line `from routes.incident_analytics import router as incident_analytics_router` add:

```python
from routes.finance.advance_routes import router as finance_router
```

After line `app.include_router(atms_openjob_router)` add:

```python

# Finance — เบิกเงิน Advance
app.include_router(finance_router)
```

- [ ] **Step 7: Run the tests and an import check** (no DB connection; `main` is NOT imported because it runs `create_all`)

```bash
.venv/bin/pytest -q
DATABASE_URL=postgresql://u:p@localhost:5432/x .venv/bin/python -c "from routes.finance.advance_routes import router; print(sorted({r.path for r in router.routes}))"
```

Expected: all tests pass, and the print shows `/finance/accounts`, `/finance/accounts/{acc_code}`,
`/finance/advances`, `/finance/advances/{form_id}` and `/finance/summary`.

- [ ] **Step 8: Commit**

```bash
git pull --rebase origin main
git add services/finance/advance_repo.py schemas/finance_schema.py routes/finance main.py tests/finance/test_advance_repo.py tests/finance/test_finance_schema.py
git commit -m "feat(finance): /finance read endpoints (accounts, advances list/detail, summary)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: BE write side: pay, clear, send-back, confirm

**Files:**
- Modify: `routes/finance/advance_routes.py` (append)
- Test: `tests/finance/test_advance_routes_helpers.py`

**Interfaces:**
- Consumes: `logic.check_*`, `repo.get_advance_submission`, `repo.get_advance_detail`, `repo.today_bkk`,
  `require_finance`, and the schemas `PayIn`, `ClearIn`, `SendBackIn`, `ConfirmIn`.
- Produces:
  - `PUT /finance/advances/{form_id}/pay|clear|send-back|confirm`, each returning the same JSON as the detail endpoint.
  - Errors are returned as `{"detail": "<Thai message>"}` with 400, 403, 404 or 409.

- [ ] **Step 1: Write the failing test.** It covers the pure helpers extracted in this task.

`tests/finance/test_advance_routes_helpers.py`:

```python
import os
from datetime import date
from decimal import Decimal
from types import SimpleNamespace

os.environ.setdefault("DATABASE_URL", "postgresql://u:p@localhost:5432/x")

from routes.finance import advance_routes as r  # noqa: E402


def test_snapshot_of_missing_row_is_empty():
    assert r._snapshot(None, r.PAY_FIELDS) == {}


def test_snapshot_reads_listed_fields():
    adv = SimpleNamespace(clear_date=date(2026, 7, 15), amount_actual=Decimal("800"), clear_doc_no="R1",
                          settle_amount=Decimal("200"), settle_date=None, remark=None)
    assert r._snapshot(adv, r.CLEAR_FIELDS)["amount_actual"] == Decimal("800")


def test_pay_values_mapping():
    body = SimpleNamespace(acc_code="110103", voucher_no="SADV2607-005", voucher_date=date(2026, 7, 7),
                           payment_doc_no="PV1", purpose="x", amount_paid=Decimal("1000"),
                           transfer_date=date(2026, 7, 9))
    values = r._pay_values(body, date(2026, 7, 16))
    assert values["clear_due_date"] == date(2026, 7, 16)
    assert set(values) == set(r.PAY_FIELDS)
```

- [ ] **Step 2: Run it to verify it fails**

Run: `.venv/bin/pytest tests/finance/test_advance_routes_helpers.py -q`
Expected: FAIL with `AttributeError: module ... has no attribute '_snapshot'`.

- [ ] **Step 3: Implement.** Append to `routes/finance/advance_routes.py`, and extend its imports.

Change the imports at the top to:

```python
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError

from models.finance_model import FinAccount, FinAdvance, FinAdvanceLog
from schemas.finance_schema import AccountCreate, AccountUpdate, ClearIn, ConfirmIn, PayIn, SendBackIn
```

(Keep the other imports. Replace the old `from models.finance_model import FinAccount` and
`from schemas.finance_schema import AccountCreate, AccountUpdate` lines.)

Append:

```python
# ---------------------------- advances (write) ----------------------------

PAY_FIELDS = ("acc_code", "voucher_no", "voucher_date", "payment_doc_no", "purpose",
              "amount_paid", "transfer_date", "clear_due_date")
CLEAR_FIELDS = ("clear_date", "amount_actual", "clear_doc_no", "settle_amount", "settle_date", "remark")

_ALREADY_SAVED = "รายการนี้ถูกบันทึกไปแล้ว กรุณารีเฟรชหน้าจอ"


def _snapshot(adv, fields):
    return {field: getattr(adv, field) for field in fields} if adv is not None else {}


def _pay_values(body, due):
    return {
        "acc_code": body.acc_code,
        "voucher_no": body.voucher_no,
        "voucher_date": body.voucher_date,
        "payment_doc_no": body.payment_doc_no,
        "purpose": body.purpose,
        "amount_paid": body.amount_paid,
        "transfer_date": body.transfer_date,
        "clear_due_date": due,
    }


def _load_for_update(db: Session, form_id: str):
    sub = repo.get_advance_submission(db, form_id)
    if sub is None:
        raise HTTPException(status_code=404, detail="ไม่พบรายการเบิกเงิน")
    adv = db.query(FinAdvance).filter(FinAdvance.submission_id == sub.id).with_for_update().first()
    status, _ = logic.derive_status(
        sub.status_approve,
        adv.fin_status if adv is not None else None,
        adv.clear_due_date if adv is not None else None,
        repo.today_bkk(),
    )
    return sub, adv, status


def _commit_and_return(db: Session, form_id: str):
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail=_ALREADY_SAVED)
    return repo.get_advance_detail(db, form_id)


@router.put("/advances/{form_id}/pay")
def pay_advance(form_id: str, body: PayIn, db: Session = Depends(get_db)):
    require_finance(db, body.action_by)
    sub, adv, status = _load_for_update(db, form_id)
    account = db.get(FinAccount, body.acc_code)
    try:
        due = logic.check_pay(status, acc_active=bool(account and account.is_active), amount_paid=body.amount_paid,
                              transfer_date=body.transfer_date, clear_due_date=body.clear_due_date)
    except logic.AdvanceRuleError as exc:
        raise _rule_error(exc)

    values = _pay_values(body, due)
    before = _snapshot(adv, PAY_FIELDS)
    action = "PAY_EDIT" if adv is not None else "PAY"
    if adv is None:
        adv = FinAdvance(submission_id=sub.id, form_id=sub.form_id, fin_status=logic.FIN_PAID,
                         paid_by=body.action_by, paid_at=func.now())
        db.add(adv)
    for field, value in values.items():
        setattr(adv, field, value)
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail=_ALREADY_SAVED)
    db.add(FinAdvanceLog(advance_id=adv.id, action=action, changes=logic.diff_fields(before, values),
                         action_by=body.action_by))
    return _commit_and_return(db, form_id)


@router.put("/advances/{form_id}/clear")
def clear_advance(form_id: str, body: ClearIn, db: Session = Depends(get_db)):
    sub, adv, status = _load_for_update(db, form_id)
    if adv is None:
        raise HTTPException(status_code=409, detail="การเงินยังไม่ได้จ่ายเงิน จึงยังเคลียร์ไม่ได้")
    try:
        settle, settle_date = logic.check_clear(
            status, is_owner=(body.action_by == sub.created_by), amount_paid=adv.amount_paid,
            clear_date=body.clear_date, amount_actual=body.amount_actual, settle_date=body.settle_date)
    except logic.AdvanceRuleError as exc:
        raise _rule_error(exc)

    values = {"clear_date": body.clear_date, "amount_actual": body.amount_actual, "clear_doc_no": body.clear_doc_no,
              "settle_amount": settle, "settle_date": settle_date, "remark": body.remark}
    before = _snapshot(adv, CLEAR_FIELDS)
    action = "CLEAR_EDIT" if status == logic.AWAITING_REVIEW else "CLEAR_SUBMIT"
    for field, value in values.items():
        setattr(adv, field, value)
    adv.fin_status = logic.FIN_CLEARING_SUBMITTED
    adv.clear_submitted_at = func.now()
    db.add(FinAdvanceLog(advance_id=adv.id, action=action, changes=logic.diff_fields(before, values),
                         remark=body.remark, action_by=body.action_by))
    return _commit_and_return(db, form_id)


@router.put("/advances/{form_id}/send-back")
def send_back_advance(form_id: str, body: SendBackIn, db: Session = Depends(get_db)):
    require_finance(db, body.action_by)
    _, adv, status = _load_for_update(db, form_id)
    try:
        logic.check_send_back(status, review_remark=body.review_remark)
    except logic.AdvanceRuleError as exc:
        raise _rule_error(exc)
    adv.fin_status = logic.FIN_SENT_BACK
    adv.review_remark = body.review_remark
    db.add(FinAdvanceLog(advance_id=adv.id, action="SEND_BACK", remark=body.review_remark,
                         action_by=body.action_by))
    return _commit_and_return(db, form_id)


@router.put("/advances/{form_id}/confirm")
def confirm_advance(form_id: str, body: ConfirmIn, db: Session = Depends(get_db)):
    require_finance(db, body.action_by)
    _, adv, status = _load_for_update(db, form_id)
    try:
        extra_paid_on = logic.check_confirm(status, settle_amount=adv.settle_amount if adv is not None else None,
                                            settle_date=body.settle_date)
    except logic.AdvanceRuleError as exc:
        raise _rule_error(exc)
    changes = {}
    if extra_paid_on is not None:
        changes = logic.diff_fields({"settle_date": adv.settle_date}, {"settle_date": extra_paid_on})
        adv.settle_date = extra_paid_on
    adv.fin_status = logic.FIN_CLOSED
    adv.closed_by = body.action_by
    adv.closed_at = func.now()
    db.add(FinAdvanceLog(advance_id=adv.id, action="CONFIRM", changes=changes or None, action_by=body.action_by))
    return _commit_and_return(db, form_id)
```

- [ ] **Step 4: Run all BE tests**

Run: `.venv/bin/pytest -q`
Expected: all passed.

- [ ] **Step 5: Commit**

```bash
git pull --rebase origin main
git add routes/finance/advance_routes.py tests/finance/test_advance_routes_helpers.py
git commit -m "feat(finance): pay / clear / send-back / confirm endpoints with row lock and audit log

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: ⛔ GATED: migrate production `ncacdb`, boot the local BE, smoke test

**This task writes to production. The controller (not a subagent) runs it, and stops for explicit user approval at
Step 3.**

**Files:**
- Create: `~/Documents/project/ncac/api-ncac-finance/.env` (gitignored, never committed)

- [ ] **Step 1: Create the local BE `.env`.** Copy the values from `menait-service/.env.local`, and print only the key
  names back to the user.

```bash
cd ~/Documents/project/ncac/api-ncac-finance
FE=~/Documents/github/menait-service/.env.local
PG=$(grep -E '^POSTGRES_URL' "$FE" | sed -E "s/^[^=]*=[[:space:]]*['\"]?([^'\"]*)['\"]?.*/\1/")
GCID=$(grep -E '^GOOGLE_CLIENT_ID' "$FE" | sed -E "s/^[^=]*=[[:space:]]*['\"]?([^'\"]*)['\"]?.*/\1/")
cat > .env <<EOF
DATABASE_URL=$PG
GOOGLE_CLIENT_ID=$GCID
SECRET_KEY=$(python3 -c 'import secrets; print(secrets.token_hex(32))')
DB_POOL_SIZE=1
DB_MAX_OVERFLOW=1
ADVANCE_NOTIFY_ENABLED=false
FINANCE_DEPARTMENT_IDS=4,6
FINANCE_EMPLOYEE_IDS=
EOF
grep -oE '^[A-Z_]+' .env
grep -E '^(SMTP|LINE)' .env || echo "no SMTP/LINE keys (good)"
```

Ask the user for the employee ID(s) that should act as Finance testers, and set them in `FINANCE_EMPLOYEE_IDS=`.

- [ ] **Step 2: Read-only schema check.** Make sure the seed INSERTs match the real `form_*` columns.

```bash
set -a; source .env; set +a
.venv/bin/python - <<'PY'
import os, psycopg2
conn = psycopg2.connect(os.environ["DATABASE_URL"]); conn.set_session(readonly=True)
cur = conn.cursor()
cur.execute("""
  SELECT table_name, column_name, is_nullable, column_default
  FROM information_schema.columns
  WHERE table_name IN ('form_masters','form_questions','form_approval_rules')
    AND is_nullable = 'NO' AND column_default IS NULL
  ORDER BY table_name, ordinal_position""")
for row in cur.fetchall(): print(row)
cur.execute("SELECT count(*) FROM form_masters WHERE form_code='ADV'"); print("ADV exists:", cur.fetchone()[0])
cur.execute("SELECT to_regclass('fin_advances')"); print("fin_advances:", cur.fetchone()[0])
conn.close()
PY
```

Expected:
- Every NOT NULL column without a default appears in the migration's INSERT column lists (`id` is serial and has a
  default).
- `ADV exists: 0`.
- `fin_advances: None`.

If a required column is missing from an INSERT, add it to the migration, re-run Task 3 Step 7 and commit before
continuing.

- [ ] **Step 3: ⛔ STOP.** Show the user:
  1. the dry-run header from `run_migration.py ... --dry-run` (target host/db/user);
  2. the full SQL file;
  3. what it changes: 3 new empty tables, 11 account rows, and 1 form with 3 questions and 2 rules in `form_*`.

  **Wait for an explicit "yes".**

- [ ] **Step 4: Run the migration** (only after "yes")

```bash
set -a; source .env; set +a
.venv/bin/python scripts/migrations/run_migration.py scripts/migrations/2026-09-28_finance_advance.sql
```

Expected: `✅ migration สำเร็จ`.

- [ ] **Step 5: Verify the rows** (read-only)

```bash
.venv/bin/python - <<'PY'
import os, psycopg2
conn = psycopg2.connect(os.environ["DATABASE_URL"]); conn.set_session(readonly=True); cur = conn.cursor()
cur.execute("SELECT count(*) FROM fin_accounts"); print("accounts:", cur.fetchone()[0])
cur.execute("""SELECT m.id, m.form_type, m.form_status, count(DISTINCT q.id), count(DISTINCT r.id)
               FROM form_masters m LEFT JOIN form_questions q ON q.form_master_id=m.id
               LEFT JOIN form_approval_rules r ON r.form_master_id=m.id
               WHERE m.form_code='ADV' GROUP BY m.id"""); print("ADV:", cur.fetchall())
conn.close()
PY
```

Expected: `accounts: 11` and `ADV: [(<id>, 'Advance', 'Active', 3, 2)]`.

- [ ] **Step 6: Boot the BE on 8001** (as a background process) and run the smoke test

```bash
cd ~/Documents/project/ncac/api-ncac-finance && .venv/bin/uvicorn main:app --port 8001
```

When the log shows `Application startup complete`:

```bash
curl -s localhost:8001/finance/accounts | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d), d[2]['acc_code'])"
curl -s localhost:8001/forms/ADV | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['form_type'], [q['name'] for q in d['questions']])"
curl -s "localhost:8001/finance/advances" ; echo
curl -s -o /dev/null -w "%{http_code}\n" localhost:8001/finance/advances/ADV-0000-0000
```

Expected:
- `11 110103`
- `Advance ['adv_purpose', 'adv_amount', 'adv_use_date']`
- `[]`
- `404`

If boot fails because a module-level env var is missing, report the variable name to the user, then add only that key.

---

### Task 7: FE pure helpers + `is_finance` in the session

**Files:**
- Create: `lib/finance/status.ts`, `lib/finance/status.test.ts`, `lib/finance/role.ts`, `lib/finance/role.test.ts`
- Modify:
  - `tsconfig.json`: `"exclude": ["node_modules"]` → `"exclude": ["node_modules", "**/*.test.ts"]`
  - `app/context/SessionContext.tsx`: add 2 optional fields to `UserInfo`
  - `app/api/login/route.ts`: set `is_finance`

**Interfaces:**
- Produces:
  - `@/lib/finance/status` exports:
    - `type AdvanceStatus`, `STATUS_LABELS`, `STATUS_STYLES`, `CLEAR_DUE_DAYS`
    - `addDays(iso, n)`, `round2`, `parseAmount`, `computeSettle`, `settleLabel`
    - `formatBaht`, `formatDate`, `todayBkk`, `uniqueFileName`, `displayFileName`
  - `@/lib/finance/role` exports: `parseIdList`, `isFinanceUser`, `financeConfig`
  - `UserInfo.department_id?: number | null`, `UserInfo.is_finance?: boolean`

- [ ] **Step 1: Write the failing tests**

`lib/finance/status.test.ts`:

```ts
import { describe, expect, test } from 'bun:test';
import {
  STATUS_LABELS, addDays, computeSettle, displayFileName, formatBaht, formatDate, parseAmount,
  settleLabel, todayBkk, uniqueFileName,
} from './status';

describe('labels', () => {
  test('awaiting clearing label', () => expect(STATUS_LABELS.AWAITING_CLEARING).toBe('จ่ายแล้วรอเคลียร์'));
});

describe('addDays', () => {
  test('plus 7', () => expect(addDays('2026-06-25', 7)).toBe('2026-07-02'));
  test('crosses month end', () => expect(addDays('2026-06-28', 7)).toBe('2026-07-05'));
  test('invalid input gives empty string', () => expect(addDays('', 7)).toBe(''));
});

describe('parseAmount', () => {
  test('commas', () => expect(parseAmount('1,000.50')).toBe(1000.5));
  test('rounds to 2 decimals', () => expect(parseAmount('10.126')).toBe(10.13));
  test('blank is null, not zero', () => expect(parseAmount('  ')).toBeNull());
  test('garbage is null', () => expect(parseAmount('abc')).toBeNull());
  test('number passthrough', () => expect(parseAmount(4840)).toBe(4840));
});

describe('settle', () => {
  test('return', () => expect(computeSettle(1000, 800.5)).toBe(199.5));
  test('extra', () => expect(computeSettle(1000, 1250)).toBe(-250));
  test('labels', () => {
    expect(settleLabel(1)).toBe('รับคืน');
    expect(settleLabel(-1)).toBe('เบิกเพิ่ม');
    expect(settleLabel(0)).toBe('พอดี (ไม่มียอดคงค้าง)');
    expect(settleLabel(null)).toBe('-');
  });
});

describe('formatting', () => {
  test('baht', () => expect(formatBaht(12740)).toBe('12,740.00'));
  test('baht null', () => expect(formatBaht(null)).toBe('-'));
  test('date-only never shifts', () => expect(formatDate('2026-07-09')).toBe('09/07/26'));
  test('UTC datetime shown in Bangkok', () => expect(formatDate('2026-07-08T18:30:00+00:00')).toBe('09/07/26'));
  test('empty', () => expect(formatDate(null)).toBe('-'));
  test('todayBkk after 17:00 UTC is next day', () =>
    expect(todayBkk(new Date('2026-07-08T17:30:00Z'))).toBe('2026-07-09'));
});

describe('file names', () => {
  test('same name gets unique key', () => {
    expect(uniqueFileName('slip.jpg', 1751980000000)).toBe('1751980000000-slip.jpg');
    expect(uniqueFileName('a/b.pdf', 1)).toBe('1-a_b.pdf');
  });
  test('display strips prefix', () => expect(displayFileName('1751980000000-slip.jpg')).toBe('slip.jpg'));
});
```

`lib/finance/role.test.ts`:

```ts
import { describe, expect, test } from 'bun:test';
import { financeConfig, isFinanceUser, parseIdList } from './role';

describe('role', () => {
  test('parse', () => expect(parseIdList(' 4, 6 ,,')).toEqual(['4', '6']));
  test('department member', () => expect(isFinanceUser({ department_id: 6, employee_id: '1' }, ['4', '6'], [])).toBe(true));
  test('employee override', () => expect(isFinanceUser({ department_id: 21, employee_id: '680043' }, ['4', '6'], ['680043'])).toBe(true));
  test('not finance', () => expect(isFinanceUser({ department_id: 21, employee_id: '1' }, ['4', '6'], [])).toBe(false));
  test('missing data', () => expect(isFinanceUser({}, ['4', '6'], [])).toBe(false));
  test('config default', () => expect(financeConfig({}).deptIds).toEqual(['4', '6']));
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `cd ~/Documents/github/menait-service && bun test lib/finance`
Expected: FAIL with `Cannot find module './status'` and `'./role'`.

- [ ] **Step 3: Implement** `lib/finance/status.ts`

```ts
export type AdvanceStatus =
  | 'PENDING_APPROVAL' | 'REJECTED' | 'AWAITING_PAYMENT' | 'AWAITING_CLEARING'
  | 'SENT_BACK' | 'AWAITING_REVIEW' | 'CLOSED';

export const STATUS_LABELS: Record<AdvanceStatus, string> = {
  PENDING_APPROVAL: 'รออนุมัติ',
  REJECTED: 'ไม่อนุมัติ',
  AWAITING_PAYMENT: 'รอจ่าย',
  AWAITING_CLEARING: 'จ่ายแล้วรอเคลียร์',
  SENT_BACK: 'ส่งกลับแก้ไข',
  AWAITING_REVIEW: 'รอการเงินตรวจ',
  CLOSED: 'ปิดแล้ว',
};

export const STATUS_STYLES: Record<AdvanceStatus, string> = {
  PENDING_APPROVAL: 'bg-amber-50 text-amber-700 border-amber-200',
  REJECTED: 'bg-rose-50 text-rose-700 border-rose-200',
  AWAITING_PAYMENT: 'bg-sky-50 text-sky-700 border-sky-200',
  AWAITING_CLEARING: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  SENT_BACK: 'bg-orange-50 text-orange-700 border-orange-200',
  AWAITING_REVIEW: 'bg-violet-50 text-violet-700 border-violet-200',
  CLOSED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

export const CLEAR_DUE_DAYS = 7;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** 'YYYY-MM-DD' + n days → 'YYYY-MM-DD' (calendar math in UTC so the date never drifts) */
export function addDays(isoDate: string, days: number): string {
  if (!ISO_DATE.test(isoDate)) return '';
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** '1,000.50' → 1000.5 · blank/invalid → null (blank is "missing", never 0) */
export function parseAmount(raw: string | number | null | undefined): number | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === 'number') return Number.isFinite(raw) ? round2(raw) : null;
  const cleaned = raw.replace(/,/g, '').trim();
  if (cleaned === '') return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? round2(n) : null;
}

/** รับคืน (+) / เบิกเพิ่ม (−) = paid − actual */
export function computeSettle(amountPaid: number, amountActual: number): number {
  return round2(amountPaid - amountActual);
}

export function settleLabel(settle: number | null | undefined): string {
  if (settle === null || settle === undefined) return '-';
  if (settle > 0) return 'รับคืน';
  if (settle < 0) return 'เบิกเพิ่ม';
  return 'พอดี (ไม่มียอดคงค้าง)';
}

const BAHT = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function formatBaht(n: number | null | undefined): string {
  return n === null || n === undefined ? '-' : BAHT.format(n);
}

/** dd/MM/yy like the Finance Excel sheet. Date-only strings are never shifted by timezone. */
export function formatDate(value: string | null | undefined): string {
  if (!value) return '-';
  if (ISO_DATE.test(value)) {
    const [y, m, d] = value.split('-');
    return `${d}/${m}/${y.slice(2)}`;
  }
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return '-';
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Bangkok', day: '2-digit', month: '2-digit', year: '2-digit',
  }).formatToParts(dt);
  const part = (t: string) => parts.find(p => p.type === t)?.value ?? '';
  return `${part('day')}/${part('month')}/${part('year')}`;
}

/** Today in Bangkok as 'YYYY-MM-DD' */
export function todayBkk(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' }).format(now);
}

/** S3 key-safe, collision-free file name: '<epochMs>-<name>' */
export function uniqueFileName(name: string, epochMs: number): string {
  return `${epochMs}-${name.replace(/[\\/]/g, '_')}`;
}

export function displayFileName(fileName: string): string {
  return fileName.replace(/^\d{10,}-/, '');
}
```

- [ ] **Step 4: Implement** `lib/finance/role.ts`

```ts
export function parseIdList(raw: string | undefined | null): string[] {
  return (raw ?? '').split(',').map(s => s.trim()).filter(Boolean);
}

export function isFinanceUser(
  user: { department_id?: number | null; employee_id?: string | null },
  deptIds: string[],
  employeeIds: string[],
): boolean {
  const dept = user.department_id;
  if (dept !== null && dept !== undefined && deptIds.includes(String(dept))) return true;
  return !!user.employee_id && employeeIds.includes(user.employee_id);
}

export function financeConfig(env: Record<string, string | undefined> = process.env) {
  return {
    deptIds: parseIdList(env.FINANCE_DEPARTMENT_IDS ?? '4,6'),
    employeeIds: parseIdList(env.FINANCE_EMPLOYEE_IDS),
  };
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `bun test lib/finance`
Expected: all pass.

- [ ] **Step 6: Wire the session.**

In `tsconfig.json`, change `"exclude": ["node_modules"]` to `"exclude": ["node_modules", "**/*.test.ts"]`.

In `app/context/SessionContext.tsx`, inside `export interface UserInfo {`, after `image_url?: string | null;` add:

```ts
  department_id?: number | null;
  is_finance?: boolean;
```

In `app/api/login/route.ts`, add the import:

```ts
import { financeConfig, isFinanceUser } from '@/lib/finance/role';
```

Then directly after the `data.user.role = ...;` statement add:

```ts
        const finance = financeConfig();
        data.user.is_finance = isFinanceUser(data.user, finance.deptIds, finance.employeeIds);
```

- [ ] **Step 7: Type-check**

Run: `bunx tsc --noEmit`
Expected: exit 0 and no output.

- [ ] **Step 8: Commit**

```bash
git pull --rebase origin main
git add lib/finance tsconfig.json app/context/SessionContext.tsx app/api/login/route.ts
git commit -m "feat(finance): pure FE helpers + is_finance flag in session

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: FE server guard + `/api/finance/*` proxy routes + S3 folders

**Files:**
- Create:
  - `lib/finance/server.ts`
  - `app/api/finance/accounts/route.ts`
  - `app/api/finance/advances/route.ts`
  - `app/api/finance/advances/[form_id]/route.ts`
  - `app/api/finance/summary/route.ts`
- Modify: `app/api/uploads3/route.ts`

**Interfaces:**
- Consumes: `verifyToken`, `COOKIE_NAME` (`@/lib/jwt`), `UserInfo.is_finance` (Task 7). BE endpoints from Tasks 4 and 5.
- Produces:
  - `GET /api/finance/accounts?active=`: any logged-in user.
  - `POST` and `PUT /api/finance/accounts`: Finance only. PUT takes a body with `acc_code`.
  - `GET /api/finance/advances`: Finance only, with filters `status`, `overdue`, `employee_id`, `acc_code`,
    `date_from`, `date_to`. `?mine=1` works for any user and is scoped to their own `employee_id`.
  - `GET /api/finance/advances/{form_id}`: the owner or Finance.
  - `PUT /api/finance/advances/{form_id}` with body `{action: 'pay' | 'clear' | 'send-back' | 'confirm', ...fields}`.
    `clear` is for the owner; the other actions are Finance only. `action_by` is always taken from the session.
  - `GET /api/finance/summary`: Finance only.
  - `/api/uploads3`: POST accepts an optional `folder` ∈ {`pay`, `clear`, `check`}. The GET listing adds
    `folder: 'request' | 'pay' | 'clear' | 'check'` to each file.

- [ ] **Step 1: Implement** `lib/finance/server.ts`

```ts
import { NextResponse, type NextRequest } from 'next/server';
import { verifyToken, COOKIE_NAME } from '@/lib/jwt';
import type { UserInfo } from '@/app/context/SessionContext';

export type Guard = { user: UserInfo } | { error: NextResponse };

export async function requireUser(req: NextRequest): Promise<Guard> {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  const user = token ? await verifyToken(token) : null;
  if (!user?.employee_id) {
    return { error: NextResponse.json({ error: 'กรุณาเข้าสู่ระบบ' }, { status: 401 }) };
  }
  return { user };
}

export async function requireFinance(req: NextRequest): Promise<Guard> {
  const guard = await requireUser(req);
  if ('error' in guard) return guard;
  if (!guard.user.is_finance) {
    return { error: NextResponse.json({ error: 'เฉพาะฝ่ายการเงินเท่านั้น' }, { status: 403 }) };
  }
  return guard;
}

export function beUrl(path: string, query: Record<string, string | null | undefined> = {}): string {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== null && value !== undefined && value !== '') qs.set(key, value);
  }
  const suffix = qs.toString();
  return `${process.env.URL_API}${path}${suffix ? `?${suffix}` : ''}`;
}

export async function proxy(url: string, init: RequestInit = {}): Promise<NextResponse> {
  try {
    const res = await fetch(url, {
      ...init,
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}) },
    });
    const text = await res.text();
    let data: any = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = { detail: text }; }
    if (!res.ok) {
      const detail = typeof data?.detail === 'string' ? data.detail : 'ข้อมูลไม่ถูกต้อง';
      return NextResponse.json({ error: detail }, { status: res.status });
    }
    return NextResponse.json(data);
  } catch (err) {
    console.error('finance proxy error:', err);
    return NextResponse.json({ error: 'ไม่สามารถเชื่อมต่อระบบได้' }, { status: 502 });
  }
}
```

- [ ] **Step 2: Implement** `app/api/finance/accounts/route.ts`

```ts
import { NextResponse, type NextRequest } from 'next/server';
import { beUrl, proxy, requireFinance, requireUser } from '@/lib/finance/server';

export async function GET(req: NextRequest) {
  const guard = await requireUser(req);
  if ('error' in guard) return guard.error;
  return proxy(beUrl('/finance/accounts', { active: req.nextUrl.searchParams.get('active') }));
}

export async function POST(req: NextRequest) {
  const guard = await requireFinance(req);
  if ('error' in guard) return guard.error;
  const body = await req.json();
  return proxy(beUrl('/finance/accounts'), {
    method: 'POST',
    body: JSON.stringify({ ...body, action_by: guard.user.employee_id }),
  });
}

export async function PUT(req: NextRequest) {
  const guard = await requireFinance(req);
  if ('error' in guard) return guard.error;
  const { acc_code, ...rest } = await req.json();
  if (!acc_code) return NextResponse.json({ error: 'ไม่มีรหัสบัญชี' }, { status: 400 });
  return proxy(beUrl(`/finance/accounts/${encodeURIComponent(acc_code)}`), {
    method: 'PUT',
    body: JSON.stringify({ ...rest, action_by: guard.user.employee_id }),
  });
}
```

- [ ] **Step 3: Implement** `app/api/finance/advances/route.ts`

```ts
import type { NextRequest } from 'next/server';
import { beUrl, proxy, requireFinance, requireUser } from '@/lib/finance/server';

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  if (sp.get('mine') === '1') {
    const guard = await requireUser(req);
    if ('error' in guard) return guard.error;
    return proxy(beUrl('/finance/advances', { employee_id: guard.user.employee_id }));
  }
  const guard = await requireFinance(req);
  if ('error' in guard) return guard.error;
  return proxy(beUrl('/finance/advances', {
    status: sp.get('status'),
    overdue: sp.get('overdue'),
    employee_id: sp.get('employee_id'),
    acc_code: sp.get('acc_code'),
    date_from: sp.get('date_from'),
    date_to: sp.get('date_to'),
  }));
}
```

- [ ] **Step 4: Implement** `app/api/finance/advances/[form_id]/route.ts`

```ts
import { NextResponse, type NextRequest } from 'next/server';
import { beUrl, proxy, requireFinance, requireUser } from '@/lib/finance/server';

const FINANCE_ACTIONS = new Set(['pay', 'send-back', 'confirm']);

type Ctx = { params: Promise<{ form_id: string }> };

export async function GET(req: NextRequest, { params }: Ctx) {
  const guard = await requireUser(req);
  if ('error' in guard) return guard.error;
  const { form_id } = await params;
  try {
    const res = await fetch(beUrl(`/finance/advances/${encodeURIComponent(form_id)}`), { cache: 'no-store' });
    const data = await res.json().catch(() => null);
    if (!res.ok) return NextResponse.json({ error: data?.detail ?? 'ไม่พบรายการ' }, { status: res.status });
    if (!guard.user.is_finance && data?.requester?.employee_id !== guard.user.employee_id) {
      return NextResponse.json({ error: 'ไม่มีสิทธิ์ดูรายการนี้' }, { status: 403 });
    }
    return NextResponse.json(data);
  } catch (err) {
    console.error('GET finance advance error:', err);
    return NextResponse.json({ error: 'ไม่สามารถเชื่อมต่อระบบได้' }, { status: 502 });
  }
}

export async function PUT(req: NextRequest, { params }: Ctx) {
  const { form_id } = await params;
  const { action, ...fields } = await req.json();
  if (action !== 'clear' && !FINANCE_ACTIONS.has(action)) {
    return NextResponse.json({ error: 'action ไม่ถูกต้อง' }, { status: 400 });
  }
  const guard = action === 'clear' ? await requireUser(req) : await requireFinance(req);
  if ('error' in guard) return guard.error;
  return proxy(beUrl(`/finance/advances/${encodeURIComponent(form_id)}/${action}`), {
    method: 'PUT',
    body: JSON.stringify({ ...fields, action_by: guard.user.employee_id }),
  });
}
```

- [ ] **Step 5: Implement** `app/api/finance/summary/route.ts`

```ts
import type { NextRequest } from 'next/server';
import { beUrl, proxy, requireFinance } from '@/lib/finance/server';

export async function GET(req: NextRequest) {
  const guard = await requireFinance(req);
  if ('error' in guard) return guard.error;
  return proxy(beUrl('/finance/summary'));
}
```

- [ ] **Step 6: Add S3 folders** in `app/api/uploads3/route.ts`

1. Below `const BASE_PATH = 'menait-service';` add:

```ts
const ALLOWED_FOLDERS = ['pay', 'clear', 'check'];
```

2. In `POST`, after `const form_id = formData.get('form_id') as string;` add:

```ts
  const folder = ((formData.get('folder') as string | null) ?? '').trim();
  if (folder && !ALLOWED_FOLDERS.includes(folder)) {
    return NextResponse.json({ error: 'โฟลเดอร์ไม่ถูกต้อง' }, { status: 400 });
  }
```

3. Replace the line `const fileName = \`${BASE_PATH}/${form_id}/${file.name}\`;` with:

```ts
  const fileName = folder
    ? `${BASE_PATH}/${form_id}/${folder}/${file.name}`
    : `${BASE_PATH}/${form_id}/${file.name}`;
```

4. In `GET`, inside the `.map(async (obj) => {` callback, replace the returned object with:

```ts
        const relative = obj.Key.slice(folderPath.length);
        return {
          key: obj.Key,
          fileName: obj.Key.split('/').pop(),
          url: signedUrl,
          size: obj.Size,
          lastModified: obj.LastModified,
          folder: relative.includes('/') ? relative.split('/')[0] : 'request',
        };
```

- [ ] **Step 7: Type-check and verify the guards** against the dev server. It must run on port 4000 with
  `URL_API=http://localhost:8001` in `.env.local` (Task 6 BE running). Restart the dev server after editing
  `.env.local`.

```bash
bunx tsc --noEmit
curl -s -o /dev/null -w "%{http_code}\n" localhost:4000/api/finance/advances
curl -s -o /dev/null -w "%{http_code}\n" "localhost:4000/api/finance/advances?mine=1"
curl -s -o /dev/null -w "%{http_code}\n" -X PUT -H 'Content-Type: application/json' -d '{"action":"hack"}' localhost:4000/api/finance/advances/ADV-2026-0001
```

Expected: tsc exits 0 with no output. The three curls return `401`, `401`, `400`.

- [ ] **Step 8: Commit**

```bash
git pull --rebase origin main
git add lib/finance/server.ts app/api/finance app/api/uploads3/route.ts
git commit -m "feat(finance): guarded /api/finance proxy routes + S3 step folders

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: FE shared finance UI + menu + builder option + Excel export

**Files:**
- Create:
  - `app/finance/types.ts`, `app/finance/labels.ts`, `app/finance/api.ts`
  - `app/finance/components/FinanceShell.tsx`, `StatusBadge.tsx`, `FilePicker.tsx`, `AttachmentPanel.tsx`,
    `AdvanceSummary.tsx`, `LogList.tsx`
  - `lib/finance/export.ts`, `lib/finance/export.test.ts`
- Modify: `components/navbar.tsx`, `app/builder/[[...slug]]/page.tsx`

**Interfaces:**
- Consumes: Task 7 helpers, Task 8 API routes.
- Produces:
  - Types: `AdvanceItem`, `AdvanceDetail`, `FinInfo`, `FinAccount`, `AttachmentFile`, `ApprovalLog`, `FinLog`.
  - `fetchJson<T>(url, init?)`, `putAction(formId, action, body)`, `uploadFiles(formId, files, folder?)` → returns
    the failed file names. `showAlert(opts)`.
  - Components:
    - `<FinanceShell title wide?>`
    - `<StatusBadge status overdue?>`
    - `<FilePicker files onChange disabled? maxSizeMB?>`
    - `<AttachmentPanel formId folder canUpload? refreshKey?>`
    - `<AdvanceSummary item>`
    - `<LogList approvalLogs finLogs>`
  - `toSheetRows(items)`, `exportAdvancesXlsx(items, fileName)`, `EXPORT_COLUMNS`.

- [ ] **Step 1: Write the failing export test** in `lib/finance/export.test.ts`

```ts
import { expect, test } from 'bun:test';
import { EXPORT_COLUMNS, toSheetRows } from './export';
import type { AdvanceItem } from '@/app/finance/types';

const item: AdvanceItem = {
  form_id: 'ADV-2026-0001', submission_id: 5, created_at: '2026-07-07T03:00:00+00:00', status_approve: 'Approved',
  status: 'AWAITING_CLEARING', status_label: 'จ่ายแล้วรอเคลียร์', overdue: true,
  requester: { employee_id: '670001', name: 'อรณภัชชา จัตุรัส', department: 'HR', site: 'สำนักงานสระบุรี', site_code: 'สสบ.' },
  request: { purpose: 'ค่าแอร์', amount: 12740, use_date: '2026-07-09T00:00:00+00:00' },
  fin: {
    acc_code: '110102', acc_name: 'เงินสดย่อย-สระบุรี', voucher_no: 'SADV2607-005', voucher_date: '2026-07-07',
    payment_doc_no: null, purpose: 'ค่าแอร์', amount_paid: 12740, transfer_date: '2026-07-09', clear_due_date: '2026-07-16',
    paid_by: '680001', paid_at: null, clear_date: null, amount_actual: null, clear_doc_no: null, settle_amount: null,
    settle_date: null, remark: null, clear_submitted_at: null, review_remark: null, closed_by: null, closed_at: null,
    fin_status: 'PAID',
  },
};

test('rows follow the Excel sheet columns', () => {
  const [row] = toSheetRows([item]);
  expect(Object.keys(row)).toEqual([...EXPORT_COLUMNS]);
  expect(row['ลำดับ']).toBe(1);
  expect(row['ศูนย์']).toBe('สสบ.');
  expect(row['สถานะ']).toBe('จ่ายแล้วรอเคลียร์ (เกินกำหนด)');
  expect(row['วันที่โอนเงิน']).toBe('09/07/26');
  expect(row['กำหนดการเคลียร์']).toBe('16/07/26');
  expect(row['ยอดเงิน']).toBe(12740);
  expect(row['วันที่เคลียร์']).toBe('');
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `bun test lib/finance/export.test.ts`
Expected: FAIL, cannot find `./export` / `@/app/finance/types`.

- [ ] **Step 3: Implement** `app/finance/types.ts`

```ts
import type { AdvanceStatus } from '@/lib/finance/status';

export interface Requester {
  employee_id: string;
  name: string | null;
  department: string | null;
  site: string | null;
  site_code: string | null;
}

export interface FinInfo {
  acc_code: string | null;
  acc_name: string | null;
  voucher_no: string | null;
  voucher_date: string | null;
  payment_doc_no: string | null;
  purpose: string | null;
  amount_paid: number;
  transfer_date: string;
  clear_due_date: string;
  paid_by: string | null;
  paid_at: string | null;
  clear_date: string | null;
  amount_actual: number | null;
  clear_doc_no: string | null;
  settle_amount: number | null;
  settle_date: string | null;
  remark: string | null;
  clear_submitted_at: string | null;
  review_remark: string | null;
  closed_by: string | null;
  closed_at: string | null;
  fin_status: string;
}

export interface AdvanceItem {
  form_id: string;
  submission_id: number;
  created_at: string | null;
  status_approve: string;
  status: AdvanceStatus;
  status_label: string;
  overdue: boolean;
  requester: Requester;
  request: { purpose: string | null; amount: number | null; use_date: string | null };
  fin: FinInfo | null;
}

export interface ApprovalLog {
  level_no: number;
  action: string;
  remark: string | null;
  action_at: string | null;
  actor_name: string | null;
}

export interface FinLog {
  action: string;
  changes: Record<string, [unknown, unknown]> | null;
  remark: string | null;
  action_by: string | null;
  created_at: string | null;
}

export interface AdvanceDetail extends AdvanceItem {
  approval_logs: ApprovalLog[];
  fin_logs: FinLog[];
}

export interface FinAccount {
  acc_code: string;
  acc_name: string;
  acc_name_en: string | null;
  is_active: boolean;
}

export type AttachmentFolder = 'request' | 'pay' | 'clear' | 'check';

export interface AttachmentFile {
  key: string;
  fileName: string;
  url: string;
  size: number;
  lastModified: string;
  folder: AttachmentFolder;
}
```

- [ ] **Step 4: Implement** `lib/finance/export.ts`

```ts
import type { AdvanceItem } from '@/app/finance/types';
import { formatDate } from './status';

export const EXPORT_COLUMNS = [
  'ลำดับ', 'เลขที่เอกสาร', 'ผู้เบิก', 'แผนก', 'ศูนย์', 'สถานะ', 'เลขที่ใบเบิก', 'วันที่ตั้งเบิก', 'วันที่ใช้เงิน',
  'เลขที่เอกสารจ่าย', 'วัตถุประสงค์', 'ยอดเงิน', 'วันที่โอนเงิน', 'กำหนดการเคลียร์', 'วันที่เคลียร์', 'ยอดใช้จริง',
  'เอกสารเคลียร์', 'รับคืน (เบิกเพิ่ม)', 'วันที่โอนเงินคืน', 'หมายเหตุ', 'รหัสบัญชี',
] as const;

type Row = Record<(typeof EXPORT_COLUMNS)[number], string | number | null>;

const d = (value: string | null | undefined) => (value ? formatDate(value) : '');

export function toSheetRows(items: AdvanceItem[]): Row[] {
  return items.map((it, idx) => ({
    'ลำดับ': idx + 1,
    'เลขที่เอกสาร': it.form_id,
    'ผู้เบิก': it.requester.name ?? it.requester.employee_id,
    'แผนก': it.requester.department ?? '',
    'ศูนย์': it.requester.site_code ?? it.requester.site ?? '',
    'สถานะ': it.status_label + (it.overdue ? ' (เกินกำหนด)' : ''),
    'เลขที่ใบเบิก': it.fin?.voucher_no ?? '',
    'วันที่ตั้งเบิก': d(it.fin?.voucher_date),
    'วันที่ใช้เงิน': d(it.request.use_date),
    'เลขที่เอกสารจ่าย': it.fin?.payment_doc_no ?? '',
    'วัตถุประสงค์': it.fin?.purpose ?? it.request.purpose ?? '',
    'ยอดเงิน': it.fin?.amount_paid ?? it.request.amount ?? null,
    'วันที่โอนเงิน': d(it.fin?.transfer_date),
    'กำหนดการเคลียร์': d(it.fin?.clear_due_date),
    'วันที่เคลียร์': d(it.fin?.clear_date),
    'ยอดใช้จริง': it.fin?.amount_actual ?? null,
    'เอกสารเคลียร์': it.fin?.clear_doc_no ?? '',
    'รับคืน (เบิกเพิ่ม)': it.fin?.settle_amount ?? null,
    'วันที่โอนเงินคืน': d(it.fin?.settle_date),
    'หมายเหตุ': it.fin?.remark ?? '',
    'รหัสบัญชี': it.fin?.acc_code ?? '',
  }));
}

export async function exportAdvancesXlsx(items: AdvanceItem[], fileName: string): Promise<void> {
  const XLSX = await import('xlsx');
  const sheet = XLSX.utils.json_to_sheet(toSheetRows(items), { header: [...EXPORT_COLUMNS] });
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, 'Advance');
  XLSX.writeFile(book, fileName);
}
```

- [ ] **Step 5: Run the export test to verify it passes**

Run: `bun test lib/finance`
Expected: all pass.

- [ ] **Step 6: Implement** `app/finance/labels.ts` and `app/finance/api.ts`

`app/finance/labels.ts`:

```ts
export const FIELD_LABELS: Record<string, string> = {
  acc_code: 'รหัสบัญชี', voucher_no: 'เลขที่ใบเบิก', voucher_date: 'วันที่ตั้งเบิก', payment_doc_no: 'เลขที่เอกสารจ่าย',
  purpose: 'วัตถุประสงค์', amount_paid: 'ยอดเงิน', transfer_date: 'วันที่โอนเงิน', clear_due_date: 'กำหนดการเคลียร์',
  clear_date: 'วันที่เคลียร์', amount_actual: 'ยอดใช้จริง', clear_doc_no: 'เอกสารเคลียร์',
  settle_amount: 'รับคืน (เบิกเพิ่ม)', settle_date: 'วันที่โอนเงินคืน', remark: 'หมายเหตุ',
};

export const LOG_ACTION_LABELS: Record<string, string> = {
  PAY: 'บันทึกการจ่ายเงิน', PAY_EDIT: 'แก้ไขข้อมูลการจ่าย', CLEAR_SUBMIT: 'ส่งเคลียร์เงิน',
  CLEAR_EDIT: 'แก้ไขข้อมูลเคลียร์', SEND_BACK: 'ส่งกลับแก้ไข', CONFIRM: 'ยืนยันปิดรายการ',
  APPROVED: 'อนุมัติ', REJECTED: 'ไม่อนุมัติ',
};

export const FOLDER_LABELS: Record<string, string> = {
  request: 'เอกสารประกอบการขอเบิก', pay: 'หลักฐานการจ่ายเงิน', clear: 'เอกสารเคลียร์ / สลิปคืนเงิน',
  check: 'หลักฐานการเงิน (จ่ายเพิ่ม)',
};
```

`app/finance/api.ts`:

```ts
'use client';

import { uniqueFileName } from '@/lib/finance/status';
import type { AdvanceDetail } from './types';

export async function fetchJson<T>(url: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(url, {
    cache: 'no-store',
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error ?? `เกิดข้อผิดพลาด (${res.status})`);
  return data as T;
}

export type AdvanceAction = 'pay' | 'clear' | 'send-back' | 'confirm';

export function putAction(formId: string, action: AdvanceAction, body: Record<string, unknown>) {
  return fetchJson<AdvanceDetail>(`/api/finance/advances/${encodeURIComponent(formId)}`, {
    method: 'PUT',
    body: JSON.stringify({ action, ...body }),
  });
}

/** Uploads sequentially; returns names of files that failed. */
export async function uploadFiles(formId: string, files: File[], folder?: 'pay' | 'clear' | 'check'): Promise<string[]> {
  const failed: string[] = [];
  for (const file of files) {
    const fd = new FormData();
    fd.append('form_id', formId);
    if (folder) fd.append('folder', folder);
    fd.append('file', new File([file], uniqueFileName(file.name, Date.now()), { type: file.type }));
    try {
      const res = await fetch('/api/uploads3', { method: 'POST', body: fd });
      if (!res.ok) failed.push(file.name);
    } catch {
      failed.push(file.name);
    }
  }
  return failed;
}

export const showAlert = (options: Record<string, unknown>) =>
  import('sweetalert2').then(({ default: Swal }) => Swal.fire({ confirmButtonText: 'ตกลง', ...options }));

export const showConfirm = (options: Record<string, unknown>) =>
  import('sweetalert2').then(({ default: Swal }) => Swal.fire({
    showCancelButton: true, confirmButtonColor: '#026a75', cancelButtonColor: '#d33',
    confirmButtonText: 'ยืนยัน', cancelButtonText: 'ยกเลิก', ...options,
  }));
```

- [ ] **Step 7: Implement the components**

`app/finance/components/FinanceShell.tsx`:

```tsx
'use client';

import { Navbar } from '@/components/navbar';

export function FinanceShell({ title, wide = false, children }: { title: string; wide?: boolean; children: React.ReactNode }) {
  return (
    <Navbar isHome={false} title={title}>
      <main className="flex-1 min-h-0 bg-[#026a75] rounded-t-[1.5rem] sm:rounded-t-[2rem] lg:rounded-t-[3rem] shadow-2xl overflow-y-auto relative">
        <div className={`${wide ? 'max-w-7xl' : 'max-w-4xl'} mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-4`}>
          {children}
        </div>
      </main>
    </Navbar>
  );
}

export function Panel({ title, children, actions }: { title: string; children: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <section className="rounded-2xl bg-white p-4 sm:p-6 shadow-xl">
      <div className="mb-4 flex items-center justify-between gap-2 border-b border-gray-100 pb-3">
        <h2 className="text-base font-semibold text-[#055058]">{title}</h2>
        {actions}
      </div>
      {children}
    </section>
  );
}

export function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-sm font-medium text-gray-800 break-words">{value ?? '-'}</p>
    </div>
  );
}

export function NoAccess({ text = 'หน้านี้สำหรับฝ่ายการเงินเท่านั้น' }: { text?: string }) {
  return <div className="rounded-2xl bg-white p-8 text-center text-sm text-gray-500 shadow-xl">{text}</div>;
}
```

`app/finance/components/StatusBadge.tsx`:

```tsx
import { STATUS_LABELS, STATUS_STYLES, type AdvanceStatus } from '@/lib/finance/status';

export function StatusBadge({ status, overdue = false }: { status: AdvanceStatus; overdue?: boolean }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[status]}`}>
        {STATUS_LABELS[status]}
      </span>
      {overdue && (
        <span className="inline-flex rounded-full border border-rose-300 bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-700">
          เกินกำหนด
        </span>
      )}
    </span>
  );
}
```

`app/finance/components/FilePicker.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { Paperclip, X } from 'lucide-react';

export function FilePicker({ files, onChange, disabled = false, maxSizeMB = 10 }: {
  files: File[]; onChange: (files: File[]) => void; disabled?: boolean; maxSizeMB?: number;
}) {
  const [warning, setWarning] = useState('');

  const pick = (list: FileList | null) => {
    const picked = Array.from(list ?? []);
    const tooBig = picked.filter(f => f.size > maxSizeMB * 1024 * 1024);
    setWarning(tooBig.length ? `ไฟล์ใหญ่เกิน ${maxSizeMB}MB: ${tooBig.map(f => f.name).join(', ')}` : '');
    onChange([...files, ...picked.filter(f => f.size <= maxSizeMB * 1024 * 1024)]);
  };

  return (
    <div className="space-y-2">
      <label className={`flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 px-4 py-4 text-sm text-gray-500 ${disabled ? 'opacity-60' : 'cursor-pointer hover:border-[#026a75]/40'}`}>
        <Paperclip className="h-4 w-4" /> แนบไฟล์ (เลือกได้หลายไฟล์ ไม่เกิน {maxSizeMB}MB/ไฟล์)
        <input type="file" multiple className="hidden" disabled={disabled}
          onChange={(e) => { pick(e.target.files); e.target.value = ''; }} />
      </label>
      {warning && <p className="text-xs text-rose-600">{warning}</p>}
      {files.length > 0 && (
        <ul className="space-y-1">
          {files.map((f, i) => (
            <li key={`${f.name}-${i}`} className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-1.5 text-xs">
              <span className="truncate">{f.name}</span>
              {!disabled && (
                <button type="button" aria-label="ลบไฟล์" onClick={() => onChange(files.filter((_, j) => j !== i))}>
                  <X className="h-3.5 w-3.5 text-gray-400 hover:text-rose-600" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

`app/finance/components/AttachmentPanel.tsx`:

```tsx
'use client';

import { useCallback, useEffect, useState } from 'react';
import { FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { displayFileName } from '@/lib/finance/status';
import { FOLDER_LABELS } from '../labels';
import { showAlert, uploadFiles } from '../api';
import type { AttachmentFile, AttachmentFolder } from '../types';
import { FilePicker } from './FilePicker';

export function AttachmentPanel({ formId, folder, canUpload = false, refreshKey = 0 }: {
  formId: string; folder: AttachmentFolder; canUpload?: boolean; refreshKey?: number;
}) {
  const [files, setFiles] = useState<AttachmentFile[]>([]);
  const [pending, setPending] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/uploads3?form_id=${encodeURIComponent(formId)}`, { cache: 'no-store' });
    const data = await res.json().catch(() => ({ files: [] }));
    setFiles(((data.files ?? []) as AttachmentFile[]).filter(f => f.folder === folder));
  }, [formId, folder]);

  useEffect(() => { load(); }, [load, refreshKey]);

  const upload = async () => {
    setUploading(true);
    const failed = await uploadFiles(formId, pending, folder === 'request' ? undefined : folder);
    setUploading(false);
    setPending([]);
    if (failed.length) showAlert({ icon: 'error', title: 'อัปโหลดไม่สำเร็จ', text: failed.join(', ') });
    load();
  };

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-gray-600">{FOLDER_LABELS[folder]}</p>
      {files.length === 0 ? (
        <p className="text-xs text-gray-400">ยังไม่มีไฟล์</p>
      ) : (
        <ul className="space-y-1">
          {files.map(f => (
            <li key={f.key}>
              <a href={f.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-sm text-[#026a75] hover:underline">
                <FileText className="h-4 w-4" /> {displayFileName(f.fileName)}
              </a>
            </li>
          ))}
        </ul>
      )}
      {canUpload && (
        <div className="space-y-2">
          <FilePicker files={pending} onChange={setPending} disabled={uploading} />
          {pending.length > 0 && (
            <Button type="button" size="sm" disabled={uploading} onClick={upload} className="bg-[#026a75] hover:bg-[#055058]">
              {uploading ? 'กำลังอัปโหลด...' : `อัปโหลด ${pending.length} ไฟล์`}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
```

`app/finance/components/AdvanceSummary.tsx`:

```tsx
import { formatBaht, formatDate, settleLabel } from '@/lib/finance/status';
import type { AdvanceItem } from '../types';
import { Field, Panel } from './FinanceShell';
import { StatusBadge } from './StatusBadge';

export function AdvanceSummary({ item }: { item: AdvanceItem }) {
  const fin = item.fin;
  return (
    <>
      <Panel title={`คำขอเบิกเงิน ${item.form_id}`} actions={<StatusBadge status={item.status} overdue={item.overdue} />}>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Field label="ผู้เบิกเงิน" value={item.requester.name ?? item.requester.employee_id} />
          <Field label="แผนก" value={item.requester.department} />
          <Field label="ศูนย์" value={item.requester.site_code ?? item.requester.site} />
          <Field label="จำนวนเงินที่ขอ" value={formatBaht(item.request.amount)} />
          <Field label="วันที่ใช้เงิน" value={formatDate(item.request.use_date)} />
          <Field label="วันที่ขอ" value={formatDate(item.created_at)} />
          <div className="col-span-2 sm:col-span-3"><Field label="เบิกเงิน Advance สำหรับ" value={item.request.purpose} /></div>
        </div>
      </Panel>

      {fin && (
        <Panel title="ข้อมูลการจ่ายเงิน (การเงิน)">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Field label="เลขที่ใบเบิก" value={fin.voucher_no} />
            <Field label="วันที่ตั้งเบิก" value={formatDate(fin.voucher_date)} />
            <Field label="เลขที่เอกสารจ่าย" value={fin.payment_doc_no} />
            <Field label="ยอดเงิน" value={formatBaht(fin.amount_paid)} />
            <Field label="วันที่โอนเงิน" value={formatDate(fin.transfer_date)} />
            <Field label="กำหนดการเคลียร์" value={formatDate(fin.clear_due_date)} />
            <Field label="บัญชี" value={fin.acc_code ? `${fin.acc_code} ${fin.acc_name ?? ''}` : '-'} />
            <div className="col-span-2"><Field label="วัตถุประสงค์" value={fin.purpose} /></div>
          </div>
        </Panel>
      )}

      {fin?.clear_date && (
        <Panel title="ข้อมูลการเคลียร์เงิน">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Field label="วันที่เคลียร์" value={formatDate(fin.clear_date)} />
            <Field label="ยอดใช้จริง" value={formatBaht(fin.amount_actual)} />
            <Field label="เอกสารเคลียร์" value={fin.clear_doc_no} />
            <Field label={`รับคืน (เบิกเพิ่ม) · ${settleLabel(fin.settle_amount)}`} value={formatBaht(fin.settle_amount)} />
            <Field label="วันที่โอนเงินคืน" value={formatDate(fin.settle_date)} />
            <Field label="หมายเหตุ" value={fin.remark} />
          </div>
        </Panel>
      )}

      {item.status === 'SENT_BACK' && fin?.review_remark && (
        <div className="rounded-2xl border border-orange-200 bg-orange-50 p-4 text-sm text-orange-800">
          <span className="font-semibold">การเงินส่งกลับแก้ไข:</span> {fin.review_remark}
        </div>
      )}
    </>
  );
}
```

`app/finance/components/LogList.tsx`:

```tsx
import { formatDate } from '@/lib/finance/status';
import { FIELD_LABELS, LOG_ACTION_LABELS } from '../labels';
import type { ApprovalLog, FinLog } from '../types';
import { Panel } from './FinanceShell';

const show = (v: unknown) => (v === null || v === undefined || v === '' ? '-' : String(v));

export function LogList({ approvalLogs, finLogs }: { approvalLogs: ApprovalLog[]; finLogs: FinLog[] }) {
  if (approvalLogs.length === 0 && finLogs.length === 0) return null;
  return (
    <Panel title="ประวัติ">
      <ol className="space-y-3 text-sm">
        {approvalLogs.map((log, i) => (
          <li key={`a-${i}`} className="border-l-2 border-[#8ce4cb] pl-3">
            <p className="font-medium">{LOG_ACTION_LABELS[log.action] ?? log.action} · {log.actor_name ?? '-'}</p>
            <p className="text-xs text-gray-500">{formatDate(log.action_at)}{log.remark ? ` · ${log.remark}` : ''}</p>
          </li>
        ))}
        {finLogs.map((log, i) => (
          <li key={`f-${i}`} className="border-l-2 border-[#026a75] pl-3">
            <p className="font-medium">{LOG_ACTION_LABELS[log.action] ?? log.action} · {log.action_by ?? '-'}</p>
            <p className="text-xs text-gray-500">{formatDate(log.created_at)}{log.remark ? ` · ${log.remark}` : ''}</p>
            {log.changes && Object.keys(log.changes).length > 0 && (
              <ul className="mt-1 text-xs text-gray-600">
                {Object.entries(log.changes).map(([field, [before, after]]) => (
                  <li key={field}>{FIELD_LABELS[field] ?? field}: {show(before)} → {show(after)}</li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ol>
    </Panel>
  );
}
```

- [ ] **Step 8: Navbar menu**, in `components/navbar.tsx`

1. In the `lucide-react` import, append `Wallet, Landmark, BookText` to the imported names.

2. Add to the end of `COMPONENT_DEFAULT` (after the `ติดตามคำขอ` entry):

```tsx
    { title: 'เบิกเงิน Advance', href: '/finance/advance', icon: Wallet },
```

3. Below the `COMPONENT_ADMIN` array add:

```tsx
const COMPONENT_FINANCE = [
    { title: 'งานเบิกเงิน Advance', href: '/finance', style: 'font-semibold text-[#026a75] bg-[#8ce4cb]/10', icon: Landmark },
    { title: 'รหัสบัญชี', href: '/finance/accounts', style: 'font-semibold text-[#026a75] bg-[#8ce4cb]/10', icon: BookText },
];
```

4. Immediately after the admin block's closing `)}` (the block that starts with
   `{isClient && user?.role === 'a' && (`), insert:

```tsx
                                            {isClient && user?.is_finance && (
                                                <div className="flex-1">
                                                    <h3 className="text-xs font-semibold text-gray-500 mb-2 px-2">การเงิน</h3>
                                                    <div className="grid grid-cols-1 gap-2">
                                                        {COMPONENT_FINANCE.map((item, index) => {
                                                            const IconComponent = item.icon;
                                                            return (
                                                                <button
                                                                    key={index}
                                                                    onClick={() => handleNavigate(item.href)}
                                                                    className={`flex cursor-pointer items-center gap-3 p-2 rounded-xl hover:bg-linear-to-br hover:from-[#026a75]/10 hover:to-[#8ce4cb]/10 transition-all duration-200 group/item ${item.style || ''}`}
                                                                >
                                                                    <div className="w-8 h-8 bg-[#8ce4cb]/20 rounded-lg flex items-center justify-center group-hover/item:bg-[#026a75] transition-colors duration-200">
                                                                        <IconComponent className="w-4 h-4 text-[#026a75] group-hover/item:text-white transition-colors duration-200" />
                                                                    </div>
                                                                    <span className="text-xs text-[#026a75] font-semibold group-hover/item:text-[#026a75] transition-colors duration-200">
                                                                        {item.title}
                                                                    </span>
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            )}
```

- [ ] **Step 9: Builder form-type option**, in `app/builder/[[...slug]]/page.tsx`

1. Line 118: change the array to:

```tsx
    const form_type = [{ option_value: "Issue", option_label: "ฟอร์มแจ้งปัญหา" }, { option_value: "Service", option_label: "ฟอร์มขอใช้บริการ" }, { option_value: "Advance", option_label: "ฟอร์มเบิกเงิน Advance" }]
```

2. Around line 1117: change the type label expression to:

```tsx
{formData.form_type === "Issue" ? "ฟอร์มแจ้งปัญหา" : formData.form_type === "Service" ? "ฟอร์มขอใช้บริการ" : formData.form_type === "Advance" ? "ฟอร์มเบิกเงิน Advance" : "-"}
```

- [ ] **Step 10: Type-check and run the tests**

Run: `bunx tsc --noEmit && bun test lib/finance`
Expected: tsc exits 0 and all tests pass.

- [ ] **Step 11: Commit**

```bash
git pull --rebase origin main
git add app/finance lib/finance/export.ts lib/finance/export.test.ts components/navbar.tsx "app/builder/[[...slug]]/page.tsx"
git commit -m "feat(finance): shared finance UI, Excel export, navbar menu, builder Advance type

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: FE requester pages: new request, my advances, owner detail + clearing form

**Files:**
- Create:
  - `app/finance/components/ClearForm.tsx`
  - `app/finance/advance/new/page.tsx`
  - `app/finance/advance/page.tsx`
  - `app/finance/advance/[form_id]/page.tsx`

**Interfaces:**
- Consumes: everything from Task 9, `renderFormField` / `buildSubmitValues` (`@/components/renderForm`),
  `Question` (`@/app/service/[[...slug]]/page`), and `/api/formsubmit`.
- Produces: `<ClearForm detail onSaved>`.

- [ ] **Step 1: Implement** `app/finance/components/ClearForm.tsx`

```tsx
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { computeSettle, formatBaht, parseAmount, settleLabel } from '@/lib/finance/status';
import { putAction, showAlert, uploadFiles } from '../api';
import type { AdvanceDetail } from '../types';
import { FilePicker } from './FilePicker';
import { Panel } from './FinanceShell';

export function ClearForm({ detail, onSaved }: { detail: AdvanceDetail; onSaved: (d: AdvanceDetail) => void }) {
  const fin = detail.fin!;
  const [clearDate, setClearDate] = useState(fin.clear_date ?? '');
  const [actual, setActual] = useState(fin.amount_actual !== null ? String(fin.amount_actual) : '');
  const [clearDocNo, setClearDocNo] = useState(fin.clear_doc_no ?? '');
  const [settleDate, setSettleDate] = useState(fin.settle_date ?? '');
  const [remark, setRemark] = useState(fin.remark ?? '');
  const [files, setFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);

  const actualNum = parseAmount(actual);
  const settle = actualNum === null ? null : computeSettle(fin.amount_paid, actualNum);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clearDate) return showAlert({ icon: 'warning', title: 'กรุณาระบุวันที่เคลียร์' });
    if (actualNum === null || actualNum < 0) return showAlert({ icon: 'warning', title: 'กรุณาระบุยอดใช้จริง (ไม่ติดลบ)' });
    if (settle !== null && settle > 0 && !settleDate) {
      return showAlert({ icon: 'warning', title: 'มียอดต้องคืนบริษัท', text: 'กรุณาระบุวันที่โอนเงินคืน' });
    }
    setSaving(true);
    try {
      const saved = await putAction(detail.form_id, 'clear', {
        clear_date: clearDate,
        amount_actual: actualNum,
        clear_doc_no: clearDocNo,
        settle_date: settle !== null && settle > 0 ? settleDate : null,
        remark,
      });
      const failed = await uploadFiles(detail.form_id, files, 'clear');
      setFiles([]);
      await showAlert({
        icon: failed.length ? 'warning' : 'success',
        title: 'ส่งเคลียร์เงินแล้ว รอการเงินตรวจ',
        text: failed.length ? `อัปโหลดไม่สำเร็จ: ${failed.join(', ')}` : undefined,
      });
      onSaved(saved);
    } catch (err) {
      showAlert({ icon: 'error', title: 'บันทึกไม่สำเร็จ', text: (err as Error).message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Panel title="เคลียร์เงิน (ผู้เบิกกรอก)">
      <form onSubmit={submit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="space-y-1 text-sm">วันที่เคลียร์ *
          <Input type="date" value={clearDate} onChange={e => setClearDate(e.target.value)} disabled={saving} />
        </label>
        <label className="space-y-1 text-sm">ยอดใช้จริง (บาท) *
          <Input inputMode="decimal" value={actual} onChange={e => setActual(e.target.value)} placeholder="0.00" disabled={saving} />
        </label>
        <label className="space-y-1 text-sm">เอกสารเคลียร์ (เลขที่/รายการ)
          <Input value={clearDocNo} onChange={e => setClearDocNo(e.target.value)} disabled={saving} />
        </label>
        <div className="space-y-1 text-sm">
          <p>รับคืน (เบิกเพิ่ม) — คำนวณอัตโนมัติ</p>
          <p className={`rounded-xl border px-4 py-2.5 font-semibold ${settle !== null && settle < 0 ? 'text-orange-700' : 'text-[#026a75]'}`}>
            {settle === null ? '-' : `${settleLabel(settle)} ${formatBaht(Math.abs(settle))}`}
          </p>
        </div>
        {settle !== null && settle > 0 && (
          <label className="space-y-1 text-sm">วันที่โอนเงินคืน *
            <Input type="date" value={settleDate} onChange={e => setSettleDate(e.target.value)} disabled={saving} />
          </label>
        )}
        {settle !== null && settle < 0 && (
          <p className="text-xs text-orange-700 sm:col-span-2">ใช้เกินยอดที่เบิก การเงินจะโอนส่วนต่างให้และบันทึกวันที่โอนตอนตรวจ</p>
        )}
        <label className="space-y-1 text-sm sm:col-span-2">หมายเหตุ
          <Textarea value={remark} onChange={e => setRemark(e.target.value)} disabled={saving} />
        </label>
        <div className="sm:col-span-2">
          <p className="mb-1 text-sm">แนบใบเสร็จ / สลิปคืนเงิน</p>
          <FilePicker files={files} onChange={setFiles} disabled={saving} />
        </div>
        <div className="sm:col-span-2">
          <Button type="submit" disabled={saving} className="w-full bg-[#026a75] hover:bg-[#055058]">
            {saving ? 'กำลังบันทึก...' : 'ส่งเคลียร์เงิน'}
          </Button>
        </div>
      </form>
    </Panel>
  );
}
```

- [ ] **Step 2: Implement** `app/finance/advance/new/page.tsx`

```tsx
'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { buildSubmitValues, renderFormField } from '@/components/renderForm';
import type { Question } from '@/app/service/[[...slug]]/page';
import { useSessionContext } from '@/app/context/SessionContext';
import { parseAmount } from '@/lib/finance/status';
import { fetchJson, showAlert, uploadFiles } from '../../api';
import { FilePicker } from '../../components/FilePicker';
import { FinanceShell, Panel } from '../../components/FinanceShell';

interface AdvForm { form_code: string; form_name: string; form_status: string; questions: Question[] }

const isBlank = (v: unknown) => v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0);

export default function NewAdvancePage() {
  const router = useRouter();
  const { user } = useSessionContext();
  const [form, setForm] = useState<AdvForm | null>(null);
  const [values, setValues] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchJson<AdvForm>('/api/formsubmit?path=ADV')
      .then(setForm)
      .catch(err => showAlert({ icon: 'error', title: 'โหลดแบบฟอร์มไม่สำเร็จ', text: err.message }))
      .finally(() => setLoading(false));
  }, []);

  const onInputChange = useCallback((name: string, value: any) => {
    setValues(prev => ({ ...prev, [name]: value }));
    setErrors(prev => {
      if (!prev[name]) return prev;
      const { [name]: _removed, ...rest } = prev;
      return rest;
    });
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;
    if (!user?.employee_id) {
      return showAlert({ icon: 'error', title: 'ไม่พบข้อมูลผู้ใช้', text: 'กรุณาเข้าสู่ระบบใหม่' });
    }
    const next: Record<string, string> = {};
    for (const q of form.questions) {
      if (q.required && isBlank(values[q.name])) next[q.name] = `กรุณาระบุ${q.label}`;
      if (q.type === 'number' && !isBlank(values[q.name])) {
        const amount = parseAmount(values[q.name]);
        if (amount === null || amount <= 0) next[q.name] = 'จำนวนเงินต้องมากกว่า 0';
      }
    }
    if (Object.keys(next).length) { setErrors(next); return; }

    setSubmitting(true);
    try {
      const normalized = { ...values };
      for (const q of form.questions) {
        if (q.type === 'number' && !isBlank(normalized[q.name])) normalized[q.name] = parseAmount(normalized[q.name]);
      }
      const payload = {
        form_code: form.form_code,
        created_by: user.employee_id,
        values: buildSubmitValues(form.questions, normalized).filter(v =>
          v.value_text !== null || v.value_number !== null || v.value_date !== null || v.value_boolean !== null),
      };
      const res = await fetchJson<{ form_id: string }>('/api/formsubmit', { method: 'POST', body: JSON.stringify(payload) });
      const failed = await uploadFiles(res.form_id, files);
      await showAlert({
        icon: failed.length ? 'warning' : 'success',
        title: 'ส่งคำขอเบิกเงินแล้ว',
        text: failed.length ? `อัปโหลดไม่สำเร็จ: ${failed.join(', ')} (แนบเพิ่มได้ในหน้ารายการ)` : `เลขที่เอกสาร ${res.form_id}`,
      });
      router.push(`/finance/advance/${encodeURIComponent(res.form_id)}`);
    } catch (err) {
      showAlert({ icon: 'error', title: 'ส่งคำขอไม่สำเร็จ', text: (err as Error).message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <FinanceShell title="ขอเบิกเงิน Advance">
      {loading ? (
        <Panel title="กำลังโหลด..."><div className="h-24" /></Panel>
      ) : !form ? (
        <Panel title="ไม่พบแบบฟอร์ม"><p className="text-sm text-gray-500">ยังไม่มีฟอร์ม ADV หรือฟอร์มปิดใช้งาน</p></Panel>
      ) : (
        <Panel title={form.form_name}>
          <form onSubmit={submit} className="space-y-5">
            <div className="grid grid-cols-2 gap-3 rounded-xl bg-gray-50 p-3 text-sm">
              <p><span className="text-gray-500">ผู้เบิกเงิน:</span> {user ? `${user.firstname} ${user.lastname}` : '-'}</p>
              <p><span className="text-gray-500">แผนก:</span> {user?.department ?? '-'}</p>
              <p><span className="text-gray-500">ศูนย์:</span> {user?.site ?? '-'}</p>
              <p><span className="text-gray-500">รหัสพนักงาน:</span> {user?.employee_id ?? '-'}</p>
            </div>
            {form.questions.map((q, index) =>
              <div key={q.id}>{renderFormField({ question: q, index, formValues: values, errors, onInputChange, allQuestions: form.questions })}</div>
            )}
            <div>
              <p className="mb-1 text-sm font-medium">เอกสารประกอบ</p>
              <FilePicker files={files} onChange={setFiles} disabled={submitting} />
            </div>
            <Button type="submit" disabled={submitting} className="w-full bg-[#026a75] hover:bg-[#055058]">
              {submitting ? 'กำลังส่ง...' : 'ส่งคำขอเบิกเงิน'}
            </Button>
          </form>
        </Panel>
      )}
    </FinanceShell>
  );
}
```

- [ ] **Step 3: Implement** `app/finance/advance/page.tsx`

```tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { formatBaht, formatDate } from '@/lib/finance/status';
import { fetchJson, showAlert } from '../api';
import { FinanceShell, Panel } from '../components/FinanceShell';
import { StatusBadge } from '../components/StatusBadge';
import type { AdvanceItem } from '../types';

export default function MyAdvancesPage() {
  const [items, setItems] = useState<AdvanceItem[] | null>(null);

  useEffect(() => {
    fetchJson<AdvanceItem[]>('/api/finance/advances?mine=1')
      .then(setItems)
      .catch(err => { setItems([]); showAlert({ icon: 'error', title: 'โหลดข้อมูลไม่สำเร็จ', text: err.message }); });
  }, []);

  return (
    <FinanceShell title="เบิกเงิน Advance ของฉัน">
      <Panel
        title="รายการเบิกเงินของฉัน"
        actions={
          <Link href="/finance/advance/new" className="inline-flex items-center gap-1 rounded-xl bg-[#026a75] px-3 py-2 text-sm font-medium text-white hover:bg-[#055058]">
            <Plus className="h-4 w-4" /> ขอเบิกเงิน
          </Link>
        }
      >
        {items === null ? (
          <p className="text-sm text-gray-400">กำลังโหลด...</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-gray-500">ยังไม่มีรายการ</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {items.map(it => (
              <li key={it.form_id}>
                <Link href={`/finance/advance/${encodeURIComponent(it.form_id)}`} className="flex flex-col gap-1 py-3 hover:bg-gray-50 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[#055058]">{it.form_id}</p>
                    <p className="truncate text-xs text-gray-500">{it.request.purpose ?? '-'}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-sm">
                    <span>{formatBaht(it.fin?.amount_paid ?? it.request.amount)}</span>
                    {it.fin && <span className="text-xs text-gray-500">กำหนดเคลียร์ {formatDate(it.fin.clear_due_date)}</span>}
                    <StatusBadge status={it.status} overdue={it.overdue} />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </FinanceShell>
  );
}
```

- [ ] **Step 4: Implement** `app/finance/advance/[form_id]/page.tsx`

```tsx
'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { fetchJson } from '../../api';
import { AdvanceSummary } from '../../components/AdvanceSummary';
import { AttachmentPanel } from '../../components/AttachmentPanel';
import { ClearForm } from '../../components/ClearForm';
import { FinanceShell, NoAccess, Panel } from '../../components/FinanceShell';
import { LogList } from '../../components/LogList';
import type { AdvanceDetail } from '../../types';

const CLEARABLE = new Set(['AWAITING_CLEARING', 'SENT_BACK', 'AWAITING_REVIEW']);

export default function MyAdvanceDetailPage() {
  const params = useParams<{ form_id: string }>();
  const formId = decodeURIComponent(params.form_id);
  const [detail, setDetail] = useState<AdvanceDetail | null>(null);
  const [error, setError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  const load = useCallback(() => {
    fetchJson<AdvanceDetail>(`/api/finance/advances/${encodeURIComponent(formId)}`)
      .then(d => { setDetail(d); setError(''); })
      .catch(err => setError(err.message));
  }, [formId]);

  useEffect(() => { load(); }, [load]);

  const onSaved = (d: AdvanceDetail) => { setDetail(d); setRefreshKey(k => k + 1); };

  return (
    <FinanceShell title={`เบิกเงิน Advance ${formId}`}>
      {error ? <NoAccess text={error} /> : !detail ? <Panel title="กำลังโหลด..."><div className="h-24" /></Panel> : (
        <>
          <AdvanceSummary item={detail} />
          <Panel title="ไฟล์แนบ">
            <div className="grid gap-5 sm:grid-cols-2">
              <AttachmentPanel formId={formId} folder="request" canUpload={detail.status === 'PENDING_APPROVAL'} refreshKey={refreshKey} />
              {detail.fin && <AttachmentPanel formId={formId} folder="pay" refreshKey={refreshKey} />}
              {detail.fin && <AttachmentPanel formId={formId} folder="clear" refreshKey={refreshKey} />}
              {detail.fin?.settle_amount !== null && detail.fin?.settle_amount !== undefined && detail.fin.settle_amount < 0 && (
                <AttachmentPanel formId={formId} folder="check" refreshKey={refreshKey} />
              )}
            </div>
          </Panel>
          {detail.fin && CLEARABLE.has(detail.status) && <ClearForm key={refreshKey} detail={detail} onSaved={onSaved} />}
          <LogList approvalLogs={detail.approval_logs} finLogs={detail.fin_logs} />
        </>
      )}
    </FinanceShell>
  );
}
```

- [ ] **Step 5: Type-check and build**

Run: `bunx tsc --noEmit && bun run build`
Expected: tsc exits 0, and the build succeeds with `/finance/advance`, `/finance/advance/new` and
`/finance/advance/[form_id]` listed.

- [ ] **Step 6: Commit**

```bash
git pull --rebase origin main
git add app/finance/components/ClearForm.tsx app/finance/advance
git commit -m "feat(finance): requester pages — new advance, my advances, detail with clearing form

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: FE Finance pages: queue + export, detail (pay/check), accounts

**Files:**
- Create:
  - `app/finance/components/PayForm.tsx`, `app/finance/components/ReviewPanel.tsx`, `app/finance/components/AdvanceTable.tsx`
  - `app/finance/page.tsx`, `app/finance/[form_id]/page.tsx`, `app/finance/accounts/page.tsx`

**Interfaces:**
- Consumes: Task 9 and Task 10 components, and `exportAdvancesXlsx`.
- Produces: `<PayForm detail accounts onSaved>`, `<ReviewPanel detail onSaved>`, `<AdvanceTable items>`.

- [ ] **Step 1: Implement** `app/finance/components/PayForm.tsx`

```tsx
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { CLEAR_DUE_DAYS, addDays, parseAmount } from '@/lib/finance/status';
import { putAction, showAlert, uploadFiles } from '../api';
import type { AdvanceDetail, FinAccount } from '../types';
import { FilePicker } from './FilePicker';
import { Panel } from './FinanceShell';

export function PayForm({ detail, accounts, onSaved }: {
  detail: AdvanceDetail; accounts: FinAccount[]; onSaved: (d: AdvanceDetail) => void;
}) {
  const fin = detail.fin;
  const [accCode, setAccCode] = useState(fin?.acc_code ?? '');
  const [voucherNo, setVoucherNo] = useState(fin?.voucher_no ?? '');
  const [voucherDate, setVoucherDate] = useState(fin?.voucher_date ?? '');
  const [paymentDocNo, setPaymentDocNo] = useState(fin?.payment_doc_no ?? '');
  const [purpose, setPurpose] = useState(fin?.purpose ?? detail.request.purpose ?? '');
  const [amount, setAmount] = useState(String(fin?.amount_paid ?? detail.request.amount ?? ''));
  const [transferDate, setTransferDate] = useState(fin?.transfer_date ?? '');
  const [dueDate, setDueDate] = useState(fin?.clear_due_date ?? '');
  const [dueTouched, setDueTouched] = useState(Boolean(fin));
  const [files, setFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);

  const onTransferDate = (value: string) => {
    setTransferDate(value);
    if (!dueTouched) setDueDate(addDays(value, CLEAR_DUE_DAYS));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseAmount(amount);
    if (!accCode) return showAlert({ icon: 'warning', title: 'กรุณาเลือกรหัสบัญชี' });
    if (amountNum === null || amountNum < 0) return showAlert({ icon: 'warning', title: 'กรุณาระบุยอดเงิน (ไม่ติดลบ)' });
    if (!transferDate) return showAlert({ icon: 'warning', title: 'กรุณาระบุวันที่โอนเงิน' });
    if (dueDate && dueDate < transferDate) return showAlert({ icon: 'warning', title: 'กำหนดการเคลียร์ต้องไม่ก่อนวันที่โอนเงิน' });
    setSaving(true);
    try {
      const saved = await putAction(detail.form_id, 'pay', {
        acc_code: accCode, voucher_no: voucherNo, voucher_date: voucherDate || null, payment_doc_no: paymentDocNo,
        purpose, amount_paid: amountNum, transfer_date: transferDate, clear_due_date: dueDate || null,
      });
      const failed = await uploadFiles(detail.form_id, files, 'pay');
      setFiles([]);
      await showAlert({
        icon: failed.length ? 'warning' : 'success',
        title: fin ? 'แก้ไขข้อมูลการจ่ายแล้ว' : 'บันทึกการจ่ายเงินแล้ว',
        text: failed.length ? `อัปโหลดไม่สำเร็จ: ${failed.join(', ')}` : undefined,
      });
      onSaved(saved);
    } catch (err) {
      showAlert({ icon: 'error', title: 'บันทึกไม่สำเร็จ', text: (err as Error).message });
    } finally {
      setSaving(false);
    }
  };

  const activeAccounts = accounts.filter(a => a.is_active || a.acc_code === accCode);

  return (
    <Panel title={fin ? 'แก้ไขข้อมูลการจ่ายเงิน' : 'บันทึกการจ่ายเงิน'}>
      <form onSubmit={submit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="space-y-1 text-sm sm:col-span-2">รหัสบัญชี (เงินสดย่อยที่จ่าย) *
          <select value={accCode} onChange={e => setAccCode(e.target.value)} disabled={saving}
            className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm">
            <option value="">— เลือกบัญชี —</option>
            {activeAccounts.map(a => <option key={a.acc_code} value={a.acc_code}>{a.acc_code} {a.acc_name}</option>)}
          </select>
        </label>
        <label className="space-y-1 text-sm">เลขที่ใบเบิก
          <Input value={voucherNo} onChange={e => setVoucherNo(e.target.value)} placeholder="เช่น SADV2607-005" disabled={saving} />
        </label>
        <label className="space-y-1 text-sm">วันที่ตั้งเบิก
          <Input type="date" value={voucherDate} onChange={e => setVoucherDate(e.target.value)} disabled={saving} />
        </label>
        <label className="space-y-1 text-sm">เลขที่เอกสารจ่าย
          <Input value={paymentDocNo} onChange={e => setPaymentDocNo(e.target.value)} disabled={saving} />
        </label>
        <label className="space-y-1 text-sm">ยอดเงิน (บาท) *
          <Input inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} disabled={saving} />
        </label>
        <label className="space-y-1 text-sm">วันที่โอนเงิน *
          <Input type="date" value={transferDate} onChange={e => onTransferDate(e.target.value)} disabled={saving} />
        </label>
        <label className="space-y-1 text-sm">กำหนดการเคลียร์ (ค่าเริ่มต้น +{CLEAR_DUE_DAYS} วัน)
          <Input type="date" value={dueDate} onChange={e => { setDueTouched(true); setDueDate(e.target.value); }} disabled={saving} />
        </label>
        <label className="space-y-1 text-sm sm:col-span-2">วัตถุประสงค์
          <Textarea value={purpose} onChange={e => setPurpose(e.target.value)} disabled={saving} />
        </label>
        <div className="sm:col-span-2">
          <p className="mb-1 text-sm">แนบหลักฐานการจ่าย (สลิปโอน)</p>
          <FilePicker files={files} onChange={setFiles} disabled={saving} />
        </div>
        <div className="sm:col-span-2">
          <Button type="submit" disabled={saving} className="w-full bg-[#026a75] hover:bg-[#055058]">
            {saving ? 'กำลังบันทึก...' : fin ? 'บันทึกการแก้ไข' : 'บันทึกการจ่ายเงิน'}
          </Button>
        </div>
      </form>
    </Panel>
  );
}
```

- [ ] **Step 2: Implement** `app/finance/components/ReviewPanel.tsx`

```tsx
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { formatBaht, settleLabel } from '@/lib/finance/status';
import { putAction, showAlert, showConfirm, uploadFiles } from '../api';
import type { AdvanceDetail } from '../types';
import { FilePicker } from './FilePicker';
import { Panel } from './FinanceShell';

export function ReviewPanel({ detail, onSaved }: { detail: AdvanceDetail; onSaved: (d: AdvanceDetail) => void }) {
  const settle = detail.fin?.settle_amount ?? 0;
  const needsExtraDate = settle < 0;
  const [extraDate, setExtraDate] = useState('');
  const [remark, setRemark] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);

  const confirm = async () => {
    if (needsExtraDate && !extraDate) return showAlert({ icon: 'warning', title: 'กรุณาระบุวันที่การเงินโอนเงินเพิ่ม' });
    const ok = await showConfirm({ title: 'ยืนยันปิดรายการ?', text: `${detail.form_id} · ${settleLabel(settle)} ${formatBaht(Math.abs(settle))}` });
    if (!ok.isConfirmed) return;
    setSaving(true);
    try {
      const saved = await putAction(detail.form_id, 'confirm', { settle_date: needsExtraDate ? extraDate : null });
      const failed = await uploadFiles(detail.form_id, files, 'check');
      setFiles([]);
      await showAlert({ icon: failed.length ? 'warning' : 'success', title: 'ปิดรายการแล้ว',
        text: failed.length ? `อัปโหลดไม่สำเร็จ: ${failed.join(', ')}` : undefined });
      onSaved(saved);
    } catch (err) {
      showAlert({ icon: 'error', title: 'ปิดรายการไม่สำเร็จ', text: (err as Error).message });
    } finally {
      setSaving(false);
    }
  };

  const sendBack = async () => {
    if (!remark.trim()) return showAlert({ icon: 'warning', title: 'กรุณาระบุเหตุผลที่ส่งกลับ' });
    setSaving(true);
    try {
      const saved = await putAction(detail.form_id, 'send-back', { review_remark: remark });
      setRemark('');
      await showAlert({ icon: 'success', title: 'ส่งกลับให้ผู้เบิกแก้ไขแล้ว' });
      onSaved(saved);
    } catch (err) {
      showAlert({ icon: 'error', title: 'ส่งกลับไม่สำเร็จ', text: (err as Error).message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Panel title="ตรวจการเคลียร์เงิน">
      <div className="space-y-4">
        <p className="rounded-xl bg-gray-50 px-4 py-3 text-sm">
          {settleLabel(settle)} <span className="font-semibold">{formatBaht(Math.abs(settle))}</span> บาท
        </p>
        {needsExtraDate && (
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-1 text-sm">วันที่การเงินโอนเงินเพิ่ม *
              <Input type="date" value={extraDate} onChange={e => setExtraDate(e.target.value)} disabled={saving} />
            </label>
            <div>
              <p className="mb-1 text-sm">แนบสลิปโอนเงินเพิ่ม</p>
              <FilePicker files={files} onChange={setFiles} disabled={saving} />
            </div>
          </div>
        )}
        <Button type="button" onClick={confirm} disabled={saving} className="w-full bg-[#026a75] hover:bg-[#055058]">
          ยืนยันปิดรายการ
        </Button>
        <div className="space-y-2 border-t border-gray-100 pt-4">
          <label className="block space-y-1 text-sm">เหตุผลที่ส่งกลับแก้ไข
            <Textarea value={remark} onChange={e => setRemark(e.target.value)} disabled={saving} placeholder="เช่น ใบเสร็จไม่ครบ" />
          </label>
          <Button type="button" variant="outline" onClick={sendBack} disabled={saving} className="w-full border-orange-300 text-orange-700 hover:bg-orange-50">
            ส่งกลับแก้ไข
          </Button>
        </div>
      </div>
    </Panel>
  );
}
```

- [ ] **Step 3: Implement** `app/finance/components/AdvanceTable.tsx`

```tsx
'use client';

import { useRouter } from 'next/navigation';
import { formatBaht, formatDate } from '@/lib/finance/status';
import type { AdvanceItem } from '../types';
import { StatusBadge } from './StatusBadge';

const TH = 'whitespace-nowrap px-3 py-2 text-left text-xs font-semibold text-gray-600';
const TD = 'whitespace-nowrap px-3 py-2 text-sm';

export function AdvanceTable({ items }: { items: AdvanceItem[] }) {
  const router = useRouter();
  if (items.length === 0) return <p className="py-6 text-center text-sm text-gray-500">ไม่มีรายการ</p>;
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-100">
        <thead className="bg-gray-50">
          <tr>
            {['ลำดับ', 'เลขที่เอกสาร', 'ผู้เบิก', 'แผนก', 'ศูนย์', 'วัตถุประสงค์', 'ยอดเงิน', 'วันที่ใช้เงิน', 'เลขที่ใบเบิก',
              'วันที่โอนเงิน', 'กำหนดการเคลียร์', 'ยอดใช้จริง', 'รับคืน (เบิกเพิ่ม)', 'สถานะ'].map(h => <th key={h} className={TH}>{h}</th>)}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {items.map((it, idx) => (
            <tr key={it.form_id} onClick={() => router.push(`/finance/${encodeURIComponent(it.form_id)}`)}
              className={`cursor-pointer hover:bg-[#8ce4cb]/10 ${it.overdue ? 'bg-rose-50/60' : ''}`}>
              <td className={TD}>{idx + 1}</td>
              <td className={`${TD} font-medium text-[#055058]`}>{it.form_id}</td>
              <td className={TD}>{it.requester.name ?? it.requester.employee_id}</td>
              <td className={TD}>{it.requester.department ?? '-'}</td>
              <td className={TD}>{it.requester.site_code ?? it.requester.site ?? '-'}</td>
              <td className={`${TD} max-w-xs truncate`}>{it.fin?.purpose ?? it.request.purpose ?? '-'}</td>
              <td className={`${TD} text-right`}>{formatBaht(it.fin?.amount_paid ?? it.request.amount)}</td>
              <td className={TD}>{formatDate(it.request.use_date)}</td>
              <td className={TD}>{it.fin?.voucher_no ?? '-'}</td>
              <td className={TD}>{formatDate(it.fin?.transfer_date)}</td>
              <td className={TD}>{formatDate(it.fin?.clear_due_date)}</td>
              <td className={`${TD} text-right`}>{formatBaht(it.fin?.amount_actual)}</td>
              <td className={`${TD} text-right`}>{formatBaht(it.fin?.settle_amount)}</td>
              <td className={TD}><StatusBadge status={it.status} overdue={it.overdue} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 4: Implement** `app/finance/page.tsx` (queue)

```tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useSessionContext } from '@/app/context/SessionContext';
import { exportAdvancesXlsx } from '@/lib/finance/export';
import { formatBaht, todayBkk } from '@/lib/finance/status';
import { fetchJson, showAlert } from './api';
import { AdvanceTable } from './components/AdvanceTable';
import { FinanceShell, NoAccess, Panel } from './components/FinanceShell';
import type { AdvanceItem } from './types';

type Tab = { key: string; label: string; match: (i: AdvanceItem) => boolean };

const TABS: Tab[] = [
  { key: 'pay', label: 'รอจ่าย', match: i => i.status === 'AWAITING_PAYMENT' },
  { key: 'clearing', label: 'จ่ายแล้วรอเคลียร์', match: i => i.status === 'AWAITING_CLEARING' },
  { key: 'overdue', label: 'เกินกำหนด', match: i => i.overdue },
  { key: 'review', label: 'รอการเงินตรวจ', match: i => i.status === 'AWAITING_REVIEW' },
  { key: 'sentback', label: 'ส่งกลับแก้ไข', match: i => i.status === 'SENT_BACK' },
  { key: 'closed', label: 'ปิดแล้ว', match: i => i.status === 'CLOSED' },
  { key: 'all', label: 'ทั้งหมด', match: () => true },
];

export default function FinanceQueuePage() {
  const { user, loading } = useSessionContext();
  const [items, setItems] = useState<AdvanceItem[] | null>(null);
  const [tab, setTab] = useState('pay');
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!user?.is_finance) return;
    fetchJson<AdvanceItem[]>('/api/finance/advances')
      .then(setItems)
      .catch(err => { setItems([]); showAlert({ icon: 'error', title: 'โหลดข้อมูลไม่สำเร็จ', text: err.message }); });
  }, [user?.is_finance]);

  const current = TABS.find(t => t.key === tab)!;
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (items ?? []).filter(current.match).filter(i => !q
      || i.form_id.toLowerCase().includes(q)
      || (i.requester.name ?? '').toLowerCase().includes(q)
      || (i.fin?.voucher_no ?? '').toLowerCase().includes(q));
  }, [items, current, search]);

  const outstanding = useMemo(() => (items ?? [])
    .filter(i => i.fin && i.status !== 'CLOSED')
    .reduce((sum, i) => sum + (i.fin?.amount_paid ?? 0), 0), [items]);

  if (!loading && !user?.is_finance) return <FinanceShell title="งานเบิกเงิน Advance"><NoAccess /></FinanceShell>;

  return (
    <FinanceShell title="งานเบิกเงิน Advance" wide>
      <Panel
        title={`ยอดค้างเคลียร์ ${formatBaht(outstanding)} บาท`}
        actions={
          <Button type="button" variant="outline" size="sm" disabled={!filtered.length}
            onClick={() => exportAdvancesXlsx(filtered, `advance-${current.key}-${todayBkk()}.xlsx`)}>
            <Download className="mr-1 h-4 w-4" /> Excel
          </Button>
        }
      >
        <div className="mb-4 flex flex-wrap gap-2">
          {TABS.map(t => {
            const count = (items ?? []).filter(t.match).length;
            return (
              <button key={t.key} type="button" onClick={() => setTab(t.key)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium ${tab === t.key ? 'bg-[#026a75] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                {t.label} ({count})
              </button>
            );
          })}
        </div>
        <Input className="mb-3 max-w-sm" placeholder="ค้นหา เลขที่เอกสาร / ผู้เบิก / เลขที่ใบเบิก" value={search} onChange={e => setSearch(e.target.value)} />
        {items === null ? <p className="text-sm text-gray-400">กำลังโหลด...</p> : <AdvanceTable items={filtered} />}
      </Panel>
    </FinanceShell>
  );
}
```

- [ ] **Step 5: Implement** `app/finance/[form_id]/page.tsx` (Finance detail)

```tsx
'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useSessionContext } from '@/app/context/SessionContext';
import { fetchJson } from '../api';
import { AdvanceSummary } from '../components/AdvanceSummary';
import { AttachmentPanel } from '../components/AttachmentPanel';
import { FinanceShell, NoAccess, Panel } from '../components/FinanceShell';
import { LogList } from '../components/LogList';
import { PayForm } from '../components/PayForm';
import { ReviewPanel } from '../components/ReviewPanel';
import type { AdvanceDetail, FinAccount } from '../types';

export default function FinanceAdvanceDetailPage() {
  const { user, loading } = useSessionContext();
  const params = useParams<{ form_id: string }>();
  const formId = decodeURIComponent(params.form_id);
  const [detail, setDetail] = useState<AdvanceDetail | null>(null);
  const [accounts, setAccounts] = useState<FinAccount[]>([]);
  const [error, setError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  const load = useCallback(() => {
    fetchJson<AdvanceDetail>(`/api/finance/advances/${encodeURIComponent(formId)}`)
      .then(d => { setDetail(d); setError(''); })
      .catch(err => setError(err.message));
    fetchJson<FinAccount[]>('/api/finance/accounts').then(setAccounts).catch(() => setAccounts([]));
  }, [formId]);

  useEffect(() => { if (user?.is_finance) load(); }, [user?.is_finance, load]);

  const onSaved = (d: AdvanceDetail) => { setDetail(d); setRefreshKey(k => k + 1); };

  if (!loading && !user?.is_finance) return <FinanceShell title="งานเบิกเงิน Advance"><NoAccess /></FinanceShell>;

  const canPay = detail && (detail.status === 'AWAITING_PAYMENT' || detail.status === 'AWAITING_CLEARING');

  return (
    <FinanceShell title={`งานเบิกเงิน ${formId}`}>
      {error ? <NoAccess text={error} /> : !detail ? <Panel title="กำลังโหลด..."><div className="h-24" /></Panel> : (
        <>
          <AdvanceSummary item={detail} />
          <Panel title="ไฟล์แนบทุกขั้นตอน">
            <div className="grid gap-5 sm:grid-cols-2">
              <AttachmentPanel formId={formId} folder="request" refreshKey={refreshKey} />
              <AttachmentPanel formId={formId} folder="pay" canUpload={Boolean(canPay)} refreshKey={refreshKey} />
              <AttachmentPanel formId={formId} folder="clear" refreshKey={refreshKey} />
              <AttachmentPanel formId={formId} folder="check" canUpload={detail.status === 'AWAITING_REVIEW'} refreshKey={refreshKey} />
            </div>
          </Panel>
          {canPay && <PayForm key={`pay-${refreshKey}`} detail={detail} accounts={accounts} onSaved={onSaved} />}
          {detail.status === 'AWAITING_REVIEW' && <ReviewPanel key={`rev-${refreshKey}`} detail={detail} onSaved={onSaved} />}
          <LogList approvalLogs={detail.approval_logs} finLogs={detail.fin_logs} />
        </>
      )}
    </FinanceShell>
  );
}
```

- [ ] **Step 6: Implement** `app/finance/accounts/page.tsx`

```tsx
'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useSessionContext } from '@/app/context/SessionContext';
import { fetchJson, showAlert } from '../api';
import { FinanceShell, NoAccess, Panel } from '../components/FinanceShell';
import type { FinAccount } from '../types';

export default function FinanceAccountsPage() {
  const { user, loading } = useSessionContext();
  const [accounts, setAccounts] = useState<FinAccount[]>([]);
  const [draft, setDraft] = useState({ acc_code: '', acc_name: '', acc_name_en: '' });
  const [editing, setEditing] = useState<FinAccount | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    fetchJson<FinAccount[]>('/api/finance/accounts').then(setAccounts)
      .catch(err => showAlert({ icon: 'error', title: 'โหลดข้อมูลไม่สำเร็จ', text: err.message }));
  }, []);

  useEffect(() => { if (user?.is_finance) load(); }, [user?.is_finance, load]);

  const save = async (method: 'POST' | 'PUT', body: Record<string, unknown>, done: string) => {
    setSaving(true);
    try {
      await fetchJson('/api/finance/accounts', { method, body: JSON.stringify(body) });
      await showAlert({ icon: 'success', title: done });
      setDraft({ acc_code: '', acc_name: '', acc_name_en: '' });
      setEditing(null);
      load();
    } catch (err) {
      showAlert({ icon: 'error', title: 'บันทึกไม่สำเร็จ', text: (err as Error).message });
    } finally {
      setSaving(false);
    }
  };

  if (!loading && !user?.is_finance) return <FinanceShell title="รหัสบัญชี"><NoAccess /></FinanceShell>;

  return (
    <FinanceShell title="รหัสบัญชี (เงินสดย่อย)" wide>
      <Panel title="เพิ่มรหัสบัญชี">
        <form className="grid gap-3 sm:grid-cols-4" onSubmit={e => {
          e.preventDefault();
          if (!draft.acc_code.trim() || !draft.acc_name.trim()) return showAlert({ icon: 'warning', title: 'กรุณาระบุรหัสและชื่อบัญชี' });
          save('POST', draft, 'เพิ่มรหัสบัญชีแล้ว');
        }}>
          <Input placeholder="AccCode" value={draft.acc_code} onChange={e => setDraft({ ...draft, acc_code: e.target.value })} />
          <Input placeholder="AccName (ไทย)" value={draft.acc_name} onChange={e => setDraft({ ...draft, acc_name: e.target.value })} />
          <Input placeholder="AccNameEng" value={draft.acc_name_en} onChange={e => setDraft({ ...draft, acc_name_en: e.target.value })} />
          <Button type="submit" disabled={saving} className="bg-[#026a75] hover:bg-[#055058]">เพิ่ม</Button>
        </form>
      </Panel>
      <Panel title={`ทั้งหมด ${accounts.length} บัญชี`}>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-600">
              <tr><th className="px-3 py-2 text-left">AccCode</th><th className="px-3 py-2 text-left">AccName</th>
                <th className="px-3 py-2 text-left">AccNameEng</th><th className="px-3 py-2 text-left">สถานะ</th><th className="px-3 py-2" /></tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {accounts.map(a => editing?.acc_code === a.acc_code ? (
                <tr key={a.acc_code}>
                  <td className="px-3 py-2 font-medium">{a.acc_code}</td>
                  <td className="px-3 py-2"><Input value={editing.acc_name} onChange={e => setEditing({ ...editing, acc_name: e.target.value })} /></td>
                  <td className="px-3 py-2"><Input value={editing.acc_name_en ?? ''} onChange={e => setEditing({ ...editing, acc_name_en: e.target.value })} /></td>
                  <td className="px-3 py-2">
                    <label className="inline-flex items-center gap-2 text-xs">
                      <input type="checkbox" checked={editing.is_active} onChange={e => setEditing({ ...editing, is_active: e.target.checked })} /> ใช้งาน
                    </label>
                  </td>
                  <td className="space-x-2 whitespace-nowrap px-3 py-2 text-right">
                    <Button size="sm" disabled={saving} className="bg-[#026a75] hover:bg-[#055058]"
                      onClick={() => save('PUT', { acc_code: editing.acc_code, acc_name: editing.acc_name, acc_name_en: editing.acc_name_en, is_active: editing.is_active }, 'บันทึกแล้ว')}>บันทึก</Button>
                    <Button size="sm" variant="outline" onClick={() => setEditing(null)}>ยกเลิก</Button>
                  </td>
                </tr>
              ) : (
                <tr key={a.acc_code} className={a.is_active ? '' : 'text-gray-400'}>
                  <td className="px-3 py-2 font-medium">{a.acc_code}</td>
                  <td className="px-3 py-2">{a.acc_name}</td>
                  <td className="px-3 py-2">{a.acc_name_en ?? '-'}</td>
                  <td className="px-3 py-2">{a.is_active ? 'ใช้งาน' : 'ปิดใช้งาน'}</td>
                  <td className="px-3 py-2 text-right"><Button size="sm" variant="outline" onClick={() => setEditing(a)}>แก้ไข</Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </FinanceShell>
  );
}
```

- [ ] **Step 7: Type-check, test and build**

Run: `bunx tsc --noEmit && bun test lib/finance && bun run build`
Expected: all green. The build output lists `/finance`, `/finance/[form_id]` and `/finance/accounts`.

- [ ] **Step 8: Commit**

```bash
git pull --rebase origin main
git add app/finance
git commit -m "feat(finance): finance queue with Excel export, pay/review detail page, account master

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: ⛔ End-to-end flow with the user + test-data cleanup (controller-run)

**Nothing here is automated against production without the user. The controller drives the steps and asks the user to
act as requester, approver or Finance where a real login is needed.**

- [ ] **Step 1: Prepare.**
  - The BE is running on 8001 (Task 6).
  - The FE `.env.local` has `URL_API=http://localhost:8001` (keep the original value commented above it),
    `FINANCE_DEPARTMENT_IDS=4,6` and `FINANCE_EMPLOYEE_IDS=<tester ids>`.
  - Restart `bun --bun next dev -p 4000`.
  - Ask the user which accounts play each role: a level 1–4 requester, a level 5–6 approver in the **same
    department**, and a Finance user. All testers must log out and log in again, so the session picks up `is_finance`.

- [ ] **Step 2: Run the spec §10 checklist and record each result (pass or fail, with the form_id):**
  1. The requester submits at `/finance/advance/new` with 2 attachments.
     - The form_id is `ADV-2026-000N`.
     - The status is รออนุมัติ.
     - The BE log shows **no** email or LINE.
  2. The approver approves from `/mytickets` (the อนุมัติ tab). The advance moves to the รอจ่าย tab in `/finance`.
  3. Finance pays with account 110103.
     - The due date auto-fills to transfer date + 7 days.
     - A slip is uploaded to the `pay` folder.
     - The status becomes จ่ายแล้วรอเคลียร์.
  4. Finance edits the due date to yesterday. The advance moves to the เกินกำหนด tab, and the requester sees the red
     เกินกำหนด badge.
  5. The requester clears with actual < paid.
     - The return date is required.
     - Receipts go to the `clear` folder.
     - The status becomes รอการเงินตรวจ.
  6. Finance sends it back with a remark.
     - The requester sees the remark, edits and resubmits.
     - Finance confirms, and the status becomes ปิดแล้ว.
     - The fin logs show PAY, PAY_EDIT, CLEAR_SUBMIT, SEND_BACK, CLEAR_SUBMIT and CONFIRM.
  7. A second advance: clear with actual > paid (เบิกเพิ่ม). Confirming without an extra-payment date is blocked. With
     the date and a slip in the `check` folder, it closes.
  8. A third advance: clear with actual = paid, then confirm. It closes.
  9. A fourth advance: the approver rejects it. The status is ไม่อนุมัติ, and the Finance pay form never appears.
  10. Guards:
      - A non-Finance user opening `/finance` sees the NoAccess card.
      - A non-owner opening `/finance/advance/<other form_id>` gets 403.
      - Pressing pay twice quickly gives either one success and one 409 Thai message, or a disabled button. Never a
        500.
  11. Excel export on the ทั้งหมด tab: the columns match the sheet, and dates show as dd/MM/yy.
  12. Regression: an IT Service form still submits and approves, and its email is still attempted as before. In the
      local BE there are no SMTP credentials, so a failure in the BE log is expected.

- [ ] **Step 3: Fix loop.** Any failure goes back to the owning task. Write a failing test first where the logic is
  pure, then fix, re-run and commit.

- [ ] **Step 4: ⛔ Cleanup (gated).** Build the list of test `form_id`s from Step 2, then show the user this SQL with the
  exact IDs filled in:

```sql
BEGIN;
-- test advances only (replace the list)
WITH s AS (SELECT id FROM form_submissions WHERE form_id IN ('ADV-2026-0001','ADV-2026-0002'))
DELETE FROM fin_advance_logs WHERE advance_id IN (SELECT id FROM fin_advances WHERE submission_id IN (SELECT id FROM s));
DELETE FROM fin_advances            WHERE submission_id IN (SELECT id FROM form_submissions WHERE form_id IN ('ADV-2026-0001','ADV-2026-0002'));
DELETE FROM form_approval_logs      WHERE submission_id IN (SELECT id FROM form_submissions WHERE form_id IN ('ADV-2026-0001','ADV-2026-0002'));
DELETE FROM form_submission_logs    WHERE submission_id IN (SELECT id FROM form_submissions WHERE form_id IN ('ADV-2026-0001','ADV-2026-0002'));
DELETE FROM form_submission_values  WHERE submission_id IN (SELECT id FROM form_submissions WHERE form_id IN ('ADV-2026-0001','ADV-2026-0002'));
DELETE FROM form_submissions        WHERE form_id IN ('ADV-2026-0001','ADV-2026-0002');
-- keep the ADV form but hide it until launch; reset its running number
UPDATE form_masters SET form_status = 'Inactive' WHERE form_code = 'ADV';
DELETE FROM form_sequences WHERE form_code = 'ADV';
COMMIT;
```

  Also list the S3 prefixes `menait-service/<form_id>/` to delete. Run the SQL and the S3 deletes **only after an
  explicit "yes"**.

- [ ] **Step 5: Hand-off.** Report which checklist items passed and failed, with the evidence, plus the commits on each
  branch. Remind the user that pushing, deploying and the security launch gate (spec §9) are still open.
