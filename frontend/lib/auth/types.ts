import { PlanId } from "../billing/plans";

export type AccountType = "individual" | "company";
export type UserRole = "owner" | "admin" | "member";
export type VerificationStatus = "unverified" | "pending" | "verified";

export interface User {
  id: string;
  fullName: string;
  email: string;
  accountType: AccountType;
  role: UserRole;
  plan: PlanId;
  verification: VerificationStatus;
  createdAt: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthSession {
  user: User;
  tokens: AuthTokens;
}

export interface LoginInput {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface RegisterInput {
  fullName: string;
  email: string;
  password: string;
  confirmPassword: string;
  acceptTerms: boolean;
  accountType: AccountType;
}

export class AuthError extends Error {
  field?: keyof RegisterInput | keyof LoginInput | "form";

  constructor(message: string, field?: AuthError["field"]) {
    super(message);
    this.name = "AuthError";
    this.field = field;
  }
}
