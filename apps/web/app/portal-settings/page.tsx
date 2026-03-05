import { updatePortalSettingsAction } from "@/app/actions";
import { requireSessionRole } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import { onboardingRepository } from "@/lib/repository";
import { SectionCard } from "@/components/section-card";
import { SubmitButton } from "@/components/submit-button";

export default async function PortalSettingsPage() {
  await requireSessionRole(["admin"]);
  const settings = await onboardingRepository.getPortalSettings();

  return (
    <main id="main-content" className="w-full space-y-5">
      <SectionCard title="Portal Settings" subtitle="SLA windows for supplier onboarding">
        <form action={updatePortalSettingsAction} className="grid gap-4 md:grid-cols-2">
          <div className="grid gap-2">
            <label htmlFor="invitationOpenHours" className="text-sm font-semibold text-slate-700">
              Max time to open onboarding invitation (hours)
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
              Max time to complete onboarding (days)
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
              label="Save portal settings"
              pendingLabel="Saving settings…"
              className="inline-flex items-center rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--primary-strong)]"
            />
          </div>
        </form>
      </SectionCard>

      <SectionCard title="Current policy" subtitle="Latest compliance configuration">
        <dl className="grid gap-2 text-sm text-slate-700 md:grid-cols-2">
          <div className="rounded-md border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2">
            <dt className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">Invitation open SLA</dt>
            <dd className="mt-1 text-lg font-semibold text-slate-900">{settings.invitationOpenHours} hours</dd>
          </div>
          <div className="rounded-md border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2">
            <dt className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">Completion SLA</dt>
            <dd className="mt-1 text-lg font-semibold text-slate-900">{settings.onboardingCompletionDays} days</dd>
          </div>
          <div className="rounded-md border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 md:col-span-2">
            <dt className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">Last update</dt>
            <dd className="mt-1 text-sm text-slate-900">
              {formatDateTime(settings.updatedAt)} by {settings.updatedBy}
            </dd>
          </div>
        </dl>
      </SectionCard>
    </main>
  );
}
