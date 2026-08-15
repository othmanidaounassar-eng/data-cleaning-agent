export interface CleaningOutcome {
  rows: Record<string, unknown>[];
  headers: string[];
  duplicatesRemoved: number;
  missingValuesFixed: number;
  charactersCleaned: number;
  outliersDetected: number;
  columnsConverted: number;
  columnConversions: { column: string; from: string; to: string }[];
  columnsModified: string[];
}

function isBlank(value: unknown): boolean {
  return (
    value === null ||
    value === undefined ||
    (typeof value === "string" && value.trim() === "")
  );
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

function mode<T>(values: T[]): T | undefined {
  const counts = new Map<T, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  let best: T | undefined;
  let bestCount = 0;
  for (const [v, c] of counts) {
    if (c > bestCount) {
      best = v;
      bestCount = c;
    }
  }
  return best;
}

function detectColumnType(values: unknown[]): "numeric" | "text" {
  const present = values.filter((v) => !isBlank(v));
  if (present.length === 0) return "text";
  const numericCount = present.filter(
    (v) => typeof v === "number" || (!isNaN(Number(v)) && v !== ""),
  ).length;
  return numericCount / present.length >= 0.8 ? "numeric" : "text";
}

/**
 * Runs the full cleaning pipeline: duplicates, missing values, whitespace /
 * special characters, and outlier detection (IQR method on numeric columns).
 */
export function cleanDataset(
  headers: string[],
  inputRows: Record<string, unknown>[],
): CleaningOutcome {
  let rows = inputRows.map((r) => ({ ...r }));

  // 1. Remove duplicates
  const seen = new Set<string>();
  const deduped: Record<string, unknown>[] = [];
  let duplicatesRemoved = 0;

  for (const row of rows) {
    const key = JSON.stringify(headers.map((h) => row[h]));
    if (seen.has(key)) {
      duplicatesRemoved++;
    } else {
      seen.add(key);
      deduped.push(row);
    }
  }
  rows = deduped;

  // Determine column types up front
  const columnTypes = new Map<string, "numeric" | "text">();
  for (const h of headers) {
    columnTypes.set(h, detectColumnType(rows.map((r) => r[h])));
  }

  // 2. Missing values
  let missingValuesFixed = 0;
  const columnsModified = new Set<string>();

  for (const h of headers) {
    const type = columnTypes.get(h);
    const values = rows.map((r) => r[h]);
    const missingCount = values.filter(isBlank).length;
    if (missingCount === 0) continue;

    let fillValue: unknown;
    if (type === "numeric") {
      const numeric = values.filter((v) => !isBlank(v)).map((v) => Number(v));
      fillValue = median(numeric);
    } else {
      const present = values.filter((v) => !isBlank(v));
      fillValue = mode(present) ?? "Unknown";
    }

    for (const row of rows) {
      if (isBlank(row[h])) {
        row[h] = fillValue;
        missingValuesFixed++;
      }
    }
    columnsModified.add(h);
  }

  // 3. Whitespace + special character cleanup on text columns
  let charactersCleaned = 0;
  const specialCharPattern = /[^\w\s.,\-@()/]/g;

  for (const h of headers) {
    if (columnTypes.get(h) !== "text") continue;
    for (const row of rows) {
      const value = row[h];
      if (typeof value !== "string") continue;
      const trimmed = value.trim().replace(/\s+/g, " ");
      const cleaned = trimmed.replace(specialCharPattern, "");
      if (cleaned !== value) {
        charactersCleaned += Math.abs(value.length - cleaned.length) || 1;
        row[h] = cleaned;
      }
    }
  }

  // 4. Numeric / date type conversion + outlier detection (IQR)
  let outliersDetected = 0;
  let columnsConverted = 0;
  const columnConversions: { column: string; from: string; to: string }[] = [];

  for (const h of headers) {
    if (columnTypes.get(h) === "numeric") {
      const numericValues = rows
        .map((r) => Number(r[h]))
        .filter((v) => !Number.isNaN(v));

      for (const row of rows) {
        if (!isBlank(row[h])) row[h] = Number(row[h]);
      }

      if (numericValues.length > 4) {
        const sorted = [...numericValues].sort((a, b) => a - b);
        const q1 = sorted[Math.floor(sorted.length * 0.25)];
        const q3 = sorted[Math.floor(sorted.length * 0.75)];
        const iqr = q3 - q1;
        const lower = q1 - 1.5 * iqr;
        const upper = q3 + 1.5 * iqr;
        outliersDetected += numericValues.filter(
          (v) => v < lower || v > upper,
        ).length;
      }

      columnsConverted++;
      columnConversions.push({ column: h, from: "text", to: "numeric" });
    }
  }

  return {
    rows,
    headers,
    duplicatesRemoved,
    missingValuesFixed,
    charactersCleaned,
    outliersDetected,
    columnsConverted,
    columnConversions,
    columnsModified: Array.from(columnsModified),
  };
}

export function computeQualityScore(params: {
  missingBefore: number;
  missingAfter: number;
  duplicatesRemoved: number;
  rowsBefore: number;
  outliersDetected: number;
}): number {
  const { missingBefore, duplicatesRemoved, rowsBefore, outliersDetected } =
    params;
  let score = 100;
  const totalCells = Math.max(rowsBefore, 1);

  score -= Math.min(30, (missingBefore / totalCells) * 100 * 0.5);
  score -= Math.min(20, (duplicatesRemoved / totalCells) * 100);
  score -= Math.min(15, (outliersDetected / totalCells) * 100 * 0.3);

  return Math.max(0, Math.round(score));
}
