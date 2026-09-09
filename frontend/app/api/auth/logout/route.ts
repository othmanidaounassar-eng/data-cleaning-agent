// frontend/app/api/auth/logout/route.ts
import { NextRequest, NextResponse } from "next/server";
import { BACKEND_URL } from "@/lib/backend";

export async function POST(request: NextRequest) {
  const token =
    request.headers.get("authorization")?.replace("Bearer ", "") ?? "";
  const response = await fetch(`${BACKEND_URL}/auth/logout`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await response.json().catch(() => ({}));
  return NextResponse.json(data, { status: response.status });
}
