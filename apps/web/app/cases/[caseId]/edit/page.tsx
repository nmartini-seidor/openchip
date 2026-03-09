import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { onboardingInitiatorRoles } from "@openchip/shared";
import { updateSupplierInfoAction } from "@/app/actions";
import { NewCaseSubmitButton } from "@/components/new-case-submit-button";
import { SectionCard } from "@/components/section-card";
import { SupplierCoreFields } from "@/components/supplier-core-fields";
import { requireSessionRole } from "@/lib/auth";
import { onboardingRepository } from "@/lib/repository";

interface EditCasePageProps {
  params: Promise<{ caseId: string }>;
}

export default async function EditCasePage({ params }: EditCasePageProps) {
  await requireSessionRole(onboardingInitiatorRoles);

  const { caseId } = await params;

  const [onboardingCase, tEdit, tNew, tCase] = await Promise.all([
    onboardingRepository.getCase(caseId),
    getTranslations("EditCase"),
    getTranslations("NewCase"),
    getTranslations("CaseDetails")
  ]);

  if (onboardingCase === null) {
    redirect("/");
  }

  if (onboardingCase.status === "supplier_created_in_sap" || onboardingCase.status === "cancelled") {
    redirect(`/cases/${caseId}?toast=supplier_info_update_locked`);
  }

  const supplierCategory = await onboardingRepository.getSupplierCategory(onboardingCase.categoryCode);
  const categoryLabel = supplierCategory?.label ?? onboardingCase.categoryCode;

  return (
    <main id="main-content" className="w-full space-y-4">
      <div className="flex items-center">
        <Link
          href={`/cases/${caseId}`}
          className="oc-btn oc-btn-secondary"
        >
          <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="m12.5 4.5-5 5 5 5" />
          </svg>
          {tEdit("goBack")}
        </Link>
      </div>

      <form id="edit-supplier-form" action={updateSupplierInfoAction}>
        <input type="hidden" name="caseId" value={caseId} />
        <SectionCard
          title={tEdit("title")}
          subtitle={tEdit("subtitle")}
          headerAction={
            <NewCaseSubmitButton
              formId="edit-supplier-form"
              label={
                <span className="inline-flex items-center gap-2">
                  <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6">
                    <path d="m4 10 4 4 8-8" />
                  </svg>
                  {tEdit("save")}
                </span>
              }
              pendingLabel={tEdit("saving")}
              className="oc-btn oc-btn-primary disabled:cursor-not-allowed disabled:opacity-60"
            />
          }
        >
          <div className="grid gap-4 lg:grid-cols-2">
            <SupplierCoreFields
              labels={{
                supplierName: tNew("supplierName"),
                supplierVat: tNew("supplierVat"),
                supplierContactName: tNew("supplierContactName"),
                supplierContactEmail: tNew("supplierContactEmail")
              }}
              initialValues={{
                supplierName: onboardingCase.supplierName,
                supplierVat: onboardingCase.supplierVat,
                supplierContactName: onboardingCase.supplierContactName,
                supplierContactEmail: onboardingCase.supplierContactEmail
              }}
            />

            <div className="grid gap-2 lg:col-span-2">
              <label htmlFor="categoryCodeReadonly" className="text-sm font-semibold text-slate-700">
                {tCase("metadata.supplierCategory")}
              </label>
              <input
                id="categoryCodeReadonly"
                value={`${onboardingCase.categoryCode} - ${categoryLabel}`}
                readOnly
                className="oc-input bg-[var(--surface-muted)] text-slate-600"
              />
            </div>
          </div>
        </SectionCard>
      </form>
    </main>
  );
}
