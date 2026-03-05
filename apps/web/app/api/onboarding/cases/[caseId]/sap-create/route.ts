import { NextResponse } from "next/server";
import { createMockSapAdapter } from "@openchip/integrations";
import { identifierSchema } from "@openchip/shared";
import { onboardingRepository } from "@/lib/repository";

export async function POST(_: Request, context: { params: Promise<{ caseId: string }> }): Promise<NextResponse> {
  const { caseId } = await context.params;
  const parsedCaseId = identifierSchema.parse(caseId);
  const onboardingCase = await onboardingRepository.getCase(parsedCaseId);

  if (onboardingCase === null) {
    return NextResponse.json({ message: "Case not found" }, { status: 404 });
  }

  const sapAdapter = createMockSapAdapter();
  const sapResult = await sapAdapter.createSupplier({
    caseId: onboardingCase.id,
    supplierVat: onboardingCase.supplierVat,
    supplierName: onboardingCase.supplierName
  });

  const updatedCase = await onboardingRepository.createSupplierInSap(parsedCaseId, "api.client");
  return NextResponse.json({ sapResult, onboardingCase: updatedCase });
}
