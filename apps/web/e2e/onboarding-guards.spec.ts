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

test("invalid case payload is handled with inline validation feedback", async ({ page, request }, testInfo) => {
  await resetTestState(request);
  await loginAsFinance(page);

  await page.goto("/cases/new");
  await page.getByLabel("Supplier Name").fill("Proveedor Validation");
  await page.getByLabel("Supplier VAT / Tax ID").fill("A1");
  await page.getByLabel("Supplier Contact Name").fill("Validation User");
  await page.getByLabel("Supplier Contact Email").fill("validation@example.com");
  await page.getByLabel("Supplier Category").selectOption("SUB-STD-NAT");
  await page.getByRole("button", { name: "Create onboarding case" }).click();

  await expect(page).toHaveURL(/\/cases\/new\?error=validation$/);
  await expect(page.getByText("VAT / Tax ID must have at least 3 characters.")).toBeVisible();
  await captureCheckpoint(page, testInfo, "invalid-case-validation-feedback");
});

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

  await expect(page.getByRole("button", { name: "Send expiry reminder" })).toHaveCount(0);

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
