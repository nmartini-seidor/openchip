import { NextResponse } from "next/server";
import { createMockSapAdapter } from "@openchip/integrations";

export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as { supplierVat: string; reason: string };
  const sapAdapter = createMockSapAdapter();
  const result = await sapAdapter.unblockSupplier(body);
  return NextResponse.json(result);
}
