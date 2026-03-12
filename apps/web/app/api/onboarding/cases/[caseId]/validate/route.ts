import { NextResponse } from "next/server";
import { validateDocumentSchema } from "@openchip/shared";
import { getAppBaseUrl } from "@/lib/app-base-url";
import { getEmailAdapter } from "@/lib/email";
import { onboardingRepository } from "@/lib/repository";

export async function POST(request: Request, context: { params: Promise<{ caseId: string }> }): Promise<NextResponse> {
  const body = (await request.json()) as unknown;
  const { caseId } = await context.params;
  const payload = validateDocumentSchema.parse({ ...(body as Record<string, unknown>), caseId });

  const onboardingCase = await onboardingRepository.validateDocument(payload);
  if (payload.decision === "reject") {
    await onboardingRepository.recordCaseAction(
      payload.caseId,
      payload.approver,
      "supplier_rework_requested",
      `Supplier correction requested for document ${payload.code}`
    );

    if (onboardingCase.invitationToken !== null) {
      const appBaseUrl = getAppBaseUrl();
      try {
        const emailAdapter = getEmailAdapter();
        await emailAdapter.sendDocumentRejectedEmail({
          to: onboardingCase.supplierContactEmail,
          supplierName: onboardingCase.supplierName,
          invitationLink: new URL(`/supplier/${onboardingCase.invitationToken}`, appBaseUrl).toString(),
          documentCodes: [payload.code]
        });
      } catch {
        // Keep API response successful even if notification email delivery fails.
      }
    }
  }
  return NextResponse.json(onboardingCase);
}
