// frontend/app/api/analyze-data/route.ts
import { NextRequest, NextResponse } from "next/server";
import { BACKEND_URL, backendHeaders } from "@/lib/backend";

const MAX_FILTERS_BYTES = 64 * 1024;

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const filters = formData.get("filters");

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: "ملف غير صالح أو غير موجود" },
        { status: 400 },
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const blob = new Blob([arrayBuffer], { type: file.type });
    const backendFormData = new FormData();
    backendFormData.append("file", blob, file.name);
    if (typeof filters === "string" && filters) {
      // The filters field must be a JSON array. Validate early so malformed
      // payloads never reach the backend and so we don't forward huge blobs.
      if (filters.length > MAX_FILTERS_BYTES) {
        return NextResponse.json(
          { error: "بيانات الفلترة كبيرة جداً." },
          { status: 413 },
        );
      }
      try {
        const parsedFilters = JSON.parse(filters);
        if (!Array.isArray(parsedFilters)) {
          throw new Error("filters must be an array");
        }
      } catch {
        return NextResponse.json(
          { error: "بيانات الفلترة غير صالحة." },
          { status: 400 },
        );
      }
      backendFormData.append("filters", filters);
    }

    const response = await fetch(`${BACKEND_URL}/analyze-data`, {
      method: "POST",
      body: backendFormData,
      headers: backendHeaders(request),
      signal: AbortSignal.timeout(180000),
    });

    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      return NextResponse.json(
        { error: "تعذّرت قراءة استجابة الخادم. حاول مرة أخرى." },
        { status: 502 },
      );
    }
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") {
      return NextResponse.json(
        { error: "الخادم الخلفي استغرق وقتاً طويلاً. حاول مرة أخرى." },
        { status: 504 },
      );
    }
    return NextResponse.json(
      { error: "تعذّرت المعالجة. حاول مرة أخرى." },
      { status: 500 },
    );
  }
}

export async function GET() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}
