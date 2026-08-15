import Papa from "papaparse";
import ExcelJS from "exceljs";

import { FileKind } from "./types";

export interface ParsedFile {
  headers: string[];
  rows: Record<string, unknown>[];
  encoding: string;
}

export async function parseFile(
  file: File,
  kind: FileKind,
): Promise<ParsedFile> {
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
        const headers = (result.meta.fields ?? []).map((f: string) => f.trim());
        const rows = result.data as Record<string, unknown>[];
        resolve({ headers, rows, encoding: "UTF-8" });
      },
      error: (err: Error) => reject(err),
    });
  });
}

async function parseExcel(file: File): Promise<ParsedFile> {
  try {
    const buffer = await file.arrayBuffer();
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);

    const worksheet = workbook.getWorksheet(1);
    if (!worksheet) {
      throw new Error("No worksheet found in Excel file.");
    }

    // استخراج العناوين من الصف الأول
    const headers: string[] = [];
    const firstRow = worksheet.getRow(1);
    if (firstRow.cellCount === 0) {
      throw new Error("The worksheet appears to be empty.");
    }

    firstRow.eachCell((cell: ExcelJS.Cell) => {
      headers.push(cell.text.trim());
    });

    // استخراج البيانات
    const rows: Record<string, unknown>[] = [];
    worksheet.eachRow((row: ExcelJS.Row, rowNumber: number) => {
      if (rowNumber === 1) return; // تخطي صف العناوين

      const rowData: Record<string, unknown> = {};
      row.eachCell((cell: ExcelJS.Cell, colNumber: number) => {
        const header = headers[colNumber - 1];
        if (header) {
          rowData[header] = cell.text.trim();
        }
      });
      rows.push(rowData);
    });

    if (rows.length === 0) {
      throw new Error("No data rows found in the Excel file.");
    }

    return {
      headers: headers.map((h) => h.trim()),
      rows,
      encoding: "Excel (binary)",
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to parse Excel file: ${errorMessage}`);
  }
}