# Finance Advance v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ADV approval by amount (clause 6), payee fields on the request, pay-form cleanup and defaults, clearing rename + mandatory slip, dd/mm/yyyy date inputs.

**Architecture:** BE (api-ncac) adds a pure `approval_logic` module plus a thin `approval_repo` loader. The existing form engine branches on `form_type == 'Advance'` in submit/approve/reject/pending/update, so IT forms are untouched. Tiers live in a new `fin_approval_tiers` table. FE (menait-service) adds `lib/finance/bank.ts`, date helpers, a shared `DateField`, two proxy routes and an S3 attachment check. It then updates the request page, the Finance pages, the clearing form and the approvals page.

**Tech Stack:** FastAPI + SQLAlchemy + pytest (Python 3.11 venv). Next.js 16 + bun + shadcn (react-day-picker v9, date-fns v4), `bun test`.

**Spec:** `docs/superpowers/specs/2026-09-29-finance-advance-v2-design.md` (read it first; this plan argues from it).

## Global Constraints

- BE repo: `~/Documents/project/ncac/api-ncac-finance` (git worktree, branch `feat/finance-advance`, base head 3ede73a).
- FE repo: `~/Documents/github/menait-service` (branch `feat/finance-advance`, base head 184a62c).
- BE tests: `cd ~/Documents/project/ncac/api-ncac-finance && PYTHONDONTWRITEBYTECODE=1 .venv/bin/pytest tests -q`. Never commit `__pycache__`/`.pyc`; never `git add -A`. Add explicit paths only.
- FE tests: `cd ~/Documents/github/menait-service && bun test lib/finance`. Type check: `bunx tsc --noEmit`. Build: `bun run build`. A dev server on :4000 is running from this checkout; leave it alone.
- Commits: explicit paths; message ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` (a subagent may use its own model's line). **Never push.** No `git pull` inside tasks (the controller syncs).
- Do not touch prod data. The only DB change is the SQL file in Task 2, which the user runs in DBeaver (controller step).
- Thai strings exactly as written in this plan; spelling is "เคลียร์" (not "เครียร์").
- ORG_WIDE_LEVEL = 9. Tier boundaries inclusive (`amount <= amount_max`).
- Account number: strip spaces and `-`, ASCII digits only; lengths per bank table (Task 1 / Task 5 must be identical).
- Email/LINE for ADV stays gated by `ADVANCE_NOTIFY_ENABLED` (no change).

## Review Focus

1. Amount exactly on a boundary (2,000.00 / 1,000,000.00) and one satang above → the correct clause (Task 1 tests pin this).
2. Requester level ≥ tier level (e.g. Manager asking 1,500) → the approver must still outrank the requester; a level-9 requester is approved by the *other* level-9 person, never self (Task 1 tests).
3. Account number typed with dashes/spaces, or Thai digits (๑๒๓) → dashes/spaces are stripped and accepted; Thai digits are rejected with the bank-specific message (Task 1 + Task 5 tests).
4. A clearing resubmitted after a send-back, where the slip was uploaded the first time → must still pass (the existing `clear/` file counts). A clearing whose upload fails → must NOT be saved (Task 8).
5. Old ADVs without the new questions, or without `acc_code` → detail/list/export render "-" and never crash (Task 7 checks + the export test in Task 5).

---

## BE lane (Tasks 1–4, sequential, in `~/Documents/project/ncac/api-ncac-finance`)

### Task 1: Pure rules: approval by amount, bank accounts, request fields

**Files:**
- Create: `services/finance/approval_logic.py`
- Modify: `services/finance/advance_logic.py` (add bank rules, `submitted_value`, extend `_REQUEST_FIELDS`, rename one message)
- Test: `tests/finance/test_approval_logic.py` (new), `tests/finance/test_advance_logic.py` (append)

**Interfaces:**
- Produces (used by Tasks 2–4):
  - `approval_logic.ORG_WIDE_LEVEL = 9`, `TAB_MINE = "mine"`, `TAB_DELEGABLE = "delegable"`
  - `approval_logic.MSG_NO_TIERS`, `MSG_BAD_AMOUNT`, `MSG_NO_LEVEL`, `MSG_NO_APPROVER` (str)
  - `approval_logic.to_amount(value) -> Decimal` (raises `AdvanceRuleError`)
  - `approval_logic.pick_tier(tiers: list[dict], amount) -> dict`
  - `approval_logic.required_level(tier_min_level: int, requester_level: int | None) -> int`
  - `approval_logic.can_approve(approver: dict, requester: dict, required: int, mapped_departments) -> bool`
  - `approval_logic.direct_level(people, requester: dict, required: int, mappings: dict[str, set[int]]) -> int | None`
  - `approval_logic.approval_tab(approver_level: int, direct: int | None) -> str`
  - `approval_logic.evaluate(tiers, people: dict[str, dict], mappings, requester_employee_id: str, amount) -> dict` with keys `clause, approver_label, min_level, required_level, direct_level`
  - Person dict shape: `{"employee_id": str, "id": int, "level": int | None, "department_id": int | None, "active": bool}`
  - Tier dict shape: `{"clause": str, "amount_max": Decimal | None, "min_level": int, "approver_label": str, "sort_order": int}`
  - `advance_logic.BANKS: dict[str, tuple[str, tuple[int, ...]]]`, `DEFAULT_ACCOUNT_DIGITS = (10, 11, 12)`
  - `advance_logic.normalize_account_no(raw) -> str`, `check_account_no(bank, raw) -> str` (normalized digits; raises `AdvanceRuleError`), `bank_label(value) -> str | None`
  - `advance_logic.submitted_value(questions, values, name, types, key)`: see code
  - `pick_request_values` now also returns `cost_center, bank, account_no, account_name`

- [ ] **Step 1: Write the failing tests** in `tests/finance/test_approval_logic.py`:

```python
from decimal import Decimal

import pytest

from services.finance import approval_logic as A
from services.finance.advance_logic import AdvanceRuleError

TIERS = [
    {"clause": "6.7", "amount_max": Decimal("2000.00"), "min_level": 2, "approver_label": "Asst. Sup (ระดับ 2)", "sort_order": 1},
    {"clause": "6.6", "amount_max": Decimal("5000.00"), "min_level": 3, "approver_label": "Sup / Asst.M (ระดับ 3–4)", "sort_order": 2},
    {"clause": "6.5", "amount_max": Decimal("20000.00"), "min_level": 5, "approver_label": "MGR / SM / DPCL (ระดับ 5–7)", "sort_order": 3},
    {"clause": "6.4", "amount_max": Decimal("100000.00"), "min_level": 8, "approver_label": "CL (ระดับ 8)", "sort_order": 4},
    {"clause": "6.3", "amount_max": Decimal("500000.00"), "min_level": 9, "approver_label": "DCEO (นโยบายระดับ 9)", "sort_order": 5},
    {"clause": "6.2", "amount_max": Decimal("1000000.00"), "min_level": 9, "approver_label": "CEO", "sort_order": 6},
    {"clause": "6.1", "amount_max": None, "min_level": 9, "approver_label": "ExC", "sort_order": 7},
]


def person(eid, level, dept, active=True):
    return {"employee_id": eid, "id": hash(eid) % 10000, "level": level, "department_id": dept, "active": active}


class TestPickTier:
    @pytest.mark.parametrize("amount,clause", [
        ("0.01", "6.7"), ("2000", "6.7"), ("2000.00", "6.7"), ("2000.01", "6.6"), ("5000", "6.6"),
        ("20000", "6.5"), ("100000", "6.4"), ("500000", "6.3"), ("1000000", "6.2"), ("1000000.01", "6.1"),
        ("99999999", "6.1"),
    ])
    def test_boundaries_inclusive(self, amount, clause):
        assert A.pick_tier(TIERS, amount)["clause"] == clause

    def test_order_by_sort_order_not_list_order(self):
        assert A.pick_tier(list(reversed(TIERS)), "1500")["clause"] == "6.7"

    @pytest.mark.parametrize("bad", [None, "", "abc", 0, "0", -5, "NaN"])
    def test_bad_amount(self, bad):
        with pytest.raises(AdvanceRuleError, match=A.MSG_BAD_AMOUNT):
            A.pick_tier(TIERS, bad)

    def test_no_tiers(self):
        with pytest.raises(AdvanceRuleError, match=A.MSG_NO_TIERS):
            A.pick_tier([], "100")

    def test_no_unbounded_row_above_cap(self):
        with pytest.raises(AdvanceRuleError, match=A.MSG_NO_TIERS):
            A.pick_tier(TIERS[:2], "9000")


class TestRequiredLevel:
    def test_tier_above_requester(self):
        assert A.required_level(5, 1) == 5

    def test_requester_above_tier_bumps(self):
        assert A.required_level(2, 5) == 6  # Manager asks 1,500 → level 6+

    def test_level_9_requester_stays_9(self):
        assert A.required_level(2, 9) == 9

    def test_future_tier_above_org_wide_kept(self):
        assert A.required_level(10, 3) == 10

    def test_no_level(self):
        with pytest.raises(AdvanceRuleError, match=A.MSG_NO_LEVEL):
            A.required_level(2, None)


class TestCanApprove:
    REQ = {"employee_id": "R", "department_id": 3}

    def test_same_department_at_level(self):
        assert A.can_approve(person("X", 5, 3), self.REQ, 5, ())

    def test_below_required(self):
        assert not A.can_approve(person("X", 4, 3), self.REQ, 5, ())

    def test_other_department_unmapped(self):
        assert not A.can_approve(person("X", 8, 4), self.REQ, 5, ())

    def test_other_department_mapped(self):
        assert A.can_approve(person("X", 8, 1), self.REQ, 5, {3, 11})

    def test_level_9_org_wide(self):
        assert A.can_approve(person("CEO", 9, 1), self.REQ, 9, ())

    def test_self_never(self):
        assert not A.can_approve(person("R", 9, 3), self.REQ, 9, ())

    def test_inactive_never(self):
        assert not A.can_approve(person("X", 6, 3, active=False), self.REQ, 5, ())

    def test_no_level_never(self):
        assert not A.can_approve(person("X", None, 3), self.REQ, 1, ())


class TestDirectLevelAndTab:
    def test_lowest_eligible_level(self):
        people = [person("A", 5, 3), person("B", 6, 3), person("C", 9, 1)]
        req = {"employee_id": "R", "department_id": 3}
        assert A.direct_level(people, req, 5, {}) == 5
        assert A.approval_tab(5, 5) == A.TAB_MINE
        assert A.approval_tab(9, 5) == A.TAB_DELEGABLE

    def test_escalates_when_band_empty_in_department(self):
        people = [person("C", 9, 1)]  # dept 3 has nobody at 2+
        assert A.direct_level(people, {"employee_id": "R", "department_id": 3}, 2, {}) == 9

    def test_none_when_nobody(self):
        assert A.direct_level([person("R", 9, 1)], {"employee_id": "R", "department_id": 1}, 9, {}) is None


