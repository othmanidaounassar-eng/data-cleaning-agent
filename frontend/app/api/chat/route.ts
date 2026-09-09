// frontend/app/api/chat/route.ts
import { NextRequest, NextResponse } from "next/server";
import { BACKEND_URL, backendHeaders } from "@/lib/backend";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Forward only the fields the backend expects. Never spread the raw
    // client body (prevents injecting privileged fields) and never accept a
    // client-supplied system prompt (the backend defines its own).
    const messages = Array.isArray(body?.messages) ? body.messages : [];
    const context = body?.context;
    const language = body?.language;
    const sessionId = body?.session_id;

    const payload: Record<string, unknown> = { messages };
    if (typeof context === "object" && context !== null)
      payload.context = context;
    if (typeof language === "string") payload.language = language;
    if (typeof sessionId === "string" && sessionId)
      payload.session_id = sessionId;

    const response = await fetch(`${BACKEND_URL}/chat`, {
      method: "POST",
      headers: backendHeaders(request, { "Content-Type": "application/json" }),
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(90000),
    });

    const responseText = await response.text();
    const contentType = response.headers.get("content-type") || "";

    if (!contentType.includes("application/json")) {
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
    console.error("❌ Chat proxy Error:", error);

    if (error instanceof Error && error.name === "TimeoutError") {
      return NextResponse.json(
        { error: "الوكيل استغرق وقتاً طويلاً في الرد. حاول مرة أخرى." },
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
