// frontend/app/api/files/route.ts
import { NextRequest, NextResponse } from "next/server";
import { BACKEND_URL, backendHeaders } from "@/lib/backend";

export async function GET(request: NextRequest) {
  const response = await fetch(`${BACKEND_URL}/files`, {
    headers: backendHeaders(request),
  });
  const data = await response.json().catch(() => ({}));
  return NextResponse.json(data, { status: response.status });
}
