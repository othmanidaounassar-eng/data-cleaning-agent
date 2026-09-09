"use client";

import { useMemo, useRef, useState } from "react";
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
  Legend,
  LineChart,
  Line,
  ScatterChart,
  Scatter,
  AreaChart,
  Area,
  CartesianGrid,
  ZAxis,
} from "recharts";
import {
  UploadCloud,
  Loader2,
  BarChart3,
  Table2,
  Layers,
  FileSpreadsheet,
  AlertTriangle,
  GitCompareArrows,
  Sparkles,
  Trophy,
  Eye,
  Search,
  Filter,
  Info,
  PieChart as PieIcon,
  Activity,
  TrendingUp,
  Database,
  ShieldCheck,
  FilterX,
  Plus,
  X,
  SlidersHorizontal,
  Lightbulb,
  CheckCircle2,
  RefreshCcw,
} from "lucide-react";
import { authHeaders } from "@/lib/auth";
import { API_ENDPOINTS } from "@/lib/api";
import { useAppSettings } from "@/components/providers/app-providers";
import { MergeTool, ConvertTool } from "@/components/dashboard/file-tools";
import {
  UploadResultLike,
  downloadExcelResult,
  downloadSqlResult,
  downloadPowerpointResult,
  downloadPdfFromUploadResult,
} from "@/lib/export-utils";
import {
  FileDown,
  FileCode,
  Presentation,
  FileText,
  FileJson,
} from "lucide-react";

interface ColumnStat {
  name: string;
  dtype: string;
  nulls: number;
  distinct: number;
  min?: number;
  max?: number;
  mean?: number;
  median?: number;
  std?: number;
  q1?: number;
  q3?: number;
  skewness?: number;
  outliers_count?: number;
  outliers_pct?: number;
  boxplot?: {
    min: number;
    q1: number;
    median: number;
    q3: number;
    max: number;
    whisker_low: number;
    whisker_high: number;
  };
  histogram?: { bin: number; count: number }[];
  top_values?: { value: string; count: number }[];
  description?: string;
}

interface Kpis {
  rows: number;
  columns: number;
  missing_values: number;
  missing_pct: number;
  duplicate_rows: number;
  duplicate_pct: number;
  completeness_score: number;
  quality_score: number;
  numeric_columns: number;
  categorical_columns: number;
}

interface GroupCell {
  column: string;
  groups: { value: string | number; count: number; pct?: number }[];
}

interface HighestCell {
  column: string;
  kind: "numeric" | "categorical";
  max?: number;
  min?: number;
  top: { value: string | number; count: number }[];
}

interface AnalysisResult {
  dataset?: { file_name?: string };
  rows: number;
  column_count: number;
  total_nulls: number;
  total_duplicates: number;
  numeric_columns: number;
  correlation: { row: string; col: string; value: number }[];
  columns: ColumnStat[];
  kpis?: Kpis;
  group_by?: GroupCell[];
  highest?: HighestCell[];
  insights?: string[];
  recommendations?: string[];
  scatter?: {
    x_col: string;
    y_col: string;
    points: { x: number; y: number }[];
  }[];
  filter_options?: FilterOption[];
  filtered?: {
    active: boolean;
    rules: unknown[];
    rows_before?: number;
    rows_after?: number;
  };
  sample?: Array<Record<string, unknown>>;
  column_types?: Record<string, { count: number; columns: string[] }>;
  ai_explanation?: string;
}

interface FilterOption {
  column: string;
  kind: "numeric" | "categorical";
  min?: number;
  max?: number;
  values?: { value: string; count: number }[];
}

type FilterRule = {
  column: string;
  op: "in" | "gte" | "lte" | "between";
  value: string | string[] | number[];
};

type PlanItem = {
  id: string;
  title: string;
  side?: "clean" | "keep";
  summary?: string;
  reason?: string;
  run?: boolean;
};

type AgentStep = 0 | 1 | 2 | 3 | 4;

type CleaningResultT = UploadResultLike & {
  download_url?: string;
  cleaned_file_name?: string;
  file_id?: string;
};

type Tab = "preview" | "charts" | "columns" | "correlation" | "recommendations";
const BAR_COLORS = [
  "#4f7cff",
  "#8b5cf6",
  "#fbbf24",
  "#60a5fa",
  "#a78bfa",
  "#34d399",
  "#f472b6",
  "#22d3ee",
];

const PIE_COLORS = [
  "#4f7cff",
  "#60a5fa",
  "#34d399",
  "#fbbf24",
  "#a78bfa",
  "#f472b6",
  "#22d3ee",
  "#8b5cf6",
];

const DTYPE_BADGES: Record<string, { color: string; labelKey: string }> = {
  int64: {
    color: "bg-sky-500/20 text-sky-300 border-sky-500/30",
    labelKey: "an.dtypeInt",
  },
  float64: {
    color: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
    labelKey: "an.dtypeFloat",
  },
  object: {
    color: "bg-purple-500/20 text-purple-300 border-purple-500/30",
    labelKey: "an.dtypeObject",
  },
  bool: {
    color: "bg-amber-500/20 text-amber-300 border-amber-500/30",
    labelKey: "an.dtypeBool",
  },
  datetime64: {
    color: "bg-pink-500/20 text-pink-300 border-pink-500/30",
    labelKey: "an.dtypeDatetime",
  },
};

const TABS: { id: Tab; labelKey: string; icon: typeof Eye }[] = [
  { id: "preview", labelKey: "an.tabPreview", icon: Eye },
  { id: "charts", labelKey: "an.tabCharts", icon: PieIcon },
  { id: "columns", labelKey: "an.tabColumns", icon: Table2 },
  { id: "correlation", labelKey: "an.tabCorrelation", icon: GitCompareArrows },
  { id: "recommendations", labelKey: "an.tabRecommendations", icon: Lightbulb },
];

const AGENT_STEPS: { labelKey: string; icon: typeof Sparkles }[] = [
  { labelKey: "agent.stepAsk", icon: Sparkles },
  { labelKey: "agent.stepProblems", icon: AlertTriangle },
  { labelKey: "agent.stepClean", icon: ShieldCheck },
  { labelKey: "agent.stepAnalysis", icon: Activity },
  { labelKey: "agent.stepInsights", icon: Lightbulb },
];

const GOAL_CHIPS = ["agent.goalChip1", "agent.goalChip2", "agent.goalChip3"];

