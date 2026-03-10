import { expect, test, type Page } from "@playwright/test";
import {
  createCaseViaUi,
  createUniqueVat,
  loginAsFinance,
  resetTestState,
  sendInvitationFromCase,
  submitSupplierResponse
} from "./utils/scenario";

function extractSupplierToken(supplierUrl: string): string {
  const token = supplierUrl.split("/").filter((segment) => segment.length > 0).at(-1);
  if (token === undefined) {
    throw new Error(`Cannot extract token from supplier url: ${supplierUrl}`);
  }
  return token;
}

async function fetchOtpCode(page: Page, token: string): Promise<string> {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    const response = await page.request.get(`/api/test/supplier/${token}/otp`);
    if (response.ok()) {
      const payload = (await response.json()) as { code: string | null };
      if (typeof payload.code === "string" && payload.code.length === 6) {
        return payload.code;
      }
    }
    await page.waitForTimeout(200);
  }

  throw new Error(`OTP code was not available for token=${token} within timeout.`);
}

async function openSupplierPortalWithOtp(page: Page, supplierUrl: string): Promise<void> {
  await page.goto(supplierUrl);
  if (!/[?&]otp=requested(?:&|$)/.test(page.url())) {
    const sendCodeButton = page.getByRole("button", {
      name: /Send verification code|Enviar código de verificación|Resend verification code|Reenviar código de verificación/
    });
    if ((await sendCodeButton.count()) > 0 && (await sendCodeButton.isEnabled())) {
      await Promise.all([page.waitForURL(/otp=(requested|failed)|otpError=/), sendCodeButton.click()]);
    }
  }

  const token = extractSupplierToken(supplierUrl);
  const otpCode = await fetchOtpCode(page, token);
  await page.getByLabel(/Verification code|Código de verificación/).fill(otpCode);
  await Promise.all([
    page.waitForURL(/otp=(verified|failed)|otpError=/),
    page.getByRole("button", { name: /Verify code|Verificar código/ }).click()
  ]);
  if (page.url().includes("otpError=")) {
    throw new Error(`Supplier OTP verification failed for ${supplierUrl}. Current URL: ${page.url()}`);
  }
  await expect(page.getByLabel(/Street|Calle/)).toBeVisible();
}

test("supplier uploads are visible to internal users and expiry can be edited", async ({ page, request }) => {
  await resetTestState(request);
  await loginAsFinance(page);

  const caseId = await createCaseViaUi(page, {
    supplierName: "Proveedor Evidencias",
    supplierVat: createUniqueVat("FILES"),
    supplierContactName: "Evidence Contact",
    supplierContactEmail: "evidence@example.com",
    requester: "Finance Team",
    categoryCode: "SUB-STD-NAT"
  });

  const supplierUrl = await sendInvitationFromCase(page);
  await submitSupplierResponse(page, supplierUrl, caseId, "evidence@example.com");

  const fileLinks = page.locator('a[href*="/api/cases/"][href*="/files/"]');
  await expect(fileLinks.first()).toBeVisible();

  const validToInput = page.locator('input[data-expiry-input="1"]').first();
  await validToInput.fill("2027-05-31");
  await page.getByRole("button", { name: /Save Supplier|Guardar proveedor/ }).click();
  await expect(validToInput).toHaveValue("2027-05-31");
  await expect(page.getByText(/Updated expiry for 1 document\(s\):/)).toBeVisible();
});

test("submitted supplier portal shows confirmation card only on revisit", async ({ page, request }) => {
  await resetTestState(request);
  await loginAsFinance(page);

  const caseId = await createCaseViaUi(page, {
    supplierName: "Proveedor Closed Form",
    supplierVat: createUniqueVat("CLOSEDFORM"),
    supplierContactName: "Closed Form Contact",
    supplierContactEmail: "closedform@example.com",
    requester: "Finance Team",
    categoryCode: "SUB-STD-NAT"
  });

  const supplierUrl = await sendInvitationFromCase(page);
  await submitSupplierResponse(page, supplierUrl, caseId, "closedform@example.com");

  await page.goto(supplierUrl);
  await expect(page.getByTestId("supplier-submitted-card")).toBeVisible();
  await expect(page.getByRole("button", { name: /Submit Response|Enviar respuesta/i })).toHaveCount(0);
  await expect(page.getByLabel(/Street|Calle/)).toHaveCount(0);
});

