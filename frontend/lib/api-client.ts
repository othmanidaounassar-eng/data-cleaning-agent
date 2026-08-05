export interface CleanReport {
  status: string;
  original_filename: string;
  rows_before: number;
  rows_after: number;
  rows_removed: number;
}

export interface DownloadPayload {
  filename: string;
  media_type: string;
  content: string; // base64
}

export interface CleanResponse {
  report: CleanReport;
  download: DownloadPayload;
}

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export async function cleanCsv(file: File): Promise<CleanResponse> {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`${API_BASE_URL}/clean`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    throw new Error(`Clean request failed: ${res.status} ${res.statusText}`);
  }

  return res.json();
}

export function downloadCleanedFile(payload: DownloadPayload): void {
  const binary = atob(payload.content);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const blob = new Blob([bytes], {
    type: payload.media_type || "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = payload.filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// استخدام مباشر من أي صفحة
export async function handleCleanAndDownload(file: File): Promise<CleanReport> {
  const data = await cleanCsv(file);
  downloadCleanedFile(data.download);
  return data.report;
}