import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { FileCog, ListTree, Plus, Power, PowerOff, Save, Settings2, TableProperties, Trash2, Upload, Download } from "lucide-react";
import { fundingTypes, locationTypes } from "@openchip/shared";
import {
  clearDocumentTemplateAction,
  createDocumentDefinitionAction,
  createSupplierCategoryAction,
  createSupplierTypeAction,
  saveRequirementMatrixChangesAction,
  setDocumentDefinitionStatusAction,
  setSupplierCategoryStatusAction,
  setSupplierTypeStatusAction,
  updateDocumentDefinitionAction,
  updatePortalSettingsAction,
  uploadDocumentTemplateAction
} from "@/app/actions";
import { RequirementMatrixCategorySelect } from "@/components/requirement-matrix-category-select";
import { RequirementMatrixSaveButton } from "@/components/requirement-matrix-save-button";
import { SectionCard } from "@/components/section-card";
import { SubmitButton } from "@/components/submit-button";
import { requireSessionRole } from "@/lib/auth";
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

const settingsTabs = ["portal", "categories", "documents", "matrix"] as const;
type SettingsTab = (typeof settingsTabs)[number];

const iconOnlyButtonClass = "oc-btn oc-btn-compact h-8 w-8 p-0";

function resolveSettingsTab(candidate: string | undefined): SettingsTab {
  if (settingsTabs.includes(candidate as SettingsTab)) {
    return candidate as SettingsTab;
  }
  return "portal";
}

function buildSettingsTabHref(tab: SettingsTab, selectedCategoryCode: string | null): string {
  const params = new URLSearchParams();
  params.set("tab", tab);
  if (tab === "matrix" && selectedCategoryCode !== null) {
    params.set("category", selectedCategoryCode);
  }
  return `/portal-settings?${params.toString()}`;
}

function tabIcon(tab: SettingsTab) {
  if (tab === "portal") {
    return <Settings2 aria-hidden="true" className="h-4 w-4" strokeWidth={1.8} />;
  }
  if (tab === "categories") {
    return <ListTree aria-hidden="true" className="h-4 w-4" strokeWidth={1.8} />;
  }
  if (tab === "documents") {
    return <FileCog aria-hidden="true" className="h-4 w-4" strokeWidth={1.8} />;
  }
  return <TableProperties aria-hidden="true" className="h-4 w-4" strokeWidth={1.8} />;
}

function getLocalizedDocumentLabel(
  locale: string,
  labelEn: string,
  labelEs: string
): string {
  if (locale.startsWith("es")) {
    return labelEs.trim().length > 0 ? labelEs : labelEn;
  }

  return labelEn.trim().length > 0 ? labelEn : labelEs;
}

