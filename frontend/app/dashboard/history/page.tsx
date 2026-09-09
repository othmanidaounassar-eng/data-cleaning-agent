"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Download,
  Trash2,
  FileSpreadsheet,
  Loader2,
  Star,
  FileDown,
  FileCode,
  Presentation,
  FileText,
} from "lucide-react";
import {
  SavedFileSummary,
  listFiles,
  deleteFile,
  triggerDownload,
  getFileReport,
} from "@/lib/user-files";
import { formatDate } from "@/lib/utils";
import { useAppSettings } from "@/components/providers/app-providers";
import {
  UploadResultLike,
  downloadExcelResult,
  downloadSqlResult,
  downloadPowerpointResult,
  downloadPdfFromUploadResult,
} from "@/lib/export-utils";

type ExportKind = "csv" | "excel" | "sql" | "ppt" | "pdf";

export default function HistoryPage() {
  const { t } = useAppSettings();
  const [files, setFiles] = useState<SavedFileSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState<Record<string, ExportKind | null>>(
    {},
  );

  const load = useCallback(async () => {
    setLoading(true);
    const data = await listFiles();
    setFiles(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleDelete = async (id: string) => {
    const ok = await deleteFile(id);
    if (ok) setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const handleDownload = async (f: SavedFileSummary) => {
    await triggerDownload(f.id, f.cleaned_file_name || "cleaned.csv");
  };

  const setBusy = (id: string, kind: ExportKind | null) =>
    setExporting((prev) => ({ ...prev, [id]: kind }));

  const getReport = async (id: string): Promise<UploadResultLike | null> => {
    const raw = await getFileReport(id);
    if (!raw) return null;
    return raw as unknown as UploadResultLike;
  };

  const handleExport = async (f: SavedFileSummary, kind: ExportKind) => {
    const name =
      f.cleaned_file_name || f.file_name.replace(/\.[^.]+$/, "") || "cleaned";
    if (kind === "csv") {
      await handleDownload(f);
      return;
    }
    setBusy(f.id, kind);
    try {
      const report = await getReport(f.id);
      if (!report) return;
      switch (kind) {
        case "excel":
          await downloadExcelResult(report, name);
          break;
        case "sql":
          downloadSqlResult(report, name);
          break;
        case "ppt":
          await downloadPowerpointResult(report, name);
          break;
        case "pdf":
          downloadPdfFromUploadResult(report, name);
          break;
      }
    } finally {
      setBusy(f.id, null);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div>
        <h1 className="text-xl font-bold tracking-tight">{t("hist.title")}</h1>
        <p className="text-sm text-white/60">{t("hist.subtitle")}</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-[#4f7cff]" />
        </div>
      ) : files.length === 0 ? (
        <div className="border border-white/10 rounded-3xl bg-white/[0.02] flex flex-col items-center justify-center py-16 text-center">
          <FileSpreadsheet className="h-10 w-10 text-white/30 mb-3" />
          <p className="text-sm font-medium">{t("hist.empty")}</p>
          <p className="text-xs text-white/50 mt-1">{t("hist.emptyDesc")}</p>
        </div>
      ) : (
        files.map((f) => (
          <div
            key={f.id}
            className="border border-white/10 rounded-2xl bg-white/[0.02] flex flex-col sm:flex-row sm:items-center gap-4 p-4 hover:border-[#4f7cff]/30 transition"
          >
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-[#4f7cff]/10 flex items-center justify-center shrink-0">
                <FileSpreadsheet className="w-5 h-5 text-[#4f7cff]" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium truncate">{f.file_name}</p>
                  {f.quality_score != null && (
                    <span className="flex items-center gap-1 text-xs font-semibold text-[#4f7cff] bg-[#4f7cff]/10 rounded-full px-2 py-0.5 shrink-0">
                      <Star className="w-3 h-3" /> {f.quality_score}/100
                    </span>
                  )}
                </div>
                <p className="text-xs text-white/50 mt-1">
                  {formatDate(new Date(f.created_at * 1000))} ·{" "}
                  {f.rows_before != null && f.rows_after != null
                    ? t("hist.rows", {
                        before: f.rows_before,
                        after: f.rows_after,
                      })
                    : ""}{" "}
                  {f.columns != null
                    ? `· ${t("hist.cols", { n: f.columns })}`
                    : ""}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
              {(
                [
                  { kind: "csv" as const, label: "CSV", icon: Download },
                  { kind: "excel" as const, label: "Excel", icon: FileDown },
                  { kind: "sql" as const, label: "SQL", icon: FileCode },
                  { kind: "ppt" as const, label: "PPT", icon: Presentation },
                  { kind: "pdf" as const, label: "PDF", icon: FileText },
                ] as const
              ).map(({ kind, label, icon: Icon }) => {
                const busy = exporting[f.id] === kind;
                return (
                  <button
                    key={kind}
                    onClick={() => handleExport(f, kind)}
                    disabled={busy}
                    title={label}
                    className="text-[#4f7cff] border border-[#4f7cff]/40 hover:bg-[#4f7cff]/10 rounded-xl px-2.5 py-2 text-xs font-medium flex items-center gap-1 transition disabled:opacity-50"
                  >
                    {busy ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Icon className="w-3.5 h-3.5" />
                    )}
                    {label}
                  </button>
                );
              })}
              <button
                onClick={() => handleDelete(f.id)}
                title={t("hist.delete")}
                className="text-white/50 hover:text-red-500 rounded-xl px-2.5 py-2 transition"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

export const dynamic = "force-dynamic";
