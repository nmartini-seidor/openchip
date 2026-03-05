import { sleep } from "workflow";
import { onboardingRepository } from "@/lib/repository";

interface CaseSlaWorkflowInput {
  caseId: string;
  actor: string;
  deadlineIso: string;
}

async function recordInvitationOpenDeadlineIfPending(input: CaseSlaWorkflowInput): Promise<void> {
  "use step";

  const onboardingCase = await onboardingRepository.getCase(input.caseId);
  if (onboardingCase === null || onboardingCase.portalFirstAccessAt !== null) {
    return;
  }

  await onboardingRepository.recordWorkflowTrigger(
    input.caseId,
    input.actor,
    "invitation_open_sla",
    null,
    "workflow"
  );
}

async function recordOnboardingCompletionDeadlineIfPending(input: CaseSlaWorkflowInput): Promise<void> {
  "use step";

  const onboardingCase = await onboardingRepository.getCase(input.caseId);
  if (onboardingCase === null || onboardingCase.status === "supplier_created_in_sap" || onboardingCase.status === "cancelled") {
    return;
  }

  await onboardingRepository.recordWorkflowTrigger(
    input.caseId,
    input.actor,
    "onboarding_completion_sla",
    null,
    "workflow"
  );
}

export async function invitationOpenSlaWorkflow(input: CaseSlaWorkflowInput): Promise<{ caseId: string }> {
  "use workflow";

  await sleep(new Date(input.deadlineIso));
  await recordInvitationOpenDeadlineIfPending(input);

  return { caseId: input.caseId };
}

export async function onboardingCompletionSlaWorkflow(input: CaseSlaWorkflowInput): Promise<{ caseId: string }> {
  "use workflow";

  await sleep(new Date(input.deadlineIso));
  await recordOnboardingCompletionDeadlineIfPending(input);

  return { caseId: input.caseId };
}
