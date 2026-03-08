import { getTranslations } from "next-intl/server";
import { internalRoles } from "@openchip/shared";
import { upsertUserAction } from "@/app/actions";
import { SectionCard } from "@/components/section-card";
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

export default async function UsersPage() {
  await requireSessionRole(["admin"]);
  const [users, t] = await Promise.all([onboardingRepository.listUsers(), getTranslations("Users")]);

  return (
    <main id="main-content" className="w-full space-y-5">
      <SectionCard title={t("title")} subtitle={t("subtitle")}>
        <div className="grid gap-3">
          {users.map((user) => (
            <form key={user.id} action={upsertUserAction} className="grid gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] p-3 lg:grid-cols-[1.2fr_1fr_1fr_140px]">
              <input type="hidden" name="id" value={user.id} />
              <div className="grid gap-1">
                <label htmlFor={`displayName-${user.id}`} className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                  {t("displayName")}
                </label>
                <input
                  id={`displayName-${user.id}`}
                  name="displayName"
                  defaultValue={user.displayName}
                  className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-slate-900"
                />
                <input type="hidden" name="email" value={user.email} />
                <p className="text-xs text-slate-500">{user.email}</p>
              </div>

              <div className="grid gap-1">
                <label htmlFor={`role-${user.id}`} className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                  {t("role")}
                </label>
                <select
                  id={`role-${user.id}`}
                  name="role"
                  defaultValue={user.role}
                  className="oc-select rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-slate-900"
                >
                  {internalRoles.map((role) => (
                    <option key={role} value={role}>
                      {formatRoleLabel(role)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-1">
                <label htmlFor={`active-${user.id}`} className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                  {t("status")}
                </label>
                <select
                  id={`active-${user.id}`}
                  name="active"
                  defaultValue={user.active ? "true" : "false"}
                  className="oc-select rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-slate-900"
                >
                  <option value="true">{t("active")}</option>
                  <option value="false">{t("inactive")}</option>
                </select>
              </div>

              <div className="flex items-end">
                <SubmitButton
                  label={t("save")}
                  pendingLabel={t("saving")}
                  className="inline-flex w-full items-center justify-center rounded-md border border-[var(--border-strong)] bg-[var(--surface)] px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-[var(--surface-subtle)]"
                />
              </div>
            </form>
          ))}
        </div>
      </SectionCard>

      <SectionCard title={t("addTitle")} subtitle={t("addSubtitle")}>
        <form action={upsertUserAction} className="grid gap-3 md:grid-cols-2">
          <div className="grid gap-1">
            <label htmlFor="newDisplayName" className="text-sm font-semibold text-slate-700">
              {t("displayName")}
            </label>
            <input
              id="newDisplayName"
              name="displayName"
              required
              className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-slate-900"
            />
          </div>

          <div className="grid gap-1">
            <label htmlFor="newEmail" className="text-sm font-semibold text-slate-700">
              {t("email")}
            </label>
            <input
              id="newEmail"
              name="email"
              required
              type="email"
              className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-slate-900"
            />
          </div>

          <div className="grid gap-1">
            <label htmlFor="newRole" className="text-sm font-semibold text-slate-700">
              {t("role")}
            </label>
            <select
              id="newRole"
              name="role"
              defaultValue="requester"
              className="oc-select rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-slate-900"
            >
              {internalRoles.map((role) => (
                <option key={role} value={role}>
                  {formatRoleLabel(role)}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-1">
            <label htmlFor="newActive" className="text-sm font-semibold text-slate-700">
              {t("status")}
            </label>
            <select
              id="newActive"
              name="active"
              defaultValue="true"
              className="oc-select rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-slate-900"
            >
              <option value="true">{t("active")}</option>
              <option value="false">{t("inactive")}</option>
            </select>
          </div>

          <div className="md:col-span-2">
            <SubmitButton
              label={t("createUser")}
              pendingLabel={t("creatingUser")}
              className="inline-flex items-center rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--primary-strong)]"
            />
          </div>
        </form>
      </SectionCard>
    </main>
  );
}
