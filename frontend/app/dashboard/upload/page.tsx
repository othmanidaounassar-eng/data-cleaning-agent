"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  UploadCloud,
  Download,
  FileText,
  FileJson,
  Loader2,
  MessageSquare,
  ShieldCheck,
  Layers,
  Check,
  Wrench,
  Zap,
  FileSpreadsheet,
  Database,
  Presentation,
} from "lucide-react";
import { API_ENDPOINTS } from "@/lib/api";
import { authHeaders } from "@/lib/auth";
import { saveChatContext } from "@/lib/chat";
import { buildUploadPayload, cleanFileViaUpload } from "@/lib/upload-utils";
import {
  downloadPdfFromUploadResult,
  UploadResultLike,
  downloadExcelResult,
  downloadSqlResult,
  downloadPowerpointResult,
} from "@/lib/export-utils";
import { useAppSettings } from "@/components/providers/app-providers";
import { useUploadSession } from "@/components/providers/upload-session-provider";
import { useWorkspaces } from "@/components/providers/workspace-provider";

// ============================================
// ✅ تعريف الواجهة الكاملة للنتيجة
// ============================================
interface CleaningResult extends UploadResultLike {
  download_url?: string;
  cleaned_file_name?: string;
  sample?: Array<Record<string, unknown>>;
  column_data_types?: Record<string, string>;
}

interface PlanItem {
  id: string;
  action?: string;
  description: string;
  details?: string;
  rows_affected?: number;
  side?: "clean" | "keep";
  reason?: string;
  run?: boolean;
  target?: string;
}

type Mode = "auto" | "manual" | "full";
type FileStatus =
  | "ready"
  | "analyzing"
  | "planning"
  | "cleaning"
  | "done"
  | "error";

// A single file entry selected by the user
interface SelectedFile {
  id: string;
  file: File;
  status: FileStatus;
  result: CleaningResult | null;
  error?: string;
  plan?: PlanItem[] | null;
}

let fileSeq = 0;
function fileId() {
  fileSeq += 1;
  return `sel_${Date.now()}_${fileSeq}`;
}

