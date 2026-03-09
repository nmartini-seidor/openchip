import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { onboardingInitiatorRoles } from "@openchip/shared";
import { createCaseAction } from "@/app/actions";
import { CategoryRequirementsSelector } from "@/components/category-requirements-selector";
import { NewCaseSubmitButton } from "@/components/new-case-submit-button";
import { SectionCard } from "@/components/section-card";
import { SupplierCoreFields } from "@/components/supplier-core-fields";
import { requireSessionRole } from "@/lib/auth";
import { onboardingRepository } from "@/lib/repository";

interface NewCasePageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function firstSearchParamValue(value: string | string[] | undefined): string | null {
  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value) && value.length > 0) {
    return value[0] ?? null;
  }

  return null;
}

export default async function NewCasePage({ searchParams }: NewCasePageProps) {
  const [, categories, previewsByCategory, t, resolvedSearchParams] = await Promise.all([
    requireSessionRole(onboardingInitiatorRoles),
    onboardingRepository.listSupplierCategories(false),
    onboardingRepository.listRequirementPreviewsForActiveCategories(),
    getTranslations("NewCase"),
    searchParams
  ]);

  const errorCode = firstSearchParamValue(resolvedSearchParams.error);
  const errorMessageByCode: Record<string, string> = {
    validation: t("errors.validation"),
    "duplicate-vat": t("errors.duplicateVat"),
    unknown: t("errors.unknown")
  };
  const errorMessage = errorCode !== null ? errorMessageByCode[errorCode] ?? t("errors.unknown") : null;

  return (
    <main id="main-content" className="w-full space-y-4">
      <div className="flex items-center">
        <Link
          href="/"
          className="oc-btn oc-btn-secondary"
        >
          <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="m12.5 4.5-5 5 5 5" />
          </svg>
          {t("goBack")}
        </Link>
      </div>

      <form id="new-case-form" action={createCaseAction}>
        <SectionCard
          title={t("title")}
          subtitle={t("subtitle")}
          headerAction={
            <NewCaseSubmitButton
              formId="new-case-form"
              label={
                <span className="inline-flex items-center gap-2">
                  <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6">
                    <path d="M10 4v12M4 10h12" />
                  </svg>
                  {t("createCase")}
                </span>
              }
              pendingLabel={t("creatingCase")}
              className="oc-btn oc-btn-primary disabled:cursor-not-allowed disabled:opacity-60"
            />
          }
        >
          {errorMessage !== null ? (
            <p className="mb-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">{errorMessage}</p>
          ) : null}
          <div className="grid gap-4 lg:grid-cols-2">
            <SupplierCoreFields
              labels={{
                supplierName: t("supplierName"),
                supplierVat: t("supplierVat"),
                supplierContactName: t("supplierContactName"),
                supplierContactEmail: t("supplierContactEmail")
              }}
            />

            <CategoryRequirementsSelector categories={categories} previewsByCategory={previewsByCategory} />
          </div>
        </SectionCard>
      </form>
    </main>
  );
}
