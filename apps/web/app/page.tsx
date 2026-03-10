import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { CaseStatus, caseStatuses } from "@openchip/shared";
import { evaluateCompliance } from "@openchip/workflow";
import { requireSessionUser } from "@/lib/auth";
import { onboardingRepository } from "@/lib/repository";
import { countdownBadgeClass, getCountdown } from "@/lib/sla";
import { SectionCard } from "@/components/section-card";
import { StatusFilterSelect } from "@/components/status-filter-select";
import { StatusBadge } from "@/components/status-badge";
import { SupplierSearchFilter } from "@/components/supplier-search-filter";

function countByStatus(statuses: readonly string[], status: string): number {
  return statuses.filter((value) => value === status).length;
}

type SourceFilter = "all" | "manual" | "sap_pr";
type StatusFilter = "all" | CaseStatus;
type ComplianceFilter = "all" | "non_compliant";
const casesPerPage = 10;

function resolveSourceFilter(candidate: string | undefined): SourceFilter {
  if (candidate === "manual" || candidate === "sap_pr") {
    return candidate;
  }

  return "all";
}

function resolveStatusFilter(candidate: string | undefined): StatusFilter {
  if (candidate !== undefined && candidate.length > 0 && caseStatuses.includes(candidate as CaseStatus)) {
    return candidate as CaseStatus;
  }

  return "all";
}

function resolveSearchFilter(candidate: string | undefined): string {
  return candidate?.trim() ?? "";
}

function resolveComplianceFilter(candidate: string | undefined): ComplianceFilter {
  if (candidate === "non_compliant") {
    return candidate;
  }

  return "all";
}

function resolvePageNumber(candidate: string | undefined): number {
  const parsed = Number.parseInt(candidate ?? "1", 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return 1;
  }

  return parsed;
}

function buildOverviewHref(
  sourceFilter: SourceFilter,
  statusFilter: StatusFilter,
  searchFilter: string,
  pageNumber: number,
  complianceFilter: ComplianceFilter
): string {
  const params = new URLSearchParams();
  if (sourceFilter !== "all") {
    params.set("source", sourceFilter);
  }
  if (statusFilter !== "all") {
    params.set("status", statusFilter);
  }
  if (searchFilter.length > 0) {
    params.set("q", searchFilter);
  }
  if (complianceFilter !== "all") {
    params.set("compliance", complianceFilter);
  }
  if (pageNumber > 1) {
    params.set("page", pageNumber.toString());
  }
  const query = params.toString();
  return query.length > 0 ? `/?${query}` : "/";
}

function sortCases(left: { status: CaseStatus; updatedAt: string }, right: { status: CaseStatus; updatedAt: string }): number {
  const leftCompleted = left.status === "supplier_created_in_sap";
  const rightCompleted = right.status === "supplier_created_in_sap";

  if (leftCompleted !== rightCompleted) {
    return leftCompleted ? -1 : 1;
  }

  return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
}

function isNonCompliantCase(onboardingCase: { status: CaseStatus; documents: Parameters<typeof evaluateCompliance>[0] }): boolean {
  if (onboardingCase.status !== "supplier_created_in_sap") {
    return false;
  }

  return evaluateCompliance(onboardingCase.documents).blocked;
}

