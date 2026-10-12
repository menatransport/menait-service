# SDD ledger — plan: docs/superpowers/plans/2026-10-12-finance-petty-cash.md

Spec read: docs/superpowers/specs/2026-10-12-finance-petty-cash-spec.md + ...-weigh-design.md
Executor: inline (superpowers:executing-plans), FE repo menait-service + BE repo api-ncac

Setup: Ruling: งานนี้แตะสองรีโป จึงเปิด branch คนละตัว — BE `feat/petty-cash` ตัดจาก `origin/main` (3946c2e), FE `feat/finance-petty-cash` ตัดจาก `menaIT-v2` (3e62f42) — เหตุ: แผนบอกให้ integrate เข้า main/menaIT-v2 แต่ห้ามลงมือบน main ตรง ๆ — cost ถ้าผิด: ต้อง merge/rebase ทีหลัง
Setup: Ruling: BE local `main` ล้า 7 คอมมิตและมี 4 คอมมิตงาน fuel ที่ยังไม่ push จึงตัด branch จาก `origin/main` ไม่ใช่ local main (ไม่แตะ local main เลย) — cost ถ้าผิด: งาน fuel ที่ยังไม่ push ไม่อยู่ใต้ branch นี้ ซึ่งเป็นสิ่งที่ต้องการ
Setup: Ruling: `git reset --hard` ถูก classifier บล็อก จึงเปลี่ยนชื่อ BE branch เป็น `feat/petty-cash` แล้วตัดจาก origin/main ตรง ๆ แทน (branch `feat/finance-petty-cash` ที่ชี้ local main ถูกทิ้งไว้ ไม่มีคอมมิตของตัวเอง) — cost ถ้าผิด: มี branch ร้างหนึ่งอันใน BE

## Pre-flight: shared interfaces
| ผลิตที่ | ใช้ที่ | ตรวจอะไร | ผล |
|---|---|---|---|
| T1 models | T3,T5,T6,T7,T10 | ชื่อ attribute ตรงกับคอลัมน์ migration | ตรง — T1 มีเทสต์เทียบชุดคอลัมน์ทั้งก้อน |
| T2 petty_logic | T5,T6,T7,T10 | claim_total/period_of/assert_transition/hard_dup_key/batch_no | ตรง ทุกตัวถูกเรียกตามลายเซ็นใน Produces |
| T2 normalize_plate | T10 split_duplicates | ใช้ตัวเดียวกันทั้งสองด่าน | ตรง |
| T3 schema ApproveIn/SubmitAccIn | T10 _gate(payload.attachments) | ต้องมีช่อง attachments ตั้งแต่ T3 | แก้แล้วตอน self-review ของแผน (ย้ายจาก T10 มา T3) |
| T3 petty_repo master | T5,T7,T10 | get_fund/get_expense_type/list_funds | ตรง |
| T5 create_claim/replace_items | T6 update_draft | replace_items อัปเดต amount+period | ตรง — T6 เทสต์ยอด 200 หลังแก้เหลือ 2 แถว |
| T5 generate_form_id (PC-*) | T2 format_form_id | รูปแบบเลขต้องเหมือนกันสองที่ | ตรง — T2 เทสต์ regex FORM_ID_PATTERN ด้วย |
| T6 set_status | T7 close_batch | close_batch เรียก set_status ต่อใบ | ตรง |
| T7 advance_outstanding | models.master_model.FormSubmission | ผูกเจ้าของยอดผ่าน created_by | ยืนยันแล้ว FormSubmission อยู่ master_model.py:122 มี form_id+created_by |
| T4 petty-status.ts ALLOWED | T2 ALLOWED (py) | ตารางเปลี่ยนสถานะสองฝั่งต้องตรง | ตรง ทั้งสองมีเทสต์คู่ |
| T4 petty-access canSeeClaim | T15 canReview/canCloseBatch | T15 เปลี่ยนจาก is_finance เป็น is_accounting/is_treasury | แผนสั่งให้แก้เทสต์ T4 พร้อมกันใน T15 |
| T8 petty-spec claimPayload | T5 ClaimIn | ไม่ส่ง amount/created_by | ตรง BFF เติม created_by จาก session |
| T11 spec 4 ประเภท | T10 validate_claim | ด่านเดียวต้องกินได้ทุก spec | T11 มีเทสต์ยิงทั้ง 4 ผ่านด่านเดียวกัน |
| T12 groupForPrint | T14 coverRows | คนละชุด ไม่แชร์ | ไม่มีข้อขัด |
| T13 fetch_dd | T6 submit_to_accounting (snapshot) | ล้มเหลวต้องไม่ทำให้ส่งบัญชีล้ม | แผนสั่งครอบ try/except |

