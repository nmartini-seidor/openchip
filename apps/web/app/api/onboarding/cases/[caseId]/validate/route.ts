import { NextResponse } from "next/server";
import { validateDocumentSchema } from "@openchip/shared";
import { onboardingRepository } from "@/lib/repository";

export async function POST(request: Request, context: { params: Promise<{ caseId: string }> }): Promise<NextResponse> {
  const body = (await request.json()) as unknown;
  const { caseId } = await context.params;
  const payload = validateDocumentSchema.parse({ ...(body as Record<string, unknown>), caseId });

  const onboardingCase = await onboardingRepository.validateDocument(payload);
  return NextResponse.json(onboardingCase);
}