export default function UploadPage() {
  const { t } = useAppSettings();
  const { activeWork } = useWorkspaces();
  const { setStatus: setSessionStatus, updateJob } = useUploadSession();
  const [files, setFiles] = useState<SelectedFile[]>([]);
  const [mode, setMode] = useState<Mode>(
    activeWork?.delivery?.mode === "manual" ? "manual" : "auto",
  );
  const [cleaning, setCleaning] = useState(false);
  const [busyFile, setBusyFile] = useState<string | null>(null);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);
  const runningRef = useRef(false);

  // ---- File selection (multiple) ----
  const handleFiles = (list: FileList | null) => {
    if (!list || list.length === 0) return;
    const chosen = Array.from(list);
    const next = chosen.map((file) => ({
      id: fileId(),
      file,
      status: "ready" as const,
      result: null,
    }));
    setFiles(next);
    setError("");
  };

  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  // ---- Analyze one file ----
  const analyzeSingle = async (f: SelectedFile): Promise<PlanItem[] | null> => {
    const payload = await buildUploadPayload(f.file, "");
    const response = await fetch(API_ENDPOINTS.ANALYZE, {
      method: "POST",
      headers: {
        "Content-Type": payload.contentType,
        ...payload.headers,
        ...authHeaders(),
      },
      body: payload.body,
    });
    const text = await response.text();
    let data: { error?: string; detail?: string; plan?: PlanItem[] } | null =
      null;
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error(t("upload.serverError"));
    }
    if (!response.ok) {
      throw new Error(
        data?.error || data?.detail || `Analysis failed (${response.status})`,
      );
    }
    return data?.plan || [];
  };

  // ---- Clean one file (returns result) ----
  const cleanSingle = async (
    f: SelectedFile,
    planJson: string,
    onProgress?: (pct: number) => void,
  ): Promise<CleaningResult> =>
    (await cleanFileViaUpload(f.file, planJson, {
      onProgress,
      timeoutMs: 300000,
      label: {
        generic: t("upload.serverError"),
        conn: t("upload.network"),
        timeout: t("upload.timeout"),
        tooLarge: t("upload.fileTooLarge"),
      },
    })) as CleaningResult;

  // ---- Analyze a single file (stores the cleaning plan for approval) ----
  const analyzeFile = async (f: SelectedFile) => {
    try {
      setFiles((prev) =>
        prev.map((x) =>
          x.id === f.id ? { ...x, status: "analyzing" as const } : x,
        ),
      );
      const p = await analyzeSingle(f);
      setFiles((prev) =>
        prev.map((x) =>
          x.id === f.id ? { ...x, status: "planning" as const, plan: p } : x,
        ),
      );
    } catch (err) {
      setFiles((prev) =>
        prev.map((x) =>
          x.id === f.id
            ? {
                ...x,
                status: "error" as const,
                error: err instanceof Error ? err.message : "Error",
              }
            : x,
        ),
      );
    }
  };

  // Toggle one plan item on/off before running manual cleaning.
  const togglePlanItem = (fileId: string, planId: string) => {
    setFiles((prev) =>
      prev.map((x) =>
        x.id === fileId
          ? {
              ...x,
              plan: (x.plan || []).map((p) =>
                p.id === planId ? { ...p, run: p.run === false } : p,
              ),
            }
          : x,
      ),
    );
  };

  // ---- Clean a single file with an already-approved plan ----
  const cleanFile = async (f: SelectedFile) => {
    const planItems = f.plan || [];
    const approved = planItems.filter((p) => p.run !== false);
    const planJson = JSON.stringify(
      approved.map((p) => ({ id: p.id, run: true })),
    );
    const job = (progress: number, running: boolean) =>
      updateJob({
        jobId: f.id,
        files: [{ name: f.file.name, size: f.file.size }],
        mode,
        progress,
        currentIndex: 0,
        total: 1,
        running,
      });
    try {
      setBusyFile(f.id);
      setFiles((prev) =>
        prev.map((x) =>
          x.id === f.id ? { ...x, status: "cleaning" as const } : x,
        ),
      );
      job(0, true);
      const result = await cleanSingle(f, planJson, (pct) => job(pct, true));
      setFiles((prev) =>
        prev.map((x) =>
          x.id === f.id ? { ...x, status: "done" as const, result } : x,
        ),
      );
      job(100, false);

      saveChatContext({
        file_name: f.file.name,
        rows_before: result.rows_before,
        rows_after: result.rows_after,
        duplicates_removed: result.duplicates_removed,
        missing_values_filled: result.missing_values_filled,
        outliers_detected: result.outliers_detected,
        quality_score: result.quality_score,
        summary: result.summary,
        recommendations: result.recommendations,
        alerts: result.alerts,
        column_data_types: result.column_data_types,
        cleaning_log: (result.cleaning_log || []).map((op) => ({
          action: op.action || "",
          description: op.description || "",
          details: op.details || "",
          status: op.status || "completed",
        })),
        sample: (result.sample || []).slice(0, 3),
      });
    } catch (err) {
      setFiles((prev) =>
        prev.map((x) =>
          x.id === f.id
            ? {
                ...x,
                status: "error" as const,
                error: err instanceof Error ? err.message : "Error",
              }
            : x,
        ),
      );
    } finally {
      setBusyFile(null);
    }
  };

  // ---- BEGIN: run the whole pipeline in auto/full mode (no approval) ----
  const runPipeline = async () => {
    const ready = files.filter((f) => f.status === "ready");
    if (ready.length === 0) {
      setError(t("upload.selectFirst"));
      return;
    }
    if (runningRef.current) return;
    runningRef.current = true;
    setError("");
    setCleaning(true);
    setSessionStatus("cleaning");

    for (let i = 0; i < ready.length; i++) {
      const f = ready[i];
      setFiles((prev) =>
        prev.map((x) =>
          x.id === f.id ? { ...x, status: "analyzing" as const } : x,
        ),
      );
      const p = await analyzeSingle(f).catch(() => null);
      if (p === null) {
        setFiles((prev) =>
          prev.map((x) =>
            x.id === f.id
              ? {
                  ...x,
                  status: "error" as const,
                  error: t("upload.serverError"),
                }
              : x,
          ),
        );
        continue;
      }
      setFiles((prev) =>
        prev.map((x) =>
          x.id === f.id ? { ...x, status: "cleaning" as const } : x,
        ),
      );
      await cleanFile({ ...f, plan: p });
    }

    setCleaning(false);
    setSessionStatus("accepted");
    runningRef.current = false;
  };

  // In auto/full mode, run automatically whenever there are ready files.
  const autoRun = useRef(false);
  useEffect(() => {
    if (
      (mode === "auto" || mode === "full") &&
      files.some((f) => f.status === "ready") &&
      !runningRef.current &&
      !autoRun.current
    ) {
      autoRun.current = true;
      runPipeline();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [files, mode]);

  const hasResults = files.some((f) => f.status === "done");
  const isBusy = cleaning;

  // ---- Per-file helpers ----
  const baseName = (result: CleaningResult) =>
    (result.cleaned_file_name || "cleaned").replace(/\.(csv|xlsx|xls)$/i, "");

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#4f7cff] to-[#8b5cf6] flex items-center justify-center shadow-lg shadow-blue-500/25">
          <UploadCloud className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight">تنظيف البيانات</h1>
          <p className="text-sm text-white/60">
            ارفع ملفاً (أو عدة ملفات) واختر طريقة التحليل ثم نظّف وصدّر بأي
            صيغة.
          </p>
        </div>
      </div>

      {/* Mode selector */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <ModeCard
          active={mode === "auto"}
          onClick={() => setMode("auto")}
          icon={Zap}
          title="تحليل تلقائي"
          desc="يحلّل الوكيل ويكمل التنظيف بنفسه بدون تدخل"
        />
        <ModeCard
          active={mode === "manual"}
          onClick={() => setMode("manual")}
          icon={Wrench}
          title="تحليل يدوي"
          desc="تلاحظ الاقتراحات وتختار ما يفعله الوكيل بنفسك"
        />
        <ModeCard
          active={mode === "full"}
          onClick={() => setMode("full")}
          icon={Layers}
          title="تحليل كامل"
          desc="من البداية للنهاية: تحليل كامل + تنظيف شامل آلي"
        />
      </div>

      {/* Upload area */}
      <div className="border border-white/10 rounded-3xl bg-white/[0.02] p-5 space-y-4">
        <div
          className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition hover:bg-[#4f7cff]/5 ${
            files.length ? "border-[#4f7cff]/50" : "border-[#4f7cff]/40"
          }`}
          onClick={() => inputRef.current?.click()}
        >
          <input
            ref={inputRef}
            type="file"
            multiple
            className="hidden"
            accept=".csv,.xlsx,.xls,.pdf"
            onChange={(e) => e.target.files && handleFiles(e.target.files)}
          />
          <UploadCloud className="h-12 w-12 text-[#4f7cff] mx-auto mb-3" />
          <p className="font-medium">
            {files.length
              ? `${files.length} ملف محدد — انقر لإضافة المزيد`
              : "اسحب ملفاتك هنا أو انقر للاختيار (CSV / Excel / PDF)"}
          </p>
          <p className="text-sm text-white/40 mt-1">
            يمكنك اختيار عدة ملفات دفعة واحدة
          </p>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm px-4 py-3 rounded-2xl">
            {error}
          </div>
        )}

        {/* Selected files list */}
        {files.length > 0 && (
          <div className="space-y-3">
            {files.map((f) => (
              <div
                key={f.id}
                className={`border rounded-2xl p-4 transition ${
                  f.status === "error"
                    ? "border-red-500/40 bg-red-500/5"
                    : f.status === "done"
                      ? "border-emerald-500/40 bg-emerald-500/5"
                      : "border-white/10 bg-white/[0.02]"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#4f7cff]/10 flex items-center justify-center shrink-0">
                    <FileSpreadsheet className="w-5 h-5 text-[#4f7cff]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{f.file.name}</p>
                    <p className="text-xs text-white/50">
                      {(f.file.size / 1024).toFixed(1)} KB ·{" "}
                      {f.status === "ready" && "جاهز"}
                      {f.status === "analyzing" && "جارٍ التحليل…"}
                      {f.status === "planning" && "حدّد خطة التنظيف"}
                      {f.status === "cleaning" && "جارٍ المعالجة…"}
                      {f.status === "done" && "اكتمل ✓"}
                      {f.status === "error" && "فشل"}
                    </p>
                  </div>
                  {(f.status === "analyzing" || f.status === "cleaning") && (
                    <Loader2 className="w-5 h-5 text-[#4f7cff] animate-spin shrink-0" />
                  )}
                  {!isBusy && busyFile === null && f.status === "ready" && (
                    <button
                      onClick={() => removeFile(f.id)}
                      className="text-white/40 hover:text-red-500 transition shrink-0"
                      title="إزالة"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {mode === "manual" &&
                  !isBusy &&
                  busyFile === null &&
                  f.status === "ready" && (
                    <div className="mt-2 flex gap-2">
                      <button
                        onClick={() => analyzeFile(f)}
                        className="flex items-center gap-1.5 bg-[#4f7cff]/10 border border-[#4f7cff]/40 text-[#4f7cff] text-xs font-medium px-3 py-2 rounded-lg transition hover:bg-[#4f7cff]/20"
                      >
                        <Wrench className="w-3.5 h-3.5" /> تحليل وخطة التنظيف
                      </button>
                    </div>
                  )}

                {f.status === "error" && f.error && (
                  <p className="mt-2 text-sm text-red-400">{f.error}</p>
                )}

                {f.status === "planning" && f.plan && f.plan.length > 0 && (
                  <div className="mt-3 border-t border-white/10 pt-3 space-y-2">
                    <p className="text-sm font-semibold">
                      خطة التنظيف — حدّد ما تريد تطبيقه:
                    </p>
                    {f.plan.map((p) => (
                      <label
                        key={p.id}
                        className="flex items-start gap-2.5 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={p.run !== false}
                          onChange={() => togglePlanItem(f.id, p.id)}
                          className="mt-0.5 accent-[#4f7cff] shrink-0"
                        />
                        <div className="min-w-0">
                          <p className="text-sm text-white/85">
                            {p.action && (
                              <span className="text-[#4f7cff] font-medium">
                                {p.action}
                              </span>
                            )}
                            {p.action ? " — " : ""}
                            {p.description}
                          </p>
                          {p.details && (
                            <p className="text-xs text-white/50">{p.details}</p>
                          )}
                          {p.reason && (
                            <p className="text-xs text-white/40">
                              لماذا: {p.reason}
                            </p>
                          )}
                          {typeof p.rows_affected === "number" && (
                            <p className="text-xs text-white/40">
                              {p.rows_affected} صف
                            </p>
                          )}
                        </div>
                      </label>
                    ))}
                    <div className="flex flex-col sm:flex-row gap-2 pt-1">
                      <button
                        onClick={() => cleanFile(f)}
                        disabled={
                          busyFile !== null ||
                          !f.plan.some((p) => p.run !== false)
                        }
                        className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-[#4f7cff] to-[#8b5cf6] hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium px-4 py-2.5 rounded-xl transition"
                      >
                        <ShieldCheck className="w-4 h-4" />
                        تطبيق المحدد (
                        {f.plan.filter((p) => p.run !== false).length}/
                        {f.plan.length})
                      </button>
                      <button
                        onClick={() => analyzeFile(f)}
                        disabled={busyFile !== null}
                        className="border border-white/15 text-white/70 hover:border-white/40 px-4 py-2.5 rounded-xl text-sm transition"
                      >
                        إعادة التحليل
                      </button>
                    </div>
                  </div>
                )}

                {f.status === "planning" && f.plan && f.plan.length === 0 && (
                  <div className="mt-3 border-t border-white/10 pt-3 space-y-2">
                    <p className="text-sm text-white/60">
                      لا توجد اقتراحات تنظيف. يمكنك المتابعة مباشرة.
                    </p>
                    <button
                      onClick={() => cleanFile(f)}
                      disabled={busyFile !== null}
                      className="flex items-center justify-center gap-2 bg-gradient-to-r from-[#4f7cff] to-[#8b5cf6] hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium px-4 py-2.5 rounded-xl transition"
                    >
                      <ShieldCheck className="w-4 h-4" /> متابعة بدون تنظيف
                    </button>
                  </div>
                )}

                {/* Download buttons at every stage once done */}
                {f.status === "done" && f.result && (
                  <DownloadStage
                    result={f.result}
                    fileName={baseName(f.result)}
                  />
                )}
              </div>
            ))}

            {/* Manual mode: analyze + approve per file */}
            {mode === "manual" &&
              !isBusy &&
              files.some((f) => f.status === "ready") && (
                <p className="text-xs text-white/40 text-center">
                  في الوضع اليدوي: حلّل كل ملف أولاً، ثم راجع خطة التنظيف ووافق
                  على ما تريد تطبيقه.
                </p>
              )}
          </div>
        )}
      </div>

      {hasResults && (
        <div className="bg-emerald-500/5 border border-emerald-500/30 rounded-2xl p-4 text-emerald-200 text-sm">
          تمت معالجة الملفات بنجاح. استخدم أزرار التحميل أعلاه لتصدير النتائج،
          أو انتقل إلى{" "}
          <Link href="/dashboard/history" className="underline font-medium">
            المحفوظات
          </Link>{" "}
          لعرضها لاحقاً.
        </div>
      )}
    </div>
  );
}

