import { expect, test } from "@playwright/test";
import { loginAsAdmin, resetTestState } from "./utils/scenario";

test("users page supports search, pagination, and inline create/save actions", async ({ page, request }) => {
  await resetTestState(request);
  await loginAsAdmin(page);
  await page.goto("/users");

  const createButton = page.getByRole("button", { name: /Create user|Crear usuario/ });
  const displayNameInput = page.locator('input[name="displayName"][form="create-user-form"]');
  const emailInput = page.locator('input[name="email"][form="create-user-form"]');

  await expect(page.getByText(/Page \d+\/\d+|Página \d+\/\d+/)).toBeVisible();
  await expect(page.getByText(/Showing \d+-\d+ of \d+ users|Mostrando \d+-\d+ de \d+ usuarios/)).toBeVisible();

  const searchInput = page.getByLabel(/Search users|Buscar usuarios/);
  await searchInput.fill("admin@openchip.local");
  await expect(page).toHaveURL(/\/users\?q=admin%40openchip\.local/);
  await expect(page.getByText("admin@openchip.local")).toBeVisible();

  const nextPageLink = page.getByRole("link", { name: /Next|Siguiente/ });
  if ((await nextPageLink.count()) > 0) {
    await nextPageLink.click();
    await expect(page).toHaveURL(/\/users\?page=2/);
  }

  await searchInput.fill("");
  await displayNameInput.fill("QA Users Page");
  await emailInput.fill("qa-users-page@example.com");
  await Promise.all([page.waitForURL(/\/users(?:\?|$)/), createButton.click()]);
  await searchInput.fill("qa-users-page@example.com");
  await expect(page).toHaveURL(/\/users\?q=qa-users-page%40example\.com/);
  await expect(page.getByText("qa-users-page@example.com")).toBeVisible();

  const firstSaveButton = page.getByRole("button", { name: /Save|Guardar/ }).first();
  await expect(firstSaveButton.locator("svg")).toBeVisible();
});
