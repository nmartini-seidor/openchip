import { getTranslations } from "next-intl/server";
import { documentCatalog, fundingTypes, locationTypes } from "@openchip/shared";
import {
  createSupplierCategoryAction,
  createSupplierTypeAction,
  setSupplierCategoryStatusAction,
  setSupplierTypeStatusAction,
  updatePortalSettingsAction,
  updateRequirementMatrixAction
} from "@/app/actions";
import { SectionCard } from "@/components/section-card";
import { SubmitButton } from "@/components/submit-button";
import { requireSessionRole } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import { onboardingRepository } from "@/lib/repository";

function formatEnumLabel(value: string): string {
  return value
    .replaceAll("_", " ")
    .split(" ")
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(" ");
}

export default async function PortalSettingsPage({
  searchParams
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  await requireSessionRole(["admin"]);

  const [{ category: selectedCategoryParam }, settings, types, categories, tPortal, tCommon] = await Promise.all([
    searchParams,
    onboardingRepository.getPortalSettings(),
    onboardingRepository.listSupplierTypes(true),
    onboardingRepository.listSupplierCategories(true),
    getTranslations("PortalSettings"),
    getTranslations("Common")
  ]);

  const requirementLevelLabels: Record<string, string> = {
    mandatory: tCommon("requirementLevel.mandatory"),
    optional: tCommon("requirementLevel.optional"),
    not_applicable: tCommon("requirementLevel.notApplicable")
  };

  const activeTypes = types.filter((type) => type.active);
  const selectedCategory = categories.find((category) => category.code === selectedCategoryParam) ?? categories[0] ?? null;

  const matrixRows =
    selectedCategory !== null
      ? await onboardingRepository.listRequirementMatrixEntries(selectedCategory.code)
      : [];

  const matrixByDocumentCode = new Map(matrixRows.map((row) => [row.documentCode, row]));

  return (
    <main id="main-content" className="w-full space-y-5">
      <SectionCard title={tPortal("title")} subtitle={tPortal("subtitle")}>
        <form action={updatePortalSettingsAction} className="grid gap-4 md:grid-cols-2">
          <div className="grid gap-2">
            <label htmlFor="invitationOpenHours" className="text-sm font-semibold text-slate-700">
              {tPortal("invitationOpenHours")}
            </label>
            <input
              id="invitationOpenHours"
              name="invitationOpenHours"
              required
              type="number"
              min={1}
              max={168}
              defaultValue={settings.invitationOpenHours}
              className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-slate-900"
            />
          </div>

          <div className="grid gap-2">
            <label htmlFor="onboardingCompletionDays" className="text-sm font-semibold text-slate-700">
              {tPortal("onboardingCompletionDays")}
            </label>
            <input
              id="onboardingCompletionDays"
              name="onboardingCompletionDays"
              required
              type="number"
              min={1}
              max={90}
              defaultValue={settings.onboardingCompletionDays}
              className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-slate-900"
            />
          </div>

          <div className="md:col-span-2">
            <SubmitButton
              label={tPortal("saveSettings")}
              pendingLabel={tPortal("savingSettings")}
              className="inline-flex items-center rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--primary-strong)]"
            />
          </div>
        </form>
      </SectionCard>

      <SectionCard title={tPortal("supplierTypes.title")} subtitle={tPortal("supplierTypes.subtitle")}>
        <div className="space-y-3">
          {types.map((type) => (
            <form key={type.id} action={setSupplierTypeStatusAction} className="grid gap-3 rounded-md border border-[var(--border)] bg-[var(--surface-muted)] p-3 md:grid-cols-[1fr_auto] md:items-end">
              <div>
                <p className="text-sm font-semibold text-slate-900">{type.label}</p>
                <p className="text-xs text-slate-500">
                  {tPortal("supplierTypes.key")}: {type.key}
                </p>
                <p className="text-xs text-slate-500">
                  {tPortal("supplierTypes.status")}: {type.active ? tPortal("supplierTypes.active") : tPortal("supplierTypes.inactive")}
                </p>
              </div>
              <div>
                <input type="hidden" name="typeId" value={type.id} />
                <input type="hidden" name="active" value={type.active ? "false" : "true"} />
                <SubmitButton
                  label={type.active ? tPortal("supplierTypes.deactivate") : tPortal("supplierTypes.activate")}
                  pendingLabel={tPortal("supplierTypes.saving")}
                  className="inline-flex items-center rounded-md border border-[var(--border-strong)] bg-[var(--surface)] px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-[var(--surface-subtle)]"
                />
              </div>
            </form>
          ))}

          <form action={createSupplierTypeAction} className="grid gap-3 rounded-md border border-[var(--border)] bg-[var(--surface-muted)] p-3 md:grid-cols-[1fr_auto] md:items-end">
            <div className="grid gap-1">
              <label htmlFor="supplierTypeLabel" className="text-sm font-semibold text-slate-700">
                {tPortal("supplierTypes.newTypeLabel")}
              </label>
              <input
                id="supplierTypeLabel"
                name="label"
                required
                placeholder={tPortal("supplierTypes.newTypePlaceholder")}
                className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-slate-900"
              />
            </div>
            <SubmitButton
              label={tPortal("supplierTypes.addType")}
              pendingLabel={tPortal("supplierTypes.addingType")}
              className="inline-flex items-center rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--primary-strong)]"
            />
          </form>
        </div>
      </SectionCard>

      <SectionCard title={tPortal("supplierCategories.title")} subtitle={tPortal("supplierCategories.subtitle")}>
        <div className="space-y-3">
          {categories.map((category) => (
            <form key={category.code} action={setSupplierCategoryStatusAction} className="grid gap-3 rounded-md border border-[var(--border)] bg-[var(--surface-muted)] p-3 md:grid-cols-[1.6fr_auto] md:items-end">
              <div>
                <p className="text-sm font-semibold text-slate-900">{category.label}</p>
                <p className="text-xs text-slate-500">
                  {category.code} · {formatEnumLabel(category.funding)} · {category.typeLabel} · {formatEnumLabel(category.location)}
                </p>
                <p className="text-xs text-slate-500">
                  {tPortal("supplierCategories.status")}: {category.active ? tPortal("supplierCategories.active") : tPortal("supplierCategories.inactive")}
                </p>
              </div>
              <div>
                <input type="hidden" name="categoryCode" value={category.code} />
                <input type="hidden" name="active" value={category.active ? "false" : "true"} />
                <SubmitButton
                  label={category.active ? tPortal("supplierCategories.deactivate") : tPortal("supplierCategories.activate")}
                  pendingLabel={tPortal("supplierCategories.saving")}
                  className="inline-flex items-center rounded-md border border-[var(--border-strong)] bg-[var(--surface)] px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-[var(--surface-subtle)]"
                />
              </div>
            </form>
          ))}

          <form action={createSupplierCategoryAction} className="grid gap-3 rounded-md border border-[var(--border)] bg-[var(--surface-muted)] p-3 md:grid-cols-2">
            <div className="grid gap-1">
              <label htmlFor="categoryFunding" className="text-sm font-semibold text-slate-700">
                {tPortal("supplierCategories.funding")}
              </label>
              <select
                id="categoryFunding"
                name="funding"
                required
                defaultValue={fundingTypes[0]}
                className="oc-select rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-slate-900"
              >
                {fundingTypes.map((funding) => (
                  <option key={funding} value={funding}>
                    {formatEnumLabel(funding)}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-1">
              <label htmlFor="categoryType" className="text-sm font-semibold text-slate-700">
                {tPortal("supplierCategories.type")}
              </label>
              <select
                id="categoryType"
                name="typeId"
                required
                className="oc-select rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-slate-900"
              >
                {activeTypes.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-1">
              <label htmlFor="categoryLocation" className="text-sm font-semibold text-slate-700">
                {tPortal("supplierCategories.location")}
              </label>
              <select
                id="categoryLocation"
                name="location"
                required
                defaultValue={locationTypes[0]}
                className="oc-select rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-slate-900"
              >
                {locationTypes.map((location) => (
                  <option key={location} value={location}>
                    {formatEnumLabel(location)}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-1">
              <label htmlFor="categoryLabel" className="text-sm font-semibold text-slate-700">
                {tPortal("supplierCategories.displayLabel")}
              </label>
              <input
                id="categoryLabel"
                name="label"
                required
                placeholder={tPortal("supplierCategories.displayLabelPlaceholder")}
                className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-slate-900"
              />
            </div>

            <div className="md:col-span-2">
              <SubmitButton
                label={tPortal("supplierCategories.addCategory")}
                pendingLabel={tPortal("supplierCategories.addingCategory")}
                className="inline-flex items-center rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--primary-strong)]"
              />
            </div>
          </form>
        </div>
      </SectionCard>

      <SectionCard title={tPortal("requirementMatrix.title")} subtitle={tPortal("requirementMatrix.subtitle")}>
        {categories.length === 0 ? (
          <p className="text-sm text-slate-600">{tPortal("requirementMatrix.empty")}</p>
        ) : (
          <div className="space-y-4">
            <form method="get" className="grid gap-3 rounded-md border border-[var(--border)] bg-[var(--surface-muted)] p-3 md:grid-cols-[1fr_auto] md:items-end">
              <div className="grid gap-1">
                <label htmlFor="selectedCategory" className="text-sm font-semibold text-slate-700">
                  {tPortal("requirementMatrix.category")}
                </label>
                <select
                  id="selectedCategory"
                  name="category"
                  required
                  defaultValue={selectedCategory?.code ?? ""}
                  className="oc-select rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-slate-900"
                >
                  {categories.map((category) => (
                    <option key={category.code} value={category.code}>
                      {category.code} - {category.label}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="submit"
                className="inline-flex cursor-pointer items-center justify-center rounded-md border border-[var(--border-strong)] bg-[var(--surface)] px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-[var(--surface-subtle)]"
              >
                {tPortal("requirementMatrix.loadCategory")}
              </button>
            </form>

            {selectedCategory !== null ? (
              <>
                <p className="text-xs text-slate-500">
                  {tPortal("requirementMatrix.editing")}: <span className="font-semibold text-slate-700">{selectedCategory.code}</span> (
                  {formatEnumLabel(selectedCategory.funding)} / {selectedCategory.typeLabel} / {formatEnumLabel(selectedCategory.location)})
                </p>
                <div className="overflow-x-auto">
                  <table className="min-w-full border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-[var(--border)] text-left text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                        <th className="py-2 pr-3">{tPortal("requirementMatrix.document")}</th>
                        <th className="py-2 pr-3">Code</th>
                        <th className="py-2 pr-3">{tPortal("requirementMatrix.level")}</th>
                        <th className="py-2 pr-3">{tPortal("requirementMatrix.action")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {documentCatalog.map((document) => {
                        const matrixEntry = matrixByDocumentCode.get(document.code);
                        const currentLevel = matrixEntry?.requirementLevel ?? "not_applicable";

                        return (
                          <tr key={document.code} className="border-b border-[var(--border)]/70 align-top">
                            <td className="py-2 pr-3 text-slate-700">{document.name}</td>
                            <td className="py-2 pr-3 font-semibold text-slate-900">{document.code}</td>
                            <td className="py-2 pr-3 text-slate-700">{requirementLevelLabels[currentLevel]}</td>
                            <td className="py-2 pr-3">
                              <form action={updateRequirementMatrixAction} className="flex flex-wrap items-center gap-2 lg:flex-nowrap">
                                <input type="hidden" name="categoryCode" value={selectedCategory.code} />
                                <input type="hidden" name="documentCode" value={document.code} />
                                <select
                                  name="requirementLevel"
                                  defaultValue={currentLevel}
                                  aria-label={`Requirement level for ${document.code}`}
                                  className="oc-select rounded-md border border-[var(--border)] px-2 py-1 pr-8 text-xs"
                                >
                                  <option value="mandatory">{tCommon("requirementLevel.mandatory")}</option>
                                  <option value="optional">{tCommon("requirementLevel.optional")}</option>
                                  <option value="not_applicable">{tCommon("requirementLevel.notApplicable")}</option>
                                </select>
                                <SubmitButton
                                  label={tPortal("requirementMatrix.save")}
                                  pendingLabel={tPortal("requirementMatrix.saving")}
                                  className="rounded-md border border-[var(--border-strong)] bg-[var(--surface)] px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-[var(--surface-muted)] disabled:opacity-60"
                                />
                              </form>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            ) : null}
          </div>
        )}
      </SectionCard>

      <SectionCard title={tPortal("policy.title")} subtitle={tPortal("policy.subtitle")}>
        <dl className="grid gap-2 text-sm text-slate-700 md:grid-cols-2">
          <div className="rounded-md border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2">
            <dt className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">{tPortal("policy.invitationSla")}</dt>
            <dd className="mt-1 text-lg font-semibold text-slate-900">
              {settings.invitationOpenHours} {tPortal("policy.hours")}
            </dd>
          </div>
          <div className="rounded-md border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2">
            <dt className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">{tPortal("policy.completionSla")}</dt>
            <dd className="mt-1 text-lg font-semibold text-slate-900">
              {settings.onboardingCompletionDays} {tPortal("policy.days")}
            </dd>
          </div>
          <div className="rounded-md border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 md:col-span-2">
            <dt className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">{tPortal("policy.lastUpdate")}</dt>
            <dd className="mt-1 text-sm text-slate-900">
              {formatDateTime(settings.updatedAt)} {tPortal("policy.by")} {settings.updatedBy}
            </dd>
          </div>
        </dl>
      </SectionCard>
    </main>
  );
}
