import { NextResponse } from "next/server";
import { documentCodeSchema, identifierSchema } from "@openchip/shared";
import { onboardingRepository } from "@/lib/repository";
import { ensurePlaywrightTestMode } from "@/lib/test-mode";

interface SetDocumentExpiryRequest {
  code: string;
  validTo: string | null;
}

export async function POST(request: Request, context: { params: Promise<{ caseId: string }> }): Promise<NextResponse> {
  const blocked = ensurePlaywrightTestMode();
  if (blocked !== null) {
    return blocked;
  }

  const { caseId } = await context.params;
  const parsedCaseId = identifierSchema.parse(caseId);
  const payload = (await request.json()) as SetDocumentExpiryRequest;

  const parsedCode = documentCodeSchema.safeParse(payload.code);
  if (!parsedCode.success) {
    return NextResponse.json({ message: "Invalid document code" }, { status: 400 });
  }

  if (payload.validTo !== null && Number.isNaN(new Date(payload.validTo).getTime())) {
    return NextResponse.json({ message: "Invalid validTo value" }, { status: 400 });
  }

  const updatedCase = await onboardingRepository.setDocumentExpiry(parsedCaseId, parsedCode.data, payload.validTo);
  return NextResponse.json(updatedCase);
}
