"use client";

import { useRef, useState } from "react";
import {
  Combine,
  Download,
  Loader2,
  RefreshCcw,
  UploadCloud,
  FileSpreadsheet,
  GitMerge,
  BarChart3,
  Link2,
  Sparkles,
  X,
  Check,
  FilePlus2,
  Database,
  FolderOpen,
  Trash2 as Trash2Icon,
} from "lucide-react";
import ExcelJS from "exceljs";
import Papa from "papaparse";
import { API_ENDPOINTS } from "@/lib/api";
import { authHeaders } from "@/lib/auth";
import { listFiles, type SavedFileSummary } from "@/lib/user-files";
import { useAppSettings } from "@/components/providers/app-providers";

const ACCEPT = ".csv,.xlsx,.xls,.pdf";

function triggerBlobDownload(url: string, fallbackName: string) {
  const a = document.createElement("a");
  a.href = url;
  a.download = fallbackName;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

async function downloadFromUrl(
  url: string,
  fallbackName: string,
): Promise<boolean> {
  if (url.startsWith("data:")) {
    triggerBlobDownload(url, fallbackName);
    return true;
  }
  const match = url.match(/\/download\/([0-9a-fA-F]{8})/);
  if (!match) {
    return false;
  }
  const res = await fetch(`/api/download?id=${match[1]}`, {
    headers: authHeaders(),
  });
  if (!res.ok) return false;
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  triggerBlobDownload(objectUrl, fallbackName);
  URL.revokeObjectURL(objectUrl);
  return true;
}

interface MergeResult {
  files?: string[];
  file_count?: number;
  rows?: number;
  column_count?: number;
  columns?: string[];
  preview?: Array<Record<string, unknown>>;
  download_url?: string;
  download_name?: string;
  format?: string;
}

export function MergeTool() {
  const { t } = useAppSettings();
  const [files, setFiles] = useState<File[]>([]);
  const [target, setTarget] = useState("csv");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<MergeResult | null>(null);

  // Picker dialog state
  const [pickerOpen, setPickerOpen] = useState(false);
  const [localPicked, setLocalPicked] = useState<File[]>([]);
  const [savedFiles, setSavedFiles] = useState<SavedFileSummary[]>([]);
  const [savedLoading, setSavedLoading] = useState(false);
  const [savedError, setSavedError] = useState("");
  const [selectedSaved, setSelectedSaved] = useState<Set<string>>(new Set());
  const [pickerBusy, setPickerBusy] = useState(false);
  const localInputRef = useRef<HTMLInputElement | null>(null);

  const openPicker = async () => {
    setPickerOpen(true);
    setLocalPicked([]);
    setSelectedSaved(new Set());
    setSavedError("");
    if (savedFiles.length === 0) {
      setSavedLoading(true);
      try {
        setSavedFiles(await listFiles());
      } catch {
        setSavedError(t("merge.loadSavedFailed"));
      } finally {
        setSavedLoading(false);
      }
    }
  };

  const handleLocalPick = (list: FileList | null) => {
    if (!list) return;
    setLocalPicked((prev) => [...prev, ...Array.from(list)].slice(0, 20));
  };

  const removeLocal = (idx: number) => {
    setLocalPicked((prev) => prev.filter((_, i) => i !== idx));
  };

  const toggleSaved = (id: string) => {
    setSelectedSaved((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectedCount = selectedSaved.size + localPicked.length;

  const confirmPicker = async () => {
    if (selectedCount === 0 || pickerBusy) return;
    setPickerBusy(true);
    try {
      const extra: File[] = [];
      for (const id of Array.from(selectedSaved)) {
        const meta = savedFiles.find((f) => f.id === id);
        if (!meta) continue;
        const res = await fetch(`/api/files/${id}/download`, {
          headers: authHeaders(),
        });
        if (!res.ok) throw new Error("download-failed");
        const blob = await res.blob();
        extra.push(
          new File([blob], meta.cleaned_file_name || meta.file_name, {
            type: "text/csv",
          }),
        );
      }
      setFiles([...localPicked, ...extra].slice(0, 20));
      setPickerOpen(false);
      setResult(null);
      setError("");
    } catch {
      setError(t("merge.loadSavedFailed"));
    } finally {
      setPickerBusy(false);
    }
  };

  const run = async () => {
    if (files.length === 0 || loading) return;
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const form = new FormData();
      for (const f of files) form.append("files", f);
      form.append("target", target);
      const res = await fetch(API_ENDPOINTS.MERGE_FILES, {
        method: "POST",
        headers: authHeaders(),
        body: form,
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || data.detail || t("merge.error"));
      } else {
        setResult(data as MergeResult);
      }
    } catch {
      setError(t("rep.builderConnFailed"));
    } finally {
      setLoading(false);
    }
  };

  const columns =
    result?.preview && result.preview.length
      ? Object.keys(result.preview[0])
      : [];

  return (
    <div className="border border-white/10 rounded-3xl bg-white/[0.02] p-5">
      {pickerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[#0b1630] border border-white/10 rounded-3xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
              <h3 className="font-semibold">{t("merge.pickerTitle")}</h3>
              <button
                type="button"
                onClick={() => setPickerOpen(false)}
                className="p-2 rounded-lg text-white/50 hover:bg-white/5 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* From this device */}
              <div>
                <h4 className="text-sm font-medium text-white/70 flex items-center gap-2">
                  <FolderOpen className="w-4 h-4 text-[#4f7cff]" />
                  {t("merge.local")}
                </h4>
                <p className="text-xs text-white/40 mt-0.5 mb-3">
                  {t("merge.localHint")}
                </p>
                <div
                  className="border-2 border-dashed border-[#4f7cff]/40 rounded-2xl p-5 text-center cursor-pointer hover:bg-[#4f7cff]/5 transition"
                  onClick={() => localInputRef.current?.click()}
                >
                  <input
                    ref={localInputRef}
                    type="file"
                    multiple
                    accept={ACCEPT}
                    className="hidden"
                    onChange={(e) => handleLocalPick(e.target.files)}
                  />
                  <FilePlus2 className="h-8 w-8 text-[#4f7cff] mx-auto mb-2" />
                  <p className="text-sm font-medium">{t("merge.addLocal")}</p>
                </div>
                {localPicked.length > 0 && (
                  <ul className="mt-3 space-y-2">
                    {localPicked.map((f, i) => (
                      <li
                        key={`${f.name}-${i}`}
                        className="flex items-center gap-2 bg-white/[0.03] border border-white/10 rounded-xl px-3 py-2 text-sm"
                      >
                        <FileSpreadsheet className="w-4 h-4 text-[#4f7cff] shrink-0" />
                        <span className="flex-1 truncate text-white/70">
                          {f.name}
                        </span>
                        <span className="text-xs text-white/40">
                          {(f.size / 1024).toFixed(0)} KB
                        </span>
                        <button
                          type="button"
                          onClick={() => removeLocal(i)}
                          className="text-red-400/70 hover:text-red-400 transition"
                        >
                          <Trash2Icon className="w-4 h-4" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Saved files (server) */}
              <div>
                <h4 className="text-sm font-medium text-white/70 flex items-center gap-2">
                  <Database className="w-4 h-4 text-[#8b5cf6]" />
                  {t("merge.saved")}
                  {savedFiles.length > 0 && (
                    <span className="text-xs font-normal text-white/40">
                      {t("merge.savedTotal", { n: savedFiles.length })}
                    </span>
                  )}
                </h4>
                <p className="text-xs text-white/40 mt-0.5 mb-3">
                  {t("merge.savedHint")}
                </p>

                {savedLoading ? (
                  <div className="flex items-center gap-2 text-sm text-white/50 py-6 justify-center">
                    <Loader2 className="w-4 h-4 animate-spin" />{" "}
                    {t("merge.merging")}
                  </div>
                ) : savedFiles.length === 0 ? (
                  <p className="text-sm text-white/40 text-center py-6 border border-white/5 rounded-xl">
                    {t("merge.noSaved")}
                  </p>
                ) : (
                  <ul className="space-y-2 max-h-56 overflow-y-auto pr-1">
                    {savedFiles.map((f) => {
                      const checked = selectedSaved.has(f.id);
                      return (
                        <li key={f.id}>
                          <button
                            type="button"
                            onClick={() => toggleSaved(f.id)}
                            className={`w-full flex items-center gap-3 rounded-xl border px-3 py-2.5 text-sm transition ${
                              checked
                                ? "bg-[#4f7cff]/10 border-[#4f7cff]/50"
                                : "bg-white/[0.03] border-white/10 hover:bg-white/[0.06]"
                            }`}
                          >
                            <span
                              className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition ${
                                checked
                                  ? "bg-[#4f7cff] border-[#4f7cff]"
                                  : "border-white/25"
                              }`}
                            >
                              {checked && (
                                <Check className="w-3.5 h-3.5 text-white" />
                              )}
                            </span>
                            <FileSpreadsheet className="w-4 h-4 text-[#8b5cf6] shrink-0" />
                            <span className="flex-1 truncate text-white/80 text-left">
                              {f.cleaned_file_name || f.file_name}
                            </span>
                            <span className="text-xs text-white/40 whitespace-nowrap">
                              {f.rows_before != null
                                ? `${f.rows_before} rows`
                                : ""}
                              {f.quality_score != null
                                ? ` · ${f.quality_score}%`
                                : ""}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
                {savedError && (
                  <p className="text-xs text-red-400 mt-2">{savedError}</p>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-white/10">
              <button
                type="button"
                onClick={() => setPickerOpen(false)}
                className="px-5 py-2.5 rounded-xl border border-white/15 text-white/70 text-sm hover:bg-white/5 transition"
              >
                {t("merge.cancel")}
              </button>
              <button
                type="button"
                onClick={confirmPicker}
                disabled={selectedCount === 0 || pickerBusy}
                className="flex items-center gap-2 bg-gradient-to-r from-[#4f7cff] to-[#8b5cf6] hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium px-5 py-2.5 rounded-xl transition shadow-lg shadow-blue-500/20"
              >
                {pickerBusy ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
                {t("merge.confirm", { n: selectedCount })}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#60a5fa] to-[#a78bfa] flex items-center justify-center shrink-0">
          <GitMerge className="w-5 h-5 text-white" />
        </div>
        <div>
          <h2 className="font-semibold flex items-center gap-2">
            {t("merge.name")}
          </h2>
          <p className="text-xs text-white/50">{t("merge.desc")}</p>
        </div>
      </div>

      <div
        className="border-2 border-dashed border-sky-400/40 rounded-2xl p-6 text-center cursor-pointer hover:bg-sky-400/5 transition"
        onClick={openPicker}
      >
        <Combine className="h-10 w-10 text-sky-400 mx-auto mb-2" />
        <p className="font-medium text-sm">
          {files.length
            ? `${t("merge.addedCount", { n: files.length })}`
            : t("merge.pick")}
        </p>
        <p className="text-xs text-white/40 mt-1">
          {t("merge.upTo", { n: 20 })}
        </p>
      </div>

      <div className="flex flex-col md:flex-row gap-3 mt-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-white/60">
            {t("merge.outputFormat")}
          </span>
          <select
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            className="bg-white/[0.04] border border-white/15 rounded-xl px-3 py-2 text-sm outline-none focus:border-sky-400/60"
          >
            <option value="csv">CSV</option>
            <option value="xlsx">Excel (XLSX)</option>
            <option value="xls">Excel (XLS)</option>
            <option value="json">JSON</option>
          </select>
        </div>
        <button
          onClick={run}
          disabled={files.length === 0 || loading}
          className="flex-1 bg-gradient-to-r from-[#60a5fa] to-[#a78bfa] hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium px-5 py-2.5 rounded-xl flex items-center justify-center gap-2 transition shadow-lg shadow-blue-500/20"
        >
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" /> {t("merge.merging")}
            </>
          ) : (
            <>
              <UploadCloud className="w-5 h-5" /> {t("merge.action")}
            </>
          )}
        </button>
      </div>

      {error && (
        <div className="mt-4 bg-red-500/10 border border-red-500/30 text-red-400 text-sm px-4 py-3 rounded-2xl">
          {error}
        </div>
      )}

      {result && (
        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap gap-4 text-sm bg-white/[0.03] border border-white/10 rounded-2xl p-4">
            <span>
              {t("merge.files")}{" "}
              <b className="text-white">{result.file_count}</b>
            </span>
            <span>
              {t("merge.rows")} <b className="text-white">{result.rows}</b>
            </span>
            <span>
              {t("merge.columns")}{" "}
              <b className="text-white">{result.column_count}</b>
            </span>
            <span className="text-white/60 truncate">
              {t("merge.columns")} {result.columns?.join("، ")}
            </span>
          </div>

          {columns.length > 0 && (
            <div className="border border-white/10 rounded-2xl overflow-hidden">
              <div className="px-4 py-2.5 border-b border-white/10 text-sm font-medium bg-white/[0.02]">
                {t("merge.preview", { n: 15 })}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-white/40">
                      {columns.map((c) => (
                        <th
                          key={c}
                          className="px-3 py-2 text-right font-medium truncate max-w-[160px]"
                        >
                          {c}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {result.preview?.map((row, i) => (
                      <tr key={i} className="border-t border-white/5">
                        {columns.map((c) => (
                          <td
                            key={c}
                            className="px-3 py-1.5 text-white/70 truncate max-w-[160px]"
                          >
                            {String(row[c] ?? "")}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {result.download_url && (
            <button
              onClick={() =>
                downloadFromUrl(
                  result.download_url!,
                  result.download_name || `merged.${target}`,
                )
              }
              className="bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/25 text-sm font-medium px-5 py-2.5 rounded-xl flex items-center gap-2 transition"
            >
              <Download className="w-4 h-4" />{" "}
              {t("merge.download", { fmt: result.format?.toUpperCase() ?? "" })}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

interface ConvertResult {
  source_file_name?: string;
  rows?: number;
  column_count?: number;
  target_format?: string;
  download_url?: string;
  download_name?: string;
}

export function ConvertTool() {
  const { t } = useAppSettings();
  const [file, setFile] = useState<File | null>(null);
  const [target, setTarget] = useState("xlsx");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<ConvertResult | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const run = async () => {
    if (!file || loading) return;
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("target", target);
      const res = await fetch(API_ENDPOINTS.CONVERT, {
        method: "POST",
        headers: authHeaders(),
        body: form,
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || data.detail || t("convert.error"));
      } else {
        setResult(data as ConvertResult);
      }
    } catch {
      setError(t("rep.builderConnFailed"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="border border-white/10 rounded-3xl bg-white/[0.02] p-5">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#4f7cff] to-[#8b5cf6] flex items-center justify-center shrink-0">
          <RefreshCcw className="w-5 h-5 text-white" />
        </div>
        <div>
          <h2 className="font-semibold">{t("convert.name")}</h2>
          <p className="text-xs text-white/50">{t("convert.desc")}</p>
        </div>
      </div>

      <div
        className="border-2 border-dashed border-amber-400/40 rounded-2xl p-6 text-center cursor-pointer hover:bg-amber-400/5 transition"
        onClick={() => inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          className="hidden"
          onChange={(e) => {
            setFile(e.target.files?.[0] || null);
            setResult(null);
            setError("");
          }}
        />
        <FileSpreadsheet className="h-10 w-10 text-amber-400 mx-auto mb-2" />
        <p className="font-medium text-sm">
          {file ? file.name : t("convert.pick")}
        </p>
        <p className="text-xs text-white/40 mt-1">CSV / XLSX / XLS / PDF</p>
      </div>

      <div className="flex flex-col md:flex-row gap-3 mt-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-white/60">{t("convert.to")}</span>
          <select
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            className="bg-white/[0.04] border border-white/15 rounded-xl px-3 py-2 text-sm outline-none focus:border-amber-400/60"
          >
            <option value="xlsx">Excel (XLSX)</option>
            <option value="csv">CSV</option>
            <option value="xls">Excel (XLS)</option>
            <option value="json">JSON</option>
          </select>
        </div>
        <button
          onClick={run}
          disabled={!file || loading}
          className="flex-1 bg-gradient-to-r from-[#4f7cff] to-[#8b5cf6] hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium px-5 py-2.5 rounded-xl flex items-center justify-center gap-2 transition shadow-lg shadow-amber-500/20"
        >
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />{" "}
              {t("convert.converting")}
            </>
          ) : (
            <>
              <RefreshCcw className="w-5 h-5" /> {t("convert.action")}
            </>
          )}
        </button>
      </div>

      {error && (
        <div className="mt-4 bg-red-500/10 border border-red-500/30 text-red-400 text-sm px-4 py-3 rounded-2xl">
          {error}
        </div>
      )}

      {result && result.download_url && (
        <div className="mt-4 flex items-center justify-between bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-4">
          <div className="text-sm text-white/80">
            {t("convert.done", {
              fmt: result.target_format?.toUpperCase() ?? "",
              rows: result.rows ?? 0,
              cols: result.column_count ?? 0,
            })}
          </div>
          <button
            onClick={() =>
              downloadFromUrl(
                result.download_url!,
                result.download_name || "converted",
              )
            }
            className="bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/25 text-sm font-medium px-4 py-2 rounded-xl flex items-center gap-2 transition"
          >
            <Download className="w-4 h-4" /> {t("convert.download")}
          </button>
        </div>
      )}
    </div>
  );
}

// ============================================================
// Power Pivot + AI
// Exports a Power Pivot-ready workbook: a fact table, dimension
// tables (auto-detected categorical columns), and AI insights.
// ============================================================

interface PivotStats {
  rows: number;
  cols: number;
  factCols: string[];
  numericCols: string[];
  categoricalCols: string[];
}

function parseDataFile(
  file: File,
): Promise<{ headers: string[]; rows: Record<string, unknown>[] }> {
  const lower = file.name.toLowerCase().split(".").pop();
  if (lower === "csv") {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        Papa.parse<Record<string, unknown>>(String(reader.result || ""), {
          header: true,
          skipEmptyLines: true,
          complete: (res) => {
            const data = (res.data || []) as Record<string, unknown>[];
            const headers = res.meta.fields || [];
            resolve({ headers, rows: data });
          },
          error: reject,
        });
      };
      reader.onerror = reject;
      reader.readAsText(file);
    });
  }
  // xlsx / xls
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const wb = new ExcelJS.Workbook();
        await wb.xlsx.load(reader.result as ArrayBuffer);
        const ws = wb.worksheets[0];
        const rows: Record<string, unknown>[] = [];
        const headers: string[] = [];
        ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
          const values = row.values as unknown[];
          if (rowNumber === 1) {
            for (const v of values.slice(1)) headers.push(String(v ?? ""));
          } else {
            const obj: Record<string, unknown> = {};
            values.slice(1).forEach((v, i) => {
              if (headers[i]) obj[headers[i]] = v;
            });
            rows.push(obj);
          }
        });
        resolve({ headers, rows });
      } catch (e) {
        reject(e);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

export function PowerPivotTool() {
  const { t } = useAppSettings();
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [insights, setInsights] = useState<string[]>([]);
  const [stats, setStats] = useState<PivotStats | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const run = async () => {
    if (!file || loading) return;
    setLoading(true);
    setError("");
    setInsights([]);
    setStats(null);
    try {
      // 1. Parse the file client-side (lightweight — preview + fallback).
      const { headers, rows } = await parseDataFile(file);

      // 2. Detect numeric vs categorical columns (best-effort, for the UI).
      const numericVotes = new Array(headers.length).fill(0);
      let sampleCount = 0;
      for (const row of rows.slice(0, 40)) {
        sampleCount++;
        headers.forEach((h, i) => {
          const v = row[h];
          if (v == null || v === "") return;
          if (
            typeof v === "number" ||
            (typeof v === "string" &&
              v.trim() !== "" &&
              !Number.isNaN(Number(v)))
          ) {
            numericVotes[i]++;
          } else if (typeof v !== "object") {
            numericVotes[i]--;
          }
        });
      }
      const numericCols: string[] = [];
      const categoricalCols: string[] = [];
      headers.forEach((h, i) => {
        if (sampleCount > 0 && numericVotes[i] / sampleCount >= 0.8) {
          numericCols.push(h);
        } else {
          categoricalCols.push(h);
        }
      });

      // 3. AI insight via analyze-data (best-effort).
      let aiInsight = "";
      try {
        const form = new FormData();
        form.append("file", file);
        const res = await fetch(API_ENDPOINTS.ANALYZE_DATA, {
          method: "POST",
          headers: authHeaders(),
          body: form,
        });
        if (res.ok) {
          const data = await res.json();
          const hints = data?.insights ?? [];
          if (Array.isArray(hints) && hints.length) {
            aiInsight = hints.join("\n");
          } else if (data?.ai_explanation) {
            aiInsight = String(data.ai_explanation);
          }
        }
      } catch {
        // AI unavailable — workbook still builds with structure only.
      }

      // 4. Prefer the server-side Power Pivot builder (authoritative model).
      let downloaded = false;
      try {
        const form = new FormData();
        form.append("file", file);
        const res = await fetch(API_ENDPOINTS.POWER_PIVOT, {
          method: "POST",
          headers: authHeaders(),
          body: form,
        });
        if (res.ok) {
          const data = await res.json();
          downloaded = await downloadFromUrl(
            data.download_url,
            file.name.replace(/\.[^.]+$/, "") + "-powerpivot.xlsx",
          );
          if (downloaded) {
            const dims =
              data?.model?.dimensions?.length ?? categoricalCols.length;
            setStats({
              rows: data.rows ?? rows.length,
              cols: data.column_count ?? headers.length,
              factCols: headers as string[],
              numericCols,
              categoricalCols: Array.from(
                { length: dims },
                (_, i) => `Dim_${i}`,
              ),
            });
          }
        }
      } catch {
        downloaded = false;
      }

      if (!downloaded) {
        // Fallback: build the workbook client-side.
        const parsed = await buildPivotWorkbook({
          fileName: file.name,
          headers,
          rows,
          stats: {
            rows: rows.length,
            cols: headers.length,
            factCols: headers,
            numericCols,
            categoricalCols,
          },
          aiInsight,
        });
        triggerBlobDownloadFromBuffer(
          parsed,
          file.name.replace(/\.[^.]+$/, "") + "-powerpivot.xlsx",
        );
        setStats({
          rows: rows.length,
          cols: headers.length,
          factCols: headers,
          numericCols,
          categoricalCols,
        });
      }

      if (aiInsight) {
        setInsights(aiInsight.split("\n").filter(Boolean).slice(0, 6));
      } else if (numericCols.length) {
        setInsights([t("pt.factReady", { n: numericCols.length })]);
      }
    } catch {
      setError(t("rep.builderError"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="border border-white/10 rounded-3xl bg-white/[0.02] p-5">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#34d399] to-[#22d3ee] flex items-center justify-center shrink-0">
          <BarChart3 className="w-5 h-5 text-white" />
        </div>
        <div>
          <h2 className="font-semibold flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-emerald-300" /> {t("pt.title")}
          </h2>
          <p className="text-xs text-white/50">{t("pt.subtitle")}</p>
        </div>
      </div>

      <div
        className="border-2 border-dashed border-emerald-400/40 rounded-2xl p-6 text-center cursor-pointer hover:bg-emerald-400/5 transition"
        onClick={() => inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.xlsx,.xls"
          className="hidden"
          onChange={(e) => {
            setFile(e.target.files?.[0] || null);
            setError("");
            setInsights([]);
            setStats(null);
          }}
        />
        <FileSpreadsheet className="h-10 w-10 text-emerald-400 mx-auto mb-2" />
        <p className="font-medium text-sm">{file ? file.name : t("pt.pick")}</p>
        <p className="text-xs text-white/40 mt-1">
          CSV / XLSX — Power Pivot + AI
        </p>
      </div>

      <button
        onClick={run}
        disabled={!file || loading}
        className="mt-4 w-full bg-gradient-to-r from-[#34d399] to-[#22d3ee] hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium px-5 py-2.5 rounded-xl flex items-center justify-center gap-2 transition shadow-lg shadow-emerald-500/20"
      >
        {loading ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" /> {t("pt.generating")}
          </>
        ) : (
          <>
            <Download className="w-5 h-5" /> {t("pt.generate")}
          </>
        )}
      </button>

      {error && (
        <div className="mt-4 bg-red-500/10 border border-red-500/30 text-red-400 text-sm px-4 py-3 rounded-2xl">
          {error}
        </div>
      )}

      {stats && (
        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap gap-4 text-sm bg-white/[0.03] border border-white/10 rounded-2xl p-4">
            <span>
              {t("pt.fact", { rows: stats.rows })} · {stats.cols}{" "}
              {t("rep.columns")}
            </span>
            <span className="text-white/40">—</span>
            <span>
              {t("pt.dimensions", { n: stats.categoricalCols.length })}
            </span>
          </div>

          {insights.length > 0 && (
            <div className="bg-purple-500/5 border border-purple-500/20 rounded-2xl p-4">
              <p className="text-sm font-semibold text-purple-300 flex items-center gap-1.5 mb-1.5">
                <Sparkles className="w-4 h-4" /> {t("pt.insights")}
              </p>
              <ul className="space-y-1.5 mt-2">
                {insights.map((line, i) => (
                  <li
                    key={i}
                    className="text-sm text-white/80 flex items-start gap-2"
                  >
                    <Link2 className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />{" "}
                    {line}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// A noop ref helper to keep the input changed handler consistent.

async function buildPivotWorkbook(opts: {
  fileName: string;
  headers: string[];
  rows: Record<string, unknown>[];
  stats: PivotStats;
  aiInsight: string;
}) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "OQZARO DataAnalyzer";
  wb.created = new Date();

  const safe = (n: string) =>
    n.replace(/[^a-zA-Z0-9_.-]/g, "_").slice(0, 28) || "Column";

  // Fact sheet (all rows, all columns)
  const fact = wb.addWorksheet("Fact");
  fact.columns = opts.headers.map((h) => ({ header: h, key: h, width: 16 }));
  const factHeader = fact.getRow(1);
  factHeader.font = { bold: true, color: { argb: "FFFFFFFF" } };
  factHeader.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF1B5E20" },
  };
  for (const row of opts.rows.slice(0, 2000)) {
    const clean: Record<string, unknown> = {};
    for (const h of opts.headers) clean[h] = row[h] ?? "";
    fact.addRow(clean);
  }

  const catCols = opts.stats.categoricalCols
    .filter(
      (c) =>
        opts.headers.includes(c) &&
        opts.rows.some((r) => r[c] != null && r[c] !== ""),
    )
    .slice(0, 6);

  const relationships: string[] = [];

  if (catCols.length === 0) {
    const info = wb.addWorksheet("About");
    info.addRow(["Generated by OQZARO DataAnalyzer"]).font = { bold: true };
    info.addRow([]);
    info.addRow(["Power Pivot notes"]).font = { bold: true };
    info.addRow([`Rows in Fact: ${opts.rows.length}`]);
    info.addRow([`Columns in Fact: ${opts.headers.length}`]);
    info.addRow([]);
    info.addRow([
      "No categorical columns found — the dataset was exported as a single fact table.",
    ]);
    if (opts.aiInsight) {
      info.addRow([]);
      info.addRow(["AI Insights"]).font = { bold: true };
      for (const line of opts.aiInsight.split("\n")) info.addRow([line]);
    }
    await wb.xlsx.writeBuffer();
    return wb.xlsx.writeBuffer();
  }

  // Dimension sheets
  for (const col of catCols) {
    const dim = wb.addWorksheet("Dim_" + safe(col));
    dim.columns = [
      { header: col, key: col, width: 24 },
      { header: `${col}_ID`, key: "_id", width: 12 },
    ];
    const dimHeader = dim.getRow(1);
    dimHeader.font = { bold: true, color: { argb: "FFFFFFFF" } };
    dimHeader.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF0D47A1" },
    };

    // Build dimension: keep the dimension key + a surrogate row id in the Fact table
    const seen = new Map<string, number>();
    let id = 1;
    // Write dimension rows (unique values with id)
    for (const row of opts.rows.slice(0, 2000)) {
      const v = String(row[col] ?? "(blank)");
      if (v === "(blank)") continue;
      if (!seen.has(v)) {
        seen.set(v, id);
        dim.addRow({ [col]: v, _id: id });
        id++;
      }
    }
    relationships.push(`${col} -> Dim_${safe(col)} : ${col}_ID`);
  }

  // Relationships documentation sheet
  const rel = wb.addWorksheet("Relationships");
  rel.addRow([
    "Fact",
    "Dimension",
    "Join (Fact column -> Dimension column)",
  ]).font = { bold: true };
  rel.columns = [
    { header: "Fact", key: "f", width: 20 },
    { header: "Dimension", key: "d", width: 20 },
    { header: "Join", key: "j", width: 40 },
  ];
  relationships.forEach((r) =>
    rel.addRow({ f: "Fact", d: r.split(" : ")[0], j: r.split(" : ")[1] || "" }),
  );

  // About + AI insights
  const info = wb.addWorksheet("About");
  info.addRow(["Generated by OQZARO DataAnalyzer"]).font = { bold: true };
  info.addRow([]);
  info.addRow([
    "To use in Excel: Data > Manage Data Model > Add tables. Then create PivotTables from the model.",
  ]);
  info.addRow([]);
  info.addRow(["Power Pivot notes"]).font = { bold: true };
  info.addRow([`Rows in Fact: ${opts.rows.length}`]);
  info.addRow([`Columns in Fact: ${opts.headers.length}`]);
  info.addRow([`Dimensions: ${catCols.length}`]);
  if (opts.aiInsight) {
    info.addRow([]);
    info.addRow(["AI Insights"]).font = { bold: true };
    for (const line of opts.aiInsight.split("\n")) info.addRow([line]);
  }

  return wb.xlsx.writeBuffer();
}

function triggerBlobDownloadFromBuffer(
  buffer: ArrayBuffer | Buffer,
  filename: string,
) {
  const blob = new Blob([buffer as ArrayBuffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  triggerBlobDownload(url, filename);
  URL.revokeObjectURL(url);
}
