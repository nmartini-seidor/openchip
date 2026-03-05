import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { invitationTokenSchema } from "@openchip/shared";
import { onboardingRepository } from "@/lib/repository";

export async function POST(request: Request, context: { params: Promise<{ token: string }> }): Promise<NextResponse> {
  const { token } = await context.params;
  const parsedToken = invitationTokenSchema.parse(token);
  const session = await onboardingRepository.getSupplierSession(parsedToken);

  if (session === null) {
    return NextResponse.json({ message: "Invalid or expired session" }, { status: 404 });
  }

  const body = (await request.json()) as unknown;
  const metadata = typeof body === "object" && body !== null ? body : {};

  return NextResponse.json({
    uploadUrl: `/mock-storage/${parsedToken}/${randomUUID()}`,
    method: "PUT",
    metadata
  });
}
