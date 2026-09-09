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
  RadialBarChart,
  RadialBar,
  PolarGrid,
} from "recharts";
import {
  UploadCloud,
  Loader2,
  PieChart as PieIcon,
  Activity,
  TrendingUp,
  AlertTriangle,
  Layers,
  LayoutGrid,
  FileSpreadsheet,
  GitCompareArrows,
} from "lucide-react";
import { authHeaders } from "@/lib/auth";
import { useAppSettings } from "@/components/providers/app-providers";

interface HistBin {
  bin: number;
  count: number;
}
interface ColStat {
  name: string;
  dtype: string;
  histogram?: HistBin[];
  top_values?: { value: string; count: number }[];
  boxplot?: {
    min: number;
    q1: number;
    median: number;
    q3: number;
    max: number;
    whisker_low: number;
    whisker_high: number;
  };
  outliers_count?: number;
  outliers_pct?: number;
  nulls: number;
}
interface AnalysisResult {
  dataset?: { file_name?: string };
  rows: number;
  column_count: number;
  columns: ColStat[];
  correlation: { row: string; col: string; value: number }[];
  scatter?: {
    x_col: string;
    y_col: string;
    points: { x: number; y: number }[];
  }[];
  group_by?: {
    column: string;
    groups: { value: string; count: number; pct?: number }[];
  }[];
}

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
const tooltipStyle = {
  background: "rgba(10,15,30,0.95)",
  border: "1px solid rgba(255,255,255,0.15)",
  borderRadius: 12,
  fontSize: 12,
};

function Card({
  title,
  subtitle,
  desc,
  children,
}: {
  title: string;
  subtitle?: string;
  desc?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border border-white/10 rounded-3xl bg-white/[0.02] p-5 flex flex-col">
      <p className="font-medium text-sm mb-1">{title}</p>
      {subtitle && <p className="text-xs text-white/50 mb-3">{subtitle}</p>}
      {desc && <p className="text-xs text-white/40 mb-3">{desc}</p>}
      <div className="h-56 flex-1">{children}</div>
    </div>
  );
}

function ChartSection({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof Activity;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-4">
      <h2 className="font-semibold flex items-center gap-2 px-1">
        <Icon className="w-5 h-5 text-[#4f7cff]" /> {title}
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{children}</div>
    </div>
  );
}

