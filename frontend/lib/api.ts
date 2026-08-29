// frontend/lib/api.ts

function normalizeBaseUrl(url: string): string {
  return url.trim().replace(/\/+$/, "");
}

// استخدام متغير البيئة أو المسار النسبي /api
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "";

export const API_BASE = API_BASE_URL ? normalizeBaseUrl(API_BASE_URL) : "/api";

// جميع نقاط النهاية الداخلية
export const API_ENDPOINTS = {
  UPLOAD: `${API_BASE}/upload`,
  CLEAN: `${API_BASE}/clean`,
  HISTORY: `${API_BASE}/history`,
  REPORT: `${API_BASE}/report`,
} as const;

if (typeof window !== "undefined") {
  console.log(`🔗 API_BASE is set to: ${API_BASE}`);
}
