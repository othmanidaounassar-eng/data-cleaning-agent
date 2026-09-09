// frontend/app/api/download/route.ts
import { NextRequest, NextResponse } from "next/server";
import { BACKEND_URL, backendHeaders } from "@/lib/backend";

const DOWNLOAD_ID_RE = /^[0-9a-fA-F]{8}$/;

// Streams large cleaned CSVs from the backend through Vercel, avoiding the
// ~4.5 MB buffered-response cap (streaming responses are exempt on Vercel).
export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id") || "";
  if (!DOWNLOAD_ID_RE.test(id)) {
    return NextResponse.json(
      { error: "Invalid download id." },
      { status: 400 },
    );
  }

  try {
    const backendResponse = await fetch(`${BACKEND_URL}/download/${id}`, {
      headers: backendHeaders(request),
      signal: AbortSignal.timeout(180000),
    });

    if (!backendResponse.ok || !backendResponse.body) {
      return NextResponse.json(
        { error: "Download expired or not found." },
        { status: backendResponse.status },
      );
    }

    return new Response(backendResponse.body, {
      headers: {
        "Content-Type":
          backendResponse.headers.get("content-type") || "text/csv",
        "Content-Disposition":
          backendResponse.headers.get("content-disposition") ||
          "attachment; filename=cleaned.csv",
      },
    });
  } catch (error) {
    console.error("❌ Download proxy error:", error);
    return NextResponse.json(
      { error: "Download failed. Please try again." },
      { status: 502 },
    );
  }
}
