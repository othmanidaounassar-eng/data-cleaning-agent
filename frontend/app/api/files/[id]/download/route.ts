// frontend/app/api/files/[id]/download/route.ts
import { NextRequest, NextResponse } from "next/server";
import { BACKEND_URL, backendHeaders, safePathId } from "@/lib/backend";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const safeId = safePathId(id);
  if (!safeId) {
    return NextResponse.json({ detail: "Invalid file id." }, { status: 400 });
  }
  const response = await fetch(`${BACKEND_URL}/files/${safeId}/download`, {
    headers: backendHeaders(request),
  });
  const disposition = response.headers.get("content-disposition") || "";
  const body = await response.arrayBuffer();
  return new NextResponse(body, {
    status: response.status,
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition":
        disposition || 'attachment; filename="cleaned.csv"',
    },
  });
}
