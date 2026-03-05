import clsx from "clsx";
import { CaseStatus } from "@openchip/shared";

interface SwimlaneStep {
  status: Exclude<CaseStatus, "cancelled">;
  lane: "Internal" | "Supplier" | "Validation" | "SAP";
  label: string;
}

const steps: readonly SwimlaneStep[] = [
  { status: "onboarding_initiated", lane: "Internal", label: "Onboarding initiated" },
  { status: "invitation_sent", lane: "Internal", label: "Invitation sent" },
  { status: "portal_accessed", lane: "Supplier", label: "Portal accessed" },
  { status: "response_in_progress", lane: "Supplier", label: "Response in progress" },
  { status: "submission_completed", lane: "Supplier", label: "Submission completed" },
  {
    status: "validation_completed_pending_supplier_creation",
    lane: "Validation",
    label: "Validation completed"
  },
  { status: "supplier_created_in_sap", lane: "SAP", label: "Supplier created in SAP" }
] as const;

function getStatusIndex(status: CaseStatus): number {
  if (status === "cancelled") {
    return -1;
  }

  return steps.findIndex((step) => step.status === status);
}

export function WorkflowSwimlane({ status }: { status: CaseStatus }) {
  const activeIndex = getStatusIndex(status);

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">Workflow</p>
      <ol className="mt-3 grid gap-3 lg:grid-cols-7">
        {steps.map((step, index) => {
          const isCompleted = activeIndex >= index;
          const isActive = activeIndex === index;

          return (
            <li
              key={step.status}
              className={clsx(
                "relative rounded-lg border px-3 py-2",
                isCompleted
                  ? "border-[var(--border-strong)] bg-[var(--surface-subtle)]"
                  : "border-[var(--border)] bg-[var(--surface-muted)]"
              )}
            >
              <span
                className={clsx(
                  "absolute -top-2 left-2 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em]",
                  isCompleted ? "bg-[var(--primary-soft)] text-[var(--primary)]" : "bg-slate-200 text-slate-600"
                )}
              >
                {step.lane}
              </span>
              <p className={clsx("mt-2 text-xs font-semibold", isActive ? "text-slate-900" : "text-slate-700")}>{step.label}</p>
            </li>
          );
        })}
      </ol>
      {status === "cancelled" ? (
        <p className="mt-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-[var(--danger)]">
          Case is cancelled.
        </p>
      ) : null}
    </div>
  );
}
