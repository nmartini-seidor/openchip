import { NextResponse } from "next/server";
import { identifierSchema } from "@openchip/shared";
import { getAppBaseUrl } from "@/lib/app-base-url";
import { getEmailAdapter } from "@/lib/email";
import { onboardingRepository } from "@/lib/repository";

export async function POST(_: Request, context: { params: Promise<{ caseId: string }> }): Promise<NextResponse> {
  const { caseId } = await context.params;
  const parsedCaseId = identifierSchema.parse(caseId);
  const onboardingCase = await onboardingRepository.sendInvitation(parsedCaseId, "api.client");

  if (onboardingCase.invitationToken !== null && onboardingCase.invitationExpiresAt !== null) {
    const invitationLink = new URL(
      `/supplier/${onboardingCase.invitationToken}`,
      getAppBaseUrl()
    ).toString();

    const emailAdapter = getEmailAdapter();
    await emailAdapter.sendInvitationEmail({
      to: onboardingCase.supplierContactEmail,
      supplierName: onboardingCase.supplierName,
      invitationLink,
      expiresAt: onboardingCase.invitationExpiresAt
    });
  }

  return NextResponse.json(onboardingCase);
}
