"use client";

/* ═══════════════════════════════════════════════════════════════
   EXCEL FORMULA ENGINE
   Parses and evaluates Excel-style formulas (subset, Arabic-aware)
   ═══════════════════════════════════════════════════════════════ */

/* ─── Architecture: formulas hold cell references to a data grid ─── */
export interface FormulaContext {
  getCell(rowIdx: number, colIdx: number): unknown; // 0-based
  rowsCount: number;
  colsCount: number;
}

export class FormulaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FormulaError";
  }
}

/* ─── Column letter → index ─── */
export function colLetterToIndex(letter: string): number {
  let n = 0;
  for (const ch of letter.toUpperCase()) {
    n = n * 26 + (ch.charCodeAt(0) - 64);
  }
  return n - 1;
}

/* ─── Index → column letter ─── */
export function colIndexToLetter(idx: number): string {
  let s = "";
  let n = idx;
  while (n >= 0) {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  }
  return s;
}

/* ─── Basic date helpers matching Excel serial numbers ─── */
const EXCEL_EPOCH = Date.UTC(1899, 11, 30);
export function toExcelDate(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  if (!Number.isNaN(n)) return n;
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return null;
  return (date.getTime() - EXCEL_EPOCH) / 86400000;
}
export function fromExcelDate(serial: number): Date {
  return new Date(EXCEL_EPOCH + serial * 86400000);
}

/* ─── Tokenizer ─── */
interface Token {
  type:
    | "number"
    | "string"
    | "bool"
    | "ref"
    | "range"
    | "func"
    | "op"
    | "paren"
    | "comma"
    | "eof";
  value: string;
  row?: number;
  col?: number;
  rowFrom?: number;
  rowTo?: number;
  colFrom?: number;
  colTo?: number;
}

