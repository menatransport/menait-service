import type { UserInfo } from '@/app/context/SessionContext';
import { financeConfig, isFinanceUser } from '@/lib/finance/role';

/** role "a" (admin): IT department or a named employee — same rule login always used. */
export const ADMIN_DEPARTMENT_IDS = [21];
export const ADMIN_EMPLOYEE_IDS = ['680043', '670108'];

type BackendUser = Omit<UserInfo, 'role' | 'is_finance'> & Record<string, unknown>;

/**
 * The session user signed into the cookie: the BE user (POST /auth/login, GET /auth/session-user/{id})
 * plus role and is_finance. Login and session refresh both go through here so the two never disagree.
 */
export function buildSessionUser(beUser: BackendUser, env: Record<string, string | undefined> = process.env): UserInfo {
  const deptId = beUser.department_id ?? null;
  const role = (deptId !== null && ADMIN_DEPARTMENT_IDS.includes(deptId)) || ADMIN_EMPLOYEE_IDS.includes(beUser.employee_id)
    ? 'a'
    : 'u';
  const finance = financeConfig(env);
  return { ...beUser, role, is_finance: isFinanceUser(beUser, finance.deptIds, finance.employeeIds) } as UserInfo;
}

export interface FieldChange {
  key: string;
  label: string;
  before: string | null;
  after: string | null;
}

export interface AccessChange {
  key: 'role' | 'is_finance';
  granted: boolean;
}

export interface SessionDiff {
  /** Anything in the session differs → the cookie must be re-signed (also covers ids the dialog doesn't show). */
  resign: boolean;
  /** The token predates the org fields (path / division / department_th) — first refresh after rollout. */
  firstTime: boolean;
  changes: FieldChange[];
  access: AccessChange[];
}

const text = (v: unknown): string | null => {
  const s = typeof v === 'string' ? v.trim() : v == null ? '' : String(v);
  return s ? s : null;
};

/** Fields a person would recognise, in the order the dialog lists them. */
const SHOWN: { key: string; label: string; pick: (u: Partial<UserInfo>) => string | null }[] = [
  { key: 'name', label: 'ชื่อ-นามสกุล', pick: u => text([u.firstname, u.lastname].filter(Boolean).join(' ')) },
  { key: 'path', label: 'สายงาน', pick: u => text(u.path?.path_th) },
  { key: 'division', label: 'ฝ่าย', pick: u => text(u.division?.division_th) },
  { key: 'department', label: 'แผนก', pick: u => text(u.department_th ?? u.department) },
  { key: 'position', label: 'ตำแหน่ง', pick: u => text(u.position) },
  { key: 'position_level', label: 'ระดับตำแหน่ง', pick: u => text(u.position_level) },
  { key: 'site', label: 'สถานที่ปฏิบัติงาน', pick: u => text(u.site) },
];

/** Shown only on the first refresh after rollout (the token has never had them). */
const ORG_KEYS = new Set(['path', 'division', 'department']);

/** last_login moves on every login elsewhere — never a reason to re-sign or to tell anyone. */
const IGNORED = new Set(['last_login']);

const stable = (u: Record<string, unknown>) =>
  JSON.stringify(Object.keys(u).filter(k => !IGNORED.has(k)).sort().map(k => [k, u[k] ?? null]));

export function diffSessionUser(before: UserInfo, after: UserInfo): SessionDiff {
  // department_th is the newest org field — a token without it has never shown the Thai แผนก / ฝ่าย / สายงาน
  const firstTime = !('department_th' in before) && 'department_th' in after;
  const changes: FieldChange[] = [];
  for (const f of SHOWN) {
    const was = f.pick(before);
    const now = f.pick(after);
    if (firstTime && ORG_KEYS.has(f.key)) {
      if (now) changes.push({ key: f.key, label: f.label, before: null, after: now });
    } else if (was !== now) {
      changes.push({ key: f.key, label: f.label, before: was, after: now });
    }
  }
  const access: AccessChange[] = [];
  if ((before.role === 'a') !== (after.role === 'a')) access.push({ key: 'role', granted: after.role === 'a' });
  if (!!before.is_finance !== !!after.is_finance) access.push({ key: 'is_finance', granted: !!after.is_finance });

  return {
    resign: stable(before as unknown as Record<string, unknown>) !== stable(after as unknown as Record<string, unknown>),
    firstTime,
    changes,
    access,
  };
}