class TestEvaluate:
    PEOPLE = {
        "R": person("R", 5, 3),        # requester: Manager, dept 3
        "S6": person("S6", 6, 3),      # Senior Manager same dept
        "CL": person("CL", 8, 1),      # C-level mapped to dept 3
        "CEO": person("CEO", 9, 1),
        "CEO2": person("CEO2", 9, 1),
    }
    MAP = {"CL": {3}}

    def test_manager_asks_1500(self):
        res = A.evaluate(TIERS, self.PEOPLE, self.MAP, "R", "1500")
        assert res == {"clause": "6.7", "approver_label": "Asst. Sup (ระดับ 2)", "min_level": 2,
                       "required_level": 6, "direct_level": 6}

    def test_150k_goes_to_level_9(self):
        res = A.evaluate(TIERS, self.PEOPLE, self.MAP, "R", "150000")
        assert (res["clause"], res["required_level"], res["direct_level"]) == ("6.3", 9, 9)

    def test_ceo_requester_needs_other_ceo(self):
        res = A.evaluate(TIERS, self.PEOPLE, self.MAP, "CEO", "100")
        assert res["required_level"] == 9 and res["direct_level"] == 9

    def test_unknown_requester(self):
        with pytest.raises(AdvanceRuleError, match=A.MSG_NO_LEVEL):
            A.evaluate(TIERS, self.PEOPLE, self.MAP, "NOPE", "100")

    def test_no_approver(self):
        people = {"R": person("R", 9, 1)}
        with pytest.raises(AdvanceRuleError, match=A.MSG_NO_APPROVER):
            A.evaluate(TIERS, people, {}, "R", "100")
```

Append to `tests/finance/test_advance_logic.py`:

```python
class TestAccountNo:
    @pytest.mark.parametrize("bank,raw,expected", [
        ("KBANK", "123-4-56789-0", "1234567890"),
        ("SCB", " 123 456 7890 ", "1234567890"),
        ("GSB", "0200-1234-5678", "020012345678"),
        ("UOB", "12345678901", "12345678901"),
        ("OTHER", "123456789012", "123456789012"),
    ])
    def test_valid(self, bank, raw, expected):
        assert L.check_account_no(bank, raw) == expected

    @pytest.mark.parametrize("bank,raw,msg", [
        ("KBANK", "123456789", "เลขที่บัญชีไม่ถูกต้อง: ธนาคารกสิกรไทย ต้องเป็นตัวเลข 10 หลัก"),
        ("GSB", "1234567890", "เลขที่บัญชีไม่ถูกต้อง: ธนาคารออมสิน ต้องเป็นตัวเลข 12 หลัก"),
        ("UOB", "123456789", "เลขที่บัญชีไม่ถูกต้อง: ธนาคารยูโอบี ต้องเป็นตัวเลข 10–12 หลัก"),
        ("KBANK", "๑๒๓๔๕๖๗๘๙๐", "เลขที่บัญชีไม่ถูกต้อง: ธนาคารกสิกรไทย ต้องเป็นตัวเลข 10 หลัก"),
        ("KBANK", "12345abcde", "เลขที่บัญชีไม่ถูกต้อง: ธนาคารกสิกรไทย ต้องเป็นตัวเลข 10 หลัก"),
        ("KBANK", None, "เลขที่บัญชีไม่ถูกต้อง: ธนาคารกสิกรไทย ต้องเป็นตัวเลข 10 หลัก"),
    ])
    def test_invalid(self, bank, raw, msg):
        with pytest.raises(L.AdvanceRuleError) as exc:
            L.check_account_no(bank, raw)
        assert str(exc.value) == msg

    def test_bank_label(self):
        assert L.bank_label("KTB") == "ธนาคารกรุงไทย"
        assert L.bank_label("ZZZ") == "ZZZ"
        assert L.bank_label(None) is None


class TestRequestFieldsV2:
    def test_new_fields_by_name_only(self):
        rows = [
            {"name": "adv_purpose", "type": "longtext", "sort_order": 1, "text": "p", "number": None, "date": None},
            {"name": "adv_amount", "type": "number", "sort_order": 2, "text": None, "number": Decimal("1500"), "date": None},
            {"name": "adv_cost_center", "type": "dropdown", "sort_order": 4, "text": "ศลบ", "number": None, "date": None},
            {"name": "adv_bank", "type": "dropdown", "sort_order": 5, "text": "KBANK", "number": None, "date": None},
            {"name": "adv_account_no", "type": "text", "sort_order": 6, "text": "1234567890", "number": None, "date": None},
            {"name": "adv_account_name", "type": "text", "sort_order": 7, "text": "นาย ก", "number": None, "date": None},
        ]
        picked = L.pick_request_values(rows)
        assert (picked["cost_center"], picked["bank"], picked["account_no"], picked["account_name"]) == \
            ("ศลบ", "KBANK", "1234567890", "นาย ก")

    def test_old_advance_without_new_questions(self):
        picked = L.pick_request_values([
            {"name": "adv_purpose", "type": "longtext", "sort_order": 1, "text": "p", "number": None, "date": None},
        ])
        assert picked["cost_center"] is None and picked["bank"] is None and picked["account_no"] is None

    def test_account_name_never_falls_back_to_purpose(self):
        picked = L.pick_request_values([
            {"name": "something_else", "type": "text", "sort_order": 1, "text": "x", "number": None, "date": None},
        ])
        assert picked["account_name"] is None


class TestSubmittedValue:
    QS = [{"id": 1, "name": "adv_amount", "type": "number", "sort_order": 2},
          {"id": 2, "name": "adv_bank", "type": "dropdown", "sort_order": 5}]

    def test_by_name(self):
        values = [{"question_id": 2, "value_text": "SCB", "value_number": None, "value_date": None}]
        assert L.submitted_value(self.QS, values, "adv_bank", (), "value_text") == "SCB"

    def test_fallback_by_type(self):
        qs = [{"id": 9, "name": "amount_old", "type": "number", "sort_order": 1}]
        values = [{"question_id": 9, "value_text": None, "value_number": Decimal("10"), "value_date": None}]
        assert L.submitted_value(qs, values, "adv_amount", ("number",), "value_number") == Decimal("10")

    def test_missing(self):
        assert L.submitted_value(self.QS, [], "adv_bank", (), "value_text") is None
        assert L.submitted_value([], [], "adv_bank", (), "value_text") is None


def test_clear_date_message_renamed():
    with pytest.raises(L.AdvanceRuleError, match="กรุณาระบุวันที่ส่งเอกสารเคลียร์"):
        L.check_clear(L.AWAITING_CLEARING, is_owner=True, amount_paid=100, clear_date=None,
                      amount_actual=100, settle_date=None)
```

- [ ] **Step 2: Run to verify they fail**

Run: `PYTHONDONTWRITEBYTECODE=1 .venv/bin/pytest tests/finance/test_approval_logic.py tests/finance/test_advance_logic.py -q`
Expected: FAIL (`approval_logic` missing, `check_account_no` missing).

- [ ] **Step 3: Implement.** Create `services/finance/approval_logic.py`:

```python
"""Pure rules: ADV approval by amount (menait-service spec 2026-09-29-finance-advance-v2-design.md §3).

No DB, no FastAPI. Inputs are plain dicts so everything is unit-testable.
Person: {"employee_id", "id", "level", "department_id", "active"}.
Tier:   {"clause", "amount_max" (Decimal | None = no cap), "min_level", "approver_label", "sort_order"}.
"""
from __future__ import annotations

from decimal import Decimal, InvalidOperation
from typing import Iterable, Mapping, Optional

from services.finance.advance_logic import AdvanceRuleError

ORG_WIDE_LEVEL = 9
TAB_MINE = "mine"
TAB_DELEGABLE = "delegable"

MSG_NO_TIERS = "ยังไม่ได้ตั้งค่าวงเงินอนุมัติ"
MSG_BAD_AMOUNT = "จำนวนเงินต้องมากกว่า 0"
MSG_NO_LEVEL = "ไม่พบระดับตำแหน่งของผู้ขอ"
MSG_NO_APPROVER = "ไม่พบผู้อนุมัติที่มีสิทธิ์สำหรับวงเงินนี้"


def to_amount(value) -> Decimal:
    try:
        amount = Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError):
        raise AdvanceRuleError(MSG_BAD_AMOUNT)
    if value is None or not amount.is_finite() or amount <= 0:
        raise AdvanceRuleError(MSG_BAD_AMOUNT)
    return amount


def pick_tier(tiers: Iterable[Mapping], amount) -> Mapping:
    value = to_amount(amount)
    ordered = sorted(tiers, key=lambda t: t["sort_order"])
    for tier in ordered:
        cap = tier.get("amount_max")
        if cap is None or value <= Decimal(str(cap)):
            return tier
    raise AdvanceRuleError(MSG_NO_TIERS)


def required_level(tier_min_level: int, requester_level: Optional[int]) -> int:
    if requester_level is None:
        raise AdvanceRuleError(MSG_NO_LEVEL)
    return max(tier_min_level, min(requester_level + 1, ORG_WIDE_LEVEL))


def can_approve(approver: Mapping, requester: Mapping, required: int, mapped_departments: Iterable[int]) -> bool:
    if not approver.get("active"):
        return False
    level = approver.get("level")
    if level is None or level < required:
        return False
    if approver.get("employee_id") == requester.get("employee_id"):
        return False
    if level >= ORG_WIDE_LEVEL:
        return True
    dept = requester.get("department_id")
    if dept is None:
        return False
    return approver.get("department_id") == dept or dept in set(mapped_departments)


def direct_level(people: Iterable[Mapping], requester: Mapping, required: int,
                 mappings: Mapping[str, Iterable[int]]) -> Optional[int]:
    levels = [p["level"] for p in people
              if can_approve(p, requester, required, mappings.get(p["employee_id"], ()))]
    return min(levels) if levels else None


def approval_tab(approver_level: int, direct: Optional[int]) -> str:
    return TAB_MINE if direct is not None and approver_level <= direct else TAB_DELEGABLE


def evaluate(tiers, people: Mapping[str, Mapping], mappings, requester_employee_id: str, amount) -> dict:
    tier = pick_tier(tiers, amount)
    requester = people.get(requester_employee_id)
    required = required_level(tier["min_level"], requester.get("level") if requester else None)
    direct = direct_level(people.values(), requester, required, mappings)
    if direct is None:
        raise AdvanceRuleError(MSG_NO_APPROVER)
    return {"clause": tier["clause"], "approver_label": tier["approver_label"], "min_level": tier["min_level"],
            "required_level": required, "direct_level": direct}
```

Modify `services/finance/advance_logic.py`:
- add `import re` at the top imports.
- in `check_clear`, change `"กรุณาระบุวันที่เคลียร์"` → `"กรุณาระบุวันที่ส่งเอกสารเคลียร์"`.
- replace `_REQUEST_FIELDS` / `_ROW_VALUE_KEY` with:

```python
# key → (question_name, accepted question types when the name is missing; () = by name only)
_REQUEST_FIELDS = {
    "purpose": ("adv_purpose", ("longtext", "text")),
    "amount": ("adv_amount", ("number",)),
    "use_date": ("adv_use_date", ("datetime", "date")),
    "cost_center": ("adv_cost_center", ()),
    "bank": ("adv_bank", ()),
    "account_no": ("adv_account_no", ()),
    "account_name": ("adv_account_name", ()),
}
_ROW_VALUE_KEY = {"purpose": "text", "amount": "number", "use_date": "date", "cost_center": "text",
                  "bank": "text", "account_no": "text", "account_name": "text"}