export default function AnalyzePage() {
  const { t } = useAppSettings();
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("preview");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<
    "all" | "numeric" | "categorical" | "has-nulls"
  >("all");
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [rules, setRules] = useState<FilterRule[]>([]);
  const [agentGoal, setAgentGoal] = useState("");
  const [agentManual, setAgentManual] = useState(false);
  const [agentStep, setAgentStep] = useState<AgentStep>(0);
  const [agentPlan, setAgentPlan] = useState<PlanItem[] | null>(null);
  const [cleaning, setCleaning] = useState(false);
  const [cleanedReady, setCleanedReady] = useState(false);

  const runAnalysis = async (
    extraRules?: FilterRule[],
    fileOverride?: File,
  ) => {
    if (!file && !fileOverride) return;
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const form = new FormData();
      form.append("file", fileOverride ?? file!);
      const active =
        extraRules !== undefined
          ? extraRules
          : rules.filter((r) => r.value && String(r.value).length);
      if (active.length) form.append("filters", JSON.stringify(active));
      const res = await fetch(API_ENDPOINTS.ANALYZE_DATA, {
        method: "POST",
        headers: authHeaders(),
        body: form,
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || data.detail || t("an.analysisError"));
      } else {
        setResult(data as AnalysisResult);
      }
    } catch {
      setError(t("an.connFailed"));
    } finally {
      setLoading(false);
    }
  };

  const postClean = (
    target: File,
    planJson: string,
  ): Promise<CleaningResultT> =>
    new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const form = new FormData();
      form.append("file", target);
      form.append("plan", planJson);
      xhr.open("POST", API_ENDPOINTS.UPLOAD);
      xhr.setRequestHeader(
        "Authorization",
        `Bearer ${localStorage.getItem("token") || ""}`,
      );
      xhr.responseType = "json";
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300 && xhr.response) {
          resolve(xhr.response);
        } else {
          reject(
            new Error(
              xhr.response?.error ||
                xhr.response?.detail ||
                t("an.analysisError"),
            ),
          );
        }
      };
      xhr.onerror = () => reject(new Error(t("an.connFailed")));
      xhr.send(form);
    });

  const fetchCleanedFile = async (
    cleanResult: CleaningResultT,
  ): Promise<File> => {
    const url = cleanResult.download_url || "";
    if (url.startsWith("data:")) {
      const blob = await (await fetch(url)).blob();
      return new File([blob], cleanResult.cleaned_file_name || "cleaned.csv", {
        type: "text/csv",
      });
    }
    const m = url.match(/\/download\/([0-9a-fA-F]{8,})/);
    if (!m) throw new Error(t("an.analysisError"));
    const res = await fetch(`/api/download?id=${m[1]}`, {
      headers: authHeaders(),
    });
    if (!res.ok) throw new Error(t("an.downloadFailed"));
    const blob = await res.blob();
    return new File([blob], cleanResult.cleaned_file_name || "cleaned.csv", {
      type: "text/csv",
    });
  };

  const runAgentPipeline = async () => {
    if (!file) return;
    setLoading(true);
    setError("");
    setResult(null);
    setCleanedReady(false);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(API_ENDPOINTS.ANALYZE, {
        method: "POST",
        headers: authHeaders(),
        body: form,
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || data.detail || t("an.analysisError"));
        setLoading(false);
        return;
      }
      const planItems: PlanItem[] = (data.plan || []).map(
        (p: PlanItem): PlanItem => ({ ...p, run: p.side === "clean" }),
      );
      setAgentPlan(planItems);
      setAgentStep(1);
      if (!agentManual) {
        await performCleaning(planItems);
      }
    } catch {
      setError(t("an.connFailed"));
    } finally {
      setLoading(false);
    }
  };

  const toggleAgentPlanItem = (id: string) => {
    setAgentPlan((prev) =>
      prev ? prev.map((p) => (p.id === id ? { ...p, run: !p.run } : p)) : prev,
    );
  };

  const performCleaning = async (planItems: PlanItem[]) => {
    setCleaning(true);
    setError("");
    const approved = planItems.filter((p) => p.run !== false);
    try {
      const planJson = JSON.stringify(
        approved.map((p) => ({ ...p, run: true })),
      );
      setAgentStep(2);
      const cleanResult = await postClean(file!, planJson);
      const cleanedFile = await fetchCleanedFile(cleanResult);
      setCleanedReady(true);
      setAgentStep(3);
      await runAnalysis([], cleanedFile);
      setAgentStep(4);
      if (typeof window !== "undefined" && (window as Window).scrollTo) {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t("an.analysisError"));
    } finally {
      setCleaning(false);
    }
  };

  const confirmManualCleaning = () => {
    if (agentPlan) performCleaning(agentPlan);
  };

  const resetAgent = () => {
    setAgentPlan(null);
    setAgentStep(0);
    setCleanedReady(false);
  };

  const handleRun = () => runAnalysis();

  const applyFilters = async () => {
    const active = rules.filter((r) => r.value && String(r.value).length);
    await runAnalysis(active);
  };

  const clearFilters = () => {
    setRules([]);
    runAnalysis([]);
  };

  const [exportFormat, setExportFormat] = useState<string | null>(null);

  const mapToUploadResult = (r: AnalysisResult): UploadResultLike => {
    const colTypes: Record<string, string> = {};
    if (r.column_types) {
      for (const [dtype, info] of Object.entries(r.column_types)) {
        for (const col of info.columns) {
          colTypes[col] = dtype;
        }
      }
    }
    return {
      rows_before: r.rows,
      rows_after: r.rows,
      duplicates_removed: r.total_duplicates,
      missing_values_filled: r.total_nulls,
      outliers_detected: r.columns.reduce(
        (sum, c) => sum + (c.outliers_count ?? 0),
        0,
      ),
      quality_score: r.kpis?.quality_score,
      execution_time_seconds: undefined,
      summary: r.kpis
        ? `Rows: ${r.rows}, Columns: ${r.column_count}, Quality: ${r.kpis.quality_score}/100`
        : undefined,
      ai_explanation: r.ai_explanation,
      cleaning_log: undefined,
      recommendations: r.recommendations,
      alerts: undefined,
      column_data_types:
        Object.keys(colTypes).length > 0 ? colTypes : undefined,
      sample: r.sample,
    };
  };

  const handleExport = async (
    kind: "excel" | "sql" | "ppt" | "json" | "pdf",
  ) => {
    if (!result) return;
    const name =
      result.dataset?.file_name?.replace(/\.[^.]+$/, "") || "analysis";
    setExportFormat(kind);
    try {
      switch (kind) {
        case "excel":
          await downloadExcelResult(mapToUploadResult(result), name);
          break;
        case "sql":
          downloadSqlResult(mapToUploadResult(result), name);
          break;
        case "ppt":
          await downloadPowerpointResult(mapToUploadResult(result), name);
          break;
        case "json": {
          const blob = new Blob([JSON.stringify(result, null, 2)], {
            type: "application/json",
          });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `${name}.json`;
          a.click();
          a.remove();
          URL.revokeObjectURL(url);
          break;
        }
        case "pdf":
          downloadPdfFromUploadResult(mapToUploadResult(result), name);
          break;
      }
    } finally {
      setExportFormat(null);
    }
  };

  const numericCols = useMemo(
    () =>
      result?.columns.filter((c) => c.histogram && c.histogram.length) || [],
    [result],
  );
  const categoricalCols = useMemo(
    () =>
      result?.columns.filter((c) => c.top_values && c.top_values.length) || [],
    [result],
  );

  const filteredColumns = useMemo(() => {
    if (!result) return [];
    let cols = [...result.columns];
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      cols = cols.filter((c) => c.name.toLowerCase().includes(q));
    }
    if (typeFilter === "numeric") {
      cols = cols.filter((c) => c.min != null);
    } else if (typeFilter === "categorical") {
      cols = cols.filter((c) => c.min == null && c.top_values != null);
    } else if (typeFilter === "has-nulls") {
      cols = cols.filter((c) => c.nulls > 0);
    }
    return cols;
  }, [result, search, typeFilter]);

  const sampleHeaders = useMemo(() => {
    if (!result?.sample || result.sample.length === 0) return [];
    return Object.keys(result.sample[0]);
  }, [result]);

  const hasRealData = result && result.rows > 0;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Upload card */}
      <div className="border border-white/10 rounded-3xl bg-white/[0.02] p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#4f7cff] to-[#8b5cf6] flex items-center justify-center shadow-lg shadow-blue-500/25">
            <BarChart3 className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">
              {t("an.title")}
            </h1>
            <p className="text-sm text-white/60">{t("an.subtitle")}</p>
          </div>
        </div>

        {/* Agent pipeline steps */}
        <div className="flex items-center gap-1 sm:gap-2 mt-5 mb-5 flex-wrap">
          {AGENT_STEPS.map((step, idx) => {
            const done = agentStep > idx;
            const active = agentStep === idx;
            const Icon = step.icon;
            return (
              <div
                key={step.labelKey}
                className={`flex items-center gap-1 sm:gap-2 text-[11px] sm:text-xs rounded-full px-2 sm:px-3 py-1.5 border transition ${
                  done
                    ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-300"
                    : active
                      ? "bg-[#4f7cff]/15 border-[#4f7cff]/50 text-[#4f7cff]"
                      : "bg-white/[0.03] border-white/10 text-white/40"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span className="whitespace-nowrap">{t(step.labelKey)}</span>
                {done && (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" />
                )}
              </div>
            );
          })}
        </div>

        {/* Ask step: goal + mode */}
        {agentStep === 0 && !loading && !agentPlan && (
          <div className="mb-4">
            <label className="block text-sm text-white/70 mb-1.5">
              {t("agent.askTitle")}
            </label>
            <p className="text-xs text-white/40 mb-2">
              {t("agent.askSubtitle")}
            </p>
            <textarea
              value={agentGoal}
              onChange={(e) => setAgentGoal(e.target.value)}
              placeholder={t("agent.goalPlaceholder")}
              className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/25 focus:outline-none focus:border-[#4f7cff]/50 resize-none"
              rows={2}
            />
            <div className="flex flex-wrap gap-2 mt-2">
              {GOAL_CHIPS.map((key) => (
                <button
                  key={key}
                  onClick={() => setAgentGoal(t(key))}
                  className={`text-xs px-3 py-1.5 rounded-full border transition ${
                    agentGoal === t(key)
                      ? "bg-[#4f7cff]/20 border-[#4f7cff]/50 text-[#4f7cff]"
                      : "bg-white/[0.03] border-white/10 text-white/50 hover:text-white hover:border-white/25"
                  }`}
                >
                  {t(key)}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 mt-3">
              <span className="text-xs text-white/50">
                {t("agent.modeAuto")}
              </span>
              <button
                onClick={() => setAgentManual((v) => !v)}
                className={`relative w-10 h-5.5 h-6 rounded-full transition ${
                  agentManual ? "bg-[#4f7cff]" : "bg-white/15"
                }`}
                aria-label="toggle"
              >
                <span
                  className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${
                    agentManual ? "left-[1.35rem]" : "left-0.5"
                  }`}
                />
              </button>
              <span className="text-xs text-white/50">
                {t("agent.modeManual")}
              </span>
            </div>
          </div>
        )}

        <div
          className="border-2 border-dashed border-[#4f7cff]/40 rounded-2xl p-8 text-center cursor-pointer hover:bg-[#4f7cff]/5 transition"
          onClick={() => inputRef.current?.click()}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".csv,.xlsx,.xls,.pdf"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0] || null;
              setFile(f);
              setResult(null);
              setRules([]);
              resetAgent();
            }}
          />
          <FileSpreadsheet className="h-12 w-12 text-[#4f7cff] mx-auto mb-3" />
          <p className="font-medium">{file ? file.name : t("an.dropHint")}</p>
          <p className="text-sm text-white/40 mt-1">{t("an.dropDesc")}</p>
        </div>

        {/* Manual cleaning approval */}
        {agentManual && agentPlan && !cleanedReady && (
          <div className="mt-5 border border-[#4f7cff]/25 bg-[#4f7cff]/5 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <ShieldCheck className="w-4 h-4 text-[#4f7cff]" />
              <h3 className="text-sm font-semibold">
                {t("agent.cleaningTitle")}
              </h3>
            </div>
            <ul className="space-y-2 mb-4">
              {agentPlan.map((p) => (
                <li key={p.id} className="flex items-start gap-2.5">
                  <input
                    type="checkbox"
                    checked={p.run !== false}
                    onChange={() => toggleAgentPlanItem(p.id)}
                    className="mt-0.5 accent-[#4f7cff]"
                  />
                  <div>
                    <p className="text-sm text-white/85">{p.title}</p>
                    {p.reason && (
                      <p className="text-xs text-white/45 mt-0.5">{p.reason}</p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
            <button
              onClick={confirmManualCleaning}
              disabled={cleaning}
              className="bg-gradient-to-r from-[#4f7cff] to-[#8b5cf6] hover:brightness-110 disabled:opacity-40 text-white text-sm font-medium px-4 py-2.5 rounded-xl flex items-center gap-2"
            >
              {cleaning ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />{" "}
                  {t("agent.cleanRunning")}
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" /> {t("agent.cleanApply")}
                </>
              )}
            </button>
          </div>
        )}

        <div className="flex justify-center mt-4 gap-3 flex-wrap">
          {!agentPlan && (
            <>
              <button
                onClick={runAgentPipeline}
                disabled={!file || loading || cleaning}
                className="bg-gradient-to-r from-[#4f7cff] to-[#8b5cf6] hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium px-6 py-3 rounded-xl flex items-center gap-2 shadow-lg shadow-blue-500/25 transition"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />{" "}
                    {t("agent.cleanRunning")}
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5" /> {t("agent.startAgent")}
                  </>
                )}
              </button>
              <button
                onClick={handleRun}
                disabled={!file || loading}
                className="border border-white/15 text-white/70 hover:text-white hover:border-white/30 font-medium px-4 py-3 rounded-xl flex items-center gap-2 transition disabled:opacity-40"
              >
                <UploadCloud className="w-5 h-5" />
                {loading ? t("an.analyzing") : t("agent.direct")}
              </button>
            </>
          )}
          {agentPlan && !agentManual && !cleanedReady && (
            <div className="flex items-center gap-2 text-sm text-[#4f7cff]">
              <Loader2 className="w-5 h-5 animate-spin" />
              {t("agent.cleanRunning")}
            </div>
          )}
          {cleanedReady && (
            <button
              onClick={resetAgent}
              className="border border-white/15 text-white/70 hover:text-white hover:border-white/30 font-medium px-4 py-3 rounded-xl flex items-center gap-2 transition"
            >
              <RefreshCcw className="w-5 h-5" />
              {t("an.runAgain")}
            </button>
          )}
        </div>

        {error && (
          <div className="mt-4 bg-red-500/10 border border-red-500/30 text-red-400 text-sm px-4 py-3 rounded-2xl">
            {error}
          </div>
        )}
      </div>

      {/* أدوات الملفات: دمج وتحويل */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <MergeTool />
        <ConvertTool />
      </div>

      {result && hasRealData && (
        <>
          {/* AI Explanation Card */}
          {result.ai_explanation && (
            <div className="rounded-3xl overflow-hidden relative">
              {/* Animated gradient background */}
              <div className="absolute inset-0 bg-gradient-to-br from-[#4f7cff]/15 via-transparent to-[#a78bfa]/15" />
              <div className="absolute inset-0 border border-white/10 rounded-3xl" />
              <div className="relative p-5">
                <div className="flex items-start gap-4">
                  <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#4f7cff] to-[#a78bfa] flex items-center justify-center shadow-lg shadow-purple-500/20 shrink-0">
                    <Sparkles className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h2 className="font-semibold">{t("an.aiMeaning")}</h2>
                      <span className="text-[10px] bg-purple-500/20 text-purple-300 border border-purple-500/30 rounded-full px-2 py-0.5">
                        {t("an.smartExplanation")}
                      </span>
                    </div>
                    <p className="text-sm text-white/80 leading-relaxed">
                      {result.ai_explanation}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: t("an.rows"), value: result.rows, icon: Database },
              {
                label: t("an.columns"),
                value: result.column_count,
                icon: Layers,
              },
              {
                label: t("an.nullValues"),
                value: result.total_nulls,
                icon: AlertTriangle,
              },
              {
                label: t("an.duplicates"),
                value: result.total_duplicates,
                icon: GitCompareArrows,
              },
            ].map(({ label, value, icon: Icon }) => (
              <div
                key={label}
                className="border border-white/10 rounded-2xl bg-white/[0.02] p-4 flex items-center gap-3"
              >
                <div className="w-10 h-10 rounded-xl bg-[#4f7cff]/10 flex items-center justify-center">
                  <Icon className="w-5 h-5 text-[#4f7cff]" />
                </div>
                <div>
                  <div className="text-2xl font-bold">{value}</div>
                  <div className="text-xs text-white/50">{label}</div>
                </div>
              </div>
            ))}
          </div>

          {/* KPIs & quality */}
          {result.kpis && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <KpiTile
                label={t("an.completeness")}
                value={`${result.kpis.completeness_score}%`}
                accent="text-emerald-400"
              />
              <KpiTile
                label={t("an.quality")}
                value={`${result.kpis.quality_score}`}
                accent="text-[#4f7cff]"
              />
              <KpiTile
                label={t("an.missingValues")}
                value={`${result.kpis.missing_values} (${result.kpis.missing_pct}%)`}
                accent="text-red-400"
              />
              <KpiTile
                label={t("an.duplicateRows")}
                value={`${result.kpis.duplicate_rows} (${result.kpis.duplicate_pct}%)`}
                accent="text-amber-400"
              />
              <KpiTile
                label={t("an.columns")}
                value={`${result.kpis.numeric_columns} ${t("an.numeric")} · ${result.kpis.categorical_columns} ${t("an.categorical")}`}
                accent="text-sky-400"
              />
            </div>
          )}

          {/* Quality progress ring */}
          {result.kpis && (
            <div className="border border-white/10 rounded-3xl bg-white/[0.02] p-5">
              <div className="flex flex-col md:flex-row items-center gap-6">
                <div className="relative w-28 h-28 shrink-0">
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
                        result.kpis.quality_score >= 80
                          ? "#34d399"
                          : result.kpis.quality_score >= 50
                            ? "#4f7cff"
                            : "#ef4444"
                      }
                      strokeWidth="10"
                      strokeLinecap="round"
                      strokeDasharray={`${(result.kpis.quality_score / 100) * 264} 264`}
                      className="transition-all duration-700"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-2xl font-bold">
                      {result.kpis.quality_score}
                    </span>
                    <span className="text-[10px] text-white/50">
                      {t("an.of100")}
                    </span>
                  </div>
                </div>
                <div className="flex-1 space-y-2">
                  <h3 className="font-semibold flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-emerald-400" />
                    {t("an.qualityScore")}
                  </h3>
                  <p className="text-sm text-white/60 leading-relaxed">
                    {result.kpis.quality_score >= 80
                      ? t("an.qualityExcellent")
                      : result.kpis.quality_score >= 60
                        ? t("an.qualityGood")
                        : result.kpis.quality_score >= 40
                          ? t("an.qualityMedium")
                          : t("an.qualityPoor")}
                  </p>
                  <div className="flex flex-wrap gap-2 pt-1">
                    {result.column_types &&
                      Object.entries(result.column_types).map(
                        ([dtype, info]) => (
                          <span
                            key={dtype}
                            className="text-xs bg-white/5 border border-white/10 rounded-full px-3 py-1 text-white/70"
                          >
                            {dtype}: {info.count} {t("an.column")}
                          </span>
                        ),
                      )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Export buttons */}
          <div className="flex flex-wrap items-center gap-2">
            {(
              [
                { kind: "excel" as const, label: "Excel", icon: FileDown },
                { kind: "sql" as const, label: "SQL", icon: FileCode },
                {
                  kind: "ppt" as const,
                  label: "PowerPoint",
                  icon: Presentation,
                },
                { kind: "json" as const, label: "JSON", icon: FileJson },
                { kind: "pdf" as const, label: "PDF", icon: FileText },
              ] as const
            ).map(({ kind, label, icon: Icon }) => (
              <button
                key={kind}
                onClick={() => handleExport(kind)}
                disabled={exportFormat !== null}
                className="text-[#4f7cff] border border-[#4f7cff]/40 hover:bg-[#4f7cff]/10 rounded-xl px-3 py-2 text-sm flex items-center gap-1.5 transition disabled:opacity-50"
              >
                {exportFormat === kind ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Icon className="w-4 h-4" />
                )}
                {label}
              </button>
            ))}
          </div>

          {/* Insights */}
          {result.insights && result.insights.length > 0 && (
            <div className="border border-white/10 rounded-3xl bg-white/[0.02] p-5">
              <h2 className="font-semibold flex items-center gap-2 mb-4">
                <TrendingUp className="w-5 h-5 text-[#4f7cff]" />{" "}
                {t("an.insights")}
              </h2>
              <ul className="space-y-2">
                {result.insights.map((ins, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 text-sm text-white/80 bg-white/[0.03] border border-white/5 rounded-xl px-3 py-2"
                  >
                    <span className="text-[#4f7cff] mt-0.5 shrink-0">✦</span>
                    <span>{ins}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Filtered banner */}
          {result.filtered && result.filtered.active && (
            <div className="border border-sky-500/30 bg-sky-500/5 rounded-3xl px-4 py-3 text-sm flex items-center gap-3">
              <SlidersHorizontal className="w-4 h-4 text-sky-300 shrink-0" />
              <span className="text-white/80 flex-1">
                {t("an.filterAppliedBefore")}{" "}
                <b className="text-sky-300">
                  {result.filtered.rows_after ?? result.rows}
                </b>{" "}
                {t("an.filterAppliedOf")}{" "}
                <b className="text-white">
                  {result.filtered.rows_before ?? result.rows}
                </b>
                .
              </span>
              <button
                onClick={clearFilters}
                className="flex items-center gap-1.5 bg-sky-500/15 border border-sky-500/30 text-sky-300 hover:bg-sky-500/25 px-3 py-1.5 rounded-lg text-xs font-medium transition"
              >
                <FilterX className="w-3.5 h-3.5" /> {t("an.reset")}
              </button>
            </div>
          )}

          {/* Filter builder */}
          {result.filter_options && (
            <FilterBuilder
              options={result.filter_options}
              rules={rules}
              onChange={setRules}
              onApply={applyFilters}
              onClear={clearFilters}
            />
          )}

          {/* Tabs */}
          <div className="sticky top-16 z-10 -mx-1 px-1 py-2 bg-[#070b14]/80 backdrop-blur-md">
            <div className="flex gap-1.5 overflow-x-auto pb-1">
              {TABS.map(({ id, labelKey, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setActiveTab(id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition border ${
                    activeTab === id
                      ? "bg-[#4f7cff]/15 border-[#4f7cff]/40 text-[#4f7cff]"
                      : "border-white/5 text-white/50 hover:text-white/80 hover:bg-white/5"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {t(labelKey)}
                </button>
              ))}
            </div>
          </div>

          {/* Tab content */}
          {activeTab === "preview" && (
            <DataPreview
              sample={result.sample || []}
              headers={sampleHeaders}
              columns={result.columns}
            />
          )}

          {activeTab === "charts" && (
            <div className="space-y-8">
              {/* Charts row 1: histograms + pie */}
              {numericCols.length > 0 && (
                <div className="space-y-4">
                  <h2 className="font-semibold flex items-center gap-2 px-1">
                    <Activity className="w-5 h-5 text-[#4f7cff]" />{" "}
                    {t("an.numericDistributions")}
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {numericCols.map((c) => (
                      <ChartCard key={c.name} title={c.name}>
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={c.histogram}>
                            <XAxis
                              dataKey="bin"
                              stroke="rgba(255,255,255,0.3)"
                              fontSize={10}
                            />
                            <YAxis
                              stroke="rgba(255,255,255,0.3)"
                              fontSize={10}
                            />
                            <Tooltip contentStyle={tooltipStyle} />
                            <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                              {c.histogram?.map((_, i) => (
                                <Cell
                                  key={i}
                                  fill={BAR_COLORS[i % BAR_COLORS.length]}
                                />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </ChartCard>
                    ))}
                  </div>
                </div>
              )}

              {/* Pie charts for categorical */}
              {categoricalCols.length > 0 && (
                <div className="space-y-4">
                  <h2 className="font-semibold flex items-center gap-2 px-1">
                    <PieIcon className="w-5 h-5 text-[#4f7cff]" />{" "}
                    {t("an.pieChart")}
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {categoricalCols.slice(0, 4).map((c) => (
                      <ChartCard key={c.name} title={c.name}>
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={c.top_values}
                              dataKey="count"
                              nameKey="value"
                              cx="50%"
                              cy="50%"
                              outerRadius={75}
                              label={({ percent }) => `${percent}%`}
                              labelLine={false}
                            >
                              {c.top_values?.map((_, i) => (
                                <Cell
                                  key={i}
                                  fill={PIE_COLORS[i % PIE_COLORS.length]}
                                />
                              ))}
                            </Pie>
                            <Tooltip />
                            <Legend wrapperStyle={{ fontSize: 10 }} />
                          </PieChart>
                        </ResponsiveContainer>
                      </ChartCard>
                    ))}
                  </div>
                </div>
              )}

              {/* Area chart for cumulative distribution */}
              {numericCols.length > 0 && (
                <div className="space-y-4">
                  <h2 className="font-semibold flex items-center gap-2 px-1">
                    <TrendingUp className="w-5 h-5 text-[#4f7cff]" />{" "}
                    {t("an.areaChart")}
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {numericCols.slice(0, 2).map((c) => {
                      const hist = c.histogram || [];
                      const data = hist.reduce<
                        { bin: number; cumulative: number; count: number }[]
                      >((acc, h) => {
                        const prev = acc.length
                          ? acc[acc.length - 1].cumulative
                          : 0;
                        acc.push({
                          bin: h.bin,
                          count: h.count,
                          cumulative: prev + h.count,
                        });
                        return acc;
                      }, []);
                      return (
                        <ChartCard
                          key={c.name}
                          title={`${c.name} — ${t("an.cumulative")}`}
                        >
                          <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={data}>
                              <defs>
                                <linearGradient
                                  id={`grad-${c.name}`}
                                  x1="0"
                                  y1="0"
                                  x2="0"
                                  y2="1"
                                >
                                  <stop
                                    offset="5%"
                                    stopColor="#4f7cff"
                                    stopOpacity={0.5}
                                  />
                                  <stop
                                    offset="95%"
                                    stopColor="#4f7cff"
                                    stopOpacity={0}
                                  />
                                </linearGradient>
                              </defs>
                              <CartesianGrid stroke="rgba(255,255,255,0.05)" />
                              <XAxis
                                dataKey="bin"
                                stroke="rgba(255,255,255,0.3)"
                                fontSize={10}
                              />
                              <YAxis
                                stroke="rgba(255,255,255,0.3)"
                                fontSize={10}
                              />
                              <Tooltip />
                              <Area
                                type="monotone"
                                dataKey="cumulative"
                                stroke="#4f7cff"
                                fill={`url(#grad-${c.name})`}
                                strokeWidth={2}
                              />
                            </AreaChart>
                          </ResponsiveContainer>
                        </ChartCard>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Line chart over first numeric col's histogram */}
              {numericCols.length > 0 && (
                <div className="space-y-4">
                  <h2 className="font-semibold flex items-center gap-2 px-1">
                    <TrendingUp className="w-5 h-5 text-[#4f7cff]" />{" "}
                    {t("an.lineChart")}
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {numericCols.slice(0, 2).map((c) => (
                      <ChartCard
                        key={c.name}
                        title={`${c.name} — ${t("an.curve")}`}
                      >
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={c.histogram}>
                            <CartesianGrid stroke="rgba(255,255,255,0.05)" />
                            <XAxis
                              dataKey="bin"
                              stroke="rgba(255,255,255,0.3)"
                              fontSize={10}
                            />
                            <YAxis
                              stroke="rgba(255,255,255,0.3)"
                              fontSize={10}
                            />
                            <Tooltip />
                            <Line
                              type="monotone"
                              dataKey="count"
                              stroke="#60a5fa"
                              strokeWidth={2.5}
                              dot={{ r: 3, fill: "#60a5fa" }}
                              activeDot={{ r: 5 }}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </ChartCard>
                    ))}
                  </div>
                </div>
              )}

              {/* Scatter plot using real data points */}
              {result.scatter && result.scatter.length > 0 && (
                <div className="space-y-4">
                  <h2 className="font-semibold flex items-center gap-2 px-1">
                    <Activity className="w-5 h-5 text-[#4f7cff]" />{" "}
                    {t("an.scatterPlot")}
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {result.scatter.map((s) => (
                      <div
                        key={`${s.x_col}${s.y_col}`}
                        className="border border-white/10 rounded-3xl bg-white/[0.02] p-5"
                      >
                        <p className="text-sm text-white/60 mb-3">
                          {t("an.relationshipBetween")}{" "}
                          <b className="text-white">{s.x_col}</b>{" "}
                          {t("an.relationshipAnd")}{" "}
                          <b className="text-white">{s.y_col}</b>
                        </p>
                        <div className="h-72">
                          <ResponsiveContainer width="100%" height="100%">
                            <ScatterChart
                              margin={{
                                top: 10,
                                right: 10,
                                bottom: 10,
                                left: 10,
                              }}
                            >
                              <CartesianGrid stroke="rgba(255,255,255,0.05)" />
                              <XAxis
                                dataKey="x"
                                name={s.x_col}
                                stroke="rgba(255,255,255,0.3)"
                                fontSize={10}
                              />
                              <YAxis
                                dataKey="y"
                                name={s.y_col}
                                stroke="rgba(255,255,255,0.3)"
                                fontSize={10}
                              />
                              <ZAxis range={[40, 50]} />
                              <Tooltip />
                              <Scatter data={s.points} fill="#4f7cff" />
                            </ScatterChart>
                          </ResponsiveContainer>
                        </div>
                        <p className="text-xs text-white/40 mt-3">
                          {t("an.scatterNote")}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Outliers chart */}
              {numericCols.some((c) => (c.outliers_count ?? 0) > 0) && (
                <div className="space-y-4">
                  <h2 className="font-semibold flex items-center gap-2 px-1">
                    <AlertTriangle className="w-5 h-5 text-[#4f7cff]" />{" "}
                    {t("an.outliers")}
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {numericCols
                      .filter((c) => (c.outliers_count ?? 0) > 0)
                      .map((c) => (
                        <div
                          key={c.name}
                          className="border border-white/10 rounded-3xl bg-white/[0.02] p-4"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-sm font-medium truncate">
                              {c.name}
                            </p>
                            <span className="text-xs text-red-400">
                              {t("an.outlierCount", {
                                n: c.outliers_count ?? 0,
                              })}{" "}
                              ({c.outliers_pct}%)
                            </span>
                          </div>
                          <div className="h-1.5 bg-white/10 rounded-full overflow-hidden mb-2">
                            <div
                              className="h-full bg-gradient-to-r from-amber-400 to-red-500 rounded-full"
                              style={{
                                width: `${Math.min(100, c.outliers_pct ?? 0) * 2}%`,
                              }}
                            />
                          </div>
                          <p className="text-xs text-white/50">
                            {t("an.outlierIqr")}
                          </p>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* GroupBy */}
              {result.group_by && result.group_by.length > 0 && (
                <div className="space-y-4">
                  <h2 className="font-semibold flex items-center gap-2 px-1">
                    <Layers className="w-5 h-5 text-[#4f7cff]" />{" "}
                    {t("an.groupBy")}
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {result.group_by.map((g) => (
                      <ChartCard key={g.column} title={g.column}>
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart
                            data={g.groups.map((gr) => ({
                              value: String(gr.value),
                              pct: gr.pct ?? 0,
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
                              dataKey="value"
                              width={110}
                              stroke="rgba(255,255,255,0.3)"
                              fontSize={10}
                            />
                            <Tooltip />
                            <Bar
                              dataKey="pct"
                              fill="#4f7cff"
                              radius={[0, 6, 6, 0]}
                            />
                          </BarChart>
                        </ResponsiveContainer>
                      </ChartCard>
                    ))}
                  </div>
                </div>
              )}

              {/* Highest */}
              {result.highest && result.highest.length > 0 && (
                <div className="border border-white/10 rounded-3xl bg-white/[0.02] overflow-hidden">
                  <div className="px-5 py-4 border-b border-white/10 flex items-center gap-2">
                    <Trophy className="w-5 h-5 text-[#4f7cff]" />
                    <h2 className="font-semibold">{t("an.topValues")}</h2>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4">
                    {result.highest.map((col) => (
                      <div
                        key={col.column}
                        className="border border-white/10 rounded-2xl bg-white/[0.02] p-4"
                      >
                        <p className="text-sm font-medium mb-2 truncate">
                          {col.column}
                        </p>
                        {col.kind === "numeric" && (
                          <div className="flex gap-4 text-xs text-white/60 mb-2">
                            <span>
                              {t("an.maxColumn")}:{" "}
                              <b className="text-white">{col.max}</b>
                            </span>
                            <span>
                              {t("an.minColumn")}:{" "}
                              <b className="text-white">{col.min}</b>
                            </span>
                          </div>
                        )}
                        <div className="space-y-1.5">
                          {col.top.map((t, i) => (
                            <div
                              key={i}
                              className="flex items-center justify-between text-sm"
                            >
                              <span className="truncate text-white/70">
                                {t.value}
                              </span>
                              <span className="text-white/50 text-xs">
                                ×{t.count}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === "columns" && (
            <ColumnsView
              columns={filteredColumns}
              allColumns={result.columns}
              search={search}
              setSearch={setSearch}
              typeFilter={typeFilter}
              setTypeFilter={setTypeFilter}
              totalColumns={result.column_count}
            />
          )}

          {activeTab === "correlation" && (
            <CorrelationView correlation={result.correlation} />
          )}

          {activeTab === "recommendations" && (
            <RecommendationsView
              recommendations={result.recommendations}
              insights={result.insights}
            />
          )}
        </>
      )}
    </div>
  );
}

// ============================================================
// Sub-components
// ============================================================

function KpiTile({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <div className="border border-white/10 rounded-2xl bg-white/[0.02] p-4">
      <div className={`text-lg font-bold ${accent}`}>{value}</div>
      <div className="text-xs text-white/50 mt-0.5">{label}</div>
    </div>
  );
}

const tooltipStyle = {
  background: "rgba(10,15,30,0.95)",
  border: "1px solid rgba(255,255,255,0.15)",
  borderRadius: 12,
  fontSize: 12,
};

function ChartCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border border-white/10 rounded-3xl bg-white/[0.02] p-5">
      <p className="font-medium text-sm mb-2 truncate">{title}</p>
      <div className="h-48">{children}</div>
    </div>
  );
}

function DataPreview({
  sample,
  headers,
  columns,
}: {
  sample: Array<Record<string, unknown>>;
  headers: string[];
  columns: ColumnStat[];
}) {
  const { t } = useAppSettings();
  if (!sample.length || !headers.length) {
    return (
      <div className="border border-white/10 rounded-3xl bg-white/[0.02] p-8 text-center text-white/50 text-sm">
        {t("an.noPreview")}
      </div>
    );
  }

  const colorForColumn = (name: string) => {
    const col = columns.find((c) => c.name === name);
    if (!col) return "bg-sky-500/10 text-sky-300";
    const badge = DTYPE_BADGES[col.dtype];
    return badge ? badge.color : "bg-sky-500/10 text-sky-300";
  };

  return (
    <div className="border border-white/10 rounded-3xl bg-white/[0.02] overflow-hidden">
      <div className="px-5 py-4 border-b border-white/10 flex items-center gap-2">
        <Eye className="w-5 h-5 text-[#4f7cff]" />
        <h2 className="font-semibold">{t("an.preview")}</h2>
        <span className="text-xs text-white/40 ml-auto">
          {t("an.previewFirstRows", { n: sample.length })}
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className="px-4 py-3 text-white/40 font-medium text-xs bg-white/[0.02]">
                #
              </th>
              {headers.map((h) => (
                <th
                  key={h}
                  className="px-4 py-3 text-white/40 font-medium text-xs bg-white/[0.02]"
                >
                  <div className="flex flex-col gap-1">
                    <span className="font-semibold text-white/70 truncate max-w-[160px]">
                      {h}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 w-fit text-[9px] px-1.5 py-0.5 rounded-full border ${colorForColumn(h)}`}
                    >
                      {columns.find((c) => c.name === h)?.dtype || "?"}
                    </span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sample.map((row, i) => (
              <tr
                key={i}
                className="border-t border-white/5 hover:bg-white/[0.02] transition"
              >
                <td className="px-4 py-2 text-white/30 text-xs">{i + 1}</td>
                {headers.map((h) => (
                  <td
                    key={h}
                    className="px-4 py-2 text-white/70 truncate max-w-[200px]"
                    title={String(row[h] ?? "")}
                  >
                    {row[h] === "" || row[h] == null ? (
                      <span className="text-red-400/70 italic">
                        {t("an.nullValue")}
                      </span>
                    ) : (
                      String(row[h])
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="px-5 py-3 border-t border-white/5 bg-white/[0.02]">
        <p className="text-xs text-white/40 flex items-center gap-1.5">
          <Info className="w-3.5 h-3.5" />
          {t("an.previewNote")}
        </p>
      </div>
    </div>
  );
}

function ColumnsView({
  columns,
  allColumns,
  search,
  setSearch,
  typeFilter,
  setTypeFilter,
  totalColumns,
}: {
  columns: ColumnStat[];
  allColumns: ColumnStat[];
  search: string;
  setSearch: (v: string) => void;
  typeFilter: "all" | "numeric" | "categorical" | "has-nulls";
  setTypeFilter: (v: "all" | "numeric" | "categorical" | "has-nulls") => void;
  totalColumns: number;
}) {
  const { t } = useAppSettings();
  const withOutliers = allColumns.filter(
    (c) => c.outliers_count && c.outliers_count > 0,
  );

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("an.searchColumns")}
            className="w-full bg-white/[0.03] border border-white/10 rounded-xl pl-4 pr-10 py-2.5 text-sm focus:outline-none focus:border-[#4f7cff]/50"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto">
          <FilterChip
            active={typeFilter === "all"}
            onClick={() => setTypeFilter("all")}
            label={`${t("an.all")} (${totalColumns})`}
          />
          <FilterChip
            active={typeFilter === "numeric"}
            onClick={() => setTypeFilter("numeric")}
            label={t("an.numeric")}
          />
          <FilterChip
            active={typeFilter === "categorical"}
            onClick={() => setTypeFilter("categorical")}
            label={t("an.categorical")}
          />
          <FilterChip
            active={typeFilter === "has-nulls"}
            onClick={() => setTypeFilter("has-nulls")}
            label={t("an.hasNulls")}
          />
        </div>
      </div>

      {/* Outliers summary */}
      {withOutliers.length > 0 && (
        <div className="border border-amber-500/20 bg-amber-500/5 rounded-2xl p-4 text-sm">
          <p className="flex items-center gap-2 font-medium mb-1.5 text-amber-300">
            <AlertTriangle className="w-4 h-4" />
            {t("an.outliersInColumns", { n: withOutliers.length })}
          </p>
          <div className="flex flex-wrap gap-2">
            {withOutliers.map((c) => (
              <span
                key={c.name}
                className="text-xs bg-amber-500/10 border border-amber-500/20 rounded-full px-3 py-1 text-amber-200"
              >
                {c.name}: {c.outliers_count} ({c.outliers_pct}%)
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Columns table */}
      <div className="border border-white/10 rounded-3xl bg-white/[0.02] overflow-hidden">
        <div className="px-5 py-4 border-b border-white/10 flex items-center gap-2">
          <Table2 className="w-5 h-5 text-[#4f7cff]" />
          <h2 className="font-semibold">{t("an.columnStats")}</h2>
          <span className="text-xs text-white/40 ml-auto">
            {t("an.columnsCount", { n: columns.length })}
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-white/40 text-left">
                <th className="px-5 py-3 font-medium">{t("an.column")}</th>
                <th className="px-3 py-3 font-medium">{t("an.type")}</th>
                <th className="px-3 py-3 font-medium">{t("an.empty")}</th>
                <th className="px-3 py-3 font-medium">{t("an.unique")}</th>
                <th className="px-3 py-3 font-medium">{t("an.mean")}</th>
                <th className="px-3 py-3 font-medium">{t("an.median")}</th>
                <th className="px-3 py-3 font-medium">{t("an.std")}</th>
                <th className="px-3 py-3 font-medium">{t("an.outliers")}</th>
              </tr>
            </thead>
            <tbody>
              {columns.map((c) => (
                <tr
                  key={c.name}
                  className="border-t border-white/5 hover:bg-white/[0.02] transition"
                >
                  <td className="px-5 py-2.5 font-medium truncate max-w-[200px]">
                    <div className="flex flex-col gap-0.5">
                      <span>{c.name}</span>
                      {c.description && (
                        <span className="text-[11px] text-white/40 font-normal truncate max-w-[260px]">
                          {c.description}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    <span
                      className={`inline-flex text-[10px] px-2 py-0.5 rounded-full border ${DTYPE_BADGES[c.dtype]?.color || "bg-sky-500/10 text-sky-300 border-sky-500/30"}`}
                    >
                      {DTYPE_BADGES[c.dtype]
                        ? t(DTYPE_BADGES[c.dtype].labelKey)
                        : c.dtype}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    {c.nulls > 0 ? (
                      <span className="text-red-400">{c.nulls}</span>
                    ) : (
                      <span className="text-emerald-400">0 ✓</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-white/70">{c.distinct}</td>
                  <td className="px-3 py-2.5 text-white/70">
                    {c.mean != null ? c.mean : "—"}
                  </td>
                  <td className="px-3 py-2.5 text-white/70">
                    {c.median != null ? c.median : "—"}
                  </td>
                  <td className="px-3 py-2.5 text-white/70">
                    {c.std != null ? c.std : "—"}
                  </td>
                  <td className="px-3 py-2.5">
                    {c.outliers_count ? (
                      <span className="text-amber-400">
                        {c.outliers_count} ⚠
                      </span>
                    ) : (
                      <span className="text-white/30">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium whitespace-nowrap border transition ${
        active
          ? "bg-[#4f7cff]/15 border-[#4f7cff]/40 text-[#4f7cff]"
          : "border-white/10 text-white/50 hover:text-white/80 hover:bg-white/5"
      }`}
    >
      <Filter className="w-3.5 h-3.5" />
      {label}
    </button>
  );
}

function CorrelationView({
  correlation,
}: {
  correlation: { row: string; col: string; value: number }[];
}) {
  const { t } = useAppSettings();
  if (!correlation.length) {
    return (
      <div className="border border-white/10 rounded-3xl bg-white/[0.02] p-8 text-center text-white/50 text-sm">
        {t("an.noCorrelation")}
      </div>
    );
  }
  const names = Array.from(new Set(correlation.map((c) => c.row)));

  return (
    <div className="border border-white/10 rounded-3xl bg-white/[0.02] p-5">
      <h2 className="font-semibold flex items-center gap-2 mb-4">
        <GitCompareArrows className="w-5 h-5 text-[#4f7cff]" />{" "}
        {t("an.correlationMatrix")}
      </h2>
      <div className="overflow-x-auto">
        <div className="min-w-[400px]">
          <table className="w-full text-xs">
            <thead>
              <tr>
                <th className="p-1.5" />
                {names.map((n) => (
                  <th
                    key={n}
                    className="p-1.5 font-medium text-white/60 truncate max-w-[90px]"
                  >
                    {n}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {names.map((row) => (
                <tr key={row}>
                  <td className="p-1.5 text-white/60 truncate max-w-[110px]">
                    {row}
                  </td>
                  {names.map((col) => {
                    const cell = correlation.find(
                      (c) => c.row === row && c.col === col,
                    );
                    const v = cell ? cell.value : 0;
                    const alpha = Math.min(1, Math.abs(v) + 0.15);
                    const bg =
                      v >= 0
                        ? `rgba(52,211,153,${alpha})`
                        : `rgba(96,165,250,${alpha})`;
                    return (
                      <td
                        key={col}
                        className="p-1.5 text-center text-white rounded-md"
                        style={{ backgroundColor: bg }}
                        title={`${row} ↔ ${col}: ${v}`}
                      >
                        {v.toFixed(2)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-4 text-xs text-white/50">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-emerald-400/60" />{" "}
          {t("an.positiveCorrelation")}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-blue-400/60" />{" "}
          {t("an.negativeCorrelation")}
        </span>
        <span className="text-white/30">{t("an.correlationLegend")}</span>
      </div>
    </div>
  );
}

function FilterBuilder({
  options,
  rules,
  onChange,
  onApply,
  onClear,
}: {
  options: FilterOption[];
  rules: FilterRule[];
  onChange: (rules: FilterRule[]) => void;
  onApply: () => void;
  onClear: () => void;
}) {
  const { t } = useAppSettings();
  const [col, setCol] = useState("");
  const [op, setOp] = useState<"in" | "gte" | "lte" | "between">("in");
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [numA, setNumA] = useState("");
  const [numB, setNumB] = useState("");

  const colMeta = options.find((o) => o.column === col);
  const numeric = colMeta?.kind === "numeric";

  const addRule = () => {
    if (!col) return;
    if (numeric) {
      if (op === "between") {
        if (!numA || !numB) return;
        onChange([
          ...rules,
          { column: col, op, value: [Number(numA), Number(numB)] },
        ]);
      } else if (numA) {
        onChange([...rules, { column: col, op, value: numA }]);
      }
    } else {
      if (sel.size === 0) return;
      onChange([...rules, { column: col, op: "in", value: Array.from(sel) }]);
    }
    setSel(new Set());
    setNumA("");
    setNumB("");
    setCol("");
  };

  const removeRule = (i: number) =>
    onChange(rules.filter((_, idx) => idx !== i));

  const toggleValue = (v: string) => {
    const next = new Set(sel);
    if (next.has(v)) next.delete(v);
    else next.add(v);
    setSel(next);
  };

  return (
    <div className="border border-white/10 rounded-3xl bg-white/[0.02] p-5">
      <div className="flex items-center gap-2 mb-3">
        <SlidersHorizontal className="w-5 h-5 text-sky-400" />
        <h2 className="font-semibold">{t("an.filterTitle")}</h2>
        {rules.length > 0 && (
          <span className="text-xs bg-sky-500/15 border border-sky-500/30 text-sky-300 rounded-full px-2 py-0.5">
            {t("an.activeFilters", { n: rules.length })}
          </span>
        )}
      </div>

      {rules.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {rules.map((r, i) => (
            <span
              key={i}
              className="flex items-center gap-2 text-xs bg-sky-500/10 border border-sky-500/25 text-sky-200 rounded-full px-3 py-1.5"
            >
              {r.column}{" "}
              {Array.isArray(r.value)
                ? `[${r.value.join(", ")}]`
                : ` ${r.op} ${r.value}`}
              <button
                onClick={() => removeRule(i)}
                className="text-sky-300 hover:text-red-400 transition"
                aria-label={t("an.removeFilter")}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="flex flex-col md:flex-row gap-3 flex-wrap">
        <select
          value={col}
          onChange={(e) => {
            setCol(e.target.value);
            setOp(
              options.find((o) => o.column === e.target.value)?.kind ===
                "numeric"
                ? "gte"
                : "in",
            );
          }}
          className="bg-white/[0.04] border border-white/15 rounded-xl px-3 py-2 text-sm outline-none focus:border-sky-400/60"
        >
          <option value="">{t("an.chooseColumn")}</option>
          {options.map((o) => (
            <option key={o.column} value={o.column}>
              {o.column} (
              {o.kind === "numeric" ? t("an.numeric") : t("an.categorical")})
            </option>
          ))}
        </select>

        {numeric && (
          <select
            value={op}
            onChange={(e) => setOp(e.target.value as "gte" | "lte" | "between")}
            className="bg-white/[0.04] border border-white/15 rounded-xl px-3 py-2 text-sm outline-none focus:border-sky-400/60"
          >
            <option value="gte">≥ {t("an.operatorGte")}</option>
            <option value="lte">≤ {t("an.operatorLte")}</option>
            <option value="between">{t("an.betweenTwoValues")}</option>
          </select>
        )}

        {numeric && op === "between" ? (
          <div className="flex gap-2">
            <input
              type="number"
              value={numA}
              onChange={(e) => setNumA(e.target.value)}
              placeholder={t("an.from")}
              className="w-28 bg-white/[0.04] border border-white/15 rounded-xl px-3 py-2 text-sm outline-none focus:border-sky-400/60"
            />
            <input
              type="number"
              value={numB}
              onChange={(e) => setNumB(e.target.value)}
              placeholder={t("an.to")}
              className="w-28 bg-white/[0.04] border border-white/15 rounded-xl px-3 py-2 text-sm outline-none focus:border-sky-400/60"
            />
          </div>
        ) : numeric ? (
          <input
            type="number"
            value={numA}
            onChange={(e) => setNumA(e.target.value)}
            placeholder={t("an.value")}
            className="w-32 bg-white/[0.04] border border-white/15 rounded-xl px-3 py-2 text-sm outline-none focus:border-sky-400/60"
          />
        ) : (
          <div className="flex-1 flex flex-wrap gap-1.5 items-center min-w-[200px]">
            {(colMeta?.values || []).slice(0, 12).map((v) => {
              const active = sel.has(v.value);
              return (
                <button
                  key={v.value}
                  type="button"
                  onClick={() => toggleValue(v.value)}
                  className={`text-xs px-2.5 py-1 rounded-full border transition ${
                    active
                      ? "bg-sky-500/20 border-sky-500/50 text-sky-200"
                      : "border-white/10 text-white/50 hover:border-white/25"
                  }`}
                >
                  {v.value} ({v.count})
                </button>
              );
            })}
          </div>
        )}

        <button
          onClick={addRule}
          className="bg-sky-500/15 border border-sky-500/40 text-sky-300 hover:bg-sky-500/25 text-sm font-medium px-4 py-2 rounded-xl flex items-center gap-1.5 transition"
        >
          <Plus className="w-4 h-4" /> {t("an.add")}
        </button>
      </div>

      <div className="flex gap-3 mt-4">
        <button
          onClick={onApply}
          disabled={rules.length === 0}
          className="bg-gradient-to-r from-[#0ea5e9] to-[#6366f1] hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium px-5 py-2.5 rounded-xl flex items-center gap-2 transition shadow-lg shadow-blue-500/20"
        >
          <Filter className="w-4 h-4" /> {t("an.applyFilters")}
        </button>
        {rules.length > 0 && (
          <button
            onClick={onClear}
            className="border border-white/15 text-white/60 hover:text-white hover:bg-white/5 px-4 py-2.5 rounded-xl text-sm flex items-center gap-2 transition"
          >
            <FilterX className="w-4 h-4" /> {t("an.clearAll")}
          </button>
        )}
      </div>
    </div>
  );
}

function RecommendationsView({
  recommendations,
  insights,
}: {
  recommendations?: string[];
  insights?: string[];
}) {
  const { t } = useAppSettings();
  return (
    <div className="space-y-6">
      {recommendations && recommendations.length > 0 && (
        <div className="border border-white/10 rounded-3xl bg-white/[0.02] p-5">
          <h2 className="font-semibold flex items-center gap-2 mb-4">
            <Lightbulb className="w-5 h-5 text-amber-400" />{" "}
            {t("an.actionableRecommendations")}
          </h2>
          <ul className="space-y-2">
            {recommendations.map((rec, i) => (
              <li
                key={i}
                className="flex items-start gap-2 text-sm text-white/85 bg-amber-500/[0.06] border border-amber-500/15 rounded-xl px-3 py-2.5"
              >
                <span className="text-amber-400 mt-0.5 shrink-0">💡</span>
                <span>{rec}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {insights && insights.length > 0 && (
        <div className="border border-white/10 rounded-3xl bg-white/[0.02] p-5">
          <h2 className="font-semibold flex items-center gap-2 mb-4">
            <Activity className="w-5 h-5 text-[#4f7cff]" />{" "}
            {t("an.autoInsights")}
          </h2>
          <ul className="space-y-2">
            {insights.map((ins, i) => (
              <li
                key={i}
                className="flex items-start gap-2 text-sm text-white/80 bg-white/[0.03] border border-white/5 rounded-xl px-3 py-2"
              >
                <span className="text-[#4f7cff] mt-0.5 shrink-0">✦</span>
                <span>{ins}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export const dynamic = "force-dynamic";
