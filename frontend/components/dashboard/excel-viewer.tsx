"use client";

import { useCallback, useMemo, useRef, useState, useEffect } from "react";
import {
  UploadCloud,
  Download,
  Loader2,
  Search,
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  FileSpreadsheet,
  Filter,
  X,
  BarChart3,
  ZoomIn,
  ZoomOut,
  Grid3X3,
  Bold,
  Italic,
  Underline,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Sparkles,
  Lightbulb,
  BrainCircuit,
  Sigma,
  FunctionSquare,
} from "lucide-react";
import ExcelJS from "exceljs";
import Papa from "papaparse";
import { useDataLink, UseLinkedData, type LinkedDataset } from "./data-link";
import {
  evaluateFormula,
  profileColumns,
  suggestFormulas,
  recommendAnalysis,
  type FormulaContext,
  type ColumnProfile,
} from "@/lib/excel-formulas";
import {
  rememberProject,
  rememberAction,
  rememberFormula,
  buildUserProfile,
  getPersonalizedHints,
} from "@/lib/learning-store";

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
function dlBuf(buf: ArrayBuffer, name: string, mime: string) {
  dlBlob(new Blob([buf], { type: mime }), name);
}

/* ─── types ─── */
interface CellStyle {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  color?: string;
  bgColor?: string;
  align?: "left" | "center" | "right";
  format?: string;
}

interface SheetData {
  name: string;
  headers: string[];
  rows: Record<string, unknown>[];
  colWidths: number[];
}

interface ExcelFile {
  fileName: string;
  sheets: SheetData[];
  activeSheet: number;
}

const PAGE_SIZE = 100;
const ROW_NUM_W = 52;
const COL_DEFAULT_W = 120;
const HEADER_H = 32;
const ROW_H = 28;

/* ─── Column letter helper (A, B, ... AA, AB) ─── */
function colLetter(idx: number): string {
  let s = "";
  let n = idx;
  while (n >= 0) {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  }
  return s;
}

/* ─── Detect column type ─── */
function detectColType(
  rows: Record<string, unknown>[],
  col: string,
): "number" | "text" | "date" | "mixed" {
  let nums = 0;
  let texts = 0;
  let dates = 0;
  const sample = rows.slice(0, 200);
  for (const r of sample) {
    const v = r[col];
    if (v == null || v === "") continue;
    const s = String(v).trim();
    if (/^\d{4}[-/]\d{1,2}[-/]\d{1,2}/.test(s)) {
      dates++;
      continue;
    }
    if (!Number.isNaN(Number(s))) {
      nums++;
      continue;
    }
    texts++;
  }
  if (nums > texts && nums > dates) return "number";
  if (dates > nums && dates > texts) return "date";
  if (texts > 0 && nums > 0) return "mixed";
  return "text";
}

/* ─── Stats for a column ─── */
function colStats(rows: Record<string, unknown>[], col: string) {
  const vals = rows.map((r) => r[col]).filter((v) => v != null && v !== "");
  const nulls = rows.length - vals.length;
  const unique = new Set(vals.map(String)).size;
  const nums = vals.map(Number).filter((n) => !Number.isNaN(n));
  let mean: number | undefined;
  let min: number | undefined;
  let max: number | undefined;
  let sum: number | undefined;
  if (nums.length > 0) {
    sum = nums.reduce((a, b) => a + b, 0);
    mean = sum / nums.length;
    min = Math.min(...nums);
    max = Math.max(...nums);
  }
  return {
    total: rows.length,
    nulls,
    unique,
    mean,
    min,
    max,
    sum,
    numericCount: nums.length,
  };
}

/* ═══════════════════════════════════════════════════════════════
   EXCEL VIEWER COMPONENT
   ═══════════════════════════════════════════════════════════════ */
