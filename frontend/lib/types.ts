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
}

// ✅ أضف هذا التعريف الجديد
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