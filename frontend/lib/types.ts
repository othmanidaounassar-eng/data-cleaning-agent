// types.ts

export interface CleaningStats {
  rowsBefore: number;
  rowsAfter: number;
  columnsBefore: number;
  columnsAfter: number;
  duplicatesRemoved: number;
  missingValuesFixed: number;    // ✅ موجودة مسبقاً
  outliersDetected: number;
  columnsConverted: number;
  charactersCleaned: number;
  processingTimeMs: number;
  qualityScore: number;
  // 👇 أضف هذه الحقول الجديدة لتتناسب مع الـ Backend
  missingValuesFilled?: number;   // اختياري، لاستقبال القيمة من الـ Backend
  columns?: string[];            // اختياري، قائمة بأسماء الأعمدة
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
  // 👇 أضف هذه الحقول الجديدة لتتناسب مع الـ Backend
  sample?: any[];      // اختياري، عينة من البيانات المنظفة
  alerts?: string[];   // اختياري، تنبيهات من عملية التنظيف
  summary?: string;    // اختياري، ملخص العملية
}