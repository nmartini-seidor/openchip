import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Save, UserPlus } from "lucide-react";
import { internalRoles } from "@openchip/shared";
import { upsertUserAction } from "@/app/actions";
import { SectionCard } from "@/components/section-card";
import { SupplierSearchFilter } from "@/components/supplier-search-filter";
import { SubmitButton } from "@/components/submit-button";
import { requireSessionRole } from "@/lib/auth";
import { onboardingRepository } from "@/lib/repository";

function formatRoleLabel(value: string): string {
  if (value === "contracts_justifications") {
    return "Contracts & Justifications";
  }

  return value
    .replaceAll("_", " ")
    .split(" ")
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(" ");
}

const usersPerPage = 10;

function parseSearchQuery(candidate: string | undefined): string {
  return candidate?.trim() ?? "";
}

function parsePageNumber(candidate: string | undefined): number {
  const parsed = Number.parseInt(candidate ?? "1", 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return 1;
  }

  return parsed;
}

function buildUsersHref(query: string, page: number): string {
  const params = new URLSearchParams();
  if (query.length > 0) {
    params.set("q", query);
  }
  if (page > 1) {
    params.set("page", page.toString());
  }
  const serialized = params.toString();
  return serialized.length > 0 ? `/users?${serialized}` : "/users";
}

type UsersPageSearchParams = Promise<{ q?: string; page?: string }>;

