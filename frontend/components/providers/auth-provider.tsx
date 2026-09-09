"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { Lang, Theme, translate } from "@/lib/i18n";
import { getBackendUrl } from "@/lib/backend";

const TOKEN_KEY = "oqzaro:token";
const USER_KEY = "oqzaro:user";
const THEME_KEY = "oqzaro:theme";
const LANG_KEY = "oqzaro:lang";

interface User {
  id: number;
  username: string;
}

interface AuthState {
  userState: User | null;
  userLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  clearSession: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

function readStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function readStoredUser(): User | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function persistSession(token: string, user: User) {
  try {
    window.localStorage.setItem(TOKEN_KEY, token);
    window.localStorage.setItem(USER_KEY, JSON.stringify(user));
  } catch {
    // ignore storage errors
  }
}

function clearStoredSession() {
  try {
    window.localStorage.removeItem(TOKEN_KEY);
    window.localStorage.removeItem(USER_KEY);
  } catch {
    // ignore
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [userState, setUserState] = useState<User | null>(readStoredUser());
  const [userLoading, setUserLoading] = useState(!readStoredUser());
  const router = useRouter();
  const logoutRef = useRef(false);

  useEffect(() => {
    const token = readStoredToken();
    const stored = readStoredUser();
    if (!token || !stored) {
      setUserState(null);
      setUserLoading(false);
      return;
    }
    const verify = async () => {
      try {
        const backend = getBackendUrl();
        const res = await fetch(`${backend}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setUserState(data.user);
        } else {
          if (res.status === 401) {
            clearStoredSession();
            setUserState(null);
            redirectOn401();
          }
        }
      } catch {
        // offline, keep stored session
      } finally {
        setUserLoading(false);
      }
    };
    verify();
  }, []);

  const redirectOn401 = useCallback(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    const current = url.pathname;
    if (!current.startsWith("/login") && !current.startsWith("/auth")) {
      router.replace(`/login?from=${encodeURIComponent(current)}`);
    }
  }, [router]);

  const login = useCallback(
    async (username: string, password: string) => {
      const backend = getBackendUrl();
      const res = await fetch(`${backend}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Login failed");
      }
      const data = await res.json();
      const token = data.token;
      const user = data.user;
      persistSession(token, user);
      setUserState(user);
      router.push("/dashboard");
    },
    [router],
  );

  const register = useCallback(
    async (username: string, password: string) => {
      const backend = getBackendUrl();
      const res = await fetch(`${backend}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Registration failed");
      }
      const data = await res.json();
      const token = data.token;
      const user = data.user;
      persistSession(token, user);
      setUserState(user);
      router.push("/dashboard");
    },
    [router],
  );

  const logout = useCallback(async () => {
    if (logoutRef.current) return;
    logoutRef.current = true;
    try {
      const token = readStoredToken();
      if (token) {
        const backend = getBackendUrl();
        await fetch(`${backend}/auth/logout`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        }).catch(() => {});
      }
    } catch {
      // ignore network errors during logout
    } finally {
      logoutRef.current = false;
      clearStoredSession();
      setUserState(null);
      router.replace("/login");
    }
  }, [router]);

  const clearSession = useCallback(() => {
    clearStoredSession();
    setUserState(null);
  }, []);

  const value = useMemo(
    () => ({
      userState,
      userLoading,
      login,
      register,
      logout,
      clearSession,
    }),
    [userState, userLoading, login, register, logout, clearSession],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within <AuthProvider>");
  }
  return ctx;
}

export { type User };
