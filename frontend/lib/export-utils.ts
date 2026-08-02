import { jsPDF } from "jspdf";
import { CleaningReport } from "./types";

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function downloadCleanedCsv(
  headers: string[],
  rows: Record<string, unknown>[],
  filename: string
) {
  const escape = (value: unknown) => {
    if (value === null || value === undefined) return "";
    const str = String(value);
    return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
  };

  const lines = [
    headers.join(","),
    ...rows.map((row) => headers.map((h) => escape(row[h])).join(",")),
  ];

  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  triggerDownload(blob, filename);
}

export function downloadJsonReport(report: CleaningReport) {
  const blob = new Blob([JSON.stringify(report, null, 2)], {
    type: "application/json",
  });
  triggerDownload(blob, report.fileName.replace(/\.(csv|xlsx|xls)$/i, "_report.json"));
}

export function downloadCsvReport(report: CleaningReport) {
  const lines = [
    "Metric,Value",
    `File Name,${report.fileName}`,
    `Cleaning Date,${report.cleaningDate}`,
    `Rows Before,${report.stats.rowsBefore}`,
    `Rows After,${report.stats.rowsAfter}`,
    `Columns Before,${report.stats.columnsBefore}`,
    `Columns After,${report.stats.columnsAfter}`,
    `Duplicates Removed,${report.stats.duplicatesRemoved}`,
    `Missing Values Fixed,${report.stats.missingValuesFixed}`,
    `Outliers Detected,${report.stats.outliersDetected}`,
    `Columns Converted,${report.stats.columnsConverted}`,
    `Characters Cleaned,${report.stats.charactersCleaned}`,
    `Processing Time (ms),${report.stats.processingTimeMs}`,
    `Quality Score,${report.stats.qualityScore}`,
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  triggerDownload(blob, report.fileName.replace(/\.(csv|xlsx|xls)$/i, "_report.csv"));
}

export function downloadPdfReport(report: CleaningReport) {
  const doc = new jsPDF();
  const marginX = 18;
  let y = 20;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("AI Data Cleaning Report", marginX, y);

  y += 10;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(90);
  doc.text(`${report.fileName}  •  ${new Date(report.cleaningDate).toLocaleString()}`, marginX, y);

  y += 12;
  doc.setTextColor(20);
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text("Summary", marginX, y);
  y += 7;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);

  const summaryLines = [
    `Rows: ${report.stats.rowsBefore} -> ${report.stats.rowsAfter}`,
    `Columns: ${report.stats.columnsBefore} -> ${report.stats.columnsAfter}`,
    `Duplicates removed: ${report.stats.duplicatesRemoved}`,
    `Missing values fixed: ${report.stats.missingValuesFixed}`,
    `Outliers detected: ${report.stats.outliersDetected}`,
    `Columns converted: ${report.stats.columnsConverted}`,
    `Processing time: ${report.stats.processingTimeMs}ms`,
    `Quality score: ${report.stats.qualityScore}/100`,
  ];
  for (const line of summaryLines) {
    doc.text(line, marginX, y);
    y += 6;
  }

  y += 4;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("Actions Taken", marginX, y);
  y += 7;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  for (const op of report.operations) {
    doc.text(`${op.done ? "[x]" : "[ ]"} ${op.label}`, marginX, y);
    y += 6;
  }

  y += 4;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("Recommendations", marginX, y);
  y += 7;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  for (const rec of report.recommendations) {
    const split = doc.splitTextToSize(`• ${rec}`, 175);
    doc.text(split, marginX, y);
    y += split.length * 6;
  }

  doc.save(report.fileName.replace(/\.(csv|xlsx|xls)$/i, "_report.pdf"));
}
