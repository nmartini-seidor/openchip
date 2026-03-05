import { NextResponse } from "next/server";
import { invitationTokenSchema } from "@openchip/shared";
import { onboardingRepository } from "@/lib/repository";

export async function GET(_: Request, context: { params: Promise<{ token: string }> }): Promise<NextResponse> {
  const { token } = await context.params;
  const parsedToken = invitationTokenSchema.parse(token);
  const session = await onboardingRepository.getSupplierSession(parsedToken);

  if (session === null) {
    return NextResponse.json({ message: "Invalid or expired session" }, { status: 404 });
  }

  return NextResponse.json(session);
}
