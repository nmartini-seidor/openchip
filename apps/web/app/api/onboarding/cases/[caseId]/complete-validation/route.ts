import { NextResponse } from "next/server";
import { identifierSchema } from "@openchip/shared";
import { onboardingRepository } from "@/lib/repository";

export async function POST(_: Request, context: { params: Promise<{ caseId: string }> }): Promise<NextResponse> {
  const { caseId } = await context.params;
  const parsedCaseId = identifierSchema.parse(caseId);
  const onboardingCase = await onboardingRepository.completeValidation(parsedCaseId, "api.client");
  return NextResponse.json(onboardingCase);
}
