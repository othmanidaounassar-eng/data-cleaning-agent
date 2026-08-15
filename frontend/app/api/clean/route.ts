import { NextRequest, NextResponse } from "next/server";

/**
 * Reserved for a future server-side / AI-agent cleaning pipeline.
 * Would accept a dataset reference (e.g. an object storage key) and
 * return a CleaningReport once an LLM-backed agent finishes processing.
 */
export async function POST(req: NextRequest) {
  return NextResponse.json(
    {
      status: "not_implemented",
      message: "Server-side AI cleaning is not enabled yet.",
    },
    { status: 501 },
  );
}
