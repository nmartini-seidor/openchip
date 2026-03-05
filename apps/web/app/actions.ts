"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createMockDocuwareAdapter, createMockSapAdapter } from "@openchip/integrations";
import {
  createCaseInputSchema,
  identifierSchema,
  invitationTokenSchema,
  onboardingInitiatorRoles,
  portalSettingsSchema,
  userUpsertSchema,
  validateDocumentSchema,
  supplierSubmissionSchema,
  InternalRole
} from "@openchip/shared";
import { evaluateCompliance } from "@openchip/workflow";
import { actorFromSession, requireSessionRole, requireSessionUser } from "@/lib/auth";
import { getEmailAdapter } from "@/lib/email";
import { onboardingRepository } from "@/lib/repository";
import { triggerCaseWorkflows } from "@/lib/workflow-runner";

function readFormValue(formData: FormData, key: string): string {
  const value = formData.get(key);
  if (typeof value !== "string") {
    throw new Error(`Missing form value: ${key}`);
  }

  return value;
}

function hasRole(role: InternalRole, allowedRoles: readonly InternalRole[]): boolean {
  return allowedRoles.includes(role);
}

function getAppBaseUrl(): string {
  return process.env.APP_BASE_URL ?? "http://127.0.0.1:3005";
}

export async function createCaseAction(formData: FormData): Promise<void> {
  const user = await requireSessionRole(onboardingInitiatorRoles);

  const parsed = createCaseInputSchema.parse({
    supplierName: readFormValue(formData, "supplierName"),
    supplierVat: readFormValue(formData, "supplierVat"),
    supplierContactName: readFormValue(formData, "supplierContactName"),
    supplierContactEmail: readFormValue(formData, "supplierContactEmail"),
    requester: readFormValue(formData, "requester"),
    categoryCode: readFormValue(formData, "categoryCode")
  });

  const onboardingCase = await onboardingRepository.createCase(parsed, actorFromSession(user));
  revalidatePath("/");
  redirect(`/cases/${onboardingCase.id}`);
}

export async function sendInvitationAction(formData: FormData): Promise<void> {
  const user = await requireSessionRole(onboardingInitiatorRoles);

  const caseId = identifierSchema.parse(readFormValue(formData, "caseId"));
  const onboardingCase = await onboardingRepository.sendInvitation(caseId, actorFromSession(user));

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
      actor: actorFromSession(user),
      invitationOpenDeadlineAt: onboardingCase.invitationOpenDeadlineAt,
      onboardingCompletionDeadlineAt: onboardingCase.onboardingCompletionDeadlineAt
    });
  }

  revalidatePath(`/cases/${caseId}`);
  revalidatePath("/");
}

export async function supplierSubmitAction(formData: FormData): Promise<void> {
  const payload = supplierSubmissionSchema.parse({
    token: invitationTokenSchema.parse(readFormValue(formData, "token")),
    address: readFormValue(formData, "address"),
    country: readFormValue(formData, "country")
  });

  const onboardingCase = await onboardingRepository.submitSupplierResponse(payload, "supplier.portal");
  revalidatePath(`/supplier/${payload.token}`);
  revalidatePath(`/cases/${onboardingCase.id}`);
  revalidatePath("/");
  redirect(`/supplier/${payload.token}?submitted=1`);
}

export async function validateDocumentAction(formData: FormData): Promise<void> {
  const user = await requireSessionUser();

  const payload = validateDocumentSchema.parse({
    caseId: readFormValue(formData, "caseId"),
    code: readFormValue(formData, "code"),
    decision: readFormValue(formData, "decision"),
    approver: actorFromSession(user),
    comments: readFormValue(formData, "comments")
  });

  await onboardingRepository.validateDocument(payload);
  revalidatePath(`/cases/${payload.caseId}`);
}

export async function approveAllMandatoryAction(formData: FormData): Promise<void> {
  const user = await requireSessionUser();

  const caseId = identifierSchema.parse(readFormValue(formData, "caseId"));
  await onboardingRepository.approveAllMandatoryDocuments(caseId, actorFromSession(user));
  revalidatePath(`/cases/${caseId}`);
}

export async function completeValidationAction(formData: FormData): Promise<void> {
  const user = await requireSessionUser();
  if (!hasRole(user.role, ["compliance", "admin", "finance"])) {
    throw new Error("You do not have permission to complete validation.");
  }

  const caseId = identifierSchema.parse(readFormValue(formData, "caseId"));
  await onboardingRepository.completeValidation(caseId, actorFromSession(user));
  revalidatePath(`/cases/${caseId}`);
  revalidatePath("/");
}

