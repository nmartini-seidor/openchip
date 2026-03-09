import { NextResponse } from "next/server";
import { documentCodeSchema } from "@openchip/shared";
import { getSessionUser } from "@/lib/auth";
import { readStoredSupplierDocument } from "@/lib/document-storage";
import { onboardingRepository } from "@/lib/repository";

function fileNameFromStoragePath(storagePath: string, fallback: string): string {
  const segments = storagePath.split("/");
  const last = segments[segments.length - 1];
  return typeof last === "string" && last.length > 0 ? last : fallback;
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ code: string }> }
): Promise<NextResponse> {
  const user = await getSessionUser();
  if (user === null) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { code } = await context.params;
  const parsedCode = documentCodeSchema.safeParse(code);
  if (!parsedCode.success) {
    return NextResponse.json({ message: "Invalid document code" }, { status: 400 });
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
