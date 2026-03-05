import { start } from "workflow/api";
import { onboardingRepository } from "@/lib/repository";
import { invitationOpenSlaWorkflow, onboardingCompletionSlaWorkflow } from "@/workflows/case-sla";

interface TriggerCaseWorkflowsInput {
  caseId: string;
  actor: string;
  invitationOpenDeadlineAt: string | null;
  onboardingCompletionDeadlineAt: string | null;
}

async function triggerWorkflowWithFallback(
  workflowName: "invitation_open_sla" | "onboarding_completion_sla",
  actor: string,
  caseId: string,
  deadlineIso: string,
  runner: (payload: { caseId: string; actor: string; deadlineIso: string }) => Promise<{ runId: string }>
): Promise<void> {
  try {
    const run = await runner({ caseId, actor, deadlineIso });
    await onboardingRepository.recordWorkflowTrigger(caseId, actor, workflowName, run.runId, "workflow");
  } catch {
    await onboardingRepository.recordWorkflowTrigger(caseId, actor, workflowName, null, "fallback");
  }
}

export async function triggerCaseWorkflows(input: TriggerCaseWorkflowsInput): Promise<void> {
  const tasks: Promise<void>[] = [];

  if (input.invitationOpenDeadlineAt !== null) {
    tasks.push(
      triggerWorkflowWithFallback(
        "invitation_open_sla",
        input.actor,
        input.caseId,
        input.invitationOpenDeadlineAt,
        async (payload) => start(invitationOpenSlaWorkflow, [payload])
      )
    );
  }

  if (input.onboardingCompletionDeadlineAt !== null) {
    tasks.push(
      triggerWorkflowWithFallback(
        "onboarding_completion_sla",
        input.actor,
        input.caseId,
        input.onboardingCompletionDeadlineAt,
        async (payload) => start(onboardingCompletionSlaWorkflow, [payload])
      )
    );
  }

  await Promise.all(tasks);
}
