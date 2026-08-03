import { CleaningReport, CleaningStats } from './types';
import { API_BASE } from './api-client';

type AnyRecord = Record<string, any>;

export function adaptBackendReport(raw: AnyRecord): CleaningReport {
  // تحويل البيانات من الـ Backend إلى شكل يتطابق مع الـ Interface
  const stats: CleaningStats = {
    rowsBefore: raw.rows_before ?? 0,
    rowsAfter: raw.rows_after ?? 0,
    columnsBefore: raw.columns_before ?? 0,
    columnsAfter: raw.columns_after ?? 0,
    duplicatesRemoved: raw.duplicates_removed ?? 0,
    missingValuesFixed: raw.missing_values_fixed ?? raw.missing_values_filled ?? 0, // دعم كلا الاسمين
    outliersDetected: raw.outliers_detected ?? 0,
    columnsConverted: raw.columns_converted ?? 0,
    charactersCleaned: raw.characters_cleaned ?? 0,
    processingTimeMs: raw.processing_time_ms ?? 0,
    qualityScore: raw.quality_score ?? 0,
    // الحقول الجديدة المضافة في types.ts
    missingValuesFilled: raw.missing_values_filled ?? 0,
    columns: raw.columns ?? [],
  };

  return {
    id: raw.id ?? `report-${Date.now()}`,
    fileName: raw.file_name ?? 'unknown.csv',
    cleanedFileName: raw.cleaned_file_name ?? 'cleaned.csv',
    cleaningDate: raw.cleaning_date ?? new Date().toISOString(),
    stats,
    operations: raw.operations ?? [],
    recommendations: raw.recommendations ?? [],
    columnConversions: raw.column_conversions ?? [],
    downloadUrl: raw.download_url,
    // الحقول الجديدة المضافة في types.ts
    sample: raw.sample ?? [],
    alerts: raw.alerts ?? [],
    summary: raw.summary ?? '',
  };
}

export async function fetchCleaningReport(file: File): Promise<CleaningReport> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${API_BASE}/clean`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Backend error (${response.status}): ${errorText}`);
  }

  const raw = await response.json();
  return adaptBackendReport(raw);
}