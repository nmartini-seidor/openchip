import { getTranslations } from "next-intl/server";
import { fundingTypes, locationTypes } from "@openchip/shared";
import {
  clearDocumentTemplateAction,
  createDocumentDefinitionAction,
  createSupplierCategoryAction,
  createSupplierTypeAction,
  setDocumentDefinitionStatusAction,
  setSupplierCategoryStatusAction,
  setSupplierTypeStatusAction,
  updateDocumentDefinitionAction,
  updatePortalSettingsAction,
  uploadDocumentTemplateAction,
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

const documentTypeValues = ["internal", "external", "internal_or_external"] as const;
const documentExpiryPolicyValues = ["no_expiry", "annual", "monthly"] as const;
const documentOwnerValues = ["finance", "contracts_justifications", "compliance", "sustainability"] as const;

export default async function PortalSettingsPage({
  searchParams
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  await requireSessionRole(["admin"]);

  const [{ category: selectedCategoryParam }, settings, types, categories, documents, tPortal, tCommon] = await Promise.all([
    searchParams,
    onboardingRepository.getPortalSettings(),
    onboardingRepository.listSupplierTypes(true),
    onboardingRepository.listSupplierCategories(true),
    onboardingRepository.listDocumentDefinitions(true),
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
              className="oc-input"
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
              className="oc-input"
            />
          </div>

          <div className="md:col-span-2">
            <SubmitButton
              label={tPortal("saveSettings")}
              pendingLabel={tPortal("savingSettings")}
              className="oc-btn oc-btn-primary"
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
                  className="oc-btn oc-btn-secondary"
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
                className="oc-input"
              />
            </div>
            <SubmitButton
              label={tPortal("supplierTypes.addType")}
              pendingLabel={tPortal("supplierTypes.addingType")}
              className="oc-btn oc-btn-primary"
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
                  className="oc-btn oc-btn-secondary"
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
                className="oc-input oc-select"
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
                className="oc-input oc-select"
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
                className="oc-input oc-select"
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
                className="oc-input"
              />
            </div>

            <div className="md:col-span-2">
              <SubmitButton
                label={tPortal("supplierCategories.addCategory")}
                pendingLabel={tPortal("supplierCategories.addingCategory")}
                className="oc-btn oc-btn-primary"
              />
            </div>
          </form>
        </div>
      </SectionCard>

      <SectionCard title={tPortal("documents.title")} subtitle={tPortal("documents.subtitle")}>
        <div className="space-y-3">
          {documents.map((document) => (
            <div key={document.code} className="rounded-md border border-[var(--border)] bg-[var(--surface-muted)] p-3">
              <form action={updateDocumentDefinitionAction} className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <input type="hidden" name="code" value={document.code} />

                <div className="grid gap-1">
                  <label htmlFor={`labelEn-${document.code}`} className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                    {tPortal("documents.labelEn")}
                  </label>
                  <input id={`labelEn-${document.code}`} name="labelEn" defaultValue={document.labelEn} className="oc-input" />
                </div>

                <div className="grid gap-1">
                  <label htmlFor={`labelEs-${document.code}`} className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                    {tPortal("documents.labelEs")}
                  </label>
                  <input id={`labelEs-${document.code}`} name="labelEs" defaultValue={document.labelEs} className="oc-input" />
                </div>

                <div className="grid gap-1">
                  <label htmlFor={`type-${document.code}`} className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                    {tPortal("documents.type")}
                  </label>
                  <select id={`type-${document.code}`} name="type" defaultValue={document.type} className="oc-input oc-select">
                    {documentTypeValues.map((value) => (
                      <option key={value} value={value}>
                        {formatEnumLabel(value)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid gap-1">
                  <label htmlFor={`expiry-${document.code}`} className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                    {tPortal("documents.expiryPolicy")}
                  </label>
                  <select id={`expiry-${document.code}`} name="expiryPolicy" defaultValue={document.expiryPolicy} className="oc-input oc-select">
                    {documentExpiryPolicyValues.map((value) => (
                      <option key={value} value={value}>
                        {formatEnumLabel(value)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid gap-1">
                  <label htmlFor={`owner-${document.code}`} className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                    {tPortal("documents.owner")}
                  </label>
                  <select id={`owner-${document.code}`} name="owner" defaultValue={document.owner} className="oc-input oc-select">
                    {documentOwnerValues.map((value) => (
                      <option key={value} value={value}>
                        {formatEnumLabel(value)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid gap-1">
                  <label className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">{tPortal("documents.code")}</label>
                  <input value={document.code} readOnly className="oc-input bg-[var(--surface)] text-slate-600" />
                </div>

                <div className="grid gap-1">
                  <label className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">{tPortal("documents.status")}</label>
                  <p className="text-sm text-slate-700">
                    {document.active ? tPortal("documents.active") : tPortal("documents.inactive")}
                  </p>
                </div>

                <div className="grid gap-2">
                  <label htmlFor={`blocks-${document.code}`} className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                    {tPortal("documents.blocksPurchaseOrders")}
                  </label>
                  <select id={`blocks-${document.code}`} name="blocksPurchaseOrders" defaultValue={document.blocksPurchaseOrders ? "true" : "false"} className="oc-input oc-select">
                    <option value="true">{tPortal("documents.yes")}</option>
                    <option value="false">{tPortal("documents.no")}</option>
                  </select>
                </div>

                <div className="flex items-end justify-end">
                  <SubmitButton
                    label={tPortal("documents.save")}
                    pendingLabel={tPortal("documents.saving")}
                    className="oc-btn oc-btn-secondary"
                  />
                </div>
              </form>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <form action={setDocumentDefinitionStatusAction}>
                  <input type="hidden" name="code" value={document.code} />
                  <input type="hidden" name="active" value={document.active ? "false" : "true"} />
                  <SubmitButton
                    label={document.active ? tPortal("documents.deactivate") : tPortal("documents.activate")}
                    pendingLabel={tPortal("documents.saving")}
                    className="oc-btn oc-btn-secondary oc-btn-compact"
                  />
                </form>

                <form action={uploadDocumentTemplateAction} className="flex flex-wrap items-center gap-2">
                  <input type="hidden" name="code" value={document.code} />
                  <input type="file" name="templateFile" required className="oc-input max-w-xs text-sm" />
                  <SubmitButton
                    label={tPortal("documents.uploadTemplate")}
                    pendingLabel={tPortal("documents.uploadingTemplate")}
                    className="oc-btn oc-btn-secondary oc-btn-compact"
                  />
                </form>

                {document.templateStoragePath !== null ? (
                  <>
                    <a href={`/api/document-definitions/${document.code}/template`} className="oc-btn oc-btn-secondary oc-btn-compact">
                      {tPortal("documents.downloadTemplate")}
                    </a>
                    <form action={clearDocumentTemplateAction}>
                      <input type="hidden" name="code" value={document.code} />
                      <SubmitButton
                        label={tPortal("documents.clearTemplate")}
                        pendingLabel={tPortal("documents.saving")}
                        className="oc-btn oc-btn-danger oc-btn-compact"
                      />
                    </form>
                  </>
                ) : (
                  <p className="text-xs text-slate-500">{tPortal("documents.noTemplate")}</p>
                )}
              </div>
            </div>
          ))}

          <form action={createDocumentDefinitionAction} className="grid gap-3 rounded-md border border-[var(--border)] bg-[var(--surface-muted)] p-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="grid gap-1">
              <label htmlFor="newDocumentCode" className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                {tPortal("documents.code")}
              </label>
              <input id="newDocumentCode" name="code" placeholder="FIN-99" required className="oc-input" />
            </div>
            <div className="grid gap-1">
              <label htmlFor="newDocumentLabelEn" className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                {tPortal("documents.labelEn")}
              </label>
              <input id="newDocumentLabelEn" name="labelEn" required className="oc-input" />
            </div>
            <div className="grid gap-1">
              <label htmlFor="newDocumentLabelEs" className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                {tPortal("documents.labelEs")}
              </label>
              <input id="newDocumentLabelEs" name="labelEs" required className="oc-input" />
            </div>
            <div className="grid gap-1">
              <label htmlFor="newDocumentType" className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                {tPortal("documents.type")}
              </label>
              <select id="newDocumentType" name="type" defaultValue={documentTypeValues[0]} className="oc-input oc-select">
                {documentTypeValues.map((value) => (
                  <option key={value} value={value}>
                    {formatEnumLabel(value)}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-1">
              <label htmlFor="newDocumentExpiry" className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                {tPortal("documents.expiryPolicy")}
              </label>
              <select id="newDocumentExpiry" name="expiryPolicy" defaultValue={documentExpiryPolicyValues[0]} className="oc-input oc-select">
                {documentExpiryPolicyValues.map((value) => (
                  <option key={value} value={value}>
                    {formatEnumLabel(value)}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-1">
              <label htmlFor="newDocumentOwner" className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                {tPortal("documents.owner")}
              </label>
              <select id="newDocumentOwner" name="owner" defaultValue={documentOwnerValues[0]} className="oc-input oc-select">
                {documentOwnerValues.map((value) => (
                  <option key={value} value={value}>
                    {formatEnumLabel(value)}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-1">
              <label htmlFor="newDocumentBlocks" className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                {tPortal("documents.blocksPurchaseOrders")}
              </label>
              <select id="newDocumentBlocks" name="blocksPurchaseOrders" defaultValue="true" className="oc-input oc-select">
                <option value="true">{tPortal("documents.yes")}</option>
                <option value="false">{tPortal("documents.no")}</option>
              </select>
            </div>
            <div className="flex items-end justify-end">
              <SubmitButton
                label={tPortal("documents.addDocument")}
                pendingLabel={tPortal("documents.addingDocument")}
                className="oc-btn oc-btn-primary"
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
                  className="oc-input oc-select"
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
                className="oc-btn oc-btn-secondary"
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
                      {documents.map((document) => {
                        const matrixEntry = matrixByDocumentCode.get(document.code);
                        const currentLevel = matrixEntry?.requirementLevel ?? "not_applicable";

                        return (
                          <tr key={document.code} className="border-b border-[var(--border)]/70 align-top">
                            <td className="py-2 pr-3 text-slate-700">{document.labelEn} / {document.labelEs}</td>
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
                                  className="oc-input oc-input-compact oc-select text-xs"
                                >
                                  <option value="mandatory">{tCommon("requirementLevel.mandatory")}</option>
                                  <option value="optional">{tCommon("requirementLevel.optional")}</option>
                                  <option value="not_applicable">{tCommon("requirementLevel.notApplicable")}</option>
                                </select>
                                <SubmitButton
                                  label={tPortal("requirementMatrix.save")}
                                  pendingLabel={tPortal("requirementMatrix.saving")}
                                  className="oc-btn oc-btn-secondary oc-btn-compact disabled:opacity-60"
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
