"use client";

import { useCallback, useEffect, useState } from "react";
import { mockAuthService } from "@/lib/auth/mock-service";
import { AuthError, AuthSession, LoginInput, RegisterInput } from "@/lib/auth/types";

const SESSION_KEY = "ai-data-cleaning-agent:session";

function readStoredSession(): AuthSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as AuthSession) : null;
  } catch {
    return null;
  }
}

function storeSession(session: AuthSession | null) {
  if (typeof window === "undefined") return;
  if (session) {
    window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } else {
    window.localStorage.removeItem(SESSION_KEY);
  }
}

export function useAuth() {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<AuthError | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setSession(readStoredSession());
    setHydrated(true);
  }, []);

  const login = useCallback(async (input: LoginInput) => {
    setLoading(true);
    setError(null);
    try {
      const result = await mockAuthService.login(input);
      setSession(result);
      storeSession(result);
      return result;
    } catch (err) {
      const authError =
        err instanceof AuthError ? err : new AuthError("Could not sign in. Please try again.");
      setError(authError);
      throw authError;
    } finally {
      setLoading(false);
    }
  }, []);

  const register = useCallback(async (input: RegisterInput) => {
    setLoading(true);
    setError(null);
    try {
      const result = await mockAuthService.register(input);
      setSession(result);
      storeSession(result);
      return result;
    } catch (err) {
      const authError =
        err instanceof AuthError ? err : new AuthError("Could not create your account. Please try again.");
      setError(authError);
      throw authError;
    } finally {
      setLoading(false);
    }
  }, []);

  const requestPasswordReset = useCallback(async (email: string) => {
    setLoading(true);
    setError(null);
    try {
      return await mockAuthService.requestPasswordReset(email);
    } catch (err) {
      const authError = err instanceof AuthError ? err : new AuthError("Could not send reset link.");
      setError(authError);
      throw authError;
    } finally {
      setLoading(false);
    }
  }, []);

  const resendVerificationEmail = useCallback(async (email: string) => {
    setLoading(true);
    setError(null);
    try {
      return await mockAuthService.resendVerificationEmail(email);
    } catch (err) {
      const authError = err instanceof AuthError ? err : new AuthError("Could not resend the email.");
      setError(authError);
      throw authError;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    await mockAuthService.logout();
    setSession(null);
    storeSession(null);
  }, []);

  return {
    session,
    user: session?.user ?? null,
    isAuthenticated: Boolean(session),
    hydrated,
    loading,
    error,
    login,
    register,
    requestPasswordReset,
    resendVerificationEmail,
    logout,
  };
}
