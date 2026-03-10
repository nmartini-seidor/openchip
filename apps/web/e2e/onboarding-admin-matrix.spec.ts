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

  await page.goto("/portal-settings?tab=matrix");
  await expect(page.getByRole("heading", { name: "Requirement Matrix" })).toBeVisible();
  const settingsTabsNav = page.getByRole("navigation", { name: "Portal settings sections" });
  await settingsTabsNav.getByRole("link", { name: "Supplier Categories" }).click();
  await expect(page).toHaveURL(/\/portal-settings\?tab=categories/);

  const uniqueSuffix = Date.now().toString().slice(-4);
  const newTypeLabel = `Strategic Partner ${uniqueSuffix}`;
  const newCategoryLabel = `Non-Subsidized / ${newTypeLabel} / National`;
  let appliedFin03Level: "optional" | "not_applicable" = "not_applicable";

  await page.getByLabel("New supplier type label").fill(newTypeLabel);
  await page.getByRole("button", { name: "Add type" }).click();
  await expect(page.locator("tr").filter({ hasText: newTypeLabel }).first()).toBeVisible();
  await captureCheckpoint(page, testInfo, "admin-01-type-created");

  await page.locator("#categoryFunding").selectOption("non_subsidized");
  await page.locator("#categoryType").selectOption({ label: newTypeLabel });
  await page.locator("#categoryLocation").selectOption("national");
  await page.getByLabel("Display label").fill(newCategoryLabel);
  await page.getByRole("button", { name: "Add category" }).click();

  const createdCategoryRow = page.locator("tr").filter({ has: page.getByText(newCategoryLabel) }).first();
  await expect(createdCategoryRow).toBeVisible();
  const generatedCategoryCode = (await createdCategoryRow.locator("td").first().innerText()).trim();

  await settingsTabsNav.getByRole("link", { name: "Requirement Matrix" }).click();
  await expect(page).toHaveURL(/\/portal-settings\?tab=matrix/);
  await page.locator("#selectedCategory").selectOption(generatedCategoryCode);
  await expect(page).toHaveURL(new RegExp(`/portal-settings\\?tab=matrix&category=${generatedCategoryCode}`));

  const fin03Row = page.locator("tr").filter({ has: page.getByText(/^FIN-03$/) }).first();
  const fin03Select = fin03Row.getByLabel("Requirement level for FIN-03");
  const currentFin03Value = await fin03Select.inputValue();
  const nextFin03Value = currentFin03Value === "optional" ? "not_applicable" : "optional";
  appliedFin03Level = nextFin03Value;
  await fin03Select.selectOption(nextFin03Value);
  await page.getByRole("button", { name: "Save matrix changes" }).first().click();
  await expect(fin03Select).toHaveValue(nextFin03Value);
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
  if (appliedFin03Level === "not_applicable") {
    await expect(previewFin03Row).toContainText("N/A");
  } else {
    await expect(previewFin03Row).toContainText("Optional");
  }
  await captureCheckpoint(page, testInfo, "admin-03-preview-checked");

  await page.getByRole("button", { name: /Create onboarding (case|supplier)|Crear proveedor de onboarding/i }).click();
  await expect(page).toHaveURL(/\/cases\/[0-9a-fA-F-]{36}$/);
  const caseId = extractCaseIdFromUrl(page.url());

  const supplierUrl = await sendInvitationFromCase(page);
  await submitSupplierResponse(page, supplierUrl, caseId, supplierEmail);

  const caseDocumentRows = page.locator("tbody tr");
  if (appliedFin03Level === "not_applicable") {
    await expect(caseDocumentRows.filter({ has: page.getByText(/^FIN-03$/) })).toHaveCount(0);
  } else {
    await expect(caseDocumentRows.filter({ has: page.getByText(/^FIN-03$/) })).toHaveCount(1);
  }
  await captureCheckpoint(page, testInfo, "admin-04-case-documents-driven-by-matrix");
});
