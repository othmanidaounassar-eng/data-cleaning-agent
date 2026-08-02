import Papa from "papaparse";
import * as XLSX from "xlsx";
import { FileKind } from "./types";

export interface ParsedFile {
  headers: string[];
  rows: Record<string, unknown>[];
  encoding: string;
}

export async function parseFile(file: File, kind: FileKind): Promise<ParsedFile> {
  if (kind === "csv") {
    return parseCsv(file);
  }
  return parseExcel(file);
}

function parseCsv(file: File): Promise<ParsedFile> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: "greedy",
      dynamicTyping: true,
      encoding: "UTF-8",
      complete: (result) => {
        const headers = (result.meta.fields ?? []).map((f) => f.trim());
        const rows = result.data as Record<string, unknown>[];
        resolve({ headers, rows, encoding: "UTF-8" });
      },
      error: (err: Error) => reject(err),
    });
  });
}

async function parseExcel(file: File): Promise<ParsedFile> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
  const firstSheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[firstSheetName];

  const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: null,
  });

  const headers =
    json.length > 0
      ? Object.keys(json[0])
      : (XLSX.utils.sheet_to_json(sheet, { header: 1 })[0] as string[] | undefined) ?? [];

  return { headers: headers.map((h) => String(h).trim()), rows: json, encoding: "Excel (binary)" };
}
