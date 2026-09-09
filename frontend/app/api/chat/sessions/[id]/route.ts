// frontend/app/api/chat/sessions/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { BACKEND_URL, backendHeaders, safePathId } from "@/lib/backend";

function invalidId(): NextResponse {
  return NextResponse.json(
    { detail: "Invalid conversation id." },
    { status: 400 },
  );
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const safeId = safePathId(id);
  if (!safeId) return invalidId();
  const response = await fetch(`${BACKEND_URL}/chat/sessions/${safeId}`, {
    headers: backendHeaders(request),
  });
  const data = await response.json().catch(() => ({}));
  return NextResponse.json(data, { status: response.status });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const safeId = safePathId(id);
  if (!safeId) return invalidId();
  const body = await request.json().catch(() => ({}));
  // Only forward the title field; ignore any other client-supplied fields.
  const title =
    typeof body?.title === "string" ? String(body.title).slice(0, 120) : "";
  const response = await fetch(`${BACKEND_URL}/chat/sessions/${safeId}`, {
    method: "PATCH",
    headers: backendHeaders(request, { "Content-Type": "application/json" }),
    body: JSON.stringify({ title }),
  });
  const data = await response.json().catch(() => ({}));
  return NextResponse.json(data, { status: response.status });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const safeId = safePathId(id);
  if (!safeId) return invalidId();
  const response = await fetch(`${BACKEND_URL}/chat/sessions/${safeId}`, {
    method: "DELETE",
    headers: backendHeaders(request),
  });
  const data = await response.json().catch(() => ({}));
  return NextResponse.json(data, { status: response.status });
}
