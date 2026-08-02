import { NextResponse } from "next/server";

/**
 * Reserved for centralized report storage / sharing (e.g. a shareable link
 * to a cleaning report). Currently reports are generated and stored client-side.
 */
export async function GET() {
  return NextResponse.json({ status: "not_implemented", reports: [] }, { status: 501 });
}
