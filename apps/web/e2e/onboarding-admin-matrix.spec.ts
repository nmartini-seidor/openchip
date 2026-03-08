import { expect, test } from "@playwright/test";
import {
  captureCheckpoint,
  createUniqueVat,
  extractCaseIdFromUrl,
  loginAsAdmin,
  resetTestState,
  sendInvitationFromCase,
  submitSupplierResponse
} from "./utils/scenario";

test("admin can manage matrix configuration and it drives onboarding requirements", async ({ page, request }, testInfo) => {
  await resetTestState(request);
  await loginAsAdmin(page);

  await page.goto("/portal-settings");
  await expect(page.getByText("Requirement Matrix")).toBeVisible();

  const uniqueSuffix = Date.now().toString().slice(-4);
  const newTypeLabel = `Strategic Partner ${uniqueSuffix}`;
  const newCategoryLabel = `Non-Subsidized / ${newTypeLabel} / National`;

  await page.getByLabel("New supplier type label").fill(newTypeLabel);
  await page.getByRole("button", { name: "Add type" }).click();
  await expect(page.locator("p").filter({ hasText: newTypeLabel }).first()).toBeVisible();
  await captureCheckpoint(page, testInfo, "admin-01-type-created");

  await page.locator("#categoryFunding").selectOption("non_subsidized");
  await page.locator("#categoryType").selectOption({ label: newTypeLabel });
  await page.locator("#categoryLocation").selectOption("national");
  await page.getByLabel("Display label").fill(newCategoryLabel);
  await page.getByRole("button", { name: "Add category" }).click();

  const createdCategoryForm = page
    .locator("form")
    .filter({ has: page.getByText(newCategoryLabel) })
    .first();
  await expect(createdCategoryForm).toBeVisible();
  const generatedCategoryCode = await createdCategoryForm.locator('input[name="categoryCode"]').inputValue();

  await page.locator("#selectedCategory").selectOption(generatedCategoryCode);
  await page.getByRole("button", { name: "Load category" }).click();

  const fin03Row = page.locator("tr").filter({ has: page.getByText(/^FIN-03$/) }).first();
  await fin03Row.getByLabel("Requirement level for FIN-03").selectOption("not_applicable");
  await fin03Row.getByRole("button", { name: "Save" }).click();
  await expect(fin03Row).toContainText("N/A");
  await captureCheckpoint(page, testInfo, "admin-02-matrix-updated");

  const supplierEmail = `admin-matrix-${uniqueSuffix}@example.com`;
  const supplierVat = createUniqueVat("ADMN");

  await page.goto("/cases/new");
  await page.getByLabel("Supplier Name").fill("Proveedor Matrix Admin");
  await page.getByLabel("Supplier VAT / Tax ID").fill(supplierVat);
  await page.getByRole("button", { name: "Validate VAT" }).click();
  await page.getByLabel("Supplier Contact Name").fill("Admin Matrix");
  await page.getByLabel("Supplier Contact Email").fill(supplierEmail);
  await page.getByLabel("Supplier Category").selectOption(generatedCategoryCode);

  const previewFin03Row = page.locator("tr").filter({ has: page.getByText(/^FIN-03$/) }).first();
  await expect(previewFin03Row).toContainText("N/A");
  await captureCheckpoint(page, testInfo, "admin-03-preview-checked");

  await page.getByRole("button", { name: "Create onboarding case" }).click();
  await expect(page).toHaveURL(/\/cases\/[0-9a-fA-F-]{36}$/);
  const caseId = extractCaseIdFromUrl(page.url());

  const supplierUrl = await sendInvitationFromCase(page);
  await submitSupplierResponse(page, supplierUrl, caseId);

  const caseDocumentRows = page.locator("tbody tr");
  await expect(caseDocumentRows.filter({ has: page.getByText(/^FIN-03$/) })).toHaveCount(0);
  await captureCheckpoint(page, testInfo, "admin-04-case-documents-driven-by-matrix");
});
