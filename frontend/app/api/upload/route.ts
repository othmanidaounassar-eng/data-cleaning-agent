import { NextRequest, NextResponse } from "next/server";

/**
 * Stub endpoint reserved for a future server-side upload pipeline
 * (e.g. streaming large files to object storage before cleaning).
 * The current UI performs validation and cleaning entirely client-side.
 */
export async function POST(req: NextRequest) {
  return NextResponse.json(
    {
      status: "not_implemented",
      message: "Server-side upload is not enabled yet. Files are processed in the browser.",
    },
    { status: 501 }
  );
}
