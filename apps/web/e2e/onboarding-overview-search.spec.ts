import { APIRequestContext, expect, test } from "@playwright/test";
import { captureCheckpoint, loginAsFinance, resetTestState } from "./utils/scenario";

interface SapCasePayload {
  sapPrId: string;
  sapSystem: string;
  requesterSapUserId: string;
  requesterDisplayName: string;
  supplierName: string;
  supplierVat: string;
  supplierContactName: string;
  supplierContactEmail: string;
  categoryCode: string;
  requestedAt: string;
  costCenter: string;
  companyCode: string;
  purchasingOrg: string;
  notes: string;
}

function buildSapPayload(seed: string, supplierName: string, supplierVat: string): SapCasePayload {
  return {
    sapPrId: `45${seed.slice(-8)}`,
    sapSystem: "S4HANA-PRD",
    requesterSapUserId: "U123456",
    requesterDisplayName: "Ana Gomez",
    supplierName,
    supplierVat,
    supplierContactName: "Supplier Contact",
    supplierContactEmail: `${seed}@supplier.local`,
    categoryCode: "SUB-STD-NAT",
    requestedAt: "2026-03-06T10:30:00Z",
    costCenter: "CC-1000",
    companyCode: "OC01",
    purchasingOrg: "PO-EU",
    notes: "Created from SAP PR with New Supplier."
  };
}

async function createSapCase(request: APIRequestContext, payload: SapCasePayload): Promise<void> {
  const response = await request.post("/api/v1/integrations/cases", {
    headers: {
      "X-API-Key": "test-sap-key"
    },
    data: payload
  });
  expect(response.status()).toBe(201);
}

test("overview card filters suppliers by name and VAT as user types", async ({ page, request }, testInfo) => {
  await resetTestState(request);
  const unique = Date.now().toString();
  const alphaName = `Alpha Supplier ${unique}`;
  const betaName = `Beta Supplier ${unique}`;
  const alphaVat = `ESA${unique.slice(-7)}1`;
  const betaVat = `ESB${unique.slice(-7)}2`;

  await createSapCase(request, buildSapPayload(`${unique}1`, alphaName, alphaVat));
  await createSapCase(request, buildSapPayload(`${unique}2`, betaName, betaVat));

  await loginAsFinance(page);
  await page.goto("/");

  const searchInput = page.getByLabel(/Search|Buscar/);

  await searchInput.fill("Alpha");
  await expect(page).toHaveURL(/q=Alpha/);
  await expect(page.locator("tr").filter({ hasText: alphaName })).toHaveCount(1);
  await expect(page.locator("tr").filter({ hasText: betaName })).toHaveCount(0);

  await searchInput.fill(betaVat);
  await expect(page).toHaveURL(new RegExp(`q=${betaVat}`));
  await expect(page.locator("tr").filter({ hasText: betaName })).toHaveCount(1);
  await expect(page.locator("tr").filter({ hasText: alphaName })).toHaveCount(0);

  await captureCheckpoint(page, testInfo, "overview-card-live-supplier-search");
});
