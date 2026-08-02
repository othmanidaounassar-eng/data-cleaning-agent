import { CleaningOutcome } from "./clean-data";
import { CleaningReport, CleaningStats } from "./types";
import { uid } from "./utils";

export function buildCleaningReport(params: {
  fileName: string;
  rowsBefore: number;
  columnsBefore: number;
  missingBefore: number;
  outcome: CleaningOutcome;
  processingTimeMs: number;
  qualityScore: number;
}): CleaningReport {
  const { fileName, rowsBefore, columnsBefore, missingBefore, outcome, processingTimeMs, qualityScore } = params;

  const stats: CleaningStats = {
    rowsBefore,
    rowsAfter: outcome.rows.length,
    columnsBefore,
    columnsAfter: outcome.headers.length,
    duplicatesRemoved: outcome.duplicatesRemoved,
    missingValuesFixed: outcome.missingValuesFixed,
    outliersDetected: outcome.outliersDetected,
    columnsConverted: outcome.columnsConverted,
    charactersCleaned: outcome.charactersCleaned,
    processingTimeMs,
    qualityScore,
  };

  const operations = [
    { label: "Removed duplicate rows", done: outcome.duplicatesRemoved > 0 },
    { label: "Filled missing values", done: outcome.missingValuesFixed > 0 },
    { label: "Removed extra whitespace", done: true },
    { label: "Removed invalid characters", done: outcome.charactersCleaned > 0 },
    { label: "Fixed data types", done: outcome.columnsConverted > 0 },
    { label: "Detected outliers", done: outcome.outliersDetected > 0 },
    { label: "Standardized text values", done: true },
    { label: "Validated final dataset", done: true },
  ];

  const recommendations: string[] = [];
  if (outcome.outliersDetected > 0) {
    recommendations.push(
      `Consider reviewing the ${outcome.outliersDetected} detected outlier${outcome.outliersDetected === 1 ? "" : "s"} before building predictive models.`
    );
  }
  if (missingBefore === 0 && outcome.duplicatesRemoved === 0) {
    recommendations.push("Your dataset was already clean — only light validation was needed.");
  }
  if (qualityScore >= 90) {
    recommendations.push("Your dataset is now ready for analysis.");
  } else if (qualityScore >= 70) {
    recommendations.push("Dataset quality is good. Spot-check the modified columns before analysis.");
  } else {
    recommendations.push("Quality score is moderate — consider a manual review of the source data.");
  }

  return {
    id: uid(),
    fileName,
    cleanedFileName: fileName.replace(/\.(csv|xlsx|xls)$/i, (m) => `_cleaned${m}`),
    cleaningDate: new Date().toISOString(),
    stats,
    operations,
    recommendations,
    columnConversions: outcome.columnConversions,
  };
}