test("saving expiry ignores non-present documents and does not crash", async ({ page, request }) => {
  await resetTestState(request);
  await loginAsFinance(page);

  const caseId = await createCaseViaUi(page, {
    supplierName: "Proveedor Sin Archivos",
    supplierVat: createUniqueVat("NOFILE"),
    supplierContactName: "No File Contact",
    supplierContactEmail: "nofile@example.com",
    requester: "Finance Team",
    categoryCode: "SUB-STD-NAT"
  });

  await expect(page.locator('input[data-expiry-input="1"]')).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Save Supplier|Guardar proveedor/ })).toBeDisabled();

  await page.locator('form[id^="document-expiry-form-"]').evaluate((formElement) => {
    if (!(formElement instanceof HTMLFormElement)) {
      throw new Error("Expected expiry form.");
    }

    const appendHidden = (name: string, value: string): void => {
      const input = document.createElement("input");
      input.type = "hidden";
      input.name = name;
      input.value = value;
      formElement.appendChild(input);
    };

    appendHidden("validTo__DPO-01", "2028-02-20");
    appendHidden("initialValidTo__DPO-01", "");
    formElement.submit();
  });

  await expect(page).toHaveURL(new RegExp(`/cases/${caseId}$`));
  await expect(page.getByText("Runtime Error")).toHaveCount(0);
});

test("supplier submit shows field-level guidance for invalid IBAN and marks mandatory fields", async ({ page, request }) => {
  await resetTestState(request);
  await loginAsFinance(page);

  await createCaseViaUi(page, {
    supplierName: "Proveedor Validacion",
    supplierVat: createUniqueVat("VALIBAN"),
    supplierContactName: "Validation Contact",
    supplierContactEmail: "validation@example.com",
    requester: "Finance Team",
    categoryCode: "SUB-STD-NAT"
  });

  const supplierUrl = await sendInvitationFromCase(page);
  await openSupplierPortalWithOtp(page, supplierUrl);

  await expect(page.locator('label[for="street"] span.text-rose-600')).toHaveText("*");
  await expect(page.locator('label[for="city"] span.text-rose-600')).toHaveText("*");
  await expect(page.locator('label[for="postalCode"] span.text-rose-600')).toHaveText("*");

  await page.getByLabel(/Street|Calle/).fill("Carrer de Mallorca 123");
  await page.getByLabel(/City|Ciudad/).fill("Barcelona");
  await page.getByLabel(/Postal code|Código postal/).fill("08013");

  await page.locator("#country").click();
  await page.locator("#country").fill("Spain");
  await page.keyboard.press("Enter");

  await page.locator("#banks").click();
  await page.locator("#banks").fill("Spain");
  await page.keyboard.press("Enter");

  await page.getByLabel(/IBAN|número de cuenta bancaria|bank account number/i).fill("ES00INVALIDIBAN");
  await page.getByLabel(/Bank account holder name|Titular de la cuenta bancaria/).fill("Proveedor Demo SL");

  const requirementSections = page.locator("aside section");
  const requirementCount = await requirementSections.count();
  for (let index = 0; index < requirementCount; index += 1) {
    const section = requirementSections.nth(index);
    let uploadInput = section.locator('input[type="file"]');
    if ((await uploadInput.count()) === 0) {
      await section.locator("button").first().click();
      uploadInput = section.locator('input[type="file"]');
    }
    await uploadInput.setInputFiles([
      {
        name: `invalid-iban-doc-${index + 1}.pdf`,
        mimeType: "application/pdf",
        buffer: Buffer.from("%PDF-1.4 invalid iban")
      }
    ]);
  }

  await page.getByRole("button", { name: /Submit Response|Enviar respuesta/ }).click();

  await expect(page).toHaveURL(/error=validation/);
  await expect(page).toHaveURL(/fields=/);
  await expect(page.getByText(/Fix these fields|Corrige estos campos/)).toBeVisible();
  await expect(page.locator("li", { hasText: /IBAN/ })).toBeVisible();
});
