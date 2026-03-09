import { NextResponse } from "next/server";
import { invitationTokenSchema } from "@openchip/shared";
import { onboardingRepository } from "@/lib/repository";
import { ensurePlaywrightTestMode } from "@/lib/test-mode";

export async function GET(
  _request: Request,
  context: { params: Promise<{ token: string }> }
): Promise<NextResponse> {
  const blocked = ensurePlaywrightTestMode();
  if (blocked !== null) {
    return blocked;
  }

  const { token } = await context.params;
  const parsedToken = invitationTokenSchema.safeParse(token);
  if (!parsedToken.success) {
    return NextResponse.json({ message: "Invalid token" }, { status: 400 });
  }

  const onboardingCase = await onboardingRepository.getCaseByInvitationToken(parsedToken.data);
  if (onboardingCase === null) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    code: onboardingCase.supplierOtpState.code,
    expiresAt: onboardingCase.supplierOtpState.expiresAt
  });
}
