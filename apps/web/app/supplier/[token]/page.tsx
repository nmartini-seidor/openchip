import Image from "next/image";
import { CheckSquare, SendHorizontal, TriangleAlert } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { notFound, redirect } from "next/navigation";
import { invitationTokenSchema, RequirementPreviewRow } from "@openchip/shared";
import { requestSupplierOtpAction, supplierSubmitAction, verifySupplierOtpAction } from "@/app/actions";
import { SectionCard } from "@/components/section-card";
import { SubmitButton } from "@/components/submit-button";
import { SupplierLocaleSelector } from "@/components/supplier-locale-selector";
import { SupplierOnboardingForm } from "@/components/supplier-onboarding-form";
import { SupplierOtpRequestButton } from "@/components/supplier-otp-request-button";
import { getCurrentLocale } from "@/lib/auth";
import { listCountryOptions } from "@/lib/countries";
import { getEmailAdapter } from "@/lib/email";
import { onboardingRepository } from "@/lib/repository";
import { hasSupplierPortalSession } from "@/lib/supplier-session";

interface SupplierSearchParams {
  submitted?: string;
  error?: string;
  fields?: string;
  docs?: string;
  otp?: string;
  otpError?: string;
  draft?: string;
}

function getSupplierReturnTo(token: string, query: SupplierSearchParams): string {
  const params = new URLSearchParams();
  if (query.submitted !== undefined) {
    params.set("submitted", query.submitted);
  }
  if (query.error !== undefined) {
    params.set("error", query.error);
  }
  if (query.fields !== undefined) {
    params.set("fields", query.fields);
  }
  if (query.docs !== undefined) {
    params.set("docs", query.docs);
  }
  if (query.otp !== undefined) {
    params.set("otp", query.otp);
  }
  if (query.otpError !== undefined) {
    params.set("otpError", query.otpError);
  }
  if (query.draft !== undefined) {
    params.set("draft", query.draft);
  }

  const serialized = params.toString();
  return serialized.length > 0 ? `/supplier/${token}?${serialized}` : `/supplier/${token}`;
}

function getOtpCooldownSeconds(requestedAt: string | null): number {
  if (requestedAt === null) {
    return 0;
  }

  const elapsedSeconds = Math.floor((Date.now() - new Date(requestedAt).getTime()) / 1000);
  if (!Number.isFinite(elapsedSeconds) || elapsedSeconds >= 60) {
    return 0;
  }

  return Math.max(0, 60 - elapsedSeconds);
}

function parseCsvQueryParam(value: string | undefined): string[] {
  if (value === undefined || value.trim().length === 0) {
    return [];
  }

  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry, index, list) => entry.length > 0 && list.indexOf(entry) === index);
}