```

(`pick_request_values` body is unchanged: `r.get("type") in ()` is always False, so name-only fields never fall back.)

- append at the end of the file:

```python
# ---------------------------- payee bank account (spec v2 §4.2) ----------------------------
# value → (Thai label, allowed digit counts). Keep identical to menait-service lib/finance/bank.ts.
DEFAULT_ACCOUNT_DIGITS = (10, 11, 12)
BANKS = {
    "BBL": ("ธนาคารกรุงเทพ", (10,)),
    "KBANK": ("ธนาคารกสิกรไทย", (10,)),
    "KTB": ("ธนาคารกรุงไทย", (10,)),
    "SCB": ("ธนาคารไทยพาณิชย์", (10,)),
    "BAY": ("ธนาคารกรุงศรีอยุธยา", (10,)),
    "TTB": ("ธนาคารทหารไทยธนชาต", (10,)),
    "GSB": ("ธนาคารออมสิน", (12,)),
    "BAAC": ("ธ.ก.ส.", (12,)),
    "GHB": ("ธนาคารอาคารสงเคราะห์", (12,)),
    "UOB": ("ธนาคารยูโอบี", DEFAULT_ACCOUNT_DIGITS),
    "CIMBT": ("ธนาคารซีไอเอ็มบี ไทย", DEFAULT_ACCOUNT_DIGITS),
    "LHB": ("ธนาคารแลนด์ แอนด์ เฮ้าส์", DEFAULT_ACCOUNT_DIGITS),
    "KKP": ("ธนาคารเกียรตินาคินภัทร", DEFAULT_ACCOUNT_DIGITS),
    "TISCO": ("ธนาคารทิสโก้", DEFAULT_ACCOUNT_DIGITS),
    "ICBCT": ("ธนาคารไอซีบีซี (ไทย)", DEFAULT_ACCOUNT_DIGITS),
    "IBANK": ("ธนาคารอิสลามแห่งประเทศไทย", DEFAULT_ACCOUNT_DIGITS),
}
_ASCII_DIGITS = re.compile(r"[0-9]+")


def normalize_account_no(raw) -> str:
    return re.sub(r"[\s-]", "", str(raw)) if raw is not None else ""


def bank_label(value):
    if not value:
        return None
    return BANKS.get(value, (value,))[0]


def check_account_no(bank, raw) -> str:
    label, counts = BANKS.get(bank or "", (bank or "ธนาคาร", DEFAULT_ACCOUNT_DIGITS))
    digits = normalize_account_no(raw)
    if not _ASCII_DIGITS.fullmatch(digits) or len(digits) not in counts:
        count_text = f"{counts[0]}" if len(counts) == 1 else f"{counts[0]}–{counts[-1]}"
        raise AdvanceRuleError(f"เลขที่บัญชีไม่ถูกต้อง: {label} ต้องเป็นตัวเลข {count_text} หลัก")
    return digits


def submitted_value(questions, values, name, types, key):
    """questions: dicts {id, name, type, sort_order}; values: dicts {question_id, value_text, value_number,
    value_date}. Picks the question by name, else the first by sort_order whose type is in `types`, and
    returns that value's `key` (or None)."""
    ordered = sorted(questions, key=lambda q: q.get("sort_order") or 0)
    question = next((q for q in ordered if q.get("name") == name), None)
    if question is None:
        question = next((q for q in ordered if q.get("type") in types), None)
    if question is None:
        return None
    row = next((v for v in values if v.get("question_id") == question.get("id")), None)
    return row.get(key) if row else None
```

- [ ] **Step 4: Run all BE tests**: `PYTHONDONTWRITEBYTECODE=1 .venv/bin/pytest tests -q`. Expected: all PASS (90 existing + new). If an existing test asserted the old "กรุณาระบุวันที่เคลียร์" text, update that assertion to the new text.

- [ ] **Step 5: Commit**

```bash
git add services/finance/approval_logic.py services/finance/advance_logic.py tests/finance/test_approval_logic.py tests/finance/test_advance_logic.py
git commit -m "feat(finance): approval-by-amount rules, payee bank-account check, v2 request fields

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Tier model, migration SQL, approval loader, request serialization

**Files:**
- Modify: `models/finance_model.py` (add `FinApprovalTier`)
- Create: `scripts/migrations/2026-09-29_finance_advance_v2.sql`
- Create: `services/finance/approval_repo.py`
- Modify: `services/finance/advance_repo.py` (add `serialize_request`, use it in `serialize_advance`)
- Test: `tests/finance/test_finance_model.py` (append), `tests/finance/test_advance_repo.py` (append)

**Interfaces:**
- Consumes: Task 1 `approval_logic.*`, `advance_logic.bank_label`.
- Produces:
  - `models.finance_model.FinApprovalTier` (table `fin_approval_tiers`)
  - `approval_repo.load_context(db) -> ApprovalContext` (dataclass `tiers: list[dict]`, `people: dict[str, dict]`, `mappings: dict[str, set[int]]`)
  - `approval_repo.describe(db, requester_employee_id: str, amount) -> dict` (the `evaluate` dict; raises `AdvanceRuleError`)
  - `approval_repo.can_approve_submission(db, submission, approver_employee_id: str) -> bool`
  - `approval_repo.pending_for(db, employee_id: str) -> list[dict]`. Each item has `form_id, submission_id, created_at, requester, request, tier {clause, approver_label, required_level}, tab`
  - `approval_repo.list_tiers(db) -> list[dict]` (JSON-safe: `amount_max` float | None)
  - `advance_repo.serialize_request(request: dict | None) -> dict` with keys `purpose, amount, use_date, cost_center, bank, bank_label, account_no, account_name`

- [ ] **Step 1: Failing tests.** Append to `tests/finance/test_finance_model.py`:

```python
def test_fin_approval_tiers_matches_sql():
    import models  # noqa: F401
    from database import Base
    from models.finance_model import FinApprovalTier
    assert "fin_approval_tiers" in Base.metadata.tables
    ddl = str(CreateTable(FinApprovalTier.__table__).compile(dialect=postgresql.dialect()))
    assert "clause VARCHAR(10) NOT NULL" in ddl
    assert "amount_max NUMERIC(14, 2)" in ddl
    assert "min_level BETWEEN 1 AND 20" in ddl
    assert "approver_label VARCHAR(120) NOT NULL" in ddl
    assert "PRIMARY KEY (clause)" in ddl
    sql = open(os.path.join(os.path.dirname(__file__), "..", "..", "scripts", "migrations",
                            "2026-09-29_finance_advance_v2.sql"), encoding="utf-8").read()
    for fragment in ("CREATE TABLE IF NOT EXISTS fin_approval_tiers", "numeric(14,2)",
                     "CHECK (min_level BETWEEN 1 AND 20)", "'6.1'", "ON CONFLICT (clause) DO NOTHING",
                     "UPDATE form_approval_rules SET is_active = false", "'adv_account_no'"):
        assert fragment in sql
```

Append to `tests/finance/test_advance_repo.py`:

```python
def test_serialize_request_v2_fields():
    from decimal import Decimal
    from services.finance.advance_repo import serialize_request
    out = serialize_request({"purpose": "p", "amount": Decimal("1500.50"), "use_date": None,
                             "cost_center": "ศลบ", "bank": "KBANK", "account_no": "1234567890",
                             "account_name": "นาย ก"})
    assert out == {"purpose": "p", "amount": 1500.5, "use_date": None, "cost_center": "ศลบ", "bank": "KBANK",
                   "bank_label": "ธนาคารกสิกรไทย", "account_no": "1234567890", "account_name": "นาย ก"}


def test_serialize_request_empty():
    from services.finance.advance_repo import serialize_request
    out = serialize_request(None)
    assert out["amount"] is None and out["bank_label"] is None and out["cost_center"] is None
```

- [ ] **Step 2: Run to verify they fail**: `PYTHONDONTWRITEBYTECODE=1 .venv/bin/pytest tests/finance/test_finance_model.py tests/finance/test_advance_repo.py -q`. Expected: FAIL (no `FinApprovalTier`, no SQL file, no `serialize_request`).

- [ ] **Step 3: Implement.**

`models/finance_model.py`: append

```python
class FinApprovalTier(Base):
    """ADV approval by amount (clause 6). Created by scripts/migrations/2026-09-29_finance_advance_v2.sql."""
    __tablename__ = "fin_approval_tiers"

    clause = Column(String(10), primary_key=True)
    amount_max = Column(Numeric(14, 2))           # NULL = no cap
    min_level = Column(Integer, nullable=False)
    approver_label = Column(String(120), nullable=False)
    sort_order = Column(Integer, nullable=False)

    __table_args__ = (
        CheckConstraint("min_level BETWEEN 1 AND 20", name="ck_fin_approval_tiers_min_level"),
    )
```

`scripts/migrations/2026-09-29_finance_advance_v2.sql` (DBeaver-safe: no `DO $$`, one transaction, idempotent):

