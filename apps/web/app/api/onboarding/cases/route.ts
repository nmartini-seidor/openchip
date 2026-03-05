import { NextResponse } from "next/server";
import { createCaseInputSchema } from "@openchip/shared";
import { onboardingRepository } from "@/lib/repository";

export async function POST(request: Request): Promise<NextResponse> {
  const payload = createCaseInputSchema.parse((await request.json()) as unknown);
  const onboardingCase = await onboardingRepository.createCase(payload, "api.client");
  return NextResponse.json(onboardingCase, { status: 201 });
}