function tokenize(expr: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const s = expr;
  while (i < s.length) {
    const c = s[i];
    if (c === " " || c === "\t" || c === "\n") {
      i++;
      continue;
    }
    if (c === "," || c === "،" || c === ";") {
      tokens.push({ type: "comma", value: "," });
      i++;
      continue;
    }
    if (c === "(") {
      tokens.push({ type: "paren", value: "(" });
      i++;
      continue;
    }
    if (c === ")") {
      tokens.push({ type: "paren", value: ")" });
      i++;
      continue;
    }
    if (c === '"' || c === "'") {
      const quote = c;
      let j = i + 1;
      let str = "";
      while (j < s.length && s[j] !== quote) {
        str += s[j];
        j++;
      }
      tokens.push({ type: "string", value: str });
      i = j + 1;
      continue;
    }
    // TRUE / FALSE
    if (/^(TRUE|FALSE|صحيح|خطأ|صح|غلط)\b/i.test(s.slice(i))) {
      const m = /^(TRUE|FALSE|صحيح|خطأ|صح|غلط)\b/i.exec(s.slice(i))!;
      tokens.push({ type: "bool", value: m[1].toLowerCase() });
      i += m[1].length;
      continue;
    }
    // Range ref A1:B5
    const rangeM =
      /^\$?([A-Za-z]{1,3})\$?(\d+):\$?([A-Za-z]{1,3})\$?(\d+)/.exec(s.slice(i));
    if (rangeM) {
      const token: Token = {
        type: "range",
        value: rangeM[0],
        rowFrom: Number(rangeM[2]) - 1,
        rowTo: Number(rangeM[4]) - 1,
        colFrom: colLetterToIndex(rangeM[1]),
        colTo: colLetterToIndex(rangeM[3]),
      };
      tokens.push(token);
      i += rangeM[0].length;
      continue;
    }
    // Function name
    const funcM = /^([A-Za-z_][A-Za-z0-9_.,\s]{1,30})\(/g.exec(s.slice(i));
    // single cell ref A1
    const refM = /^\$?([A-Za-z]{1,3})\$?(\d+)/.exec(s.slice(i));
    // Arabic function names (مجموع، متوسط ...)
    const arFuncNames = [
      "مجموع",
      "متوسط",
      "عدد",
      "أكبر",
      "أصغر",
      "إذا",
      "جمع",
      "ربط",
      "طول",
      "حرر",
      "أعلى",
      "أسفل",
      "سنة",
      "شهر",
      "يوم",
      "الآن",
      "اليوم",
      "تقريب",
      "مطلق",
      "جذر",
      "أس",
      "صحيح",
      "جزأصحيح",
    ];
    if (funcM) {
      const name = funcM[1].trim();
      const arMatch = arFuncNames.includes(name);
      if (!arMatch) {
        tokens.push({ type: "func", value: name });
        i += funcM[0].length - 1;
        continue;
      }
    }
    if (refM) {
      const col = colLetterToIndex(refM[1]);
      const row = Number(refM[2]) - 1;
      tokens.push({ type: "ref", value: refM[0], row, col });
      i += refM[0].length;
      continue;
    }
    // Arabic keywords for functions: مجموعة numbers like (مجموع(A1:A5))
    for (const kw of arFuncNames) {
      if (s.slice(i, i + kw.length) === kw) {
        tokens.push({ type: "func", value: kw });
        i += kw.length;
        continue;
      }
    }
    // number
    if (/\d/.test(c)) {
      let j = i;
      while (
        j < s.length &&
        (/[\d.%]/.test(s[j]) || (s[j] === "," && /^\d/.test(s.slice(j + 1))))
      )
        j++;
      tokens.push({ type: "number", value: s.slice(i, j).replace(/,/g, "") });
      i = j;
      continue;
    }
    // operators
    if ("+-*/^%=".includes(c)) {
      tokens.push({ type: "op", value: c });
      i++;
      continue;
    }
    if (/[<>!]/.test(c) && /[=<>]/.test(s[i + 1] || "")) {
      tokens.push({ type: "op", value: c + s[i + 1] });
      i += 2;
      continue;
    }
    i++;
  }
  tokens.push({ type: "eof", value: "" });
  return tokens;
}

/* ─── Parser (recursive descent) ─── */
class Parser {
  private tokens: Token[];
  private pos = 0;
  constructor(expr: string) {
    this.tokens = tokenize(expr);
  }

  private peek(): Token {
    return this.tokens[this.pos];
  }
  private next(): Token {
    return this.tokens[this.pos++];
  }

  parse(ctx: FormulaContext): unknown {
    const v = this.parseComparison(ctx);
    this.expect("eof");
    return v;
  }

  private parseComparison(ctx: FormulaContext): unknown {
    let left = this.parseAddSub(ctx);
    while (
      this.peek().type === "op" &&
      ["=", "<>", "!=", ">", "<", ">=", "<="].includes(this.peek().value)
    ) {
      const op = this.next().value;
      const right = this.parseAddSub(ctx);
      left = compareValues(left, right, op);
    }
    return left;
  }

  private parseAddSub(ctx: FormulaContext): unknown {
    let left = this.parseMulDiv(ctx);
    while (
      this.peek().type === "op" &&
      ["+", "-"].includes(this.peek().value)
    ) {
      const op = this.next().value;
      const right = this.parseMulDiv(ctx);
      const l = Number(left);
      const r = Number(right);
      if (Number.isNaN(l) || Number.isNaN(r)) return null;
      left = op === "+" ? l + r : l - r;
    }
    return left;
  }

  private parseMulDiv(ctx: FormulaContext): unknown {
    let left = this.parsePower(ctx);
    while (
      this.peek().type === "op" &&
      ["*", "/", "%"].includes(this.peek().value)
    ) {
      const op = this.next().value;
      const right = this.parsePower(ctx);
      const l = Number(left);
      const r = Number(right);
      if (Number.isNaN(l) || Number.isNaN(r)) return null;
      if (op === "*") left = l * r;
      else if (op === "/") left = r === 0 ? null : l / r;
      else left = l % r;
    }
    return left;
  }

  private parsePower(ctx: FormulaContext): unknown {
    let left = this.parseUnary(ctx);
    while (this.peek().type === "op" && this.peek().value === "^") {
      this.next();
      const right = this.parseUnary(ctx);
      left = Math.pow(Number(left), Number(right));
    }
    return left;
  }

  private parseUnary(ctx: FormulaContext): unknown {
    if (this.peek().type === "op" && this.peek().value === "-") {
      this.next();
      const v = Number(this.parseUnary(ctx));
      return -v;
    }
    return this.parseAtom(ctx);
  }

  private parseAtom(ctx: FormulaContext): unknown {
    const tok = this.peek();

    if (tok.type === "number") {
      this.next();
      return Number(tok.value);
    }
    if (tok.type === "string") {
      this.next();
      return tok.value;
    }
    if (tok.type === "bool") {
      this.next();
      return (
        tok.value.startsWith("t") || tok.value === "صحيح" || tok.value === "صح"
      );
    }
    if (tok.type === "ref") {
      this.next();
      const row = tok.row ?? 0;
      const col = tok.col ?? 0;
      return ctx.getCell(row, col);
    }
    if (tok.type === "range") {
      this.next();
      return this.collectRange(ctx, tok);
    }
    if (tok.type === "func") {
      return this.parseFunction(ctx);
    }
    if (tok.type === "paren") {
      this.next();
      const v = this.parseComparison(ctx);
      this.expect("paren", ")");
      return v;
    }
    this.next();
    return null;
  }

  private collectRange(ctx: FormulaContext, tok: Token): unknown[] {
    if (
      tok.rowFrom === undefined ||
      tok.colFrom === undefined ||
      tok.rowTo === undefined ||
      tok.colTo === undefined
    )
      return [];
    const out: unknown[] = [];
    const endRow = Math.min(tok.rowTo, ctx.rowsCount - 1);
    const endCol = Math.min(tok.colTo, ctx.colsCount - 1);
    for (let r = tok.rowFrom; r <= endRow; r++) {
      for (let c = tok.colFrom; c <= endCol; c++) out.push(ctx.getCell(r, c));
    }
    return out;
  }

  private parseFunction(ctx: FormulaContext): unknown {
    const name = (this.next() as Token).value.toUpperCase();
    this.expect("paren", "(");
    const args: unknown[] = [];
    if (this.peek().value === ")") {
      this.next();
    } else {
      while (true) {
        args.push(this.parseComparison(ctx));
        if (this.peek().type === "comma") {
          this.next();
          continue;
        }
        break;
      }
      this.expect("paren", ")");
    }
    const AR = new Set(["مجموع", "SUM", "جمع", "TOTAL"]);
    const AVG = new Set(["متوسط", "AVERAGE", "MEAN"]);
    const CNT = new Set(["عدد", "COUNT"]);
    const CNA = new Set(["عددالقيم", "COUNTA", "عددالقيم"]);
    const MAX = new Set(["أكبر", "MAX", "MAXIMUM", "أقصى"]);
    const MIN = new Set(["أصغر", "MIN", "MINIMUM", "أدنى"]);
    const IF = new Set(["إذا", "IF"]);
    const CAT = new Set(["ربط", "CONCATENATE", "CONCAT", "CONCATENAR"]);
    const LEN = new Set(["طول", "LEN"]);
    const TRI = new Set(["حرر", "TRIM"]);
    const UPP = new Set(["أعلى", "UPPER"]);
    const LOW = new Set(["أسفل", "LOWER"]);
    const YER = new Set(["سنة", "YEAR"]);
    const MON = new Set(["شهر", "MONTH"]);
    const DYA = new Set(["يوم", "DAY"]);
    const RND = new Set(["تقريب", "ROUND"]);
    const ABS = new Set(["مطلق", "ABS"]);
    const SQT = new Set(["جذر", "SQRT"]);
    const PWR = new Set(["أس", "POWER"]);
    const NNW = new Set(["نص", "TEXT", "STR"]);
    const INT = new Set(["صحيح", "INT"]);
    const MOD = new Set(["بقية", "MOD"]);

    if (AR.has(name)) {
      const flat = args.flat(Infinity);
      return flat
        .map(Number)
        .filter((n) => !Number.isNaN(n))
        .reduce((a, b) => a + b, 0);
    }
    if (AVG.has(name)) {
      const flat = args
        .flat(Infinity)
        .map(Number)
        .filter((n) => !Number.isNaN(n));
      return flat.length ? flat.reduce((a, b) => a + b, 0) / flat.length : 0;
    }
    if (CNT.has(name)) {
      return args
        .flat(Infinity)
        .filter((v) => v != null && v !== "" && !Number.isNaN(Number(v)))
        .length;
    }
    if (CNA.has(name)) {
      const flat = args.flat(Infinity).length;
      return flat;
    }
    if (MAX.has(name)) {
      const vals = args
        .flat(Infinity)
        .map(Number)
        .filter((n) => !Number.isNaN(n));
      return vals.length ? Math.max(...vals) : null;
    }
    if (MIN.has(name)) {
      const vals = args
        .flat(Infinity)
        .map(Number)
        .filter((n) => !Number.isNaN(n));
      return vals.length ? Math.min(...vals) : null;
    }
    if (IF.has(name)) {
      const cond = args[0];
      if (cond == null) return args[2] ? args[2] : "";
      return cond ? args[1] ?? "" : args[2] ?? "";
    }
    if (CAT.has(name)) {
      return args
        .flat(Infinity)
        .map((v) => (v == null || v === "" ? "" : String(v)))
        .join("");
    }
    if (LEN.has(name)) {
      const s = args[0] == null ? "" : String(args[0]);
      return s.length;
    }
    if (TRI.has(name)) {
      return String(args[0] ?? "").trim();
    }
    if (UPP.has(name)) {
      return String(args[0] ?? "").toUpperCase();
    }
    if (LOW.has(name)) {
      return String(args[0] ?? "").toLowerCase();
    }
    if (YER.has(name)) {
      const d = toExcelDate(args[0]);
      return d !== null ? fromExcelDate(d).getUTCFullYear() : null;
    }
    if (MON.has(name)) {
      const d = toExcelDate(args[0]);
      return d !== null ? fromExcelDate(d).getUTCMonth() + 1 : null;
    }
    if (DYA.has(name)) {
      const d = toExcelDate(args[0]);
      return d !== null ? fromExcelDate(d).getUTCDate() : null;
    }
    if (RND.has(name)) {
      const n = Number(args[0]);
      const digits = Number(args[1] ?? 0);
      const f = Math.pow(10, digits);
      return Math.round(n * f) / f;
    }
    if (ABS.has(name)) {
      return Math.abs(Number(args[0] ?? 0));
    }
    if (SQT.has(name)) {
      const n = Number(args[0]);
      return n < 0 ? null : Math.sqrt(n);
    }
    if (PWR.has(name)) {
      const base = Number(args[0]);
      const exp = Number(args[1] ?? 1);
      return Math.pow(base, exp);
    }
    if (NNW.has(name)) {
      const fmt = String(args[1] ?? "0");
      const v = Number(args[0]);
      if (fmt.includes("%")) {
        const pct = (v * 100).toFixed(2);
        return `${pct}%`;
      }
      if (fmt.includes("0.0")) {
        return v.toFixed(1);
      }
      return String(v);
    }
    if (INT.has(name)) {
      return Math.trunc(Number(args[0] ?? 0));
    }
    if (MOD.has(name)) {
      const l = Number(args[0]);
      const r = Number(args[1]);
      return r === 0 ? null : l % r;
    }
    if (name === "COUNTIF" || name === "عددإذا") {
      const range = ((args[0] as unknown[]) ?? []).flat(Infinity);
      const crit = args[1];
      let count = 0;
      for (const v of range) {
        if (v == null || v === "") continue;
        const num = Number(v);
        if (typeof crit === "string") {
          const c = crit.trim();
          const m = /^([<>]=?)?(.+)$/.exec(c);
          if (m) {
            const target = Number(m[2]);
            if (!Number.isNaN(target) && !Number.isNaN(num)) {
              if (m[1] === ">" && num > target) count++;
              else if (m[1] === "<" && num < target) count++;
              else if (m[1] === ">=" && num >= target) count++;
              else if (m[1] === "<=" && num <= target) count++;
              else if (!m[1] && num === target) count++;
              continue;
            }
          }
          if (String(v).toLowerCase().includes(c.toLowerCase())) count++;
        } else if (v === crit) count++;
      }
      return count;
    }
    if (name === "ROWS" || name === "صفوف") {
      return ((args[0] as unknown[]) ?? []).flat(Infinity).length;
    }
    if (name === "MAXA" || name === "أشملأكبر") {
      const vals = args.flat(Infinity).map((v) => {
        const n = Number(v);
        return Number.isNaN(n) ? 0 : n;
      });
      return vals.length ? Math.max(...vals) : null;
    }
    if (name === "NOW" || name === "الآن") {
      return new Date().toLocaleString();
    }
    if (name === "TODAY" || name === "اليوم") {
      return new Date().toLocaleDateString();
    }

    return null;
  }

  private expect(type: Token["type"], value?: string) {
    const tok = this.peek();
    if (tok.type !== type || (value !== undefined && tok.value !== value)) {
      throw new FormulaError(
        `خطأ صياغة: متوقع "${value || type}" عند "${tok.value || ""}"`,
      );
    }
    this.next();
  }
}

/* ─── Public API ─── */
export function evaluateFormula(
  expr: string,
  ctx: FormulaContext,
): { value: unknown; error?: string } {
  try {
    const cleaned = expr.trim();
    if (cleaned.startsWith("=")) {
      const value = new Parser(cleaned.slice(1)).parse(ctx);
      return { value };
    }
    return { value: expr };
  } catch (e) {
    return {
      value: null,
      error: e instanceof Error ? e.message : "خطأ في المعادلة",
    };
  }
}

function compareValues(l: unknown, r: unknown, op: string): boolean {
  if (l == null || r == null)
    return op === "=" ? l === r : op === "<>" ? l !== r : false;
  const ln = Number(l);
  const rn = Number(r);
  if (!Number.isNaN(ln) && !Number.isNaN(rn)) {
    switch (op) {
      case "=":
        return ln === rn;
      case "<>":
      case "!=":
        return ln !== rn;
      case ">":
        return ln > rn;
      case "<":
        return ln < rn;
      case ">=":
        return ln >= rn;
      case "<=":
        return ln <= rn;
    }
  }
  const ls = String(l);
  const rs = String(r);
  const cmp = ls.localeCompare(rs);
  switch (op) {
    case "=":
      return cmp === 0;
    case "<>":
    case "!=":
      return cmp !== 0;
    case ">":
      return cmp > 0;
    case "<":
      return cmp < 0;
    case ">=":
      return cmp >= 0;
    case "<=":
      return cmp <= 0;
  }
  return false;
}

/* ═══════════════════════════════════════════════════════════════
   SMART FORMULA SUGGESTIONS
   ═══════════════════════════════════════════════════════════════ */
export interface ColumnProfile {
  name: string;
  type: "number" | "text" | "date" | "bool" | "empty";
  nulls: number;
  unique: number;
  min?: number;
  max?: number;
  mean?: number;
  sum?: number;
  count: number;
  sample: string[];
}

export function profileColumns(
  headers: string[],
  rows: Record<string, unknown>[],
): Record<string, ColumnProfile> {
  const profiles: Record<string, ColumnProfile> = {};
  for (const h of headers) {
    const vals = rows.map((r) => r[h]);
    const nonNull = vals.filter((v) => v != null && v !== "");
    const nums = nonNull.map(Number).filter((n) => !Number.isNaN(n));
    const dates = nonNull.filter((v) => !Number.isNaN(Date.parse(String(v))));
    const texts = nonNull.filter((v) =>
      /^\d{4}[-/]\d{1,2}[-/]\d{1,2}/.test(String(v).trim()),
    );
    let type: ColumnProfile["type"] = "empty";
    if (nonNull.length > 0 && nums.length === nonNull.length) type = "number";
    else if (
      nonNull.length > 0 &&
      (dates.length > nonNull.length * 0.8 ||
        texts.length > nonNull.length * 0.8)
    )
      type = "date";
    else if (
      nonNull.length > 0 &&
      nonNull.every(
        (v) =>
          String(v).toLowerCase() === "true" ||
          String(v).toLowerCase() === "false",
      )
    )
      type = "bool";
    else if (nonNull.length > 0) type = "text";

    profiles[h] = {
      name: h,
      type,
      nulls: rows.length - nonNull.length,
      unique: new Set(nonNull.map(String)).size,
      min: nums.length ? Math.min(...nums) : undefined,
      max: nums.length ? Math.max(...nums) : undefined,
      mean: nums.length
        ? nums.reduce((a, b) => a + b, 0) / nums.length
        : undefined,
      sum: nums.length ? nums.reduce((a, b) => a + b, 0) : undefined,
      count: nonNull.length,
      sample: nonNull.slice(0, 3).map(String),
    };
  }
  return profiles;
}

/* ─── Suggest formulas based on column profile ─── */
export interface FormulaSuggestion {
  formula: string;
  explanation: string;
  category: "إحصائية" | "حسابية" | "نصوص" | "تواريخ" | "منطقية" | "تجميع";
  columns: string[];
}

export function suggestFormulas(
  headers: string[],
  profiles: Record<string, ColumnProfile>,
): FormulaSuggestion[] {
  const suggestions: FormulaSuggestion[] = [];
  const numCols = headers.filter((h) => profiles[h]?.type === "number");
  const txtCols = headers.filter((h) => profiles[h]?.type === "text");
  const dateCols = headers.filter((h) => profiles[h]?.type === "date");
  const allCols = headers;

  if (numCols.length >= 1) {
    const c = numCols[0];
    suggestions.push({
      formula: `=SUM(${c})`,
      explanation: `إجمالي القيم الرقمية في عمود "${c}"`,
      category: "إحصائية",
      columns: [c],
    });
    suggestions.push({
      formula: `=AVERAGE(${c})`,
      explanation: `متوسط قيم عمود "${c}"`,
      category: "إحصائية",
      columns: [c],
    });
    suggestions.push({
      formula: `=MAX(${c})`,
      explanation: `أكبر قيمة في عمود "${c}"`,
      category: "إحصائية",
      columns: [c],
    });
    suggestions.push({
      formula: `=MIN(${c})`,
      explanation: `أصغر قيمة في عمود "${c}"`,
      category: "إحصائية",
      columns: [c],
    });
    suggestions.push({
      formula: `=ROUND(AVERAGE(${c}), 2)`,
      explanation: `متوسط "${c}" مقرباً إلى منزلتين`,
      category: "حسابية",
      columns: [c],
    });
    if (numCols.length >= 2) {
      suggestions.push({
        formula: `=SUM(${numCols[0]}) + SUM(${numCols[1]})`,
        explanation: `مجموع العمودين "${numCols[0]}" و"${numCols[1]}"`,
        category: "حسابية",
        columns: [numCols[0], numCols[1]],
      });
      suggestions.push({
        formula: `=AVERAGE(${numCols[0]}) / AVERAGE(${numCols[1]})`,
        explanation: `نسبة متوسطي العمودين`,
        category: "حسابية",
        columns: numCols.slice(0, 2),
      });
    }
  }
  if (txtCols.length >= 1) {
    const c = txtCols[0];
    suggestions.push({
      formula: `=COUNTA(${c})`,
      explanation: `عدد القيم غير الفارغة في "${c}"`,
      category: "تجميع",
      columns: [c],
    });
    suggestions.push({
      formula: `=LEN(${c})`,
      explanation: `طول النص في أول خلية من "${c}"`,
      category: "نصوص",
      columns: [c],
    });
    suggestions.push({
      formula: `=UPPER(${c})`,
      explanation: `تحويل قيمة "${c}" إلى أحرف كبيرة`,
      category: "نصوص",
      columns: [c],
    });
    if (txtCols.length >= 2) {
      suggestions.push({
        formula: `=${txtCols[0]} & " - " & ${txtCols[1]}`,
        explanation: `دمج نص "العمودين" بفاصل`,
        category: "نصوص",
        columns: txtCols.slice(0, 2),
      });
    }
    if (numCols.length >= 1) {
      suggestions.push({
        formula: `=IF(${numCols[0]} > AVERAGE(${numCols[0]}), "أعلى من المتوسط", "أدنى من المتوسط")`,
        explanation: `تصنيف تلقائي للقيم حسب المتوسط`,
        category: "منطقية",
        columns: [numCols[0]],
      });
    }
  }
  if (dateCols.length >= 1) {
    const c = dateCols[0];
    suggestions.push({
      formula: `=YEAR(${c})`,
      explanation: `استخراج السنة من تاريخ "${c}"`,
      category: "تواريخ",
      columns: [c],
    });
    suggestions.push({
      formula: `=MONTH(${c})`,
      explanation: `استخراج الشهر من تاريخ "${c}"`,
      category: "تواريخ",
      columns: [c],
    });
    suggestions.push({
      formula: `=MONTH(${c}) & "/" & YEAR(${c})`,
      explanation: `دمج الشهر والسنة كفترة زمنية من "${c}"`,
      category: "تواريخ",
      columns: [c],
    });
    suggestions.push({
      formula: `=ROWS(${c})`,
      explanation: `عدد السجلات في عمود التاريخ "${c}"`,
      category: "تواريخ",
      columns: [c],
    });
  }
  if (allCols.length >= 2) {
    suggestions.push({
      formula: `=COUNTIF(${allCols[1]}, ">0")`,
      explanation: `عدد القيم الموجبة في "${allCols[1]}"`,
      category: "تجميع",
      columns: [allCols[1]],
    });
  }
  if (numCols.length >= 2) {
    suggestions.push({
      formula: `=SUM(${numCols[0]})/SUM(${numCols[1]})`,
      explanation: `نسبة إجمالي العمودين="${numCols[0]}" و"${numCols[1]}"`,
      category: "حسابية",
      columns: numCols.slice(0, 2),
    });
  }
  return suggestions.slice(0, 12);
}

/* ═══════════════════════════════════════════════════════════════
   SMART ANALYSIS RECOMMENDATIONS
   heuristic + pattern-based, no server required
   ═══════════════════════════════════════════════════════════════ */
export interface AnalysisRecommendation {
  type: "chart" | "kpi" | "insight" | "clean" | "formula";
  title: string;
  detail: string;
  priority: number;
}

export function recommendAnalysis(
  headers: string[],
  rows: Record<string, unknown>[],
  profiles: Record<string, ColumnProfile>,
): AnalysisRecommendation[] {
  const recs: AnalysisRecommendation[] = [];
  const numCols = headers.filter((h) => profiles[h]?.type === "number");
  const catCols = headers.filter(
    (h) => profiles[h]?.type === "text" || profiles[h]?.type === "bool",
  );
  const dateCols = headers.filter((h) => profiles[h]?.type === "date");

  // 1. Duplicates
  if (numCols.length >= 2) {
    const c0 = numCols[0];
    const c1 = numCols[1];
    recs.push({
      type: "chart",
      priority: 9,
      title: `رسم مبعثر: ${c0} مقابل ${c1}`,
      detail: `يكشف العلاقة بين هذين العمودين الرقميين. أضفه في عارض Power BI لعرض الاتجاهات والشذوذ.`,
    });
  }
  if (catCols.length >= 1 && numCols.length >= 1) {
    recs.push({
      type: "chart",
      priority: 8,
      title: `رسم أعمدة: ${catCols[0]} حسب ${numCols[0]}`,
      detail: `يقارن قيم "${numCols[0]}" عبر فئات "${catCols[0]}" — مثالي لاكتشاف الفئات الأعلى أداءً.`,
    });
  }
  if (catCols.length >= 1) {
    recs.push({
      type: "chart",
      priority: 7,
      title: `رسم دائري: توزيع ${catCols[0]}`,
      detail: `يُظهر النسب المئوية لكل فئة في "${catCols[0]}" — سريع لفهم التوزيع.`,
    });
  }
  if (dateCols.length >= 1 && numCols.length >= 1) {
    recs.push({
      type: "chart",
      priority: 8,
      title: `خط زمني: ${numCols[0]} عبر ${dateCols[0]}`,
      detail: `رسم خطي يبرز الاتجاه الزمني — مفيد لتتبع التغير عبر الأشهر/السنوات.`,
    });
  }

  // KPIs
  if (numCols.length >= 1) {
    const c = numCols[0];
    const p = profiles[c];
    if (p?.sum != null)
      recs.push({
        type: "kpi",
        priority: 9,
        title: `المجموع الكلي: ${c}`,
        detail: `=SUM(${c}) ← ${p.sum.toLocaleString()}`,
      });
    if (p?.mean != null)
      recs.push({
        type: "kpi",
        priority: 7,
        title: `المتوسط العام: ${c}`,
        detail: `=AVERAGE(${c}) ← ${p.mean.toFixed(2)}`,
      });
    if (p?.max != null)
      recs.push({
        type: "kpi",
        priority: 6,
        title: `القيمة القصوى: ${c}`,
        detail: `=MAX(${c}) ← ${p.max.toLocaleString()}`,
      });
  }

  // Insights
  if (numCols.length >= 1) {
    const c = numCols[0];
    const p = profiles[c];
    if (p?.nulls && p.nulls > 0)
      recs.push({
        type: "insight",
        priority: 6,
        title: `${p.nulls} قيمة فارغة في "${c}"`,
        detail: `إكمال النسبة = ${Math.round((1 - p.nulls / rows.length) * 100)}%. يمكن ملؤها بالمتوسط في خطوة التنظيف.`,
      });
  }
  if (rows.length > 0) {
    const topNull = headers
      .map((h) => ({ h, n: profiles[h]?.nulls ?? 0 }))
      .sort((a, b) => b.n - a.n)[0];
    if (topNull?.n && topNull.n > 0)
      recs.push({
        type: "insight",
        priority: 5,
        title: `العمود الأكثر فراغاً: ${topNull.h}`,
        detail: `${topNull.n} قيمة فارغة من ${rows.length} صف (${Math.round((topNull.n / rows.length) * 100)}%).`,
      });
  }
  if (catCols.length >= 1) {
    const counts = new Map<string, number>();
    for (const r of rows.slice(0, 1000)) {
      const k = String(r[catCols[0]] ?? "N/A");
      counts.set(k, (counts.get(k) || 0) + 1);
    }
    const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
    if (top)
      recs.push({
        type: "insight",
        priority: 5,
        title: `الفئة الأكثر تكراراً: "${top[0]}"`,
        detail: `${top[1]} مرة في عمود "${catCols[0]}".`,
      });
  }

  // Clean suggestions
  recs.push({
    type: "clean",
    priority: 4,
    title: "تحديد نوع أعمدة ضعيف",
    detail:
      "نوع العمود يحتاج لتوحيد — استخدم أدوات التنظيف لتحويل النصوص إلى أرقام/تواريخ.",
  });
  recs.push({
    type: "clean",
    priority: 3,
    title: "إزالة القيم المكررة",
    detail:
      "استخدم خطوة التنظيف (إزالة التكرارات) لضمان التميز في البيانات قبل التحليل.",
  });

  // Formula rec
  const sugg = suggestFormulas(headers, profiles)[0];
  if (sugg)
    recs.push({
      type: "formula",
      priority: 4,
      title: `معادلة مقترحة: ${sugg.formula}`,
      detail: sugg.explanation,
    });

  return recs.sort((a, b) => b.priority - a.priority).slice(0, 10);
}
