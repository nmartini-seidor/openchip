import { expect, test } from "@playwright/test";
import { captureCheckpoint, loginAsFinance, resetTestState } from "./utils/scenario";

function sapPayload() {
  const unique = Date.now().toString();
  return {
    sapPrId: `4500${unique.slice(-6)}`,
    sapSystem: "S4HANA-PRD",
    requesterSapUserId: "U123456",
    requesterDisplayName: "Ana Gomez",
    supplierName: `Proveedor SAP ${unique}`,
    supplierVat: `ESA${unique.slice(-8)}`,
    supplierContactName: "Laura Perez",
    supplierContactEmail: `laura.${unique}@proveedor.es`,
    categoryCode: "SUB-STD-NAT",
    requestedAt: "2026-03-06T10:30:00Z",
    costCenter: "CC-1000",
    companyCode: "OC01",
    purchasingOrg: "PO-EU",
    notes: "Created from SAP PR with New Supplier."
  };
}

test("sap pr integration creates idempotent onboarding cases and is visible in queue", async ({ page, request }, testInfo) => {
  await resetTestState(request);
  const payload = sapPayload();

  const unauthorizedResponse = await request.post("/api/v1/integrations/cases", {
    data: payload
  });
  expect(unauthorizedResponse.status()).toBe(401);

  const createResponse = await request.post("/api/v1/integrations/cases", {
    headers: {
      "X-API-Key": "test-sap-key"
    },
    data: payload
  });
  expect(createResponse.status()).toBe(201);
  const createdBody = (await createResponse.json()) as { caseId: string; idempotent: boolean; status: string };
  expect(createdBody.idempotent).toBeFalsy();
  expect(createdBody.status).toBe("invitation_sent");

  const replayResponse = await request.post("/api/v1/integrations/cases", {
    headers: {
      "X-API-Key": "test-sap-key"
    },
    data: payload
  });
  expect(replayResponse.status()).toBe(200);
  const replayBody = (await replayResponse.json()) as { caseId: string; idempotent: boolean };
  expect(replayBody.caseId).toBe(createdBody.caseId);
  expect(replayBody.idempotent).toBeTruthy();

  const conflictResponse = await request.post("/api/v1/integrations/cases", {
    headers: {
      "X-API-Key": "test-sap-key"
    },
    data: {
      ...payload,
      supplierName: `${payload.supplierName} changed`
    }
  });
  expect(conflictResponse.status()).toBe(409);

  const openapiResponse = await request.get("/api/openapi.json");
  expect(openapiResponse.status()).toBe(200);
  const openapiBody = (await openapiResponse.json()) as { paths: Record<string, unknown> };
  expect(openapiBody.paths["/api/v1/integrations/cases"]).toBeDefined();
  expect(openapiBody.paths["/api/onboarding/cases"]).toBeUndefined();

  const docsResponse = await request.get("/api/docs");
  expect(docsResponse.status()).toBe(200);
  await expect(docsResponse.text()).resolves.toContain("SwaggerUIBundle");

  await loginAsFinance(page);
  await page.goto("/?source=sap_pr");
  const createdRow = page.locator("tr").filter({ hasText: payload.supplierName }).first();
  await expect(createdRow).toContainText("SAP PR");
  await expect(createdRow).toContainText(payload.supplierVat);

  await page.goto(`/cases/${createdBody.caseId}`);
  await expect(page.locator('[data-lane-for="onboarding_initiated"]')).toHaveText("SAP");
  await expect(page.locator('[data-lane-for="invitation_sent"]')).toHaveText("SAP");
  await expect(page.locator('[data-label-for="validation_completed_pending_supplier_creation"]')).toHaveText("Validation");
  await expect(page.locator('[data-lane-for="validation_completed_pending_supplier_creation"]')).toHaveText("Internal");
  await expect(page.locator("time").first()).toContainText("CET");

  await captureCheckpoint(page, testInfo, "sap-integration-queue");
});
