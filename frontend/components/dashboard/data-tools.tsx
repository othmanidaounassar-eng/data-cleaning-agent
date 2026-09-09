"use client";

import { useMemo, useRef, useState } from "react";
import {
  Table2,
  ArrowUpDown,
  Search,
  Download,
  FileSpreadsheet,
  Braces,
  Regex,
  BookOpen,
  Database,
  Play,
  Loader2,
  UploadCloud,
  Trash2,
  CheckCircle2,
  XCircle,
  ArrowDownUp,
} from "lucide-react";
import ExcelJS from "exceljs";
import Papa from "papaparse";
import { API_ENDPOINTS } from "@/lib/api";
import { authHeaders } from "@/lib/auth";
import { postCompressedForm } from "@/lib/upload-utils";
import { useAppSettings } from "@/components/providers/app-providers";

const ACCEPT = ".csv,.xlsx,.xls";

function triggerBlobDownload(url: string, fallbackName: string) {
  const a = document.createElement("a");
  a.href = url;
  a.download = fallbackName;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function downloadBuffer(
  buffer: ArrayBuffer | Buffer,
  filename: string,
  mime: string,
) {
  const blob = new Blob([buffer as ArrayBuffer], { type: mime });
  const url = URL.createObjectURL(blob);
  triggerBlobDownload(url, filename);
  URL.revokeObjectURL(url);
}

// ============================================================
// Interactive Spreadsheet Viewer (browser-only)
// ============================================================
interface SheetRow {
  row: number;
  cells: Record<string, unknown>;
}

export function SpreadsheetTool() {
  const { t } = useAppSettings();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [rows, setRows] = useState<SheetRow[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortAsc, setSortAsc] = useState(true);
  const [page, setPage] = useState(0);
  const [exporting, setExporting] = useState(false);

  const PAGE_SIZE = 50;

  const loadFile = async (f: File | null) => {
    if (!f) return;
    setError("");
    setFileName(f.name);
    setRows([]);
    setHeaders([]);
    setSortKey(null);
    setSearch("");
    setPage(0);
    try {
      const text = await f.text();
      const parsed = Papa.parse(text, {
        header: true,
        skipEmptyLines: true,
        dynamicTyping: false,
      });
      if (parsed.meta.fields) {
        const h = parsed.meta.fields.filter(Boolean);
        setHeaders(h);
        const data = (parsed.data as Record<string, unknown>[]).map((r, i) => ({
          row: i + 1,
          cells: h.reduce<Record<string, unknown>>((acc, col) => {
            const v = r[col];
            acc[col] =
              v === null || v === undefined || v === "" ? null : String(v);
            return acc;
          }, {}),
        }));
        setRows(data);
        return;
      }
      throw new Error("bad-csv");
    } catch {
      // fall back to ExcelJS for .xlsx/.xls
      try {
        const buf = await f.arrayBuffer();
        const wb = new ExcelJS.Workbook();
        await wb.xlsx.load(buf);
        const ws = wb.worksheets[0];
        if (!ws) throw new Error("empty-xlsx");
        const all: { cells: unknown[] }[] = [];
        ws.eachRow({ includeEmpty: false }, (row) => {
          all.push({ cells: (row.values as unknown[]).slice(1) });
        });
        if (!all.length) throw new Error("empty-xlsx");
        const cols: string[] = [];
        all[0].cells.forEach((c) => {
          if (c === null || c === undefined || String(c).trim() === "") return;
          cols.push(String(c).trim());
        });
        setHeaders(cols);
        setRows(
          all.slice(1).map((r, i) => {
            const cells: Record<string, unknown> = {};
            cols.forEach((col, idx) => {
              const v = r.cells[idx] ?? null;
              cells[col] =
                v === "" || v === null
                  ? null
                  : typeof v === "object"
                    ? JSON.stringify(v)
                    : String(v);
            });
            return { row: i + 1, cells };
          }),
        );
      } catch {
        setError(t("sheet.parseError"));
      }
    }
  };

  const filtered = useMemo(() => {
    if (!search.trim()) return rows;
    const q = search.trim().toLowerCase();
    return rows.filter((r) =>
      headers.some((h) =>
        String(r.cells[h] ?? "")
          .toLowerCase()
          .includes(q),
      ),
    );
  }, [rows, headers, search]);

  const sorted = useMemo(() => {
    if (!sortKey) return filtered;
    const factor = sortAsc ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const av = a.cells[sortKey];
      const bv = b.cells[sortKey];
      if (av === null && bv === null) return 0;
      if (av === null) return 1;
      if (bv === null) return -1;
      const na = Number(av);
      const nb = Number(bv);
      if (!Number.isNaN(na) && !Number.isNaN(nb)) return (na - nb) * factor;
      return String(av).localeCompare(String(bv)) * factor;
    });
  }, [filtered, sortKey, sortAsc]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const pageRows = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const handleExport = async () => {
    setExporting(true);
    try {
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet("Data");
      ws.columns = headers.map((h) => ({ header: h, key: h, width: 18 }));
      for (const r of sorted) {
        ws.addRow(
          headers.reduce<Record<string, unknown>>((acc, h) => {
            acc[h] = r.cells[h] ?? "";
            return acc;
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
      const buffer = await wb.xlsx.writeBuffer();
      downloadBuffer(
        buffer,
        fileName.replace(/\.[^.]+$/, "") || "data",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      );
    } catch {
      setError(t("sheet.parseError"));
    } finally {
      setExporting(false);
    }
  };

  const toggleSort = (h: string) => {
    if (sortKey === h) setSortAsc((v) => !v);
    else {
      setSortKey(h);
      setSortAsc(true);
    }
  };

  return (
    <div className="border border-white/10 rounded-3xl bg-white/[0.02] p-5">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#4f7cff] to-[#8b5cf6] flex items-center justify-center shrink-0">
          <Table2 className="w-5 h-5 text-white" />
        </div>
        <div>
          <h2 className="font-semibold flex items-center gap-2">
            {t("tools.spreadsheet")}
          </h2>
          <p className="text-xs text-white/50">{t("tools.spreadsheetDesc")}</p>
        </div>
      </div>

      <p className="text-[11px] text-emerald-300/80 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-2.5 py-1.5 mb-3">
        {t("sheet.hint")}
      </p>

      <div
        className="border-2 border-dashed border-[#4f7cff]/40 rounded-2xl p-5 text-center cursor-pointer hover:bg-[#4f7cff]/5 transition"
        onClick={() => inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          className="hidden"
          onChange={(e) => loadFile(e.target.files?.[0] || null)}
        />
        <UploadCloud className="h-9 w-9 text-[#4f7cff] mx-auto mb-2" />
        <p className="font-medium text-sm">
          {fileName || t("tools.spreadsheet")}
        </p>
        <p className="text-xs text-white/40 mt-1">
          {t("sheet.rowsCount", { n: rows.length })}
        </p>
      </div>

      {error && (
        <div className="mt-4 bg-red-500/10 border border-red-500/30 text-red-400 text-sm px-4 py-3 rounded-2xl">
          {error}
        </div>
      )}

      {rows.length > 0 && (
        <div className="mt-4">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <div className="flex items-center gap-2 bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2 flex-1 min-w-[200px]">
              <Search className="w-4 h-4 text-white/40" />
              <input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(0);
                }}
                placeholder={t("sheet.search")}
                className="bg-transparent outline-none text-sm text-white flex-1 placeholder-white/25"
              />
            </div>
            <button
              type="button"
              onClick={handleExport}
              disabled={exporting}
              className="flex items-center gap-2 bg-gradient-to-r from-[#4f7cff] to-[#8b5cf6] hover:brightness-110 disabled:opacity-40 text-white text-sm font-medium px-4 py-2 rounded-xl transition shadow-lg shadow-blue-500/20"
            >
              {exporting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              {t("sheet.exportXlsx")}
            </button>
          </div>

          <div className="flex flex-wrap gap-2 mb-3 text-xs text-white/50">
            <span>{t("sheet.rowsCount", { n: sorted.length })}</span>
            <span>•</span>
            <span>{t("sheet.columnsCount", { n: headers.length })}</span>
          </div>

          <div className="overflow-auto rounded-2xl border border-white/10 max-h-[420px]">
            <table className="w-full text-xs">
              <thead className="sticky top-0 z-10">
                <tr>
                  <th className="px-3 py-2 bg-[#0a1428] text-white/40 font-medium border-b border-white/10">
                    #
                  </th>
                  {headers.map((h) => (
                    <th
                      key={h}
                      className="px-3 py-2 bg-[#0a1428] text-white/60 font-medium border-b border-white/10 cursor-pointer hover:text-[#4f7cff] whitespace-nowrap"
                      onClick={() => toggleSort(h)}
                    >
                      <span className="flex items-center gap-1">
                        {sortKey === h && (
                          <ArrowDownUp
                            className={`w-3 h-3 ${sortAsc ? "" : "rotate-180"}`}
                          />
                        )}
                        {h}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pageRows.map((r) => (
                  <tr
                    key={r.row}
                    className="border-b border-white/5 hover:bg-white/[0.02]"
                  >
                    <td className="px-3 py-1.5 text-white/30">{r.row}</td>
                    {headers.map((h) => (
                      <td
                        key={h}
                        className="px-3 py-1.5 text-white/70 whitespace-nowrap max-w-[220px] truncate"
                      >
                        {r.cells[h] == null ? (
                          <span className="text-red-400/70 italic">
                            {t("sheet.null")}
                          </span>
                        ) : (
                          String(r.cells[h])
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-3">
              <button
                type="button"
                disabled={page === 0}
                onClick={() => setPage((p) => p - 1)}
                className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white/70 text-xs disabled:opacity-30"
              >
                ‹
              </button>
              <span className="text-xs text-white/50">
                {page + 1} / {totalPages}
              </span>
              <button
                type="button"
                disabled={page >= totalPages - 1}
                onClick={() => setPage((p) => p + 1)}
                className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white/70 text-xs disabled:opacity-30"
              >
                ›
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================
// Local SQL Editor (browser-only, bounded SELECT subset)
// ============================================================
interface SqlRow {
  cells: Record<string, unknown>;
}

function detectValue(s: unknown): string {
  return s === null || s === undefined ? "" : String(s);
}

export function SqlEditorTool() {
  const { t } = useAppSettings();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [fileName, setFileName] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [data, setData] = useState<Record<string, unknown>[]>([]);
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<Record<string, unknown>[] | null>(null);
  const [columns, setColumns] = useState<string[]>([]);
  const [error, setError] = useState("");

  const loadFile = async (f: File | null) => {
    if (!f) return;
    setError("");
    setFileName(f.name);
    setResult(null);
    try {
      const text = await f.text();
      const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
      if (!parsed.meta.fields) throw new Error("bad");
      const h = parsed.meta.fields.filter(Boolean);
      setHeaders(h);
      setData(parsed.data as Record<string, unknown>[]);
      setQuery(`SELECT * FROM data LIMIT 100`);
    } catch {
      try {
        const buf = await f.arrayBuffer();
        const wb = new ExcelJS.Workbook();
        await wb.xlsx.load(buf);
        const ws = wb.worksheets[0];
        if (!ws) throw new Error("bad");
        const all: { cells: unknown[] }[] = [];
        ws.eachRow({ includeEmpty: false }, (row) => {
          all.push({ cells: (row.values as unknown[]).slice(1) });
        });
        if (!all.length) throw new Error("bad");
        const h: string[] = [];
        all[0].cells.forEach((c) => {
          if (c !== null && c !== undefined && String(c).trim() !== "")
            h.push(String(c).trim());
        });
        const rows: Record<string, unknown>[] = [];
        for (const r of all.slice(1)) {
          const obj: Record<string, unknown> = {};
          h.forEach((col, idx) => {
            const v = r.cells[idx] ?? null;
            obj[col] =
              v === "" ? null : typeof v === "object" ? JSON.stringify(v) : v;
          });
          rows.push(obj);
        }
        setHeaders(h);
        setData(rows);
        setQuery(`SELECT * FROM data LIMIT 100`);
      } catch {
        setError(t("sheet.parseError"));
      }
    }
  };

  const run = () => {
    setError("");
    setResult(null);
    try {
      const sql = query.trim();
      if (!sql || !data.length) return;
      const cols = new Set(headers);

      // Parse SELECT <exprs> FROM data [WHERE ...] [GROUP BY c] [ORDER BY c] [LIMIT n]
      const selectMatch = sql.match(/SELECT\s+(.+?)\s+FROM\s+/i);
      if (!selectMatch) throw new Error("no-select");
      const selExprs = selectMatch[1]
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const rest = sql.slice(sql.indexOf("FROM") + 4);
      const limitMatch = rest.match(/LIMIT\s+(\d+)/i);
      const limit = limitMatch ? Math.min(Number(limitMatch[1]), 5000) : 1000;
      let body = limitMatch ? rest.replace(/LIMIT\s+\d+/i, "") : rest;

      const orderMatch = body.match(/ORDER\s+BY\s+(.+?)(?:\s+(ASC|DESC))?$/i);
      let orderCol = "";
      let orderDesc = false;
      let orderMatchRaw: string | null = null;
      if (orderMatch) {
        orderMatchRaw = orderMatch[1].trim();
        orderCol = orderMatchRaw.replace(/^"|"$/g, "").replace(/^`|`$/g, "");
        orderDesc = (orderMatch[2] || "").toUpperCase() === "DESC";
        body = body.slice(0, body.indexOf(orderMatch[0]));
      }

      const groupMatch = body.match(
        /GROUP\s+BY\s+(.+?)(?:\s+ORDER\s+BY|\s+LIMIT|$)/i,
      );
      let groupCol = "";
      if (groupMatch) {
        groupCol = groupMatch[1]
          .trim()
          .replace(/^"|"$/g, "")
          .replace(/^`|`$/g, "");
        body = body.slice(0, body.indexOf(groupMatch[0]));
      }

      let whereClause = "";
      const whereMatch = body.match(
        /WHERE\s+(.+?)(?:\s+GROUP\s+BY|\s+ORDER\s+BY|\s+LIMIT|$)/i,
      );
      if (whereMatch) {
        whereClause = whereMatch[1].trim();
      }

      // Build a safe filter AST evaluator over cell strings.
      const rowMatches = (r: Record<string, unknown>): boolean => {
        if (!whereClause) return true;
        const evalOr = (orParts: string[][]): boolean => orParts.some(evalAnd);
        const evalAnd = (andParts: string[]): boolean =>
          andParts.every(evalPrimitive);
        const evalPrimitive = (expr: string): boolean => {
          expr = expr.trim();
          const m = expr.match(
            /^"?([\w.ä-üÄ-Ü\u0600-\u06FF]+)"?\s*(=|!=|<>|>=|<=|>|<|LIKE)\s*'?(.*?)'?$/i,
          );
          if (!m) return true; // unsupported → keep row
          const [, colRaw, op, valRaw] = m;
          const col = colRaw.replace(/^"|"$/g, "").replace(/^`|`$/g, "");
          const cell = detectValue(r[col]);
          if (op.toUpperCase() === "LIKE") {
            const needle = valRaw.replace(/%/g, ".*").toLowerCase();
            return new RegExp(`^${needle}$`).test(cell.toLowerCase());
          }
          const left = Number(cell);
          const right = Number(valRaw);
          if (!Number.isNaN(left) && !Number.isNaN(right)) {
            switch (op) {
              case "=":
                return left === right;
              case "!=":
              case "<>":
                return left !== right;
              case ">":
                return left > right;
              case "<":
                return left < right;
              case ">=":
                return left >= right;
              case "<=":
                return left <= right;
            }
          }
          switch (op) {
            case "=":
              return cell === valRaw || cell === `"${valRaw}"`;
            case "!=":
            case "<>":
              return cell !== valRaw && cell !== `"${valRaw}"`;
            case ">":
              return cell > valRaw;
            case "<":
              return cell < valRaw;
            case ">=":
              return cell >= valRaw;
            case "<=":
              return cell <= valRaw;
          }
          return true;
        };
        return evalOr(
          whereClause.split(/\s+OR\s+/).map((p) => p.split(/\s+AND\s+/)),
        );
      };

      let filtered = data.filter(rowMatches);

      // GROUP BY with aggregates
      let outCols: string[] = [];
      let outRows: Record<string, unknown>[] = [];

      if (groupCol && cols.has(groupCol)) {
        const isAgg = (expr: string) =>
          /^(COUNT|SUM|AVG|MIN|MAX)\s*\(/i.test(expr);
        const aggExprs = selExprs.filter(isAgg);
        if (!aggExprs.length) throw new Error("no-agg");
        const groups = new Map<string, Record<string, unknown>[]>();
        for (const r of filtered) {
          const key = detectValue(r[groupCol]);
          const arr = groups.get(key) || [];
          arr.push(r);
          groups.set(key, arr);
        }
        const compute = (
          expr: string,
          rowsArr: Record<string, unknown>[],
        ): unknown => {
          const m = expr.match(
            /^(COUNT|SUM|AVG|MIN|MAX)\s*\(\s*([\w."`\u0600-\u06FF]+)\s*\)\s*(?:AS\s+([\w."`]+))?/i,
          );
          if (!m) return null;
          const fn = m[1].toUpperCase();
          const inner = m[3] || m[2];
          const argCol = m[2].replace(/^"|"$/g, "").replace(/^`|`$/g, "");
          if (fn === "COUNT") {
            if (
              argCol.toLowerCase() === "*" ||
              argCol.toLowerCase() === "count(*)" ||
              /^\*$/.test(argCol)
            ) {
              return rowsArr.length;
            }
            return rowsArr.filter((r) => r[argCol] != null && r[argCol] !== "")
              .length;
          }
          const nums = rowsArr
            .map((r) => Number(r[argCol]))
            .filter((n) => !Number.isNaN(n));
          if (!nums.length) return 0;
          switch (fn) {
            case "SUM":
              return nums.reduce((a, b) => a + b, 0);
            case "AVG":
              return nums.reduce((a, b) => a + b, 0) / nums.length;
            case "MIN":
              return Math.min(...nums);
            case "MAX":
              return Math.max(...nums);
          }
          return null;
        };
        outCols = [
          groupCol,
          ...aggExprs.map((e) => e.replace(/\s+AS\s+([\w."`]+)/i, "")),
        ];
        outRows = Array.from(groups.entries()).map(([key, rowsArr]) => {
          const row: Record<string, unknown> = { [groupCol]: key };
          for (const expr of aggExprs) {
            const aliasMatch = expr.match(/AS\s+([\w."`]+)/i);
            const label = aliasMatch
              ? aliasMatch[1].replace(/^"|"$/g, "").replace(/^`|`$/g, "")
              : expr;
            row[label] = compute(expr, rowsArr);
          }
          return row;
        });
      } else {
        // No grouping — whole-row projection with optional expressions
        const project = selExprs.some(
          (e) =>
            /^(COUNT|SUM|AVG|MIN|MAX|\*)\s*\(/i.test(e.replace(/\*/g, "")) ||
            e.trim() === "*",
        );
        if (selExprs.length === 1 && selExprs[0].trim() === "*") {
          outCols = headers;
          outRows = filtered;
        } else {
          const isAgg = (expr: string) =>
            /^(COUNT|SUM|AVG|MIN|MAX)\s*\(/i.test(expr);
          if (selExprs.every(isAgg)) {
            outCols = selExprs.map((e) => {
              const am = e.match(/AS\s+([\w."`]+)/i);
              return am
                ? am[1].replace(/^"|"$/g, "").replace(/^`|`$/g, "")
                : e.replace(/^\*\s*>/i, "").replace(/\s*AS\s+[\w."`]+/i, "");
            });
            const compute = (expr: string): unknown => {
              const m = expr.match(
                /^(COUNT|SUM|AVG|MIN|MAX)\s*\(\s*([\w."`\u0600-\u06FF*]+)\s*\)/i,
              );
              if (!m) return null;
              const fn = m[1].toUpperCase();
              const argCol = m[2].replace(/^"|"$/g, "").replace(/^`|`$/g, "");
              if (fn === "COUNT") return filtered.length;
              const nums = filtered
                .map((r) => Number(r[argCol]))
                .filter((n) => !Number.isNaN(n));
              if (!nums.length) return 0;
              switch (fn) {
                case "SUM":
                  return nums.reduce((a, b) => a + b, 0);
                case "AVG":
                  return nums.reduce((a, b) => a + b, 0) / nums.length;
                case "MIN":
                  return Math.min(...nums);
                case "MAX":
                  return Math.max(...nums);
              }
              return null;
            };
            outCols = selExprs.map((e) => {
              const am = e.match(/AS\s+([\w."`]+)/i);
              return am ? am[1].replace(/^"|"$/g, "").replace(/^`|`$/g, "") : e;
            });
            const row: Record<string, unknown> = {};
            selExprs.forEach((e, i) => {
              row[outCols[i]] = compute(e);
            });
            outRows = [row];
          } else {
            outCols = selExprs.map((e) =>
              e.replace(/^"|"$/g, "").replace(/^`|`$/g, "").trim(),
            );
            outRows = filtered.map((r) => {
              const row: Record<string, unknown> = {};
              selExprs.forEach((e, i) => {
                const col = e.includes(" AS ") ? e.split(/\s+AS\s+/i)[0] : e;
                const aliasMatch = e.match(/AS\s+([\w."`]+)/i);
                const label = aliasMatch
                  ? aliasMatch[1].replace(/^"|"$/g, "").replace(/^`|`$/g, "")
                  : e.replace(/^"|"$/g, "").replace(/^`|`$/g, "").trim();
                const colName = col
                  .replace(/^"|"$/g, "")
                  .replace(/^`|`$/g, "")
                  .trim();
                row[label] = r[colName] ?? null;
              });
              return row;
            });
          }
        }
        outCols = Object.keys(outRows[0] || {});
      }

      // ORDER BY
      if (orderCol && outRows.length) {
        const factor = orderDesc ? -1 : 1;
        outRows.sort((a, b) => {
          const av = detectValue(a[orderCol]);
          const bv = detectValue(b[orderCol]);
          const na = Number(av);
          const nb = Number(bv);
          if (!Number.isNaN(na) && !Number.isNaN(nb)) return (na - nb) * factor;
          return av.localeCompare(bv) * factor;
        });
      }

      outRows = outRows.slice(0, limit);
      setColumns(outCols.length ? outCols : headers);
      setResult(outRows);
    } catch (e) {
      setError(
        t("sql.error", {
          msg: e instanceof Error ? e.message : String(e),
        }),
      );
    }
  };

  return (
    <div className="border border-white/10 rounded-3xl bg-white/[0.02] p-5">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#0ea5e9] to-[#4f7cff] flex items-center justify-center shrink-0">
          <Database className="w-5 h-5 text-white" />
        </div>
        <div>
          <h2 className="font-semibold flex items-center gap-2">
            {t("tools.sql")}
          </h2>
          <p className="text-xs text-white/50">{t("tools.sqlDesc")}</p>
        </div>
      </div>

      <div
        className="border-2 border-dashed border-sky-400/40 rounded-2xl p-4 text-center cursor-pointer hover:bg-sky-400/5 transition"
        onClick={() => inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          className="hidden"
          onChange={(e) => loadFile(e.target.files?.[0] || null)}
        />
        <FileSpreadsheet className="h-8 w-8 text-sky-400 mx-auto mb-2" />
        <p className="font-medium text-sm">{fileName || t("tools.sql")}</p>
        <p className="text-xs text-white/40 mt-1">
          {t("sheet.rowsCount", { n: data.length })}
        </p>
      </div>

      {error && (
        <div className="mt-4 bg-red-500/10 border border-red-500/30 text-red-400 text-sm px-4 py-3 rounded-2xl">
          {error}
        </div>
      )}

      {data.length > 0 && (
        <div className="mt-4 space-y-3">
          <textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("sql.placeholder")}
            spellCheck={false}
            dir="ltr"
            className="w-full bg-[#0a1428] border border-white/15 rounded-xl px-3 py-2.5 font-mono text-sm text-[#7dd3fc] placeholder-white/20 focus:outline-none focus:border-sky-400/50 resize-y"
            rows={3}
          />
          <p className="text-[11px] text-white/40">{t("sql.hint")}</p>
          <div className="flex flex-wrap gap-3">
            <select
              value={headers[0] || ""}
              onChange={(e) =>
                setQuery(
                  `SELECT * FROM data WHERE "${e.target.value}" = '' LIMIT 50`,
                )
              }
              className="bg-white/[0.04] border border-white/15 rounded-xl px-3 py-2 text-xs outline-none focus:border-sky-400/60 text-white/70"
            >
              {headers.map((h) => (
                <option key={h} value={h}>
                  {h}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={run}
              className="flex items-center gap-2 bg-gradient-to-r from-[#0ea5e9] to-[#4f7cff] hover:brightness-110 text-white text-sm font-medium px-4 py-2 rounded-xl transition shadow-lg shadow-sky-500/20"
            >
              <Play className="w-4 h-4" />
              {t("sql.run")}
            </button>
          </div>

          {result && (
            <div className="overflow-auto rounded-2xl border border-white/10 max-h-[360px]">
              <table className="w-full text-xs">
                <thead className="sticky top-0 z-10">
                  <tr>
                    {columns.map((c) => (
                      <th
                        key={c}
                        className="px-3 py-2 bg-[#0a1428] text-white/60 font-medium border-b border-white/10 whitespace-nowrap"
                      >
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.map((r, i) => (
                    <tr
                      key={i}
                      className="border-b border-white/5 hover:bg-white/[0.02]"
                    >
                      {columns.map((c) => (
                        <td
                          key={c}
                          className="px-3 py-1.5 text-white/70 whitespace-nowrap"
                        >
                          {r[c] == null || r[c] === "" ? (
                            <span className="text-red-400/70 italic">
                              {t("sheet.null")}
                            </span>
                          ) : (
                            String(r[c])
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {result.length === 0 && (
                <p className="text-center text-white/40 text-xs py-6">
                  {t("sql.noResults")}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================
// JSON formatter
// ============================================================
export function JsonFormatterTool() {
  const { t } = useAppSettings();
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [status, setStatus] = useState<"idle" | "valid" | "invalid">("idle");

  const handle = (mode: "format" | "minify") => {
    try {
      const parsed = JSON.parse(input);
      setOutput(
        mode === "format"
          ? JSON.stringify(parsed, null, 2)
          : JSON.stringify(parsed),
      );
      setStatus("valid");
    } catch {
      setStatus("invalid");
    }
  };

  const downloadJson = () => {
    if (!output) return;
    const blob = new Blob([output], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "data.json";
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="border border-white/10 rounded-3xl bg-white/[0.02] p-5">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#a78bfa] to-[#f472b6] flex items-center justify-center shrink-0">
          <Braces className="w-5 h-5 text-white" />
        </div>
        <div>
          <h2 className="font-semibold flex items-center gap-2">
            {t("tools.json")}
          </h2>
          <p className="text-xs text-white/50">{t("tools.jsonDesc")}</p>
        </div>
      </div>

      <textarea
        value={input}
        onChange={(e) => {
          setInput(e.target.value);
          setStatus("idle");
        }}
        placeholder={t("json.placeholder")}
        spellCheck={false}
        dir="ltr"
        className="w-full bg-[#0a1428] border border-white/15 rounded-xl px-3 py-2.5 font-mono text-sm text-[#c4b5fd] placeholder-white/20 focus:outline-none focus:border-purple-400/50 resize-y"
        rows={6}
      />

      <div className="flex flex-wrap gap-2 mt-3">
        <button
          type="button"
          onClick={() => handle("format")}
          className="flex items-center gap-2 bg-gradient-to-r from-[#a78bfa] to-[#4f7cff] hover:brightness-110 text-white text-sm font-medium px-4 py-2 rounded-xl transition shadow-lg shadow-purple-500/20"
        >
          {t("json.format")}
        </button>
        <button
          type="button"
          onClick={() => handle("minify")}
          className="flex items-center gap-2 bg-white/5 border border-white/10 text-white/80 text-sm font-medium px-4 py-2 rounded-xl hover:bg-white/10 transition"
        >
          {t("json.minify")}
        </button>
        {output && (
          <button
            type="button"
            onClick={downloadJson}
            className="flex items-center gap-2 bg-white/5 border border-white/10 text-white/80 text-sm font-medium px-4 py-2 rounded-xl hover:bg-white/10 transition"
          >
            <Download className="w-4 h-4" />
            {t("json.export")}
          </button>
        )}
        {status === "valid" && (
          <span className="flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 rounded-full px-3 py-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" /> {t("json.valid")}
          </span>
        )}
        {status === "invalid" && (
          <span className="flex items-center gap-1.5 text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded-full px-3 py-1.5">
            <XCircle className="w-3.5 h-3.5" /> {t("json.invalid")}
          </span>
        )}
      </div>

      {output && (
        <pre
          className="mt-3 bg-[#0a1428] border border-white/10 rounded-xl p-4 text-xs text-[#a5f3fc] overflow-auto max-h-72 font-mono whitespace-pre"
          dir="ltr"
        >
          {output}
        </pre>
      )}
    </div>
  );
}

// ============================================================
// Regex tester
// ============================================================
export function RegexTesterTool() {
  const { t } = useAppSettings();
  const [pattern, setPattern] = useState("");
  const [flags, setFlags] = useState("gi");
  const [testText, setTestText] = useState("");

  const { matches, error } = useMemo(() => {
    if (!pattern) return { matches: [], error: "" };
    try {
      const re = new RegExp(pattern, flags);
      const found: string[] = [];
      let m: RegExpExecArray | null;
      while ((m = re.exec(testText)) !== null) {
        found.push(m[0]);
        if (m.index === re.lastIndex) re.lastIndex++;
        if (found.length >= 200) break;
      }
      return { matches: found, error: "" };
    } catch (e) {
      return {
        matches: [],
        error: e instanceof Error ? e.message : "regex-error",
      };
    }
  }, [pattern, flags, testText]);

  const highlight = useMemo(() => {
    if (!pattern || !testText) return testText;
    try {
      const re = new RegExp(pattern, flags);
      return testText.replace(re, (m) => `[${m}]`);
    } catch {
      return testText;
    }
  }, [pattern, flags, testText]);

  return (
    <div className="border border-white/10 rounded-3xl bg-white/[0.02] p-5">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#fbbf24] to-[#f472b6] flex items-center justify-center shrink-0">
          <Regex className="w-5 h-5 text-white" />
        </div>
        <div>
          <h2 className="font-semibold flex items-center gap-2">
            {t("tools.regex")}
          </h2>
          <p className="text-xs text-white/50">{t("tools.regexDesc")}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-white/50 mb-1">
            {t("regex.pattern")}
          </label>
          <input
            value={pattern}
            onChange={(e) => setPattern(e.target.value)}
            dir="ltr"
            spellCheck={false}
            placeholder="\d{3}-\d{4}"
            className="w-full bg-[#0a1428] border border-white/15 rounded-xl px-3 py-2 font-mono text-sm text-[#fcd34d] placeholder-white/20 focus:outline-none focus:border-amber-400/50"
          />
        </div>
        <div>
          <label className="block text-xs text-white/50 mb-1">
            {t("regex.flags")}
          </label>
          <input
            value={flags}
            onChange={(e) => setFlags(e.target.value)}
            dir="ltr"
            spellCheck={false}
            placeholder="gi"
            className="w-full bg-[#0a1428] border border-white/15 rounded-xl px-3 py-2 font-mono text-sm text-[#fcd34d] placeholder-white/20 focus:outline-none focus:border-amber-400/50"
          />
        </div>
      </div>

      <label className="block text-xs text-white/50 mt-3 mb-1">
        {t("regex.test")}
      </label>
      <textarea
        value={testText}
        onChange={(e) => setTestText(e.target.value)}
        spellCheck={false}
        className="w-full bg-[#0a1428] border border-white/15 rounded-xl px-3 py-2.5 font-mono text-sm text-white/80 placeholder-white/20 focus:outline-none focus:border-amber-400/50 resize-y"
        rows={4}
      />

      <div className="mt-3">
        {error ? (
          <p className="text-xs text-red-400">{error}</p>
        ) : pattern ? (
          <>
            <p className="text-xs text-white/50 mb-2">
              {matches.length
                ? t("regex.matches", { n: matches.length })
                : t("regex.noMatches")}
            </p>
            {highlight && (
              <pre
                className="bg-[#0a1428] border border-white/10 rounded-xl p-3 text-xs text-white/70 whitespace-pre-wrap"
                dir="ltr"
              >
                {highlight}
              </pre>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}

// ============================================================
// Data Dictionary generator (uses /analyze-data structure)
// ============================================================
interface DictRow {
  name: string;
  dtype: string;
  nulls: number;
  distinct: number;
  description?: string;
  top?: { value: string; count: number }[];
}

export function DictionaryTool() {
  const { t } = useAppSettings();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [fileName, setFileName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [dict, setDict] = useState<DictRow[] | null>(null);
  const [file, setFile] = useState<File | null>(null);

  const hasFile = typeof file !== "undefined" && file !== null;

  const generate = async () => {
    if (!file || loading) return;
    setLoading(true);
    setError("");
    setDict(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const { ok, data } = await postCompressedForm(
        API_ENDPOINTS.ANALYZE_DATA,
        form,
        authHeaders(),
      );
      const payload = data as {
        error?: string;
        detail?: string;
        columns?: Record<string, unknown>[];
      };
      if (!ok)
        throw new Error(
          payload.error || payload.detail || t("an.analysisError"),
        );
      const cols: DictRow[] = (payload.columns || []).map(
        (c: Record<string, unknown>) => ({
          name: String(c.name || ""),
          dtype: String(c.dtype || "?"),
          nulls: Number(c.nulls ?? 0),
          distinct: Number(c.distinct ?? 0),
          description: c.description ? String(c.description) : undefined,
          top: Array.isArray(c.top_values)
            ? (c.top_values as { value: string; count: number }[]).slice(0, 3)
            : undefined,
        }),
      );
      setDict(cols);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("an.analysisError"));
    } finally {
      setLoading(false);
    }
  };

  const downloadDictionary = async () => {
    if (!dict) return;
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Dictionary");
    ws.columns = [
      { header: t("dict.column"), key: "name", width: 22 },
      { header: t("dict.type"), key: "dtype", width: 14 },
      { header: t("dict.nulls"), key: "nulls", width: 10 },
      { header: t("dict.unique"), key: "distinct", width: 12 },
      { header: t("dict.bottom"), key: "top", width: 28 },
      { header: t("dict.description"), key: "description", width: 60 },
    ];
    for (const r of dict) {
      ws.addRow({
        name: r.name,
        dtype: r.dtype,
        nulls: r.nulls,
        distinct: r.distinct,
        top: r.top
          ? r.top.map((v) => `${v.value} (×${v.count})`).join(", ")
          : "",
        description: r.description || "",
      });
    }
    ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    ws.getRow(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF4F7CFF" },
    };
    const buffer = await wb.xlsx.writeBuffer();
    downloadBuffer(
      buffer,
      `${(fileName || "data").replace(/\.[^.]+$/, "")}_dictionary.xlsx`,
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
  };

  return (
    <div className="border border-white/10 rounded-3xl bg-white/[0.02] p-5">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#34d399] to-[#0ea5e9] flex items-center justify-center shrink-0">
          <BookOpen className="w-5 h-5 text-white" />
        </div>
        <div>
          <h2 className="font-semibold flex items-center gap-2">
            {t("tools.dictionary")}
          </h2>
          <p className="text-xs text-white/50">{t("tools.dictionaryDesc")}</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div
          className="border-2 border-dashed border-emerald-400/40 rounded-2xl p-4 text-center cursor-pointer hover:bg-emerald-400/5 transition flex-1"
          onClick={() => inputRef.current?.click()}
        >
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT}
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0] || null;
              setFile(f);
              setDict(null);
              setError("");
              if (f) setFileName(f.name);
            }}
          />
          <FileSpreadsheet className="h-8 w-8 text-emerald-400 mx-auto mb-2" />
          <p className="font-medium text-sm">
            {fileName || t("tools.dictionary")}
          </p>
        </div>
        <button
          type="button"
          onClick={generate}
          disabled={!hasFile || loading}
          className="flex items-center gap-2 bg-gradient-to-r from-[#34d399] to-[#0ea5e9] hover:brightness-110 disabled:opacity-40 text-white text-sm font-medium px-4 py-2 rounded-xl transition shadow-lg shadow-emerald-500/20 self-center"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <BookOpen className="w-4 h-4" />
          )}
          {loading ? t("dict.generating") : t("dict.generate")}
        </button>
      </div>

      {error && (
        <div className="mt-4 bg-red-500/10 border border-red-500/30 text-red-400 text-sm px-4 py-3 rounded-2xl">
          {error}
        </div>
      )}

      {dict && (
        <div className="mt-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs text-white/50">
              {t("dict.column")} × {dict.length}
            </p>
            <button
              type="button"
              onClick={downloadDictionary}
              className="flex items-center gap-2 bg-white/5 border border-white/10 text-white/80 text-sm font-medium px-4 py-2 rounded-xl hover:bg-white/10 transition"
            >
              <Download className="w-4 h-4" />
              {t("dict.export")}
            </button>
          </div>
          <div className="overflow-auto rounded-2xl border border-white/10 max-h-[360px]">
            <table className="w-full text-xs">
              <thead className="sticky top-0 z-10">
                <tr>
                  <th className="px-3 py-2 bg-[#0a1428] text-white/60 font-medium border-b border-white/10 text-right">
                    {t("dict.column")}
                  </th>
                  <th className="px-3 py-2 bg-[#0a1428] text-white/60 font-medium border-b border-white/10 text-right">
                    {t("dict.type")}
                  </th>
                  <th className="px-3 py-2 bg-[#0a1428] text-white/60 font-medium border-b border-white/10 text-right">
                    {t("dict.nulls")}
                  </th>
                  <th className="px-3 py-2 bg-[#0a1428] text-white/60 font-medium border-b border-white/10 text-right">
                    {t("dict.unique")}
                  </th>
                  <th className="px-3 py-2 bg-[#0a1428] text-white/60 font-medium border-b border-white/10 text-right">
                    {t("dict.description")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {dict.map((r) => (
                  <tr
                    key={r.name}
                    className="border-b border-white/5 hover:bg-white/[0.02] align-top"
                  >
                    <td className="px-3 py-2 text-white/80 font-medium whitespace-nowrap">
                      {r.name}
                    </td>
                    <td className="px-3 py-2">
                      <span className="text-[10px] bg-sky-500/10 text-sky-300 border border-sky-500/30 rounded-full px-2 py-0.5">
                        {r.dtype}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right text-white/60">
                      {r.nulls}
                    </td>
                    <td className="px-3 py-2 text-right text-white/60">
                      {r.distinct}
                    </td>
                    <td
                      className="px-3 py-2 text-white/50 max-w-[360px]"
                      dir="auto"
                    >
                      {r.description ||
                        r.top
                          ?.map((v) => `${v.value} (×${v.count})`)
                          .join(", ")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
