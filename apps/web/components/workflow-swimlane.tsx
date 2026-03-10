import clsx from "clsx";
import { getTranslations } from "next-intl/server";
import { ChevronRight } from "lucide-react";
import { CaseSourceChannel, CaseStatus, StatusHistoryEntry } from "@openchip/shared";
import { formatDateTime } from "@/lib/format";

interface SwimlaneStep {
  status: Exclude<CaseStatus, "cancelled">;
  laneKey:
    | "steps.onboarding_initiated.lane"
    | "steps.invitation_sent.lane"
    | "steps.portal_accessed.lane"
    | "steps.response_in_progress.lane"
    | "steps.submission_completed.lane"
    | "steps.validation_completed_pending_supplier_creation.lane"
    | "steps.supplier_created_in_sap.lane";
  labelKey:
    | "steps.onboarding_initiated.label"
    | "steps.invitation_sent.label"
    | "steps.portal_accessed.label"
    | "steps.response_in_progress.label"
    | "steps.submission_completed.label"
    | "steps.validation_completed_pending_supplier_creation.label"
    | "steps.supplier_created_in_sap.label";
}

const steps: readonly SwimlaneStep[] = [
  { status: "onboarding_initiated", laneKey: "steps.onboarding_initiated.lane", labelKey: "steps.onboarding_initiated.label" },
  { status: "invitation_sent", laneKey: "steps.invitation_sent.lane", labelKey: "steps.invitation_sent.label" },
  { status: "portal_accessed", laneKey: "steps.portal_accessed.lane", labelKey: "steps.portal_accessed.label" },
  { status: "response_in_progress", laneKey: "steps.response_in_progress.lane", labelKey: "steps.response_in_progress.label" },
  { status: "submission_completed", laneKey: "steps.submission_completed.lane", labelKey: "steps.submission_completed.label" },
  {
    status: "validation_completed_pending_supplier_creation",
    laneKey: "steps.validation_completed_pending_supplier_creation.lane",
    labelKey: "steps.validation_completed_pending_supplier_creation.label"
  },
  { status: "supplier_created_in_sap", laneKey: "steps.supplier_created_in_sap.lane", labelKey: "steps.supplier_created_in_sap.label" }
] as const;

function getStatusIndex(status: CaseStatus): number {
  if (status === "cancelled") {
    return -1;
  }

  return steps.findIndex((step) => step.status === status);
}

function getStatusDate(statusHistory: readonly StatusHistoryEntry[], status: string): string | null {
  const entry = statusHistory.find((e) => e.status === status);
  return entry?.changedAt ?? null;
}

export async function WorkflowSwimlane({
  status,
  statusHistory = [],
  sourceChannel
}: {
  status: CaseStatus;
  statusHistory?: readonly StatusHistoryEntry[];
  sourceChannel: CaseSourceChannel;
}) {
  const t = await getTranslations("WorkflowSwimlane");
  const activeIndex = getStatusIndex(status);

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">{t("title")}</p>
      <ol className="mt-3 flex items-stretch gap-1">
        {steps.map((step, index) => {
          const isCompleted = activeIndex >= index && activeIndex !== -1;
          const isActive = activeIndex === index;
          const isPending = !isCompleted && !isActive;
          const date = getStatusDate(statusHistory, step.status);
          const laneLabel =
            sourceChannel === "sap_pr" &&
            (step.status === "onboarding_initiated" || step.status === "invitation_sent")
              ? t("lane.sap")
              : t(step.laneKey);

          return (
            <li key={step.status} className="flex min-w-0 flex-1 items-center gap-1" data-step-status={step.status}>
                <div
                className={clsx(
                  "flex min-w-0 flex-1 flex-col overflow-hidden rounded-lg border px-2 py-1.5",
                    isActive && "border-[var(--border-strong)] bg-[var(--primary-soft)] shadow-[0_0_0_2px_rgba(37,99,235,0.16)]",
                    isCompleted && !isActive && "border-[var(--border)] bg-[var(--surface-muted)]",
                    isPending && "border-[var(--border)] bg-[var(--surface-muted)]"
                  )}
                >
                  <p
                    className={clsx("truncate text-xs font-semibold", isActive ? "text-[var(--primary)]" : "text-slate-700")}
                    title={t(step.labelKey)}
                    data-label-for={step.status}
                  >
                    {t(step.labelKey)}
                  </p>
                  <p className="mt-0.5 flex min-w-0 items-center gap-x-1 truncate text-[10px] text-slate-500">
                    <span
                      data-lane-for={step.status}
                      className={clsx(
                        "shrink-0 rounded px-1 py-0.5 text-[9px] font-semibold uppercase tracking-[0.04em]",
                        isActive && "bg-[var(--primary)] text-white",
                        isCompleted && !isActive && "bg-[var(--primary)] text-white",
                        isPending && "bg-slate-200 text-slate-600"
                      )}
                    >
                      {laneLabel}
                    </span>
                    {date !== null ? (
                      <time dateTime={date} title={formatDateTime(date)}>{formatDateTime(date)}</time>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </p>
                </div>
              {index < steps.length - 1 ? (
                <ChevronRight
                  aria-hidden="true"
                  className={clsx(
                    "h-3 w-3 shrink-0",
                    activeIndex >= index ? "text-[var(--primary)]" : "text-slate-400"
                  )}
                  strokeWidth={1.8}
                />
              ) : null}
            </li>
          );
        })}
      </ol>
      {status === "cancelled" ? (
        <p className="mt-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-[var(--danger)]">
          {t("cancelled")}
        </p>
      ) : null}
    </div>
  );
}