export default async function PortalSettingsPage({
  searchParams
}: {
  searchParams: Promise<{ tab?: string; category?: string }>;
}) {
  await requireSessionRole(["admin"]);

  const [locale, { category: selectedCategoryParam, tab: selectedTabParam }, settings, types, categories, documents, tPortal, tCommon] =
    await Promise.all([
      getLocale(),
      searchParams,
      onboardingRepository.getPortalSettings(),
      onboardingRepository.listSupplierTypes(true),
      onboardingRepository.listSupplierCategories(true),
      onboardingRepository.listDocumentDefinitions(true),
      getTranslations("PortalSettings"),
      getTranslations("Common")
    ]);

  const selectedTab = resolveSettingsTab(selectedTabParam);
  const activeTypes = types.filter((type) => type.active);
  const selectedCategory = categories.find((category) => category.code === selectedCategoryParam) ?? categories[0] ?? null;

  const matrixRows =
    selectedTab === "matrix" && selectedCategory !== null
      ? await onboardingRepository.listRequirementMatrixEntries(selectedCategory.code)
      : [];
  const matrixByDocumentCode = new Map(matrixRows.map((row) => [row.documentCode, row]));

  return (
    <main id="main-content" className="w-full space-y-5">
      <SectionCard title={tPortal("title")} subtitle={tPortal("subtitle")}>
        <nav className="flex flex-wrap gap-2" aria-label={tPortal("tabs.navigationLabel")}>
          {settingsTabs.map((tab) => (
            <Link
              key={tab}
              href={buildSettingsTabHref(tab, selectedCategory?.code ?? null)}
              className={`oc-btn oc-btn-compact ${
                selectedTab === tab
                  ? "border-[var(--border-strong)] bg-[var(--surface-subtle)] text-slate-900"
                  : "border-[var(--border)] bg-[var(--surface)] text-slate-600 hover:bg-[var(--surface-muted)]"
              }`}
            >
              {tabIcon(tab)}
              {tPortal(`tabs.${tab}`)}
            </Link>
          ))}
        </nav>
      </SectionCard>

      {selectedTab === "portal" ? (
        <SectionCard title={tPortal("tabs.portal")} subtitle={tPortal("portal.subtitle")}>
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

            <div className="md:col-span-2 mt-1 rounded-md border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2">
              <h3 className="text-sm font-semibold text-slate-900">{tPortal("integrationsTitle")}</h3>
              <p className="mt-1 text-xs text-slate-600">{tPortal("integrationsSubtitle")}</p>
            </div>

            <div className="grid gap-2">
              <label htmlFor="sapBaseUrl" className="text-sm font-semibold text-slate-700">
                {tPortal("sapBaseUrl")}
              </label>
              <input id="sapBaseUrl" name="sapBaseUrl" required type="url" defaultValue={settings.sapBaseUrl} className="oc-input" />
            </div>

            <div className="grid gap-2">
              <label htmlFor="sapApiKey" className="text-sm font-semibold text-slate-700">
                {tPortal("sapApiKey")}
              </label>
              <input id="sapApiKey" name="sapApiKey" required defaultValue={settings.sapApiKey} className="oc-input" />
            </div>

            <div className="grid gap-2">
              <label htmlFor="docuwareBaseUrl" className="text-sm font-semibold text-slate-700">
                {tPortal("docuwareBaseUrl")}
              </label>
              <input
                id="docuwareBaseUrl"
                name="docuwareBaseUrl"
                required
                type="url"
                defaultValue={settings.docuwareBaseUrl}
                className="oc-input"
              />
            </div>

            <div className="grid gap-2">
              <label htmlFor="docuwareApiKey" className="text-sm font-semibold text-slate-700">
                {tPortal("docuwareApiKey")}
              </label>
              <input id="docuwareApiKey" name="docuwareApiKey" required defaultValue={settings.docuwareApiKey} className="oc-input" />
            </div>

            <div className="md:col-span-2">
              <SubmitButton
                label={
                  <>
                    <Save aria-hidden="true" className="h-4 w-4" strokeWidth={1.8} />
                    {tPortal("saveSettings")}
                  </>
                }
                pendingLabel={tPortal("savingSettings")}
                className="oc-btn oc-btn-primary"
              />
            </div>
          </form>
        </SectionCard>
      ) : null}

      {selectedTab === "categories" ? (
        <SectionCard title={tPortal("tabs.categories")} subtitle={tPortal("supplierCategories.subtitle")}>
          <div className="space-y-6">
            <section>
              <header className="mb-2">
                <h3 className="text-sm font-semibold text-slate-900">{tPortal("supplierTypes.title")}</h3>
                <p className="text-xs text-slate-600">{tPortal("supplierTypes.subtitle")}</p>
              </header>
              <div className="overflow-x-auto">
                <table className="min-w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border)] text-left text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                      <th className="py-2 pr-3">{tPortal("supplierTypes.label")}</th>
                      <th className="py-2 pr-3">{tPortal("supplierTypes.key")}</th>
                      <th className="py-2 pr-3">{tPortal("supplierTypes.status")}</th>
                      <th className="py-2 pr-3">{tPortal("supplierTypes.action")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {types.map((type) => (
                      <tr key={type.id} className="border-b border-[var(--border)]/70 align-middle">
                        <td className="py-2 pr-3 font-semibold text-slate-900">{type.label}</td>
                        <td className="py-2 pr-3 text-slate-600">{type.key}</td>
                        <td className="py-2 pr-3">
                          <span
                            className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${
                              type.active
                                ? "border-emerald-300 bg-emerald-100 text-emerald-700"
                                : "border-slate-300 bg-slate-100 text-slate-600"
                            }`}
                          >
                            {type.active ? tPortal("supplierTypes.active") : tPortal("supplierTypes.inactive")}
                          </span>
                        </td>
                        <td className="py-2 pr-3">
                          <form action={setSupplierTypeStatusAction}>
                            <input type="hidden" name="typeId" value={type.id} />
                            <input type="hidden" name="active" value={type.active ? "false" : "true"} />
                            <SubmitButton
                              label={
                                <>
                                  {type.active ? (
                                    <PowerOff aria-hidden="true" className="h-4 w-4" strokeWidth={1.8} />
                                  ) : (
                                    <Power aria-hidden="true" className="h-4 w-4" strokeWidth={1.8} />
                                  )}
                                  {type.active ? tPortal("supplierTypes.deactivate") : tPortal("supplierTypes.activate")}
                                </>
                              }
                              pendingLabel={tPortal("supplierTypes.saving")}
                              className="oc-btn oc-btn-secondary oc-btn-compact"
                            />
                          </form>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-[var(--surface-muted)]">
                      <td className="py-2 pr-3">
                        <label htmlFor="supplierTypeLabel" className="sr-only">
                          {tPortal("supplierTypes.newTypeLabel")}
                        </label>
                        <input
                          form="create-supplier-type-form"
                          id="supplierTypeLabel"
                          name="label"
                          required
                          placeholder={tPortal("supplierTypes.newTypePlaceholder")}
                          className="oc-input oc-input-compact"
                        />
                      </td>
                      <td className="py-2 pr-3 text-slate-500 text-xs" colSpan={2}>
                        {tPortal("supplierTypes.newTypeLabel")}
                      </td>
                      <td className="py-2 pr-3">
                        <form id="create-supplier-type-form" action={createSupplierTypeAction}>
                          <SubmitButton
                            label={
                              <>
                                <Plus aria-hidden="true" className="h-4 w-4" strokeWidth={1.8} />
                                {tPortal("supplierTypes.addType")}
                              </>
                            }
                            pendingLabel={tPortal("supplierTypes.addingType")}
                            className="oc-btn oc-btn-primary oc-btn-compact"
                          />
                        </form>
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </section>

            <section>
              <header className="mb-2">
                <h3 className="text-sm font-semibold text-slate-900">{tPortal("supplierCategories.title")}</h3>
                <p className="text-xs text-slate-600">{tPortal("supplierCategories.subtitle")}</p>
              </header>
              <div className="overflow-x-auto">
                <table className="min-w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border)] text-left text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                      <th className="py-2 pr-3">Code</th>
                      <th className="py-2 pr-3">{tPortal("supplierCategories.funding")}</th>
                      <th className="py-2 pr-3">{tPortal("supplierCategories.type")}</th>
                      <th className="py-2 pr-3">{tPortal("supplierCategories.location")}</th>
                      <th className="py-2 pr-3">{tPortal("supplierCategories.displayLabel")}</th>
                      <th className="py-2 pr-3">{tPortal("supplierCategories.status")}</th>
                      <th className="py-2 pr-3">{tPortal("supplierCategories.action")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {categories.map((category) => (
                      <tr key={category.code} className="border-b border-[var(--border)]/70 align-middle">
                        <td className="py-2 pr-3 font-semibold text-slate-900">{category.code}</td>
                        <td className="py-2 pr-3 text-slate-700">{formatEnumLabel(category.funding)}</td>
                        <td className="py-2 pr-3 text-slate-700">{category.typeLabel}</td>
                        <td className="py-2 pr-3 text-slate-700">{formatEnumLabel(category.location)}</td>
                        <td className="py-2 pr-3 text-slate-700">{category.label}</td>
                        <td className="py-2 pr-3">
                          <span
                            className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${
                              category.active
                                ? "border-emerald-300 bg-emerald-100 text-emerald-700"
                                : "border-slate-300 bg-slate-100 text-slate-600"
                            }`}
                          >
                            {category.active ? tPortal("supplierCategories.active") : tPortal("supplierCategories.inactive")}
                          </span>
                        </td>
                        <td className="py-2 pr-3">
                          <form action={setSupplierCategoryStatusAction}>
                            <input type="hidden" name="categoryCode" value={category.code} />
                            <input type="hidden" name="active" value={category.active ? "false" : "true"} />
                            <SubmitButton
                              label={
                                <>
                                  {category.active ? (
                                    <PowerOff aria-hidden="true" className="h-4 w-4" strokeWidth={1.8} />
                                  ) : (
                                    <Power aria-hidden="true" className="h-4 w-4" strokeWidth={1.8} />
                                  )}
                                  {category.active ? tPortal("supplierCategories.deactivate") : tPortal("supplierCategories.activate")}
                                </>
                              }
                              pendingLabel={tPortal("supplierCategories.saving")}
                              className="oc-btn oc-btn-secondary oc-btn-compact"
                            />
                          </form>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-[var(--surface-muted)] align-middle">
                      <td className="py-2 pr-3 text-slate-500 text-xs">Auto</td>
                      <td className="py-2 pr-3">
                        <select
                          form="create-supplier-category-form"
                          id="categoryFunding"
                          name="funding"
                          required
                          defaultValue={fundingTypes[0]}
                          className="oc-input oc-input-compact oc-select"
                        >
                          {fundingTypes.map((funding) => (
                            <option key={funding} value={funding}>
                              {formatEnumLabel(funding)}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-2 pr-3">
                        <select form="create-supplier-category-form" id="categoryType" name="typeId" required className="oc-input oc-input-compact oc-select">
                          {activeTypes.map((type) => (
                            <option key={type.id} value={type.id}>
                              {type.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-2 pr-3">
                        <select
                          form="create-supplier-category-form"
                          id="categoryLocation"
                          name="location"
                          required
                          defaultValue={locationTypes[0]}
                          className="oc-input oc-input-compact oc-select"
                        >
                          {locationTypes.map((location) => (
                            <option key={location} value={location}>
                              {formatEnumLabel(location)}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-2 pr-3">
                        <label htmlFor="categoryLabel" className="sr-only">
                          {tPortal("supplierCategories.displayLabel")}
                        </label>
                        <input
                          form="create-supplier-category-form"
                          id="categoryLabel"
                          name="label"
                          required
                          placeholder={tPortal("supplierCategories.displayLabelPlaceholder")}
                          className="oc-input oc-input-compact"
                        />
                      </td>
                      <td className="py-2 pr-3 text-slate-500 text-xs">{tPortal("supplierCategories.active")}</td>
                      <td className="py-2 pr-3">
                        <form id="create-supplier-category-form" action={createSupplierCategoryAction}>
                          <SubmitButton
                            label={
                              <>
                                <Plus aria-hidden="true" className="h-4 w-4" strokeWidth={1.8} />
                                {tPortal("supplierCategories.addCategory")}
                              </>
                            }
                            pendingLabel={tPortal("supplierCategories.addingCategory")}
                            className="oc-btn oc-btn-primary oc-btn-compact"
                          />
                        </form>
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </section>
          </div>
        </SectionCard>
      ) : null}

      {selectedTab === "documents" ? (
        <SectionCard title={tPortal("tabs.documents")} subtitle={tPortal("documents.subtitle")}>
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-sm whitespace-nowrap">
              <thead>
                <tr className="border-b border-[var(--border)] text-left text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                  <th className="py-2 pr-3">{tPortal("documents.code")}</th>
                  <th className="py-2 pr-3">{tPortal("documents.labelEn")}</th>
                  <th className="py-2 pr-3">{tPortal("documents.labelEs")}</th>
                  <th className="py-2 pr-3">{tPortal("documents.type")}</th>
                  <th className="py-2 pr-3">{tPortal("documents.expiryPolicy")}</th>
                  <th className="py-2 pr-3">{tPortal("documents.owner")}</th>
                  <th className="py-2 pr-3">{tPortal("documents.blocksPurchaseOrdersShort")}</th>
                  <th className="py-2 pr-3">{tPortal("documents.status")}</th>
                  <th className="py-2 pr-3">{tPortal("documents.template")}</th>
                  <th className="py-2 pr-3">{tPortal("documents.action")}</th>
                </tr>
              </thead>
              <tbody>
                {documents.map((document) => {
                  const updateFormId = `update-document-${document.code}`;
                  return (
                    <tr key={document.code} className="border-b border-[var(--border)]/70 align-middle">
                      <td className="py-2 pr-3 font-semibold text-slate-900">{document.code}</td>
                      <td className="py-2 pr-3">
                        <input form={updateFormId} name="labelEn" defaultValue={document.labelEn} className="oc-input oc-input-compact min-w-44" />
                      </td>
                      <td className="py-2 pr-3">
                        <input form={updateFormId} name="labelEs" defaultValue={document.labelEs} className="oc-input oc-input-compact min-w-44" />
                      </td>
                      <td className="py-2 pr-3">
                        <select form={updateFormId} name="type" defaultValue={document.type} className="oc-input oc-input-compact oc-select min-w-36">
                          {documentTypeValues.map((value) => (
                            <option key={value} value={value}>
                              {formatEnumLabel(value)}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-2 pr-3">
                        <select form={updateFormId} name="expiryPolicy" defaultValue={document.expiryPolicy} className="oc-input oc-input-compact oc-select min-w-32">
                          {documentExpiryPolicyValues.map((value) => (
                            <option key={value} value={value}>
                              {formatEnumLabel(value)}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-2 pr-3">
                        <select form={updateFormId} name="owner" defaultValue={document.owner} className="oc-input oc-input-compact oc-select min-w-44">
                          {documentOwnerValues.map((value) => (
                            <option key={value} value={value}>
                              {formatEnumLabel(value)}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-2 pr-3">
                        <select
                          form={updateFormId}
                          name="blocksPurchaseOrders"
                          defaultValue={document.blocksPurchaseOrders ? "true" : "false"}
                          className="oc-input oc-input-compact oc-select min-w-24"
                        >
                          <option value="true">{tPortal("documents.yes")}</option>
                          <option value="false">{tPortal("documents.no")}</option>
                        </select>
                      </td>
                      <td className="py-2 pr-3">
                        <span
                          className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${
                            document.active
                              ? "border-emerald-300 bg-emerald-100 text-emerald-700"
                              : "border-slate-300 bg-slate-100 text-slate-600"
                          }`}
                        >
                          {document.active ? tPortal("documents.active") : tPortal("documents.inactive")}
                        </span>
                      </td>
                      <td className="py-2 pr-3">
                        <div className="flex items-center gap-2">
                          <form action={uploadDocumentTemplateAction} className="flex items-center gap-1">
                            <input type="hidden" name="code" value={document.code} />
                            <input type="file" name="templateFile" required className="oc-input oc-input-compact max-w-52 text-xs" />
                            <SubmitButton
                              label={
                                <>
                                  <Upload aria-hidden="true" className="h-4 w-4" strokeWidth={1.8} />
                                  <span className="sr-only">{tPortal("documents.uploadTemplate")}</span>
                                </>
                              }
                              pendingLabel={tPortal("documents.uploadingTemplate")}
                              className={`${iconOnlyButtonClass} oc-btn-secondary`}
                            />
                          </form>
                          {document.templateStoragePath !== null ? (
                            <>
                              <a
                                href={`/api/document-definitions/${document.code}/template`}
                                className={`${iconOnlyButtonClass} oc-btn-secondary`}
                                title={tPortal("documents.downloadTemplate")}
                                aria-label={tPortal("documents.downloadTemplate")}
                              >
                                <Download aria-hidden="true" className="h-4 w-4" strokeWidth={1.8} />
                              </a>
                              <form action={clearDocumentTemplateAction}>
                                <input type="hidden" name="code" value={document.code} />
                                <SubmitButton
                                  label={
                                    <>
                                      <Trash2 aria-hidden="true" className="h-4 w-4" strokeWidth={1.8} />
                                      <span className="sr-only">{tPortal("documents.clearTemplate")}</span>
                                    </>
                                  }
                                  pendingLabel={tPortal("documents.saving")}
                                  className={`${iconOnlyButtonClass} oc-btn-danger`}
                                />
                              </form>
                            </>
                          ) : (
                            <span className="text-xs text-slate-500">-</span>
                          )}
                        </div>
                      </td>
                      <td className="py-2 pr-3">
                        <div className="flex items-center gap-1">
                          <form id={updateFormId} action={updateDocumentDefinitionAction}>
                            <input type="hidden" name="code" value={document.code} />
                            <SubmitButton
                              label={
                                <>
                                  <Save aria-hidden="true" className="h-4 w-4" strokeWidth={1.8} />
                                  <span className="sr-only">{tPortal("documents.save")}</span>
                                </>
                              }
                              pendingLabel={tPortal("documents.saving")}
                              className={`${iconOnlyButtonClass} oc-btn-secondary`}
                            />
                          </form>
                          <form action={setDocumentDefinitionStatusAction}>
                            <input type="hidden" name="code" value={document.code} />
                            <input type="hidden" name="active" value={document.active ? "false" : "true"} />
                            <SubmitButton
                              label={
                                <>
                                  {document.active ? (
                                    <PowerOff aria-hidden="true" className="h-4 w-4" strokeWidth={1.8} />
                                  ) : (
                                    <Power aria-hidden="true" className="h-4 w-4" strokeWidth={1.8} />
                                  )}
                                  <span className="sr-only">
                                    {document.active ? tPortal("documents.deactivate") : tPortal("documents.activate")}
                                  </span>
                                </>
                              }
                              pendingLabel={tPortal("documents.saving")}
                              className={`${iconOnlyButtonClass} ${document.active ? "oc-btn-danger" : "oc-btn-secondary"}`}
                            />
                          </form>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-[var(--surface-muted)] align-middle">
                  <td className="py-2 pr-3">
                    <input
                      form="create-document-form"
                      id="newDocumentCode"
                      name="code"
                      placeholder="FIN-99"
                      required
                      className="oc-input oc-input-compact"
                    />
                  </td>
                  <td className="py-2 pr-3">
                    <input form="create-document-form" id="newDocumentLabelEn" name="labelEn" required className="oc-input oc-input-compact min-w-44" />
                  </td>
                  <td className="py-2 pr-3">
                    <input form="create-document-form" id="newDocumentLabelEs" name="labelEs" required className="oc-input oc-input-compact min-w-44" />
                  </td>
                  <td className="py-2 pr-3">
                    <select form="create-document-form" id="newDocumentType" name="type" defaultValue={documentTypeValues[0]} className="oc-input oc-input-compact oc-select min-w-36">
                      {documentTypeValues.map((value) => (
                        <option key={value} value={value}>
                          {formatEnumLabel(value)}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="py-2 pr-3">
                    <select
                      form="create-document-form"
                      id="newDocumentExpiry"
                      name="expiryPolicy"
                      defaultValue={documentExpiryPolicyValues[0]}
                      className="oc-input oc-input-compact oc-select min-w-32"
                    >
                      {documentExpiryPolicyValues.map((value) => (
                        <option key={value} value={value}>
                          {formatEnumLabel(value)}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="py-2 pr-3">
                    <select form="create-document-form" id="newDocumentOwner" name="owner" defaultValue={documentOwnerValues[0]} className="oc-input oc-input-compact oc-select min-w-44">
                      {documentOwnerValues.map((value) => (
                        <option key={value} value={value}>
                          {formatEnumLabel(value)}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="py-2 pr-3">
                    <select form="create-document-form" id="newDocumentBlocks" name="blocksPurchaseOrders" defaultValue="true" className="oc-input oc-input-compact oc-select min-w-24">
                      <option value="true">{tPortal("documents.yes")}</option>
                      <option value="false">{tPortal("documents.no")}</option>
                    </select>
                  </td>
                  <td className="py-2 pr-3 text-xs text-slate-500">{tPortal("documents.active")}</td>
                  <td className="py-2 pr-3 text-xs text-slate-500">-</td>
                  <td className="py-2 pr-3">
                    <form id="create-document-form" action={createDocumentDefinitionAction}>
                      <SubmitButton
                        label={
                          <>
                            <Plus aria-hidden="true" className="h-4 w-4" strokeWidth={1.8} />
                            {tPortal("documents.addDocument")}
                          </>
                        }
                        pendingLabel={tPortal("documents.addingDocument")}
                        className="oc-btn oc-btn-primary oc-btn-compact"
                      />
                    </form>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </SectionCard>
      ) : null}

      {selectedTab === "matrix" ? (
        <SectionCard title={tPortal("tabs.matrix")} subtitle={tPortal("requirementMatrix.subtitle")}>
          {categories.length === 0 ? (
            <p className="text-sm text-slate-600">{tPortal("requirementMatrix.empty")}</p>
          ) : selectedCategory !== null ? (
            <div className="space-y-4">
              <RequirementMatrixCategorySelect
                id="selectedCategory"
                label={tPortal("requirementMatrix.category")}
                selectedCategoryCode={selectedCategory.code}
                options={categories.map((category) => ({ code: category.code, label: category.label }))}
              />

              <p className="text-xs text-slate-500">
                {tPortal("requirementMatrix.editing")}: <span className="font-semibold text-slate-700">{selectedCategory.code}</span> (
                {formatEnumLabel(selectedCategory.funding)} / {selectedCategory.typeLabel} / {formatEnumLabel(selectedCategory.location)})
              </p>

              <form id="matrix-form" action={saveRequirementMatrixChangesAction} className="space-y-3">
                <input type="hidden" name="categoryCode" value={selectedCategory.code} />

                <div className="flex justify-end">
                  <RequirementMatrixSaveButton
                    formId="matrix-form"
                    label={
                      <>
                        <Save aria-hidden="true" className="h-4 w-4" strokeWidth={1.8} />
                        {tPortal("requirementMatrix.saveAll")}
                      </>
                    }
                    pendingLabel={tPortal("requirementMatrix.saving")}
                    className="oc-btn oc-btn-primary oc-btn-compact disabled:cursor-not-allowed disabled:opacity-60"
                  />
                </div>

                <div className="overflow-x-auto">
                  <table className="min-w-full border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-[var(--border)] text-left text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                        <th className="py-2 pr-3">{tPortal("requirementMatrix.document")}</th>
                        <th className="py-2 pr-3">Code</th>
                        <th className="py-2 pr-3">{tPortal("requirementMatrix.level")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {documents.map((document) => {
                        const matrixEntry = matrixByDocumentCode.get(document.code);
                        const currentLevel = matrixEntry?.requirementLevel ?? "not_applicable";
                        const localizedDocumentLabel = getLocalizedDocumentLabel(locale, document.labelEn, document.labelEs);
                        return (
                          <tr key={document.code} className="border-b border-[var(--border)]/70 align-middle">
                            <td className="py-2 pr-3 text-slate-700">
                              {localizedDocumentLabel}
                            </td>
                            <td className="py-2 pr-3 font-semibold text-slate-900">{document.code}</td>
                            <td className="py-2 pr-3">
                              <select
                                name={`requirementLevel__${document.code}`}
                                defaultValue={currentLevel}
                                data-matrix-input="1"
                                data-initial-value={currentLevel}
                                aria-label={`Requirement level for ${document.code}`}
                                className="oc-input oc-input-compact oc-select text-xs min-w-36"
                              >
                                <option value="mandatory">{tCommon("requirementLevel.mandatory")}</option>
                                <option value="optional">{tCommon("requirementLevel.optional")}</option>
                                <option value="not_applicable">{tCommon("requirementLevel.notApplicable")}</option>
                              </select>
                              <input type="hidden" name={`initialRequirementLevel__${document.code}`} value={currentLevel} />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="flex justify-end">
                  <RequirementMatrixSaveButton
                    formId="matrix-form"
                    label={
                      <>
                        <Save aria-hidden="true" className="h-4 w-4" strokeWidth={1.8} />
                        {tPortal("requirementMatrix.saveAll")}
                      </>
                    }
                    pendingLabel={tPortal("requirementMatrix.saving")}
                    className="oc-btn oc-btn-primary oc-btn-compact disabled:cursor-not-allowed disabled:opacity-60"
                  />
                </div>
              </form>
            </div>
          ) : null}
        </SectionCard>
      ) : null}
    </main>
  );
}
