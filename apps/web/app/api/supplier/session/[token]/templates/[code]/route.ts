import { NextResponse } from "next/server";
import { documentCodeSchema, invitationTokenSchema } from "@openchip/shared";
import { readStoredSupplierDocument } from "@/lib/document-storage";
import { onboardingRepository } from "@/lib/repository";
import { hasSupplierPortalSession } from "@/lib/supplier-session";

function fileNameFromStoragePath(storagePath: string, fallback: string): string {
  const segments = storagePath.split("/");
  const last = segments[segments.length - 1];
  return typeof last === "string" && last.length > 0 ? last : fallback;
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ token: string; code: string }> }
): Promise<NextResponse> {
  const { token, code } = await context.params;
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

  const definition = await onboardingRepository.getDocumentDefinition(parsedCode.data);
  if (definition === null || definition.templateStoragePath === null) {
    return NextResponse.json({ message: "Template not found" }, { status: 404 });
  }

  let bytes: Buffer;
  try {
    bytes = await readStoredSupplierDocument(definition.templateStoragePath);
  } catch {
    return NextResponse.json({ message: "Template not found in storage" }, { status: 404 });
  }

  const fileName = fileNameFromStoragePath(definition.templateStoragePath, `${definition.code}.template`);
  return new NextResponse(new Uint8Array(bytes), {
    status: 200,
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Length": String(bytes.byteLength),
      "Content-Disposition": `attachment; filename="${fileName}"`
    }
  });
}