export async function createSupplierInSapAction(formData: FormData): Promise<void> {
  const user = await requireSessionUser();
  if (!hasRole(user.role, ["finance", "admin"])) {
    throw new Error("You do not have permission to create suppliers in SAP.");
  }

  const caseId = identifierSchema.parse(readFormValue(formData, "caseId"));
  const onboardingCase = await onboardingRepository.getCase(caseId);

  if (onboardingCase === null) {
    throw new Error("Case not found.");
  }

  const sapAdapter = createMockSapAdapter();
  const docuwareAdapter = createMockDocuwareAdapter();

  await sapAdapter.createSupplier({
    caseId: onboardingCase.id,
    supplierVat: onboardingCase.supplierVat,
    supplierName: onboardingCase.supplierName
  });

  for (const document of onboardingCase.documents) {
    if (document.status === "approved" || document.status === "approved_provisionally") {
      await docuwareAdapter.archiveDocument({
        supplierName: onboardingCase.supplierName,
        supplierVat: onboardingCase.supplierVat,
        documentCode: document.code,
        validationStatus: document.status,
        validationDate: document.validationDate ?? new Date().toISOString(),
        expiryDate: document.validTo
      });
    }
  }

  await onboardingRepository.createSupplierInSap(caseId, actorFromSession(user));
  revalidatePath(`/cases/${caseId}`);
  revalidatePath("/");
}

export async function cancelCaseAction(formData: FormData): Promise<void> {
  const user = await requireSessionRole(onboardingInitiatorRoles);

  const caseId = identifierSchema.parse(readFormValue(formData, "caseId"));
  const reason = readFormValue(formData, "reason");
  await onboardingRepository.cancelCase(caseId, actorFromSession(user), reason);
  revalidatePath(`/cases/${caseId}`);
  revalidatePath("/");
}

export async function resubmitRejectedDocumentsAction(formData: FormData): Promise<void> {
  const user = await requireSessionUser();

  const caseId = identifierSchema.parse(readFormValue(formData, "caseId"));
  await onboardingRepository.resubmitRejectedDocuments(caseId, actorFromSession(user));
  revalidatePath(`/cases/${caseId}`);
}

export async function sendExpiryReminderAction(formData: FormData): Promise<void> {
  const user = await requireSessionUser();

  const caseId = identifierSchema.parse(readFormValue(formData, "caseId"));
  const onboardingCase = await onboardingRepository.getCase(caseId);

  if (onboardingCase === null) {
    throw new Error("Case not found.");
  }

  const complianceResult = evaluateCompliance(onboardingCase.documents);
  const documentCodes =
    complianceResult.reasons.length > 0
      ? [...new Set(complianceResult.reasons.map((reason) => reason.code))]
      : onboardingCase.documents
          .filter((document) => document.requirementLevel === "mandatory")
          .map((document) => document.code);

  const emailAdapter = getEmailAdapter();
  await emailAdapter.sendExpiryReminderEmail({
    to: onboardingCase.supplierContactEmail,
    supplierName: onboardingCase.supplierName,
    documentCodes
  });

  await onboardingRepository.recordWorkflowTrigger(caseId, actorFromSession(user), "document_expiry", null, "fallback");

  revalidatePath(`/cases/${caseId}`);
}

export async function upsertUserAction(formData: FormData): Promise<void> {
  const user = await requireSessionRole(["admin"]);

  const activeValue = formData.get("active");
  const idValue = formData.get("id");
  const id = typeof idValue === "string" && idValue.length > 0 ? idValue : undefined;

  const parsed = userUpsertSchema.parse({
    ...(id !== undefined ? { id } : {}),
    email: readFormValue(formData, "email"),
    displayName: readFormValue(formData, "displayName"),
    role: readFormValue(formData, "role"),
    active: activeValue === "on" || activeValue === "true"
  });

  await onboardingRepository.upsertUser(parsed, actorFromSession(user));
  revalidatePath("/users");
}

export async function updatePortalSettingsAction(formData: FormData): Promise<void> {
  const user = await requireSessionRole(["admin"]);

  const parsed = portalSettingsSchema.parse({
    invitationOpenHours: readFormValue(formData, "invitationOpenHours"),
    onboardingCompletionDays: readFormValue(formData, "onboardingCompletionDays")
  });

  await onboardingRepository.updatePortalSettings(parsed, actorFromSession(user));
  revalidatePath("/portal-settings");
  revalidatePath("/");
}
