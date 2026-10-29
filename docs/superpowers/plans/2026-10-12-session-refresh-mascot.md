# Session refresh + แจ้งเตือนข้อมูลเปลี่ยน (น้องมีนา)

> 12 ต.ค. 2026 · ต่อจากงานโครงสร้างองค์กร ncacdb (branch `feature/org-divisions`)
> เป้าหมาย: ดึงข้อมูล user ล่าสุดจาก ncacdb ด้วย employee_id ของ session ทุกครั้งที่เปิดแอป
> ถ้าข้อมูลเปลี่ยน ให้อัปเดต session ทันที (ไม่ต้อง login ใหม่) และแสดง Dialog น้องมีนาบอกว่าเปลี่ยนอะไร

## 1. ปัญหาตอนนี้

- login แล้ว menaIT เซ็น JWT cookie `session-token` ที่เก็บ **snapshot ของ user ไว้ 90 วัน** (`lib/jwt.ts`)
- `role` (admin = dept 21 หรือรหัส 680043/670108) และ `is_finance` (dept 4,6 / `FINANCE_EMPLOYEE_IDS`) คำนวณ **ครั้งเดียวตอน login** (`app/api/login/route.ts`)
- ฝั่ง server เชื่อค่าใน token: `lib/finance/server.ts` (`requireUser`), `app/api/tickets`, `app/api/survey-it`
- ผลคือ ถ้า HR/admin ย้ายฝ่าย เปลี่ยนตำแหน่ง หรือ**ถอดสิทธิ์ finance** — user ยังเห็นค่าเดิมและ**ยังมีสิทธิ์เดิมได้ถึง 90 วัน** จนกว่าจะ logout
- ข้อมูลใหม่ (`division`, `org_department_display`, `job_level_code`) จะไม่ขึ้นจนกว่าทุกคนจะ login ใหม่

## 2. ภาพรวมการทำงาน

```
เปิดแอป / กลับมาที่แท็บ (ห่างจากครั้งก่อน ≥ 5 นาที)
  └─ SessionProvider → POST /api/session/refresh
        ├─ อ่าน cookie → employee_id (จาก token ที่ verify แล้วเท่านั้น ไม่รับจาก client)
        ├─ ncacdb GET /auth/session-user/{employee_id}   (รูปเดียวกับ login response)
        ├─ buildSessionUser() → คำนวณ role / is_finance แบบเดียวกับตอน login
        ├─ diffSessionUser(เก่า, ใหม่) → changes[]
        ├─ ถ้าเปลี่ยน → เซ็น cookie ใหม่ (คง exp เดิม ไม่ต่ออายุ)
        └─ ตอบ { status: 'unchanged' | 'updated' | 'inactive', user, changes }
  └─ client: setUser(user) · updated → เปิด ProfileUpdateDialog · inactive → Dialog ปิดบัญชี → logout
```

- เปรียบเทียบที่ server: dialog จะขึ้น **ครั้งเดียว** เพราะ cookie ถูกเซ็นใหม่แล้ว รอบถัดไปจะไม่มี diff (ไม่ต้องใช้ localStorage)
- เปิดหลายแท็บ: แท็บแรกที่ refresh ได้ dialog แท็บอื่นแค่ได้ user ใหม่แบบเงียบ ๆ
- **fail open**: ncacdb ช้า/ล่ม (Render cold start) → timeout 5 วิ แล้วใช้ session เดิมต่อ ไม่ logout ไม่เด้ง error
- โหลด ncacdb: 1 request ต่อ user ต่อการเปิดแอป/ทุก 5 นาทีที่ active · endpoint ทำ ~6 query เบา ๆ (อยู่ในงบ pool 5 connection)

## 3. สิ่งที่ต้องทำ

### ncacdb (เพิ่มใน branch `feature/org-divisions`)
- `GET /auth/session-user/{employee_id}` → `build_user_response()` ตัวเดียวกับ login (มี `position_level_id`, field องค์กรใหม่) · 404 ถ้าไม่พบ
  - เหตุผลที่ไม่ใช้ `/users/{id}`: response คนละรูป (ไม่มี `position_level_id`) — ใช้ตัวเดียวกับ login จะได้ไม่มีค่าเพี้ยนระหว่าง login กับ refresh
