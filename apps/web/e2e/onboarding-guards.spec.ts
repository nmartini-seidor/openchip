import { expect, test } from "@playwright/test";
import {
  captureCheckpoint,
  createCaseViaUi,
  createUniqueVat,
  extractCaseIdFromUrl,
  loginAsFinance,
  resetTestState,
  sendInvitationFromCase,
  submitSupplierResponse
} from "./utils/scenario";

test("complete-validation and sap-create guardrails block invalid transitions", async ({ page, request }, testInfo) => {
  await resetTestState(request);
  await loginAsFinance(page);

  await createCaseViaUi(page, {
    supplierName: "Proveedor Guard",
    supplierVat: createUniqueVat("GUARD"),
    supplierContactName: "Guard Tester",
    supplierContactEmail: "guard@example.com",
    requester: "Finance Team",
    categoryCode: "SUB-STD-NAT"
  });

  const caseId = extractCaseIdFromUrl(page.url());
  const supplierUrl = await sendInvitationFromCase(page);
  await submitSupplierResponse(page, supplierUrl, caseId);

  const validationResponse = await request.post(`/api/onboarding/cases/${caseId}/complete-validation`);
  expect(validationResponse.ok()).toBeFalsy();

  const sapResponse = await request.post(`/api/onboarding/cases/${caseId}/sap-create`);
  expect(sapResponse.ok()).toBeFalsy();

  await captureCheckpoint(page, testInfo, "guardrails-enforced");
});

test("duplicate VAT is rejected and cancellation sets cancelled status", async ({ page, request }, testInfo) => {
  await resetTestState(request);
  await loginAsFinance(page);

  const duplicatedVat = createUniqueVat("DUP");
  const payload = {
    supplierName: "Proveedor Duplicate",
    supplierVat: duplicatedVat,
    supplierContactName: "Duplicate Tester",
    supplierContactEmail: "duplicate@example.com",
    requester: "Finance Team",
    categoryCode: "SUB-STD-NAT"
  };

  const createFirst = await request.post("/api/onboarding/cases", { data: payload });
  expect(createFirst.status()).toBe(201);

  const createSecond = await request.post("/api/onboarding/cases", { data: payload });
  expect(createSecond.ok()).toBeFalsy();

  await createCaseViaUi(page, {
    supplierName: "Proveedor Cancel",
    supplierVat: createUniqueVat("CANCEL"),
    supplierContactName: "Cancel Tester",
    supplierContactEmail: "cancel@example.com",
    requester: "Finance Team",
    categoryCode: "SUB-STD-NAT"
  });

  await sendInvitationFromCase(page);
  await page.locator("summary").filter({ hasText: "Cancel case" }).click();
  await page.getByRole("button", { name: "Cancel case" }).click();
  await expect(page.locator("span").filter({ hasText: /^Cancelled$/ }).first()).toBeVisible();

  await captureCheckpoint(page, testInfo, "duplicate-vat-and-cancelled");
});
