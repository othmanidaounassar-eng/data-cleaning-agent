// app/api/report/route.ts
import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_API_URL || "http://localhost:8000";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const fileId = searchParams.get("fileId");
    const reportId = searchParams.get("reportId");

    let url = `${BACKEND_URL}/report`;
    const params = new URLSearchParams();
    if (fileId) params.append("fileId", fileId);
    if (reportId) params.append("reportId", reportId);
    if (params.toString()) url += `?${params.toString()}`;

    const response = await fetch(url, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error("❌ Report GET Proxy Error:", error);
    return NextResponse.json(
      { error: "حدث خطأ أثناء جلب التقرير" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const response = await fetch(`${BACKEND_URL}/report`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error("❌ Report POST Proxy Error:", error);
    return NextResponse.json(
      { error: "حدث خطأ أثناء إنشاء التقرير" },
      { status: 500 },
    );
  }
}

export async function PUT() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}

export async function DELETE() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}