export default async function UsersPage({ searchParams }: { searchParams: UsersPageSearchParams }) {
  await requireSessionRole(["admin"]);
  const [params, users, t] = await Promise.all([searchParams, onboardingRepository.listUsers(), getTranslations("Users")]);

  const query = parseSearchQuery(params.q);
  const normalizedQuery = query.toLowerCase();

  const filteredUsers = users
    .filter((user) => {
      if (normalizedQuery.length === 0) {
        return true;
      }

      return (
        user.displayName.toLowerCase().includes(normalizedQuery) || user.email.toLowerCase().includes(normalizedQuery)
      );
    })
    .toSorted((left, right) => {
      const byName = left.displayName.localeCompare(right.displayName, undefined, { sensitivity: "base" });
      if (byName !== 0) {
        return byName;
      }

      return left.email.localeCompare(right.email, undefined, { sensitivity: "base" });
    });

  const totalUsers = filteredUsers.length;
  const totalPages = Math.max(1, Math.ceil(totalUsers / usersPerPage));
  const currentPage = Math.min(parsePageNumber(params.page), totalPages);
  const startIndex = (currentPage - 1) * usersPerPage;
  const pageUsers = filteredUsers.slice(startIndex, startIndex + usersPerPage);
  const showingFrom = totalUsers === 0 ? 0 : startIndex + 1;
  const showingTo = startIndex + pageUsers.length;

  return (
    <main id="main-content" className="w-full space-y-5">
      <SectionCard
        title={t("title")}
        subtitle={t("subtitle")}
        headerAction={
          <SupplierSearchFilter
            label={t("searchLabel")}
            placeholder={t("searchPlaceholder")}
            value={query}
          />
        }
      >
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] text-left text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                <th className="py-3 pr-3">{t("displayName")}</th>
                <th className="py-3 pr-3">{t("email")}</th>
                <th className="py-3 pr-3">{t("role")}</th>
                <th className="py-3 pr-3">{t("status")}</th>
                <th className="py-3 pr-3">{t("action")}</th>
              </tr>
            </thead>
            <tbody>
              {pageUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-6 text-sm text-slate-600">
                    {t("noResults")}
                  </td>
                </tr>
              ) : (
                pageUsers.map((user) => {
                  const formId = `user-form-${user.id}`;
                  return (
                    <tr key={user.id} className="border-b border-[var(--border)]/70 align-middle">
                      <td className="py-2 pr-3">
                        <input
                          id={`displayName-${user.id}`}
                          form={formId}
                          name="displayName"
                          defaultValue={user.displayName}
                          className="oc-input"
                        />
                      </td>
                      <td className="py-2 pr-3 text-slate-700">
                        <span className="block max-w-[20rem] truncate" title={user.email}>
                          {user.email}
                        </span>
                      </td>
                      <td className="py-2 pr-3">
                        <select
                          id={`role-${user.id}`}
                          form={formId}
                          name="role"
                          defaultValue={user.role}
                          className="oc-input oc-select"
                        >
                          {internalRoles.map((role) => (
                            <option key={role} value={role}>
                              {formatRoleLabel(role)}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-2 pr-3">
                        <select
                          id={`active-${user.id}`}
                          form={formId}
                          name="active"
                          defaultValue={user.active ? "true" : "false"}
                          className="oc-input oc-select"
                        >
                          <option value="true">{t("active")}</option>
                          <option value="false">{t("inactive")}</option>
                        </select>
                      </td>
                      <td className="py-2 pr-3">
                        <form id={formId} action={upsertUserAction}>
                          <input type="hidden" name="id" value={user.id} />
                          <input type="hidden" name="email" value={user.email} />
                          <SubmitButton
                            label={
                              <>
                                <Save aria-hidden="true" className="h-4 w-4" strokeWidth={1.8} />
                                {t("save")}
                              </>
                            }
                            pendingLabel={t("saving")}
                            className="oc-btn oc-btn-secondary"
                          />
                        </form>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            <tfoot>
              <tr className="bg-[var(--surface-muted)] align-middle">
                <td className="py-3 pr-3">
                  <input form="create-user-form" name="displayName" required className="oc-input" />
                </td>
                <td className="py-3 pr-3">
                  <input form="create-user-form" name="email" required type="email" className="oc-input" />
                </td>
                <td className="py-3 pr-3">
                  <select
                    form="create-user-form"
                    name="role"
                    defaultValue="requester"
                    className="oc-input oc-select"
                  >
                    {internalRoles.map((role) => (
                      <option key={role} value={role}>
                        {formatRoleLabel(role)}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="py-3 pr-3">
                  <select
                    form="create-user-form"
                    name="active"
                    defaultValue="true"
                    className="oc-input oc-select"
                  >
                    <option value="true">{t("active")}</option>
                    <option value="false">{t("inactive")}</option>
                  </select>
                </td>
                <td className="py-3 pr-3">
                  <form id="create-user-form" action={upsertUserAction}>
                    <SubmitButton
                      label={
                        <>
                          <UserPlus aria-hidden="true" className="h-4 w-4" strokeWidth={1.8} />
                          {t("createUser")}
                        </>
                      }
                      pendingLabel={t("creatingUser")}
                      className="oc-btn oc-btn-primary"
                    />
                  </form>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600">
          <p>{t("paginationSummary", { from: showingFrom, to: showingTo, total: totalUsers })}</p>
          <div className="flex items-center gap-2">
            {currentPage > 1 ? (
              <Link href={buildUsersHref(query, currentPage - 1)} className="oc-btn oc-btn-secondary oc-btn-compact">
                {t("previous")}
              </Link>
            ) : (
              <span className="oc-btn oc-btn-secondary oc-btn-compact opacity-50">{t("previous")}</span>
            )}
            <span className="rounded-md border border-[var(--border)] bg-[var(--surface-muted)] px-2 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-slate-600">
              {t("pageIndicator", { page: currentPage, totalPages })}
            </span>
            {currentPage < totalPages ? (
              <Link href={buildUsersHref(query, currentPage + 1)} className="oc-btn oc-btn-secondary oc-btn-compact">
                {t("next")}
              </Link>
            ) : (
              <span className="oc-btn oc-btn-secondary oc-btn-compact opacity-50">{t("next")}</span>
            )}
          </div>
        </div>
      </SectionCard>
    </main>
  );
}
