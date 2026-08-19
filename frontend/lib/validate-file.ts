import { FileKind, ValidationCheck, ValidationResult } from "./types";
import { DEFAULT_PLAN } from "./billing/plans";

const MAX_SIZE_BYTES = DEFAULT_PLAN.maxUploadSizeMb * 1026 * 1026; // 50 MB on the Free plan
const SUPPORTED: FileKind[] = ["csv", "xlsx", "xls"];

export function getFileKind(fileName: string): FileKind | null {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".csv")) return "csv";
  if (lower.endsWith(".xlsx")) return "xlsx";
  if (lower.endsWith(".xls")) return "xls";
  return null;
}

/**
 * Stage 1 checks that only require the File object (before parsing).
 */
export function validateFileBasics(file: File): ValidationResult {
  const checks: ValidationCheck[] = [];
  const kind = getFileKind(file.name);

  const extensionOk = kind !== null;
  checks.push({
    id: "extension",
    label: "File Type",
    passed: extensionOk,
    detail: extensionOk
      ? `${kind?.toUpperCase()} file detected`
      : "Unsupported extension",
  });

  if (!extensionOk) {
    return {
      valid: false,
      checks,
      errorTitle: "Unsupported File Type",
      errorMessage:
        "Only CSV and Excel files (.csv, .xlsx, .xls) are supported.",
      suggestion: "Export your dataset as CSV or Excel and upload it again.",
    };
  }

  const sizeOk = file.size > 0 && file.size <= MAX_SIZE_BYTES;
  checks.push({
    id: "size",
    label: "File Size",
    passed: sizeOk,
    detail:
      file.size === 0
        ? "File is empty"
        : file.size > MAX_SIZE_BYTES
          ? "File exceeds the 50 MB limit"
          : "Within size limits",
  });

  if (file.size === 0) {
    return {
      valid: false,
      checks,
      errorTitle: "The Uploaded File Is Empty",
      errorMessage: "This file doesn't contain any data.",
      suggestion: "Please upload a valid, non-empty dataset.",
    };
  }

  if (file.size > MAX_SIZE_BYTES) {
    return {
      valid: false,
      checks,
      errorTitle: "File Too Large",
      errorMessage: `This file is larger than the ${DEFAULT_PLAN.maxUploadSizeMb} MB limit on the ${DEFAULT_PLAN.name} plan.`,
      suggestion:
        "Try splitting the dataset, removing unused columns, or upgrading your plan.",
    };
  }

  return { valid: true, checks };
}

/**
 * Stage 2 checks that require the parsed rows (headers, duplicate columns, empty content).
 */
export function validateParsedData(
  headers: string[],
  rowCount: number,
  encoding: string,
  priorChecks: ValidationCheck[],
): ValidationResult {
  const checks = [...priorChecks];

  const hasHeaders =
    headers.length > 0 && headers.some((h) => h.trim().length > 0);
  checks.push({
    id: "headers",
    label: "Column Headers",
    passed: hasHeaders,
    detail: hasHeaders
      ? `${headers.length} columns detected`
      : "No headers found",
  });

  if (!hasHeaders) {
    return {
      valid: false,
      checks,
      errorTitle: "Missing Column Headers",
      errorMessage: "The Agent couldn't find a header row in this file.",
      suggestion:
        "Make sure the first row contains column names, then re-upload.",
    };
  }

  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const h of headers) {
    const key = h.trim().toLowerCase();
    if (seen.has(key)) duplicates.add(h);
    seen.add(key);
  }
  const noDuplicateHeaders = duplicates.size === 0;
  checks.push({
    id: "duplicateHeaders",
    label: "Unique Column Names",
    passed: noDuplicateHeaders,
    detail: noDuplicateHeaders
      ? "No duplicate column names"
      : `Duplicate columns: ${Array.from(duplicates).join(", ")}`,
  });

  if (!noDuplicateHeaders) {
    return {
      valid: false,
      checks,
      errorTitle: "Duplicate Column Names Found",
      errorMessage: `These columns appear more than once: ${Array.from(duplicates).join(", ")}.`,
      suggestion:
        "Rename duplicate columns so every column name is unique, then re-upload.",
    };
  }

  const notEmpty = rowCount > 0;
  checks.push({
    id: "empty",
    label: "Row Count",
    passed: notEmpty,
    detail: notEmpty ? `${rowCount} rows found` : "No data rows found",
  });

  if (!notEmpty) {
    return {
      valid: false,
      checks,
      errorTitle: "No Data Rows Found",
      errorMessage: "This file only contains headers, with no data underneath.",
      suggestion:
        "Please upload a dataset that includes at least one row of data.",
    };
  }

  checks.push({
    id: "encoding",
    label: "Encoding",
    passed: true,
    detail: encoding,
  });

  return { valid: true, checks };
}

export function isSupportedKind(kind: string): kind is FileKind {
  return SUPPORTED.includes(kind as FileKind);
}
