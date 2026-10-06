# Pagination FE report

## Tab -> server param map
Finance queue (/finance):
- รอตั้งเบิก: status=AWAITING_VOUCHER
- รอจ่าย: status=AWAITING_PAYMENT
- จ่ายแล้วรอเคลียร์: status=AWAITING_CLEARING
- เกินกำหนด: overdue=true
- ตีกลับผู้เบิก: status=RETURNED
- รอบัญชีตรวจ: status=AWAITING_REVIEW
- ส่งกลับแก้ไข: status=SENT_BACK
- ปิดแล้ว: status=CLOSED
- ทั้งหมด: no filter

Requester list (/finance/advance):
- ทั้งหมด: no filter
- รออนุมัติ: PENDING_APPROVAL
- รอจ่าย: AWAITING_VOUCHER,AWAITING_PAYMENT
- ต้องเคลียร์: AWAITING_CLEARING,SENT_BACK
- ต้องแก้ไข: RETURNED
- รอบัญชีตรวจ: AWAITING_REVIEW
- ปิดแล้ว: CLOSED,REJECTED

Tab badge = sum of summary.counts for the tab statuses (overdue tab: summary.overdue; all: sum of counts).

## Design
- lib/finance/advanceQuery.ts (+ test): query builder, tabCount, fetchAllAdvances (sequential, page_size 200).
- AdvanceListView owns the fetch: page size 20, 300 ms debounced q, reset to page 1 on tab/q/month/cost center change, request-sequence guard against stale responses, loading overlay, clamp to last page.
- Tiles: counts / overdue / outstanding_amount from summary. Reminder N = summary.overdue; ids fetched on click (overdue=true, current scope, page_size 200), then batches of 20.
- Excel: all pages for current tab+scope, busy label.
- Proxy: /api/finance/advances forwards page, page_size, status, overdue, q, date_from, date_to, cost_center; mine=1 always uses session employee_id.
- /api/tickets (history view) forwards page/page_size and scope-filters paged items. Approvals history tab: 20 per page with PaginationControls.

## Behaviour changes / concerns
- Removed client-only sort toggle (BE always created_at desc) and the department filter (no BE param).
- Cost-center dropdown options accumulate from pages seen (BE gives no distinct list).
- Search no longer matches fin.voucher_no unless BE q does (spec lists form_id, requester id/name, purpose).
- Approval history: filterByScope runs after paging, so a page may hold fewer than 20 rows if the BE mixes scopes; total is the BE total.
- Reminder confirm text now says "per current filters" (N matches summary scope); previously it ignored filters.
- Not exercised against the real BE (built in parallel).
