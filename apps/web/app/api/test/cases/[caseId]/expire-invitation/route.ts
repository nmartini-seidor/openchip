import { NextResponse } from "next/server";
import { identifierSchema } from "@openchip/shared";
import { onboardingRepository } from "@/lib/repository";
import { ensurePlaywrightTestMode } from "@/lib/test-mode";

export async function POST(_: Request, context: { params: Promise<{ caseId: string }> }): Promise<NextResponse> {
  const blocked = ensurePlaywrightTestMode();
  if (blocked !== null) {
    return blocked;
  }

  const { caseId } = await context.params;
  const parsedCaseId = identifierSchema.parse(caseId);
  const updatedCase = await onboardingRepository.forceExpireInvitation(parsedCaseId);
  return NextResponse.json(updatedCase);
}
