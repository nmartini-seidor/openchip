import { NextResponse } from "next/server";
import { getEmailAdapter } from "@/lib/email";
import { onboardingRepository } from "@/lib/repository";
import { ensurePlaywrightTestMode } from "@/lib/test-mode";

async function clearMailpitMailbox(baseUrl: string): Promise<void> {
  try {
    await fetch(`${baseUrl.replace(/\/$/, "")}/api/v1/messages`, {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ IDs: [] }),
      cache: "no-store"
    });
  } catch {
    // Best-effort cleanup only.
  }
}

export async function POST(): Promise<NextResponse> {
  const blocked = ensurePlaywrightTestMode();
  if (blocked !== null) {
    return blocked;
  }

  await onboardingRepository.resetStore();
  const emailAdapter = getEmailAdapter();
  await emailAdapter.clearSentEmails();

  const mailpitApiBaseUrl = process.env.MAILPIT_API_BASE_URL;
  if (mailpitApiBaseUrl !== undefined && mailpitApiBaseUrl.length > 0) {
    await clearMailpitMailbox(mailpitApiBaseUrl);
  }

  return NextResponse.json({ ok: true });
}
