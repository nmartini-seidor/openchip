import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { evaluateCompliance } from "@openchip/workflow";
import {
  approveAllMandatoryAction,
  cancelCaseAction,
  completeValidationAction,
  createSupplierInSapAction,
  resubmitRejectedDocumentsAction,
  sendExpiryReminderAction,
  sendInvitationAction,
  validateDocumentAction
} from "@/app/actions";
import { CaseToastHandler } from "@/components/case-toast-handler";
import { CopyLinkButton } from "@/components/copy-link-button";
import { SectionCard } from "@/components/section-card";
import { StatusBadge } from "@/components/status-badge";
import { StatusTimeline } from "@/components/status-timeline";
import { SubmitButton } from "@/components/submit-button";
import { WorkflowSwimlane } from "@/components/workflow-swimlane";
import { requireSessionUser } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import { onboardingRepository } from "@/lib/repository";
import { countdownBadgeClass, getCountdown } from "@/lib/sla";

function getAppBaseUrl(): string {
  return process.env.APP_BASE_URL ?? "http://127.0.0.1:3005";
}

export default async function CaseDetailsPage({
  params
}: {
  params: Promise<{ caseId: string }>;
}) {
  await requireSessionUser();

  const [{ caseId }, tCase, tCommon, tSla] = await Promise.all([
    params,
    getTranslations("CaseDetails"),
    getTranslations("Common"),
    getTranslations("Sla")
  ]);

  const onboardingCase = await onboardingRepository.getCase(caseId);

  if (onboardingCase === null) {
    notFound();
  }

  const supplierCategory = await onboardingRepository.getSupplierCategory(onboardingCase.categoryCode);
  const categoryLabel = supplierCategory?.label ?? onboardingCase.categoryCode;

  const requirementSummary =
    onboardingCase.documents.length > 0
      ? onboardingCase.documents
      : await onboardingRepository.getRequirementSummary(onboardingCase.categoryCode);

  const complianceResult = evaluateCompliance(onboardingCase.documents);
  const hasRejectedDocuments = onboardingCase.documents.some((document) => document.status === "rejected");
  const hasInvitation = onboardingCase.invitationSentAt !== null;
  const canSendInvitation = onboardingCase.status === "onboarding_initiated";
  const hasMandatoryPendingReception = onboardingCase.documents.some(
    (d) => d.requirementLevel === "mandatory" && d.status === "pending_reception"
  );
  const hasMandatoryPendingValidation = onboardingCase.documents.some(
    (d) => d.requirementLevel === "mandatory" && d.status === "pending_validation"
  );
  const canApproveAllMandatory =
    onboardingCase.status === "submission_completed" &&
    !hasMandatoryPendingReception &&
    hasMandatoryPendingValidation;
  const canResubmitRejected = onboardingCase.status === "submission_completed" && hasRejectedDocuments;
  const canCompleteValidation =
    onboardingCase.status === "submission_completed" && !complianceResult.blocked;
  const canCreateSupplierInSap = onboardingCase.status === "validation_completed_pending_supplier_creation";
  const supplierSideStatuses = [
    "invitation_sent",
    "portal_accessed",
    "response_in_progress",
    "submission_completed"
  ] as const;
  const isSupplierSide = supplierSideStatuses.includes(onboardingCase.status as (typeof supplierSideStatuses)[number]);
  const canSendReminder = hasInvitation && isSupplierSide;
  const canCancelCase = onboardingCase.status !== "supplier_created_in_sap" && onboardingCase.status !== "cancelled";

  const countdownLabels = {
    notStarted: tSla("notStarted"),
    completed: tSla("completed"),
    remaining: (duration: string) => tSla("remaining", { duration }),
    overdue: (duration: string) => tSla("overdue", { duration })
  };

  const invitationSla = getCountdown(onboardingCase.invitationOpenDeadlineAt, onboardingCase.portalFirstAccessAt, countdownLabels);
  const completionSla = getCountdown(
    onboardingCase.onboardingCompletionDeadlineAt,
    onboardingCase.status === "supplier_created_in_sap" ? onboardingCase.updatedAt : null,
    countdownLabels
  );

  const requirementLevelLabels: Record<string, string> = {
    mandatory: tCommon("requirementLevel.mandatory"),
    optional: tCommon("requirementLevel.optional"),
    not_applicable: tCommon("requirementLevel.notApplicable")
  };

  const requirementLevelClassName: Record<string, string> = {
    mandatory: "inline-flex rounded-md border px-2 py-1 text-xs font-semibold border-rose-200 bg-rose-50 text-rose-700",
    optional: "inline-flex rounded-md border px-2 py-1 text-xs font-semibold border-amber-200 bg-amber-50 text-amber-700",
    not_applicable: "inline-flex rounded-md border px-2 py-1 text-xs font-semibold border-slate-200 bg-slate-50 text-slate-600"
  };

  const documentStatusLabels: Record<string, string> = {
    pending_reception: tCommon("documentStatus.pendingReception"),
    pending_validation: tCommon("documentStatus.pendingValidation"),
    approved: tCommon("documentStatus.approved"),
    rejected: tCommon("documentStatus.rejected"),
    approved_provisionally: tCommon("documentStatus.approvedProvisionally")
  };

  const supplierPortalPath = onboardingCase.invitationToken !== null ? `/supplier/${onboardingCase.invitationToken}` : null;
  const supplierPortalAbsoluteUrl =
    supplierPortalPath !== null ? new URL(supplierPortalPath, getAppBaseUrl()).toString() : null;

  const metadataRows: { label: string; value: string; href?: string }[] = [
    { label: tCase("metadata.requester"), value: onboardingCase.requester },
    { label: tCase("metadata.supplierCategory"), value: categoryLabel },
    { label: tCase("metadata.createdBy"), value: onboardingCase.createdBy },
    { label: tCase("metadata.contact"), value: onboardingCase.supplierContactName },
    { label: "Email", value: onboardingCase.supplierContactEmail, href: `mailto:${onboardingCase.supplierContactEmail}` },
    { label: tCase("metadata.created"), value: formatDateTime(onboardingCase.createdAt) },
    onboardingCase.sourceReference !== null
      ? { label: tCase("metadata.sourceReference"), value: onboardingCase.sourceReference }
      : null,
    onboardingCase.sourceSystem !== null ? { label: tCase("metadata.sourceSystem"), value: onboardingCase.sourceSystem } : null,
    onboardingCase.requestedBySapUser !== null
      ? { label: tCase("metadata.requestedBySapUser"), value: onboardingCase.requestedBySapUser }
      : null
  ].filter((row): row is { label: string; value: string; href?: string } => row !== null);

  return (
    <main id="main-content" className="w-full space-y-5">
      <CaseToastHandler />
      <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
            {tCommon("labels.case")} {onboardingCase.id}
          </p>
          <h2 className="text-2xl font-semibold text-slate-900">{onboardingCase.supplierName}</h2>
          <p className="mt-1 text-sm text-slate-600">
            VAT: {onboardingCase.supplierVat} · {tCommon("labels.category")}: {onboardingCase.categoryCode}
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <StatusBadge status={onboardingCase.status} />
          {canSendInvitation ? (
            <form action={sendInvitationAction}>
              <input type="hidden" name="caseId" value={onboardingCase.id} />
              <SubmitButton
                label={
                  <span className="inline-flex items-center gap-1.5">
                    <svg aria-hidden="true" viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.6">
                      <path d="M3 5.5h14v9H3z" />
                      <path d="m4 6 6 5 6-5" />
                    </svg>
                    {tCase("controls.sendInvitation")}
                  </span>
                }
                pendingLabel={tCase("controls.sendingInvitation")}
                className="inline-flex cursor-pointer items-center rounded-md bg-[var(--primary)] px-2.5 py-1.5 text-sm font-semibold text-white hover:bg-[var(--primary-strong)] disabled:opacity-60"
              />
            </form>
          ) : null}
          {!canSendInvitation && canSendReminder ? (
            <form action={sendExpiryReminderAction}>
              <input type="hidden" name="caseId" value={onboardingCase.id} />
              <SubmitButton
                label={
                  <span className="inline-flex items-center gap-1.5">
                    <svg aria-hidden="true" viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.6">
                      <path d="M3 5.5h14v9H3z" />
                      <path d="m4 6 6 5 6-5" />
                    </svg>
                    {tCase("controls.sendExpiryReminder")}
                  </span>
                }
                pendingLabel={tCase("controls.sendingReminder")}
                className="inline-flex cursor-pointer items-center rounded-md bg-[var(--primary)] px-2.5 py-1.5 text-sm font-semibold text-white hover:bg-[var(--primary-strong)] disabled:opacity-60"
              />
            </form>
          ) : null}
          {supplierPortalAbsoluteUrl !== null && isSupplierSide ? (
            <CopyLinkButton
              value={supplierPortalAbsoluteUrl}
              label={tCase("controls.copySupplierLink")}
              successLabel={tCase("controls.magicLinkCopied")}
              className="rounded-full"
              icon={
                <svg aria-hidden="true" viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M8 6.5h6a2.5 2.5 0 0 1 0 5h-1" />
                  <path d="M12 13.5H6a2.5 2.5 0 0 1 0-5h1" />
                </svg>
              }
            />
          ) : null}
        </div>
      </div>

      <WorkflowSwimlane status={onboardingCase.status} statusHistory={onboardingCase.statusHistory} />

      <div className="grid gap-5 xl:grid-cols-[2.2fr_1fr]">
        <div className="space-y-6">
          {(canCompleteValidation || canCreateSupplierInSap || canResubmitRejected) ? (
            <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
              <div className="flex flex-wrap items-center gap-2">
                {canResubmitRejected ? (
                  <form action={resubmitRejectedDocumentsAction}>
                    <input type="hidden" name="caseId" value={onboardingCase.id} />
                    <SubmitButton
                      label={tCase("controls.resubmitRejected")}
                      pendingLabel={tCase("controls.resubmittingRejected")}
                      className="inline-flex cursor-pointer items-center rounded-md border border-[var(--border-strong)] bg-[var(--surface)] px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-[var(--surface-muted)] disabled:opacity-60"
                    />
                  </form>
                ) : null}

                {canCompleteValidation ? (
                  <form action={completeValidationAction}>
                    <input type="hidden" name="caseId" value={onboardingCase.id} />
                    <SubmitButton
                      label={tCase("controls.completeValidation")}
                      pendingLabel={tCase("controls.completingValidation")}
                      className="inline-flex cursor-pointer items-center rounded-md border border-[var(--border-strong)] bg-[var(--surface)] px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-[var(--surface-muted)] disabled:opacity-60"
                    />
                  </form>
                ) : null}

                {canCreateSupplierInSap ? (
                  <form action={createSupplierInSapAction}>
                    <input type="hidden" name="caseId" value={onboardingCase.id} />
                    <SubmitButton
                      label={tCase("controls.createSupplierInSap")}
                      pendingLabel={tCase("controls.creatingSupplierInSap")}
                      className="inline-flex cursor-pointer items-center rounded-md bg-[var(--success)] px-3 py-2 text-sm font-semibold text-white hover:brightness-95 disabled:opacity-60"
                    />
                  </form>
                ) : null}
              </div>
            </section>
          ) : null}

          <SectionCard
            title={tCase("requirements.title")}
            subtitle={tCase("requirements.subtitle")}
            headerAction={
              <span className="text-sm text-slate-600">
                {tCase("compliance.poBlock")}:{" "}
                {complianceResult.blocked ? (
                  <span className="font-semibold text-[var(--danger)]">{tCase("compliance.enabled")}</span>
                ) : (
                  <span className="font-semibold text-[var(--success)]">{tCase("compliance.disabled")}</span>
                )}
              </span>
            }
          >
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)] text-left text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                    <th className="py-2 pr-3">Code</th>
                    <th className="py-2 pr-3">{tCase("requirements.requirement")}</th>
                    <th className="py-2 pr-3">{tCase("requirements.status")}</th>
                    <th className="py-2 pr-3">{tCase("requirements.approver")}</th>
                    <th className="py-2 pr-3">{tCase("requirements.action")}</th>
                  </tr>
                </thead>
                <tbody>
                  {requirementSummary.map((document) => (
                    <tr key={document.code} className="border-b border-[var(--border)]/70 align-top">
                      <td className="py-2 pr-3 font-semibold text-slate-900">{document.code}</td>
                      <td className="py-2 pr-3">
                        <span
                          className={
                            requirementLevelClassName[document.requirementLevel] ??
                            requirementLevelClassName.not_applicable
                          }
                        >
                          {requirementLevelLabels[document.requirementLevel] ?? requirementLevelLabels.not_applicable}
                        </span>
                      </td>
                      <td className="py-2 pr-3 whitespace-nowrap capitalize text-slate-700">
                        {documentStatusLabels[document.status] ?? documentStatusLabels.approved_provisionally}
                      </td>
                      <td className="py-2 pr-3 text-slate-600">{document.approver ?? "-"}</td>
                      <td className="py-2 pr-3">
                        {onboardingCase.status === "submission_completed" ? (
                          <form action={validateDocumentAction} className="flex flex-wrap items-center gap-2 lg:flex-nowrap">
                            <input type="hidden" name="caseId" value={onboardingCase.id} />
                            <input type="hidden" name="code" value={document.code} />
                            <select
                              name="decision"
                              defaultValue="approve"
                              aria-label={`Validation decision for ${document.code}`}
                              className="oc-select rounded-md border border-[var(--border)] px-2 py-1 pr-8 text-xs lg:w-44"
                            >
                              <option value="approve">{tCase("requirements.approve")}</option>
                              <option value="reject">{tCase("requirements.reject")}</option>
                              <option value="approve_provisionally">{tCase("requirements.approveProvisionally")}</option>
                            </select>
                            <input
                              name="comments"
                              defaultValue={tCase("requirements.defaultComment")}
                              aria-label={`Validation comments for ${document.code}`}
                              className="min-w-0 rounded-md border border-[var(--border)] px-2 py-1 text-xs lg:w-56"
                            />
                            <SubmitButton
                              label={tCase("requirements.apply")}
                              pendingLabel={tCase("requirements.applying")}
                              className="rounded-md border border-[var(--border-strong)] bg-[var(--surface)] px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-[var(--surface-muted)] disabled:opacity-60"
                            />
                          </form>
                        ) : (
                          <span className="text-xs text-slate-500">{tCase("requirements.noAction")}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {onboardingCase.status === "submission_completed" ? (
              <div className="mt-4 flex justify-end">
                <form action={approveAllMandatoryAction}>
                  <input type="hidden" name="caseId" value={onboardingCase.id} />
                  <SubmitButton
                    label={tCase("controls.approveAllMandatory")}
                    pendingLabel={tCase("controls.approvingMandatory")}
                    disabled={!canApproveAllMandatory}
                    className="inline-flex cursor-pointer items-center rounded-md border border-[var(--border-strong)] bg-[var(--surface)] px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-[var(--surface-muted)] disabled:cursor-not-allowed disabled:opacity-50"
                  />
                </form>
              </div>
            ) : null}
          </SectionCard>

          {canCancelCase ? (
            <details className="group">
              <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-[var(--danger)] hover:bg-rose-100">
                <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <path d="M6 6 14 14M14 6l-8 8" />
                </svg>
                {tCase("controls.cancelCase")}
              </summary>
              <form action={cancelCaseAction} className="mt-2 grid gap-2 rounded-md border border-rose-200 bg-rose-50 p-3">
                <input type="hidden" name="caseId" value={onboardingCase.id} />
                <label htmlFor="cancelReason" className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">
                  {tCase("controls.cancellationReason")}
                </label>
                <textarea
                  id="cancelReason"
                  name="reason"
                  required
                  defaultValue={tCase("controls.defaultCancellationReason")}
                  rows={3}
                  className="rounded-md border border-[var(--border)] px-3 py-2 text-sm text-slate-900"
                  aria-label={tCase("controls.cancellationReason")}
                />
                <div className="flex flex-wrap items-center gap-2">
                  <SubmitButton
                    label={tCase("controls.cancelCase")}
                    pendingLabel={tCase("controls.cancellingCase")}
                    className="inline-flex cursor-pointer items-center justify-center rounded-md border border-rose-200 bg-rose-100 px-3 py-2 text-sm font-semibold text-[var(--danger)] hover:bg-rose-200 disabled:opacity-60"
                  />
                  <Link
                    href={`/cases/${onboardingCase.id}`}
                    className="inline-flex cursor-pointer items-center rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-[var(--surface-muted)]"
                  >
                    {tCase("controls.goBack")}
                  </Link>
                </div>
              </form>
            </details>
          ) : null}
        </div>

        <div className="space-y-6">
          <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[0_8px_24px_-18px_rgba(15,23,42,0.35)]">
            <header className="mb-4 flex items-center justify-between gap-2">
              <h2 className="text-lg font-semibold text-slate-900">{tCase("metadata.title")}</h2>
              <span
                className={
                  onboardingCase.sourceChannel === "sap_pr"
                    ? "inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-semibold uppercase tracking-[0.08em] text-emerald-700"
                    : "inline-flex rounded-full border border-slate-300 bg-slate-100 px-2 py-0.5 text-xs font-semibold uppercase tracking-[0.08em] text-slate-700"
                }
              >
                {onboardingCase.sourceChannel === "sap_pr" ? tCommon("sourceChannel.sapPr") : tCommon("sourceChannel.manual")}
              </span>
            </header>
            <dl className="space-y-2 text-sm text-slate-700">
              {metadataRows.map((row) => (
                <div key={row.label} className="flex justify-between gap-3">
                  <dt className="font-semibold text-slate-900">{row.label}</dt>
                  <dd className="text-right">
                    {row.href !== undefined ? (
                      <a href={row.href} className="cursor-pointer text-[var(--primary)] hover:text-[var(--primary-strong)] hover:underline">
                        {row.value}
                      </a>
                    ) : (
                      row.value
                    )}
                  </dd>
                </div>
              ))}
              {hasInvitation && onboardingCase.portalFirstAccessAt === null ? (
                <>
                  <div className="flex justify-between gap-3">
                    <dt className="font-semibold text-slate-900">{tCommon("invitationSla")}</dt>
                    <dd className="text-right">
                      <span className={`inline-flex rounded-md border px-2 py-1 text-xs font-semibold ${countdownBadgeClass(invitationSla.status)}`}>
                        {invitationSla.label}
                      </span>
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="font-semibold text-slate-900">{tCommon("completionSla")}</dt>
                    <dd className="text-right">
                      <span className={`inline-flex rounded-md border px-2 py-1 text-xs font-semibold ${countdownBadgeClass(completionSla.status)}`}>
                        {completionSla.label}
                      </span>
                    </dd>
                  </div>
                </>
              ) : null}
            </dl>
          </section>

          <SectionCard title={tCase("timeline.title")}>
            <StatusTimeline history={onboardingCase.statusHistory} actionHistory={onboardingCase.actionHistory} />
          </SectionCard>
        </div>
      </div>
    </main>
  );
}