export function ExcelViewer({
  onDataChange,
}: {
  onDataChange?: (data: {
    headers: string[];
    rows: Record<string, unknown>[];
    fileName: string;
  }) => void;
} = {}) {
  const { publish } = useDataLink();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const tableRef = useRef<HTMLDivElement | null>(null);

  const [file, setFile] = useState<ExcelFile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Navigation
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortAsc, setSortAsc] = useState(true);

  // Cell selection
  const [selCell, setSelCell] = useState<{ row: number; col: string } | null>(
    null,
  );

  // Styling
  const [cellStyles, setCellStyles] = useState<Record<string, CellStyle>>({});
  const [freezeRow, setFreezeRow] = useState(0);

  // UI state
  const [showStats, setShowStats] = useState(false);
  const [showFilter, setShowFilter] = useState(false);
  const [filterCol, setFilterCol] = useState("");
  const [filterVal, setFilterVal] = useState("");
  const [zoom, setZoom] = useState(100);
  const [colWidths, setColWidths] = useState<Record<string, number>>({});
  const [resizingCol, setResizingCol] = useState<string | null>(null);
  const [resizingStart, setResizingStart] = useState(0);
  const [resizingOrigW, setResizingOrigW] = useState(0);

  // Smart assistant
  const [showAssistant, setShowAssistant] = useState(false);
  const [assistantTab, setAssistantTab] = useState<
    "formulas" | "analysis" | "memory"
  >("formulas");
  const [assistantLoading, setAssistantLoading] = useState(false);

  const activeSheet = file ? file.sheets[file.activeSheet] : null;

  const sheetHeaders = useMemo(() => activeSheet?.headers ?? [], [activeSheet]);
  const sheetRows = useMemo(() => activeSheet?.rows ?? [], [activeSheet]);

  // Filter + Sort
  const processedRows = useMemo(() => {
    let r = [...sheetRows];
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      r = r.filter((row) =>
        sheetHeaders.some((h) =>
          String(row[h] ?? "")
            .toLowerCase()
            .includes(q),
        ),
      );
    }
    if (filterCol && filterVal) {
      r = r.filter((row) =>
        String(row[filterCol] ?? "")
          .toLowerCase()
          .includes(filterVal.toLowerCase()),
      );
    }
    if (sortCol) {
      const f = sortAsc ? 1 : -1;
      r.sort((a, b) => {
        const av = a[sortCol];
        const bv = b[sortCol];
        if (av == null && bv == null) return 0;
        if (av == null) return 1;
        if (bv == null) return -1;
        const na = Number(av);
        const nb = Number(bv);
        if (!Number.isNaN(na) && !Number.isNaN(nb)) return (na - nb) * f;
        return String(av).localeCompare(String(bv)) * f;
      });
    }
    return r;
  }, [sheetRows, sheetHeaders, search, sortCol, sortAsc, filterCol, filterVal]);

  const totalPages = Math.max(1, Math.ceil(processedRows.length / PAGE_SIZE));
  const pageRows = processedRows.slice(
    page * PAGE_SIZE,
    (page + 1) * PAGE_SIZE,
  );

  const getColW = (col: string) => colWidths[col] ?? COL_DEFAULT_W;

  // ─── Load file ───
  const loadFile = useCallback(
    async (f: File | null) => {
      if (!f) return;
      setLoading(true);
      setError("");
      setFile(null);
      setPage(0);
      setSearch("");
      setSortCol(null);
      setSelCell(null);
      setCellStyles({});
      setFreezeRow(0);
      setColWidths({});

      try {
        const ext = f.name.split(".").pop()?.toLowerCase() || "";
        if (ext === "csv") {
          const text = await f.text();
          const parsed = Papa.parse(text, {
            header: true,
            skipEmptyLines: true,
            dynamicTyping: false,
          });
          if (!parsed.meta.fields) throw new Error("bad-csv");
          const h = parsed.meta.fields.filter(Boolean);
          const rows = (parsed.data as Record<string, unknown>[]).map((r) => {
            const obj: Record<string, unknown> = {};
            for (const c of h) {
              const v = r[c];
              obj[c] = v === "" || v == null ? null : v;
            }
            return obj;
          });
          setFile({
            fileName: f.name,
            sheets: [
              {
                name: "Sheet1",
                headers: h,
                rows,
                colWidths: h.map(() => COL_DEFAULT_W),
              },
            ],
            activeSheet: 0,
          });
          publish({ headers: h, rows, fileName: f.name, source: "excel" });
          onDataChange?.({ headers: h, rows, fileName: f.name });
          rememberProject({ fileName: f.name, rows: rows.length, headers: h });
          rememberAction(f.name, {
            type: "view",
            detail: "opened in Excel viewer",
            at: Date.now(),
          });
        } else {
          const buf = await f.arrayBuffer();
          const wb = new ExcelJS.Workbook();
          await wb.xlsx.load(buf);
          const sheets: SheetData[] = [];
          wb.eachSheet((ws) => {
            const all: unknown[][] = [];
            ws.eachRow({ includeEmpty: false }, (row) => {
              all.push((row.values as unknown[]).slice(1));
            });
            if (all.length === 0) return;
            const h: string[] = [];
            all[0].forEach((c) => {
              const s = c == null ? "" : String(c).trim();
              if (s) h.push(s);
            });
            const rows: Record<string, unknown>[] = [];
            for (const r of all.slice(1)) {
              const obj: Record<string, unknown> = {};
              h.forEach((col, idx) => {
                const v = r[idx] ?? null;
                obj[col] =
                  v === ""
                    ? null
                    : typeof v === "object"
                      ? JSON.stringify(v)
                      : v;
              });
              rows.push(obj);
            }
            sheets.push({
              name: ws.name || `Sheet${sheets.length + 1}`,
              headers: h,
              rows,
              colWidths: h.map(() => COL_DEFAULT_W),
            });
          });
          if (sheets.length === 0) throw new Error("empty-xlsx");
          setFile({ fileName: f.name, sheets, activeSheet: 0 });
          publish({
            headers: sheets[0].headers,
            rows: sheets[0].rows,
            fileName: f.name,
            source: "excel",
          });
          onDataChange?.({
            headers: sheets[0].headers,
            rows: sheets[0].rows,
            fileName: f.name,
          });
          rememberProject({
            fileName: f.name,
            rows: sheets[0].rows.length,
            headers: sheets[0].headers,
          });
          rememberAction(f.name, {
            type: "view",
            detail: "opened in Excel viewer",
            at: Date.now(),
          });
        }
      } catch {
        setError("فشل في تحليل الملف. تأكد من أن الملف صالح.");
      } finally {
        setLoading(false);
      }
    },
    [onDataChange, publish],
  );

  // ─── Apply a shared/linked dataset into this viewer ───
  const applyLinkedData = useCallback((ds: LinkedDataset) => {
    const f: ExcelFile = {
      fileName: ds.fileName,
      sheets: [
        {
          name: "Sheet1",
          headers: ds.headers,
          rows: ds.rows,
          colWidths: ds.headers.map(() => COL_DEFAULT_W),
        },
      ],
      activeSheet: 0,
    };
    setFile(f);
    rememberProject({
      fileName: ds.fileName,
      rows: ds.rows.length,
      headers: ds.headers,
    });
    rememberAction(ds.fileName, {
      type: "view",
      detail: "linked data pulled into Excel viewer",
      at: Date.now(),
    });
  }, []);

  // ─── Switch sheet ───
  const switchSheet = (idx: number) => {
    if (!file) return;
    setFile({ ...file, activeSheet: idx });
    setPage(0);
    setSearch("");
    setSortCol(null);
    setSelCell(null);
  };

  // ─── Column resize ───
  const startResize = (col: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setResizingCol(col);
    setResizingStart(e.clientX);
    setResizingOrigW(getColW(col));
  };

  useEffect(() => {
    if (!resizingCol) return;
    const onMove = (e: MouseEvent) => {
      const delta = e.clientX - resizingStart;
      const newW = Math.max(50, resizingOrigW + delta);
      setColWidths((prev) => ({ ...prev, [resizingCol]: newW }));
    };
    const onUp = () => setResizingCol(null);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [resizingCol, resizingStart, resizingOrigW]);

  // ─── Export ───
  const exportXlsx = async () => {
    if (!file) return;
    const wb = new ExcelJS.Workbook();
    for (const s of file.sheets) {
      const ws = wb.addWorksheet(s.name);
      ws.columns = s.headers.map((h) => ({ header: h, key: h, width: 18 }));
      for (const r of s.rows) {
        ws.addRow(
          s.headers.reduce<Record<string, unknown>>((a, h) => {
            a[h] = r[h] ?? "";
            return a;
          }, {}),
        );
      }
      const hd = ws.getRow(1);
      hd.font = { bold: true, color: { argb: "FFFFFFFF" } };
      hd.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF4F7CFF" },
      };
    }
    const buf = await wb.xlsx.writeBuffer();
    dlBuf(
      buf,
      file.fileName.replace(/\.[^.]+$/, "") || "data",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
  };

  const exportCsv = () => {
    if (!activeSheet) return;
    const csv = Papa.unparse(activeSheet.rows, {
      columns: activeSheet.headers,
    });
    dlBlob(
      new Blob([csv], { type: "text/csv;charset=utf-8" }),
      (file?.fileName || "data").replace(/\.[^.]+$/, "") + ".csv",
    );
  };

  const exportJson = () => {
    if (!activeSheet) return;
    const json = JSON.stringify(activeSheet.rows, null, 2);
    dlBlob(
      new Blob([json], { type: "application/json" }),
      (file?.fileName || "data").replace(/\.[^.]+$/, "") + ".json",
    );
  };

  // ─── Cell style key ───
  const cellKey = (r: number, c: string) => `${r}:${c}`;
  const getStyle = (r: number, c: string): CellStyle =>
    cellStyles[cellKey(r, c)] || {};
  const toggleStyle = (
    prop: "bold" | "italic" | "underline",
    r: number,
    c: string,
  ) => {
    const k = cellKey(r, c);
    const cur = cellStyles[k] || {};
    setCellStyles((prev) => ({ ...prev, [k]: { ...cur, [prop]: !cur[prop] } }));
  };

  // ─── Stats ───
  const stats = useMemo(() => {
    if (!activeSheet) return null;
    const s: Record<string, ReturnType<typeof colStats>> = {};
    for (const h of activeSheet.headers) {
      s[h] = colStats(activeSheet.rows, h);
    }
    return s;
  }, [activeSheet]);

  // ─── Smart engine ───
  const profiles = useMemo<Record<string, ColumnProfile>>(
    () =>
      activeSheet ? profileColumns(activeSheet.headers, activeSheet.rows) : {},
    [activeSheet],
  );

  const formulaSuggestions = useMemo(
    () => (activeSheet ? suggestFormulas(activeSheet.headers, profiles) : []),
    [activeSheet, profiles],
  );

  const recommendations = useMemo(
    () =>
      activeSheet
        ? recommendAnalysis(activeSheet.headers, activeSheet.rows, profiles)
        : [],
    [activeSheet, profiles],
  );

  const userProfile = useMemo(() => buildUserProfile(), []);
  const memoryHints = useMemo(
    () => getPersonalizedHints(userProfile, activeSheet?.headers ?? []),
    [userProfile, activeSheet],
  );

  // Formula context over the full sheet grid (A1 references)
  const formulaCtx = useMemo<FormulaContext>(() => {
    const rows = sheetRows;
    const headers = sheetHeaders;
    return {
      rowsCount: rows.length,
      colsCount: headers.length,
      getCell: (rowIdx, colIdx) => {
        if (
          rowIdx < 0 ||
          rowIdx >= rows.length ||
          colIdx < 0 ||
          colIdx >= headers.length
        )
          return null;
        return rows[rowIdx][headers[colIdx]];
      },
    };
  }, [sheetRows, sheetHeaders]);

  // Translates bare header references (e.g. =SUM(المبيعات)) to ranges
  const resolveColRefs = useCallback(
    (expr: string): string => {
      let out = expr;
      sheetHeaders.forEach((h, idx) => {
        if (!h.trim()) return;
        const letter = colLetter(idx);
        const esc = h.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const re = new RegExp(`(?<![A-Za-z0-9_])${esc}(?![A-Za-z0-9_])`, "g");
        out = out.replace(
          re,
          `${letter}1:${letter}${Math.max(1, sheetRows.length)}`,
        );
      });
      return out;
    },
    [sheetHeaders, sheetRows.length],
  );

  // Evaluate a cell value; formulas are compiled & resolved
  const evalCell = useCallback(
    (
      val: unknown,
    ): { display: string; isFormula: boolean; isNull: boolean } => {
      const isNull = val == null || val === "";
      if (isNull) return { display: "", isFormula: false, isNull: true };
      const raw = String(val);
      if (!raw.trim().startsWith("="))
        return { display: raw, isFormula: false, isNull: false };
      const { value, error } = evaluateFormula(resolveColRefs(raw), formulaCtx);
      if (error)
        return { display: `#${error}`, isFormula: true, isNull: false };
      if (value == null) return { display: "", isFormula: true, isNull: false };
      if (typeof value === "number") {
        return {
          display: Number.isInteger(value) ? String(value) : value.toFixed(2),
          isFormula: true,
          isNull: false,
        };
      }
      return { display: String(value), isFormula: true, isNull: false };
    },
    [resolveColRefs, formulaCtx],
  );

  // Insert a suggested formula into the selected cell & remember it
  const insertFormula = useCallback(
    (formula: string) => {
      if (!selCell || !activeSheet || !file) return;
      const { row: globalRow, col } = selCell;
      const newRows = [...activeSheet.rows];
      newRows[globalRow] = { ...(newRows[globalRow] ?? {}), [col]: formula };
      const newSheets = [...file.sheets];
      newSheets[file.activeSheet] = { ...activeSheet, rows: newRows };
      setFile({ ...file, sheets: newSheets });
      rememberFormula(file.fileName, formula);
      rememberAction(file.fileName, {
        type: "formula",
        detail: formula,
        at: Date.now(),
      });
      publish({
        headers: activeSheet.headers,
        rows: newRows,
        fileName: file.fileName,
        source: "excel",
      });
      onDataChange?.({
        headers: activeSheet.headers,
        rows: newRows,
        fileName: file.fileName,
      });
    },
    [activeSheet, file, selCell, onDataChange, publish],
  );

  // ─── Freeze helpers ───
  // (freeze toggles kept in toolbar; paginated body renders all columns)

  // ═══ RENDER ═══
  if (!file) {
    return (
      <div className="border border-white/10 rounded-3xl bg-white/[0.02] p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#217346] to-[#33a867] flex items-center justify-center shrink-0 shadow-lg shadow-green-500/20">
            <FileSpreadsheet className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="font-semibold flex items-center gap-2">
              <span className="text-[#33a867]">Excel</span> عارض البيانات الذكي
            </h2>
            <p className="text-xs text-white/50">
              يفهم بياناتك، يقترح المعادلات والتحليل المثالي، ويتذكر مشاريعك
              السابقة
            </p>
          </div>
        </div>

        {memoryHints.length > 0 && (
          <div className="mb-4 grid gap-2">
            {memoryHints.slice(0, 2).map((h, i) => (
              <div
                key={i}
                className="flex items-start gap-2 bg-gradient-to-r from-[#217346]/10 to-transparent border border-[#217346]/20 rounded-xl px-3 py-2"
              >
                <BrainCircuit
                  className={`w-4 h-4 mt-0.5 shrink-0 ${h.tag === "ذاكرة" ? "text-[#33a867]" : h.tag === "مرحبا" ? "text-sky-400" : "text-amber-300"}`}
                />
                <div className="min-w-0">
                  <div className="text-[11px] font-medium text-white/80">
                    {h.title}
                  </div>
                  <div className="text-[11px] text-white/50 leading-snug">
                    {h.body}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div
          className="border-2 border-dashed border-[#217346]/40 rounded-2xl p-8 text-center cursor-pointer hover:bg-[#217346]/5 transition"
          onClick={() => inputRef.current?.click()}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            className="hidden"
            onChange={(e) => loadFile(e.target.files?.[0] || null)}
          />
          <FileSpreadsheet className="h-12 w-12 text-[#33a867] mx-auto mb-3" />
          <p className="font-medium">اسحب ملفك هنا أو انقر للاختيار</p>
          <p className="text-sm text-white/40 mt-1">يدعم CSV, XLSX, XLS</p>
        </div>

        {loading && (
          <div className="mt-4 flex items-center justify-center gap-2 text-[#33a867]">
            <Loader2 className="w-5 h-5 animate-spin" /> جاري التحليل الذكي
            للبيانات...
          </div>
        )}
        {error && (
          <div className="mt-4 bg-red-500/10 border border-red-500/30 text-red-400 text-sm px-4 py-3 rounded-2xl">
            {error}
          </div>
        )}

        <div className="mt-4 flex items-center gap-3 flex-wrap">
          <UseLinkedData onApply={applyLinkedData} />
          {userProfile.totalProjects > 0 && (
            <div className="flex items-center gap-2 text-[10px] text-white/40">
              <Sparkles className="w-3 h-3 text-amber-300" />
              <span>
                {userProfile.totalProjects} مشروع في ذاكرتي · معادلاتك المفضلة:
              </span>
              {userProfile.favoriteFormulas.slice(0, 2).map((f, i) => (
                <span
                  key={i}
                  className="font-mono text-[#33a867] bg-[#217346]/10 border border-[#217346]/20 rounded px-1.5 py-0.5"
                >
                  {f.formula}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className="border border-white/10 rounded-3xl bg-white/[0.02] overflow-hidden"
      style={{ fontSize: `${Math.round((12 * zoom) / 100)}px` }}
    >
      {/* ── Toolbar ── */}
      <div className="flex items-center gap-1 px-3 py-2 border-b border-white/10 bg-white/[0.01] flex-wrap">
        <button
          onClick={() => inputRef.current?.click()}
          className="p-1.5 rounded-lg hover:bg-white/10 transition"
          title="فتح ملف"
        >
          <UploadCloud className="w-4 h-4 text-white/60" />
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
        <div className="w-px h-5 bg-white/10 mx-1" />
        <button
          onClick={() =>
            selCell && toggleStyle("bold", selCell.row, selCell.col)
          }
          className={`p-1.5 rounded-lg transition ${selCell && getStyle(selCell.row, selCell.col).bold ? "bg-white/15 text-white" : "hover:bg-white/10 text-white/50"}`}
          title="غامق"
        >
          <Bold className="w-4 h-4" />
        </button>
        <button
          onClick={() =>
            selCell && toggleStyle("italic", selCell.row, selCell.col)
          }
          className={`p-1.5 rounded-lg transition ${selCell && getStyle(selCell.row, selCell.col).italic ? "bg-white/15 text-white" : "hover:bg-white/10 text-white/50"}`}
          title="مائل"
        >
          <Italic className="w-4 h-4" />
        </button>
        <button
          onClick={() =>
            selCell && toggleStyle("underline", selCell.row, selCell.col)
          }
          className={`p-1.5 rounded-lg transition ${selCell && getStyle(selCell.row, selCell.col).underline ? "bg-white/15 text-white" : "hover:bg-white/10 text-white/50"}`}
          title="تحته خط"
        >
          <Underline className="w-4 h-4" />
        </button>
        <div className="w-px h-5 bg-white/10 mx-1" />
        <button
          onClick={() =>
            selCell &&
            setCellStyles((p) => ({
              ...p,
              [cellKey(selCell.row, selCell.col)]: {
                ...getStyle(selCell.row, selCell.col),
                align: "left",
              },
            }))
          }
          className="p-1.5 rounded-lg hover:bg-white/10 text-white/50 transition"
          title="يسار"
        >
          <AlignLeft className="w-4 h-4" />
        </button>
        <button
          onClick={() =>
            selCell &&
            setCellStyles((p) => ({
              ...p,
              [cellKey(selCell.row, selCell.col)]: {
                ...getStyle(selCell.row, selCell.col),
                align: "center",
              },
            }))
          }
          className="p-1.5 rounded-lg hover:bg-white/10 text-white/50 transition"
          title="وسط"
        >
          <AlignCenter className="w-4 h-4" />
        </button>
        <button
          onClick={() =>
            selCell &&
            setCellStyles((p) => ({
              ...p,
              [cellKey(selCell.row, selCell.col)]: {
                ...getStyle(selCell.row, selCell.col),
                align: "right",
              },
            }))
          }
          className="p-1.5 rounded-lg hover:bg-white/10 text-white/50 transition"
          title="يمين"
        >
          <AlignRight className="w-4 h-4" />
        </button>
        <div className="w-px h-5 bg-white/10 mx-1" />
        <button
          onClick={() => setShowStats((v) => !v)}
          className={`p-1.5 rounded-lg transition ${showStats ? "bg-[#33a867]/20 text-[#33a867]" : "hover:bg-white/10 text-white/50"}`}
          title="إحصائيات"
        >
          <BarChart3 className="w-4 h-4" />
        </button>
        <button
          onClick={() => setShowFilter((v) => !v)}
          className={`p-1.5 rounded-lg transition ${showFilter ? "bg-sky-500/20 text-sky-300" : "hover:bg-white/10 text-white/50"}`}
          title="فلتر"
        >
          <Filter className="w-4 h-4" />
        </button>
        <button
          onClick={() => setFreezeRow((r) => (r === 0 ? 1 : 0))}
          className={`p-1.5 rounded-lg transition ${freezeRow > 0 ? "bg-amber-500/20 text-amber-300" : "hover:bg-white/10 text-white/50"}`}
          title="تجميد الصف"
        >
          <Grid3X3 className="w-4 h-4" />
        </button>
        <div className="w-px h-5 bg-white/10 mx-1" />
        <button
          onClick={() => setShowAssistant((v) => !v)}
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition ${showAssistant ? "bg-[#33a867]/20 text-[#33a867] border border-[#217346]/40" : "hover:bg-white/10 text-white/60 border border-transparent"}`}
          title="المساعد الذكي"
        >
          <Sparkles className="w-3.5 h-3.5" /> المساعد الذكي
        </button>
        <div className="w-px h-5 bg-white/10 mx-1" />
        <button
          onClick={() => setZoom((z) => Math.min(200, z + 10))}
          className="p-1.5 rounded-lg hover:bg-white/10 text-white/50 transition"
          title="تكبير"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          onClick={() => setZoom((z) => Math.max(50, z - 10))}
          className="p-1.5 rounded-lg hover:bg-white/10 text-white/50 transition"
          title="تصغير"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <span className="text-[10px] text-white/40 ml-1">{zoom}%</span>
        <div className="flex-1" />
        <div className="flex items-center gap-1">
          <button
            onClick={exportXlsx}
            className="text-[11px] flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#217346]/15 text-[#33a867] border border-[#217346]/30 hover:bg-[#217346]/25 transition"
          >
            <Download className="w-3 h-3" /> XLSX
          </button>
          <button
            onClick={exportCsv}
            className="text-[11px] flex items-center gap-1 px-2.5 py-1 rounded-lg bg-sky-500/10 text-sky-300 border border-sky-500/30 hover:bg-sky-500/20 transition"
          >
            <Download className="w-3 h-3" /> CSV
          </button>
          <button
            onClick={exportJson}
            className="text-[11px] flex items-center gap-1 px-2.5 py-1 rounded-lg bg-purple-500/10 text-purple-300 border border-purple-500/30 hover:bg-purple-500/20 transition"
          >
            <Download className="w-3 h-3" /> JSON
          </button>
        </div>
      </div>

      {/* ── Formula Bar ── */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-white/10 bg-white/[0.01]">
        <span className="text-[11px] text-[#33a867] font-mono bg-white/[0.04] border border-white/10 rounded px-2 py-0.5 min-w-[60px] text-center">
          {selCell
            ? `${colLetter(sheetHeaders.indexOf(selCell.col))}${selCell.row + 1}`
            : ""}
        </span>
        <span className="text-[11px] text-white/40">fx</span>
        {selCell && activeSheet ? (
          (() => {
            const raw = activeSheet.rows[selCell.row]?.[selCell.col];
            const res = evalCell(raw);
            return res.isFormula ? (
              <span className="flex items-center gap-2 truncate flex-1 min-w-0">
                <span className="text-[11px] text-[#33a867]/80 font-mono truncate">
                  {String(raw ?? "")}
                </span>
                <span className="text-white/25">=</span>
                <span className="text-[11px] text-emerald-300 font-mono truncate">
                  {res.display || "0"}
                </span>
              </span>
            ) : (
              <span className="text-[11px] text-white/70 font-mono truncate flex-1">
                {res.display || "—"}
              </span>
            );
          })()
        ) : (
          <span className="text-[11px] text-white/25 font-mono truncate flex-1">
            اختر خلية لعرض قيمتها... اكتب معادلة تبدأ بـ =
          </span>
        )}
      </div>

      {/* ── Search + Filter bar ── */}
      {(search || showFilter) && (
        <div className="flex items-center gap-2 px-3 py-2 border-b border-white/10 bg-white/[0.01]">
          <div className="flex items-center gap-2 bg-white/[0.04] border border-white/10 rounded-xl px-3 py-1.5 flex-1 min-w-[200px]">
            <Search className="w-3.5 h-3.5 text-white/40" />
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(0);
              }}
              placeholder="بحث في البيانات..."
              className="bg-transparent outline-none text-xs text-white flex-1 placeholder-white/25"
            />
            {search && (
              <button onClick={() => setSearch("")}>
                <X className="w-3 h-3 text-white/40" />
              </button>
            )}
          </div>
          {showFilter && (
            <div className="flex items-center gap-2">
              <select
                value={filterCol}
                onChange={(e) => setFilterCol(e.target.value)}
                className="bg-white/[0.04] border border-white/10 rounded-lg px-2 py-1 text-[11px] text-white/70 outline-none"
              >
                <option value="">عمود...</option>
                {sheetHeaders.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
              <input
                value={filterVal}
                onChange={(e) => setFilterVal(e.target.value)}
                placeholder="قيمة..."
                className="bg-white/[0.04] border border-white/10 rounded-lg px-2 py-1 text-[11px] text-white outline-none w-24"
              />
            </div>
          )}
        </div>
      )}

      {/* ── Stats Panel ── */}
      {showStats && stats && (
        <div className="px-3 py-3 border-b border-white/10 bg-white/[0.01] overflow-x-auto">
          <div className="flex gap-3 min-w-max">
            {sheetHeaders.slice(0, 12).map((h) => {
              const s = stats[h];
              if (!s) return null;
              const tp = detectColType(sheetRows, h);
              return (
                <div
                  key={h}
                  className="bg-white/[0.03] border border-white/10 rounded-xl px-3 py-2 min-w-[140px]"
                >
                  <div className="text-[10px] text-[#33a867] font-medium truncate">
                    {h}
                  </div>
                  <div className="text-[9px] text-white/40 mt-0.5">
                    <span className="inline-block bg-white/5 rounded px-1">
                      {tp}
                    </span>{" "}
                    {s.total} صف
                  </div>
                  <div className="text-[9px] text-white/40">
                    فارغ: {s.nulls} | فريد: {s.unique}
                  </div>
                  {s.mean != null && (
                    <div className="text-[9px] text-white/50">
                      متوسط: {s.mean.toFixed(2)} | min: {s.min?.toFixed(0)} |
                      max: {s.max?.toFixed(0)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Smart Assistant Panel ── */}
      {showAssistant && activeSheet && (
        <div className="border-b border-white/10 bg-gradient-to-b from-[#217346]/[0.04] to-transparent">
          <div className="flex items-center gap-1 px-3 pt-2">
            <button
              onClick={() => setAssistantTab("formulas")}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-t-lg text-[11px] font-medium transition ${assistantTab === "formulas" ? "bg-[#217346]/15 text-[#33a867] border-t border-x border-[#217346]/30" : "text-white/40 hover:text-white/60"}`}
            >
              <Sigma className="w-3.5 h-3.5" /> معادلات مقترحة
            </button>
            <button
              onClick={() => {
                setAssistantTab("analysis");
                setAssistantLoading(true);
                setTimeout(() => setAssistantLoading(false), 450);
              }}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-t-lg text-[11px] font-medium transition ${assistantTab === "analysis" ? "bg-[#217346]/15 text-[#33a867] border-t border-x border-[#217346]/30" : "text-white/40 hover:text-white/60"}`}
            >
              <Lightbulb className="w-3.5 h-3.5" /> أفضل تحليل
            </button>
            <button
              onClick={() => setAssistantTab("memory")}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-t-lg text-[11px] font-medium transition ${assistantTab === "memory" ? "bg-[#217346]/15 text-[#33a867] border-t border-x border-[#217346]/30" : "text-white/40 hover:text-white/60"}`}
            >
              <BrainCircuit className="w-3.5 h-3.5" /> يتذكّر عملك
            </button>
            <div className="flex-1" />
            <span className="text-[10px] text-white/30 tabular-nums">
              {activeSheet.headers.length} عمود · {activeSheet.rows.length} صف
            </span>
          </div>

          <div className="px-3 pb-3 pt-2">
            {assistantTab === "formulas" && (
              <div className="space-y-2">
                <p className="text-[11px] text-[#33a867] flex items-center gap-1.5">
                  <Sparkles className="w-3 h-3" />
                  اختر خلية ثم انقر أي معادلة لإدراجها فوراً في الخلية المحددة
                </p>
                {!selCell && (
                  <p className="text-[10px] text-amber-300/80">
                    ⚠ لم تحدد خلية بعد — انقر أي خلية في الجدول أولاً
                  </p>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {formulaSuggestions.map((s, i) => (
                    <div
                      key={i}
                      className="bg-white/[0.03] border border-white/10 rounded-xl p-3 hover:border-[#217346]/40 transition"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-[10px] text-white/40 mb-1">
                            {s.category}
                          </div>
                          <code
                            className="block text-[12px] font-mono text-[#33a867] bg-[#217346]/10 rounded-lg px-2 py-1 mb-1 truncate"
                            dir="ltr"
                          >
                            {s.formula}
                          </code>
                          <p className="text-[10px] text-white/50 leading-snug">
                            {s.explanation}
                          </p>
                        </div>
                        <button
                          onClick={() => insertFormula(s.formula)}
                          disabled={!selCell}
                          className="shrink-0 text-[10px] px-2.5 py-1 rounded-lg bg-[#217346]/20 text-[#33a867] border border-[#217346]/40 hover:bg-[#217346]/35 transition disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          إدراج
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {assistantTab === "analysis" && (
              <div className="space-y-2">
                {assistantLoading ? (
                  <div className="flex items-center gap-2 text-[12px] text-[#33a867] py-6 justify-center">
                    <Sparkles className="w-4 h-4 animate-pulse" /> جاري تحليل
                    البنية والأنماط...
                  </div>
                ) : (
                  <>
                    <p className="text-[11px] text-[#33a867] flex items-center gap-1.5">
                      <Lightbulb className="w-3 h-3" />
                      بناءً على بنية بياناتك، هذه أقوى التحليلات الموصى بها
                    </p>
                    <div className="flex items-center gap-2 flex-wrap text-[10px] text-white/40">
                      {Object.values(profiles).filter(
                        (p) => p.type === "number",
                      ).length > 0 && (
                        <span className="bg-[#217346]/10 border border-[#217346]/20 rounded px-2 py-0.5">
                          🧮{" "}
                          {
                            Object.values(profiles).filter(
                              (p) => p.type === "number",
                            ).length
                          }{" "}
                          عمود رقمي
                        </span>
                      )}
                      {Object.values(profiles).filter((p) => p.type === "date")
                        .length > 0 && (
                        <span className="bg-sky-500/10 border border-sky-500/20 rounded px-2 py-0.5">
                          📅{" "}
                          {
                            Object.values(profiles).filter(
                              (p) => p.type === "date",
                            ).length
                          }{" "}
                          عمود تاريخ
                        </span>
                      )}
                      <span className="bg-amber-500/10 border border-amber-500/20 rounded px-2 py-0.5">
                        🎯{" "}
                        {
                          Object.values(profiles).filter(
                            (p) => p.type === "text",
                          ).length
                        }{" "}
                        عمود نصي
                      </span>
                    </div>
                    <div className="space-y-2">
                      {recommendations.map((r, i) => (
                        <div
                          key={i}
                          className="flex items-start gap-2.5 bg-white/[0.03] border border-white/10 rounded-xl px-3 py-2.5 hover:bg-white/[0.05] transition"
                        >
                          <span
                            className={`shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-sm ${
                              r.type === "chart"
                                ? "bg-[#f2c811]/15 border border-[#f2c811]/30"
                                : r.type === "kpi"
                                  ? "bg-[#33a867]/15 border border-[#217346]/30"
                                  : r.type === "insight"
                                    ? "bg-sky-500/15 border border-sky-500/30"
                                    : r.type === "clean"
                                      ? "bg-amber-500/15 border border-amber-500/30"
                                      : "bg-purple-500/15 border border-purple-500/30"
                            }`}
                          >
                            {r.type === "chart"
                              ? "📊"
                              : r.type === "kpi"
                                ? "🎯"
                                : r.type === "insight"
                                  ? "💡"
                                  : r.type === "clean"
                                    ? "🧹"
                                    : "🧮"}
                          </span>
                          <div className="min-w-0">
                            <div className="text-[12px] font-medium text-white/80">
                              {r.title}
                            </div>
                            <p className="text-[10px] text-white/45 leading-snug">
                              {r.detail}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                    <p className="text-[10px] text-white/30">
                      💡 هذه الاقتراحات جاهزة للإدراج مباشرة في عارض Power BI
                      (زر "استخدم البيانات") لعرض الرسوم دون إعادة رفع الملف.
                    </p>
                  </>
                )}
              </div>
            )}

            {assistantTab === "memory" && (
              <div className="space-y-2">
                <p className="text-[11px] text-[#33a867] flex items-center gap-1.5">
                  <BrainCircuit className="w-3 h-3" />
                  ذاكرة المشاريع — نموذج AI أذكى مع كل مشروع تعمل عليه
                </p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  <div className="bg-white/[0.03] border border-white/10 rounded-xl p-3">
                    <div className="text-lg font-bold text-[#33a867]">
                      {userProfile.totalProjects}
                    </div>
                    <div className="text-[10px] text-white/40">مشروع محفوظ</div>
                  </div>
                  <div className="bg-white/[0.03] border border-white/10 rounded-xl p-3">
                    <div className="text-lg font-bold text-white/80">
                      {Math.round(
                        userProfile.avgRowsPerProject || 0,
                      ).toLocaleString()}
                    </div>
                    <div className="text-[10px] text-white/40">
                      متوسط الصفوف/مشروع
                    </div>
                  </div>
                  <div className="bg-white/[0.03] border border-white/10 rounded-xl p-3">
                    <div className="text-[11px] font-bold text-amber-300 truncate">
                      {userProfile.favoriteFormulas[0]?.formula || "—"}
                    </div>
                    <div className="text-[10px] text-white/40">
                      معادلتك الأكثر استخداماً
                    </div>
                  </div>
                  <div className="bg-white/[0.03] border border-white/10 rounded-xl p-3">
                    <div className="text-[11px] font-bold text-sky-300 truncate">
                      {userProfile.topColumns[0]?.column || "—"}
                    </div>
                    <div className="text-[10px] text-white/40">
                      أكثر الأعمدة تكراراً
                    </div>
                  </div>
                </div>
                <div className="grid gap-2">
                  {memoryHints.map((h, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-2 bg-white/[0.03] border border-white/10 rounded-xl px-3 py-2"
                    >
                      <BrainCircuit
                        className={`w-4 h-4 mt-0.5 shrink-0 ${h.tag === "ذاكرة" ? "text-[#33a867]" : h.tag === "مرحبا" ? "text-sky-400" : "text-amber-300"}`}
                      />
                      <div>
                        <div className="text-[11px] font-medium text-white/80">
                          {h.title}{" "}
                          <span className="text-[9px] text-white/30 mr-1">
                            [{h.tag}]
                          </span>
                        </div>
                        <p className="text-[10px] text-white/50 leading-snug">
                          {h.body}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Sheet Tabs ── */}
      <div className="flex items-center gap-0 px-2 py-1 border-b border-white/10 bg-white/[0.01] overflow-x-auto">
        {file.sheets.map((s, i) => (
          <button
            key={i}
            onClick={() => switchSheet(i)}
            className={`px-3 py-1.5 text-[11px] font-medium rounded-t-lg transition whitespace-nowrap ${
              file.activeSheet === i
                ? "bg-[#217346]/15 text-[#33a867] border-t border-x border-[#217346]/30"
                : "text-white/40 hover:text-white/60 hover:bg-white/5"
            }`}
          >
            {s.name}
          </button>
        ))}
        <div className="flex-1" />
        <span className="text-[10px] text-white/30 mr-2">
          {processedRows.length} صف · {sheetHeaders.length} عمود
        </span>
      </div>

      {/* ── Table ── */}
      {activeSheet && (
        <div
          ref={tableRef}
          className="overflow-auto"
          style={{ maxHeight: "520px" }}
        >
          <table className="border-collapse" style={{ minWidth: "100%" }}>
            <thead className="sticky top-0 z-20">
              {/* Row number + Column headers */}
              <tr>
                <th
                  className="sticky left-0 z-30 bg-[#1a2332] border-b border-r border-white/10"
                  style={{ width: ROW_NUM_W, height: HEADER_H }}
                >
                  <span className="text-[10px] text-white/30">#</span>
                </th>
                {sheetHeaders.map((h, ci) => (
                  <th
                    key={h}
                    className="relative bg-[#1a2332] border-b border-r border-white/10 text-[11px] text-white/60 font-medium cursor-pointer hover:text-[#33a867] select-none"
                    style={{
                      width: getColW(h),
                      minWidth: 50,
                      height: HEADER_H,
                    }}
                    onClick={() => {
                      setSortCol(h);
                      setSortAsc(sortCol === h ? !sortAsc : true);
                    }}
                  >
                    <div className="flex items-center gap-1 px-2 truncate">
                      {sortCol === h &&
                        (sortAsc ? (
                          <ArrowUp className="w-3 h-3 text-[#33a867]" />
                        ) : (
                          <ArrowDown className="w-3 h-3 text-[#33a867]" />
                        ))}
                      <span className="truncate">
                        {colLetter(ci)} - {h}
                      </span>
                    </div>
                    {/* Resize handle */}
                    <div
                      className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-[#33a867]/40 transition"
                      onMouseDown={(e) => startResize(h, e)}
                    />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageRows.map((row, ri) => {
                const globalRow = page * PAGE_SIZE + ri;
                return (
                  <tr key={globalRow} className="group">
                    <td
                      className="sticky left-0 z-10 bg-[#141e2e] border-b border-r border-white/10 text-[10px] text-white/30 text-center"
                      style={{ width: ROW_NUM_W, height: ROW_H }}
                    >
                      {globalRow + 1}
                    </td>
                    {sheetHeaders.map((h) => {
                      const val = row[h];
                      const style = getStyle(globalRow, h);
                      const isSel =
                        selCell?.row === globalRow && selCell?.col === h;
                      const isNull = val == null || val === "";
                      return (
                        <td
                          key={h}
                          className={`border-b border-r border-white/5 cursor-cell transition-colors ${
                            isSel
                              ? "outline outline-2 outline-[#33a867] bg-[#33a867]/10"
                              : "hover:bg-white/[0.03]"
                          }`}
                          style={{
                            width: getColW(h),
                            height: ROW_H,
                            fontWeight: style.bold ? 700 : undefined,
                            fontStyle: style.italic ? "italic" : undefined,
                            textDecoration: style.underline
                              ? "underline"
                              : undefined,
                            color: isNull
                              ? undefined
                              : style.color || undefined,
                            backgroundColor: style.bgColor || undefined,
                            textAlign: style.align || undefined,
                          }}
                          onClick={() => setSelCell({ row: globalRow, col: h })}
                          onDoubleClick={() => {
                            const v = prompt(
                              "تعديل الخلية:",
                              String(val ?? ""),
                            );
                            if (v !== null && activeSheet) {
                              const newRows = [...activeSheet.rows];
                              newRows[globalRow] = {
                                ...newRows[globalRow],
                                [h]: v || null,
                              };
                              const newSheets = [...file.sheets];
                              newSheets[file.activeSheet] = {
                                ...activeSheet,
                                rows: newRows,
                              };
                              setFile({ ...file, sheets: newSheets });
                            }
                          }}
                        >
                          {(() => {
                            const res = evalCell(val);
                            if (res.isNull) {
                              return (
                                <span className="text-red-400/50 italic text-[10px]">
                                  NULL
                                </span>
                              );
                            }
                            if (res.isFormula) {
                              return (
                                <span className="flex items-center gap-1 px-1.5 min-w-0">
                                  <FunctionSquare className="w-3 h-3 text-[#33a867] shrink-0" />
                                  <span
                                    className={`truncate font-mono ${res.display.startsWith("#") ? "text-red-400" : "text-emerald-300"}`}
                                  >
                                    {res.display}
                                  </span>
                                </span>
                              );
                            }
                            return (
                              <span className="block truncate px-1.5 text-white/75">
                                {res.display}
                              </span>
                            );
                          })()}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
              {pageRows.length === 0 && (
                <tr>
                  <td
                    colSpan={sheetHeaders.length + 1}
                    className="text-center py-8 text-white/30 text-xs"
                  >
                    لا توجد بيانات
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Status Bar ── */}
      <div className="flex items-center justify-between px-3 py-1.5 border-t border-white/10 bg-white/[0.01]">
        <div className="flex items-center gap-3 text-[10px] text-white/40">
          <span>{processedRows.length} صف</span>
          <span>{sheetHeaders.length} عمود</span>
          {selCell && activeSheet && (
            <span className="text-[#33a867]">
              {(() => {
                const v = activeSheet.rows[selCell.row]?.[selCell.col];
                if (v == null) return "NULL";
                const n = Number(v);
                if (!Number.isNaN(n)) return `الإجمالي: ${n}`;
                return String(v).substring(0, 30);
              })()}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            disabled={page === 0}
            onClick={() => setPage(0)}
            className="p-1 rounded hover:bg-white/10 disabled:opacity-30"
          >
            <ChevronsLeft className="w-3.5 h-3.5 text-white/50" />
          </button>
          <button
            disabled={page === 0}
            onClick={() => setPage((p) => p - 1)}
            className="p-1 rounded hover:bg-white/10 disabled:opacity-30"
          >
            <ChevronLeft className="w-3.5 h-3.5 text-white/50" />
          </button>
          <span className="text-[10px] text-white/50 px-2">
            {page + 1} / {totalPages}
          </span>
          <button
            disabled={page >= totalPages - 1}
            onClick={() => setPage((p) => p + 1)}
            className="p-1 rounded hover:bg-white/10 disabled:opacity-30"
          >
            <ChevronRight className="w-3.5 h-3.5 text-white/50" />
          </button>
          <button
            disabled={page >= totalPages - 1}
            onClick={() => setPage(totalPages - 1)}
            className="p-1 rounded hover:bg-white/10 disabled:opacity-30"
          >
            <ChevronsRight className="w-3.5 h-3.5 text-white/50" />
          </button>
        </div>
      </div>
    </div>
  );
}
