import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { adminApi } from '@/src/lib/api';

export type StaffRole = 'super_admin' | 'frontdesk' | 'chef';

export const SUPER: StaffRole[] = ['super_admin'];
export const FRONT: StaffRole[] = ['super_admin', 'frontdesk'];
export const FLOOR: StaffRole[] = ['super_admin', 'frontdesk', 'chef'];

export const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Super Admin',
  frontdesk: 'Front Desk',
  chef: 'Kitchen Chef',
};

export interface StaffUser {
  id: number | string;
  name: string;
  email: string;
  role: StaffRole;
}

interface AdminAuthValue {
  user: StaffUser | null;
  ready: boolean;
  login: (email: string, password: string) => Promise<StaffUser>;
  claimInitialAdmin: (name: string, email: string, password: string) => Promise<StaffUser>;
  logout: () => Promise<void>;
  can: (...roles: StaffRole[]) => boolean;
  refresh: () => Promise<void>;
}

const AdminAuthContext = createContext<AdminAuthValue>({
  user: null,
  ready: false,
  login: async () => {
    throw new Error('Not initialized');
  },
  claimInitialAdmin: async () => {
    throw new Error('Not initialized');
  },
  logout: async () => {},
  can: () => false,
  refresh: async () => {},
});

export function AdminAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<StaffUser | null>(null);
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const me = await adminApi<StaffUser>('/auth/me');
      setUser(me);
    } catch {
      setUser(null);
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await adminApi<{ ok: boolean; user: StaffUser }>('/auth/login', {
      method: 'POST',
      body: { email, password },
    });
    setUser(res.user);
    return res.user;
  }, []);

  const claimInitialAdmin = useCallback(async (name: string, email: string, password: string) => {
    const res = await adminApi<{ ok: boolean; user: StaffUser }>('/auth/setup-admin', {
      method: 'POST',
      body: { name, email, password },
    });
    setUser(res.user);
    return res.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await adminApi('/auth/logout', { method: 'POST' });
    } catch {
      /* ignore network issues on logout */
    } finally {
      setUser(null);
    }
  }, []);

  const can = useCallback(
    (...roles: StaffRole[]) => {
      if (!user) return false;
      return roles.includes(user.role);
    },
    [user],
  );

  const value = useMemo(
    () => ({ user, ready, login, claimInitialAdmin, logout, can, refresh }),
    [user, ready, login, claimInitialAdmin, logout, can, refresh],
  );

  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>;
}

export function useAdminAuth() {
  return useContext(AdminAuthContext);
}
