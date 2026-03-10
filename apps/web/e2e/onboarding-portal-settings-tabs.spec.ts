import { expect, test } from "@playwright/test";
import { loginAsAdmin, resetTestState } from "./utils/scenario";

test("portal settings uses tabs and persists integration endpoints", async ({ page, request }) => {
  await resetTestState(request);
  await loginAsAdmin(page);

  await page.goto("/portal-settings");
  const settingsTabsNav = page.getByRole("navigation", { name: "Portal settings sections" });
  await expect(settingsTabsNav.getByRole("link", { name: "Portal Settings" })).toBeVisible();
  await expect(settingsTabsNav.getByRole("link", { name: "Supplier Categories" })).toBeVisible();
  await expect(settingsTabsNav.getByRole("link", { name: "Document Catalog" })).toBeVisible();
  await expect(settingsTabsNav.getByRole("link", { name: "Requirement Matrix" })).toBeVisible();
  await expect(page.getByText(/Current policy|Política actual/)).toHaveCount(0);

  await page.getByLabel("SAP endpoint base URL").fill("https://sap.example.test/api");
  await page.getByLabel("SAP API key").fill("sap-key-test");
  await page.getByLabel("Docuware endpoint base URL").fill("https://docuware.example.test/api");
  await page.getByLabel("Docuware API key").fill("docuware-key-test");
  await page.getByRole("button", { name: "Save portal settings" }).click();

  await expect(page.getByLabel("SAP endpoint base URL")).toHaveValue("https://sap.example.test/api");
  await expect(page.getByLabel("Docuware endpoint base URL")).toHaveValue("https://docuware.example.test/api");

  await settingsTabsNav.getByRole("link", { name: "Supplier Categories" }).click();
  await expect(page).toHaveURL(/\/portal-settings\?tab=categories/);
  await expect(page.getByRole("heading", { name: "Supplier Types" })).toBeVisible();

  await settingsTabsNav.getByRole("link", { name: "Document Catalog" }).click();
  await expect(page).toHaveURL(/\/portal-settings\?tab=documents/);
  await expect(page.getByRole("columnheader", { name: "Code" })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Blocks P.O." })).toBeVisible();

  await settingsTabsNav.getByRole("link", { name: "Requirement Matrix" }).click();
  await expect(page).toHaveURL(/\/portal-settings\?tab=matrix/);
  await expect(page.getByLabel("Category")).toBeVisible();
  await expect(page.getByRole("button", { name: "Save matrix changes" }).first()).toBeDisabled();
});
