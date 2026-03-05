import { notFound } from "next/navigation";
import { invitationTokenSchema } from "@openchip/shared";
import { supplierSubmitAction } from "@/app/actions";
import { SectionCard } from "@/components/section-card";
import { SubmitButton } from "@/components/submit-button";
import { getCurrentLocale } from "@/lib/auth";
import { onboardingRepository } from "@/lib/repository";

export default async function SupplierPortalPage({
  params,
  searchParams
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ submitted?: string }>;
}) {
  const locale = await getCurrentLocale();
  const { token } = await params;
  const query = await searchParams;

  const parsedToken = invitationTokenSchema.safeParse(token);
  if (!parsedToken.success) {
    notFound();
  }

  const session = await onboardingRepository.getSupplierSession(parsedToken.data);
  if (session === null) {
    notFound();
  }

  await onboardingRepository.registerPortalAccess(parsedToken.data, "supplier.portal");
  const onboardingCase = await onboardingRepository.getCase(session.caseId);

  if (onboardingCase === null) {
    notFound();
  }

  const requirements = await onboardingRepository.getRequirementSummary(onboardingCase.categoryCode);

  return (
    <main id="main-content" className="w-full">
      <div className="grid gap-5 xl:grid-cols-[1.6fr_1fr]">
        <SectionCard
          title={locale === "es" ? "Portal de proveedor" : "Supplier submission portal"}
          subtitle={locale === "es" ? "Completa la información de onboarding" : "Complete your onboarding details"}
        >
          <p className="text-sm text-slate-600">
            Supplier: <span className="font-semibold text-slate-900">{onboardingCase.supplierName}</span> · VAT: {onboardingCase.supplierVat}
          </p>

          {query.submitted === "1" ? (
            <p className="mt-4 rounded-md border border-[#bdd4c5] bg-[#edf5ef] px-3 py-2 text-sm text-[var(--success)]">
              {locale === "es" ? "Respuesta enviada. El equipo interno continuará el proceso." : "Response submitted. Internal team will continue the process."}
            </p>
          ) : null}

          <form action={supplierSubmitAction} className="mt-6 grid gap-4 sm:grid-cols-2">
            <input type="hidden" name="token" value={parsedToken.data} />

            <div className="grid gap-2 sm:col-span-2">
              <label htmlFor="address" className="text-sm font-semibold text-slate-700">
                {locale === "es" ? "Dirección" : "Address"}
              </label>
              <input
                id="address"
                name="address"
                required
                autoComplete="street-address"
                className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-slate-900"
              />
            </div>

            <div className="grid gap-2">
              <label htmlFor="country" className="text-sm font-semibold text-slate-700">
                {locale === "es" ? "País" : "Country"}
              </label>
              <input
                id="country"
                name="country"
                required
                autoComplete="country-name"
                className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-slate-900"
              />
            </div>

            <div className="flex items-end">
              <SubmitButton
                label={locale === "es" ? "Enviar respuesta" : "Submit supplier response"}
                pendingLabel={locale === "es" ? "Enviando…" : "Submitting response…"}
                className="inline-flex w-full items-center justify-center rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--primary-strong)] disabled:opacity-60"
              />
            </div>
          </form>
        </SectionCard>

        <SectionCard
          title={locale === "es" ? "Documentación requerida" : "Required documentation"}
          subtitle={locale === "es" ? "Documentos solicitados por categoría" : "Documents requested for your category"}
        >
          <ul className="grid gap-2 text-sm text-slate-700">
            {requirements.map((document) => (
              <li key={document.code} className="rounded-md border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2">
                <span className="font-semibold text-slate-900">{document.code}</span> - {document.requirementLevel.replace("_", " ")}
              </li>
            ))}
          </ul>
        </SectionCard>
      </div>
    </main>
  );
}
