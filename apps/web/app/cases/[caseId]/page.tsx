import Link from "next/link";
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
import { CopyLinkButton } from "@/components/copy-link-button";
import { SectionCard } from "@/components/section-card";
import { StatusBadge } from "@/components/status-badge";
import { StatusTimeline } from "@/components/status-timeline";
import { SubmitButton } from "@/components/submit-button";
import { WorkflowSwimlane } from "@/components/workflow-swimlane";
import { getCurrentLocale, requireSessionUser } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import { getMessages } from "@/lib/i18n";
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
  const locale = await getCurrentLocale();
  const dict = getMessages(locale);

  const { caseId } = await params;
  const onboardingCase = await onboardingRepository.getCase(caseId);

  if (onboardingCase === null) {
    notFound();
  }

  const requirementSummary =
    onboardingCase.documents.length > 0
      ? onboardingCase.documents
      : await onboardingRepository.getRequirementSummary(onboardingCase.categoryCode);

  const complianceResult = evaluateCompliance(onboardingCase.documents);
  const hasRejectedDocuments = onboardingCase.documents.some((document) => document.status === "rejected");
  const canSendInvitation = onboardingCase.status === "onboarding_initiated";
  const canApproveMandatory = onboardingCase.status === "submission_completed";
  const canResubmitRejected = onboardingCase.status === "submission_completed" && hasRejectedDocuments;
  const canCompleteValidation = onboardingCase.status === "submission_completed";
  const canCreateSupplierInSap = onboardingCase.status === "validation_completed_pending_supplier_creation";
  const canSendReminder = onboardingCase.status !== "cancelled";
  const canCancelCase = onboardingCase.status !== "supplier_created_in_sap" && onboardingCase.status !== "cancelled";

  const invitationSla = getCountdown(onboardingCase.invitationOpenDeadlineAt, onboardingCase.portalFirstAccessAt);
  const completionSla = getCountdown(
    onboardingCase.onboardingCompletionDeadlineAt,
    onboardingCase.status === "supplier_created_in_sap" ? onboardingCase.updatedAt : null
  );

  const supplierPortalPath = onboardingCase.invitationToken !== null ? `/supplier/${onboardingCase.invitationToken}` : null;
  const supplierPortalAbsoluteUrl =
    supplierPortalPath !== null ? new URL(supplierPortalPath, getAppBaseUrl()).toString() : null;

  return (
    <main id="main-content" className="w-full space-y-5">
      <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Case {onboardingCase.id}</p>
          <h2 className="text-2xl font-semibold text-slate-900">{onboardingCase.supplierName}</h2>
          <p className="mt-1 text-sm text-slate-600">
            VAT: {onboardingCase.supplierVat} · Category: {onboardingCase.categoryCode}
          </p>
        </div>
        <StatusBadge status={onboardingCase.status} />
      </div>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">{dict.invitationSla}</p>
          <p className={`mt-2 inline-flex rounded-md border px-2 py-1 text-xs font-semibold ${countdownBadgeClass(invitationSla.status)}`}>
            {invitationSla.label}
          </p>
        </div>
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">{dict.completionSla}</p>
          <p className={`mt-2 inline-flex rounded-md border px-2 py-1 text-xs font-semibold ${countdownBadgeClass(completionSla.status)}`}>
            {completionSla.label}
          </p>
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[2.2fr_1fr]">
        <div className="space-y-6">
          <SectionCard title="Case controls" subtitle="Actions available for current status">
            <div className="flex flex-wrap items-center gap-2">
              {canSendInvitation ? (
                <form action={sendInvitationAction}>
                  <input type="hidden" name="caseId" value={onboardingCase.id} />
                  <SubmitButton
                    label="Send invitation"
                    pendingLabel="Sending invitation…"
                    className="inline-flex items-center rounded-md bg-[var(--primary)] px-3 py-2 text-sm font-semibold text-white hover:bg-[var(--primary-strong)] disabled:opacity-60"
                  />
                </form>
              ) : null}

              {canApproveMandatory ? (
                <form action={approveAllMandatoryAction}>
                  <input type="hidden" name="caseId" value={onboardingCase.id} />
                  <SubmitButton
                    label="Approve all mandatory documents"
                    pendingLabel="Approving mandatory docs…"
                    className="inline-flex items-center rounded-md border border-[var(--border-strong)] bg-[var(--surface)] px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-[var(--surface-muted)] disabled:opacity-60"
                  />
                </form>
              ) : null}

              {canCompleteValidation ? (
                <form action={completeValidationAction}>
                  <input type="hidden" name="caseId" value={onboardingCase.id} />
                  <SubmitButton
                    label="Complete validation"
                    pendingLabel="Completing validation…"
                    className="inline-flex items-center rounded-md border border-[var(--border-strong)] bg-[var(--surface)] px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-[var(--surface-muted)] disabled:opacity-60"
                  />
                </form>
              ) : null}

              {canCreateSupplierInSap ? (
                <form action={createSupplierInSapAction}>
                  <input type="hidden" name="caseId" value={onboardingCase.id} />
                  <SubmitButton
                    label="Create supplier in SAP"
                    pendingLabel="Creating supplier in SAP…"
                    className="inline-flex items-center rounded-md bg-[var(--success)] px-3 py-2 text-sm font-semibold text-white hover:brightness-95 disabled:opacity-60"
                  />
                </form>
              ) : null}

              {canResubmitRejected ? (
                <form action={resubmitRejectedDocumentsAction}>
                  <input type="hidden" name="caseId" value={onboardingCase.id} />
                  <SubmitButton
                    label="Resubmit rejected documents"
                    pendingLabel="Resubmitting documents…"
                    className="inline-flex items-center rounded-md border border-[var(--border-strong)] bg-[var(--surface)] px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-[var(--surface-muted)] disabled:opacity-60"
                  />
                </form>
              ) : null}

              {canSendReminder ? (
                <form action={sendExpiryReminderAction}>
                  <input type="hidden" name="caseId" value={onboardingCase.id} />
                  <SubmitButton
                    label={
                      <span className="inline-flex items-center gap-1">
                        <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6">
                          <path d="M3 5.5h14v9H3z" />
                          <path d="m4 6 6 5 6-5" />
                        </svg>
                        Send expiry reminder
                      </span>
                    }
                    pendingLabel="Sending reminder…"
                    className="inline-flex items-center rounded-md border border-[var(--border-strong)] bg-[var(--surface)] px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-[var(--surface-muted)] disabled:opacity-60"
                  />
                </form>
              ) : null}
            </div>

            {canCancelCase ? (
              <details className="mt-3 rounded-md border border-rose-200 bg-rose-50 p-3">
                <summary className="list-none text-sm font-semibold text-[var(--danger)]">Cancel case</summary>
                <form action={cancelCaseAction} className="mt-3 grid gap-2">
                  <input type="hidden" name="caseId" value={onboardingCase.id} />
                  <label htmlFor="cancelReason" className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">
                    Cancellation reason
                  </label>
                  <textarea
                    id="cancelReason"
                    name="reason"
                    required
                    defaultValue="Cancelled by internal requester"
                    rows={3}
                    className="rounded-md border border-[var(--border)] px-3 py-2 text-sm text-slate-900"
                    aria-label="Cancellation reason"
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    <SubmitButton
                      label="Cancel case"
                      pendingLabel="Cancelling case…"
                      className="inline-flex items-center justify-center rounded-md border border-rose-200 bg-rose-100 px-3 py-2 text-sm font-semibold text-[var(--danger)] hover:bg-rose-200 disabled:opacity-60"
                    />
                    <Link
                      href={`/cases/${onboardingCase.id}`}
                      className="inline-flex cursor-pointer items-center rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-[var(--surface-muted)]"
                    >
                      Go back
                    </Link>
                  </div>
                </form>
              </details>
            ) : null}

            {supplierPortalPath !== null ? (
              <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-slate-700">
                <Link href={supplierPortalPath} className="font-semibold text-[var(--primary)] hover:text-[var(--primary-strong)]">
                  Open supplier portal
                </Link>
                {supplierPortalAbsoluteUrl !== null ? (
                  <CopyLinkButton
                    value={supplierPortalAbsoluteUrl}
                    label={dict.copyMagicLink}
                    successLabel={dict.magicLinkCopied}
                  />
                ) : null}
              </div>
            ) : (
              <p className="mt-4 text-sm text-slate-500">Invitation not generated yet.</p>
            )}
          </SectionCard>

          <SectionCard title="Document requirements" subtitle="Requirement matrix and validation decisions">
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)] text-left text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                    <th className="py-2 pr-3">Code</th>
                    <th className="py-2 pr-3">Requirement</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2 pr-3">Approver</th>
                    <th className="py-2 pr-3">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {requirementSummary.map((document) => (
                    <tr key={document.code} className="border-b border-[var(--border)]/70 align-top">
                      <td className="py-2 pr-3 font-semibold text-slate-900">{document.code}</td>
                      <td className="py-2 pr-3 capitalize text-slate-700">{document.requirementLevel.replace("_", " ")}</td>
                      <td className="py-2 pr-3 whitespace-nowrap capitalize text-slate-700">{document.status.replaceAll("_", " ")}</td>
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
                              className="rounded-md border border-[var(--border)] px-2 py-1 text-xs lg:w-44"
                            >
                              <option value="approve">Approve</option>
                              <option value="reject">Reject</option>
                              <option value="approve_provisionally">Approve provisionally</option>
                            </select>
                            <input
                              name="comments"
                              defaultValue="Validated"
                              aria-label={`Validation comments for ${document.code}`}
                              className="min-w-0 rounded-md border border-[var(--border)] px-2 py-1 text-xs lg:w-56"
                            />
                            <SubmitButton
                              label="Apply"
                              pendingLabel="Applying…"
                              className="rounded-md border border-[var(--border-strong)] bg-[var(--surface)] px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-[var(--surface-muted)] disabled:opacity-60"
                            />
                          </form>
                        ) : (
                          <span className="text-xs text-slate-500">No action available</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>
        </div>

        <div className="space-y-6">
          <SectionCard title="Compliance status">
            <p className="text-sm text-slate-700">
              PO Block:{" "}
              {complianceResult.blocked ? (
                <span className="font-semibold text-[var(--danger)]">Enabled</span>
              ) : (
                <span className="font-semibold text-[var(--success)]">Disabled</span>
              )}
            </p>
            <p className="mt-2 text-xs text-slate-600">Mandatory pending: {complianceResult.mandatoryPendingCount}</p>
            <p className="text-xs text-slate-600">Mandatory expired: {complianceResult.mandatoryExpiredCount}</p>
            {complianceResult.reasons.length > 0 ? (
              <ul className="mt-3 list-disc space-y-1 pl-4 text-xs text-slate-600">
                {complianceResult.reasons.map((reason) => (
                  <li key={`${reason.code}-${reason.reason}`}>
                    {reason.code}: {reason.reason}
                  </li>
                ))}
              </ul>
            ) : null}
          </SectionCard>

          <SectionCard title="Status timeline">
            <StatusTimeline history={onboardingCase.statusHistory} />
          </SectionCard>

          <SectionCard title="Case metadata">
            <dl className="space-y-2 text-sm text-slate-700">
              <div className="flex justify-between gap-3">
                <dt className="font-semibold text-slate-900">Requester</dt>
                <dd>{onboardingCase.requester}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="font-semibold text-slate-900">Created by</dt>
                <dd>{onboardingCase.createdBy}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="font-semibold text-slate-900">Contact</dt>
                <dd>{onboardingCase.supplierContactName}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="font-semibold text-slate-900">Email</dt>
                <dd>{onboardingCase.supplierContactEmail}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="font-semibold text-slate-900">Created</dt>
                <dd>{formatDateTime(onboardingCase.createdAt)}</dd>
              </div>
            </dl>
          </SectionCard>
        </div>
      </div>

      <WorkflowSwimlane status={onboardingCase.status} />
    </main>
  );
}
