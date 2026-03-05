import { expect, test } from "@playwright/test";
import { assertEmailContains } from "./utils/mail-client";
import {
  approveAllMandatory,
  captureCheckpoint,
  createCaseViaUi,
  createUniqueVat,
  loginAsFinance,
  resetTestState,
  sendInvitationFromCase,
  submitSupplierResponse
} from "./utils/scenario";

test("expired mandatory document enables PO block", async ({ page, request }, testInfo) => {
  await resetTestState(request);
  await loginAsFinance(page);

  const caseId = await createCaseViaUi(page, {
    supplierName: "Proveedor Expiry",
    supplierVat: createUniqueVat("EXPIRY"),
    supplierContactName: "Expiry Tester",
    supplierContactEmail: "expiry@example.com",
    requester: "Finance Team",
    categoryCode: "SUB-STD-NAT"
  });

  const supplierUrl = await sendInvitationFromCase(page);
  await submitSupplierResponse(page, supplierUrl, caseId);
  await approveAllMandatory(page);

  const setExpiryResponse = await request.post(`/api/test/cases/${caseId}/set-document-expiry`, {
    data: {
      code: "FIN-01",
      validTo: new Date(Date.now() - 3_600_000).toISOString()
    }
  });
  if (!setExpiryResponse.ok()) {
    throw new Error(`Set document expiry failed (status=${setExpiryResponse.status()}): ${await setExpiryResponse.text()}`);
  }

  await page.reload();
  await expect(page.getByText("PO Block:", { exact: false })).toBeVisible();
  await expect(page.getByText("Enabled", { exact: true })).toBeVisible();

  await captureCheckpoint(page, testInfo, "po-block-enabled");
});

test("send expiry reminder produces an email", async ({ page, request }, testInfo) => {
  await resetTestState(request);
  await loginAsFinance(page);

  const supplierEmail = "reminder@example.com";
  const caseId = await createCaseViaUi(page, {
    supplierName: "Proveedor Reminder",
    supplierVat: createUniqueVat("REMINDER"),
    supplierContactName: "Reminder Tester",
    supplierContactEmail: supplierEmail,
    requester: "Finance Team",
    categoryCode: "SUB-STD-NAT"
  });

  const supplierUrl = await sendInvitationFromCase(page);
  await submitSupplierResponse(page, supplierUrl, caseId);

  await page.getByRole("button", { name: "Send expiry reminder" }).click();
  await assertEmailContains(request, supplierEmail, "document expiry reminder", "mandatory supplier documents");

  await captureCheckpoint(page, testInfo, "reminder-email-sent");
});
