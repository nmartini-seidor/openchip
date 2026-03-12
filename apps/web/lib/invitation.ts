import { OnboardingCase } from "@openchip/shared";
import { getAppBaseUrl } from "@/lib/app-base-url";
import { getEmailAdapter } from "@/lib/email";
import { onboardingRepository } from "@/lib/repository";
import { triggerCaseWorkflows } from "@/lib/workflow-runner";

export async function sendSupplierInvitation(caseId: string, actor: string): Promise<OnboardingCase> {
  const onboardingCase = await onboardingRepository.sendInvitation(caseId, actor);

  if (onboardingCase.invitationToken !== null && onboardingCase.invitationExpiresAt !== null) {
    const emailAdapter = getEmailAdapter();
    const invitationLink = new URL(`/supplier/${onboardingCase.invitationToken}`, getAppBaseUrl()).toString();

    await emailAdapter.sendInvitationEmail({
      to: onboardingCase.supplierContactEmail,
      supplierName: onboardingCase.supplierName,
      invitationLink,
      expiresAt: onboardingCase.invitationExpiresAt
    });

    await triggerCaseWorkflows({
      caseId,
      actor,
      invitationOpenDeadlineAt: onboardingCase.invitationOpenDeadlineAt,
      onboardingCompletionDeadlineAt: onboardingCase.onboardingCompletionDeadlineAt
    });
  }

  return onboardingCase;
}

export async function ensureSupplierInvitation(caseId: string, actor: string): Promise<OnboardingCase> {
  const existingCase = await onboardingRepository.getCase(caseId);
  if (existingCase === null) {
    throw new Error(`Case ${caseId} not found.`);
  }

  if (existingCase.invitationToken !== null && existingCase.invitationExpiresAt !== null) {
    return existingCase;
  }

  return sendSupplierInvitation(caseId, actor);
}