- test: field ตรงกับ login response

### menaIT-v2
| ไฟล์ | งาน |
|---|---|
| `lib/session-user.ts` (ใหม่) | `buildSessionUser(beUser)` ย้าย logic role/is_finance ออกจาก `login/route.ts` มาไว้ที่เดียว · `diffSessionUser(old, new)` คืนรายการเปลี่ยน + ป้ายภาษาไทย |
| `lib/session-user.test.ts` (ใหม่) | role/is_finance เหมือนเดิมทุกกรณี · diff แต่ละ field · key ที่ไม่มีใน token เก่า = "ข้อมูลใหม่" · image_url ไม่นับ |
| `app/api/login/route.ts` | เรียก `buildSessionUser()` แทน logic ที่ฝังไว้ (พฤติกรรมเท่าเดิม) |
| `lib/jwt.ts` | `signToken(user, exp?)` — refresh ส่ง exp เดิมเข้าไป |
| `app/api/session/refresh/route.ts` (ใหม่) | POST ตาม flow ข้อ 2 · ncacdb 404 หรือ `employee_status !== 'Active'` → ลบ cookie + `status: 'inactive'` |
| `app/context/SessionContext.tsx` | `UserInfo` + `division`, `org_department`, `org_department_display`, `job_level_code` · เรียก refresh หลัง `/api/session` และตอน `visibilitychange` (throttle 5 นาที, เก็บเวลาใน `useRef`) · state `changes` → render dialog |
| `components/profile-update-dialog.tsx` (ใหม่) | Dialog น้องมีนา (ข้อ 4) ใช้ `components/ui/dialog` + `Mascot` |
| `app/settings/...` | หลัง admin บันทึกข้อมูลตัวเอง → เรียก refresh แบบ `silent` (ไม่ต้องเด้ง dialog เรื่องที่ตัวเองเพิ่งแก้) |

### field ที่เทียบและแสดง
| field | ป้าย | แสดงใน dialog |
|---|---|---|
| `firstname` + `lastname` | ชื่อ-นามสกุล | ✓ |
| `division.division_name_th` | ฝ่าย | ✓ |
| `org_department_display` | แผนก | ✓ |
| `position` | ตำแหน่ง | ✓ |
| `position_level` | ระดับตำแหน่ง | ✓ |
| `job_level_code` | Job level | ✓ |
| `site` | สถานที่ปฏิบัติงาน | ✓ |
| `role` | สิทธิ์ผู้ดูแลระบบ | ✓ เป็นข้อความสิทธิ์ (ข้อ 4) |
| `is_finance` | เมนูการเงิน | ✓ เป็นข้อความสิทธิ์ |
| `department_id`, `position_level_id`, `site_id` | — | ไม่แสดง (อัปเดตใน session เงียบ ๆ) |
| `image_url` | — | ไม่เทียบ (user เปลี่ยนเอง) |

## 4. Dialog น้องมีนา

```
┌──────────────────────────────────────────────┐
│                         ╭──────────────╮     │
│        (น้องมีนา 96px)  │ อัปเดตใหม่! ✨ │     │
│           motion=bob    ╰──────────────╯     │
│                                              │
│      ข้อมูลของคุณมีการอัปเดต                    │
│   ระบบแสดงข้อมูลล่าสุดให้แล้ว ไม่ต้องเข้าสู่ระบบใหม่   │
│                                              │
│  ฝ่าย        ~~ฝ่ายยานยนต์~~  →  ฝ่ายบัญชี        │
│  แผนก       ~~—~~           →  แผนกบัญชีทั่วไป   │
│  ตำแหน่ง     ~~เจ้าหน้าที่~~   →  เจ้าหน้าที่อาวุโส  │
│                                              │
│  🔓 คุณเข้าใช้เมนู "การเงิน" ได้แล้ว               │
│                                              │
│  [ ดูโปรไฟล์ ]                 [ รับทราบ ]     │
└──────────────────────────────────────────────┘
```

