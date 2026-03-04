"use client";

import { createContext, useContext, useState, useEffect, useCallback } from "react";
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
}

interface SessionContextType {
  user: UserInfo | null;
  loading: boolean;
  setUser: (user: UserInfo | null) => void;
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

export const SessionProvider = ({ children }: { children: React.ReactNode }) => {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUserState] = useState<UserInfo | null>(() => {
    if (typeof window === 'undefined') return null;
    try {
      const storedUser = localStorage.getItem("user");
      return storedUser ? JSON.parse(storedUser) : null;
    } catch {
      return null;
    }
  });

  const [loading, setLoading] = useState(() => typeof window === 'undefined');

  useEffect(() => {
    setLoading(false);
  }, []);

  useEffect(() => {
    if (loading) return;
    if (!user && pathname !== '/login') {
      localStorage.removeItem("user");
      router.replace('/login');
    }
  }, [user, loading, pathname, router]);

  const setUser = useCallback((newUser: UserInfo | null) => {
    setUserState(newUser);
    if (newUser) {
      localStorage.setItem("user", JSON.stringify(newUser));
    } else {
      localStorage.removeItem("user");
    }
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

