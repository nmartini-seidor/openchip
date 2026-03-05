import { NextResponse } from "next/server";
import { getEmailAdapter } from "@/lib/email";
import { ensurePlaywrightTestMode } from "@/lib/test-mode";

export async function GET(): Promise<NextResponse> {
  const blocked = ensurePlaywrightTestMode();
  if (blocked !== null) {
    return blocked;
  }

  const emailAdapter = getEmailAdapter();
  const emails = await emailAdapter.listSentEmails();
  return NextResponse.json({ emails });
}
