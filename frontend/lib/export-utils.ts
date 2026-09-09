import { jsPDF } from "jspdf";
import ExcelJS from "exceljs";
import JSZip from "jszip";
import { CleaningReport } from "./types";

// Report design theme + accent color for customized exports.
export type ReportTheme = "pro" | "minimal" | "colorful";

export interface ReportDesign {
  theme: ReportTheme;
  color: string; // hex accent color, e.g. "#4f7cff"
}

export const REPORT_DESIGNS: {
  id: ReportTheme;
  labelKey: string;
  colors: string[];
}[] = [
  {
    id: "pro",
    labelKey: "report.design.pro",
    colors: ["#4f7cff", "#8b5cf6", "#0ea5e9", "#10b981", "#f59e0b", "#ef4444"],
  },
  {
    id: "minimal",
    labelKey: "report.design.minimal",
    colors: ["#334155", "#1e293b", "#475569", "#94a3b8"],
  },
  {
    id: "colorful",
    labelKey: "report.design.colorful",
    colors: ["#f43f5e", "#10b981", "#f59e0b", "#3b82f6", "#a855f7", "#06b6d4"],
  },
];

const DEFAULT_DESIGN: ReportDesign = { theme: "pro", color: "#4f7cff" };

function hexToRgb(hex: string): [number, number, number] {
  const cleaned = hex.replace("#", "");
  const full =
    cleaned.length === 3
      ? cleaned
          .split("")
          .map((c) => c + c)
          .join("")
      : cleaned;
  const num = parseInt(full || "4f7cff", 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

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

// Characters that can trigger spreadsheet formula execution (CSV injection).
const FORMULA_TRIGGERS = ["=", "+", "-", "@", "\t", "\r"];

// Neutralize a possible formula-injection payload the same way the backend
// does: prefix vulnerable cells with a single quote so Excel/LibreOffice
// treats them as literal text.
function neutralizeFormula(value: string): string {
  if (!value) return value;
  const stripped = value.trimStart();
  if (stripped && FORMULA_TRIGGERS.includes(stripped[0])) {
    return "'" + value;
  }
  return value;
}

// Encode a value as a safe CSV field: neutralize formula triggers, then apply
// RFC 4180 quoting (double quotes inside, wrap when needed).
function csvField(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str = neutralizeFormula(String(value));
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function downloadCleanedCsv(
  headers: string[],
  rows: Record<string, unknown>[],
  filename: string,
) {
  const lines = [
    headers.map((h) => csvField(h)).join(","),
    ...rows.map((row) => headers.map((h) => csvField(row[h])).join(",")),
  ];

  const blob = new Blob([lines.join("\n")], {
    type: "text/csv;charset=utf-8;",
  });
  triggerDownload(blob, filename);
}

export function downloadJsonReport(report: CleaningReport) {
  const blob = new Blob([JSON.stringify(report, null, 2)], {
    type: "application/json",
  });
  triggerDownload(
    blob,
    report.fileName.replace(/\.(csv|xlsx|xls)$/i, "_report.json"),
  );
}

export function downloadCsvReport(report: CleaningReport) {
  const lines = [
    "Metric,Value",
    `File Name,${csvField(report.fileName)}`,
    `Cleaning Date,${csvField(report.cleaningDate)}`,
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
  const blob = new Blob([lines.join("\n")], {
    type: "text/csv;charset=utf-8;",
  });
  triggerDownload(
    blob,
    report.fileName.replace(/\.(csv|xlsx|xls)$/i, "_report.csv"),
  );
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
  doc.text(
    `${report.fileName}  •  ${new Date(report.cleaningDate).toLocaleString()}`,
    marginX,
    y,
  );

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

// ============================================================
// PDF from the raw backend cleaning result (upload page)
// ============================================================

export interface UploadResultLike {
  rows_before?: number;
  rows_after?: number;
  duplicates_removed?: number;
  missing_values_filled?: number;
  outliers_detected?: number;
  quality_score?: number;
  execution_time_seconds?: number;
  cleaning_log?: Array<{
    action?: string;
    description?: string;
    details?: string;
    rows_affected?: number;
    status?: "completed" | "skipped";
    reason?: string;
  }>;
  ai_explanation?: string;
  alerts?: string[];
  recommendations?: string[];
  summary?: string;
  column_data_types?: Record<string, string>;
  sample?: Array<Record<string, unknown>>;
  declined?: Array<{
    action?: string;
    description?: string;
    reason?: string;
  }>;
}

export function downloadPdfFromUploadResult(
  result: UploadResultLike,
  fileName: string,
  design?: ReportDesign,
) {
  const cfg = design ?? DEFAULT_DESIGN;
  const [r, g, b] = hexToRgb(cfg.color);
  const doc = new jsPDF();
  const marginX = 18;
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 20;

  const ensureSpace = (needed: number) => {
    if (y + needed > 285) {
      doc.addPage();
      y = 20;
    }
  };

  // --- Design-specific header band ---
  if (cfg.theme === "colorful") {
    doc.setFillColor(r, g, b);
    doc.rect(0, 0, pageWidth, 34, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("OQZARO AI Data Cleaning Report", marginX, 22);
    y = 48;
  } else if (cfg.theme === "pro") {
    doc.setDrawColor(r, g, b);
    doc.setLineWidth(1.2);
    doc.line(marginX, 34, pageWidth - marginX, 34);
    doc.setTextColor(r, g, b);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text("OQZARO AI Data Cleaning Report", marginX, 24);
    y = 44;
  } else {
    doc.setTextColor(60, 60, 60);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("Data Cleaning Report", marginX, 24);
    y = 40;
  }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(
    cfg.theme === "minimal" ? 60 : 90,
    cfg.theme === "minimal" ? 60 : 90,
    cfg.theme === "minimal" ? 60 : 90,
  );
  doc.text(
    `${fileName || "cleaned_data"}  •  ${new Date().toLocaleString()}`,
    marginX,
    y,
  );

  y += 12;
  doc.setTextColor(
    cfg.theme === "colorful" ? r : 20,
    cfg.theme === "colorful" ? g : 20,
    cfg.theme === "colorful" ? b : 20,
  );
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text("Summary", marginX, y);
  y += 7;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);

  const summaryLines = [
    `Rows before: ${result.rows_before ?? 0}`,
    `Rows after: ${result.rows_after ?? 0}`,
    `Duplicates removed: ${result.duplicates_removed ?? 0}`,
    `Missing values filled: ${result.missing_values_filled ?? 0}`,
    `Outliers detected: ${result.outliers_detected ?? 0}`,
    `Quality score: ${result.quality_score ?? 0}/100`,
    `Execution time: ${result.execution_time_seconds ?? 0}s`,
  ];
  for (const line of summaryLines) {
    doc.text(line, marginX, y);
    y += 6;
  }

  if (result.ai_explanation) {
    ensureSpace(22);
    y += 4;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text("AI Explanation", marginX, y);
    y += 7;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    for (const para of doc.splitTextToSize(result.ai_explanation, 175)) {
      ensureSpace(6);
      doc.text(para, marginX, y);
      y += 6;
    }
  }

  const log =
    result.cleaning_log && result.cleaning_log.length
      ? result.cleaning_log
      : [];
  if (result.alerts && result.alerts.length) {
    ensureSpace(20);
    y += 4;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text("Alerts", marginX, y);
    y += 7;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    for (const alert of result.alerts) {
      const lines = doc.splitTextToSize(`• ${alert}`, 175);
      ensureSpace(lines.length * 6);
      doc.text(lines, marginX, y);
      y += lines.length * 6;
    }
  }

  if (log.length) {
    ensureSpace(20);
    y += 4;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text("Cleaning Log", marginX, y);
    y += 7;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    for (const op of log) {
      const status = op.status === "completed" ? "[x]" : "[ ]";
      const label = `${status} ${op.description || op.action || ""}`;
      const detail = op.details ? ` — ${op.details}` : "";
      const lines = doc.splitTextToSize(label + detail, 175);
      ensureSpace(lines.length * 6);
      doc.text(lines, marginX, y);
      y += lines.length * 6;
    }
  }

  if (result.recommendations && result.recommendations.length) {
    ensureSpace(20);
    y += 4;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text("Recommendations", marginX, y);
    y += 7;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    for (const rec of result.recommendations) {
      const lines = doc.splitTextToSize(`• ${rec}`, 175);
      ensureSpace(lines.length * 6);
      doc.text(lines, marginX, y);
      y += lines.length * 6;
    }
  }

  doc.setDrawColor(200);
  doc.setFontSize(8);
  doc.setTextColor(120);
  doc.text(
    "Generated by OQZARO DataCleaning Agent",
    (pageWidth - doc.getTextWidth("Generated by OQZARO DataCleaning Agent")) /
      2,
    292,
  );

  doc.save(
    (fileName || "cleaned_data").replace(/\.(csv|xlsx|xls)$/i, "_report.pdf"),
  );
}

// ============================================================
// Excel (.xlsx) from the raw backend cleaning result
// ============================================================

export async function downloadExcelResult(
  result: UploadResultLike,
  fileName: string,
  color?: string,
) {
  const accent = (color ?? "#2B579A").replace("#", "").toUpperCase();
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "OQZARO";
  workbook.created = new Date();

  // --- Report sheet: key / value pairs ---
  const reportSheet = workbook.addWorksheet("Report");
  reportSheet.columns = [
    { header: "Metric", key: "metric", width: 32 },
    { header: "Value", key: "value", width: 60 },
  ];

  const headerRow = reportSheet.getRow(1);
  headerRow.font = { bold: true };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: `FF${accent}` },
  };
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };

  const reportRows: Array<[string, string | number | boolean | undefined]> = [
    ["Rows Before", result.rows_before],
    ["Rows After", result.rows_after],
    ["Duplicates Removed", result.duplicates_removed],
    ["Missing Values Filled", result.missing_values_filled],
    ["Outliers Detected", result.outliers_detected],
    ["Quality Score", result.quality_score],
    ["Execution Time (seconds)", result.execution_time_seconds],
    ["Summary", result.summary],
    ["AI Explanation", result.ai_explanation],
  ];
  for (const [metric, value] of reportRows) {
    if (value !== undefined && value !== null && value !== "") {
      reportSheet.addRow({ metric, value: String(value) });
    }
  }

  // --- Cleaning Log sheet ---
  const logSheet = workbook.addWorksheet("Cleaning Log");
  const logColumns: Array<{ header: string; key: string; width: number }> = [
    { header: "Action", key: "action", width: 28 },
    { header: "Description", key: "description", width: 36 },
    { header: "Details", key: "details", width: 48 },
    { header: "Rows Affected", key: "rows_affected", width: 16 },
    { header: "Status", key: "status", width: 14 },
    { header: "Reason", key: "reason", width: 36 },
  ];
  logSheet.columns = logColumns;

  const logHeaderRow = logSheet.getRow(1);
  logHeaderRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  logHeaderRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: `FF${accent}` },
  };

  const log = result.cleaning_log ?? [];
  for (const entry of log) {
    logSheet.addRow({
      action: entry.action ?? "",
      description: entry.description ?? "",
      details: entry.details ?? "",
      rows_affected: entry.rows_affected ?? 0,
      status: entry.status ?? "",
      reason: entry.reason ?? "",
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  triggerDownload(blob, `${fileName}.xlsx`);
}

// ============================================================
// SQL (.sql) from the raw backend cleaning result
// ============================================================

export function downloadSqlResult(result: UploadResultLike, fileName: string) {
  const lines: string[] = [];

  lines.push("-- Generated by OQZARO DataCleaning Agent");
  lines.push(`-- Date: ${new Date().toISOString()}`);
  lines.push(`-- File: ${fileName}`);
  lines.push("");

  const dtypes = result.column_data_types ?? {};
  const columns = Object.keys(dtypes);

  if (columns.length) {
    const colDefs = columns.map((col) => {
      const sqlType = mapDtypeToSql(dtypes[col]);
      const safeName = quoteIdentifier(col);
      return `  ${safeName} ${sqlType}`;
    });
    const safeTable = quoteIdentifier(
      fileName.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9_]/g, "_") ||
        "cleaned_data",
    );
    lines.push(`CREATE TABLE ${safeTable} (`);
    lines.push(colDefs.join(",\n"));
    lines.push(");");
    lines.push("");

    const sample = result.sample?.slice(0, 5) ?? [];
    if (sample.length) {
      const colNames = columns.map(quoteIdentifier).join(", ");
      lines.push(`INSERT INTO ${safeTable} (${colNames}) VALUES`);
      const valueRows = sample.map((row) => {
        const vals = columns.map((col) => formatSqlValue(row[col]));
        return `(${vals.join(", ")})`;
      });
      lines.push(valueRows.join(",\n") + ";");
      lines.push("");
    }
  } else {
    lines.push("-- No column data types available to generate schema.");
  }

  const blob = new Blob([lines.join("\n")], {
    type: "text/sql;charset=utf-8;",
  });
  triggerDownload(blob, `${fileName}.sql`);
}

function mapDtypeToSql(dtype: string): string {
  const lower = (dtype ?? "").toLowerCase();
  if (
    lower.includes("int") ||
    lower.includes("float") ||
    lower.includes("double")
  ) {
    return "REAL";
  }
  if (lower === "bool" || lower === "boolean") {
    return "INTEGER";
  }
  if (
    lower.includes("datetime") ||
    lower.includes("timestamp") ||
    lower.includes("date")
  ) {
    return "TIMESTAMP";
  }
  if (
    lower.includes("object") ||
    lower.includes("str") ||
    lower.includes("string")
  ) {
    return "TEXT";
  }
  return "TEXT";
}

function quoteIdentifier(name: string): string {
  const sanitized = name.replace(/"/g, '""');
  return `"${sanitized}"`;
}

function formatSqlValue(value: unknown): string {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "boolean") return value ? "1" : "0";
  if (typeof value === "number") return String(value);
  const stringValue = typeof value === "string" ? value : JSON.stringify(value);
  const escaped = (stringValue ?? "").replace(/'/g, "''");
  return `'${escaped}'`;
}

// ============================================================
// PowerPoint (.pptx) from the raw backend cleaning result
// ============================================================

export async function downloadPowerpointResult(
  result: UploadResultLike,
  fileName: string,
  color?: string,
) {
  const slides = buildSlidesForResult(result, fileName);
  const buffer = await buildPptx(slides, color);
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  });
  triggerDownload(blob, `${fileName}.pptx`);
}

