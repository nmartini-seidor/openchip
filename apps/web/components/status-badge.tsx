import { CaseStatus } from "@openchip/shared";
import clsx from "clsx";

const toneByStatus: Record<CaseStatus, string> = {
  onboarding_initiated: "bg-slate-100 text-slate-700 border-slate-300",
  invitation_sent: "bg-slate-100 text-slate-700 border-slate-300",
  portal_accessed: "bg-slate-100 text-slate-700 border-slate-300",
  response_in_progress: "bg-[var(--primary-soft)] text-[var(--primary)] border-[var(--border-strong)]",
  submission_completed: "bg-[#f6f2e8] text-[var(--warning)] border-[#d8c8a3]",
  validation_completed_pending_supplier_creation: "bg-[var(--primary-soft)] text-[var(--primary)] border-[var(--border-strong)]",
  supplier_created_in_sap: "bg-[#edf5ef] text-[var(--success)] border-[#bdd4c5]",
  cancelled: "bg-[#f8eeee] text-[var(--danger)] border-[#dec0c0]"
};

function normalizeLabel(value: CaseStatus): string {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function StatusBadge({ status }: { status: CaseStatus }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold tracking-wide",
        toneByStatus[status]
      )}
    >
      <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
      {normalizeLabel(status)}
    </span>
  );
}
