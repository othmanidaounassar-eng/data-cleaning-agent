// types.ts

export type FileKind = "csv" | "xlsx" | "xls";

export type ValidationCheckId =
  | "extension"
  | "size"
  | "empty"
  | "headers"
  | "duplicateHeaders"
  | "encoding";

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
  // 👇 حقول إضافية من Backend (اختيارية)
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
  // 👇 حقول إضافية من Backend (اختيارية)
  sample?: any[];
  alerts?: string[];
  summary?: string;
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