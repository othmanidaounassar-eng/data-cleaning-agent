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
  ANALYZE: `${API_BASE}/analyze`,
  ANALYZE_DATA: `${API_BASE}/analyze-data`,
  MERGE_FILES: `${API_BASE}/merge-files`,
  CONVERT: `${API_BASE}/convert`,
  POWER_PIVOT: `${API_BASE}/power-pivot`,
  HISTORY: `${API_BASE}/history`,
  REPORT: `${API_BASE}/report`,
  CHAT: `${API_BASE}/chat`,
  FILES: `${API_BASE}/files`,
} as const;

if (typeof window !== "undefined") {
  console.log(`🔗 API_BASE is set to: ${API_BASE}`);
}
