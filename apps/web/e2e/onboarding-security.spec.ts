import { expect, test } from "@playwright/test";
import {
  captureCheckpoint,
  createCaseViaUi,
  createUniqueVat,
  extractCaseIdFromUrl,
  loginAsFinance,
  resetTestState,
  sendInvitationFromCase
} from "./utils/scenario";

test("invalid supplier token is denied", async ({ page, request }, testInfo) => {
  await resetTestState(request);

  await page.goto("/supplier/11111111-2222-3333-4444-555555555555");
  await expect(page.getByText("Resource not found")).toBeVisible();
  await captureCheckpoint(page, testInfo, "invalid-token-denied");
});

test("expired supplier token is denied", async ({ page, request }, testInfo) => {
  await resetTestState(request);
  await loginAsFinance(page);

  await createCaseViaUi(page, {
    supplierName: "Proveedor Token",
    supplierVat: createUniqueVat("TOKEN"),
    supplierContactName: "Alice Token",
    supplierContactEmail: "token@example.com",
    requester: "Finance Team",
    categoryCode: "SUB-STD-NAT"
  });

  const caseId = extractCaseIdFromUrl(page.url());
  const supplierUrl = await sendInvitationFromCase(page);

  const expireResponse = await request.post(`/api/test/cases/${caseId}/expire-invitation`);
  if (!expireResponse.ok()) {
    throw new Error(`Expire invitation failed (status=${expireResponse.status()}): ${await expireResponse.text()}`);
  }

  await page.goto(supplierUrl);
  await expect(page.getByText("Resource not found")).toBeVisible();
  await captureCheckpoint(page, testInfo, "expired-token-denied");
});
