"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ClipboardList,
  Loader2,
  FileJson,
  Send,
  Check,
  AlertTriangle,
  FileText,
  ShieldCheck,
  TrendingDown,
  BarChart3,
  Sparkles,
  FileUp,
  Download,
  Lightbulb,
  Activity,
  Table2,
  Paperclip,
  Wand2,
  FileDown,
  FileCode,
  Presentation,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
} from "recharts";
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";
import { SavedFileSummary, listFiles, getFileReport } from "@/lib/user-files";
import { formatDate } from "@/lib/utils";
import { authHeaders } from "@/lib/auth";
import { useAppSettings } from "@/components/providers/app-providers";
import {
  UploadResultLike,
  downloadExcelResult,
  downloadSqlResult,
  downloadPowerpointResult,
} from "@/lib/export-utils";

interface LogEntry {
  action?: string;
  description?: string;
  status?: string;
  rows_affected?: number;
  reason?: string;
  details?: string;
}

interface StoredReport {
  source_file_name?: string;
  rows_before?: number;
  rows_after?: number;
  quality_score?: number;
  execution_time_seconds?: number;
  duplicates_removed?: number;
  missing_values_filled?: number;
  outliers_detected?: number;
  summary?: string;
  ai_explanation?: string;
  cleaning_log?: LogEntry[];
  recommendations?: string[];
  alerts?: string[];
  declined?: Array<{ action?: string; description?: string; reason?: string }>;
  cleaned_file_name?: string;
  column_data_types?: Record<string, string>;
}

const BAR_COLORS = [
  "#34d399",
  "#60a5fa",
  "#4f7cff",
  "#a78bfa",
  "#fbbf24",
  "#f472b6",
];
const PIE_COLORS = [
  "#60a5fa",
  "#34d399",
  "#4f7cff",
  "#a78bfa",
  "#fbbf24",
  "#f472b6",
  "#22d3ee",
  "#f87171",
];

type RGB = [number, number, number];
interface TemplateDef {
  id: string;
  name: string;
  primary: RGB;
  accent: RGB;
  bg: RGB;
  chip: string;
}

const TEMPLATES: TemplateDef[] = [
  {
    id: "professional",
    name: "rep.tpl.professional",
    primary: [79, 124, 255],
    accent: [139, 92, 246],
    bg: [10, 15, 30],
    chip: "linear-gradient(135deg,#4f7cff,#8b5cf6)",
  },
  {
    id: "navy",
    name: "rep.tpl.navy",
    primary: [96, 165, 250],
    accent: [147, 197, 253],
    bg: [10, 16, 32],
    chip: "linear-gradient(135deg,#3b82f6,#60a5fa)",
  },
  {
    id: "emerald",
    name: "rep.tpl.emerald",
    primary: [52, 211, 153],
    accent: [110, 231, 183],
    bg: [8, 20, 18],
    chip: "linear-gradient(135deg,#10b981,#34d399)",
  },
  {
    id: "royal",
    name: "rep.tpl.royal",
    primary: [167, 139, 250],
    accent: [196, 181, 253],
    bg: [16, 12, 26],
    chip: "linear-gradient(135deg,#8b5cf6,#a78bfa)",
  },
];

function TemplatePicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (t: string) => void;
}) {
  const { t } = useAppSettings();
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm text-white/60 flex items-center gap-1.5 mr-1">
        <Wand2 className="w-4 h-4 text-[#4f7cff]" /> {t("rep.templateLabel")}:
      </span>
      {TEMPLATES.map((tpl) => (
        <button
          key={tpl.id}
          onClick={() => onChange(tpl.id)}
          title={t(tpl.name)}
          className={`w-9 h-9 rounded-xl border-2 transition flex items-center justify-center ${
            value === tpl.id
              ? "border-white shadow-lg scale-105"
              : "border-white/15 opacity-70 hover:opacity-100"
          }`}
          style={{ background: tpl.chip }}
        >
          {value === tpl.id && <Check className="w-4 h-4 text-white" />}
        </button>
      ))}
      <span className="text-xs text-white/40">
        {t(TEMPLATES.find((tpl) => tpl.id === value)?.name || "")}
      </span>
    </div>
  );
}

