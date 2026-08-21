// app/api/upload/route.ts
import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_API_URL || "http://localhost:8000";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: "ملف غير صالح أو غير موجود" },
        { status: 400 },
      );
    }

    const backendFormData = new FormData();
    backendFormData.append("file", file);

    const response = await fetch(`${BACKEND_URL}/clean`, {
      method: "POST",
      body: backendFormData,
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error("❌ Upload Proxy Error:", error);
    return NextResponse.json(
      { error: "حدث خطأ أثناء رفع الملف" },
      { status: 500 },
    );
  }
}

export async function GET() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}