```sql
-- Finance Advance v2 (2026-09-29) — menait-service docs/superpowers/specs/2026-09-29-finance-advance-v2-design.md §6
-- Run once in DBeaver against ncacdb (safe to re-run). Additive: one new table, 2 rules deactivated,
-- 4 questions + options added to form ADV.
BEGIN;

-- 1) approval tiers (clause 6)
CREATE TABLE IF NOT EXISTS fin_approval_tiers (
    clause         varchar(10)   PRIMARY KEY,
    amount_max     numeric(14,2),
    min_level      integer       NOT NULL,
    approver_label varchar(120)  NOT NULL,
    sort_order     integer       NOT NULL,
    CONSTRAINT ck_fin_approval_tiers_min_level CHECK (min_level BETWEEN 1 AND 20)
);

INSERT INTO fin_approval_tiers (clause, amount_max, min_level, approver_label, sort_order) VALUES
    ('6.7',       2000.00, 2, 'Asst. Sup (ระดับ 2)',              1),
    ('6.6',       5000.00, 3, 'Sup / Asst.M (ระดับ 3–4)',         2),
    ('6.5',      20000.00, 5, 'MGR / SM / DPCL (ระดับ 5–7)',      3),
    ('6.4',     100000.00, 8, 'CL (ระดับ 8)',                     4),
    ('6.3',     500000.00, 9, 'DCEO (นโยบายระดับ 9)',             5),
    ('6.2',    1000000.00, 9, 'CEO (นโยบายระดับ 10 → ระบบใช้ 9)', 6),
    ('6.1',          NULL, 9, 'ExC (นโยบายระดับ 11 → ระบบใช้ 9)', 7)
ON CONFLICT (clause) DO NOTHING;

-- 2) the v1 requester-level rules are replaced by the tiers
UPDATE form_approval_rules SET is_active = false
WHERE form_master_id IN (SELECT id FROM form_masters WHERE form_code = 'ADV')
  AND is_active = true;

-- 3) payee questions on ADV
INSERT INTO form_questions (form_master_id, question_name, question_label, question_type,
                            is_required, sort_order, created_at)
SELECT fm.id, q.name, q.label, q.qtype, true, q.sort_order, now()
FROM form_masters fm,
     (VALUES ('adv_cost_center',  'ค่าใช้จ่ายรายศูนย์', 'dropdown', 4),
             ('adv_bank',         'ธนาคาร',           'dropdown', 5),
             ('adv_account_no',   'เลขที่บัญชี',       'text',     6),
             ('adv_account_name', 'ชื่อบัญชี',         'text',     7)) AS q(name, label, qtype, sort_order)
WHERE fm.form_code = 'ADV' AND fm.is_latest = true
  AND NOT EXISTS (SELECT 1 FROM form_questions x WHERE x.form_master_id = fm.id AND x.question_name = q.name);

INSERT INTO form_question_options (question_id, option_value, option_label, sort_order)
SELECT fq.id, o.value, o.label, o.sort_order
FROM form_questions fq
JOIN form_masters fm ON fm.id = fq.form_master_id AND fm.form_code = 'ADV' AND fm.is_latest = true
JOIN (VALUES
        ('adv_cost_center', 'ศลบ',   'ศลบ',                          1),
        ('adv_cost_center', 'สกท',   'สกท',                          2),
        ('adv_cost_center', 'สสบ',   'สสบ',                          3),
        ('adv_cost_center', 'ศรย',   'ศรย',                          4),
        ('adv_cost_center', 'ศขก',   'ศขก',                          5),
        ('adv_cost_center', 'ศบก',   'ศบก',                          6),
        ('adv_bank',        'BBL',   'ธนาคารกรุงเทพ',                1),
        ('adv_bank',        'KBANK', 'ธนาคารกสิกรไทย',               2),
        ('adv_bank',        'KTB',   'ธนาคารกรุงไทย',                3),
        ('adv_bank',        'SCB',   'ธนาคารไทยพาณิชย์',             4),
        ('adv_bank',        'BAY',   'ธนาคารกรุงศรีอยุธยา',          5),
        ('adv_bank',        'TTB',   'ธนาคารทหารไทยธนชาต',           6),
        ('adv_bank',        'GSB',   'ธนาคารออมสิน',                 7),
        ('adv_bank',        'BAAC',  'ธ.ก.ส.',                       8),
        ('adv_bank',        'GHB',   'ธนาคารอาคารสงเคราะห์',         9),
        ('adv_bank',        'UOB',   'ธนาคารยูโอบี',                 10),
        ('adv_bank',        'CIMBT', 'ธนาคารซีไอเอ็มบี ไทย',         11),
        ('adv_bank',        'LHB',   'ธนาคารแลนด์ แอนด์ เฮ้าส์',     12),
        ('adv_bank',        'KKP',   'ธนาคารเกียรตินาคินภัทร',       13),
        ('adv_bank',        'TISCO', 'ธนาคารทิสโก้',                 14),
        ('adv_bank',        'ICBCT', 'ธนาคารไอซีบีซี (ไทย)',         15),
        ('adv_bank',        'IBANK', 'ธนาคารอิสลามแห่งประเทศไทย',    16)
     ) AS o(qname, value, label, sort_order) ON o.qname = fq.question_name
WHERE NOT EXISTS (SELECT 1 FROM form_question_options x WHERE x.question_id = fq.id AND x.option_value = o.value);

COMMIT;
```

`services/finance/advance_repo.py`: add, above `serialize_advance`:

```python
def serialize_request(request):
    request = request or {}
    return {
        "purpose": request.get("purpose"),
        "amount": _num(request.get("amount")),
        "use_date": _iso(request.get("use_date")),
        "cost_center": request.get("cost_center"),
        "bank": request.get("bank"),
        "bank_label": logic.bank_label(request.get("bank")),
        "account_no": request.get("account_no"),
        "account_name": request.get("account_name"),
    }
```

and in `serialize_advance` replace the whole `"request": {...}` literal with `"request": serialize_request(request),` (and drop the now-unused `request = request or {}` line).

Create `services/finance/approval_repo.py`:

```python
"""DB loading for ADV approval by amount. Rules live in approval_logic (pure)."""
from __future__ import annotations

from dataclasses import dataclass, field

from models.finance_model import FinApprovalTier
from models.form_approver_department import FormApproverDepartment
from models.master_model import FormMaster, FormSubmission
from models.user_model import Position, User
from services.finance import advance_repo
from services.finance import approval_logic as rules
from services.finance.advance_logic import AdvanceRuleError


@dataclass
class ApprovalContext:
    tiers: list = field(default_factory=list)
    people: dict = field(default_factory=dict)
    mappings: dict = field(default_factory=dict)


def load_tiers(db):
    return [
        {"clause": t.clause, "amount_max": t.amount_max, "min_level": t.min_level,
         "approver_label": t.approver_label, "sort_order": t.sort_order}
        for t in db.query(FinApprovalTier).order_by(FinApprovalTier.sort_order).all()
    ]


def list_tiers(db):
    return [{**t, "amount_max": float(t["amount_max"]) if t["amount_max"] is not None else None}
            for t in load_tiers(db)]


def load_people(db):
    rows = db.query(User, Position.position_level_id).outerjoin(
        Position, Position.position_id == User.position_id).all()
    return {
        user.employee_id: {"employee_id": user.employee_id, "id": user.id, "level": level,
                           "department_id": user.department_id, "active": user.employee_status == "Active"}
        for user, level in rows if user.employee_id
    }


def load_mappings(db):
    mappings = {}
    rows = db.query(FormApproverDepartment).filter(FormApproverDepartment.is_active == True).all()  # noqa: E712
    for row in rows:
        mappings.setdefault(row.employee_id, set()).add(row.department_id)
    return mappings


def load_context(db) -> ApprovalContext:
    return ApprovalContext(tiers=load_tiers(db), people=load_people(db), mappings=load_mappings(db))


def describe(db, requester_employee_id, amount, ctx: ApprovalContext | None = None):
    ctx = ctx or load_context(db)
    return rules.evaluate(ctx.tiers, ctx.people, ctx.mappings, requester_employee_id, amount)


def _amount_of(db, submission_id):
    return (advance_repo.request_values_by_submission(db, [submission_id]).get(submission_id) or {}).get("amount")


def can_approve_submission(db, submission, approver_employee_id) -> bool:
    ctx = load_context(db)
    try:
        result = describe(db, submission.created_by, _amount_of(db, submission.id), ctx)
    except AdvanceRuleError:
        return False
    approver = ctx.people.get(approver_employee_id)
    requester = ctx.people.get(submission.created_by)
    if approver is None or requester is None:
        return False
    return rules.can_approve(approver, requester, result["required_level"],
                             ctx.mappings.get(approver_employee_id, ()))


def pending_for(db, employee_id):
    ctx = load_context(db)
    approver = ctx.people.get(employee_id)
    if approver is None or approver["level"] is None:
        return []
    subs = (
        db.query(FormSubmission)
        .join(FormMaster, FormMaster.id == FormSubmission.form_master_id)
        .filter(FormMaster.form_type == advance_repo.ADVANCE_FORM_TYPE,
                FormSubmission.status_approve == "In Progress")
        .order_by(FormSubmission.id.desc())
        .all()
    )
    requests = advance_repo.request_values_by_submission(db, [s.id for s in subs])
    people_info = advance_repo.people_by_employee_id(db, [s.created_by for s in subs])
    items = []
    for sub in subs:
        requester = ctx.people.get(sub.created_by)
        if requester is None:
            continue
        request = requests.get(sub.id) or {}
        try:
            result = describe(db, sub.created_by, request.get("amount"), ctx)
        except AdvanceRuleError:
            continue
        if not rules.can_approve(approver, requester, result["required_level"], ctx.mappings.get(employee_id, ())):
            continue
        items.append({
            "form_id": sub.form_id,
            "submission_id": sub.id,
            "created_at": advance_repo._iso(sub.created_at),
            "requester": people_info.get(sub.created_by) or {
                "employee_id": sub.created_by, "name": None, "department": None, "site": None, "site_code": None},
            "request": advance_repo.serialize_request(request),
            "tier": {"clause": result["clause"], "approver_label": result["approver_label"],
                     "required_level": result["required_level"]},
            "tab": rules.approval_tab(approver["level"], result["direct_level"]),
        })
    return items
```

- [ ] **Step 4: Run all BE tests**: `PYTHONDONTWRITEBYTECODE=1 .venv/bin/pytest tests -q`. Expected: all PASS. Also `.venv/bin/python -c "import main"` with `DATABASE_URL=postgresql://u:p@localhost:5432/x`: expected no ImportError. (It must not connect, so only import; if `main` connects at import, use `python -c "import services.finance.approval_repo"` instead.)

- [ ] **Step 5: Commit**

```bash
git add models/finance_model.py scripts/migrations/2026-09-29_finance_advance_v2.sql services/finance/approval_repo.py services/finance/advance_repo.py tests/finance/test_finance_model.py tests/finance/test_advance_repo.py
git commit -m "feat(finance): fin_approval_tiers model + v2 migration SQL, approval loader, payee request serialization

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Wire the ADV branch into the shared form engine

**Files:**
- Modify: `routes/forms/form_submission_routes.py` (`submit_form` ADV guard + initial state; `update_form_details` lock)
- Modify: `routes/forms/form_approval_routes.py` (`approve_submission`, `reject_submission`, `get_pending_approvals`)
- Test: `tests/finance/test_engine_wiring.py` (new; static checks, DB-free)

**Interfaces:**
- Consumes: `advance_logic.submitted_value`, `advance_logic.check_account_no`, `approval_repo.describe`, `approval_repo.can_approve_submission`, `notify_guard.ADVANCE_FORM_TYPE`.
- Produces: HTTP behaviour (smoke-tested by the controller in Task 10):
  - ADV submit: 400 on bad account number / no tiers / bad amount / no requester level / no eligible approver; otherwise `status_approve="In Progress"`, `current_approval_level=1`; the account number is stored as normalized digits.
  - ADV approve/reject: 403 unless `can_approve_submission`; approve → `Approved` (single step).
  - `/forms/pending-approvals` never lists ADV.
  - `PUT /forms/{form_id}` on ADV: 400 unless `status_approve == "In Progress"`, 403 unless `updated_by == created_by`.

- [ ] **Step 1: Failing test** `tests/finance/test_engine_wiring.py`. Route handlers need a DB, so pin the wiring by source inspection. It is cheap and catches a lost branch:

```python
import inspect

from routes.forms import form_approval_routes as approval_routes
from routes.forms import form_submission_routes as submission_routes


def test_submit_has_advance_guards():
    src = inspect.getsource(submission_routes.submit_form)
    assert "check_account_no" in src
    assert "approval_repo.describe" in src
    assert 'status_approve, current_level = "In Progress", 1' in src


def test_update_locks_advance():
    src = inspect.getsource(submission_routes.update_form_details)
    assert "แก้ไขคำขอเบิกไม่ได้หลังอนุมัติ/ไม่อนุมัติแล้ว" in src
    assert "เฉพาะผู้ขอเบิกเท่านั้นที่แก้ไขคำขอได้" in src


def test_approve_reject_branch_on_advance():
    for fn in (approval_routes.approve_submission, approval_routes.reject_submission):
        src = inspect.getsource(fn)
        assert "approval_repo.can_approve_submission" in src


def test_generic_pending_skips_advance():
    src = inspect.getsource(approval_routes.get_pending_approvals)
    assert "is_advance_submission(sub)" in src
