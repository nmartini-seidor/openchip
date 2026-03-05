import { NextResponse } from "next/server";
import { createMockDocuwareAdapter } from "@openchip/integrations";

export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as {
    supplierName: string;
    supplierVat: string;
    documentCode: string;
    validationStatus: string;
    validationDate: string;
    expiryDate: string | null;
  };

  const docuwareAdapter = createMockDocuwareAdapter();
  const result = await docuwareAdapter.archiveDocument(body);
  return NextResponse.json(result);
}