Task 1: complete (commits 3946c2e..a30d998, tests: pytest tests/finance/test_petty_model.py -> 5/5 pass)
Task 2: complete (commits a30d998..f2887f5, tests: pytest tests/finance/test_petty_logic.py -> 28/28 pass)
Task 3: Ruling: tests/finance มีของพังอยู่ก่อน 3 รายการ (test_approval_repo.py + test_approval_steps.py collect ไม่ได้ "No module named tests.finance" และ test_payee_email_and_guard::test_routes_registered ล้มเพราะ boto3 ไม่ได้ติดตั้งในเครื่องนี้ พังที่ main.py:104 ก่อนบรรทัดที่เพิ่ม) — ยืนยันด้วยการ git stash งานตัวเองแล้วยังพังเหมือนเดิม — จึงไม่แก้ของเดิมในงานนี้ และยืนยัน router ของ petty ด้วยการ import routes.finance.petty_routes ตรง ๆ (ขึ้นครบ 5 เส้น) — cost ถ้าผิด: ถ้าจริง ๆ เป็นของใหม่ จะรู้ตอน CI/prod ที่มี boto3
Task 3: complete (commits f2887f5..606d492, tests: pytest tests/finance -q (ignore 2 ไฟล์ที่พังก่อนแล้ว) -> 635 passed, 1 failed ซึ่งเป็นของเดิม; test_petty_master -> 10/10 pass)
Task 4: complete (commits 3e62f42..64ae79a, tests: bun test lib/finance/ -> 229/229 pass; tsc --noEmit -> clean)
Task 5: Ruling: เทสต์ repo ต้องมี session จริง แต่ create_all ทั้ง metadata บน sqlite พังเพราะตารางเก่าใช้ JSONB ตรง ๆ — จึงเปลี่ยนคอลัมน์ json ของ petty เป็น JSON().with_variant(JSONB,'postgresql') (Postgres ยังได้ jsonb ตรงกับ migration) และ conftest สร้างเฉพาะ 9 ตารางที่ใช้ — cost ถ้าผิด: ถ้าโค้ดไหนพึ่งตัวดำเนินการเฉพาะ jsonb จะต้องแก้ตอนนั้น (ปัจจุบันไม่มี)
Task 5: Ruling: generate_form_id ตัวจริงใช้ pg_insert + SELECT FOR UPDATE ซึ่ง sqlite ไม่รองรับ จึงทดสอบด้วย fixture seq_stub ที่แทน _locked_sequence (นับในหน่วยความจำ) — ทดสอบรูปแบบเลขและการที่ repo เรียกใช้จริง ส่วนการกันเลขชนยังเป็นกลไกของ Postgres ที่โค้ดเดิมของ ADV คุมอยู่ ไม่ได้แก้ — cost ถ้าผิด: Review Focus ข้อ 2 (เลขชนตอนเปิดพร้อมกัน) ไม่ได้ทดสอบจริงในเครื่องนี้ ต้องยืนยันบน Postgres สำเนา
Task 5: complete (commits 606d492..cfd9bf1, tests: pytest tests/finance -q (ignore 2 ไฟล์เดิม) -> 659 passed, 1 failed(ของเดิม boto3); test_petty_claims 18/18, test_petty_form_id 6/6)
Task 6: Ruling: แผนให้เทสต์ import fixture ข้ามไฟล์ (from tests.finance.test_petty_claims import ...) ซึ่งพังเพราะ tests/ ไม่ใช่ package (เหตุเดียวกับไฟล์เก่า 2 ไฟล์ที่ collect ไม่ได้) จึงย้าย fixture ร่วมไป tests/finance/conftest.py (fund, weigh_items, claim_payload) แทนการเพิ่ม tests/__init__.py ซึ่งจะเปลี่ยนวิธี collect ของทั้ง suite — cost ถ้าผิด: ไฟล์เก่า 2 ไฟล์ยังพังอยู่เหมือนเดิม (ไม่ได้แย่ลง)
Task 6: Ruling: เพิ่มการ์ด 409 ใน review PASS ด้วย (แผนไม่ได้สั่ง) เพราะ PASS เป็นเส้นทางเดียวที่ไม่ผ่าน set_status จึงไม่มีใครเช็กสถานะให้ — ไม่งั้นบัญชีกด "ผ่าน" ใบที่ปิดไปแล้วได้ — cost ถ้าผิด: ไม่มี เป็นการปิดรูที่เหลืออยู่
Task 6: complete (commits cfd9bf1..4a1e943, tests: pytest tests/finance -q -> 669 passed, 1 failed(ของเดิม); test_petty_transitions 10/10)
Task 7: complete (commits 4a1e943..93dc5cc, tests: pytest tests/finance -q -> 685 passed, 1 failed(ของเดิม); test_petty_balance 16/16 รวม test_never_writes_to_fin_advances)
Task 8: Ruling: /api/uploads3 การ์ดเฉพาะใบ ADV — เลข petty ผ่าน FORM_ID_PATTERN แล้วใครที่ล็อกอินก็อัปโหลด/ลิสต์ไฟล์ของใบคนอื่นได้ จึงเพิ่ม lib/finance/petty-upload.ts (whitelist หมวดไฟล์ + canUploadPettyFile) และการ์ดทั้ง POST และ GET ด้วย canSeeClaim — แผนไม่ได้สั่งแต่เป็นรูจริง — cost ถ้าผิด: หมวดไฟล์ใหม่ใน master ต้องมาเพิ่มใน PETTY_FOLDERS ด้วย ไม่งั้นอัปโหลดไม่ได้
Task 8: Ruling: uploadFiles เดิมจำกัด folder เป็น 4 ค่าของ ADV จึงเขียน uploadPettyFiles/countAttachments แยกใน app/finance/petty-api.ts ไม่ไปแก้ helper ของ Advance — cost ถ้าผิด: มีโค้ดอัปโหลดสองที่ที่คล้ายกัน
Task 8: complete (commits 64ae79a..1a7fcb5, tests: bun test lib/finance/ -> 256/256 pass; tsc --noEmit -> clean)
Task 9: Ruling: proxy() ยุบ detail ที่เป็น object เป็นสตริง 'ข้อมูลไม่ถูกต้อง' และ fetchJson ทิ้ง body ทิ้ง — ด่านเอกสารจึงบอกไม่ได้ว่าขาดอะไร ซึ่งเป็นทั้งหมดที่ด่านมีไว้ทำ จึงเพิ่ม lib/finance/api-error.ts (errorBodyFrom + ApiError, 8 เทสต์) แล้วต่อเข้า proxy และ fetchJson — กระทบ Advance ด้วยแต่เป็นการเพิ่มข้อมูล ไม่ลด (เทสต์เดิม 264 ตัวยังผ่าน) — cost ถ้าผิด: ถ้าหน้าไหนพึ่งข้อความ 'ข้อมูลไม่ถูกต้อง' แบบเป๊ะ ๆ จะเห็นข้อความจริงจาก BE แทน
Task 9: Ruling: BE ไม่ได้ส่ง reviewed_at ออกมา การเงินจึงแยกไม่ออกว่าใบไหนบัญชีผ่านแล้ว เพิ่ม reviewed_by/reviewed_at/submitted_to_acc_at ใน _claim_dict และ type ฝั่ง FE — cost ถ้าผิด: ไม่มี
Task 9: complete (FE commits 1a7fcb5..05e3623, BE 93dc5cc..05a6699, tests: bun 264/264 + tsc clean; pytest tests/finance -> 685 passed, 1 failed(ของเดิม))
Task 10: Ruling: fixture weigh_items เดิมใส่เลขบัตรชั่งซ้ำ 12 แถว (เพราะคูณ dict เดียว) ซึ่งไม่สมจริงและทำให้ด่านเข้มบล็อกถูกต้องแต่เทสต์ดูเหมือนพัง จึงเขียน fixture ใหม่ให้เหมือนใบจริง: 16 แถว เลขบัตรไม่ซ้ำ รถ 1093 สองแถวคนละบัตร = 1,640.00 — ผลคือใบจริงต้องมี dup_override_reason ตอนอนุมัติ ซึ่งเป็นพฤติกรรมที่ออกแบบไว้ และมีเทสต์ยืนยัน 2 ข้อ — cost ถ้าผิด: ไม่มี เทสต์ใกล้ของจริงขึ้น
Task 10: Ruling: /claims/duplicate-check ถูก /claims/{form_id} จับไปก่อน (FastAPI จับตามลำดับประกาศ) จึงย้ายขึ้นก่อน และเพิ่มเทสต์เทียบลำดับ path กันพลาดซ้ำ — cost ถ้าผิด: ไม่มี
Task 10: Ruling: ส่งอีเมลก่อนโยน 403/409/422 ผ่าน callable notify (BackgroundTasks เมื่อมี) และเพิ่ม repo.employee_email + users ใน fixture — ปิดด้วย FINANCE_EMAIL_ENABLED เดิม — cost ถ้าผิด: ถ้าเปิดอีเมลแล้วด่านทำงานถี่ จะมีเมลเยอะ (ค่อยปรับเป็นสรุปรายวันได้)
Task 10: complete (BE commits 3137a42..786317f, FE ..a6889c9, tests: pytest tests/finance -> 738 passed, 1 failed(ของเดิม); bun 264/264; tsc clean)
Task 11: Ruling: บังคับเลือกรถจาก master (TruckPicker) พิมพ์เองไม่ได้ ตามที่ผู้ใช้ตอบข้อ 1 — AddManyTrucksDialog ไปหาทะเบียนจาก master ให้ทุกคันก่อนสร้างแถว ถ้าคันไหนไม่มีจะบอกชื่อและไม่สร้างแถวให้ — cost ถ้าผิด: รถที่ยังไม่มีใน master (ใบจริงมี F014/F016) เปิดใบไม่ได้จนกว่าจะเพิ่ม master ซึ่งเป็นสิ่งที่ตกลงกันไว้
Task 11: Ruling: petty_master เป็น Mongo client ตัวแรกในชั้น route ของ api-ncac จึง lazy + timeout 3s + maxTimeMS 2s + limit และครอบ try/except ให้ Mongo ล่มไม่ทำให้ฟอร์มพัง (เทสต์ยืนยัน 10 ข้อ รวมข้อที่ query สั้นกว่า 2 ตัวอักษรไม่ยิง Mongo เลย) — cost ถ้าผิด: ถ้า MONGODB_URI ไม่ได้ตั้งบน Render ช่องค้นรถจะว่างเงียบ ๆ (มี log.warning)
Task 11: complete (BE commits a6889c9/..67fbfd0, FE ..bd4c602, tests: pytest tests/finance -> 761 passed, 1 failed(ของเดิม); bun 264/264; tsc clean)
Task 12: complete (commits bd4c602..e8a4fcc, tests: bun test lib/finance/ -> 292/292 pass (petty-print 14, petty-voucher 14); tsc clean) · ใบพิมพ์ใช้ wrapSegments/stampHtml/bahtText ของเดิม ตารางเติมแถวว่างให้ครบ 6 บรรทัดเหมือนกระดาษ และขึ้นแผ่น 2/2 เมื่อกลุ่มเกิน 6
Task 13: Ruling: snapshot DD เก็บตอนส่งบัญชีสำเร็จแล้ว ครอบ try/except ทั้งก้อน — DD ดึงไม่ได้ต้องไม่ทำให้การส่งบัญชีล้ม (Review Focus 5) — cost ถ้าผิด: ใบที่ส่งตอน Mongo ล่มจะไม่มี snapshot ต้องกด "ดึงใหม่" เอง
Task 13: Ruling: ยังไม่ได้ยืนยันว่า DD ของค่าแรง (LB00038 กลุ่ม "ค่าแรง") อยู่ใน stockmovement_v5 จริง และยังไม่สร้าง index {DD:1} — ทั้งสองอย่างต้องถามผู้ใช้ก่อนแตะ Mongo ตามกติกา จึงเขียนโค้ดให้ "ไม่พบ = เตือน ไม่บล็อก" ไว้ก่อน — cost ถ้าผิด: ถ้า DD ค่าแรงไม่อยู่ใน v5 ต้องเพิ่มทางสำรองดึงจาก ATMS ตรง (ออกแบบไว้แล้วใน DESIGN-WEIGH §6.3)
Task 13: complete (BE commits ..416730e, FE ..36ba087, tests: pytest tests/finance -> 774 passed, 1 failed(ของเดิม); test_petty_atms 13/13; bun 292/292; tsc clean)
Task 14: complete (commits ..f4e7a1e, tests: bun test lib/finance/ -> 316/316 (petty-cover 14, petty-export 10); tsc clean) · ใบปะหน้าแยกตาม created_by (เจ้าหน้าที่ผู้เปิดใบ) ตามที่ผู้ใช้สั่ง · Excel 17 คอลัมน์ ใช้ xlsx ตัวเดิม
Task 15: Ruling: ไม่ลบ is_finance — canReview/canCloseBatch ยอมรับ is_finance ต่อเมื่อยังไม่ได้ตั้งธงใหม่ของฝ่ายตรงข้าม (ตั้ง ACCOUNTING_* แล้วการเงินล้วนจะ review ไม่ได้ และกลับกัน) เพื่อให้ขึ้น prod ได้ก่อนตั้ง env — cost ถ้าผิด: ถ้าไม่เคยตั้ง env ใหม่เลย บัญชีกับการเงินยังทำแทนกันได้เหมือนเดิม
Task 15: Ruling: financeOnly ในเมนูเดิมเช็กแค่ is_finance จึงขยายเป็น is_finance || is_accounting || is_treasury ไม่งั้นคนที่ตั้งเป็นบัญชีล้วนจะไม่เห็นเมนูงานเงินสดย่อย — cost ถ้าผิด: เมนู "งานเบิกเงิน Advance" ของเดิมเปิดให้บัญชี/การเงินที่ตั้งธงใหม่เห็นด้วย ซึ่งถูกต้องอยู่แล้ว
Task 15: complete (commits f4e7a1e..4de4405, tests: bun test lib/finance/ -> 331/331; tsc clean; next build สำเร็จ หน้า /finance/petty/* ขึ้นครบ 6 หน้า)
Final: Ruling: คอมมิตฝั่ง BE ลบไฟล์ .pyc ที่ repo track ไว้ 597 ไฟล์ (ผลพลอยจากการล้าง __pycache__ เพื่อกู้ stash ใน Task 3) — กู้คืนทั้งชุดจาก origin/main แล้วคอมมิตแยก ตรวจแล้วว่าไม่มีไฟล์ซอร์สหลุดไปด้วย — cost ถ้าผิด: ไม่มี กลับมาเท่าเดิม
Final: fixed BFF list routes gated on is_finance only (บัญชี/การเงินที่ตั้งธงใหม่จะเห็นคิวว่าง) — canSeeAllClaims RED→GREEN 7 เทสต์, suite 338/338, next build สำเร็จ