function buildPdfFromNode(
  node: HTMLElement,
  title: string,
  template: TemplateDef,
  fileName: string,
) {
  const canvas = html2canvas(node, {
    scale: 2,
    useCORS: true,
    backgroundColor: "#0b101d",
    logging: false,
  });
  return canvas.then((c) => {
    const imgData = c.toDataURL("image/png");
    const doc = new jsPDF("p", "mm", "a4");
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 10;
    const imgWidth = pageWidth - margin * 2;
    const imgHeight = (c.height * imgWidth) / c.width;

    // Cover page using template colors
    const [r, g, b] = template.bg;
    doc.setFillColor(r, g, b);
    doc.rect(0, 0, pageWidth, pageHeight, "F");
    const [pr, pg, pb] = template.primary;
    doc.setTextColor(pr, pg, pb);
    doc.setFontSize(26);
    doc.setFont("helvetica", "bold");
    doc.text("OQZARO DataAnalyzer Agent", pageWidth / 2, 70, {
      align: "center",
    });
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.text(title, pageWidth / 2, 92, { align: "center" });
    doc.setFontSize(11);
    doc.setTextColor(180);
    doc.text(new Date().toLocaleString(), pageWidth / 2, 112, {
      align: "center",
    });
    const [ar, ag, ab] = template.accent;
    doc.setDrawColor(ar, ag, ab);
    doc.setLineWidth(1);
    doc.line(pageWidth / 2 - 40, 124, pageWidth / 2 + 40, 124);

    // Content pages
    doc.addPage();
    let offset = 0;
    const totalPages = Math.ceil(imgHeight / pageHeight) + 1;
    for (let i = 0; i < totalPages; i++) {
      if (i > 0) doc.addPage();
      doc.addImage(
        imgData,
        "PNG",
        margin,
        -offset + margin,
        imgWidth,
        imgHeight,
        undefined,
        "FAST",
      );
      offset += pageHeight - margin * 2;
      doc.setFontSize(8);
      doc.setTextColor(120);
      doc.text(
        `Generated by OQZARO • Page ${i + 1}`,
        pageWidth / 2,
        pageHeight - 4,
        { align: "center" },
      );
    }
    doc.save(`${fileName}.pdf`);
  });
}

