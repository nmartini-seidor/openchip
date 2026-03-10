import { NextResponse } from "next/server";
import { documentCodeSchema, invitationTokenSchema } from "@openchip/shared";
import { saveSupplierDocument } from "@/lib/document-storage";
import { onboardingRepository } from "@/lib/repository";
import { hasSupplierPortalSession } from "@/lib/supplier-session";

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

  const hasSession = await hasSupplierPortalSession(parsedToken.data, session.caseId);
  if (!hasSession || !session.otpVerified) {
    return NextResponse.json({ message: "OTP verification required" }, { status: 401 });
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

  const formData = await request.formData();
  const parsedCode = documentCodeSchema.safeParse(formData.get("code"));
  if (!parsedCode.success) {
    return NextResponse.json({ message: "Invalid document code" }, { status: 422 });
  }

  const files = formData.getAll("files").filter((value): value is File => value instanceof File && value.size > 0);
  if (files.length === 0) {
    return NextResponse.json({ message: "At least one file is required" }, { status: 422 });
  }

  const savedFiles = await Promise.all(
    files.map((file) =>
      saveSupplierDocument({
        caseId: onboardingCase.id,
        code: parsedCode.data,
        uploadedBy: "supplier.portal",
        file
      })
    )
  );

  try {
    await onboardingRepository.upsertSupplierDraftDocuments(
      parsedToken.data,
      [
        {
          code: parsedCode.data,
          files: savedFiles
        }
      ],
      "supplier.portal"
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to upload files";
    if (message.toLowerCase().includes("response is open")) {
      return NextResponse.json({ message: "Supplier response is closed" }, { status: 409 });
    }
    return NextResponse.json({ message }, { status: 400 });
  }

  return NextResponse.json({
    code: parsedCode.data,
    files: savedFiles
  });
}
