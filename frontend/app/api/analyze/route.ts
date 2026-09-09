// frontend/app/api/analyze/route.ts
import { NextRequest, NextResponse } from "next/server";
import { BACKEND_URL, backendHeaders } from "@/lib/backend";
import { ProxyPayloadError, decompressGzipBody } from "@/lib/proxy-body";

export async function POST(request: NextRequest) {
  try {
    const gzipBody = await decompressGzipBody(request);

    let body: BodyInit;
    let contentType = request.headers.get("content-type") || "";

    if (gzipBody) {
      body = gzipBody.body;
      contentType = gzipBody.contentType;
    } else {
      const formData = await request.formData();
      const file = formData.get("file");

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

      body = backendFormData;
      contentType = "";
    }

    const response = await fetch(`${BACKEND_URL}/analyze`, {
      method: "POST",
      body,
      headers: backendHeaders(
        request,
        contentType ? { "Content-Type": contentType } : undefined,
      ),
      signal: AbortSignal.timeout(180000),
    });

    const responseText = await response.text();
    const responseContentType = response.headers.get("content-type") || "";

    if (!responseContentType.includes("application/json")) {
      console.error("❌ Backend returned non-JSON:", responseText);
      return NextResponse.json(
        { error: "الخادم الخلفي أرجَع استجابة غير متوقعة. حاول مرة أخرى." },
        { status: response.status },
      );
    }

    let data;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      console.error("❌ JSON parse error:", parseError);
      return NextResponse.json(
        { error: "تعذّرت قراءة استجابة الخادم. حاول مرة أخرى." },
        { status: 502 },
      );
    }

    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error("❌ Analyze proxy Error:", error);

    if (error instanceof ProxyPayloadError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }
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
