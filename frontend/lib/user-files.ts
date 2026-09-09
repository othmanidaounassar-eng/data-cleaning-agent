// frontend/lib/user-files.ts
// Helpers for the per-user persisted cleaning files (server-side storage).
import { authHeaders } from "@/lib/auth";
import { API_ENDPOINTS } from "@/lib/api";

export interface SavedFileSummary {
  id: string;
  file_name: string;
  cleaned_file_name: string;
  rows_before: number | null;
  rows_after: number | null;
  columns: number | null;
  quality_score: number | null;
  created_at: number;
}

export async function listFiles(): Promise<SavedFileSummary[]> {
  try {
    const res = await fetch(API_ENDPOINTS.FILES, { headers: authHeaders() });
    if (!res.ok) return [];
    const data = await res.json();
    return data.files || [];
  } catch {
    return [];
  }
}

export async function getFileReport(
  id: string,
): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(`${API_ENDPOINTS.FILES}/${id}`, {
      headers: authHeaders(),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.file || null;
  } catch {
    return null;
  }
}

export async function deleteFile(id: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_ENDPOINTS.FILES}/${id}`, {
      method: "DELETE",
      headers: authHeaders(),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export function downloadUrl(id: string): string {
  return `/api/files/${id}/download`;
}

export async function triggerDownload(id: string, fallbackName: string) {
  const res = await fetch(downloadUrl(id), { headers: authHeaders() });
  if (!res.ok) return;
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fallbackName || "cleaned.csv";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