export default async function SupplierPortalPage({
  params,
  searchParams
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<SupplierSearchParams>;
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

  if (!isOtpVerified && onboardingCase.supplierOtpState.requestedAt === null) {
    try {
      const updatedCase = await onboardingRepository.requestSupplierOtp(
        { token: parsedToken.data },
        "supplier.portal"
      );
      if (updatedCase.supplierOtpState.code !== null && updatedCase.supplierOtpState.expiresAt !== null) {
        try {
          const emailAdapter = getEmailAdapter();
          await emailAdapter.sendSupplierOtpEmail({
            to: session.supplierContactEmail,
            supplierName: updatedCase.supplierName,
            otpCode: updatedCase.supplierOtpState.code,
            expiresAt: updatedCase.supplierOtpState.expiresAt
          });
        } catch {
          // Keep flow available if email adapter fails.
        }
      }
    } catch {
      redirect(`/supplier/${parsedToken.data}?otp=failed`);
    }

    redirect(`/supplier/${parsedToken.data}?otp=requested`);
  }

  if (isOtpVerified) {
    await onboardingRepository.registerPortalAccess(parsedToken.data, "supplier.portal");
  }

  const errorMessages: Record<string, string> = {
    validation: tSupplier("errors.validation"),
    "missing-mandatory-documents": tSupplier("errors.missingMandatoryDocuments"),
    "missing-rejected-documents": tSupplier("errors.missingRejectedDocuments"),
    expired: tSupplier("errors.expired"),
    "not-found": tSupplier("errors.notFound"),
    "otp-required": tSupplier("errors.otpRequired")
  };
  const errorMessage = query.error === undefined ? null : (errorMessages[query.error] ?? tSupplier("errors.validation"));

  const otpStateMessage =
    query.otp === "requested"
      ? tSupplier("otp.requested", { email: session.supplierContactEmail })
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
          : query.otpError === "cooldown"
            ? tSupplier("otp.cooldownError")
            : query.otpError === "invalid"
              ? tSupplier("otp.invalid")
              : null;

  if (!isOtpVerified) {
    const supplierReturnTo = getSupplierReturnTo(parsedToken.data, query);
    const otpRequestedAt = onboardingCase.supplierOtpState.requestedAt;
    const otpCooldownSeconds = getOtpCooldownSeconds(otpRequestedAt);

    return (
      <main id="main-content" className="mx-auto flex min-h-[70vh] w-full max-w-md items-center justify-center">
        <section className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm">
          <div className="mb-5 flex justify-center">
            <Image src="/logo-openchip.svg" alt="Openchip" width={220} height={68} className="h-12 w-auto" priority />
          </div>
          <h1 className="mt-2 text-2xl font-semibold text-slate-900">{tSupplier("accessTitle")}</h1>
          <p className="mt-1 text-sm text-slate-600">{tSupplier("accessSubtitle")}</p>

          {otpStateMessage !== null ? (
            <p className="mt-4 rounded-md border border-[#bdd4c5] bg-[#edf5ef] px-3 py-2 text-sm text-[var(--success)]">{otpStateMessage}</p>
          ) : null}
          {otpErrorMessage !== null ? (
            <p className="mt-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{otpErrorMessage}</p>
          ) : null}
          {errorMessage !== null ? (
            <p className="mt-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{errorMessage}</p>
          ) : null}

          <form action={verifySupplierOtpAction} className="mt-5 grid gap-4">
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
            <button type="submit" className="oc-btn oc-btn-primary w-full">
              {tSupplier("otp.verify")}
            </button>
          </form>

          <div className="mt-4 grid gap-2">
            <p className="text-xs text-slate-600">{tSupplier("otp.subtitle")}</p>
            <form action={requestSupplierOtpAction}>
              <input type="hidden" name="token" value={parsedToken.data} />
              <SupplierOtpRequestButton
                hasRequested={otpRequestedAt !== null}
                initialCooldownSeconds={otpCooldownSeconds}
                requestLabel={tSupplier("otp.requestCode")}
                resendLabel={tSupplier("otp.resendCode")}
                pendingLabel={tSupplier("otp.requestingCode")}
                cooldownLabelTemplate={tSupplier("otp.cooldownLabel", { seconds: "{seconds}" })}
                className="oc-btn oc-btn-secondary w-full disabled:cursor-not-allowed disabled:opacity-60"
              />
            </form>
          </div>

          <div className="mt-5 border-t border-[var(--border)] pt-4">
            <SupplierLocaleSelector
              initialLocale={locale}
              label={tSupplier("language")}
              englishLabel={tSupplier("locale.english")}
              spanishLabel={tSupplier("locale.spanish")}
              returnTo={supplierReturnTo}
            />
          </div>
        </section>
      </main>
    );
  }

  const countryOptions = listCountryOptions(locale);
  const requirements = (await onboardingRepository.getRequirementPreview(onboardingCase.categoryCode)).filter(
    (item): item is RequirementPreviewRow & { requirementLevel: "mandatory" | "optional" } =>
      item.requirementLevel === "mandatory" || item.requirementLevel === "optional"
  );
  const isSupplierResponseOpen =
    onboardingCase.status === "invitation_sent" ||
    onboardingCase.status === "portal_accessed" ||
    onboardingCase.status === "response_in_progress";
  const hasRejectedDocuments = onboardingCase.documents.some((document) => document.status === "rejected");
  const requirementLevelLabels: Record<string, string> = {
    mandatory: tCommon("requirementLevel.mandatory"),
    optional: tCommon("requirementLevel.optional")
  };
  const requirementLabelByCode = new Map(
    requirements.map((requirement) => [requirement.code, locale === "es" ? requirement.labelEs : requirement.labelEn])
  );
  const invalidFieldKeys = parseCsvQueryParam(query.fields);
  const invalidFieldLabelByKey: Record<string, string> = {
    street: tSupplier("street"),
    city: tSupplier("city"),
    postalCode: tSupplier("postalCode"),
    country: tSupplier("country"),
    banks: tSupplier("banks"),
    bankn: tSupplier("ibanOrAccountNumber"),
    accname: tSupplier("accname"),
    iban: tSupplier("ibanOrAccountNumber")
  };
  const invalidFieldLabels = invalidFieldKeys
    .map((key) => invalidFieldLabelByKey[key])
    .filter((label): label is string => label !== undefined);
  const missingDocumentCodes = parseCsvQueryParam(query.docs);
  const missingDocumentLabels = missingDocumentCodes.map((code) => ({
    code,
    label: requirementLabelByCode.get(code) ?? code
  }));
  const missingDocumentsTitle =
    query.error === "missing-rejected-documents"
      ? tSupplier("errors.missingRejectedDocumentsTitle")
      : tSupplier("errors.missingMandatoryDocumentsTitle");

  const draftUploadsByCode = new Map<string, typeof onboardingCase.documents[number]["files"]>();
  for (const draftDocument of onboardingCase.supplierDraft?.uploadedDocuments ?? []) {
    draftUploadsByCode.set(draftDocument.code, draftDocument.files);
  }

  const initialAddress = onboardingCase.supplierDraft?.address ?? onboardingCase.supplierAddress ?? {};
  const initialBankAccountSource = onboardingCase.supplierDraft?.bankAccount ?? onboardingCase.supplierBankAccount;

  return (
    <main id="main-content" className="w-full">
      <SectionCard title={tSupplier("title")} subtitle={tSupplier("subtitle")}>
        {!isSupplierResponseOpen ? (
          <article
            data-testid="supplier-submitted-card"
            className="mx-auto mt-4 max-w-2xl rounded-xl border border-[#bdd4c5] bg-[#edf5ef] p-5 shadow-sm"
          >
            <div className="flex items-start gap-3">
              <CheckSquare aria-hidden="true" className="mt-0.5 h-5 w-5 text-[var(--success)]" strokeWidth={2} />
              <div className="space-y-1">
                <p className="text-base font-semibold text-slate-900">{tSupplier("closedTitle")}</p>
                <p className="text-sm text-[var(--success)]">{tSupplier("submitted")}</p>
              </div>
            </div>
          </article>
        ) : (
          <>
            {hasRejectedDocuments ? (
              <div className="mt-1 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                <TriangleAlert aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2} />
                <p>{tSupplier("reworkNotice")}</p>
              </div>
            ) : null}

            {errorMessage !== null ? (
              <div className="mt-1 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                <p>{errorMessage}</p>
                {invalidFieldLabels.length > 0 ? (
                  <div className="mt-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.08em]">{tSupplier("errors.validationFieldsTitle")}</p>
                    <ul className="mt-1 list-disc pl-4 text-xs">
                      {invalidFieldLabels.map((label) => (
                        <li key={label}>{label}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {missingDocumentLabels.length > 0 ? (
                  <div className="mt-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.08em]">{missingDocumentsTitle}</p>
                    <ul className="mt-1 list-disc pl-4 text-xs">
                      {missingDocumentLabels.map((item) => (
                        <li key={item.code}>
                          {item.code} - {item.label}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            ) : null}

            <form action={supplierSubmitAction} className="mt-6 space-y-5">
              <input type="hidden" name="token" value={parsedToken.data} />
              <input type="hidden" name="bkvid" value="0001" />

              <p className="rounded-md border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-sm text-slate-700">
                {tSupplier("resumeNotice")}
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
                  ibanOrAccountNumber: tSupplier("ibanOrAccountNumber"),
                  ibanInvalid: tSupplier("ibanInvalid"),
                  ibanValid: tSupplier("ibanValid"),
                  accname: tSupplier("accname"),
                  autoSaveIdle: tSupplier("autoSaveIdle"),
                  autoSaving: tSupplier("autoSaving"),
                  autoSaved: tSupplier("autoSaved"),
                  draftSaveError: tSupplier("draftSaveError"),
                  requiredDocsTitle: tSupplier("requiredDocsTitle"),
                  requiredDocsSubtitle: tSupplier("requiredDocsSubtitle"),
                  uploadFiles: tSupplier("uploadFiles"),
                  uploadingFiles: tSupplier("uploadingFiles"),
                  templateDownload: tSupplier("templateDownload"),
                  noTemplate: tSupplier("noTemplate"),
                  uploadedFiles: tSupplier("uploadedFiles"),
                  noFiles: tSupplier("noFiles"),
                  missingMandatoryTitle: tSupplier("missingMandatoryTitle"),
                  missingMandatoryHint: tSupplier("missingMandatoryHint")
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
                  address: initialAddress,
                  bankAccount: {
                    ...(initialBankAccountSource?.banks !== undefined ? { banks: initialBankAccountSource.banks } : {}),
                    ...(initialBankAccountSource?.bankn !== null && initialBankAccountSource?.bankn !== undefined
                      ? { bankn: initialBankAccountSource.bankn }
                      : {}),
                    ...(initialBankAccountSource?.accname !== undefined ? { accname: initialBankAccountSource.accname } : {}),
                    ...(initialBankAccountSource?.iban !== null && initialBankAccountSource?.iban !== undefined
                      ? { iban: initialBankAccountSource.iban }
                      : {})
                  }
                }}
                initialMissingDocumentCodes={missingDocumentCodes}
              />

              <div className="flex justify-end">
                <SubmitButton
                  label={
                    <>
                      <SendHorizontal aria-hidden="true" className="h-4 w-4" strokeWidth={1.8} />
                      {tSupplier("submit")}
                    </>
                  }
                  pendingLabel={tSupplier("submitting")}
                  className="oc-btn oc-btn-primary disabled:opacity-60"
                />
              </div>
            </form>
          </>
        )}
      </SectionCard>
    </main>
  );
}
