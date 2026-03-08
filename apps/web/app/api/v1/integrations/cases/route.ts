import { NextResponse } from "next/server";
import {
  sapPurchaseRequestNewSupplierSchema,
  type OnboardingCase,
  type SapPurchaseRequestNewSupplierInput
} from "@openchip/shared";
import { onboardingRepository } from "@/lib/repository";

const sapApiKeyHeader = "x-api-key";

function normalizeText(value: string): string {
  return value.trim().toLowerCase();
}

function hasReplayConflict(
  existingCase: OnboardingCase,
  payload: SapPurchaseRequestNewSupplierInput
): boolean {
  return (
    existingCase.supplierName !== payload.supplierName ||
    normalizeText(existingCase.supplierVat) !== normalizeText(payload.supplierVat) ||
    existingCase.supplierContactName !== payload.supplierContactName ||
    normalizeText(existingCase.supplierContactEmail) !== normalizeText(payload.supplierContactEmail) ||
    existingCase.categoryCode !== payload.categoryCode ||
    existingCase.requester !== payload.requesterDisplayName ||
    existingCase.requestedBySapUser !== payload.requesterSapUserId ||
    existingCase.sourceRequestedAt !== payload.requestedAt
  );
}

export async function POST(request: Request): Promise<NextResponse> {
  const configuredApiKey = process.env.SAP_INTEGRATION_API_KEY;
  if (configuredApiKey === undefined || configuredApiKey.length === 0) {
    return NextResponse.json({ message: "SAP integration API key is not configured." }, { status: 503 });
  }

  const receivedApiKey = request.headers.get(sapApiKeyHeader);
  if (receivedApiKey !== configuredApiKey) {
    return NextResponse.json({ message: "Unauthorized SAP integration request." }, { status: 401 });
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ message: "Invalid JSON body." }, { status: 400 });
  }

  const parsedPayload = sapPurchaseRequestNewSupplierSchema.safeParse(rawBody);
  if (!parsedPayload.success) {
    return NextResponse.json(
      {
        message: "Invalid SAP purchase request payload.",
        issues: parsedPayload.error.flatten()
      },
      { status: 422 }
    );
  }

  const payload = parsedPayload.data;

  const existingCase = await onboardingRepository.getCaseBySourceReference("sap_pr", payload.sapSystem, payload.sapPrId);
  if (existingCase !== null) {
    if (hasReplayConflict(existingCase, payload)) {
      return NextResponse.json(
        {
          message: "SAP purchase request reference already exists with conflicting case data.",
          caseId: existingCase.id,
          sourceRef: `${payload.sapSystem}:${payload.sapPrId}`
        },
        { status: 409 }
      );
    }

    return NextResponse.json(
      {
        caseId: existingCase.id,
        status: existingCase.status,
        sourceRef: `${payload.sapSystem}:${payload.sapPrId}`,
        idempotent: true
      },
      { status: 200 }
    );
  }

  try {
    const onboardingCase = await onboardingRepository.createCase(
      {
        supplierName: payload.supplierName,
        supplierVat: payload.supplierVat,
        supplierContactName: payload.supplierContactName,
        supplierContactEmail: payload.supplierContactEmail,
        requester: payload.requesterDisplayName,
        categoryCode: payload.categoryCode
      },
      `sap.integration:${payload.sapSystem}`,
      {
        sourceChannel: "sap_pr",
        sourceSystem: payload.sapSystem,
        sourceReference: payload.sapPrId,
        requestedBySapUser: payload.requesterSapUserId,
        sourceRequestedAt: payload.requestedAt,
        integrationPayload: {
          requesterDisplayName: payload.requesterDisplayName,
          requesterSapUserId: payload.requesterSapUserId,
          requestedAt: payload.requestedAt,
          costCenter: payload.costCenter ?? "",
          companyCode: payload.companyCode ?? "",
          purchasingOrg: payload.purchasingOrg ?? "",
          notes: payload.notes ?? ""
        }
      }
    );

    return NextResponse.json(
      {
        caseId: onboardingCase.id,
        status: onboardingCase.status,
        sourceRef: `${payload.sapSystem}:${payload.sapPrId}`,
        idempotent: false
      },
      { status: 201 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create onboarding case from SAP request.";
    const status = message.includes("already exists") ? 409 : 400;
    return NextResponse.json({ message }, { status });
  }
}