```

(`tests/conftest.py` already sets `sys.path`; `DATABASE_URL` must be set for the imports, so add `os.environ.setdefault("DATABASE_URL", "postgresql://u:p@localhost:5432/x")` above the imports, as `test_finance_model.py` does.)

- [ ] **Step 2: Run to verify it fails**: `PYTHONDONTWRITEBYTECODE=1 .venv/bin/pytest tests/finance/test_engine_wiring.py -q`. Expected: FAIL.

- [ ] **Step 3: Implement.**

`routes/forms/form_submission_routes.py`
- imports: add `from services.finance import approval_repo`.
- In `submit_form`, inside the existing `if form.form_type == ADVANCE_FORM_TYPE:` block (it runs **before** `try:`), after the use-date check, add:

```python
        questions = [{"id": q.id, "name": q.question_name, "type": q.question_type, "sort_order": q.sort_order}
                     for q in form.questions]
        raw_values = [{"question_id": v.question_id, "value_text": v.value_text, "value_number": v.value_number,
                       "value_date": v.value_date} for v in payload.values]
        try:
            account_q = next((q for q in form.questions if q.question_name == "adv_account_no"), None)
            if account_q is not None:
                bank = advance_logic.submitted_value(questions, raw_values, "adv_bank", (), "value_text")
                account_value = next((v for v in payload.values if v.question_id == account_q.id), None)
                digits = advance_logic.check_account_no(bank, account_value.value_text if account_value else None)
                account_value.value_text = digits
            amount = advance_logic.submitted_value(questions, raw_values, "adv_amount", ("number",), "value_number")
            approval_repo.describe(db, payload.created_by, amount)
        except advance_logic.AdvanceRuleError as exc:
            raise HTTPException(status_code=400, detail=str(exc))
```

- In the `try:` block, replace the `if not form.need_approval: ... else: ... determine_initial_approval(...)` block with:

```python
        if form.form_type == ADVANCE_FORM_TYPE:
            # approval by amount (spec v2 §3): always one step, eligibility is computed on the fly
            status_approve, current_level = "In Progress", 1
        elif not form.need_approval:
            status_approve, current_level = "Approved", None
        else:
            status_approve, current_level = determine_initial_approval(
                db,
                form.id,
                creator_level
            )
```

- In `update_form_details`, right after the `# 🔒 lock done` check (before `try:`), add:

```python
    if submission.form is not None and submission.form.form_type == ADVANCE_FORM_TYPE:
        if submission.status_approve != "In Progress":
            raise HTTPException(status_code=400, detail="แก้ไขคำขอเบิกไม่ได้หลังอนุมัติ/ไม่อนุมัติแล้ว")
        if payload.updated_by != submission.created_by:
            raise HTTPException(status_code=403, detail="เฉพาะผู้ขอเบิกเท่านั้นที่แก้ไขคำขอได้")
```

`routes/forms/form_approval_routes.py`
- imports: `from services.notify_guard import ADVANCE_FORM_TYPE, notifications_enabled` and `from services.finance import approval_repo`.
- add a helper near the other helpers:

```python
def is_advance_submission(submission: FormSubmission) -> bool:
    return submission.form is not None and submission.form.form_type == ADVANCE_FORM_TYPE
```

- `get_pending_approvals`: first line inside `for sub in submissions:` becomes
  `if is_advance_submission(sub): continue  # ADV has its own queue: GET /finance/approvals/pending`
- `approve_submission`: after `if not requester or not approver: raise HTTPException(404, "User not found")`, wrap the existing authorization in a branch:

```python
    advance = is_advance_submission(submission)
    if advance:
        if not approval_repo.can_approve_submission(db, submission, employee_id):
            raise HTTPException(403, "Not authorized to approve")
    else:
        # (the existing lines unchanged: approver_level … pos_req … rule … can_user_approve … 403)
```

  and replace the `next_rule = get_applicable_rule(...)` / `if next_rule:` block with:

```python
    if advance:
        submission.status_approve = "Approved"
    else:
        next_rule = get_applicable_rule(
            db=db,
            form_master_id=submission.form_master_id,
            creator_level=pos_req.position_level_id,
            level_no=submission.current_approval_level + 1,
        )
        if next_rule:
            submission.current_approval_level += 1
            submission.status_approve = "In Progress"
        else:
            submission.status_approve = "Approved"
```

  (`FormApprovalLog` insert and the email block stay as they are; the email is already gated by `notifications_enabled`.)
- `reject_submission`: the same `advance = ...; if advance: ... 403 "Not authorized to reject" ... else: <existing block>` branch around its authorization lines.

- [ ] **Step 4: Run all BE tests**: `PYTHONDONTWRITEBYTECODE=1 .venv/bin/pytest tests -q`. Expected: PASS. Then `.venv/bin/python -m py_compile routes/forms/form_submission_routes.py routes/forms/form_approval_routes.py`.

- [ ] **Step 5: Commit**

```bash
git add routes/forms/form_submission_routes.py routes/forms/form_approval_routes.py tests/finance/test_engine_wiring.py
git commit -m "feat(forms): ADV approval by amount in submit/approve/reject, own queue, lock request after approval

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Finance routes: tiers, preview, pending queue, pay without acc_code

**Files:**
- Modify: `routes/finance/advance_routes.py`
- Modify: `schemas/finance_schema.py` (`PayIn`)
- Test: `tests/finance/test_finance_schema.py` (append)

**Interfaces:**
- Consumes: `approval_repo.list_tiers`, `describe`, `pending_for`.
- Produces (FE Tasks 5/6/9 call these through Next proxies):
  - `GET /finance/approval-tiers` → `[{clause, amount_max, min_level, approver_label, sort_order}]`
  - `GET /finance/approval-preview?employee_id=&amount=` → `{clause, approver_label, required_level}`; 400 `{detail}` on rule errors
  - `GET /finance/approvals/pending?employee_id=` → `approval_repo.pending_for` list
  - `GET /finance/advances/{form_id}` now also has `"approval": {clause, approver_label, required_level} | null`
  - `PUT /finance/advances/{form_id}/pay`: `acc_code` optional, `voucher_date` required

- [ ] **Step 1: Failing tests**, appended to `tests/finance/test_finance_schema.py`:

```python
def test_pay_in_v2_acc_code_optional_voucher_date_required():
    from datetime import date
    import pytest
    from pydantic import ValidationError
    from schemas.finance_schema import PayIn
    body = PayIn(action_by="670108", amount_paid="3000", transfer_date="2026-10-01", voucher_date="2026-09-29")
    assert body.acc_code is None and body.voucher_date == date(2026, 9, 29)
    with pytest.raises(ValidationError):
        PayIn(action_by="670108", amount_paid="3000", transfer_date="2026-10-01")
```

- [ ] **Step 2: Verify it fails**: `PYTHONDONTWRITEBYTECODE=1 .venv/bin/pytest tests/finance/test_finance_schema.py -q`. Expected: FAIL.

- [ ] **Step 3: Implement.**

`schemas/finance_schema.py` `PayIn`: `acc_code: Optional[str] = None` and `voucher_date: date` (the other fields unchanged).

`routes/finance/advance_routes.py`:
- imports: add `from services.finance import approval_repo`.
- add endpoints (below `summary`):

```python
@router.get("/approval-tiers")
def approval_tiers(db: Session = Depends(get_db)):
    return approval_repo.list_tiers(db)


@router.get("/approval-preview")
def approval_preview(employee_id: str, amount: str, db: Session = Depends(get_db)):
    try:
        result = approval_repo.describe(db, employee_id, amount)
    except logic.AdvanceRuleError as exc:
        raise _rule_error(exc)
    return {"clause": result["clause"], "approver_label": result["approver_label"],
            "required_level": result["required_level"]}


@router.get("/approvals/pending")
def approvals_pending(employee_id: str, db: Session = Depends(get_db)):
    return approval_repo.pending_for(db, employee_id)
```

  Place them above the `advances (write)` section.
- `get_advance`: after the 404 check add

```python
    try:
        result = approval_repo.describe(db, detail["requester"]["employee_id"], detail["request"]["amount"])
        detail["approval"] = {"clause": result["clause"], "approver_label": result["approver_label"],
                              "required_level": result["required_level"]}
    except logic.AdvanceRuleError:
        detail["approval"] = None
```

- `pay_advance`: replace the `account = db.get(...)` line and the `acc_active=...` argument with:

```python
    account = db.get(FinAccount, body.acc_code) if body.acc_code else None
    acc_active = True if not body.acc_code else bool(account and account.is_active)
```

  and pass `acc_active=acc_active`. In `_pay_values(body, due)` keep the key set, but the caller must not wipe an old code on edit: after `values = _pay_values(body, due)` add
  `if body.acc_code is None and adv is not None: values["acc_code"] = adv.acc_code`.

- [ ] **Step 4: Run all BE tests** (`PYTHONDONTWRITEBYTECODE=1 .venv/bin/pytest tests -q` → PASS) and `py_compile` the route file.

- [ ] **Step 5: Commit**

```bash
git add routes/finance/advance_routes.py schemas/finance_schema.py tests/finance/test_finance_schema.py
git commit -m "feat(finance): approval tiers/preview/pending endpoints, pay without petty-cash code, voucher date required

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## FE lane (Tasks 5–9, sequential, in `~/Documents/github/menait-service`)

### Task 5: FE foundations: bank rules, dates, DateField, types, labels, export, S3 helper, proxy routes

**Files:**
- Create: `lib/finance/bank.ts`, `lib/finance/bank.test.ts`, `app/finance/components/DateField.tsx`, `lib/s3.ts`,
  `app/api/finance/approval-preview/route.ts`, `app/api/finance/approvals/route.ts`
- Modify: `lib/finance/dates.ts`, `lib/finance/dates.test.ts`, `app/finance/types.ts`, `app/finance/labels.ts`,
  `lib/finance/export.ts`, `lib/finance/export.test.ts`, `app/api/uploads3/route.ts`, `app/api/finance/advances/[form_id]/route.ts`

**Interfaces:**
- Produces (Tasks 6–9):
  - `bank.ts`: `BANKS: Record<string, { label: string; digits: readonly number[] }>`, `DEFAULT_ACCOUNT_DIGITS`, `normalizeAccountNo(raw)`, `accountNoError(bank, raw): string | null`, `formatAccountNo(raw): string`, `bankLabel(value): string`
  - `dates.ts`: `formatDateFull(iso): string` (`'YYYY-MM-DD'` → `'dd/mm/yyyy'`, else `''`), `isoToLocalDate(iso): Date`, `localDateToIso(d): string`, `toBkkDate(value): string`
  - `<DateField value onChange disabled? min? placeholder? />`, where value/onChange/min are `'YYYY-MM-DD'`
  - types: `RequestInfo`, `ApprovalTierInfo`, `PendingApprovalItem`, `AdvanceDetail.approval?`
  - `lib/s3.ts`: `s3`, `BUCKET_NAME`, `BASE_PATH`, `FORM_ID_PATTERN`, `hasFiles(prefix): Promise<boolean>`
  - `CLEAR_ATTACHMENT_REQUIRED = 'กรุณาแนบใบเสร็จ / สลิปคืนเงินอย่างน้อย 1 ไฟล์'`, exported from `app/finance/labels.ts`
  - Next routes: `GET /api/finance/approval-preview?amount=` and `GET /api/finance/approvals` (both use the session employee_id)

- [ ] **Step 1: Failing tests.** `lib/finance/bank.test.ts`:

