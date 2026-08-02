export type PlanId = "free" | "pro" | "business" | "enterprise";

export interface SubscriptionPlan {
  id: PlanId;
  name: string;
  maxUploadSizeMb: number;
  maxFilesPerMonth: number | "unlimited";
  features: string[];
}

export const PLANS: Record<PlanId, SubscriptionPlan> = {
  free: {
    id: "free",
    name: "Free",
    maxUploadSizeMb: 50,
    maxFilesPerMonth: 20,
    features: ["Client & server-side cleaning", "CSV / JSON / PDF reports", "7-day history"],
  },
  pro: {
    id: "pro",
    name: "Pro",
    maxUploadSizeMb: 250,
    maxFilesPerMonth: 200,
    features: ["Everything in Free", "Priority processing", "90-day history", "Team sharing"],
  },
  business: {
    id: "business",
    name: "Business",
    maxUploadSizeMb: 1000,
    maxFilesPerMonth: "unlimited",
    features: ["Everything in Pro", "Role-based access", "Audit log", "SSO (coming soon)"],
  },
  enterprise: {
    id: "enterprise",
    name: "Enterprise",
    maxUploadSizeMb: 5000,
    maxFilesPerMonth: "unlimited",
    features: ["Everything in Business", "Dedicated support", "Custom AI agents", "On-prem option"],
  },
};

export const DEFAULT_PLAN: SubscriptionPlan = PLANS.free;
