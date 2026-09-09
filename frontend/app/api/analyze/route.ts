// frontend/app/api/analyze/route.ts
import { NextRequest, NextResponse } from "next/server";
import { gunzip } from "zlib";
import { promisify } from "util";
import { BACKEND_URL, backendHeaders } from "@/lib/backend";

const gunzipAsync = promisify(gunzip);
const MAX_DECOMPRESSED_BYTES = 256 * 1024 * 1024;

export async function POST(request: NextRequest) {
  try {
    const isGzip = (request.headers.get("content-encoding") || "").includes(
      "gzip",
    );

    let body: BodyInit;
    let contentType = request.headers.get("content-type") || "";

    if (isGzip) {
      // Compressed multipart: decompress and forward the raw bytes unchanged,
      // keeping the original multipart boundary so FastAPI parses it natively.
      const compressed = Buffer.from(await request.arrayBuffer());
      const raw = await gunzipAsync(compressed);
      if (raw.length > MAX_DECOMPRESSED_BYTES) {
        return NextResponse.json(
          { error: "File exceeds the maximum supported size." },
          { status: 413 },
        );
      }
      body = new Uint8Array(raw);
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
