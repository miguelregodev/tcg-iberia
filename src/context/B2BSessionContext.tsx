'use client';

/**
 * B2BSessionContext
 *
 * Lightweight client-side session store for the B2B module. Fetches
 * `/api/b2b/session` once on mount and exposes:
 *   - `customer`      current B2B customer summary (or null)
 *   - `isB2B`         true when an ACTIVE session exists
 *   - `refresh()`     re-fetch the session (call after login/logout)
 *   - `logout()`      call the logout endpoint and clear the local state
 *
 * Intentionally NOT wrapped around ProductCard rendering — components that
 * need to swap wholesale pricing subscribe via `useB2BSession()`.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

export type B2BSessionCustomer = {
  id: string;
  email: string;
  companyName: string;
  contactName: string;
  status: 'PENDING' | 'ACTIVE' | 'DISABLED';
};

interface Ctx {
  customer: B2BSessionCustomer | null;
  loading: boolean;
  isB2B: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
}

const B2BContext = createContext<Ctx | null>(null);

export function B2BSessionProvider({ children }: { children: ReactNode }) {
  const [customer, setCustomer] = useState<B2BSessionCustomer | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/b2b/session', { 
        cache: 'no-store',
        credentials: 'include',
      });
      if (!res.ok) {
        setCustomer(null);
        return;
      }
      const data = (await res.json()) as { customer: B2BSessionCustomer | null };
      setCustomer(data.customer ?? null);
    } catch {
      setCustomer(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch('/api/b2b/logout', { 
        method: 'POST',
        credentials: 'include',
      });
    } finally {
      setCustomer(null);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo<Ctx>(
    () => ({
      customer,
      loading,
      isB2B: customer?.status === 'ACTIVE',
      refresh,
      logout,
    }),
    [customer, loading, refresh, logout]
  );

  return <B2BContext.Provider value={value}>{children}</B2BContext.Provider>;
}

export function useB2BSession(): Ctx {
  const ctx = useContext(B2BContext);
  if (!ctx) {
    // Safe default when accessed outside the provider (e.g. isolated tests).
    return {
      customer: null,
      loading: false,
      isB2B: false,
      refresh: async () => undefined,
      logout: async () => undefined,
    };
  }
  return ctx;
}
