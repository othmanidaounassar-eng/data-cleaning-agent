"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import {
  UploadCloud,
  Loader2,
  Plus,
  Trash2,
  Maximize2,
  Minimize2,
  BarChart3,
  Download,
  X,
  GripVertical,
  Settings,
  Filter,
  EyeOff,
  Link2,
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
  Legend,
  LineChart,
  Line,
  ScatterChart,
  Scatter,
  AreaChart,
  Area,
  CartesianGrid,
  ZAxis,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
} from "recharts";
import Papa from "papaparse";
import ExcelJS from "exceljs";
import { useDataLink, UseLinkedData, type LinkedDataset } from "./data-link";
import { rememberProject, rememberAction } from "@/lib/learning-store";

const COLORS = [
  "#4f7cff",
  "#8b5cf6",
  "#38bdf8",
  "#34d399",
  "#a78bfa",
  "#fb7185",
  "#facc15",
  "#4ade80",
  "#f472b6",
  "#22d3ee",
  "#e879f9",
  "#fbbf24",
];
const CHART_BG = "rgba(10,15,30,0.6)";
const tooltipStyle = {
  background: CHART_BG,
  border: "1px solid rgba(255,255,255,0.15)",
  borderRadius: 10,
  fontSize: 11,
};

type ChartType =
  | "bar"
  | "pie"
  | "line"
  | "area"
  | "scatter"
  | "radar"
  | "donut";

interface ChartWidget {
  id: string;
  type: ChartType;
  title: string;
  xCol: string;
  yCol: string;
  color: string;
  visible: boolean;
  minimized: boolean;
}

interface FilterState {
  column: string;
  values: Set<string>;
}

let widgetId = 0;
function nextId() {
  return `w_${++widgetId}_${Date.now().toString(36)}`;
}

/* ─── helpers ─── */
function dlBlob(blob: Blob, name: string) {
  const u = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = u;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(u);
}

function aggregate(
  rows: Record<string, unknown>[],
  xCol: string,
  yCol: string,
) {
  const map = new Map<string, { x: string; y: number; count: number }>();
  for (const r of rows) {
    const x = String(r[xCol] ?? "N/A");
    const yNum = Number(r[yCol]);
    const entry = map.get(x) || { x, y: 0, count: 0 };
    if (!Number.isNaN(yNum)) {
      entry.y += yNum;
      entry.count++;
    }
    map.set(x, entry);
  }
  return Array.from(map.values())
    .slice(0, 30)
    .map((e) => ({
      name: e.x.length > 15 ? e.x.substring(0, 15) + "…" : e.x,
      value: e.count > 0 ? Math.round((e.y / e.count) * 100) / 100 : 0,
      count: e.count,
    }));
}

function countBy(rows: Record<string, unknown>[], col: string) {
  const map = new Map<string, number>();
  for (const r of rows) {
    const k = String(r[col] ?? "N/A");
    map.set(k, (map.get(k) || 0) + 1);
  }
  return Array.from(map.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([name, value]) => ({
      name: name.length > 12 ? name.substring(0, 12) + "…" : name,
      value,
    }));
}

function scatterData(
  rows: Record<string, unknown>[],
  xCol: string,
  yCol: string,
) {
  return rows
    .slice(0, 500)
    .map((r) => ({
      x: Number(r[xCol]) || 0,
      y: Number(r[yCol]) || 0,
      name: String(r[xCol] ?? ""),
    }))
    .filter((p) => p.x !== 0 || p.y !== 0);
}

/* ═══════════════════════════════════════════════════════════════
   POWER BI VIEWER
   ═══════════════════════════════════════════════════════════════ */
