import Link from "next/link";
import { requireSessionUser } from "@/lib/auth";
import { getMessages } from "@/lib/i18n";
import { onboardingRepository } from "@/lib/repository";
import { countdownBadgeClass, getCountdown } from "@/lib/sla";
import { SectionCard } from "@/components/section-card";
import { StatusBadge } from "@/components/status-badge";

function countByStatus(statuses: readonly string[], status: string): number {
  return statuses.filter((value) => value === status).length;
}

export default async function HomePage() {
  const user = await requireSessionUser();
  const dict = getMessages(user.locale);

  const cases = await onboardingRepository.listCases();
  const statuses = cases.map((item) => item.status);

  return (
    <main id="main-content" className="w-full space-y-5">
      <section className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <SectionCard title="Operations Overview" subtitle="Track onboarding throughput and bottlenecks">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Total cases</p>
              <p className="mt-2 text-3xl font-semibold text-slate-900 [font-variant-numeric:tabular-nums]">{cases.length}</p>
            </div>
            <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Pending validation</p>
              <p className="mt-2 text-3xl font-semibold text-[var(--warning)] [font-variant-numeric:tabular-nums]">
                {countByStatus(statuses, "submission_completed")}
              </p>
            </div>
            <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Created in SAP</p>
              <p className="mt-2 text-3xl font-semibold text-[var(--success)] [font-variant-numeric:tabular-nums]">
                {countByStatus(statuses, "supplier_created_in_sap")}
              </p>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Quick actions" subtitle="Most-used commands">
          <div className="grid gap-2">
            <Link
              href="/cases/new"
              className="inline-flex cursor-pointer items-center justify-center rounded-md bg-[var(--primary)] px-3 py-2 text-sm font-semibold text-white hover:bg-[var(--primary-strong)]"
            >
              {dict.createCase}
            </Link>
            <p className="rounded-md border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-xs text-slate-600">
              Case review and validation are available from each case workspace.
            </p>
          </div>
        </SectionCard>
      </section>

      <SectionCard title="Onboarding cases" subtitle="Operational queue">
        {cases.length === 0 ? (
          <p className="rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface-muted)] p-4 text-sm text-slate-600">
            No cases yet. Create a new onboarding case to begin.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] text-left text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                  <th className="py-3 pr-3">Supplier</th>
                  <th className="py-3 pr-3">VAT</th>
                  <th className="py-3 pr-3">Status</th>
                  <th className="py-3 pr-3">{dict.invitationSla}</th>
                  <th className="py-3 pr-3">{dict.completionSla}</th>
                  <th className="py-3 pr-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {cases.map((onboardingCase) => {
                  const invitationSla = getCountdown(onboardingCase.invitationOpenDeadlineAt, onboardingCase.portalFirstAccessAt);
                  const completionSla = getCountdown(
                    onboardingCase.onboardingCompletionDeadlineAt,
                    onboardingCase.status === "supplier_created_in_sap" ? onboardingCase.updatedAt : null
                  );

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
                        <StatusBadge status={onboardingCase.status} />
                      </td>
                      <td className="py-3 pr-3">
                        <span className={`inline-flex rounded-md border px-2 py-1 text-xs font-semibold ${countdownBadgeClass(invitationSla.status)}`}>
                          {invitationSla.label}
                        </span>
                      </td>
                      <td className="py-3 pr-3">
                        <span className={`inline-flex rounded-md border px-2 py-1 text-xs font-semibold ${countdownBadgeClass(completionSla.status)}`}>
                          {completionSla.label}
                        </span>
                      </td>
                      <td className="py-3 pr-3">
                        <Link
                          href={`/cases/${onboardingCase.id}`}
                          className="inline-flex cursor-pointer items-center rounded-md border border-[var(--border-strong)] bg-[var(--surface)] px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-[var(--surface-muted)]"
                        >
                          Open case
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </main>
  );
}