```ts
import { describe, expect, test } from 'bun:test';
import { BANKS, accountNoError, bankLabel, formatAccountNo, normalizeAccountNo } from './bank';

describe('bank account', () => {
  test('normalize strips spaces and dashes', () => {
    expect(normalizeAccountNo(' 123-4-56789-0 ')).toBe('1234567890');
  });
  test('valid lengths per bank', () => {
    expect(accountNoError('KBANK', '123-4-56789-0')).toBeNull();
    expect(accountNoError('GSB', '0200-1234-5678')).toBeNull();
    expect(accountNoError('UOB', '12345678901')).toBeNull();
    expect(accountNoError('OTHER', '123456789012')).toBeNull();
  });
  test('messages match the BE exactly', () => {
    expect(accountNoError('KBANK', '123456789')).toBe('เลขที่บัญชีไม่ถูกต้อง: ธนาคารกสิกรไทย ต้องเป็นตัวเลข 10 หลัก');
    expect(accountNoError('GSB', '1234567890')).toBe('เลขที่บัญชีไม่ถูกต้อง: ธนาคารออมสิน ต้องเป็นตัวเลข 12 หลัก');
    expect(accountNoError('UOB', '123456789')).toBe('เลขที่บัญชีไม่ถูกต้อง: ธนาคารยูโอบี ต้องเป็นตัวเลข 10–12 หลัก');
    expect(accountNoError('KBANK', '๑๒๓๔๕๖๗๘๙๐')).toBe('เลขที่บัญชีไม่ถูกต้อง: ธนาคารกสิกรไทย ต้องเป็นตัวเลข 10 หลัก');
    expect(accountNoError('KBANK', '')).toBe('เลขที่บัญชีไม่ถูกต้อง: ธนาคารกสิกรไทย ต้องเป็นตัวเลข 10 หลัก');
  });
  test('format and label', () => {
    expect(formatAccountNo('1234567890')).toBe('123-4-56789-0');
    expect(formatAccountNo('020012345678')).toBe('020012345678');
    expect(formatAccountNo(null)).toBe('-');
    expect(bankLabel('KTB')).toBe('ธนาคารกรุงไทย');
    expect(bankLabel('ZZZ')).toBe('ZZZ');
    expect(bankLabel(null)).toBe('-');
  });
  test('16 banks', () => {
    expect(Object.keys(BANKS)).toEqual(['BBL', 'KBANK', 'KTB', 'SCB', 'BAY', 'TTB', 'GSB', 'BAAC', 'GHB',
      'UOB', 'CIMBT', 'LHB', 'KKP', 'TISCO', 'ICBCT', 'IBANK']);
  });
});
```

Append to `lib/finance/dates.test.ts`:

```ts
import { formatDateFull, isoToLocalDate, localDateToIso, toBkkDate } from './dates';

test('formatDateFull dd/mm/yyyy', () => {
  expect(formatDateFull('2026-09-29')).toBe('29/09/2026');
  expect(formatDateFull('')).toBe('');
  expect(formatDateFull(null)).toBe('');
});
test('local date round trip', () => {
  expect(localDateToIso(isoToLocalDate('2026-01-31'))).toBe('2026-01-31');
});
test('toBkkDate', () => {
  expect(toBkkDate('2026-10-01T00:00:00+00:00')).toBe('2026-10-01');
  expect(toBkkDate('2026-09-30T20:00:00+00:00')).toBe('2026-10-01'); // 03:00 BKK next day
  expect(toBkkDate('2026-10-01')).toBe('2026-10-01');
  expect(toBkkDate(null)).toBe('');
  expect(toBkkDate('garbage')).toBe('');
});
```

(If `dates.test.ts` already imports from `bun:test`/`./dates`, merge the imports instead of duplicating.)

Update `lib/finance/export.test.ts`: `expect(row['วันที่เคลียร์'])` → `expect(row['วันที่ส่งเอกสารเคลียร์'])`; the fixture item gets `request: { ..., cost_center: 'ศลบ', bank: 'KBANK', bank_label: 'ธนาคารกสิกรไทย', account_no: '1234567890', account_name: 'นาย ก' }` and add:

```ts
test('v2 columns', () => {
  expect(EXPORT_COLUMNS).not.toContain('รหัสบัญชี');
  expect(EXPORT_COLUMNS.slice(-4)).toEqual(['ศูนย์ค่าใช้จ่าย', 'ธนาคาร', 'เลขที่บัญชี', 'ชื่อบัญชี']);
  const [row] = toSheetRows([item]);
  expect(row['ศูนย์ค่าใช้จ่าย']).toBe('ศลบ');
  expect(row['ธนาคาร']).toBe('ธนาคารกสิกรไทย');
  expect(row['เลขที่บัญชี']).toBe('123-4-56789-0');
  expect(row['ชื่อบัญชี']).toBe('นาย ก');
});
test('old advance without payee fields exports blanks', () => {
  const [row] = toSheetRows([{ ...item, request: { purpose: 'x', amount: 1, use_date: null } as any }]);
  expect(row['ศูนย์ค่าใช้จ่าย']).toBe('');
  expect(row['เลขที่บัญชี']).toBe('');
});
```

(Use the fixture variable name the file already has; if it builds the item inline, extract it to `const item` first.)

- [ ] **Step 2: Verify fail**: `bun test lib/finance`. Expected: FAIL (missing module/exports).

- [ ] **Step 3: Implement.**

`lib/finance/bank.ts`:

```ts
/** Payee bank rules. Keep identical to api-ncac services/finance/advance_logic.py BANKS (spec v2 §4.2). */
export const DEFAULT_ACCOUNT_DIGITS = [10, 11, 12] as const;

export const BANKS: Record<string, { label: string; digits: readonly number[] }> = {
  BBL: { label: 'ธนาคารกรุงเทพ', digits: [10] },
  KBANK: { label: 'ธนาคารกสิกรไทย', digits: [10] },
  KTB: { label: 'ธนาคารกรุงไทย', digits: [10] },
  SCB: { label: 'ธนาคารไทยพาณิชย์', digits: [10] },
  BAY: { label: 'ธนาคารกรุงศรีอยุธยา', digits: [10] },
  TTB: { label: 'ธนาคารทหารไทยธนชาต', digits: [10] },
  GSB: { label: 'ธนาคารออมสิน', digits: [12] },
  BAAC: { label: 'ธ.ก.ส.', digits: [12] },
  GHB: { label: 'ธนาคารอาคารสงเคราะห์', digits: [12] },
  UOB: { label: 'ธนาคารยูโอบี', digits: DEFAULT_ACCOUNT_DIGITS },
  CIMBT: { label: 'ธนาคารซีไอเอ็มบี ไทย', digits: DEFAULT_ACCOUNT_DIGITS },
  LHB: { label: 'ธนาคารแลนด์ แอนด์ เฮ้าส์', digits: DEFAULT_ACCOUNT_DIGITS },
  KKP: { label: 'ธนาคารเกียรตินาคินภัทร', digits: DEFAULT_ACCOUNT_DIGITS },
  TISCO: { label: 'ธนาคารทิสโก้', digits: DEFAULT_ACCOUNT_DIGITS },
  ICBCT: { label: 'ธนาคารไอซีบีซี (ไทย)', digits: DEFAULT_ACCOUNT_DIGITS },
  IBANK: { label: 'ธนาคารอิสลามแห่งประเทศไทย', digits: DEFAULT_ACCOUNT_DIGITS },
};

export function normalizeAccountNo(raw: string | null | undefined): string {
  return (raw ?? '').replace(/[\s-]/g, '');
}

export function accountNoError(bank: string | null | undefined, raw: string | null | undefined): string | null {
  const info = BANKS[bank ?? ''];
  const digits = info?.digits ?? DEFAULT_ACCOUNT_DIGITS;
  const n = normalizeAccountNo(raw);
  if (/^[0-9]+$/.test(n) && digits.includes(n.length)) return null;
  const count = digits.length === 1 ? `${digits[0]}` : `${digits[0]}–${digits[digits.length - 1]}`;
  return `เลขที่บัญชีไม่ถูกต้อง: ${info?.label ?? (bank || 'ธนาคาร')} ต้องเป็นตัวเลข ${count} หลัก`;
}

export function formatAccountNo(raw: string | null | undefined): string {
  const n = normalizeAccountNo(raw);
  if (/^[0-9]{10}$/.test(n)) return `${n.slice(0, 3)}-${n.slice(3, 4)}-${n.slice(4, 9)}-${n.slice(9)}`;
  return n || '-';
}

export function bankLabel(value: string | null | undefined): string {
  if (!value) return '-';
  return BANKS[value]?.label ?? value;
}
```

`lib/finance/dates.ts`: append

```ts
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

/** 'YYYY-MM-DD' → 'dd/mm/yyyy' (Christian year, no timezone shift). Anything else → ''. */
export function formatDateFull(iso: string | null | undefined): string {
  if (!iso || !ISO_DAY.test(iso)) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

/** 'YYYY-MM-DD' → local-midnight Date (for the calendar widget). */
export function isoToLocalDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function localDateToIso(date: Date): string {
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${mm}-${dd}`;
}

/** ISO datetime or date-only string → Bangkok 'YYYY-MM-DD' ('' when missing/invalid). */
export function toBkkDate(value: string | null | undefined): string {
  if (!value) return '';
  if (ISO_DAY.test(value)) return value;
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return '';
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' }).format(dt);
}
```

`app/finance/components/DateField.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { Calendar as CalendarIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { formatDateFull, isoToLocalDate, localDateToIso } from '@/lib/finance/dates';

/** Date input that always shows dd/mm/yyyy; value/onChange/min are 'YYYY-MM-DD' strings. */
export function DateField({ value, onChange, disabled, min, placeholder = 'dd/mm/yyyy' }: {
  value: string; onChange: (iso: string) => void; disabled?: boolean; min?: string; placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = value ? isoToLocalDate(value) : undefined;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" disabled={disabled}
          className={`h-11 w-full justify-start rounded-xl border-gray-200 bg-white text-left font-normal ${value ? '' : 'text-gray-400'}`}>
          <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
          {value ? formatDateFull(value) : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selected}
          defaultMonth={selected}
          onSelect={date => { if (date) { onChange(localDateToIso(date)); setOpen(false); } }}
          disabled={min ? { before: isoToLocalDate(min) } : undefined}
        />
      </PopoverContent>
    </Popover>
  );
}
```

`app/finance/types.ts`:
- add

```ts
export interface RequestInfo {
  purpose: string | null;
  amount: number | null;
  use_date: string | null;
  cost_center?: string | null;
  bank?: string | null;
  bank_label?: string | null;
  account_no?: string | null;
  account_name?: string | null;
}

export interface ApprovalTierInfo { clause: string; approver_label: string; required_level: number }

export interface PendingApprovalItem {
  form_id: string;
  submission_id: number;
  created_at: string | null;
  requester: Requester;
  request: RequestInfo;
  tier: ApprovalTierInfo;
  tab: 'mine' | 'delegable';
}
```

- `AdvanceItem.request` becomes `request: RequestInfo;`
- `AdvanceDetail` gets `approval?: ApprovalTierInfo | null;`

`app/finance/labels.ts`: `clear_date: 'วันที่ส่งเอกสารเคลียร์'` and add
`export const CLEAR_ATTACHMENT_REQUIRED = 'กรุณาแนบใบเสร็จ / สลิปคืนเงินอย่างน้อย 1 ไฟล์';`

`lib/finance/export.ts`:
- `EXPORT_COLUMNS`: `'วันที่เคลียร์'` → `'วันที่ส่งเอกสารเคลียร์'`; remove `'รหัสบัญชี'`; append `'ศูนย์ค่าใช้จ่าย', 'ธนาคาร', 'เลขที่บัญชี', 'ชื่อบัญชี'` after `'หมายเหตุ'`.
- rows: `'วันที่ส่งเอกสารเคลียร์': d(it.fin?.clear_date),` (replacing the old key), remove `'รหัสบัญชี'`, add

```ts
    'ศูนย์ค่าใช้จ่าย': it.request.cost_center ?? '',
    'ธนาคาร': it.request.bank ? bankLabel(it.request.bank) : '',
    'เลขที่บัญชี': it.request.account_no ? formatAccountNo(it.request.account_no) : '',
    'ชื่อบัญชี': it.request.account_name ?? '',
```

  with `import { bankLabel, formatAccountNo } from './bank';`

`lib/s3.ts`:

```ts
import { ListObjectsV2Command, S3Client } from '@aws-sdk/client-s3';

export const s3 = new S3Client({
  region: process.env.region,
  endpoint: process.env.endpoint,
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.accessKeyId!,
    secretAccessKey: process.env.secretAccessKey!,
  },
});

