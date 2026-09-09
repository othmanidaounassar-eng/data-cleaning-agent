// frontend/app/api/microsoft/status/route.ts
import { NextRequest, NextResponse } from "next/server";
import { BACKEND_URL, backendHeaders } from "@/lib/backend";

export async function GET(request: NextRequest) {
  try {
    const response = await fetch(`${BACKEND_URL}/microsoft/status`, {
      method: "GET",
      headers: backendHeaders(request),
      signal: AbortSignal.timeout(10000),
    });

    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      return NextResponse.json(
        { error: "تعذّرت قراءة استجابة الخادم." },
        { status: 502 },
      );
    }
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") {
      return NextResponse.json(
        { error: "انتهت مهلة الاتصال بالخادم." },
        { status: 504 },
      );
    }
    return NextResponse.json(
      { error: "تعذّر الاتصال بالخادم. تحقق من تشغيله." },
      { status: 500 },
    );
  }
}
