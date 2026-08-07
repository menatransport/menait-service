"use client";

import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";

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
}

interface SessionContextType {
  user: UserInfo | null;
  loading: boolean;
  setUser: (user: UserInfo | null) => void;
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

const showSwal = (options: any) => import('sweetalert2').then(({ default: Swal }) => Swal.fire(options));

export const SessionProvider = ({ children }: { children: React.ReactNode }) => {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUserState] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const isLoggingOut = useRef(false);

  useEffect(() => {
    const fetchSession = async () => {
      try {
        const res = await fetch('/api/session');
        if (res.ok) {
          const data = await res.json();
          const sessionUser: UserInfo | null = data.user;
          setUserState(sessionUser);

          // Tokens signed before image_url existed have no such key (3-month TTL),
          // so pull the avatar from the user profile once instead of waiting for re-login.
          if (sessionUser && !('image_url' in sessionUser) && sessionUser.employee_id) {
            try {
              const profileRes = await fetch(`/api/organization/myuser/${sessionUser.employee_id}`);
              if (profileRes.ok) {
                const profile = await profileRes.json();
                setUserState(prev => prev ? { ...prev, image_url: profile?.image_url ?? null } : prev);
              }
            } catch {
              // keep the initials fallback
            }
          }
        } else {
          setUserState(null);
        }
      } catch {
        setUserState(null);
      } finally {
        setLoading(false);
      }
    };
    fetchSession();
  }, []);

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
        confirmButtonColor: '#026a75',
        confirmButtonText: 'ไปหน้าเข้าสู่ระบบ',
        allowOutsideClick: false,
      }).then(() => {
        localStorage.clear()
        router.replace('/login');
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
    <SessionContext.Provider value={{ user, loading, setUser }}>
      {children}
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

