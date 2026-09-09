// frontend/lib/api.ts

// All client traffic goes through the same-origin Next.js proxy routes
// (/api/*), which forward to the backend with auth headers and decompress
// gzipped uploads. Using a single relative base removes the env-dependent
// bypass that would send >128 KiB gzip payloads straight at FastAPI (which has
// no gzip handling) and avoids the import-time env fragility for tests.
export const API_BASE = "/api";

// جميع نقاط النهاية الداخلية
export const API_ENDPOINTS = {
  UPLOAD: `${API_BASE}/upload`,
  ANALYZE: `${API_BASE}/analyze`,
  ANALYZE_DATA: `${API_BASE}/analyze-data`,
  MERGE_FILES: `${API_BASE}/merge-files`,
  CONVERT: `${API_BASE}/convert`,
  POWER_PIVOT: `${API_BASE}/power-pivot`,
  CHAT: `${API_BASE}/chat`,
  FILES: `${API_BASE}/files`,
} as const;
