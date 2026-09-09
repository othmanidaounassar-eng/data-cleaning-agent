// frontend/app/api/files/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { BACKEND_URL, backendHeaders, safePathId } from "@/lib/backend";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const safeId = safePathId(id);
  if (!safeId) {
    return NextResponse.json({ detail: "Invalid file id." }, { status: 400 });
  }
  const response = await fetch(`${BACKEND_URL}/files/${safeId}`, {
    headers: backendHeaders(request),
  });
  const data = await response.json().catch(() => ({}));
  return NextResponse.json(data, { status: response.status });
}

export async function DELETE(request: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const safeId = safePathId(id);
  if (!safeId) {
    return NextResponse.json({ detail: "Invalid file id." }, { status: 400 });
  }
  const response = await fetch(`${BACKEND_URL}/files/${safeId}`, {
    method: "DELETE",
    headers: backendHeaders(request),
  });
  const data = await response.json().catch(() => ({}));
  return NextResponse.json(data, { status: response.status });
}
