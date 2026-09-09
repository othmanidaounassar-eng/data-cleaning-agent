// frontend/app/api/merge-files/route.ts
import { NextRequest, NextResponse } from "next/server";
import { BACKEND_URL, backendHeaders } from "@/lib/backend";

const ALLOWED_TARGETS = new Set(["csv", "xlsx", "xls", "json"]);

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const files = formData
      .getAll("files")
      .filter((f): f is File => f instanceof File);
    const target = formData.get("target");

    if (files.length === 0) {
      return NextResponse.json(
        { error: "أرسل ملفاً واحداً على الأقل" },
        { status: 400 },
      );
    }

    // Allowlist the output format; never forward arbitrary client strings.
    const targetValue = typeof target === "string" ? target : "csv";
    if (!ALLOWED_TARGETS.has(targetValue)) {
      return NextResponse.json(
        { error: "صيغة الإخراج غير مدعومة." },
        { status: 400 },
      );
    }

    const backendFormData = new FormData();
    for (const file of files) {
      const arrayBuffer = await file.arrayBuffer();
      backendFormData.append(
        "files",
        new Blob([arrayBuffer], { type: file.type }),
        file.name,
      );
    }
    backendFormData.append("target", targetValue);

    const response = await fetch(`${BACKEND_URL}/merge-files`, {
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