export default async function HomePage({
  searchParams
}: {
  searchParams: Promise<{ source?: string; status?: string; q?: string; page?: string; compliance?: string }>;
}) {
  await requireSessionUser();

  const [params, cases, tHome, tCommon, tSla, tStatus] = await Promise.all([
    searchParams,
    onboardingRepository.listCases(),
    getTranslations("Home"),
    getTranslations("Common"),
    getTranslations("Sla"),
    getTranslations("StatusBadge")
  ]);
  const sourceFilter = resolveSourceFilter(params.source);
  const statusFilter = resolveStatusFilter(params.status);
  const searchFilter = resolveSearchFilter(params.q);
  const complianceFilter = resolveComplianceFilter(params.compliance);
  const requestedPage = resolvePageNumber(params.page);
  const normalizedSearchFilter = searchFilter.toLowerCase();

  const filteredCases = cases.filter((onboardingCase) => {
    const matchesSource = sourceFilter === "all" || onboardingCase.sourceChannel === sourceFilter;
    const matchesStatus = statusFilter === "all" || onboardingCase.status === statusFilter;
    const matchesCompliance = complianceFilter === "all" || isNonCompliantCase(onboardingCase);
    const matchesSearch =
      normalizedSearchFilter.length === 0 ||
      onboardingCase.supplierName.toLowerCase().includes(normalizedSearchFilter) ||
      onboardingCase.supplierVat.toLowerCase().includes(normalizedSearchFilter);
    return matchesSource && matchesStatus && matchesCompliance && matchesSearch;
  });

  const orderedCases = [...filteredCases].sort(sortCases);
  const totalCases = orderedCases.length;
  const totalPages = Math.max(1, Math.ceil(totalCases / casesPerPage));
  const currentPage = Math.min(requestedPage, totalPages);
  const startIndex = (currentPage - 1) * casesPerPage;
  const pageCases = orderedCases.slice(startIndex, startIndex + casesPerPage);
  const showingFrom = totalCases === 0 ? 0 : startIndex + 1;
  const showingTo = startIndex + pageCases.length;

  const countdownLabels = {
    notStarted: tSla("notStarted"),
    completed: tSla("completed"),
    remaining: (duration: string) => duration,
    overdue: (duration: string) => tSla("overdue", { duration })
  };

  const statuses = cases.map((item) => item.status);
  const sapSourcedCases = cases.filter((item) => item.sourceChannel === "sap_pr").length;
  const statusOptions = caseStatuses.map((status) => ({
    value: status,
    label: tStatus(status)
  }));

  return (
    <main id="main-content" className="w-full space-y-5">
      <section className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <SectionCard title={tHome("overview.title")} subtitle={tHome("overview.subtitle")}>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{tHome("overview.totalCases")}</p>
              <p className="mt-2 text-3xl font-semibold text-slate-900 [font-variant-numeric:tabular-nums]">{cases.length}</p>
            </div>
            <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{tHome("overview.pendingValidation")}</p>
              <p className="mt-2 text-3xl font-semibold text-[var(--warning)] [font-variant-numeric:tabular-nums]">
                {countByStatus(statuses, "submission_completed")}
              </p>
            </div>
            <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{tHome("overview.createdInSap")}</p>
              <p className="mt-2 text-3xl font-semibold text-[var(--success)] [font-variant-numeric:tabular-nums]">
                {sapSourcedCases}
              </p>
            </div>
          </div>
        </SectionCard>

        <SectionCard title={tHome("quickActions.title")} subtitle={tHome("quickActions.subtitle")}>
          <div className="grid gap-2">
            <Link
              href="/cases/new"
              className="oc-btn oc-btn-primary"
            >
              {tHome("quickActions.createCase")}
            </Link>
            <p className="rounded-md border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-xs text-slate-600">
              {tHome("quickActions.helperText")}
            </p>
          </div>
        </SectionCard>
      </section>

      <SectionCard
        title={tHome("cases.title")}
        subtitle={tHome("cases.subtitle")}
        headerAction={
          <SupplierSearchFilter
            label={tHome("cases.filters.searchLabel")}
            placeholder={tHome("cases.filters.searchPlaceholder")}
            value={searchFilter}
          />
        }
      >
        <div className="mb-3 flex flex-wrap items-end gap-2">
          <Link
            href={buildOverviewHref("all", statusFilter, searchFilter, 1, complianceFilter)}
            className={`oc-btn oc-btn-compact ${
              sourceFilter === "all"
                ? "border-[var(--border-strong)] bg-[var(--surface-subtle)] text-slate-900"
                : "border-[var(--border)] bg-[var(--surface)] text-slate-600 hover:bg-[var(--surface-muted)]"
            }`}
          >
            {tHome("cases.filters.all")}
          </Link>
          <Link
            href={buildOverviewHref("sap_pr", statusFilter, searchFilter, 1, complianceFilter)}
            className={`oc-btn oc-btn-compact ${
              sourceFilter === "sap_pr"
                ? "border-[var(--border-strong)] bg-[var(--surface-subtle)] text-slate-900"
                : "border-[var(--border)] bg-[var(--surface)] text-slate-600 hover:bg-[var(--surface-muted)]"
            }`}
          >
            {tHome("cases.filters.sapPr")}
          </Link>
          <Link
            href={buildOverviewHref("manual", statusFilter, searchFilter, 1, complianceFilter)}
            className={`oc-btn oc-btn-compact ${
              sourceFilter === "manual"
                ? "border-[var(--border-strong)] bg-[var(--surface-subtle)] text-slate-900"
                : "border-[var(--border)] bg-[var(--surface)] text-slate-600 hover:bg-[var(--surface-muted)]"
            }`}
          >
            {tHome("cases.filters.manual")}
          </Link>
          <Link
            href={buildOverviewHref(sourceFilter, statusFilter, searchFilter, 1, complianceFilter === "non_compliant" ? "all" : "non_compliant")}
            className={`oc-btn oc-btn-compact ${
              complianceFilter === "non_compliant"
                ? "border-rose-300 bg-rose-100 text-rose-700"
                : "border-[var(--border)] bg-[var(--surface)] text-slate-600 hover:bg-[var(--surface-muted)]"
            }`}
          >
            {tHome("cases.filters.nonCompliant")}
          </Link>

          <StatusFilterSelect
            label={tHome("cases.filters.statusLabel")}
            allLabel={tHome("cases.filters.allStatuses")}
            value={statusFilter}
            options={statusOptions}
          />
        </div>
        {filteredCases.length === 0 ? (
          <p className="rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface-muted)] p-4 text-sm text-slate-600">
            {cases.length === 0 ? tHome("cases.empty") : tHome("cases.emptyFiltered")}
          </p>
        ) : (
          <div className="space-y-4">
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)] text-left text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                    <th className="py-3 pr-3">{tHome("cases.table.supplier")}</th>
                    <th className="py-3 pr-3">VAT</th>
                    <th className="py-3 pr-3">{tHome("cases.table.source")}</th>
                    <th className="py-3 pr-3">{tHome("cases.table.status")}</th>
                    <th className="py-3 pr-3">{tCommon("invitationSla")}</th>
                    <th className="py-3 pr-3">{tCommon("completionSla")}</th>
                    <th className="py-3 pr-3">{tHome("cases.table.action")}</th>
                  </tr>
                </thead>
                <tbody>
                  {pageCases.map((onboardingCase) => {
                    const compliance = evaluateCompliance(onboardingCase.documents);
                    const showNonCompliantStatus =
                      onboardingCase.status === "supplier_created_in_sap" && compliance.blocked;
                    const invitationSla = getCountdown(
                      onboardingCase.invitationOpenDeadlineAt,
                      onboardingCase.portalFirstAccessAt,
                      countdownLabels
                    );
                    const completionSla =
                      onboardingCase.status === "supplier_created_in_sap"
                        ? null
                        : getCountdown(onboardingCase.onboardingCompletionDeadlineAt, null, countdownLabels);

                    return (
                      <tr key={onboardingCase.id} className="border-b border-[var(--border)]/70 align-top">
                        <td className="py-3 pr-3 text-slate-900">
                          <span className="block max-w-[15rem] truncate font-semibold" title={onboardingCase.supplierName}>
                            {onboardingCase.supplierName}
                          </span>
                        </td>
                        <td className="py-3 pr-3 text-slate-700">
                          <span className="block max-w-[12rem] truncate [font-variant-numeric:tabular-nums]" title={onboardingCase.supplierVat}>
                            {onboardingCase.supplierVat}
                          </span>
                        </td>
                        <td className="py-3 pr-3">
                          <span
                            className={`inline-flex rounded-full border px-2 py-1 text-xs font-semibold ${
                              onboardingCase.sourceChannel === "sap_pr"
                                ? "border-[var(--border-strong)] bg-[var(--primary-soft)] text-[var(--primary)]"
                                : "border-[var(--border)] bg-[var(--surface-muted)] text-slate-600"
                            }`}
                          >
                            {onboardingCase.sourceChannel === "sap_pr" ? tCommon("sourceChannel.sapPr") : tCommon("sourceChannel.manual")}
                          </span>
                        </td>
                        <td className="py-3 pr-3">
                          {showNonCompliantStatus ? (
                            <span className="inline-flex rounded-full border border-rose-300 bg-rose-100 px-2 py-1 text-xs font-semibold text-rose-700">
                              {tHome("cases.table.nonCompliant")}
                            </span>
                          ) : (
                            <StatusBadge status={onboardingCase.status} />
                          )}
                        </td>
                        <td className="py-3 pr-3">
                          <span className={`inline-flex rounded-md border px-2 py-1 text-xs font-semibold ${countdownBadgeClass(invitationSla.status)}`}>
                            {invitationSla.label}
                          </span>
                        </td>
                        <td className="py-3 pr-3">
                          {completionSla === null ? (
                            <span className="text-xs font-semibold text-slate-400">—</span>
                          ) : (
                            <span className={`inline-flex rounded-md border px-2 py-1 text-xs font-semibold ${countdownBadgeClass(completionSla.status)}`}>
                              {completionSla.label}
                            </span>
                          )}
                        </td>
                        <td className="py-3 pr-3">
                          <Link
                            href={`/cases/${onboardingCase.id}`}
                            className="oc-btn oc-btn-secondary oc-btn-compact"
                          >
                            {tHome("cases.table.openCase")}
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600">
              <p>{tHome("cases.paginationSummary", { from: showingFrom, to: showingTo, total: totalCases })}</p>
              <div className="flex items-center gap-2">
                {currentPage > 1 ? (
                  <Link
                    href={buildOverviewHref(sourceFilter, statusFilter, searchFilter, currentPage - 1, complianceFilter)}
                    className="oc-btn oc-btn-secondary oc-btn-compact"
                  >
                    {tHome("cases.previous")}
                  </Link>
                ) : (
                  <span className="oc-btn oc-btn-secondary oc-btn-compact opacity-50">{tHome("cases.previous")}</span>
                )}
                <span className="rounded-md border border-[var(--border)] bg-[var(--surface-muted)] px-2 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-slate-600">
                  {tHome("cases.pageIndicator", { page: currentPage, totalPages })}
                </span>
                {currentPage < totalPages ? (
                  <Link
                    href={buildOverviewHref(sourceFilter, statusFilter, searchFilter, currentPage + 1, complianceFilter)}
                    className="oc-btn oc-btn-secondary oc-btn-compact"
                  >
                    {tHome("cases.next")}
                  </Link>
                ) : (
                  <span className="oc-btn oc-btn-secondary oc-btn-compact opacity-50">{tHome("cases.next")}</span>
                )}
              </div>
            </div>
          </div>
        )}
      </SectionCard>
    </main>
  );
}
