import {
  AuthError,
  AuthSession,
  LoginInput,
  RegisterInput,
  User,
} from "./types";
import { uid } from "../utils";

const SIMULATED_LATENCY_MS = 700;

function delay<T>(value: T, ms = SIMULATED_LATENCY_MS): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

function makeSession(user: User): AuthSession {
  return {
    user,
    tokens: { accessToken: `mock_${uid()}`, refreshToken: `mock_${uid()}` },
  };
}

/**
 * Mock implementation of the future auth API. Every function has the same
 * signature it would have against a real backend, so swapping this module
 * for real `fetch` calls later requires no changes in `hooks/use-auth.ts`
 * or in the pages that call it.
 */
export const mockAuthService = {
  async login(input: LoginInput): Promise<AuthSession> {
    if (!input.email || !input.password) {
      throw new AuthError("Email and password are required.", "form");
    }
    if (input.password.length < 6) {
      throw new AuthError("That password doesn't look right.", "password");
    }

    const user: User = {
      id: uid(),
      fullName: input.email.split("@")[0],
      email: input.email,
      accountType: "individual",
      role: "owner",
      plan: "free",
      verification: "verified",
      createdAt: new Date().toISOString(),
    };

    return delay(makeSession(user));
  },

  async register(input: RegisterInput): Promise<AuthSession> {
    if (input.password !== input.confirmPassword) {
      throw new AuthError("Passwords don't match.", "confirmPassword");
    }
    if (input.password.length < 8) {
      throw new AuthError(
        "Password must be at least 8 characters.",
        "password",
      );
    }
    if (!input.acceptTerms) {
      throw new AuthError(
        "You must accept the Terms of Service to continue.",
        "acceptTerms",
      );
    }

    const user: User = {
      id: uid(),
      fullName: input.fullName,
      email: input.email,
      accountType: input.accountType,
      role: "owner",
      plan: "free",
      verification: "pending",
      createdAt: new Date().toISOString(),
    };

    return delay(makeSession(user));
  },

  async requestPasswordReset(email: string): Promise<{ sent: true }> {
    if (!email.includes("@")) {
      throw new AuthError("Enter a valid email address.", "email");
    }
    return delay({ sent: true });
  },

  async resendVerificationEmail(email: string): Promise<{ sent: true }> {
    if (!email.includes("@")) {
      throw new AuthError("Enter a valid email address.", "email");
    }
    return delay({ sent: true });
  },

  async verifyEmailToken(token: string): Promise<{ valid: boolean }> {
    // Mock rule: tokens containing "expired" simulate an expired link.
    return delay({ valid: !token.includes("expired") });
  },

  async logout(): Promise<void> {
    return delay(undefined, 150);
  },
};