function ModeCard({
  active,
  onClick,
  icon: Icon,
  title,
  desc,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof Zap;
  title: string;
  desc: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`text-left border rounded-2xl p-4 transition ${
        active
          ? "border-[#4f7cff]/60 bg-[#4f7cff]/5"
          : "border-white/10 bg-white/[0.02] hover:border-white/25"
      }`}
    >
      <div className="flex items-center gap-2 mb-1.5">
        <Icon
          className={`w-5 h-5 ${active ? "text-[#4f7cff]" : "text-white/50"}`}
        />
        <span className="font-semibold">{title}</span>
        {active && <Check className="w-4 h-4 text-[#4f7cff] ml-auto" />}
      </div>
      <p className="text-xs text-white/50 leading-relaxed">{desc}</p>
    </button>
  );
}

// Download buttons shown for each cleaned result
function DownloadStage({
  result,
  fileName,
}: {
  result: CleaningResult;
  fileName: string;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const run = async (fn: unknown) => {
    setBusy("x");
    try {
      if (fn instanceof Function) await fn();
    } catch {
      // ignore
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="mt-3 flex flex-wrap gap-2 border-t border-white/10 pt-3">
      {result.download_url && (
        <button
          onClick={() =>
            run(async () => {
              const url = result.download_url!;
              const fallback = result.cleaned_file_name || "cleaned.csv";
              if (url.startsWith("data:")) {
                const a = document.createElement("a");
                a.href = url;
                a.download = fallback;
                a.click();
                return;
              }
              const m = url.match(/\/download\/([0-9a-fA-F]{8})/);
              if (!m) return;
              const res = await fetch(`/api/download?id=${m[1]}`, {
                headers: authHeaders(),
              });
              const blob = await res.blob();
              const o = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = o;
              a.download = fallback;
              a.click();
              URL.revokeObjectURL(o);
            })
          }
          className="flex items-center gap-1.5 bg-[#4f7cff] hover:bg-[#8b5cf6] text-white text-xs font-medium px-3 py-2 rounded-lg transition disabled:opacity-50"
          disabled={busy !== null}
        >
          <Download className="w-3.5 h-3.5" /> CSV
        </button>
      )}
      <button
        onClick={() => run(downloadExcelResult(result, fileName))}
        className="flex items-center gap-1.5 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/10 text-xs font-medium px-3 py-2 rounded-lg transition disabled:opacity-50"
        disabled={busy !== null}
      >
        <FileSpreadsheet className="w-3.5 h-3.5" /> Excel
      </button>
      <button
        onClick={() => run(downloadSqlResult(result, fileName))}
        className="flex items-center gap-1.5 border border-sky-500/40 text-sky-300 hover:bg-sky-500/10 text-xs font-medium px-3 py-2 rounded-lg transition disabled:opacity-50"
        disabled={busy !== null}
      >
        <Database className="w-3.5 h-3.5" /> SQL
      </button>
      <button
        onClick={() => run(downloadPowerpointResult(result, fileName))}
        className="flex items-center gap-1.5 border border-amber-500/40 text-amber-300 hover:bg-amber-500/10 text-xs font-medium px-3 py-2 rounded-lg transition disabled:opacity-50"
        disabled={busy !== null}
      >
        <Presentation className="w-3.5 h-3.5" /> PowerPoint
      </button>
      <button
        onClick={() => run(downloadPdfFromUploadResult(result, fileName))}
        className="flex items-center gap-1.5 border border-white/20 text-white/70 hover:bg-white/5 text-xs font-medium px-3 py-2 rounded-lg transition disabled:opacity-50"
        disabled={busy !== null}
      >
        <FileText className="w-3.5 h-3.5" /> PDF
      </button>
      <button
        onClick={() =>
          run(
            (async () => {
              const blob = new Blob([JSON.stringify(result, null, 2)], {
                type: "application/json",
              });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `${fileName}.json`;
              a.click();
              URL.revokeObjectURL(url);
            })(),
          )
        }
        className="flex items-center gap-1.5 border border-white/20 text-white/70 hover:bg-white/5 text-xs font-medium px-3 py-2 rounded-lg transition disabled:opacity-50"
        disabled={busy !== null}
      >
        <FileJson className="w-3.5 h-3.5" /> JSON
      </button>
      <Link
        href="/dashboard/chat"
        className="flex items-center gap-1.5 bg-green-600/15 border border-green-500/40 text-green-300 hover:bg-green-600/25 text-xs font-medium px-3 py-2 rounded-lg transition"
      >
        <MessageSquare className="w-3.5 h-3.5" /> اسأل الوكيل
      </Link>
    </div>
  );
}
