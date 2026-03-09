import { NextResponse } from "next/server";
import { documentCodeSchema, invitationTokenSchema } from "@openchip/shared";
import { readStoredSupplierDocument } from "@/lib/document-storage";
import { onboardingRepository } from "@/lib/repository";
import { hasSupplierPortalSession } from "@/lib/supplier-session";

function toAsciiFilename(value: string): string {
  return value.replace(/[^\x20-\x7E]+/g, "_").replace(/["\\]/g, "_");
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ token: string; code: string; fileId: string }> }
): Promise<NextResponse> {
  const { token, code, fileId } = await context.params;
  const parsedToken = invitationTokenSchema.safeParse(token);
  const parsedCode = documentCodeSchema.safeParse(code);
  if (!parsedToken.success || !parsedCode.success) {
    return NextResponse.json({ message: "Invalid request" }, { status: 400 });
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

  const fromSubmitted = onboardingCase.documents
    .find((document) => document.code === parsedCode.data)
    ?.files.find((file) => file.id === fileId);
  const fromDraft = onboardingCase.supplierDraft?.uploadedDocuments
    .find((document) => document.code === parsedCode.data)
    ?.files.find((file) => file.id === fileId);

  const file = fromSubmitted ?? fromDraft;
  if (file === undefined) {
    return NextResponse.json({ message: "File not found" }, { status: 404 });
  }

  let bytes: Buffer;
  try {
    bytes = await readStoredSupplierDocument(file.storagePath);
  } catch {
    return NextResponse.json({ message: "File not found in storage" }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(bytes), {
    status: 200,
    headers: {
      "Content-Type": file.mimeType,
      "Content-Length": String(bytes.byteLength),
      "Content-Disposition": `attachment; filename="${toAsciiFilename(file.fileName)}"`
    }
  });
}
