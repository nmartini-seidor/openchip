import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { invitationTokenSchema, RequirementPreviewRow } from "@openchip/shared";
import { requestSupplierOtpAction, supplierSubmitAction, verifySupplierOtpAction } from "@/app/actions";
import { SectionCard } from "@/components/section-card";
import { SubmitButton } from "@/components/submit-button";
import { SupplierOnboardingForm } from "@/components/supplier-onboarding-form";
import { getCurrentLocale } from "@/lib/auth";
import { listCountryOptions } from "@/lib/countries";
import { onboardingRepository } from "@/lib/repository";
import { hasSupplierPortalSession } from "@/lib/supplier-session";

export default async function SupplierPortalPage({
  params,
  searchParams
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{
    submitted?: string;
    error?: string;
    otp?: string;
    otpError?: string;
    draft?: string;
  }>;
}) {
  const [{ token }, query, locale, tSupplier, tCommon] = await Promise.all([
    params,
    searchParams,
    getCurrentLocale(),
    getTranslations("SupplierPortal"),
    getTranslations("Common")
  ]);

  const parsedToken = invitationTokenSchema.safeParse(token);
  if (!parsedToken.success) {
    notFound();
  }

  const session = await onboardingRepository.getSupplierSession(parsedToken.data);
  if (session === null) {
    notFound();
  }

  const onboardingCase = await onboardingRepository.getCase(session.caseId);
  if (onboardingCase === null) {
    notFound();
  }

  const hasPortalSession = await hasSupplierPortalSession(parsedToken.data, onboardingCase.id);
  const isOtpVerified = hasPortalSession && session.otpVerified;

  if (isOtpVerified) {
    await onboardingRepository.registerPortalAccess(parsedToken.data, "supplier.portal");
  }

  const countryOptions = listCountryOptions(locale);
  const requirements = (await onboardingRepository.getRequirementPreview(onboardingCase.categoryCode)).filter(
    (item): item is RequirementPreviewRow & { requirementLevel: "mandatory" | "optional" } =>
      item.requirementLevel === "mandatory" || item.requirementLevel === "optional"
  );
  const requirementLevelLabels: Record<string, string> = {
    mandatory: tCommon("requirementLevel.mandatory"),
    optional: tCommon("requirementLevel.optional")
  };

  const draftUploadsByCode = new Map<string, typeof onboardingCase.documents[number]["files"]>();
  for (const draftDocument of onboardingCase.supplierDraft?.uploadedDocuments ?? []) {
    draftUploadsByCode.set(draftDocument.code, draftDocument.files);
  }

  const errorMessages: Record<string, string> = {
    validation: tSupplier("errors.validation"),
    "missing-mandatory-documents": tSupplier("errors.missingMandatoryDocuments"),
    expired: tSupplier("errors.expired"),
    "not-found": tSupplier("errors.notFound"),
    "otp-required": tSupplier("errors.otpRequired")
  };
  const errorMessage = query.error === undefined ? null : (errorMessages[query.error] ?? tSupplier("errors.validation"));

  const otpStateMessage =
    query.otp === "requested"
      ? tSupplier("otp.requested")
      : query.otp === "verified"
        ? tSupplier("otp.verified")
        : query.otp === "failed"
          ? tSupplier("otp.failed")
          : null;

  const otpErrorMessage =
    query.otpError === "expired"
      ? tSupplier("otp.expired")
      : query.otpError === "attempts"
        ? tSupplier("otp.attemptsExceeded")
        : query.otpError === "not-requested"
          ? tSupplier("otp.notRequested")
          : query.otpError === "invalid"
            ? tSupplier("otp.invalid")
            : null;

  return (
    <main id="main-content" className="w-full">
      <SectionCard title={tSupplier("title")} subtitle={tSupplier("subtitle")}>
        <p className="text-sm text-slate-600">
          {tSupplier("supplier")}: <span className="font-semibold text-slate-900">{onboardingCase.supplierName}</span> · VAT:{" "}
          {onboardingCase.supplierVat}
        </p>

        {query.submitted === "1" ? (
          <p className="mt-4 rounded-md border border-[#bdd4c5] bg-[#edf5ef] px-3 py-2 text-sm text-[var(--success)]">{tSupplier("submitted")}</p>
        ) : null}
        {errorMessage !== null ? (
          <p className="mt-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{errorMessage}</p>
        ) : null}

        {!isOtpVerified ? (
          <div className="mt-6 grid gap-4 rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] p-4">
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-[0.08em] text-slate-700">{tSupplier("otp.title")}</h3>
              <p className="mt-1 text-sm text-slate-600">{tSupplier("otp.subtitle", { email: session.supplierContactEmail })}</p>
            </div>

            {otpStateMessage !== null ? (
              <p className="rounded-md border border-[#bdd4c5] bg-[#edf5ef] px-3 py-2 text-sm text-[var(--success)]">{otpStateMessage}</p>
            ) : null}
            {otpErrorMessage !== null ? (
              <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{otpErrorMessage}</p>
            ) : null}

            <form action={requestSupplierOtpAction} className="flex flex-wrap items-center gap-3">
              <input type="hidden" name="token" value={parsedToken.data} />
              <SubmitButton
                label={tSupplier("otp.requestCode")}
                pendingLabel={tSupplier("otp.requestingCode")}
                className="oc-btn oc-btn-secondary"
              />
            </form>

            <form action={verifySupplierOtpAction} className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
              <input type="hidden" name="token" value={parsedToken.data} />
              <div className="grid gap-2">
                <label htmlFor="otpCode" className="text-sm font-semibold text-slate-700">
                  {tSupplier("otp.codeLabel")}
                </label>
                <input
                  id="otpCode"
                  name="otpCode"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="\d{6}"
                  maxLength={6}
                  required
                  className="oc-input"
                />
              </div>
              <SubmitButton
                label={tSupplier("otp.verify")}
                pendingLabel={tSupplier("otp.verifying")}
                className="oc-btn oc-btn-primary"
              />
            </form>
          </div>
        ) : (
          <form action={supplierSubmitAction} className="mt-6 space-y-5">
            <input type="hidden" name="token" value={parsedToken.data} />
            <input type="hidden" name="bkvid" value="0001" />

            <p className="rounded-md border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-sm text-slate-700">
              {tSupplier("resumeNotice")}
              {query.draft === "saved" ? ` ${tSupplier("draftSavedNotice")}` : ""}
            </p>

            <SupplierOnboardingForm
              token={parsedToken.data}
              labels={{
                street: tSupplier("street"),
                city: tSupplier("city"),
                postalCode: tSupplier("postalCode"),
                country: tSupplier("country"),
                countryPlaceholder: tSupplier("countryPlaceholder"),
                bankSectionTitle: tSupplier("bankSectionTitle"),
                bankSectionSubtitle: tSupplier("bankSectionSubtitle"),
                banks: tSupplier("banks"),
                bankl: tSupplier("bankl"),
                iban: tSupplier("iban"),
                bankn: tSupplier("bankn"),
                bkont: tSupplier("bkont"),
                accname: tSupplier("accname"),
                saveDraft: tSupplier("saveDraft"),
                savingDraft: tSupplier("savingDraft"),
                draftSaved: tSupplier("draftSaved"),
                draftSaveError: tSupplier("draftSaveError"),
                requiredDocsTitle: tSupplier("requiredDocsTitle"),
                requiredDocsSubtitle: tSupplier("requiredDocsSubtitle"),
                uploadFiles: tSupplier("uploadFiles"),
                uploadingFiles: tSupplier("uploadingFiles"),
                templateDownload: tSupplier("templateDownload"),
                noTemplate: tSupplier("noTemplate"),
                uploadedFiles: tSupplier("uploadedFiles"),
                noFiles: tSupplier("noFiles")
              }}
              countries={countryOptions}
              requirements={requirements.map((requirement) => ({
                code: requirement.code,
                label: locale === "es" ? requirement.labelEs : requirement.labelEn,
                requirementLevel: requirement.requirementLevel,
                requirementLabel: requirementLevelLabels[requirement.requirementLevel] ?? requirement.requirementLevel,
                templateHref:
                  requirement.templateStoragePath === null
                    ? null
                    : `/api/supplier/session/${parsedToken.data}/templates/${requirement.code}`,
                files:
                  draftUploadsByCode.get(requirement.code) ??
                  onboardingCase.documents.find((item) => item.code === requirement.code)?.files ??
                  []
              }))}
              initialDraft={{
                address: onboardingCase.supplierDraft?.address ?? {},
                bankAccount: {
                  ...(onboardingCase.supplierDraft?.bankAccount.banks !== undefined
                    ? { banks: onboardingCase.supplierDraft.bankAccount.banks }
                    : {}),
                  ...(onboardingCase.supplierDraft?.bankAccount.bankl !== undefined
                    ? { bankl: onboardingCase.supplierDraft.bankAccount.bankl }
                    : {}),
                  ...(onboardingCase.supplierDraft?.bankAccount.bankn !== null &&
                  onboardingCase.supplierDraft?.bankAccount.bankn !== undefined
                    ? { bankn: onboardingCase.supplierDraft.bankAccount.bankn }
                    : {}),
                  ...(onboardingCase.supplierDraft?.bankAccount.bkont !== null &&
                  onboardingCase.supplierDraft?.bankAccount.bkont !== undefined
                    ? { bkont: onboardingCase.supplierDraft.bankAccount.bkont }
                    : {}),
                  ...(onboardingCase.supplierDraft?.bankAccount.accname !== undefined
                    ? { accname: onboardingCase.supplierDraft.bankAccount.accname }
                    : {}),
                  ...(onboardingCase.supplierDraft?.bankAccount.iban !== null &&
                  onboardingCase.supplierDraft?.bankAccount.iban !== undefined
                    ? { iban: onboardingCase.supplierDraft.bankAccount.iban }
                    : {})
                }
              }}
            />

            <div className="flex justify-end">
              <SubmitButton
                label={tSupplier("submit")}
                pendingLabel={tSupplier("submitting")}
                className="oc-btn oc-btn-primary disabled:opacity-60"
              />
            </div>
          </form>
        )}
      </SectionCard>
    </main>
  );
}