export const BUCKET_NAME = 'mn-bucket';
export const BASE_PATH = 'menait-service';
export const FORM_ID_PATTERN = /^[A-Za-z0-9_-]+-\d{4}-\d{4,}$/;

/** True when at least one object exists under `prefix`. */
export async function hasFiles(prefix: string): Promise<boolean> {
  const res = await s3.send(new ListObjectsV2Command({ Bucket: BUCKET_NAME, Prefix: prefix, MaxKeys: 1 }));
  return (res.KeyCount ?? res.Contents?.length ?? 0) > 0;
}
```

`app/api/uploads3/route.ts`: delete its local `s3` / `BUCKET_NAME` / `BASE_PATH` / `FORM_ID_PATTERN` definitions and `S3Client` import; import them from `@/lib/s3` (keep `PutObjectCommand, ListObjectsV2Command, GetObjectCommand` imports). No behaviour change.

`app/api/finance/advances/[form_id]/route.ts` `PUT`: after the guard line, before `return proxy(...)`, add:

```ts
  if (action === 'clear') {
    if (!FORM_ID_PATTERN.test(form_id)) return NextResponse.json({ error: 'หมายเลขเอกสารไม่ถูกต้อง' }, { status: 400 });
    try {
      if (!(await hasFiles(`${BASE_PATH}/${form_id}/clear/`))) {
        return NextResponse.json({ error: CLEAR_ATTACHMENT_REQUIRED }, { status: 400 });
      }
    } catch (err) {
      console.error('clear attachment check error:', err);
      return NextResponse.json({ error: 'ตรวจสอบไฟล์แนบไม่สำเร็จ กรุณาลองใหม่' }, { status: 502 });
    }
  }
```

with imports `import { BASE_PATH, FORM_ID_PATTERN, hasFiles } from '@/lib/s3';` and `import { CLEAR_ATTACHMENT_REQUIRED } from '@/app/finance/labels';`.

`app/api/finance/approval-preview/route.ts`:

```ts
import { NextResponse, type NextRequest } from 'next/server';
import { beUrl, proxy, requireUser } from '@/lib/finance/server';

export async function GET(req: NextRequest) {
  const guard = await requireUser(req);
  if ('error' in guard) return guard.error;
  const amount = req.nextUrl.searchParams.get('amount');
  if (!amount) return NextResponse.json({ error: 'กรุณาระบุจำนวนเงิน' }, { status: 400 });
  return proxy(beUrl('/finance/approval-preview', { employee_id: guard.user.employee_id, amount }));
}
```

`app/api/finance/approvals/route.ts`:

```ts
import type { NextRequest } from 'next/server';
import { beUrl, proxy, requireUser } from '@/lib/finance/server';

export async function GET(req: NextRequest) {
  const guard = await requireUser(req);
  if ('error' in guard) return guard.error;
  return proxy(beUrl('/finance/approvals/pending', { employee_id: guard.user.employee_id }));
}
```

- [ ] **Step 4: Verify**: `bun test lib/finance` → PASS; `bunx tsc --noEmit` → no new errors in touched files. Any consumer of `AdvanceItem['request']` still compiles because the new fields are optional.

- [ ] **Step 5: Commit**

```bash
git add lib/finance/bank.ts lib/finance/bank.test.ts lib/finance/dates.ts lib/finance/dates.test.ts lib/finance/export.ts lib/finance/export.test.ts lib/s3.ts app/finance/components/DateField.tsx app/finance/types.ts app/finance/labels.ts app/api/uploads3/route.ts "app/api/finance/advances/[form_id]/route.ts" app/api/finance/approval-preview/route.ts app/api/finance/approvals/route.ts
git commit -m "feat(finance): bank/date helpers, DateField, v2 types+export, S3 helper, approvals proxies, clear needs a slip

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: New-request page: payee section, account check, approval hint

**Files:**
- Modify: `app/finance/advance/new/page.tsx`

**Interfaces:**
- Consumes: `accountNoError`, `normalizeAccountNo` (bank.ts), `GET /api/finance/approval-preview?amount=` → `{clause, approver_label, required_level}` or `{error}`.

- [ ] **Step 1: Implement** (UI page, no unit test; verified by build + manual smoke in Task 10):
  - Imports: `import { accountNoError, normalizeAccountNo } from '@/lib/finance/bank';`
  - State: `const [hint, setHint] = useState<{ text: string; error: boolean } | null>(null);`
  - Find the amount question: `const amountQuestion = useMemo(() => form?.questions.find(q => q.name === 'adv_amount') ?? form?.questions.find(q => q.type === 'number'), [form]);`
  - Debounced preview, 400 ms after the amount changes:

```tsx
  const amountValue = amountQuestion ? values[amountQuestion.name] : undefined;
  useEffect(() => {
    const amount = parseAmount(amountValue);
    if (amount === null || amount <= 0) { setHint(null); return; }
    const timer = setTimeout(() => {
      fetchJson<{ clause: string; approver_label: string; required_level: number }>(
        `/api/finance/approval-preview?amount=${encodeURIComponent(String(amount))}`)
        .then(r => setHint({ text: `ต้องอนุมัติโดย: ${r.approver_label} ขึ้นไป (ระดับ ${r.required_level}+) — ข้อ ${r.clause}`, error: false }))
        .catch(err => setHint({ text: err.message, error: true }));
    }, 400);
    return () => clearTimeout(timer);
  }, [amountValue]);
```

  - Validation in `submit` (after the existing per-question loop, before `if (Object.keys(next).length)`):

```tsx
    const bankQ = form.questions.find(q => q.name === 'adv_bank');
    const accountQ = form.questions.find(q => q.name === 'adv_account_no');
    if (accountQ && !next[accountQ.name] && !isBlank(values[accountQ.name])) {
      const msg = accountNoError(bankQ ? values[bankQ.name] : null, values[accountQ.name]);
      if (msg) next[accountQ.name] = msg;
    }
```

  - Normalize before building the payload (in the `normalized` loop): `if (q.name === 'adv_account_no' && !isBlank(normalized[q.name])) normalized[q.name] = normalizeAccountNo(normalized[q.name]);`
  - Rendering: in the `form.questions.map(...)`, render a heading **before** the `adv_bank` question, and the hint **after** the amount question:

```tsx
            {form.questions.map((q, index) =>
              <div key={q.id}>
                {q.name === 'adv_bank' && (
                  <p className="mb-2 border-t border-gray-100 pt-4 text-sm font-semibold text-[#055058]">บัญชีรับเงิน</p>
                )}
                {renderFormField({ /* unchanged props */ })}
                {amountQuestion && q.id === amountQuestion.id && hint && (
                  <p className={`mt-1 text-xs ${hint.error ? 'text-rose-600' : 'text-[#026a75]'}`}>{hint.text}</p>
                )}
              </div>
            )}
```

- [ ] **Step 2: Verify**: `bunx tsc --noEmit` (no new errors) and `bun run build` (succeeds).
- [ ] **Step 3: Commit**

```bash
git add app/finance/advance/new/page.tsx
git commit -m "feat(finance): new advance — payee section, account-number check, approval-tier hint

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Finance side: pay form, detail, summary, list, navbar, review date

**Files:**
- Modify: `app/finance/components/PayForm.tsx`, `app/finance/components/FinanceAdvanceDetail.tsx`,
  `app/finance/components/AdvanceSummary.tsx`, `app/finance/components/AdvanceListView.tsx`,
  `app/finance/components/ReviewPanel.tsx`, `components/navbar.tsx`

**Interfaces:**
- Consumes: `DateField`, `formatDateFull`/`toBkkDate` (dates.ts), `bankLabel`/`formatAccountNo` (bank.ts), `todayBkk`/`addDays`/`CLEAR_DUE_DAYS` (status.ts), types `ApprovalTierInfo`.

- [ ] **Step 1: PayForm.**
  - Drop the `accounts` prop and the `FinAccount` import; the signature becomes `PayForm({ detail, onSaved })`. Remove `accCode` state, its alert, the `<select>` block and `activeAccounts`. Do not send `acc_code`.
  - Defaults:

```tsx
  const initialTransfer = fin?.transfer_date ?? toBkkDate(detail.request.use_date);
  const [voucherDate, setVoucherDate] = useState(fin?.voucher_date ?? todayBkk());
  const [transferDate, setTransferDate] = useState(initialTransfer);
  const [dueDate, setDueDate] = useState(fin?.clear_due_date ?? (initialTransfer ? addDays(initialTransfer, CLEAR_DUE_DAYS) : ''));
```

  - Validation: add `if (!voucherDate) return showAlert({ icon: 'warning', title: 'กรุณาระบุวันที่ตั้งเบิก' });` and send `voucher_date: voucherDate`.
  - Replace the three `<Input type="date">` with `DateField`s. The labels become `วันที่ตั้งเบิก *`, `วันที่โอนเงิน *`, `กำหนดการเคลียร์ (ค่าเริ่มต้น +7 วัน)`. The due-date field gets `min={transferDate || undefined}` and `onChange={v => { setDueTouched(true); setDueDate(v); }}`. The transfer field uses `onChange={onTransferDate}`.
  - Payee box at the top of the form grid (`sm:col-span-2`), shown when `detail.request.account_no`:

```tsx
        {detail.request.account_no && (
          <div className="sm:col-span-2 rounded-xl border border-[#8ce4cb] bg-[#8ce4cb]/10 p-3 text-sm">
            <p className="mb-1 font-semibold text-[#055058]">โอนเข้าบัญชี</p>
            <p>{bankLabel(detail.request.bank)} · <span className="font-mono">{formatAccountNo(detail.request.account_no)}</span>
              <button type="button" className="ml-2 text-xs text-[#026a75] underline"
                onClick={() => navigator.clipboard?.writeText(detail.request.account_no ?? '')
                  .then(() => showAlert({ icon: 'success', title: 'คัดลอกเลขที่บัญชีแล้ว', timer: 1200, showConfirmButton: false }))}>
                คัดลอก
              </button>
            </p>
            <p className="text-gray-600">ชื่อบัญชี: {detail.request.account_name ?? '-'}</p>
            {detail.request.cost_center && <p className="text-gray-600">ศูนย์ค่าใช้จ่าย: {detail.request.cost_center}</p>}
          </div>
        )}
