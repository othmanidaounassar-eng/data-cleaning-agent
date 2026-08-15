// types.ts

export type FileKind = "csv" | "xlsx" | "xls";

export type ValidationCheckId =
  "extension" | "size" | "empty" | "headers" | "duplicateHeaders" | "encoding";

export interface ValidationCheck {
  id: ValidationCheckId;
  label: string;
  passed: boolean;
  detail: string;
}

export interface ValidationResult {
  valid: boolean;
  checks: ValidationCheck[];
  errorTitle?: string;
  errorMessage?: string;
  suggestion?: string;
}

export interface DatasetInfo {
  fileName: string;
  fileKind: FileKind;
  sizeBytes: number;
  uploadedAt: string;
  rows: number;
  columns: number;
  encoding: string;
}

export type PipelineStepId =
  | "missingValues"
  | "duplicates"
  | "whitespace"
  | "specialCharacters"
  | "dataTypes"
  | "outliers"
  | "validation"
  | "finalReport";

export type StepStatus = "waiting" | "running" | "completed" | "error";

export interface PipelineStep {
  id: PipelineStepId;
  label: string;
  status: StepStatus;
}

export interface CleaningStats {
  rowsBefore: number;
  rowsAfter: number;
  columnsBefore: number;
  columnsAfter: number;
  duplicatesRemoved: number;
  missingValuesFixed: number;
  outliersDetected: number;
  columnsConverted: number;
  charactersCleaned: number;
  processingTimeMs: number;
  qualityScore: number;
  missingValuesFilled?: number;
  columns?: string[];
}

export interface CleaningReport {
  id: string;
  fileName: string;
  cleanedFileName: string;
  cleaningDate: string;
  stats: CleaningStats;
  operations: { label: string; done: boolean }[];
  recommendations: string[];
  columnConversions: { column: string; from: string; to: string }[];
  downloadUrl?: string;
  sample?: any[];
  alerts?: string[];
  summary?: string;
  processing_time_s?: number;
  // ✅ حقول جديدة من Backend
  download_url?: string; // رابط التحميل (Base64)
  cleaned_file_name?: string; // اسم الملف المنظف
}

export interface HistoryEntry {
  id: string;
  originalFileName: string;
  cleanedFileName: string;
  cleaningDate: string;
  processingTimeMs: number;
  qualityScore: number;
  report: CleaningReport;
  cleanedRows: Record<string, unknown>[];
  columns: string[];
}
