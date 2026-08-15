import { NextResponse } from "next/server";

/**
 * Reserved for syncing cleaning history to a database / user account.
 * Today, history lives in the browser's localStorage.
 */
export async function GET() {
  return NextResponse.json(
    { status: "not_implemented", history: [] },
    { status: 501 },
  );
}