```

- [ ] **Step 2: FinanceAdvanceDetail**: remove the `accounts` state, the `/api/finance/accounts` fetch and the `FinAccount` import; render `<PayForm key=… detail={detail} onSaved={onSaved} />`.

- [ ] **Step 3: AdvanceSummary** (prop type becomes `item: AdvanceItem & { approval?: ApprovalTierInfo | null }`):
  - Request panel, after `วันที่ขอ`, add:

```tsx
          <Field label="ค่าใช้จ่ายรายศูนย์" value={item.request.cost_center ?? '-'} />
          <Field label="ธนาคาร" value={item.request.bank ? bankLabel(item.request.bank) : '-'} />
          <Field label="เลขที่บัญชี" value={item.request.account_no ? formatAccountNo(item.request.account_no) : '-'} />
          <Field label="ชื่อบัญชี" value={item.request.account_name ?? '-'} />
          {item.approval && (
            <div className="col-span-2 sm:col-span-3">
              <Field label="ขั้นอนุมัติ" value={`ข้อ ${item.approval.clause} · ${item.approval.approver_label} (ระดับ ${item.approval.required_level}+)`} />
            </div>
          )}
```

  - Pay panel: render the `บัญชี` field only when `fin.acc_code` (`{fin.acc_code && <Field label="บัญชี" ... />}`).
  - Clear panel: label `วันที่เคลียร์` → `วันที่ส่งเอกสารเคลียร์`.

- [ ] **Step 4: AdvanceListView** (finance mode):
  - Rename `accFilter`/`setAccFilter` → `ccFilter`/`setCcFilter` everywhere (state, reset-page effect deps, `clearFilters`, `hasActiveFilters`).
  - Replace `accOptions` with:

```tsx
  const ccOptions = useMemo(() => {
    const seen = new Set<string>();
    tabItems.forEach(i => { if (i.request.cost_center) seen.add(i.request.cost_center); });
    return Array.from(seen).sort();
  }, [tabItems]);
```

  - Filter: `if (mode === 'finance' && ccFilter !== 'all') result = result.filter(i => i.request.cost_center === ccFilter);`
  - The filter `<select>`: first option `ศูนย์ค่าใช้จ่ายทั้งหมด`, then `ccOptions.map(c => <option key={c} value={c}>{c}</option>)`.
  - Finance desktop table: add `<th className={TH}>ศูนย์ค่าใช้จ่าย</th>` right after the `ศูนย์` header and the matching `<td>` with `{it.request.cost_center ?? '-'}` (use the row variable name the file already uses). Mobile card (finance mode): add a `ศูนย์ค่าใช้จ่าย: …` line next to the department line.

- [ ] **Step 5: ReviewPanel**: replace the `<Input type="date" value={extraDate} …>` with `<DateField value={extraDate} onChange={setExtraDate} disabled={saving} />` (import DateField; drop the `Input` import if unused).

- [ ] **Step 6: navbar**: delete the `{ title: 'รหัสบัญชี', href: '/finance/accounts', … }` entry from `COMPONENT_FINANCE` and the `BookText` import if it becomes unused.

- [ ] **Step 7: Verify**: `bun test lib/finance`, `bunx tsc --noEmit`, `bun run build`. All green.
- [ ] **Step 8: Commit**

```bash
git add app/finance/components/PayForm.tsx app/finance/components/FinanceAdvanceDetail.tsx app/finance/components/AdvanceSummary.tsx app/finance/components/AdvanceListView.tsx app/finance/components/ReviewPanel.tsx components/navbar.tsx
git commit -m "feat(finance): pay form without petty-cash code, date defaults, payee box; cost-center column/filter; dd/mm/yyyy

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Clearing form: rename, mandatory slip, upload first

**Files:**
- Modify: `app/finance/components/ClearForm.tsx`

**Interfaces:**
- Consumes: `DateField`, `CLEAR_ATTACHMENT_REQUIRED` (labels.ts), `fetchJson`/`uploadFiles`/`putAction` (api.ts), `AttachmentFile` type, `GET /api/uploads3?form_id=` (the same call `AttachmentPanel` makes; each file has `folder`).

- [ ] **Step 1: Implement**
  - Existing clear files count:

```tsx
  const [existingClear, setExistingClear] = useState(0);
  useEffect(() => {
    fetchJson<{ files?: AttachmentFile[] } | AttachmentFile[]>(`/api/uploads3?form_id=${encodeURIComponent(detail.form_id)}`)
      .then(data => {
        const list = Array.isArray(data) ? data : data.files ?? [];
        setExistingClear(list.filter(f => f.folder === 'clear').length);
      })
      .catch(() => setExistingClear(0));
  }, [detail.form_id]);
```

    (Check `AttachmentPanel.tsx` for the exact response shape of `/api/uploads3` GET and use the same parsing.)
  - Label and alert text: `วันที่เคลียร์ *` → `วันที่ส่งเอกสารเคลียร์ *`; `'กรุณาระบุวันที่เคลียร์'` → `'กรุณาระบุวันที่ส่งเอกสารเคลียร์'`.
  - `<p className="mb-1 text-sm">แนบใบเสร็จ / สลิปคืนเงิน *</p>`; if `existingClear > 0` show `<p className="text-xs text-gray-500">มีไฟล์แนบแล้ว {existingClear} ไฟล์ (แนบเพิ่มได้)</p>`.
  - Validation (after the settle-date check): `if (files.length === 0 && existingClear === 0) return showAlert({ icon: 'warning', title: CLEAR_ATTACHMENT_REQUIRED });`
  - **Upload first**, then save:

```tsx
    setSaving(true);
    try {
      const failed = await uploadFiles(detail.form_id, files, 'clear');
      if (failed.length) {
        await showAlert({ icon: 'error', title: 'อัปโหลดไฟล์ไม่สำเร็จ ยังไม่ได้ส่งเคลียร์', text: failed.join(', ') });
        return;
      }
      const saved = await putAction(detail.form_id, 'clear', { /* same body as before */ });
      setFiles([]);
      await showAlert({ icon: 'success', title: 'ส่งเคลียร์เงินแล้ว รอการเงินตรวจ' });
      onSaved(saved);
    } catch (err) {
      showAlert({ icon: 'error', title: 'บันทึกไม่สำเร็จ', text: (err as Error).message });
    } finally {
      setSaving(false);
    }
```

  - Replace both `<Input type="date">` (clear date, settle date) with `DateField` (`value`, `onChange={setClearDate}` / `setSettleDate`, `disabled={saving}`).
- [ ] **Step 2: Verify**: `bunx tsc --noEmit`, `bun run build`.
- [ ] **Step 3: Commit**

```bash
git add app/finance/components/ClearForm.tsx
git commit -m "feat(finance): clearing — 'วันที่ส่งเอกสารเคลียร์', slip required, upload before save, dd/mm/yyyy

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Approvals page: pending from the new queue, two tabs

**Files:**
- Modify: `app/finance/approvals/page.tsx`

**Interfaces:**
- Consumes: `GET /api/finance/approvals` → `PendingApprovalItem[]`; approve/reject stay `POST /api/tickets` (unchanged body); history view unchanged (`/api/tickets … &view=history` + `/api/formselect` enrichment).

- [ ] **Step 1: Implement**
  - New state: `const [pending, setPending] = useState<PendingApprovalItem[]>([]);` and `const [pendingTab, setPendingTab] = useState<'mine' | 'delegable'>('mine');`
  - In `load()`: when `apvView === 'pending'`, do `setPending(await fetchJson<PendingApprovalItem[]>('/api/finance/approvals'))` and skip the tickets/formselect path; the history branch keeps today's code unchanged.
  - Pending view header: two pills inside the panel body, above the list:

```tsx
  const mine = pending.filter(p => p.tab === 'mine');
  const delegable = pending.filter(p => p.tab === 'delegable');
  // pills: `รอฉันอนุมัติ (${mine.length})` / `อนุมัติแทนได้ (${delegable.length})`, same pill classes as the view toggle
```

  - New `PendingCard({ item, processing, onApprove, onReject })` (keep `ApprovalCard` for history). It shows form_id, requester name · department, the `รออนุมัติ` badge, `Field`s for จำนวนเงินที่ขอ (`formatBaht(item.request.amount)`), วันที่ใช้เงิน (`formatDate(item.request.use_date)`), วันที่ยื่นคำขอ, ค่าใช้จ่ายรายศูนย์ (`item.request.cost_center ?? '-'`), ขั้นอนุมัติ (`ข้อ ${item.tier.clause} · ${item.tier.approver_label}`), the purpose (full width), `<AttachmentPanel formId={item.form_id} folder="request" />`, and the same ไม่อนุมัติ/อนุมัติ buttons. In the `delegable` tab, show a small note above the buttons: `<p className="text-xs text-gray-500">อนุมัติแทนได้ — มีผู้มีสิทธิ์ระดับ {item.tier.required_level}+ ที่ใกล้กว่า</p>`.
  - `submitAction`/`handleApprove`/`handleReject` accept `{ form_id: string }` (widen the parameter type) so both cards can use them.
  - Empty states: `ไม่มีรายการรอคุณอนุมัติ` / `ไม่มีรายการที่อนุมัติแทนได้`.
- [ ] **Step 2: Verify**: `bunx tsc --noEmit`, `bun run build`.
- [ ] **Step 3: Commit**

```bash
git add app/finance/approvals/page.tsx
git commit -m "feat(finance): approvals — ADV queue from /finance/approvals with 'รอฉันอนุมัติ' / 'อนุมัติแทนได้' tabs

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Task 10 (controller only, not a subagent): migration, smoke, review

- [ ] Copy `scripts/migrations/2026-09-29_finance_advance_v2.sql` to `~/Desktop/finance_advance_v2_ncacdb.sql`, appending read-only verify SELECTs after `COMMIT` (tier count = 7; ADV rules active = 0; the 4 new questions; option counts 6/16). **The user runs it in DBeaver.**
- [ ] Scripted parity check: the BE `BANKS` (python import) equals the FE `BANKS` (bun eval): same keys, labels and digit tuples.
- [ ] Restart the local BE on :8001 with the scheduler stub (see project memory). Smoke with curl:
  - `GET /finance/approval-tiers` → 7 rows.
  - `GET /finance/approval-preview?employee_id=670108&amount=1500` → clause 6.7, required_level 6 (670108 is L5).
  - `amount=150000` → 6.3 / 9; `amount=0` → 400.
  - `GET /finance/approvals/pending?employee_id=<a L6+ in dept 11 or 670488>` → includes ADV-2026-0001/0002 with a `tab`.
  - `GET /forms/pending-approvals?employee_id=670488` → no ADV rows.
  - `PUT /finance/advances/ADV-2026-9001/pay` without `acc_code` and without `voucher_date` → 422; with `voucher_date` → 200 (then revert with the mock-data reset if needed).
  - The FE Next route: `PUT /api/finance/advances/<id>` `{action:'clear'}` with no `clear/` files → 400 message (with the session cookie, from the browser).
- [ ] Final whole-branch review (opus) for BE `3ede73a..HEAD` + FE `184a62c..HEAD`. Fix wave if needed.
- [ ] Report to the user: one table row per requirement (status + evidence).
