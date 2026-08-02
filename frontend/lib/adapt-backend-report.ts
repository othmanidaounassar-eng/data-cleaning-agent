import { CleaningReport, CleaningStats } from "./types";
import { API_BASE_URL } from "./api-client";

type AnyRecord = Record<string, any>;

function pick<T = unknown>(
  obj: AnyRecord | undefined,
  keys: string[],
  fallback: T
): T {
  if (!obj) return fallback;

  for (const key of keys) {
    if (obj[key] !== undefined && obj[key] !== null) {
      return obj[key];
    }
  }

  return fallback;
}

function resolveDownloadUrl(raw: string | undefined): string | undefined {
  if (!raw) return undefined;

  if (/^https?:\/\//i.test(raw)) {
    return raw;
  }

  return `${API_BASE_URL}${raw.startsWith("/") ? "" : "/"}${raw}`;
}

/**
 * Converts the FastAPI response into the format expected
 * by the React frontend.
 */
export function adaptBackendReport(
  raw: AnyRecord,
  fileName: string
): CleaningReport {

  const cleaningActions: AnyRecord = pick(
    raw,
    [
      "Cleaning Actions",
      "cleaning_actions",
      "cleaningActions"
    ],
    raw
  );

  const typeConversions: AnyRecord = pick(
    raw,
    [
      "Type Conversions",
      "type_conversions",
      "typeConversions"
    ],
    {}
  );

  const rowsBefore = Number(
    pick(
      raw,
      [
        "rows_before",
        "rowsBefore",
        "original_rows"
      ],
      0
    )
  );

  const rowsAfter = Number(
    pick(
      raw,
      [
        "rows_after",
        "rowsAfter",
        "final_rows"
      ],
      rowsBefore
    )
  );

  const columnsBefore = Number(
    pick(
      raw,
      [
        "columns_before",
        "columnsBefore",
        "original_columns"
      ],
      0
    )
  );

  const columnsAfter = Number(
    pick(
      raw,
      [
        "columns_after",
        "columnsAfter",
        "final_columns"
      ],
      columnsBefore
    )
  );

  const duplicatesRemoved = Number(
    pick(
      cleaningActions,
      [
        "duplicates_removed",
        "duplicatesRemoved"
      ],
      pick(raw, ["duplicates_removed"], 0)
    )
  );

  const missingBefore = Number(
    pick(
      raw,
      [
        "missing_before",
        "total_missing_before",
        "missing_values_before"
      ],
      0
    )
  );

  const missingAfter = Number(
    pick(
      raw,
      [
        "missing_after",
        "total_missing_after",
        "missing_values_after"
      ],
      0
    )
  );

  const missingValuesFixed = Number(
    pick(
      raw,
      [
        "missing_filled",
        "missing_values_filled",
        "missingValuesFixed"
      ],
      Math.max(0, missingBefore - missingAfter)
    )
  );

  const columnsModified: string[] = pick(
    raw,
    [
      "columns_modified",
      "columnsModified"
    ],
    []
  );

  const textColumnsCleaned: string[] = pick(
    raw,
    [
      "text_columns_cleaned",
      "textColumnsCleaned"
    ],
    []
  );

  const numericConversions: string[] = pick(
    typeConversions,
    [
      "numeric_conversions",
      "numericConversions"
    ],
    []
  );

  const dateConversions: string[] = pick(
    typeConversions,
    [
      "date_conversions",
      "dateConversions"
    ],
    []
  );

  const outliersDetected = Number(
    pick(
      raw,
      [
        "outliers_detected",
        "outliersDetected"
      ],
      0
    )
  );

  const charactersCleaned = Number(
    pick(
      raw,
      [
        "characters_cleaned",
        "charactersCleaned"
      ],
      textColumnsCleaned.length
    )
  );

  const executionTimeSeconds = Number(
    pick(
      raw,
      [
        "execution_time",
        "executionTime"
      ],
      0
    )
  );

  const processingTimeMs = Number(
    pick(
      raw,
      [
        "processing_time_ms",
        "processingTimeMs"
      ],
      executionTimeSeconds * 1000
    )
  );

  const qualityScore = Number(
    pick(
      raw,
      [
        "quality_score",
        "qualityScore"
      ],
      85
    )
  );

  const stats: CleaningStats = {
    rowsBefore,
    rowsAfter,
    columnsBefore,
    columnsAfter,
    duplicatesRemoved,
    missingValuesFixed,
    outliersDetected,
    columnsConverted:
      numericConversions.length +
      dateConversions.length,
    charactersCleaned,
    processingTimeMs,
    qualityScore,
  };

  const operations = [
    {
      label: "Removed duplicate rows",
      done: duplicatesRemoved > 0,
    },
    {
      label: "Filled missing values",
      done: missingValuesFixed > 0,
    },
    {
      label: "Removed extra whitespace",
      done: textColumnsCleaned.length > 0,
    },
    {
      label: "Fixed data types",
      done:
        numericConversions.length +
          dateConversions.length >
        0,
    },
    {
      label: "Modified columns",
      done: columnsModified.length > 0,
    },
    {
      label: "Validated final dataset",
      done: true,
    },
  ];

  const columnConversions = [
    ...numericConversions.map((column) => ({
      column,
      from: "text",
      to: "numeric",
    })),
    ...dateConversions.map((column) => ({
      column,
      from: "text",
      to: "datetime",
    })),
  ];

  const recommendations: string[] = pick(
    raw,
    ["recommendations"],
    []
  );

  if (recommendations.length === 0) {
    recommendations.push(
      qualityScore >= 85
        ? "Your dataset is now ready for analysis."
        : "Review the cleaned columns before analysis."
    );
  }

  return {
    id: String(
      pick(
        raw,
        [
          "id",
          "report_id"
        ],
        Date.now().toString()
      )
    ),

    fileName,

    cleanedFileName: pick(
      raw,
      [
        "cleaned_file_name",
        "cleanedFileName",
        "cleaned_file"
      ],
      fileName.replace(
        /\.(csv|xlsx|xls)$/i,
        "_cleaned.csv"
      )
    ),

    cleaningDate: pick(
      raw,
      [
        "cleaning_date",
        "cleaningDate",
        "generated_at"
      ],
      new Date().toISOString()
    ),

    stats,

    operations,

    recommendations,

    columnConversions,

    downloadUrl: resolveDownloadUrl(
      pick(
        raw,
        [
          "download_url",
          "downloadUrl",
          "file_url",
          "cleaned_file"
        ],
        undefined
      )
    ),
  };
}