export default function ReportsPage() {
  const { t } = useAppSettings();
  const [files, setFiles] = useState<SavedFileSummary[]>([]);
  const [reports, setReports] = useState<Record<string, StoredReport>>({});
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState<string | null>(null);
  const [formatExporting, setFormatExporting] = useState<
    Record<string, string | null>
  >({});
  const [template, setTemplate] = useState("professional");
  const reportRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const load = useCallback(async () => {
    const data = await listFiles();
    setFiles(data);
    const map: Record<string, StoredReport> = {};
    for (const f of data) {
      const report = await getFileReport(f.id);
      if (report) map[f.id] = report as StoredReport;
    }
    setReports(map);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const downloadJson = (report: StoredReport) => {
    const blob = new Blob([JSON.stringify(report, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${report.source_file_name || "report"}.json`;
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const exportPdf = async (id: string, report: StoredReport) => {
    setExporting(id);
    try {
      const node = reportRefs.current.get(id);
      if (!node) throw new Error("no node");
      const tpl = TEMPLATES.find((x) => x.id === template) || TEMPLATES[0];
      await buildPdfFromNode(
        node,
        t("rep.pdfTitle"),
        tpl,
        report.source_file_name || "report",
      );
    } catch {
      downloadSimplePdf(report);
    } finally {
      setExporting(null);
    }
  };

  const downloadSimplePdf = (report: StoredReport) => {
    const doc = new jsPDF();
    const marginX = 18;
    let y = 20;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text("OQZARO AI Data Analysis Report", marginX, y);
    y += 10;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(90);
    doc.text(
      `${report.source_file_name || "cleaned"} • ${new Date().toLocaleString()}`,
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
    const lines = [
      `Rows: ${report.rows_before ?? 0} -> ${report.rows_after ?? 0}`,
      `Duplicates removed: ${report.duplicates_removed ?? 0}`,
      `Missing values filled: ${report.missing_values_filled ?? 0}`,
      `Outliers detected: ${report.outliers_detected ?? 0}`,
      `Quality score: ${report.quality_score ?? 0}/100`,
      `Execution time: ${report.execution_time_seconds ?? 0}s`,
    ];
    for (const line of lines) {
      doc.text(line, marginX, y);
      y += 6;
    }
    if (report.ai_explanation) {
      y += 4;
      doc.setFont("helvetica", "bold");
      doc.text("AI Explanation", marginX, y);
      y += 7;
      doc.setFont("helvetica", "normal");
      for (const para of doc.splitTextToSize(report.ai_explanation, 175)) {
        doc.text(para, marginX, y);
        y += 6;
      }
    }
    doc.save(`${report.source_file_name || "report"}.pdf`);
  };

  const exportFormat = async (
    id: string,
    report: StoredReport,
    kind: "excel" | "sql" | "ppt",
  ) => {
    const name =
      report.cleaned_file_name ||
      report.source_file_name?.replace(/\.[^.]+$/, "") ||
      "report";
    setFormatExporting((prev) => ({ ...prev, [id]: kind }));
    try {
      const result = report as unknown as UploadResultLike;
      switch (kind) {
        case "excel":
          await downloadExcelResult(result, name);
          break;
        case "sql":
          downloadSqlResult(result, name);
          break;
        case "ppt":
          await downloadPowerpointResult(result, name);
          break;
      }
    } finally {
      setFormatExporting((prev) => ({ ...prev, [id]: null }));
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight">{t("rep.title")}</h1>
        <p className="text-sm text-white/60">{t("rep.subtitle")}</p>
      </div>

      {/* Template picker + comprehensive report builder */}
      <div className="border border-white/10 rounded-3xl bg-white/[0.02] p-5 space-y-5">
        <TemplatePicker value={template} onChange={setTemplate} />
        <AnalysisReportBuilder template={template} />
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-[#4f7cff]" />
        </div>
      ) : files.length === 0 ? (
        <div className="border border-white/10 rounded-3xl bg-white/[0.02] flex flex-col items-center justify-center py-16 text-center">
          <ClipboardList className="h-10 w-10 text-white/30 mb-3" />
          <p className="text-sm font-medium">{t("rep.emptyTitle")}</p>
          <p className="text-xs text-white/50 mt-1">{t("rep.emptyDesc")}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(reports).map(([id, r]) => {
            const summary = files.find((f) => f.id === id);
            return (
              <div
                key={id}
                ref={(el) => {
                  if (el) reportRefs.current.set(id, el);
                }}
                className="border border-white/10 rounded-3xl bg-white/[0.02] overflow-hidden"
              >
                {/* Header */}
                <div className="px-5 py-4 border-b border-white/10 flex items-center gap-3 flex-wrap">
                  <div className="w-10 h-10 rounded-xl bg-[#4f7cff]/10 flex items-center justify-center shrink-0">
                    <ClipboardList className="w-5 h-5 text-[#4f7cff]" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">
                      {r.source_file_name ||
                        r.cleaned_file_name ||
                        t("rep.reportFallback")}
                    </p>
                    <p className="text-xs text-white/50">
                      {summary?.created_at
                        ? formatDate(new Date(summary.created_at * 1000))
                        : ""}
                    </p>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <button
                      onClick={() => exportPdf(id, r)}
                      disabled={exporting === id}
                      className="text-white border border-white/15 hover:border-[#4f7cff]/50 hover:bg-[#4f7cff]/10 rounded-xl px-3 py-2 text-sm flex items-center gap-1.5 transition disabled:opacity-50"
                    >
                      {exporting === id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <FileText className="w-4 h-4" />
                      )}
                      PDF
                    </button>
                    <button
                      onClick={() => downloadJson(r)}
                      className="text-[#4f7cff] border border-[#4f7cff]/40 hover:bg-[#4f7cff]/10 rounded-xl px-3 py-2 text-sm flex items-center gap-1.5 transition"
                    >
                      <FileJson className="w-4 h-4" /> JSON
                    </button>
                    <button
                      onClick={() => exportFormat(id, r, "excel")}
                      disabled={formatExporting[id] === "excel"}
                      className="text-[#4f7cff] border border-[#4f7cff]/40 hover:bg-[#4f7cff]/10 rounded-xl px-3 py-2 text-sm flex items-center gap-1.5 transition disabled:opacity-50"
                    >
                      {formatExporting[id] === "excel" ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <FileDown className="w-4 h-4" />
                      )}
                      Excel
                    </button>
                    <button
                      onClick={() => exportFormat(id, r, "sql")}
                      disabled={formatExporting[id] === "sql"}
                      className="text-[#4f7cff] border border-[#4f7cff]/40 hover:bg-[#4f7cff]/10 rounded-xl px-3 py-2 text-sm flex items-center gap-1.5 transition disabled:opacity-50"
                    >
                      {formatExporting[id] === "sql" ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <FileCode className="w-4 h-4" />
                      )}
                      SQL
                    </button>
                    <button
                      onClick={() => exportFormat(id, r, "ppt")}
                      disabled={formatExporting[id] === "ppt"}
                      className="text-[#4f7cff] border border-[#4f7cff]/40 hover:bg-[#4f7cff]/10 rounded-xl px-3 py-2 text-sm flex items-center gap-1.5 transition disabled:opacity-50"
                    >
                      {formatExporting[id] === "ppt" ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Presentation className="w-4 h-4" />
                      )}
                      PPT
                    </button>
                  </div>
                </div>

                <div className="p-5 space-y-5">
                  {/* Key stats */}
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    <StatCard
                      label={t("rep.rowsBefore")}
                      value={r.rows_before ?? "—"}
                      accent="text-white"
                    />
                    <StatCard
                      label={t("rep.rowsAfter")}
                      value={r.rows_after ?? "—"}
                      accent="text-emerald-400"
                    />
                    <StatCard
                      label={t("rep.duplicates")}
                      value={r.duplicates_removed ?? 0}
                      accent="text-amber-400"
                    />
                    <StatCard
                      label={t("rep.missing")}
                      value={r.missing_values_filled ?? 0}
                      accent="text-red-400"
                    />
                    <StatCard
                      label={t("rep.outliers")}
                      value={r.outliers_detected ?? 0}
                      accent="text-purple-400"
                    />
                  </div>

                  {/* Quality + timing */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Quality gauge */}
                    <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-4 flex items-center gap-4">
                      <div className="relative w-24 h-24 shrink-0">
                        <svg
                          viewBox="0 0 100 100"
                          className="w-full h-full -rotate-90"
                        >
                          <circle
                            cx="50"
                            cy="50"
                            r="42"
                            fill="none"
                            stroke="rgba(255,255,255,0.08)"
                            strokeWidth="10"
                          />
                          <circle
                            cx="50"
                            cy="50"
                            r="42"
                            fill="none"
                            stroke={
                              (r.quality_score ?? 0) >= 80
                                ? "#34d399"
                                : (r.quality_score ?? 0) >= 50
                                  ? "#4f7cff"
                                  : "#ef4444"
                            }
                            strokeWidth="10"
                            strokeLinecap="round"
                            strokeDasharray={`${((r.quality_score ?? 0) / 100) * 264} 264`}
                          />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                          <span className="text-xl font-bold">
                            {r.quality_score ?? "—"}
                          </span>
                          <span className="text-[9px] text-white/50">
                            {t("rep.of100")}
                          </span>
                        </div>
                      </div>
                      <div>
                        <p className="text-sm font-semibold flex items-center gap-1.5 mb-1">
                          <ShieldCheck className="w-4 h-4 text-emerald-400" />{" "}
                          {t("rep.quality")}
                        </p>
                        <p className="text-xs text-white/50 leading-relaxed">
                          {(r.quality_score ?? 0) >= 80
                            ? t("rep.qualityExcellent")
                            : (r.quality_score ?? 0) >= 60
                              ? t("rep.qualityGood")
                              : (r.quality_score ?? 0) >= 40
                                ? t("rep.qualityMedium")
                                : t("rep.qualityPoor")}
                        </p>
                      </div>
                    </div>

                    {/* Rows comparison chart */}
                    <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-4">
                      <p className="text-sm font-semibold flex items-center gap-1.5 mb-2">
                        <TrendingDown className="w-4 h-4 text-amber-400" />{" "}
                        {t("rep.rowsComparison")}
                      </p>
                      <div className="h-28">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart
                            data={[
                              {
                                name: t("rep.rowsBefore"),
                                count: r.rows_before ?? 0,
                              },
                              {
                                name: t("rep.rowsAfter"),
                                count: r.rows_after ?? 0,
                              },
                            ]}
                          >
                            <XAxis
                              dataKey="name"
                              stroke="rgba(255,255,255,0.3)"
                              fontSize={11}
                            />
                            <YAxis
                              stroke="rgba(255,255,255,0.3)"
                              fontSize={10}
                            />
                            <Tooltip
                              contentStyle={{
                                background: "rgba(10,15,30,0.95)",
                                border: "1px solid rgba(255,255,255,0.15)",
                                borderRadius: 12,
                                fontSize: 12,
                              }}
                            />
                            <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                              <Cell fill="rgba(255,255,255,0.25)" />
                              <Cell fill="#34d399" />
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>

                  {/* Cleaning operations chart */}
                  {Array.isArray(r.cleaning_log) &&
                    r.cleaning_log.length > 0 && (
                      <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-4">
                        <p className="text-sm font-semibold flex items-center gap-1.5 mb-2">
                          <BarChart3 className="w-4 h-4 text-[#4f7cff]" />{" "}
                          {t("rep.operations")}
                        </p>
                        <div className="h-40">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                              data={r.cleaning_log.map((log) => ({
                                name: (
                                  log.description ||
                                  log.action ||
                                  t("rep.operationFallback")
                                ).slice(0, 22),
                                rows: log.rows_affected ?? 0,
                                status:
                                  log.status === "skipped" ||
                                  log.status === "declined"
                                    ? "skipped"
                                    : "done",
                              }))}
                              layout="vertical"
                              margin={{ left: 8 }}
                            >
                              <XAxis
                                type="number"
                                stroke="rgba(255,255,255,0.3)"
                                fontSize={10}
                              />
                              <YAxis
                                type="category"
                                dataKey="name"
                                width={140}
                                stroke="rgba(255,255,255,0.3)"
                                fontSize={9}
                              />
                              <Tooltip
                                contentStyle={{
                                  background: "rgba(10,15,30,0.95)",
                                  border: "1px solid rgba(255,255,255,0.15)",
                                  borderRadius: 12,
                                  fontSize: 12,
                                }}
                              />
                              <Bar dataKey="rows" radius={[0, 6, 6, 0]}>
                                {r.cleaning_log.map((log, i) => (
                                  <Cell
                                    key={i}
                                    fill={
                                      log.status === "skipped" ||
                                      log.status === "declined"
                                        ? "rgba(251,191,36,0.35)"
                                        : BAR_COLORS[i % BAR_COLORS.length]
                                    }
                                  />
                                ))}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    )}

                  {r.summary && (
                    <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-4 text-sm text-emerald-200">
                      {r.summary}
                    </div>
                  )}

                  {r.ai_explanation && (
                    <div className="bg-purple-500/5 border border-purple-500/20 rounded-2xl p-4">
                      <p className="text-sm font-semibold flex items-center gap-1.5 mb-1.5 text-purple-300">
                        <Sparkles className="w-4 h-4" />{" "}
                        {t("rep.aiExplanation")}
                      </p>
                      <p className="text-sm text-white/80 leading-relaxed">
                        {r.ai_explanation}
                      </p>
                    </div>
                  )}

                  {/* Cleaning log */}
                  {Array.isArray(r.cleaning_log) &&
                    r.cleaning_log.length > 0 && (
                      <div>
                        <h3 className="text-sm font-semibold mb-2 text-white/70">
                          {t("rep.log")}
                        </h3>
                        <div className="space-y-2">
                          {r.cleaning_log.map((log, i) => (
                            <div
                              key={i}
                              className="flex items-start gap-2 text-sm bg-white/[0.02] rounded-xl p-3"
                            >
                              {log.status === "skipped" ||
                              log.status === "declined" ? (
                                <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
                              ) : (
                                <Check className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                              )}
                              <div>
                                <div className="font-medium">
                                  {log.description || log.action}
                                </div>
                                {log.rows_affected != null && (
                                  <div className="text-xs text-white/50">
                                    {t("rep.rowsAffected", {
                                      n: log.rows_affected,
                                    })}
                                  </div>
                                )}
                                {log.reason && (
                                  <div className="text-xs text-white/40 mt-0.5">
                                    {log.reason}
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                  {/* Column data types */}
                  {r.column_data_types &&
                    Object.keys(r.column_data_types).length > 0 && (
                      <div>
                        <h3 className="text-sm font-semibold mb-2 text-white/70">
                          {t("rep.columnTypes")}
                        </h3>
                        <div className="flex flex-wrap gap-1.5">
                          {Object.entries(r.column_data_types).map(
                            ([col, type]) => (
                              <span
                                key={col}
                                className="text-xs bg-white/[0.04] border border-white/10 rounded-full px-2.5 py-1"
                              >
                                <span className="text-white/70">{col}</span>
                                <span className="text-white/35">: {type}</span>
                              </span>
                            ),
                          )}
                        </div>
                      </div>
                    )}

                  {/* Recommendations */}
                  {Array.isArray(r.recommendations) &&
                    r.recommendations.length > 0 && (
                      <div>
                        <h3 className="text-sm font-semibold mb-2 text-white/70">
                          {t("rep.recommendations")}
                        </h3>
                        <ul className="space-y-1.5">
                          {r.recommendations.map((rec, i) => (
                            <li
                              key={i}
                              className="flex items-start gap-2 text-sm text-white/80"
                            >
                              <Send className="w-4 h-4 text-[#4f7cff] mt-0.5 shrink-0" />
                              {rec}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                  {/* Declined operations */}
                  {Array.isArray(r.declined) && r.declined.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold mb-2 text-white/70">
                        {t("rep.declined")}
                      </h3>
                      <div className="space-y-1.5">
                        {r.declined.map((d, i) => (
                          <div
                            key={i}
                            className="flex items-start gap-2 text-sm text-white/60 bg-white/[0.02] rounded-xl p-3"
                          >
                            <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
                            <div>
                              <div className="font-medium">
                                {d.description || d.action}
                              </div>
                              {d.reason && (
                                <div className="text-xs text-white/40">
                                  {d.reason}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Alerts */}
                  {Array.isArray(r.alerts) && r.alerts.length > 0 && (
                    <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-4 space-y-1.5">
                      <h3 className="text-sm font-semibold text-red-300">
                        {t("rep.alerts")}
                      </h3>
                      {r.alerts.map((a, i) => (
                        <p key={i} className="text-sm text-red-200/80">
                          {a}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

interface ColumnStat {
  name: string;
  dtype: string;
  nulls: number;
  complete_percentage: number;
  unique_count?: number | null;
  histogram?: { bin: string; count: number }[];
  is_numeric?: boolean;
}

interface AnalysisPayload {
  rows: number;
  column_count: number;
  total_nulls: number;
  total_duplicates: number;
  numeric_columns: number;
  columns: ColumnStat[];
  correlation: { row: string; col: string; value: number }[];
  insights?: string[];
  recommendations?: string[];
  scatter?: {
    x_col: string;
    y_col: string;
    points: { x: number; y: number }[];
  }[];
  ai_explanation?: string;
  kpis?: { [k: string]: unknown };
  sample?: Array<Record<string, unknown>>;
}

function AnalysisReportBuilder({ template }: { template: string }) {
  const { t } = useAppSettings();
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<AnalysisPayload | null>(null);
  const [exporting, setExporting] = useState(false);
  const nodeRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const run = async () => {
    if (!file || loading) return;
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/analyze-data", {
        method: "POST",
        headers: authHeaders(),
        body: form,
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || data.detail || t("rep.builderError"));
      } else {
        setResult(data as AnalysisPayload);
      }
    } catch {
      setError(t("rep.builderConnFailed"));
    } finally {
      setLoading(false);
    }
  };

  const exportPdf = async () => {
    if (!nodeRef.current || exporting) return;
    setExporting(true);
    try {
      const tpl = TEMPLATES.find((x) => x.id === template) || TEMPLATES[0];
      await buildPdfFromNode(
        nodeRef.current,
        t("rep.builderPdfTitle"),
        tpl,
        `${file?.name || "analysis"}-report`,
      );
    } catch {
      setError(t("rep.exportPdfFailed"));
    } finally {
      setExporting(false);
    }
  };

  const numericCols =
    result?.columns.filter((c) => c.is_numeric && c.histogram?.length) || [];
  const catCols =
    result && result.sample
      ? result.columns
          .filter(
            (c) => !c.is_numeric && c.unique_count && c.unique_count! <= 12,
          )
          .slice(0, 2)
      : [];
  const kpis = result?.kpis ?? {};

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#34d399] to-[#22d3ee] flex items-center justify-center shrink-0">
          <Wand2 className="w-5 h-5 text-white" />
        </div>
        <div>
          <h2 className="font-semibold flex items-center gap-2">
            {t("rep.builderTitle")}
          </h2>
          <p className="text-xs text-white/50">{t("rep.builderDesc")}</p>
        </div>
      </div>

      <div
        className="border-2 border-dashed border-emerald-400/40 rounded-2xl p-6 text-center cursor-pointer hover:bg-emerald-400/5 transition"
        onClick={() => inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.xlsx,.xls,.pdf"
          className="hidden"
          onChange={(e) => {
            setFile(e.target.files?.[0] || null);
            setResult(null);
            setError("");
          }}
        />
        <Paperclip className="h-9 w-9 text-emerald-400 mx-auto mb-2" />
        <p className="font-medium text-sm">
          {file ? file.name : t("rep.builderDrop")}
        </p>
      </div>

      <div className="flex gap-3">
        <button
          onClick={run}
          disabled={!file || loading}
          className="flex-1 bg-gradient-to-r from-[#34d399] to-[#22d3ee] hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium px-5 py-2.5 rounded-xl flex items-center justify-center gap-2 transition shadow-lg shadow-emerald-500/20"
        >
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />{" "}
              {t("rep.builderGenerating")}
            </>
          ) : (
            <>
              <FileUp className="w-5 h-5" /> {t("rep.builderGenerate")}
            </>
          )}
        </button>
        {result && (
          <button
            onClick={exportPdf}
            disabled={exporting}
            className="border border-[#4f7cff]/40 text-[#4f7cff] hover:bg-[#4f7cff]/10 rounded-xl px-5 py-2.5 text-sm flex items-center gap-2 transition disabled:opacity-50"
          >
            {exporting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            {t("rep.builderExportPdf")}
          </button>
        )}
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm px-4 py-3 rounded-2xl">
          {error}
        </div>
      )}

      {result && (
        <div
          ref={nodeRef}
          className="border border-white/10 rounded-3xl bg-[#0b101d] p-5 space-y-6"
        >
          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard
              label={t("rep.rows")}
              value={result.rows}
              accent="text-white"
            />
            <StatCard
              label={t("rep.columns")}
              value={result.column_count}
              accent="text-sky-400"
            />
            <StatCard
              label={t("rep.missingValues")}
              value={result.total_nulls}
              accent="text-red-400"
            />
            <StatCard
              label={t("rep.duplicateRows")}
              value={result.total_duplicates}
              accent="text-amber-400"
            />
          </div>

          {Object.keys(kpis).length > 0 && (
            <div className="flex flex-wrap gap-3">
              {Object.entries(kpis).map(([k, v]) => (
                <div
                  key={k}
                  className="bg-white/[0.03] border border-white/5 rounded-xl px-3 py-2"
                >
                  <div className="text-sm font-bold">{k}</div>
                  <div className="text-xs text-white/60">{String(v)}</div>
                </div>
              ))}
            </div>
          )}

          {result.ai_explanation && (
            <div className="bg-purple-500/5 border border-purple-500/20 rounded-2xl p-4">
              <p className="text-sm font-semibold flex items-center gap-1.5 mb-1.5 text-purple-300">
                <Sparkles className="w-4 h-4" /> {t("rep.aiExplanation")}
              </p>
              <p className="text-sm text-white/80 leading-relaxed">
                {result.ai_explanation}
              </p>
            </div>
          )}

          {result.recommendations && result.recommendations.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold mb-2 text-white/70 flex items-center gap-1.5">
                <Lightbulb className="w-4 h-4 text-amber-400" />{" "}
                {t("rep.recsTitle")}
              </h3>
              <ul className="space-y-1.5">
                {result.recommendations.map((rec, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 text-sm text-white/80"
                  >
                    <Send className="w-4 h-4 text-[#4f7cff] mt-0.5 shrink-0" />
                    {rec}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {result.insights && result.insights.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold mb-2 text-white/70 flex items-center gap-1.5">
                <Activity className="w-4 h-4 text-[#4f7cff]" />{" "}
                {t("rep.insightsTitle")}
              </h3>
              <ul className="space-y-1.5">
                {result.insights.map((ins, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 text-sm text-white/80"
                  >
                    <Sparkles className="w-4 h-4 text-cyan-400 mt-0.5 shrink-0" />
                    {ins}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Histograms */}
          {numericCols.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {numericCols.slice(0, 4).map((col) => (
                <div
                  key={col.name}
                  className="bg-white/[0.03] border border-white/5 rounded-2xl p-4"
                >
                  <p className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                    <BarChart3 className="w-4 h-4 text-[#4f7cff]" />{" "}
                    {t("rep.distributionOf", { col: col.name })}
                  </p>
                  <div className="h-40">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={col.histogram ?? []}>
                        <XAxis
                          dataKey="bin"
                          stroke="rgba(255,255,255,0.3)"
                          fontSize={9}
                        />
                        <YAxis stroke="rgba(255,255,255,0.3)" fontSize={10} />
                        <Tooltip
                          contentStyle={{
                            background: "rgba(10,15,30,0.95)",
                            border: "1px solid rgba(255,255,255,0.15)",
                            borderRadius: 12,
                            fontSize: 12,
                          }}
                        />
                        <Bar
                          dataKey="count"
                          fill="#34d399"
                          radius={[4, 4, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Categorical pies */}
          {catCols.length > 0 &&
            catCols.map((col) => {
              const counts: Record<string, number> = {};
              result.sample?.forEach((row) => {
                const v = String(row[col.name] ?? t("rep.emptyCell"));
                counts[v] = (counts[v] || 0) + 1;
              });
              const data = Object.entries(counts)
                .slice(0, 8)
                .map(([name, count]) => ({ name, count }));
              return (
                <div
                  key={col.name}
                  className="bg-white/[0.03] border border-white/5 rounded-2xl p-4"
                >
                  <p className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                    <Table2 className="w-4 h-4 text-sky-400" />{" "}
                    {t("rep.distributionOf", { col: col.name })}
                  </p>
                  <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={data}
                          dataKey="count"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          outerRadius={70}
                          label={({ name, count }) => `${name} (${count})`}
                          fontSize={10}
                        >
                          {data.map((_, i) => (
                            <Cell
                              key={i}
                              fill={PIE_COLORS[i % PIE_COLORS.length]}
                            />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{
                            background: "rgba(10,15,30,0.95)",
                            border: "1px solid rgba(255,255,255,0.15)",
                            borderRadius: 12,
                            fontSize: 12,
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              );
            })}

          {/* Correlation heatmap */}
          {result.correlation.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold mb-2 text-white/70 flex items-center gap-1.5">
                <BarChart3 className="w-4 h-4 text-cyan-400" />{" "}
                {t("rep.correlationTitle")}
              </h3>
              <div className="overflow-x-auto">
                <div className="min-w-[360px]">
                  {result.correlation.map((c) => (
                    <div
                      key={`${c.row}${c.col}`}
                      className="flex items-center gap-2 mb-1.5 text-xs"
                    >
                      <span className="w-36 truncate text-white/60 text-right">
                        {c.row} ↔ {c.col}
                      </span>
                      <div className="flex-1 h-4 rounded-full bg-white/[0.06] overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${Math.min(100, Math.abs(c.value) * 100)}%`,
                            background:
                              c.value < 0
                                ? `rgba(239,68,68,${0.3 + Math.abs(c.value) * 0.7})`
                                : `rgba(52,211,153,${0.3 + c.value * 0.7})`,
                          }}
                        />
                      </div>
                      <span className="w-12 text-right tabular-nums text-white/70">
                        {c.value.toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string | number;
  accent: string;
}) {
  return (
    <div className="bg-white/[0.03] border border-white/5 rounded-xl p-3">
      <div className={`text-lg font-bold ${accent}`}>{value}</div>
      <div className="text-xs text-white/50">{label}</div>
    </div>
  );
}

export const dynamic = "force-dynamic";
