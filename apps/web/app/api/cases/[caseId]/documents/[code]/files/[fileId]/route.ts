import { NextResponse } from "next/server";
import { documentCodes, identifierSchema } from "@openchip/shared";
import { getSessionUser } from "@/lib/auth";
import { readStoredSupplierDocument } from "@/lib/document-storage";
import { onboardingRepository } from "@/lib/repository";

function isDocumentCode(value: string): value is (typeof documentCodes)[number] {
  return (documentCodes as readonly string[]).includes(value);
}

function toAsciiFilename(value: string): string {
  return value.replace(/[^\x20-\x7E]+/g, "_").replace(/["\\]/g, "_");
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ caseId: string; code: string; fileId: string }> }
): Promise<NextResponse> {
  const user = await getSessionUser();
  if (user === null) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { caseId, code, fileId } = await context.params;
  const parsedCaseId = identifierSchema.safeParse(caseId);
  if (!parsedCaseId.success || !isDocumentCode(code)) {
    return NextResponse.json({ message: "Invalid request" }, { status: 400 });
  }

  const onboardingCase = await onboardingRepository.getCase(parsedCaseId.data);
  if (onboardingCase === null) {
    return NextResponse.json({ message: "Case not found" }, { status: 404 });
  }

  const requirement = onboardingCase.documents.find((document) => document.code === code);
  if (requirement === undefined) {
    return NextResponse.json({ message: "Requirement not found" }, { status: 404 });
  }

  const file = requirement.files.find((entry) => entry.id === fileId);
  if (file === undefined) {
    return NextResponse.json({ message: "File not found" }, { status: 404 });
  }

  let bytes: Buffer;
  try {
    bytes = await readStoredSupplierDocument(file.storagePath);
  } catch {
    return NextResponse.json({ message: "File not found in storage" }, { status: 404 });
  }
  const safeFileName = toAsciiFilename(file.fileName);

  return new NextResponse(new Uint8Array(bytes), {
    status: 200,
    headers: {
      "Content-Type": file.mimeType,
      "Content-Length": String(bytes.byteLength),
      "Content-Disposition": `attachment; filename="${safeFileName}"`
    }
  });
}
