import { documentCatalog, DocumentSubmission, RequirementLevel } from "@openchip/shared";

interface ComplianceReason {
  code: string;
  reason: string;
}

export interface ComplianceEvaluation {
  blocked: boolean;
  mandatoryPendingCount: number;
  mandatoryExpiredCount: number;
  reasons: ComplianceReason[];
}

function isApproved(status: DocumentSubmission["status"]): boolean {
  return status === "approved" || status === "approved_provisionally";
}

function isExpired(validTo: string | null, now: Date): boolean {
  if (validTo === null) {
    return false;
  }

  return new Date(validTo).getTime() < now.getTime();
}

function shouldBlock(requirementLevel: RequirementLevel, code: string): boolean {
  if (requirementLevel !== "mandatory") {
    return false;
  }

  const definition = documentCatalog.find((item) => item.code === code);
  return definition?.blocksPurchaseOrders ?? false;
}

export function evaluateCompliance(documents: readonly DocumentSubmission[], now = new Date()): ComplianceEvaluation {
  let mandatoryPendingCount = 0;
  let mandatoryExpiredCount = 0;
  const reasons: ComplianceReason[] = [];

  for (const document of documents) {
    if (!shouldBlock(document.requirementLevel, document.code)) {
      continue;
    }

    if (!isApproved(document.status)) {
      mandatoryPendingCount += 1;
      reasons.push({
        code: document.code,
        reason: "Mandatory document is not approved."
      });
      continue;
    }

    if (isExpired(document.validTo, now)) {
      mandatoryExpiredCount += 1;
      reasons.push({
        code: document.code,
        reason: "Mandatory document approval is expired."
      });
    }
  }

  return {
    blocked: mandatoryPendingCount > 0 || mandatoryExpiredCount > 0,
    mandatoryPendingCount,
    mandatoryExpiredCount,
    reasons
  };
}
