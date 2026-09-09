// frontend/app/api/convert/route.ts
import { NextRequest, NextResponse } from "next/server";
import { BACKEND_URL, backendHeaders } from "@/lib/backend";

const ALLOWED_TARGETS = new Set(["csv", "xlsx", "xls", "json"]);

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const target = formData.get("target");

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: "ملف غير صالح أو غير موجود" },
        { status: 400 },
      );
    }

    // Allowlist the output format; never forward arbitrary client strings.
    const targetValue = typeof target === "string" ? target : "xlsx";
    if (!ALLOWED_TARGETS.has(targetValue)) {
      return NextResponse.json(
        { error: "صيغة الإخراج غير مدعومة." },
        { status: 400 },
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const backendFormData = new FormData();
    backendFormData.append(
      "file",
      new Blob([arrayBuffer], { type: file.type }),
      file.name,
    );
    backendFormData.append("target", targetValue);

    const response = await fetch(`${BACKEND_URL}/convert`, {
      method: "POST",
      body: backendFormData,
      headers: backendHeaders(request),
      signal: AbortSignal.timeout(240000),
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
