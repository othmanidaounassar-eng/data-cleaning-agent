// frontend/lib/backend.ts
export const BACKEND_URL =
  process.env.BACKEND_API_URL || "http://localhost:8000";

export function getBackendUrl(): string {
  return BACKEND_URL;
}

// IDs accepted in dynamic URL segments (`[id]` params). Session ids are
// uuid hex strings; file ids are 8-12 hex chars. Restricting to this safe
// character set blocks path traversal (`..`, `/`, `%2e`) in proxied URLs.
const ID_PATTERN = /^[0-9a-fA-F-]{1,64}$/;

// Validate a dynamic path segment before it is interpolated into a backend
// URL. Returns the (sanitized) id, or null if it is unsafe to embed.
export function safePathId(id: string): string | null {
  if (typeof id !== "string" || !id) return null;
  const cleaned = id.trim();
  if (!ID_PATTERN.test(cleaned)) return null;
  return cleaned;
}

// Build fetch headers for backend calls, forwarding the caller's auth token.
export function backendHeaders(
  request: NextRequest,
  extra?: HeadersInit,
): HeadersInit {
  const headers: Record<string, string> = {};
  if (extra) {
    for (const [k, v] of new Headers(extra).entries()) {
      headers[k] = v;
    }
  }
  const auth = request.headers.get("authorization");
  if (auth) {
    headers["Authorization"] = auth;
  }
  return headers;
}
