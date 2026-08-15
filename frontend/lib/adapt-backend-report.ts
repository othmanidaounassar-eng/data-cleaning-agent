// frontend/lib/adapt-backend-report.ts

import { CleaningReport, CleaningStats } from "./types";

type AnyRecord = Record<string, any>;

// 👇 نضع الرابط هنا مباشرة لقطع الشك باليقين
const API_BASE = "https://data-cleaning-agent-production.up.railway.app";

/**
 * Adapts the raw backend response to the frontend CleaningReport format.
 * @param raw - The raw JSON response from the backend.
 * @param fileName - Optional file name used as fallback if raw.file_name is missing.
 */
export function adaptBackendReport(
  raw: AnyRecord,
  fileName?: string,
): CleaningReport {
  const finalFileName = raw.file_name ?? fileName ?? "unknown.csv";

  const stats: CleaningStats = {
    rowsBefore: raw.rows_before ?? 0,
    rowsAfter: raw.rows_after ?? 0,
    columnsBefore: raw.columns_before ?? 0,
    columnsAfter: raw.columns_after ?? 0,
    duplicatesRemoved: raw.duplicates_removed ?? 0,
    missingValuesFixed:
      raw.missing_values_fixed ?? raw.missing_values_filled ?? 0,
    outliersDetected: raw.outliers_detected ?? 0,
    columnsConverted: raw.columns_converted ?? 0,
    charactersCleaned: raw.characters_cleaned ?? 0,
    processingTimeMs: raw.processing_time_ms ?? 0,
    qualityScore: raw.quality_score ?? 0,
    missingValuesFilled: raw.missing_values_filled ?? 0,
    columns: raw.columns ?? [],
  };

  return {
    id: raw.id ?? `report-${Date.now()}`,
    fileName: finalFileName,
    cleanedFileName: raw.cleaned_file_name ?? `cleaned_${finalFileName}`,
    cleaningDate: raw.cleaning_date ?? new Date().toISOString(),
    stats,
    operations: raw.operations ?? [],
    recommendations: raw.recommendations ?? [],
    columnConversions: raw.column_conversions ?? [],
    downloadUrl: raw.download_url,
    sample: raw.sample ?? [],
    alerts: raw.alerts ?? [],
    summary: raw.summary ?? "",
  };
}

/**
 * Fetches a cleaning report from the backend and adapts it.
 */
export async function fetchCleaningReport(file: File): Promise<CleaningReport> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${API_BASE}/clean`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Backend error (${response.status}): ${errorText}`);
  }

  const raw = await response.json();
  return adaptBackendReport(raw, file.name);
}
