import { NextResponse } from "next/server";

export function ensurePlaywrightTestMode(): NextResponse | null {
  if (process.env.PLAYWRIGHT_TEST !== "1") {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  return null;
}
