import { NextResponse } from "next/server";

function appBaseUrl(): string {
  return process.env.APP_BASE_URL ?? "http://localhost:3000";
}

const sapNewSupplierRequestSchema = {
  type: "object",
  required: [
    "sapPrId",
    "sapSystem",
    "requesterSapUserId",
    "requesterDisplayName",
    "supplierName",
    "supplierVat",
    "supplierContactName",
    "supplierContactEmail",
    "categoryCode",
    "requestedAt"
  ],
  properties: {
    sapPrId: { type: "string", maxLength: 80, description: "Unique Purchase Request identifier in SAP." },
    sapSystem: { type: "string", maxLength: 80, description: "SAP source system identifier." },
    requesterSapUserId: { type: "string", maxLength: 120 },
    requesterDisplayName: { type: "string", maxLength: 120 },
    supplierName: { type: "string", maxLength: 120 },
    supplierVat: { type: "string", maxLength: 64 },
    supplierContactName: { type: "string", maxLength: 120 },
    supplierContactEmail: { type: "string", format: "email", maxLength: 160 },
    categoryCode: { type: "string", example: "SUB-STD-NAT" },
    requestedAt: { type: "string", format: "date-time" },
    costCenter: { type: "string", maxLength: 80 },
    companyCode: { type: "string", maxLength: 80 },
    purchasingOrg: { type: "string", maxLength: 80 },
    notes: { type: "string", maxLength: 500 }
  }
} as const;

const sapIntakeResponseSchema = {
  type: "object",
  required: ["caseId", "status", "sourceRef", "idempotent"],
  properties: {
    caseId: { type: "string", format: "uuid" },
    status: { type: "string", example: "onboarding_initiated" },
    sourceRef: { type: "string", example: "S4HANA-PRD:4500012345" },
    idempotent: { type: "boolean" }
  }
} as const;

const errorResponseSchema = {
  type: "object",
  required: ["message"],
  properties: {
    message: { type: "string" }
  }
} as const;

export async function GET(): Promise<NextResponse> {
  const spec = {
    openapi: "3.1.0",
    info: {
      title: "Openchip Supplier Onboarding API",
      version: "1.0.0",
      description: "Public integration contract for SAP-triggered supplier onboarding."
    },
    servers: [{ url: appBaseUrl() }],
    tags: [{ name: "SAP Integrations", description: "Inbound integrations from SAP." }],
    components: {
      securitySchemes: {
        ApiKeyAuth: {
          type: "apiKey",
          in: "header",
          name: "X-API-Key"
        }
      },
      schemas: {
        SapNewSupplierRequest: sapNewSupplierRequestSchema,
        SapIntakeResponse: sapIntakeResponseSchema,
        ErrorResponse: errorResponseSchema
      }
    },
    paths: {
      "/api/v1/integrations/cases": {
        post: {
          tags: ["SAP Integrations"],
          summary: "Create onboarding case from SAP Purchase Request",
          description:
            "Called by SAP when a Purchase Request uses supplier='New Supplier'. Creates (or reuses) an onboarding case for Finance/Purchasing.",
          security: [{ ApiKeyAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/SapNewSupplierRequest" },
                examples: {
                  sapPrEvent: {
                    value: {
                      sapPrId: "4500012345",
                      sapSystem: "S4HANA-PRD",
                      requesterSapUserId: "U123456",
                      requesterDisplayName: "Ana Gómez",
                      supplierName: "Proveedor Demo SL",
                      supplierVat: "ESA12345678",
                      supplierContactName: "Laura Pérez",
                      supplierContactEmail: "laura.perez@proveedordemo.es",
                      categoryCode: "SUB-STD-NAT",
                      requestedAt: "2026-03-06T10:30:00Z",
                      costCenter: "CC-1000",
                      companyCode: "OC01",
                      purchasingOrg: "PO-EU",
                      notes: "Created from SAP PR with New Supplier."
                    }
                  }
                }
              }
            }
          },
          responses: {
            "201": {
              description: "Onboarding case created from SAP PR.",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/SapIntakeResponse" }
                }
              }
            },
            "200": {
              description: "Idempotent replay; existing case returned.",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/SapIntakeResponse" }
                }
              }
            },
            "401": {
              description: "Missing or invalid API key.",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ErrorResponse" }
                }
              }
            },
            "422": {
              description: "Invalid payload.",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ErrorResponse" }
                }
              }
            },
            "409": {
              description: "Conflicting replay for same SAP PR reference.",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ErrorResponse" }
                }
              }
            }
          }
        }
      }
    }
  } as const;

  return NextResponse.json(spec, { status: 200 });
}
