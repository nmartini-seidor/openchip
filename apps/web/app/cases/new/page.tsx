import Link from "next/link";
import { onboardingInitiatorRoles, supplierCategories } from "@openchip/shared";
import { createCaseAction } from "@/app/actions";
import { SectionCard } from "@/components/section-card";
import { SubmitButton } from "@/components/submit-button";
import { VatInput } from "@/components/vat-input";
import { requireSessionRole } from "@/lib/auth";
import { getMessages } from "@/lib/i18n";

export default async function NewCasePage() {
  const user = await requireSessionRole(onboardingInitiatorRoles);
  const dict = getMessages(user.locale);

  return (
    <main id="main-content" className="w-full">
      <SectionCard title="Create onboarding case" subtitle="Internal initiation form">
        <form action={createCaseAction} className="grid gap-4 lg:grid-cols-2">
          <div className="grid gap-2">
            <label htmlFor="supplierName" className="text-sm font-semibold text-slate-700">
              Supplier Name
            </label>
            <input
              id="supplierName"
              name="supplierName"
              required
              autoComplete="organization"
              className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-slate-900"
            />
          </div>

          <VatInput label="Supplier VAT / Tax ID" inputId="supplierVat" inputName="supplierVat" />

          <div className="grid gap-2">
            <label htmlFor="supplierContactName" className="text-sm font-semibold text-slate-700">
              Supplier Contact Name
            </label>
            <input
              id="supplierContactName"
              name="supplierContactName"
              required
              autoComplete="name"
              className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-slate-900"
            />
          </div>
          <div className="grid gap-2">
            <label htmlFor="supplierContactEmail" className="text-sm font-semibold text-slate-700">
              Supplier Contact Email
            </label>
            <input
              id="supplierContactEmail"
              name="supplierContactEmail"
              required
              type="email"
              autoComplete="email"
              spellCheck={false}
              inputMode="email"
              className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-slate-900"
            />
          </div>

          <div className="grid gap-2">
            <label htmlFor="requester" className="text-sm font-semibold text-slate-700">
              Requester
            </label>
            <input
              id="requester"
              name="requester"
              required
              autoComplete="name"
              className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-slate-900"
            />
          </div>
          <div className="grid gap-2">
            <label htmlFor="categoryCode" className="text-sm font-semibold text-slate-700">
              Supplier Category
            </label>
            <select
              id="categoryCode"
              name="categoryCode"
              required
              className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-slate-900"
            >
              {supplierCategories.map((category) => (
                <option key={category.code} value={category.code}>
                  {category.code} - {category.label}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-2 flex gap-3 lg:col-span-2">
            <SubmitButton
              label="Create onboarding case"
              pendingLabel="Creating case…"
              className="inline-flex items-center rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--primary-strong)] disabled:opacity-60"
            />
            <Link
              href="/"
              className="inline-flex cursor-pointer items-center rounded-md border border-[var(--border-strong)] bg-[var(--surface)] px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-[var(--surface-muted)]"
            >
              {dict.navOverview}
            </Link>
          </div>
        </form>
      </SectionCard>
    </main>
  );
}
