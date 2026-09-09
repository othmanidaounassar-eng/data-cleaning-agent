// frontend/app/api/chat/sessions/route.ts
import { NextRequest, NextResponse } from "next/server";
import { BACKEND_URL, backendHeaders } from "@/lib/backend";

export async function GET(request: NextRequest) {
  const response = await fetch(`${BACKEND_URL}/chat/sessions`, {
    headers: backendHeaders(request),
  });
  const data = await response.json().catch(() => ({}));
  return NextResponse.json(data, { status: response.status });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  // Only forward the title field; ignore any other client-supplied fields.
  const title =
    typeof body?.title === "string" ? String(body.title).slice(0, 120) : "";
  const response = await fetch(`${BACKEND_URL}/chat/sessions`, {
    method: "POST",
    headers: backendHeaders(request, { "Content-Type": "application/json" }),
    body: JSON.stringify(title ? { title } : {}),
  });
  const data = await response.json().catch(() => ({}));
  return NextResponse.json(data, { status: response.status });
}
