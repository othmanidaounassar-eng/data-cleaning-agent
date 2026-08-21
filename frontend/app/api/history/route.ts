// app/api/history/route.ts
import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_API_URL || "http://localhost:8000";

// ✅ تم حذف المعامل (request) لأنه غير مستخدم
export async function GET() {
  try {
    const response = await fetch(`${BACKEND_URL}/history`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error("❌ History GET Proxy Error:", error);
    return NextResponse.json(
      { error: "حدث خطأ أثناء جلب السجل" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const response = await fetch(`${BACKEND_URL}/history`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error("❌ History POST Proxy Error:", error);
    return NextResponse.json(
      { error: "حدث خطأ أثناء حفظ السجل" },
      { status: 500 },
    );
  }
}