type SlideDef = { title: string; bullets: string[] };

function buildSlidesForResult(
  result: UploadResultLike,
  fileName: string,
): SlideDef[] {
  const dateStr = new Date().toLocaleDateString();

  const slide1: SlideDef = {
    title: "OQZARO Data Analysis Report",
    bullets: [
      `File: ${fileName}`,
      `Date: ${dateStr}`,
      `Quality Score: ${result.quality_score ?? "N/A"}/100`,
    ],
  };

  const slide2: SlideDef = {
    title: "Summary Statistics",
    bullets: [
      `Rows before: ${result.rows_before ?? 0}`,
      `Rows after: ${result.rows_after ?? 0}`,
      `Duplicates removed: ${result.duplicates_removed ?? 0}`,
      `Missing values filled: ${result.missing_values_filled ?? 0}`,
      `Outliers detected: ${result.outliers_detected ?? 0}`,
      `Quality score: ${result.quality_score ?? 0}/100`,
      `Execution time: ${result.execution_time_seconds ?? 0}s`,
    ],
  };

  const slide3: SlideDef = {
    title: "AI Explanation",
    bullets: result.ai_explanation
      ? result.ai_explanation.split(/\n+/).filter(Boolean)
      : result.summary
        ? [result.summary]
        : ["No AI explanation available."],
  };

  const logEntries = result.cleaning_log ?? [];
  const slide4: SlideDef = {
    title: "Cleaning Log",
    bullets: logEntries.length
      ? logEntries.map((e) => {
          const status = e.status === "completed" ? "[x]" : "[ ]";
          const label = `${status} ${e.description || e.action || "Unknown"}`;
          return e.details ? `${label} — ${e.details}` : label;
        })
      : ["No cleaning operations recorded."],
  };

  const recs = result.recommendations ?? [];
  const slide5: SlideDef = {
    title: "Recommendations",
    bullets: recs.length ? recs : ["No recommendations at this time."],
  };

  return [slide1, slide2, slide3, slide4, slide5];
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

async function buildPptx(
  slides: SlideDef[],
  color?: string,
): Promise<ArrayBuffer> {
  const zip = new JSZip();
  const accentHex = (color ?? "#2B579A").replace("#", "").toUpperCase();

  const slideNumbers: number[] = [];

  for (let i = 0; i < slides.length; i++) {
    const slideNum = i + 1;
    const s = slides[i];
    const bodyParas = s.bullets
      .map(
        (b) =>
          `<a:p><a:pPr marL="342900" indent="-342900"><a:buChar char="\u2022"/></a:pPr><a:r><a:rPr lang="en-US" sz="1800" dirty="0"/><a:t>${escapeXml(b)}</a:t></a:r></a:p>`,
      )
      .join("");

    const bodyBody = bodyParas
      ? `<a:bodyPr/><a:lstStyle/>${bodyParas}`
      : `<a:bodyPr/><a:lstStyle/>`;

    const bodyShape = `<p:sp><p:nvSpPr><p:cNvPr id="2" name="Text Placeholder 2"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><a:ph type="obj"/></p:nvPr></p:nvSpPr><p:spPr><a:xfrm><a:off x="457200" y="1828800"/><a:ext cx="8229600" cy="3962400"/></a:xfrm></p:spPr><p:txBody>${bodyBody}</p:txBody></p:sp>`;

    const titleParas = s.title
      ? `<a:p><a:r><a:rPr lang="en-US" sz="2400" b="1" dirty="0"/><a:t>${escapeXml(s.title)}</a:t></a:r></a:p>`
      : `<a:p/>`;

    const titleShape = `<p:sp><p:nvSpPr><p:cNvPr id="1" name="Title 1"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><a:ph type="title"/></p:nvPr></p:nvSpPr><p:spPr><a:xfrm><a:off x="457200" y="365760"/><a:ext cx="8229600" cy="1143000"/></a:xfrm></p:spPr><p:txBody>${titleParas}<a:endParaRPr lang="en-US"/></p:txBody></p:sp>`;

    const slideXml = [
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
      '<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"',
      '  xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"',
      '  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">',
      "  <p:cSld>",
      `    <p:spTree>${titleShape}${bodyShape}</p:spTree>`,
      "  </p:cSld>",
      "  <p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>",
      "</p:sld>",
    ].join("\n");

    slideNumbers.push(slideNum);

    zip.file(`ppt/slides/slide${slideNum}.xml`, slideXml);
    zip.file(
      `ppt/slides/_rels/slide${slideNum}.xml.rels`,
      [
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">',
        '  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>',
        "</Relationships>",
      ].join("\n"),
    );
  }

  // --- Theme ---
  zip.file(
    "ppt/theme/theme1.xml",
    [
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
      '<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="OQZARO">',
      "  <a:themeElements>",
      '    <a:clrScheme name="OQZARO">',
      '      <a:dk1><a:srgbClr val="000000"/></a:dk1>',
      '      <a:lt1><a:srgbClr val="FFFFFF"/></a:lt1>',
      `      <a:dk2><a:srgbClr val=\"${accentHex}\"/></a:dk2>`,
      '      <a:lt2><a:srgbClr val="F2F2F2"/></a:lt2>',
      `      <a:accent1><a:srgbClr val=\"${accentHex}\"/></a:accent1>`,
      '      <a:accent2><a:srgbClr val="4472C4"/></a:accent2>',
      '      <a:accent3><a:srgbClr val="ED7D31"/></a:accent3>',
      '      <a:accent4><a:srgbClr val="A5A5A5"/></a:accent4>',
      '      <a:accent5><a:srgbClr val="FFC000"/></a:accent5>',
      '      <a:accent6><a:srgbClr val="5B9BD5"/></a:accent6>',
      '      <a:hlink><a:srgbClr val="0563C1"/></a:hlink>',
      '      <a:folHlink><a:srgbClr val="954F72"/></a:folHlink>',
      "    </a:clrScheme>",
      '    <a:fontScheme name="OQZARO">',
      '      <a:majorFont><a:latin typeface="Calibri"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont>',
      '      <a:minorFont><a:latin typeface="Calibri"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont>',
      "    </a:fontScheme>",
      '    <a:fmtScheme name="Office">',
      '      <a:fillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:fillStyleLst>',
      '      <a:lnStyleLst><a:ln w="9525"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln><a:ln w="9525"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln><a:ln w="9525"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln></a:lnStyleLst>',
      "      <a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst>",
      '      <a:bgFillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:bgFillStyleLst>',
      "    </a:fmtScheme>",
      "  </a:themeElements>",
      "</a:theme>",
    ].join("\n"),
  );

  // --- Slide master ---
  zip.file(
    "ppt/slideMasters/slideMaster1.xml",
    [
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
      '<p:sldMaster xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"',
      '  xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"',
      '  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">',
      "  <p:cSld>",
      '    <p:bg><p:bgRef idx="1001"><a:schemeClr val="bg1"/></p:bgRef></p:bg>',
      '    <p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/></p:spTree>',
      "  </p:cSld>",
      '  <p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>',
      "  <p:sldLayoutIdLst>",
      '    <p:sldLayoutId id="2147483649" r:id="rId1"/>',
      "  </p:sldLayoutIdLst>",
      "</p:sldMaster>",
    ].join("\n"),
  );

  zip.file(
    "ppt/slideMasters/_rels/slideMaster1.xml.rels",
    [
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">',
      '  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>',
      '  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="../theme/theme1.xml"/>',
      "</Relationships>",
    ].join("\n"),
  );

  // --- Slide layout (title layout) ---
  zip.file(
    "ppt/slideLayouts/slideLayout1.xml",
    [
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
      '<p:sldLayout xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"',
      '  xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"',
      '  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"',
      '  type="title" preserve="1">',
      '  <p:cSld name="Title Slide">',
      "    <p:spTree>",
      '      <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/>',
      "    </p:spTree>",
      "  </p:cSld>",
      "  <p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>",
      "</p:sldLayout>",
    ].join("\n"),
  );

  zip.file(
    "ppt/slideLayouts/_rels/slideLayout1.xml.rels",
    [
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">',
      '  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="../slideMasters/slideMaster1.xml"/>',
      "</Relationships>",
    ].join("\n"),
  );

  // --- Presentation.xml ---
  const slideIdEntries = slideNumbers
    .map((_, i) => `    <p:sldId id="${256 + i}" r:id="rId${i + 1}"/>`)
    .join("\n");

  const relEntries = slideNumbers
    .map(
      (num, i) =>
        `  <Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${num}.xml"/>`,
    )
    .join("\n");

  zip.file(
    "ppt/presentation.xml",
    [
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
      '<p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"',
      '  xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"',
      '  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">',
      "  <p:sldMasterIdLst>",
      '    <p:sldMasterId id="2147483648" r:id="rId1"/>',
      "  </p:sldMasterIdLst>",
      "  <p:sldIdLst>",
      slideIdEntries,
      "  </p:sldIdLst>",
      '  <p:sldSz cx="9144000" cy="6858000" type="screen4x3"/>',
      '  <p:notesSz cx="6858000" cy="9144000"/>',
      "</p:presentation>",
    ].join("\n"),
  );

  zip.file(
    "ppt/_rels/presentation.xml.rels",
    [
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">',
      '  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/>',
      relEntries,
      "</Relationships>",
    ].join("\n"),
  );

  // --- [Content_Types].xml ---
  const slideExtensions = slideNumbers
    .map(
      (num) =>
        `  <Override PartName="/ppt/slides/slide${num}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`,
    )
    .join("\n");

  zip.file(
    "[Content_Types].xml",
    [
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">',
      '  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>',
      '  <Default Extension="xml" ContentType="application/xml"/>',
      '  <Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>',
      '  <Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/>',
      '  <Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>',
      '  <Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>',
      slideExtensions,
      "</Types>",
    ].join("\n"),
  );

  // --- Root .rels ---
  zip.file(
    "_rels/.rels",
    [
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">',
      '  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>',
      "</Relationships>",
    ].join("\n"),
  );

  return zip.generateAsync({ type: "arraybuffer" }) as Promise<ArrayBuffer>;
}
