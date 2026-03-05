import { CaseStatus } from "@openchip/shared";

const transitions: Record<CaseStatus, readonly CaseStatus[]> = {
  onboarding_initiated: ["invitation_sent", "cancelled"],
  invitation_sent: ["portal_accessed", "cancelled"],
  portal_accessed: ["response_in_progress", "cancelled"],
  response_in_progress: ["submission_completed", "cancelled"],
  submission_completed: [
    "validation_completed_pending_supplier_creation",
    "response_in_progress",
    "cancelled"
  ],
  validation_completed_pending_supplier_creation: ["supplier_created_in_sap", "cancelled"],
  supplier_created_in_sap: [],
  cancelled: []
};

export function canTransition(fromStatus: CaseStatus, toStatus: CaseStatus): boolean {
  return transitions[fromStatus].includes(toStatus);
}

export function transitionCaseStatus(fromStatus: CaseStatus, toStatus: CaseStatus): CaseStatus {
  if (!canTransition(fromStatus, toStatus)) {
    throw new Error(`Invalid status transition from ${fromStatus} to ${toStatus}`);
  }

  return toStatus;
}

export function getNextStatuses(status: CaseStatus): readonly CaseStatus[] {
  return transitions[status];
}