- **ค่าเก่า**: ตัวเทา ขีดฆ่า · **ค่าใหม่**: ตัวหนาสี brand · ค่าว่างแสดง "—"
- **บรรทัดสิทธิ์** (แสดงเฉพาะเมื่อเปลี่ยน): ได้ finance "🔓 คุณเข้าใช้เมนู การเงิน ได้แล้ว" · เสีย finance "🔒 เมนู การเงิน ถูกปิดสำหรับบัญชีของคุณ" · admin ใช้รูปแบบเดียวกัน
- เสียสิทธิ์ขณะอยู่หน้าที่ต้องใช้สิทธิ์นั้น (เช่น `/finance`) → กด "รับทราบ" แล้วพาไปหน้าแรก
- **ข้อมูลใหม่ครั้งแรก** (token เก่าไม่มี key `division` — ทุกคนตอนเปิดใช้ฟีเจอร์นี้): หัวข้อ "น้องมีนามีข้อมูลใหม่ให้ดู" + แสดงฝ่าย / แผนก / Job level (ไม่มีค่าเก่า) — เด้งครั้งเดียวต่อคน ใช้เป็นประกาศเปิดตัวไปในตัว
- **บัญชีถูกปิด** (`inactive`): น้องมีนา `motion=none` + "บัญชีของคุณถูกปิดใช้งาน กรุณาติดต่อฝ่ายบุคคลหรือไอที" → ปุ่มเดียว "ตกลง" → logout (แทน swal "เซสชันหมดอายุ" เดิมในกรณีนี้)
- เกิน 6 รายการ: แสดง 6 รายการแรก + "และอีก n รายการ ดูได้ที่โปรไฟล์"
- ปิดได้ด้วย Esc / คลิกนอก = รับทราบ (ยกเว้น inactive) · focus ไปที่ปุ่ม "รับทราบ" · มือถือเป็น bottom sheet เต็มความกว้าง

## 5. ผลกระทบ

- 🟢 **ความปลอดภัยดีขึ้น**: ถอดสิทธิ์ admin/finance หรือปิดบัญชี มีผลภายในไม่เกิน 5 นาทีที่ user ใช้งาน (เดิม 90 วัน)
- 🟢 login, role, is_finance ใช้ logic เดิม (ย้ายมารวมที่ `buildSessionUser`) — มี test ยืนยันว่าเท่าเดิม
- 🟡 ทุกคนจะเห็น dialog "ข้อมูลใหม่" 1 ครั้งตอนเปิดใช้ (หลัง import ฝ่าย/แผนกบน prod)
- 🟡 ncacdb ได้ request เพิ่มเล็กน้อย · ถ้า ncacdb ล่ม แอปยังใช้ได้ (fail open)
- 🟠 **ลำดับ deploy**: ncacdb (migration → โค้ด org + `/auth/session-user`) **ก่อน** menaIT · ถ้า menaIT ขึ้นก่อน endpoint ยังไม่มี → refresh ได้ 404 → ต้อง **ไม่** ตีความเป็นบัญชีถูกปิด: แยก "ไม่พบ user" (ncacdb ตอบ `detail: User not found`) ออกจาก 404 ของ route ที่ไม่มี — ปลอดภัยสุดคือเช็คเฉพาะ `employee_status` และถือว่า 404 อื่น ๆ = fail open

## 6. ทดสอบ

- unit: `lib/session-user.test.ts` (buildSessionUser, diffSessionUser) · ncacdb test ของ `/auth/session-user`
- local: menaIT `bun dev` ชี้ ncacdb local (DB ทดสอบ docker `org-mig-test`) → แก้ฝ่าย/ตำแหน่ง/สถานะของ user ใน DB → สลับแท็บกลับมา → dialog ขึ้นครั้งเดียว, cookie ใหม่, สิทธิ์ finance เปลี่ยนตาม, Inactive → logout
- regression: login ปกติ / Google · หน้า finance (requireUser) · tickets admin

## 7. ลำดับงาน

1. ncacdb `/auth/session-user` + test (branch เดิม)
2. menaIT `lib/session-user.ts` + test + ปรับ login (refactor ไม่เปลี่ยนพฤติกรรม)
3. `/api/session/refresh` + `signToken(exp)`
4. SessionContext + throttle
5. ProfileUpdateDialog (+ ตรวจ mobile / a11y)
6. ทดสอบ local ครบ → deploy ncacdb ก่อน แล้ว menaIT
