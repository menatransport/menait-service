"use client";

import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import type { SessionDiff } from "@/lib/session-user";
import { ProfileUpdateDialog, type SessionNotice } from "@/components/profile-update-dialog";

export interface UserInfo {
  id: number;
  role: string;
  username: string;
  firstname: string;
  lastname: string;
  employee_id: string;
  site: string;
  department: string;
  position: string;
  position_level: string;
  position_level_id: number;
  image_url?: string | null;
  department_id?: number | null;
  is_finance?: boolean;
  /** บัญชี (ตรวจเอกสาร) และการเงิน (ปิดรอบคืนยอด) แยกกันในโมดูลเงินสดย่อย */
  is_accounting?: boolean;
  is_treasury?: boolean;
  employee_status?: string | null;
  /** โครงสร้างองค์กร (ncacdb build_user_response) — สายงาน / ฝ่าย / แผนก · ไม่มีใน token ที่เซ็นก่อนเปิดใช้ */
  /** สายงาน — ตามฝ่าย (divisions.path_id) */
  path?: { path_id: number; path_code: string | null; path_th: string | null; path_eng: string | null } | null;
  /** ฝ่าย — ตามแผนก (departments.division_id) */
  division?: { division_id: number; division_code: string | null; division_th: string | null; division_eng: string | null } | null;
  /** ชื่อแผนกภาษาไทย (`department` เป็นชื่ออังกฤษ) */
  department_th?: string | null;
}

interface SessionContextType {
  user: UserInfo | null;
  loading: boolean;
  setUser: (user: UserInfo | null) => void;
  /** Re-read the user from ncacdb now. `silent` = update without the dialog (e.g. right after editing yourself). */
  refreshSession: (opts?: { silent?: boolean }) => Promise<void>;
}

/** Re-check when the tab comes back, at most this often. */
const REFRESH_EVERY_MS = 5 * 60 * 1000;

const SessionContext = createContext<SessionContextType | undefined>(undefined);

/** /login?next=<current path+query> so a deep link survives the login round trip (login validates `next`). */
const loginUrlWithNext = () => {
  const here = `${window.location.pathname}${window.location.search}`;
  return here === '/' ? '/login' : `/login?next=${encodeURIComponent(here)}`;
};

const showSwal = (options: any) => import('sweetalert2').then(({ default: Swal }) => Swal.fire(options));

export const SessionProvider = ({ children }: { children: React.ReactNode }) => {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUserState] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const isLoggingOut = useRef(false);
  const lastRefresh = useRef(0);
  const refreshing = useRef(false);
  const [notice, setNotice] = useState<SessionNotice | null>(null);

  // Pull the latest user from ncacdb (department, position, rights…) and re-sign the cookie if it changed —
  // also replaces the old one-off image_url backfill for tokens signed before that field existed.
  const refreshSession = useCallback(async ({ silent = false }: { silent?: boolean } = {}) => {
    if (refreshing.current) return;
    refreshing.current = true;
    lastRefresh.current = Date.now();
    try {
      const res = await fetch('/api/session/refresh', { method: 'POST' });
      const data = await res.json().catch(() => null);
      if (data?.status === 'updated' && data.user) {
        setUserState(data.user);
        const diff: SessionDiff = data.diff;
        if (!silent && (diff.changes.length || diff.access.length)) setNotice({ kind: 'updated', diff });
      } else if (data?.status === 'inactive') {
        setNotice({ kind: 'ended', reason: data.reason });
      }
    } catch {
      // fail open — keep the current session
    } finally {
      refreshing.current = false;
    }
  }, []);

  useEffect(() => {
    const fetchSession = async () => {
      let signedIn = false;
      try {
        const res = await fetch('/api/session');
        if (res.ok) {
          const data = await res.json();
          setUserState(data.user);
          signedIn = !!data.user;
        } else {
          setUserState(null);
        }
      } catch {
        setUserState(null);
      } finally {
        setLoading(false);
      }
      if (signedIn) refreshSession();
    };
    fetchSession();
  }, [refreshSession]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible' && user && Date.now() - lastRefresh.current >= REFRESH_EVERY_MS) {
        refreshSession();
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [user, refreshSession]);

  const closeNotice = useCallback(() => {
    const current = notice;
    setNotice(null);
    if (current?.kind === 'ended') {
      isLoggingOut.current = true;
      fetch('/api/session', { method: 'DELETE' });
      setUserState(null);
      return;
    }
    // a right this page needs was removed → leave the page
    const lost = current?.kind === 'updated' ? current.diff.access.filter(a => !a.granted).map(a => a.key) : [];
    if ((lost.includes('is_finance') || lost.includes('role')) && pathname.startsWith('/finance')) router.replace('/home');
    else if (lost.includes('role') && (pathname.startsWith('/master') || pathname.startsWith('/builder'))) router.replace('/home');
  }, [notice, pathname, router]);

  useEffect(() => {
    if (loading) return;
    if (!user && pathname !== '/login') {
      if (isLoggingOut.current) {
        isLoggingOut.current = false;
        router.replace('/login');
        return;
      }
      showSwal({
        icon: 'warning',
        title: 'เซสชันหมดอายุ',
        text: 'กรุณาเข้าสู่ระบบใหม่อีกครั้ง',
        confirmButtonColor: '#1c6ef2',
        confirmButtonText: 'ไปหน้าเข้าสู่ระบบ',
        allowOutsideClick: false,
      }).then(() => {
        localStorage.clear()
        router.replace(loginUrlWithNext());
      });
    }
  }, [user, loading, pathname, router]);

  const setUser = useCallback((newUser: UserInfo | null) => {
    if (!newUser) {
      isLoggingOut.current = true;
      fetch('/api/session', { method: 'DELETE' });
    }
    setUserState(newUser);
  }, []);

  return (
    <SessionContext.Provider value={{ user, loading, setUser, refreshSession }}>
      {children}
      <ProfileUpdateDialog notice={notice} onClose={closeNotice} />
    </SessionContext.Provider>
  );
};

export const useSessionContext = () => {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error("useSessionContext must be used within a SessionProvider");
  }
  return context;
};

