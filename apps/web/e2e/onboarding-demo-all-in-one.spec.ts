import { expect, Page, test } from "@playwright/test";
import { assertEmailContains } from "./utils/mail-client";
import {
  approveAllMandatory,
  captureCheckpoint,
  completeValidation,
  createCaseViaUi,
  createSupplierInSap,
  createUniqueVat,
  loginAsFinance,
  resetTestState,
  sendInvitationFromCase,
  submitSupplierResponse
} from "./utils/scenario";

test.use({
  launchOptions: {
    slowMo: 280
  }
});

async function demoPause(page: Page, ms = 750): Promise<void> {
  await page.waitForTimeout(ms);
}

test("all demos in one normal-speed walkthrough video", async ({ page, request }, testInfo) => {
  test.setTimeout(240_000);
  await resetTestState(request);
  await loginAsFinance(page);

  const happyPathEmail = "demo-happy@example.com";
  const happyCaseId = await createCaseViaUi(page, {
    supplierName: "Proveedor Demo Happy",
    supplierVat: createUniqueVat("DEMO-HAPPY"),
    supplierContactName: "Demo Happy",
    supplierContactEmail: happyPathEmail,
    requester: "Finance Team",
    categoryCode: "SUB-STD-NAT"
  });

  await demoPause(page);
  const happyPathSupplierUrl = await sendInvitationFromCase(page);
  await assertEmailContains(request, happyPathEmail, "onboarding invitation", "/supplier/");
  await demoPause(page);
  await submitSupplierResponse(page, happyPathSupplierUrl, happyCaseId, happyPathEmail);
  await demoPause(page);
  await approveAllMandatory(page);
  await demoPause(page);
  await completeValidation(page);
  await demoPause(page);
  await createSupplierInSap(page);
  await expect(page.locator("span").filter({ hasText: /^Supplier Created In Sap$/ }).first()).toBeVisible();
  await captureCheckpoint(page, testInfo, "demo-01-happy-path");

  await page.goto("/");
  await demoPause(page);
  const validationCaseId = await createCaseViaUi(page, {
    supplierName: "Proveedor Demo Validation",
    supplierVat: createUniqueVat("DEMO-VAL"),
    supplierContactName: "Demo Validation",
    supplierContactEmail: "demo-validation@example.com",
    requester: "Finance Team",
    categoryCode: "SUB-STD-NAT"
  });

  await demoPause(page);
  const validationSupplierUrl = await sendInvitationFromCase(page);
  await submitSupplierResponse(page, validationSupplierUrl, validationCaseId, "demo-validation@example.com");
  await demoPause(page);

  const finRow = page.locator("tr").filter({ has: page.getByText(/^FIN-01$/) }).first();
  await finRow.locator('select[name="decision"]').selectOption("reject");
  await demoPause(page, 300);
  await finRow.getByRole("button", { name: "Apply" }).click();
  await expect(finRow.getByText(/rejected|rechazado/i)).toBeVisible({ timeout: 15_000 });
  await demoPause(page);
  await page.getByRole("button", { name: "Resubmit rejected documents" }).click();
  await expect(finRow.getByText(/pending validation|pendiente de validaci[oó]n/i)).toBeVisible({ timeout: 15_000 });
  await demoPause(page);
  await finRow.locator('select[name="decision"]').selectOption("approve_provisionally");
  await finRow.getByRole("button", { name: "Apply" }).click();
  await expect(finRow.getByText(/approved provisionally|aprobado provisionalmente/i)).toBeVisible({ timeout: 15_000 });
  await captureCheckpoint(page, testInfo, "demo-02-validation");

  await page.goto("/supplier/11111111-2222-3333-4444-555555555555");
  await expect(page.getByText("Resource not found")).toBeVisible();
  await demoPause(page);

  await page.goto("/");
  await demoPause(page);
  const expiredTokenCaseId = await createCaseViaUi(page, {
    supplierName: "Proveedor Demo Token",
    supplierVat: createUniqueVat("DEMO-TOKEN"),
    supplierContactName: "Demo Token",
    supplierContactEmail: "demo-token@example.com",
    requester: "Finance Team",
    categoryCode: "SUB-STD-NAT"
  });

  const expiredTokenSupplierUrl = await sendInvitationFromCase(page);
  const expireResponse = await request.post(`/api/test/cases/${expiredTokenCaseId}/expire-invitation`);
  if (!expireResponse.ok()) {
    throw new Error(`Expire invitation failed (status=${expireResponse.status()}): ${await expireResponse.text()}`);
  }

  await demoPause(page);
  await page.goto(expiredTokenSupplierUrl);
  await expect(page.getByText("Resource not found")).toBeVisible();
  await captureCheckpoint(page, testInfo, "demo-03-security");

  await page.goto("/");
  await demoPause(page);
  const complianceEmail = "demo-compliance@example.com";
  const complianceCaseId = await createCaseViaUi(page, {
    supplierName: "Proveedor Demo Compliance",
    supplierVat: createUniqueVat("DEMO-COMP"),
    supplierContactName: "Demo Compliance",
    supplierContactEmail: complianceEmail,
    requester: "Finance Team",
    categoryCode: "SUB-STD-NAT"
  });

  const complianceSupplierUrl = await sendInvitationFromCase(page);
  const reminderButton = page.getByRole("button", { name: /Send (expiry|expiration) reminder/i });
  await expect(reminderButton).toBeVisible({ timeout: 15_000 });
  await reminderButton.click();
  await assertEmailContains(request, complianceEmail, "document expiry reminder", "mandatory supplier documents");
  await demoPause(page);
  await submitSupplierResponse(page, complianceSupplierUrl, complianceCaseId, complianceEmail);
  await approveAllMandatory(page);

  const setExpiryResponse = await request.post(`/api/test/cases/${complianceCaseId}/set-document-expiry`, {
    data: {
      code: "FIN-01",
      validTo: new Date(Date.now() - 3_600_000).toISOString()
    }
  });
  if (!setExpiryResponse.ok()) {
    throw new Error(`Set document expiry failed (status=${setExpiryResponse.status()}): ${await setExpiryResponse.text()}`);
  }

  await page.reload();
  await expect(page.getByText("Enabled", { exact: true })).toBeVisible();
  await captureCheckpoint(page, testInfo, "demo-04-compliance");

  await page.goto(`/cases/${validationCaseId}`);
  await expect(page.getByText("Document requirements")).toBeVisible();
  await demoPause(page);
});
