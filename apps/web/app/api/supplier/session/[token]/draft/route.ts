import { NextResponse } from "next/server";
import { invitationTokenSchema, supplierDraftSaveSchema } from "@openchip/shared";
import { onboardingRepository } from "@/lib/repository";
import { hasSupplierPortalSession } from "@/lib/supplier-session";

function omitUndefined<T extends Record<string, string | undefined>>(value: T): { [K in keyof T]?: string } {
  const result: Partial<Record<keyof T, string>> = {};
  for (const [key, entry] of Object.entries(value) as [keyof T, string | undefined][]) {
    if (entry !== undefined) {
      result[key] = entry;
    }
  }
  return result as { [K in keyof T]?: string };
}

export async function POST(request: Request, context: { params: Promise<{ token: string }> }): Promise<NextResponse> {
  const { token } = await context.params;
  const parsedToken = invitationTokenSchema.safeParse(token);
  if (!parsedToken.success) {
    return NextResponse.json({ message: "Invalid token" }, { status: 400 });
  }

  const session = await onboardingRepository.getSupplierSession(parsedToken.data);
  if (session === null) {
    return NextResponse.json({ message: "Invalid or expired session" }, { status: 404 });
  }

  const onboardingCase = await onboardingRepository.getCase(session.caseId);
  if (onboardingCase === null) {
    return NextResponse.json({ message: "Case not found" }, { status: 404 });
  }

  const canEdit =
    onboardingCase.status === "invitation_sent" ||
    onboardingCase.status === "portal_accessed" ||
    onboardingCase.status === "response_in_progress";
  if (!canEdit) {
    return NextResponse.json({ message: "Supplier response is closed" }, { status: 409 });
  }

  const hasSession = await hasSupplierPortalSession(parsedToken.data, session.caseId);
  if (!hasSession || !session.otpVerified) {
    return NextResponse.json({ message: "OTP verification required" }, { status: 401 });
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ message: "Invalid JSON payload" }, { status: 400 });
  }

  const parsedInput = supplierDraftSaveSchema.safeParse({
    token: parsedToken.data,
    ...(typeof rawBody === "object" && rawBody !== null ? rawBody : {})
  });
  if (!parsedInput.success) {
    return NextResponse.json({ message: "Invalid draft payload", issues: parsedInput.error.flatten() }, { status: 422 });
  }

  let updatedCase;
  try {
    updatedCase = await onboardingRepository.saveSupplierDraft(
      {
        token: parsedInput.data.token,
        supplierIdentity: omitUndefined(parsedInput.data.supplierIdentity),
        address: omitUndefined(parsedInput.data.address),
        bankAccount: omitUndefined(parsedInput.data.bankAccount)
      },
      "supplier.portal"
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to save draft";
    if (message.toLowerCase().includes("response is open")) {
      return NextResponse.json({ message: "Supplier response is closed" }, { status: 409 });
    }
    return NextResponse.json({ message }, { status: 400 });
  }
  return NextResponse.json({
    caseId: updatedCase.id,
    draftUpdatedAt: updatedCase.supplierDraft?.updatedAt ?? updatedCase.updatedAt
  });
}
