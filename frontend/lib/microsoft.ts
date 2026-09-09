export interface MicrosoftConfig {
  clientId: string;
  tenantId: string;
  clientSecret: string;
  powerBiGroupId: string;
}

export interface MicrosoftStatus {
  configured: boolean;
  clientIdReady: boolean;
  tenantReady: boolean;
  clientSecretReady: boolean;
  powerBiGroupId: boolean;
  note?: string;
}

const MICROSOFT_CONFIG_KEY = "oqzaro:ms:config";

export const EMPTY_MICROSOFT_CONFIG: MicrosoftConfig = {
  clientId: "",
  tenantId: "",
  clientSecret: "",
  powerBiGroupId: "",
};

function isServer(): boolean {
  return typeof window === "undefined";
}

export function readMicrosoftConfig(): MicrosoftConfig {
  if (isServer()) return { ...EMPTY_MICROSOFT_CONFIG };
  try {
    const raw = window.localStorage.getItem(MICROSOFT_CONFIG_KEY);
    if (!raw) return { ...EMPTY_MICROSOFT_CONFIG };
    const parsed = JSON.parse(raw) as Partial<MicrosoftConfig>;
    return {
      clientId: typeof parsed.clientId === "string" ? parsed.clientId : "",
      tenantId: typeof parsed.tenantId === "string" ? parsed.tenantId : "",
      clientSecret:
        typeof parsed.clientSecret === "string" ? parsed.clientSecret : "",
      powerBiGroupId:
        typeof parsed.powerBiGroupId === "string" ? parsed.powerBiGroupId : "",
    };
  } catch {
    return { ...EMPTY_MICROSOFT_CONFIG };
  }
}

export function writeMicrosoftConfig(config: MicrosoftConfig) {
  if (isServer()) return;
  try {
    window.localStorage.setItem(MICROSOFT_CONFIG_KEY, JSON.stringify(config));
  } catch {
    // ignore
  }
}

export function isMicrosoftConfigured(config: MicrosoftConfig): boolean {
  return Boolean(
    config.clientId.trim() &&
      config.tenantId.trim() &&
      config.clientSecret.trim(),
  );
}

export function maskSecret(value: string): string {
  if (!value) return "";
  if (value.length <= 6) return "••••••";
  return `${value.slice(0, 2)}••••••${value.slice(-4)}`;
}

export async function fetchMicrosoftStatus(): Promise<MicrosoftStatus> {
  const response = await fetch("/api/microsoft/status", {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });
  if (!response.ok) {
    throw new Error(`Microsoft status failed: ${response.status}`);
  }
  return (await response.json()) as MicrosoftStatus;
}