export function PowerBIViewer({
  onDataChange,
}: {
  onDataChange?: (data: {
    headers: string[];
    rows: Record<string, unknown>[];
    fileName: string;
  }) => void;
} = {}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const { publish } = useDataLink();

  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [fileName, setFileName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [widgets, setWidgets] = useState<ChartWidget[]>([]);
  const [maximizedId, setMaximizedId] = useState<string | null>(null);
  const [showWidgetBuilder, setShowWidgetBuilder] = useState(false);

  // New widget form
  const [newType, setNewType] = useState<ChartType>("bar");
  const [newTitle, setNewTitle] = useState("");
  const [newXCol, setNewXCol] = useState("");
  const [newYCol, setNewYCol] = useState("");
  const [newColor, setNewColor] = useState(COLORS[0]);

  // Filters
  const [filters, setFilters] = useState<FilterState[]>([]);

  const filteredRows = useMemo(() => {
    if (filters.length === 0) return rows;
    return rows.filter((r) =>
      filters.every(
        (f) => f.values.size === 0 || f.values.has(String(r[f.column] ?? "")),
      ),
    );
  }, [rows, filters]);

  // ─── Load file ───
  const loadFile = useCallback(
    async (f: File | null) => {
      if (!f) return;
      setLoading(true);
      setError("");
      setWidgets([]);
      setFilters([]);
      try {
        const ext = f.name.split(".").pop()?.toLowerCase() || "";
        if (ext === "csv") {
          const text = await f.text();
          const parsed = Papa.parse(text, {
            header: true,
            skipEmptyLines: true,
            dynamicTyping: false,
          });
          if (!parsed.meta.fields) throw new Error("bad");
          const h = parsed.meta.fields.filter(Boolean);
          const data = (parsed.data as Record<string, unknown>[]).map((r) => {
            const obj: Record<string, unknown> = {};
            for (const c of h) {
              const v = r[c];
              obj[c] = v === "" || v == null ? null : v;
            }
            return obj;
          });
          setHeaders(h);
          setRows(data);
          setFileName(f.name);
          onDataChange?.({ headers: h, rows: data, fileName: f.name });
          publish({
            headers: h,
            rows: data,
            fileName: f.name,
            source: "powerbi",
          });
          rememberProject({ fileName: f.name, rows: data.length, headers: h });
          rememberAction(f.name, {
            type: "view",
            detail: "opened in Power BI viewer",
            at: Date.now(),
          });
          // Auto-create default widgets
          const cats = h.filter(
            (c) =>
              !data
                .slice(0, 50)
                .some((r) => !Number.isNaN(Number(r[c])) && r[c] != null),
          );
          const nums = h.filter((c) =>
            data
              .slice(0, 50)
              .some((r) => !Number.isNaN(Number(r[c])) && r[c] != null),
          );
          if (cats.length > 0 && nums.length > 0) {
            setWidgets([
              {
                id: nextId(),
                type: "bar",
                title: `متوسط ${nums[0]} حسب ${cats[0]}`,
                xCol: cats[0],
                yCol: nums[0],
                color: COLORS[0],
                visible: true,
                minimized: false,
              },
              {
                id: nextId(),
                type: "pie",
                title: `توزيع ${cats[0]}`,
                xCol: cats[0],
                yCol: nums[0] || cats[0],
                color: COLORS[1],
                visible: true,
                minimized: false,
              },
              {
                id: nextId(),
                type: "line",
                title: ` trend ${nums[0]}`,
                xCol: cats[0],
                yCol: nums[0],
                color: COLORS[2],
                visible: true,
                minimized: false,
              },
            ]);
          }
        } else {
          const buf = await f.arrayBuffer();
          const wb = new ExcelJS.Workbook();
          await wb.xlsx.load(buf);
          const ws = wb.worksheets[0];
          if (!ws) throw new Error("empty");
          const all: unknown[][] = [];
          ws.eachRow({ includeEmpty: false }, (row) =>
            all.push((row.values as unknown[]).slice(1)),
          );
          if (!all.length) throw new Error("empty");
          const h: string[] = [];
          all[0].forEach((c) => {
            const s = c == null ? "" : String(c).trim();
            if (s) h.push(s);
          });
          const data: Record<string, unknown>[] = [];
          for (const r of all.slice(1)) {
            const obj: Record<string, unknown> = {};
            h.forEach((col, idx) => {
              const v = r[idx] ?? null;
              obj[col] =
                v === "" ? null : typeof v === "object" ? JSON.stringify(v) : v;
            });
            data.push(obj);
          }
          setHeaders(h);
          setRows(data);
          setFileName(f.name);
          onDataChange?.({ headers: h, rows: data, fileName: f.name });
          publish({
            headers: h,
            rows: data,
            fileName: f.name,
            source: "powerbi",
          });
          rememberProject({ fileName: f.name, rows: data.length, headers: h });
          rememberAction(f.name, {
            type: "view",
            detail: "opened in Power BI viewer",
            at: Date.now(),
          });
        }
      } catch {
        setError("فشل في تحليل الملف.");
      } finally {
        setLoading(false);
      }
    },
    [onDataChange, publish],
  );

  // ─── Apply a shared/linked dataset & auto-build widgets ───
  const applyLinkedData = useCallback(
    (ds: LinkedDataset) => {
      setHeaders(ds.headers);
      setRows(ds.rows);
      setFileName(ds.fileName);
      setFilters([]);
      setWidgets([]);
      const cats = ds.headers.filter(
        (c) =>
          !ds.rows
            .slice(0, 50)
            .some((r) => !Number.isNaN(Number(r[c])) && r[c] != null),
      );
      const nums = ds.headers.filter((c) =>
        ds.rows
          .slice(0, 50)
          .some((r) => !Number.isNaN(Number(r[c])) && r[c] != null),
      );
      if (cats.length > 0 && nums.length > 0) {
        setWidgets([
          {
            id: nextId(),
            type: "bar",
            title: `متوسط ${nums[0]} حسب ${cats[0]}`,
            xCol: cats[0],
            yCol: nums[0],
            color: COLORS[0],
            visible: true,
            minimized: false,
          },
          {
            id: nextId(),
            type: "pie",
            title: `توزيع ${cats[0]}`,
            xCol: cats[0],
            yCol: nums[0] || cats[0],
            color: COLORS[1],
            visible: true,
            minimized: false,
          },
          {
            id: nextId(),
            type: "line",
            title: `اتجاه ${nums[0]}`,
            xCol: cats[0],
            yCol: nums[0],
            color: COLORS[2],
            visible: true,
            minimized: false,
          },
        ]);
      } else if (cats.length > 0) {
        setWidgets([
          {
            id: nextId(),
            type: "pie",
            title: `توزيع ${cats[0]}`,
            xCol: cats[0],
            yCol: cats[0],
            color: COLORS[1],
            visible: true,
            minimized: false,
          },
        ]);
      }
      publish({
        headers: ds.headers,
        rows: ds.rows,
        fileName: ds.fileName,
        source: "powerbi",
      });
      rememberProject({
        fileName: ds.fileName,
        rows: ds.rows.length,
        headers: ds.headers,
      });
      rememberAction(ds.fileName, {
        type: "chart",
        detail: "linked data visualized in Power BI",
        at: Date.now(),
      });
    },
    [publish],
  );

  // ─── Add widget ───
  const addWidget = () => {
    if (!newXCol) return;
    const w: ChartWidget = {
      id: nextId(),
      type: newType,
      title: newTitle || `${newType} - ${newXCol}`,
      xCol: newXCol,
      yCol: newYCol || newXCol,
      color: newColor,
      visible: true,
      minimized: false,
    };
    setWidgets((prev) => [...prev, w]);
    setShowWidgetBuilder(false);
    setNewTitle("");
    setNewXCol("");
    setNewYCol("");
  };

  const removeWidget = (id: string) =>
    setWidgets((prev) => prev.filter((w) => w.id !== id));
  const toggleWidget = (id: string) =>
    setWidgets((prev) =>
      prev.map((w) => (w.id === id ? { ...w, visible: !w.visible } : w)),
    );
  const toggleMinimize = (id: string) =>
    setWidgets((prev) =>
      prev.map((w) => (w.id === id ? { ...w, minimized: !w.minimized } : w)),
    );

  // ─── Export ───
  const exportPng = async (id: string) => {
    const el = document.getElementById(`chart-${id}`);
    if (!el) return;
    try {
      const html2canvas = (await import("html2canvas")).default;
      const canvas = await html2canvas(el, { backgroundColor: "#0f172a" });
      canvas.toBlob((blob) => {
        if (blob) dlBlob(blob, `chart-${id}.png`);
      });
    } catch {
      /* ignore */
    }
  };

  // ─── KPI Summary ───
  const kpis = useMemo(() => {
    if (filteredRows.length === 0) return null;
    const totalRows = filteredRows.length;
    const nullCount = headers.reduce(
      (sum, h) =>
        sum + filteredRows.filter((r) => r[h] == null || r[h] === "").length,
      0,
    );
    const totalCells = totalRows * headers.length;
    const completeness =
      totalCells > 0
        ? Math.round(((totalCells - nullCount) / totalCells) * 100)
        : 100;
    return { totalRows, columns: headers.length, nullCount, completeness };
  }, [filteredRows, headers]);

  const addFilter = (col: string) => {
    if (filters.some((f) => f.column === col)) return;
    setFilters((prev) => [...prev, { column: col, values: new Set() }]);
  };
  const removeFilter = (col: string) =>
    setFilters((prev) => prev.filter((f) => f.column !== col));
  const toggleFilterValue = (col: string, val: string) => {
    setFilters((prev) =>
      prev.map((f) => {
        if (f.column !== col) return f;
        const next = new Set(f.values);
        if (next.has(val)) next.delete(val);
        else next.add(val);
        return { ...f, values: next };
      }),
    );
  };

  // ═══ RENDER ═══
  if (rows.length === 0) {
    return (
      <div className="border border-white/10 rounded-3xl bg-white/[0.02] p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#f2c811] to-[#f2994a] flex items-center justify-center shrink-0 shadow-lg shadow-yellow-500/20">
            <BarChart3 className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="font-semibold flex items-center gap-2">
              <span className="text-[#f2c811]">Power BI</span> لوحة التحكم
            </h2>
            <p className="text-xs text-white/50">
              ارفع ملفاً لإنشاء داشبورد تفاعلي بالرسوم البيانية
            </p>
          </div>
        </div>
        <div
          className="border-2 border-dashed border-[#f2c811]/40 rounded-2xl p-8 text-center cursor-pointer hover:bg-[#f2c811]/5 transition"
          onClick={() => inputRef.current?.click()}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            className="hidden"
            onChange={(e) => loadFile(e.target.files?.[0] || null)}
          />
          <BarChart3 className="h-12 w-12 text-[#f2c811] mx-auto mb-3" />
          <p className="font-medium">اسحب ملفك هنا أو انقر للاختيار</p>
          <p className="text-sm text-white/40 mt-1">يدعم CSV, XLSX, XLS</p>
        </div>
        <div className="mt-4 flex items-center gap-3 flex-wrap">
          <UseLinkedData onApply={applyLinkedData} />
        </div>
        {loading && (
          <div className="mt-4 flex items-center justify-center gap-2 text-[#f2c811]">
            <Loader2 className="w-5 h-5 animate-spin" /> جاري التحميل...
          </div>
        )}
        {error && (
          <div className="mt-4 bg-red-500/10 border border-red-500/30 text-red-400 text-sm px-4 py-3 rounded-2xl">
            {error}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="border border-white/10 rounded-3xl bg-white/[0.02] overflow-hidden">
      {/* ── Header ── */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#f2c811] to-[#f2994a] flex items-center justify-center shrink-0">
          <BarChart3 className="w-4 h-4 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="font-semibold text-sm truncate">{fileName}</h2>
          <p className="text-[10px] text-white/40">
            {filteredRows.length} صف · {headers.length} عمود ·{" "}
            {widgets.filter((w) => w.visible).length} رسوم
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => inputRef.current?.click()}
            className="text-[11px] flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white/60 hover:text-white hover:bg-white/10 transition"
          >
            <UploadCloud className="w-3 h-3" /> ملف جديد
          </button>
          <input
            ref={inputRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            className="hidden"
            onChange={(e) => {
              loadFile(e.target.files?.[0] || null);
              e.target.value = "";
            }}
          />
          <button
            onClick={() => setShowWidgetBuilder((v) => !v)}
            className="text-[11px] flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#f2c811]/15 border border-[#f2c811]/30 text-[#f2c811] hover:bg-[#f2c811]/25 transition"
          >
            <Plus className="w-3 h-3" /> رسم جديد
          </button>
        </div>
      </div>

      {/* ── KPI Cards ── */}
      {kpis && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 px-4 py-3 border-b border-white/10">
          {[
            {
              label: "إجمالي الصفوف",
              value: kpis.totalRows.toLocaleString(),
              color: "text-[#4f7cff]",
            },
            {
              label: "عدد الأعمدة",
              value: kpis.columns,
              color: "text-[#8b5cf6]",
            },
            {
              label: "القيم المفقودة",
              value: kpis.nullCount.toLocaleString(),
              color: "text-red-400",
            },
            {
              label: "اكتمال البيانات",
              value: `${kpis.completeness}%`,
              color: "text-emerald-400",
            },
          ].map((k) => (
            <div
              key={k.label}
              className="bg-white/[0.03] border border-white/10 rounded-xl px-3 py-2.5"
            >
              <div className={`text-lg font-bold ${k.color}`}>{k.value}</div>
              <div className="text-[10px] text-white/40">{k.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── Filters ── */}
      {filters.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 px-4 py-2 border-b border-white/10 bg-white/[0.01]">
          <Filter className="w-3.5 h-3.5 text-white/40" />
          {filters.map((f) => {
            const vals = [
              ...new Set(
                rows.map((r) => String(r[f.column] ?? "")).filter(Boolean),
              ),
            ].slice(0, 10);
            return (
              <div
                key={f.column}
                className="flex items-center gap-1 bg-white/[0.04] border border-white/10 rounded-lg px-2 py-1"
              >
                <span className="text-[10px] text-white/50">{f.column}:</span>
                {vals.map((v) => (
                  <button
                    key={v}
                    onClick={() => toggleFilterValue(f.column, v)}
                    className={`text-[9px] px-1.5 py-0.5 rounded transition ${f.values.has(v) ? "bg-[#f2c811]/20 text-[#f2c811]" : "text-white/40 hover:text-white/60"}`}
                  >
                    {v.length > 10 ? v.substring(0, 10) + "…" : v}
                  </button>
                ))}
                <button onClick={() => removeFilter(f.column)}>
                  <X className="w-3 h-3 text-white/30 hover:text-red-400" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Widget Builder ── */}
      {showWidgetBuilder && (
        <div className="mx-4 mt-3 border border-[#f2c811]/30 bg-[#f2c811]/5 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Settings className="w-4 h-4 text-[#f2c811]" />
            <span className="text-sm font-semibold text-[#f2c811]">
              إضافة رسم بياني جديد
            </span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="block text-[10px] text-white/50 mb-1">
                نوع الرسم
              </label>
              <select
                value={newType}
                onChange={(e) => setNewType(e.target.value as ChartType)}
                className="w-full bg-white/[0.04] border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white outline-none"
              >
                <option value="bar">Bar Chart</option>
                <option value="pie">Pie Chart</option>
                <option value="donut">Donut Chart</option>
                <option value="line">Line Chart</option>
                <option value="area">Area Chart</option>
                <option value="scatter">Scatter Plot</option>
                <option value="radar">Radar Chart</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] text-white/50 mb-1">
                العمود X (الفئة)
              </label>
              <select
                value={newXCol}
                onChange={(e) => setNewXCol(e.target.value)}
                className="w-full bg-white/[0.04] border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white outline-none"
              >
                <option value="">اختر...</option>
                {headers.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] text-white/50 mb-1">
                العمود Y (القيمة)
              </label>
              <select
                value={newYCol}
                onChange={(e) => setNewYCol(e.target.value)}
                className="w-full bg-white/[0.04] border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white outline-none"
              >
                <option value="">عدد / متوسط</option>
                {headers.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] text-white/50 mb-1">
                الاسم
              </label>
              <input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="اسم الرسم..."
                className="w-full bg-white/[0.04] border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white placeholder-white/25 outline-none"
              />
            </div>
          </div>
          <div className="flex items-center gap-2 mt-3">
            <div className="flex gap-1">
              {COLORS.slice(0, 8).map((c) => (
                <button
                  key={c}
                  onClick={() => setNewColor(c)}
                  className={`w-5 h-5 rounded-full border-2 transition ${newColor === c ? "border-white scale-110" : "border-transparent"}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
            <div className="flex-1" />
            <button
              onClick={() => setShowWidgetBuilder(false)}
              className="text-xs text-white/50 hover:text-white px-3 py-1.5"
            >
              إلغاء
            </button>
            <button
              onClick={addWidget}
              disabled={!newXCol}
              className="text-xs bg-[#f2c811] text-black font-medium px-4 py-1.5 rounded-lg hover:brightness-110 disabled:opacity-40 transition"
            >
              إضافة
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {headers.map((h) => {
              const isFiltered = filters.some((f) => f.column === h);
              return (
                <button
                  key={h}
                  onClick={() => (isFiltered ? removeFilter(h) : addFilter(h))}
                  className={`text-[9px] px-2 py-0.5 rounded-full border transition ${isFiltered ? "bg-[#f2c811]/15 border-[#f2c811]/40 text-[#f2c811]" : "border-white/10 text-white/40 hover:text-white/60"}`}
                >
                  <Link2 className="w-2.5 h-2.5 inline mr-0.5" />
                  {h}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Charts Grid ── */}
      <div
        className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4"
        style={{ minHeight: widgets.length === 0 ? "200px" : undefined }}
      >
        {widgets
          .filter((w) => w.visible)
          .map((w) => {
            const data =
              w.type === "scatter"
                ? scatterData(filteredRows, w.xCol, w.yCol)
                : w.type === "pie" || w.type === "donut"
                  ? countBy(filteredRows, w.xCol)
                  : aggregate(filteredRows, w.xCol, w.yCol);
            const isMax = maximizedId === w.id;
            return (
              <div
                key={w.id}
                id={`chart-${w.id}`}
                className={`bg-white/[0.02] border border-white/10 rounded-2xl overflow-hidden transition-all ${isMax ? "fixed inset-4 z-50" : w.minimized ? "h-12" : ""}`}
              >
                <div className="flex items-center gap-2 px-3 py-2 border-b border-white/10">
                  <GripVertical className="w-3.5 h-3.5 text-white/20 cursor-grab" />
                  <span className="text-xs font-medium text-white/70 flex-1 truncate">
                    {w.title}
                  </span>
                  <span className="text-[9px] text-white/30 bg-white/5 rounded px-1.5">
                    {w.type}
                  </span>
                  <button
                    onClick={() => toggleMinimize(w.id)}
                    className="p-1 rounded hover:bg-white/10"
                  >
                    <Minimize2 className="w-3 h-3 text-white/40" />
                  </button>
                  <button
                    onClick={() => setMaximizedId(isMax ? null : w.id)}
                    className="p-1 rounded hover:bg-white/10"
                  >
                    <Maximize2 className="w-3 h-3 text-white/40" />
                  </button>
                  <button
                    onClick={() => exportPng(w.id)}
                    className="p-1 rounded hover:bg-white/10"
                    title="تصدير PNG"
                  >
                    <Download className="w-3 h-3 text-white/40" />
                  </button>
                  <button
                    onClick={() => toggleWidget(w.id)}
                    className="p-1 rounded hover:bg-white/10"
                  >
                    <EyeOff className="w-3 h-3 text-white/40" />
                  </button>
                  <button
                    onClick={() => removeWidget(w.id)}
                    className="p-1 rounded hover:bg-white/10"
                  >
                    <Trash2 className="w-3 h-3 text-red-400/60" />
                  </button>
                </div>
                {!w.minimized && (
                  <div
                    className="p-3"
                    style={{ height: isMax ? "calc(100% - 40px)" : "280px" }}
                  >
                    <ResponsiveContainer width="100%" height="100%">
                      {w.type === "bar" ? (
                        <BarChart data={data}>
                          <CartesianGrid
                            strokeDasharray="3 3"
                            stroke="rgba(255,255,255,0.05)"
                          />
                          <XAxis
                            dataKey="name"
                            stroke="rgba(255,255,255,0.3)"
                            fontSize={10}
                          />
                          <YAxis stroke="rgba(255,255,255,0.3)" fontSize={10} />
                          <Tooltip contentStyle={tooltipStyle} />
                          <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                            {data.map((_, i) => (
                              <Cell key={i} fill={COLORS[i % COLORS.length]} />
                            ))}
                          </Bar>
                        </BarChart>
                      ) : w.type === "pie" ? (
                        <PieChart>
                          <Pie
                            data={data}
                            dataKey="value"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            outerRadius={100}
                            label={({ name, percent }) =>
                              `${name} ${(percent * 100).toFixed(0)}%`
                            }
                            labelLine={false}
                          >
                            {data.map((_, i) => (
                              <Cell key={i} fill={COLORS[i % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip contentStyle={tooltipStyle} />
                          <Legend wrapperStyle={{ fontSize: 10 }} />
                        </PieChart>
                      ) : w.type === "donut" ? (
                        <PieChart>
                          <Pie
                            data={data}
                            dataKey="value"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={100}
                            label={({ name, percent }) =>
                              `${name} ${(percent * 100).toFixed(0)}%`
                            }
                            labelLine={false}
                          >
                            {data.map((_, i) => (
                              <Cell key={i} fill={COLORS[i % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip contentStyle={tooltipStyle} />
                          <Legend wrapperStyle={{ fontSize: 10 }} />
                        </PieChart>
                      ) : w.type === "line" ? (
                        <LineChart data={data}>
                          <CartesianGrid
                            strokeDasharray="3 3"
                            stroke="rgba(255,255,255,0.05)"
                          />
                          <XAxis
                            dataKey="name"
                            stroke="rgba(255,255,255,0.3)"
                            fontSize={10}
                          />
                          <YAxis stroke="rgba(255,255,255,0.3)" fontSize={10} />
                          <Tooltip contentStyle={tooltipStyle} />
                          <Line
                            type="monotone"
                            dataKey="value"
                            stroke={w.color}
                            strokeWidth={2.5}
                            dot={{ r: 3, fill: w.color }}
                          />
                        </LineChart>
                      ) : w.type === "area" ? (
                        <AreaChart data={data}>
                          <defs>
                            <linearGradient
                              id={`grad-${w.id}`}
                              x1="0"
                              y1="0"
                              x2="0"
                              y2="1"
                            >
                              <stop
                                offset="5%"
                                stopColor={w.color}
                                stopOpacity={0.5}
                              />
                              <stop
                                offset="95%"
                                stopColor={w.color}
                                stopOpacity={0}
                              />
                            </linearGradient>
                          </defs>
                          <CartesianGrid
                            strokeDasharray="3 3"
                            stroke="rgba(255,255,255,0.05)"
                          />
                          <XAxis
                            dataKey="name"
                            stroke="rgba(255,255,255,0.3)"
                            fontSize={10}
                          />
                          <YAxis stroke="rgba(255,255,255,0.3)" fontSize={10} />
                          <Tooltip contentStyle={tooltipStyle} />
                          <Area
                            type="monotone"
                            dataKey="value"
                            stroke={w.color}
                            fill={`url(#grad-${w.id})`}
                            strokeWidth={2}
                          />
                        </AreaChart>
                      ) : w.type === "scatter" ? (
                        <ScatterChart>
                          <CartesianGrid
                            strokeDasharray="3 3"
                            stroke="rgba(255,255,255,0.05)"
                          />
                          <XAxis
                            dataKey="x"
                            name={w.xCol}
                            stroke="rgba(255,255,255,0.3)"
                            fontSize={10}
                          />
                          <YAxis
                            dataKey="y"
                            name={w.yCol}
                            stroke="rgba(255,255,255,0.3)"
                            fontSize={10}
                          />
                          <ZAxis range={[40, 80]} />
                          <Tooltip contentStyle={tooltipStyle} />
                          <Scatter data={data} fill={w.color} />
                        </ScatterChart>
                      ) : (
                        <RadarChart data={data}>
                          <PolarGrid stroke="rgba(255,255,255,0.1)" />
                          <PolarAngleAxis
                            dataKey="name"
                            stroke="rgba(255,255,255,0.3)"
                            fontSize={9}
                          />
                          <PolarRadiusAxis
                            stroke="rgba(255,255,255,0.2)"
                            fontSize={9}
                          />
                          <Radar
                            name={w.title}
                            dataKey="value"
                            stroke={w.color}
                            fill={w.color}
                            fillOpacity={0.3}
                          />
                          <Tooltip contentStyle={tooltipStyle} />
                        </RadarChart>
                      )}
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            );
          })}

        {widgets.length === 0 && (
          <div className="col-span-full text-center py-12">
            <BarChart3 className="w-12 h-12 text-white/10 mx-auto mb-3" />
            <p className="text-white/30 text-sm">لا توجد رسوم بعد</p>
            <p className="text-white/20 text-xs mt-1">
              انقر &quot;رسم جديد&quot; لإضافة أول رسم بياني
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
