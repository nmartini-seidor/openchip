import { NextResponse } from "next/server";
import { createMockSapAdapter } from "@openchip/integrations";

export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as {
    caseId: string;
    supplierVat: string;
    supplierName: string;
  };

  const sapAdapter = createMockSapAdapter();
  const result = await sapAdapter.createSupplier(body);
  return NextResponse.json(result);
}