export default function ChartsPage() {
  const { t } = useAppSettings();
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const runAnalysis = async (f: File) => {
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const form = new FormData();
      form.append("file", f);
      const res = await fetch("/api/analyze-data", {
        method: "POST",
        headers: authHeaders(),
        body: form,
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || data.detail || t("rep.builderError"));
      } else {
        setResult(data as AnalysisResult);
      }
    } catch {
      setError(t("rep.builderConnFailed"));
    } finally {
      setLoading(false);
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

  const histData = (c: ColStat) =>
    (c.histogram || []).map((h, i) => ({
      name: `[${h.bin.toFixed(1)}]`,
      count: h.count,
      key: i,
    }));

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="border border-white/10 rounded-3xl bg-white/[0.02] p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#4f7cff] to-[#8b5cf6] flex items-center justify-center shadow-lg shadow-blue-500/25">
            <PieIcon className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">
              {t("ch.title")}
            </h1>
            <p className="text-sm text-white/60">{t("ch.subtitle")}</p>
          </div>
        </div>
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
              if (f) runAnalysis(f);
            }}
          />
          <FileSpreadsheet className="h-12 w-12 text-[#4f7cff] mx-auto mb-3" />
          <p className="font-medium">{file ? file.name : t("ch.drop")}</p>
          <p className="text-sm text-white/40 mt-1">{t("ch.dropDesc")}</p>
        </div>
        <div className="flex justify-center mt-4">
          <button
            onClick={() => file && runAnalysis(file)}
            disabled={!file || loading}
            className="bg-gradient-to-r from-[#4f7cff] to-[#8b5cf6] hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium px-6 py-3 rounded-xl flex items-center gap-2 shadow-lg shadow-blue-500/25 transition"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />{" "}
                {t("ch.generating")}
              </>
            ) : (
              <>
                <UploadCloud className="w-5 h-5" /> {t("ch.generate")}
              </>
            )}
          </button>
        </div>
        {error && (
          <div className="mt-4 bg-red-500/10 border border-red-500/30 text-red-400 text-sm px-4 py-3 rounded-2xl">
            {error}
          </div>
        )}
      </div>

      {result && (
        <div className="space-y-10">
          {/* Histogram */}
          {numericCols.length > 0 && (
            <ChartSection icon={Activity} title={t("ch.histogram")}>
              {numericCols.map((c) => (
                <Card
                  key={`h-${c.name}`}
                  title={c.name}
                  subtitle={t("ch.histogramSub")}
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={histData(c)}>
                      <CartesianGrid stroke="rgba(255,255,255,0.05)" />
                      <XAxis
                        dataKey="name"
                        stroke="rgba(255,255,255,0.3)"
                        fontSize={9}
                        interval={1}
                      />
                      <YAxis stroke="rgba(255,255,255,0.3)" fontSize={10} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Bar dataKey="count" radius={[5, 5, 0, 0]}>
                        {histData(c).map((d) => (
                          <Cell
                            key={d.key}
                            fill={BAR_COLORS[d.key % BAR_COLORS.length]}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </Card>
              ))}
            </ChartSection>
          )}

          {/* Box plot */}
          {numericCols.some((c) => c.boxplot) && (
            <ChartSection icon={AlertTriangle} title={t("ch.boxplot")}>
              {numericCols
                .filter((c) => c.boxplot)
                .map((c) => {
                  const b = c.boxplot!;
                  return (
                    <Card
                      key={`b-${c.name}`}
                      title={c.name}
                      desc={
                        c.outliers_count
                          ? t("ch.outlierCount", {
                              n: c.outliers_count,
                              pct: c.outliers_pct ?? 0,
                            })
                          : t("ch.noOutliers")
                      }
                    >
                      <BoxPlot data={b} name={c.name} />
                    </Card>
                  );
                })}
            </ChartSection>
          )}

          {/* Pie */}
          {categoricalCols.length > 0 && (
            <ChartSection icon={PieIcon} title={t("ch.pie")}>
              {categoricalCols.slice(0, 4).map((c) => (
                <Card
                  key={`p-${c.name}`}
                  title={c.name}
                  subtitle={t("ch.pieSub")}
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={c.top_values}
                        dataKey="count"
                        nameKey="value"
                        cx="50%"
                        cy="50%"
                        innerRadius={40}
                        outerRadius={75}
                        label={({ percent }) =>
                          `${Math.round(((percent as number) || 0) * 100)}%`
                        }
                        labelLine={false}
                      >
                        {c.top_values?.map((_, i) => (
                          <Cell
                            key={i}
                            fill={BAR_COLORS[i % BAR_COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={tooltipStyle} />
                      <Legend wrapperStyle={{ fontSize: 10 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </Card>
              ))}
            </ChartSection>
          )}

          {/* Line */}
          {numericCols.length > 0 && (
            <ChartSection icon={TrendingUp} title={t("ch.line")}>
              {numericCols.slice(0, 2).map((c) => (
                <Card
                  key={`l-${c.name}`}
                  title={c.name}
                  subtitle={t("ch.lineSub")}
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={histData(c)}>
                      <CartesianGrid stroke="rgba(255,255,255,0.05)" />
                      <XAxis
                        dataKey="name"
                        stroke="rgba(255,255,255,0.3)"
                        fontSize={9}
                        interval={1}
                      />
                      <YAxis stroke="rgba(255,255,255,0.3)" fontSize={10} />
                      <Tooltip contentStyle={tooltipStyle} />
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
                </Card>
              ))}
            </ChartSection>
          )}

          {/* Area / cumulative */}
          {numericCols.length > 0 && (
            <ChartSection icon={TrendingUp} title={t("ch.area")}>
              {numericCols.slice(0, 2).map((c) => {
                let cum = 0;
                const data = (c.histogram || []).map((h) => {
                  cum += h.count;
                  return { name: h.bin.toFixed(1), cumulative: cum };
                });
                return (
                  <Card
                    key={`a-${c.name}`}
                    title={c.name}
                    subtitle={t("ch.areaSub")}
                  >
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={data}>
                        <defs>
                          <linearGradient
                            id={`ag-${c.name}`}
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
                          dataKey="name"
                          stroke="rgba(255,255,255,0.3)"
                          fontSize={9}
                          interval={1}
                        />
                        <YAxis stroke="rgba(255,255,255,0.3)" fontSize={10} />
                        <Tooltip contentStyle={tooltipStyle} />
                        <Area
                          type="monotone"
                          dataKey="cumulative"
                          stroke="#4f7cff"
                          fill={`url(#ag-${c.name})`}
                          strokeWidth={2}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </Card>
                );
              })}
            </ChartSection>
          )}

          {/* Scatter */}
          {result.scatter && result.scatter.length > 0 && (
            <ChartSection icon={Activity} title={t("ch.scatter")}>
              {result.scatter.map((s) => (
                <Card
                  key={`s-${s.x_col}-${s.y_col}`}
                  title={`${s.x_col} × ${s.y_col}`}
                  subtitle={t("ch.scatterSub")}
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <ScatterChart
                      margin={{ top: 10, right: 10, bottom: 10, left: 10 }}
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
                      <Tooltip contentStyle={tooltipStyle} />
                      <Scatter data={s.points} fill="#4f7cff" />
                    </ScatterChart>
                  </ResponsiveContainer>
                </Card>
              ))}
            </ChartSection>
          )}

          {/* Correlation heatmap */}
          {result.correlation && result.correlation.length > 0 && (
            <div className="space-y-4">
              <h2 className="font-semibold flex items-center gap-2 px-1">
                <GitCompareArrows className="w-5 h-5 text-[#4f7cff]" />{" "}
                {t("ch.heatmap")}
              </h2>
              <CorrelationHeatmap correlation={result.correlation} />
            </div>
          )}

          {/* Group by (vertical bar) */}
          {result.group_by && result.group_by.length > 0 && (
            <ChartSection icon={Layers} title={t("ch.groupby")}>
              {result.group_by.map((g) => (
                <Card
                  key={`g-${g.column}`}
                  title={g.column}
                  subtitle={t("ch.groupbySub")}
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={g.groups.map((gr) => ({
                        value: String(gr.value),
                        pct: gr.pct ?? 0,
                      }))}
                      layout="vertical"
                      margin={{ left: 8, right: 16 }}
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
                      <Tooltip contentStyle={tooltipStyle} />
                      <Bar dataKey="pct" fill="#4f7cff" radius={[0, 6, 6, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </Card>
              ))}
            </ChartSection>
          )}

          {/* Radial / Radar for numeric overview */}
          {numericCols.length >= 2 && (
            <ChartSection icon={LayoutGrid} title={t("ch.radial")}>
              {numericCols.slice(0, 2).map((c) => {
                const mean = (c.histogram || []).reduce(
                  (s, h) => s + h.count,
                  0,
                );
                const maxC = Math.max(
                  ...(c.histogram || []).map((h) => h.count),
                  1,
                );
                const data = (c.histogram || []).slice(0, 8).map((h, i) => ({
                  name: h.bin.toFixed(1),
                  value: Math.round((h.count / maxC) * 100),
                  fill: BAR_COLORS[i % BAR_COLORS.length],
                }));
                void mean;
                if (data.length < 2) return null;
                return (
                  <Card
                    key={`r-${c.name}`}
                    title={c.name}
                    subtitle={t("ch.radialSub")}
                  >
                    <ResponsiveContainer width="100%" height="100%">
                      <RadialBarChart
                        innerRadius="25%"
                        outerRadius="95%"
                        data={data}
                        startAngle={90}
                        endAngle={-270}
                      >
                        <PolarGrid />
                        <RadialBar
                          dataKey="value"
                          background={{ fill: "rgba(255,255,255,0.05)" }}
                        />
                        <Legend wrapperStyle={{ fontSize: 9 }} />
                        <Tooltip contentStyle={tooltipStyle} />
                      </RadialBarChart>
                    </ResponsiveContainer>
                  </Card>
                );
              })}
            </ChartSection>
          )}
        </div>
      )}
    </div>
  );
}

function BoxPlot({
  data,
  name,
}: {
  data: {
    min: number;
    q1: number;
    median: number;
    q3: number;
    max: number;
    whisker_low: number;
    whisker_high: number;
  };
  name: string;
}) {
  const rows = [
    { name: "Max", value: data.max },
    { name: "Q3", value: data.q3 },
    { name: "Median", value: data.median },
    { name: "Q1", value: data.q1 },
    { name: "Min", value: data.min },
  ];
  void name;
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={rows} layout="vertical" margin={{ left: 20, right: 16 }}>
        <XAxis
          type="number"
          stroke="rgba(255,255,255,0.3)"
          fontSize={10}
          domain={["dataMin", "dataMax"]}
        />
        <YAxis
          type="category"
          dataKey="name"
          width={60}
          stroke="rgba(255,255,255,0.3)"
          fontSize={10}
        />
        <Tooltip contentStyle={tooltipStyle} />
        <Bar dataKey="value" fill="#4f7cff" radius={[6, 6, 6, 6]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function CorrelationHeatmap({
  correlation,
}: {
  correlation: { row: string; col: string; value: number }[];
}) {
  const { t } = useAppSettings();
  const names = Array.from(new Set(correlation.map((c) => c.row)));
  const heatColor = (v: number) => {
    const a = Math.abs(v);
    if (v >= 0) return `rgba(79,124,255,${0.2 + a * 0.8})`;
    return `rgba(59,130,246,${0.2 + a * 0.8})`;
  };
  if (names.length < 2) {
    return (
      <div className="border border-white/10 rounded-3xl bg-white/[0.02] p-8 text-center text-white/50 text-sm">
        {t("ch.noNumeric")}
      </div>
    );
  }
  return (
    <div className="border border-white/10 rounded-3xl bg-white/[0.02] p-5 overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr>
            <th className="p-1.5" />
            {names.map((n) => (
              <th key={n} className="p-1.5 text-white/60 truncate max-w-[90px]">
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
                const entry = correlation.find(
                  (c) => c.row === row && c.col === col,
                );
                const val = entry ? entry.value : null;
                return (
                  <td key={col} className="p-0">
                    <div
                      className="h-9 min-w-[64px] flex items-center justify-center rounded-lg mx-0.5 text-white"
                      style={{
                        background:
                          val == null ? "transparent" : heatColor(val),
                      }}
                      title={val == null ? "—" : `${String(val)}`}
                    >
                      {val == null ? "·" : val.toFixed(2)}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
