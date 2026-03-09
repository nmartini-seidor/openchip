import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { invitationTokenSchema } from "@openchip/shared";
import { supplierSubmitAction } from "@/app/actions";
import { FilterableCountrySelect } from "@/components/filterable-country-select";
import { SectionCard } from "@/components/section-card";
import { SubmitButton } from "@/components/submit-button";
import { getCurrentLocale } from "@/lib/auth";
import { listCountryOptions } from "@/lib/countries";
import { onboardingRepository } from "@/lib/repository";

export default async function SupplierPortalPage({
  params,
  searchParams
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ submitted?: string; error?: string }>;
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

  await onboardingRepository.registerPortalAccess(parsedToken.data, "supplier.portal");
  const onboardingCase = await onboardingRepository.getCase(session.caseId);

  if (onboardingCase === null) {
    notFound();
  }

  const requirements = await onboardingRepository.getRequirementSummary(onboardingCase.categoryCode);
  const countryOptions = listCountryOptions(locale);

  const requirementLevelLabels: Record<string, string> = {
    mandatory: tCommon("requirementLevel.mandatory"),
    optional: tCommon("requirementLevel.optional"),
    not_applicable: tCommon("requirementLevel.notApplicable")
  };

  const errorMessages: Record<string, string> = {
    validation: tSupplier("errors.validation"),
    "missing-mandatory-documents": tSupplier("errors.missingMandatoryDocuments"),
    expired: tSupplier("errors.expired"),
    "not-found": tSupplier("errors.notFound")
  };
  const errorMessage = query.error === undefined ? null : (errorMessages[query.error] ?? tSupplier("errors.validation"));

  return (
    <main id="main-content" className="w-full">
      <div className="grid gap-5 xl:grid-cols-[1.6fr_1fr]">
        <SectionCard title={tSupplier("title")} subtitle={tSupplier("subtitle")}>
          <p className="text-sm text-slate-600">
            {tSupplier("supplier")}: <span className="font-semibold text-slate-900">{onboardingCase.supplierName}</span> · VAT: {onboardingCase.supplierVat}
          </p>

          {query.submitted === "1" ? (
            <p className="mt-4 rounded-md border border-[#bdd4c5] bg-[#edf5ef] px-3 py-2 text-sm text-[var(--success)]">{tSupplier("submitted")}</p>
          ) : null}
          {errorMessage !== null ? (
            <p className="mt-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{errorMessage}</p>
          ) : null}

          <form action={supplierSubmitAction} className="mt-6 grid gap-5 sm:grid-cols-2">
            <input type="hidden" name="token" value={parsedToken.data} />
            <input type="hidden" name="bkvid" value="0001" />

            <div className="grid gap-2 sm:col-span-2">
              <label htmlFor="address" className="text-sm font-semibold text-slate-700">
                {tSupplier("address")}
              </label>
              <input
                id="address"
                name="address"
                required
                autoComplete="street-address"
                className="oc-input"
              />
            </div>

            <FilterableCountrySelect
              id="country"
              name="country"
              label={tSupplier("country")}
              options={countryOptions}
              placeholder={tSupplier("countryPlaceholder")}
              required
            />

            <div className="sm:col-span-2">
              <div className="rounded-lg border border-[var(--border)]/80 bg-[var(--surface-muted)] p-4">
                <h3 className="text-sm font-semibold uppercase tracking-[0.08em] text-slate-600">{tSupplier("bankSectionTitle")}</h3>
                <p className="mt-1 text-xs text-slate-500">{tSupplier("bankSectionSubtitle")}</p>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <FilterableCountrySelect
                    id="banks"
                    name="banks"
                    label={tSupplier("banks")}
                    options={countryOptions}
                    placeholder={tSupplier("countryPlaceholder")}
                    required
                  />

                  <div className="grid gap-2">
                    <label htmlFor="bankl" className="text-sm font-semibold text-slate-700">
                      {tSupplier("bankl")}
                    </label>
                    <input
                      id="bankl"
                      name="bankl"
                      maxLength={15}
                      required
                      className="oc-input"
                    />
                  </div>

                  <div className="grid gap-2">
                    <label htmlFor="iban" className="text-sm font-semibold text-slate-700">
                      {tSupplier("iban")}
                    </label>
                    <input
                      id="iban"
                      name="iban"
                      maxLength={34}
                      autoComplete="off"
                      className="oc-input"
                    />
                  </div>

                  <div className="grid gap-2">
                    <label htmlFor="bankn" className="text-sm font-semibold text-slate-700">
                      {tSupplier("bankn")}
                    </label>
                    <input
                      id="bankn"
                      name="bankn"
                      maxLength={18}
                      autoComplete="off"
                      className="oc-input"
                    />
                  </div>

                  <div className="grid gap-2">
                    <label htmlFor="bkont" className="text-sm font-semibold text-slate-700">
                      {tSupplier("bkont")}
                    </label>
                    <input
                      id="bkont"
                      name="bkont"
                      maxLength={2}
                      autoComplete="off"
                      className="oc-input"
                    />
                  </div>

                  <div className="grid gap-2">
                    <label htmlFor="accname" className="text-sm font-semibold text-slate-700">
                      {tSupplier("accname")}
                    </label>
                    <input
                      id="accname"
                      name="accname"
                      maxLength={40}
                      required
                      className="oc-input"
                    />
                  </div>

                  <div className="grid gap-2">
                    <label htmlFor="bkValidFrom" className="text-sm font-semibold text-slate-700">
                      {tSupplier("bkValidFrom")}
                    </label>
                    <input
                      id="bkValidFrom"
                      name="bkValidFrom"
                      type="date"
                      required
                      className="oc-input"
                    />
                  </div>

                  <div className="grid gap-2">
                    <label htmlFor="bkValidTo" className="text-sm font-semibold text-slate-700">
                      {tSupplier("bkValidTo")}
                    </label>
                    <input
                      id="bkValidTo"
                      name="bkValidTo"
                      type="date"
                      required
                      className="oc-input"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="sm:col-span-2">
              <h3 className="text-sm font-semibold uppercase tracking-[0.08em] text-slate-600">{tSupplier("requiredDocsTitle")}</h3>
              <p className="mt-1 text-xs text-slate-500">{tSupplier("requiredDocsSubtitle")}</p>
            </div>

            {requirements.map((document) => (
              <div key={document.code} className="grid gap-2 sm:col-span-2">
                <label htmlFor={`documentFiles.${document.code}`} className="text-sm font-semibold text-slate-700">
                  {document.code} - {requirementLevelLabels[document.requirementLevel] ?? requirementLevelLabels.not_applicable}
                </label>
                <input
                  id={`documentFiles.${document.code}`}
                  name={`documentFiles.${document.code}`}
                  type="file"
                  multiple
                  required={document.requirementLevel === "mandatory"}
                  className="oc-input text-sm text-slate-700 file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-[var(--cta)] file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-white hover:file:bg-[var(--cta-strong)]"
                />
              </div>
            ))}

            <div className="flex items-end">
              <SubmitButton
                label={tSupplier("submit")}
                pendingLabel={tSupplier("submitting")}
                className="oc-btn oc-btn-primary w-full disabled:opacity-60"
              />
            </div>
          </form>
        </SectionCard>

        <SectionCard title={tSupplier("requiredDocsTitle")} subtitle={tSupplier("requiredDocsSubtitle")}>
          <ul className="grid gap-2 text-sm text-slate-700">
            {requirements.map((document) => (
              <li key={document.code} className="rounded-md border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2">
                <span className="font-semibold text-slate-900">{document.code}</span> - {requirementLevelLabels[document.requirementLevel] ?? requirementLevelLabels.not_applicable}
              </li>
            ))}
          </ul>
        </SectionCard>
      </div>
    </main>
  );
}
