"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createMockDocuwareAdapter, createMockSapAdapter } from "@openchip/integrations";
import {
  createCaseInputSchema,
  documentCodeSchema,
  documentDefinitionCreateSchema,
  documentDefinitionStatusSchema,
  documentDefinitionUpdateSchema,
  DocumentCode,
  identifierSchema,
  invitationTokenSchema,
  onboardingInitiatorRoles,
  portalSettingsSchema,
  requirementMatrixUpdateSchema,
  supplierCategoryCreateSchema,
  supplierCategoryStatusSchema,
  supplierDraftSaveSchema,
  supplierOtpRequestSchema,
  supplierOtpVerifySchema,
  userUpsertSchema,
  supplierTypeCreateSchema,
  supplierTypeStatusSchema,
  updateSupplierInfoInputSchema,
  validateDocumentSchema,
  supplierSubmissionSchema,
  InternalRole
} from "@openchip/shared";
import { evaluateCompliance } from "@openchip/workflow";
import { actorFromSession, requireSessionRole, requireSessionUser } from "@/lib/auth";
import { saveDocumentTemplate } from "@/lib/document-storage";
import { getEmailAdapter } from "@/lib/email";
import { onboardingRepository } from "@/lib/repository";
import {
  clearSupplierPortalSession,
  createSupplierPortalSession,
  hasSupplierPortalSession
} from "@/lib/supplier-session";
import { triggerCaseWorkflows } from "@/lib/workflow-runner";

function readFormValue(formData: FormData, key: string): string {
  const value = formData.get(key);
  if (typeof value !== "string") {
    throw new Error(`Missing form value: ${key}`);
  }

  return value;
}

function readFormValueOrEmpty(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function readOptionalFormValue(formData: FormData, key: string): string | undefined {
  const value = formData.get(key);
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function omitUndefined<T extends Record<string, string | undefined>>(value: T): { [K in keyof T]?: string } {
  const result: Partial<Record<keyof T, string>> = {};
  for (const [key, entry] of Object.entries(value) as [keyof T, string | undefined][]) {
    if (entry !== undefined) {
      result[key] = entry;
    }
  }
  return result as { [K in keyof T]?: string };
}

function parseDocumentCode(value: string): DocumentCode {
  return documentCodeSchema.parse(value);
}

function hasRole(role: InternalRole, allowedRoles: readonly InternalRole[]): boolean {
  return allowedRoles.includes(role);
}

function getAppBaseUrl(): string {
  return process.env.APP_BASE_URL ?? "http://127.0.0.1:3005";
}

export async function createCaseAction(formData: FormData): Promise<void> {
  const user = await requireSessionRole(onboardingInitiatorRoles);

  const parsed = createCaseInputSchema.safeParse({
    supplierName: readFormValueOrEmpty(formData, "supplierName"),
    supplierVat: readFormValueOrEmpty(formData, "supplierVat"),
    supplierContactName: readFormValueOrEmpty(formData, "supplierContactName"),
    supplierContactEmail: readFormValueOrEmpty(formData, "supplierContactEmail"),
    requester: user.displayName,
    categoryCode: readFormValueOrEmpty(formData, "categoryCode")
  });

  if (!parsed.success) {
    redirect("/cases/new?error=validation");
  }

  let onboardingCaseId: string;
  try {
    const onboardingCase = await onboardingRepository.createCase(parsed.data, actorFromSession(user));
    onboardingCaseId = onboardingCase.id;
  } catch (error) {
    if (error instanceof Error && error.message.toLowerCase().includes("same vat")) {
      redirect("/cases/new?error=duplicate-vat");
    }

    redirect("/cases/new?error=unknown");
  }

  revalidatePath("/");
  redirect(`/cases/${onboardingCaseId}`);
}

export async function updateSupplierInfoAction(formData: FormData): Promise<void> {
  const user = await requireSessionRole(onboardingInitiatorRoles);

  const fallbackCaseId = readFormValueOrEmpty(formData, "caseId");
  const parsed = updateSupplierInfoInputSchema.safeParse({
    caseId: fallbackCaseId,
    supplierName: readFormValueOrEmpty(formData, "supplierName"),
    supplierVat: readFormValueOrEmpty(formData, "supplierVat"),
    supplierContactName: readFormValueOrEmpty(formData, "supplierContactName"),
    supplierContactEmail: readFormValueOrEmpty(formData, "supplierContactEmail")
  });

  if (!parsed.success) {
    redirect(`/cases/${fallbackCaseId}?toast=supplier_info_update_invalid`);
  }

  const { caseId } = parsed.data;
  try {
    await onboardingRepository.updateSupplierInfo(parsed.data, actorFromSession(user));
  } catch (error) {
    if (error instanceof Error && error.message.toLowerCase().includes("same vat")) {
      redirect(`/cases/${caseId}?toast=supplier_info_update_duplicate_vat`);
    }
    if (error instanceof Error && error.message.toLowerCase().includes("can only be edited before sap creation")) {
      redirect(`/cases/${caseId}?toast=supplier_info_update_locked`);
    }
    redirect(`/cases/${caseId}?toast=supplier_info_update_failed`);
  }

  revalidatePath(`/cases/${caseId}`);
  revalidatePath("/");
  redirect(`/cases/${caseId}?toast=supplier_info_updated`);
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
  redirect(`/cases/${caseId}?toast=invitation_sent`);
}

export async function supplierSubmitAction(formData: FormData): Promise<void> {
  const token = invitationTokenSchema.parse(readFormValue(formData, "token"));
  const session = await onboardingRepository.getSupplierSession(token);
  if (session === null) {
    await clearSupplierPortalSession();
    redirect(`/supplier/${token}?error=expired`);
  }

  const hasPortalSession = await hasSupplierPortalSession(token, session.caseId);
  if (!hasPortalSession || !session.otpVerified) {
    redirect(`/supplier/${token}?error=otp-required`);
  }

  const baseSubmission = supplierSubmissionSchema.safeParse({
    token,
    address: {
      street: readFormValueOrEmpty(formData, "street"),
      city: readFormValueOrEmpty(formData, "city"),
      postalCode: readFormValueOrEmpty(formData, "postalCode"),
      country: readFormValueOrEmpty(formData, "country")
    },
    bankAccount: {
      bkvid: readFormValueOrEmpty(formData, "bkvid"),
      banks: readFormValueOrEmpty(formData, "banks"),
      bankl: readFormValueOrEmpty(formData, "bankl"),
      bankn: readOptionalFormValue(formData, "bankn"),
      bkont: readOptionalFormValue(formData, "bkont"),
      accname: readFormValueOrEmpty(formData, "accname"),
      bkValidFrom: readOptionalFormValue(formData, "bkValidFrom"),
      bkValidTo: readOptionalFormValue(formData, "bkValidTo"),
      iban: readOptionalFormValue(formData, "iban")
    },
    uploadedDocuments: []
  });

  if (!baseSubmission.success) {
    redirect(`/supplier/${token}?error=validation`);
  }

  const onboardingCase = await onboardingRepository.getCase(session.caseId);
  if (onboardingCase === null) {
    redirect(`/supplier/${token}?error=not-found`);
  }

  const payload = supplierSubmissionSchema.safeParse({
    token,
    address: baseSubmission.data.address,
    bankAccount: baseSubmission.data.bankAccount,
    uploadedDocuments: []
  });

  if (!payload.success) {
    redirect(`/supplier/${token}?error=validation`);
  }

  try {
    const updatedCase = await onboardingRepository.submitSupplierResponse(payload.data, "supplier.portal");
    revalidatePath(`/supplier/${payload.data.token}`);
    revalidatePath(`/cases/${updatedCase.id}`);
    revalidatePath("/");
  } catch {
    redirect(`/supplier/${token}?error=missing-mandatory-documents`);
  }

  redirect(`/supplier/${token}?submitted=1`);
}

export async function requestSupplierOtpAction(formData: FormData): Promise<void> {
  const parsed = supplierOtpRequestSchema.parse({
    token: readFormValue(formData, "token")
  });

  const session = await onboardingRepository.getSupplierSession(parsed.token);
  if (session === null) {
    await clearSupplierPortalSession();
    redirect(`/supplier/${parsed.token}?error=expired`);
  }

  try {
    const onboardingCase = await onboardingRepository.requestSupplierOtp(parsed, "supplier.portal");
    if (onboardingCase.supplierOtpState.code !== null && onboardingCase.supplierOtpState.expiresAt !== null) {
      try {
        const emailAdapter = getEmailAdapter();
        await emailAdapter.sendSupplierOtpEmail({
          to: session.supplierContactEmail,
          supplierName: onboardingCase.supplierName,
          otpCode: onboardingCase.supplierOtpState.code,
          expiresAt: onboardingCase.supplierOtpState.expiresAt
        });
      } catch {
        // Keep OTP flow available even if email delivery channel is temporarily unavailable.
      }
    }
  } catch {
    redirect(`/supplier/${parsed.token}?otp=failed`);
  }

  revalidatePath(`/supplier/${parsed.token}`);
  redirect(`/supplier/${parsed.token}?otp=requested`);
}

export async function verifySupplierOtpAction(formData: FormData): Promise<void> {
  const parsed = supplierOtpVerifySchema.parse({
    token: readFormValue(formData, "token"),
    otpCode: readFormValue(formData, "otpCode")
  });

  try {
    const onboardingCase = await onboardingRepository.verifySupplierOtp(parsed, "supplier.portal");
    await createSupplierPortalSession({
      token: parsed.token,
      caseId: onboardingCase.id,
      verifiedAt: onboardingCase.supplierOtpState.verifiedAt ?? new Date().toISOString()
    });
  } catch (error) {
    const message = error instanceof Error ? error.message.toLowerCase() : "";
    if (message.includes("expired")) {
      redirect(`/supplier/${parsed.token}?otpError=expired`);
    }
    if (message.includes("attempts")) {
      redirect(`/supplier/${parsed.token}?otpError=attempts`);
    }
    if (message.includes("not been requested")) {
      redirect(`/supplier/${parsed.token}?otpError=not-requested`);
    }
    redirect(`/supplier/${parsed.token}?otpError=invalid`);
  }

  revalidatePath(`/supplier/${parsed.token}`);
  redirect(`/supplier/${parsed.token}?otp=verified`);
}

export async function saveSupplierDraftAction(formData: FormData): Promise<void> {
  const parsed = supplierDraftSaveSchema.parse({
    token: readFormValue(formData, "token"),
    address: {
      street: readOptionalFormValue(formData, "street"),
      city: readOptionalFormValue(formData, "city"),
      postalCode: readOptionalFormValue(formData, "postalCode"),
      country: readOptionalFormValue(formData, "country")
    },
    bankAccount: {
      banks: readOptionalFormValue(formData, "banks"),
      bankl: readOptionalFormValue(formData, "bankl"),
      bankn: readOptionalFormValue(formData, "bankn"),
      bkont: readOptionalFormValue(formData, "bkont"),
      accname: readOptionalFormValue(formData, "accname"),
      iban: readOptionalFormValue(formData, "iban")
    }
  });

  const payload = {
    token: parsed.token,
    address: omitUndefined(parsed.address),
    bankAccount: omitUndefined(parsed.bankAccount)
  };

  const session = await onboardingRepository.getSupplierSession(parsed.token);
  if (session === null) {
    await clearSupplierPortalSession();
    redirect(`/supplier/${parsed.token}?error=expired`);
  }

  const hasPortalSession = await hasSupplierPortalSession(parsed.token, session.caseId);
  if (!hasPortalSession || !session.otpVerified) {
    redirect(`/supplier/${parsed.token}?error=otp-required`);
  }

  await onboardingRepository.saveSupplierDraft(payload, "supplier.portal");
  revalidatePath(`/supplier/${payload.token}`);
  redirect(`/supplier/${payload.token}?draft=saved`);
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
  await onboardingRepository.recordCaseAction(caseId, actorFromSession(user), "expiration_reminder_sent", "Expiration reminder email sent");

  revalidatePath(`/cases/${caseId}`);
  redirect(`/cases/${caseId}?toast=expiration_reminder_sent`);
}

export async function setDocumentExpiryAction(formData: FormData): Promise<void> {
  const user = await requireSessionUser();
  if (!hasRole(user.role, ["finance", "compliance", "admin"])) {
    throw new Error("You do not have permission to set document expiry.");
  }

  const caseId = identifierSchema.parse(readFormValue(formData, "caseId"));
  const code = parseDocumentCode(readFormValue(formData, "code"));
  const validToRaw = readFormValueOrEmpty(formData, "validTo");
  const validTo = validToRaw.length > 0 ? validToRaw : null;

  await onboardingRepository.setDocumentExpiry(caseId, code, validTo, actorFromSession(user));
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

export async function createSupplierTypeAction(formData: FormData): Promise<void> {
  const user = await requireSessionRole(["admin"]);

  const parsed = supplierTypeCreateSchema.parse({
    label: readFormValue(formData, "label")
  });

  await onboardingRepository.createSupplierType(parsed, actorFromSession(user));
  revalidatePath("/portal-settings");
}

export async function setSupplierTypeStatusAction(formData: FormData): Promise<void> {
  const user = await requireSessionRole(["admin"]);
  const activeValue = formData.get("active");

  const parsed = supplierTypeStatusSchema.parse({
    typeId: readFormValue(formData, "typeId"),
    active: activeValue === "on" || activeValue === "true"
  });

  await onboardingRepository.setSupplierTypeStatus(parsed, actorFromSession(user));
  revalidatePath("/portal-settings");
}

export async function createSupplierCategoryAction(formData: FormData): Promise<void> {
  const user = await requireSessionRole(["admin"]);

  const parsed = supplierCategoryCreateSchema.parse({
    funding: readFormValue(formData, "funding"),
    typeId: readFormValue(formData, "typeId"),
    location: readFormValue(formData, "location"),
    label: readFormValue(formData, "label")
  });

  await onboardingRepository.createSupplierCategory(parsed, actorFromSession(user));
  revalidatePath("/portal-settings");
  revalidatePath("/cases/new");
}

export async function setSupplierCategoryStatusAction(formData: FormData): Promise<void> {
  const user = await requireSessionRole(["admin"]);
  const activeValue = formData.get("active");

  const parsed = supplierCategoryStatusSchema.parse({
    categoryCode: readFormValue(formData, "categoryCode"),
    active: activeValue === "on" || activeValue === "true"
  });

  await onboardingRepository.setSupplierCategoryStatus(parsed, actorFromSession(user));
  revalidatePath("/portal-settings");
  revalidatePath("/cases/new");
}

export async function updateRequirementMatrixAction(formData: FormData): Promise<void> {
  const user = await requireSessionRole(["admin"]);

  const parsed = requirementMatrixUpdateSchema.parse({
    categoryCode: readFormValue(formData, "categoryCode"),
    documentCode: readFormValue(formData, "documentCode"),
    requirementLevel: readFormValue(formData, "requirementLevel")
  });

  await onboardingRepository.updateRequirementMatrixEntry(parsed, actorFromSession(user));
  revalidatePath("/portal-settings");
  revalidatePath("/cases/new");
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

export async function createDocumentDefinitionAction(formData: FormData): Promise<void> {
  const user = await requireSessionRole(["admin"]);

  const parsed = documentDefinitionCreateSchema.parse({
    code: readFormValue(formData, "code"),
    labelEn: readFormValue(formData, "labelEn"),
    labelEs: readFormValue(formData, "labelEs"),
    type: readFormValue(formData, "type"),
    expiryPolicy: readFormValue(formData, "expiryPolicy"),
    owner: readFormValue(formData, "owner"),
    blocksPurchaseOrders: readFormValueOrEmpty(formData, "blocksPurchaseOrders") === "true"
  });

  await onboardingRepository.createDocumentDefinition(parsed, actorFromSession(user));
  revalidatePath("/portal-settings");
  revalidatePath("/cases/new");
}

export async function updateDocumentDefinitionAction(formData: FormData): Promise<void> {
  const user = await requireSessionRole(["admin"]);

  const parsed = documentDefinitionUpdateSchema.parse({
    code: readFormValue(formData, "code"),
    labelEn: readFormValue(formData, "labelEn"),
    labelEs: readFormValue(formData, "labelEs"),
    type: readFormValue(formData, "type"),
    expiryPolicy: readFormValue(formData, "expiryPolicy"),
    owner: readFormValue(formData, "owner"),
    blocksPurchaseOrders: readFormValueOrEmpty(formData, "blocksPurchaseOrders") === "true"
  });

  await onboardingRepository.updateDocumentDefinition(parsed, actorFromSession(user));
  revalidatePath("/portal-settings");
  revalidatePath("/cases/new");
}

export async function setDocumentDefinitionStatusAction(formData: FormData): Promise<void> {
  const user = await requireSessionRole(["admin"]);
  const parsed = documentDefinitionStatusSchema.parse({
    code: readFormValue(formData, "code"),
    active: readFormValueOrEmpty(formData, "active") === "true"
  });

  await onboardingRepository.setDocumentDefinitionStatus(parsed, actorFromSession(user));
  revalidatePath("/portal-settings");
  revalidatePath("/cases/new");
}

export async function uploadDocumentTemplateAction(formData: FormData): Promise<void> {
  const user = await requireSessionRole(["admin"]);
  const code = parseDocumentCode(readFormValue(formData, "code"));
  const file = formData.get("templateFile");
  if (!(file instanceof File) || file.size === 0) {
    throw new Error("Template file is required.");
  }

  const storagePath = await saveDocumentTemplate({ code, file });
  await onboardingRepository.setDocumentTemplatePath(
    {
      code,
      templateStoragePath: storagePath
    },
    actorFromSession(user)
  );

  revalidatePath("/portal-settings");
  revalidatePath("/cases/new");
}

export async function clearDocumentTemplateAction(formData: FormData): Promise<void> {
  const user = await requireSessionRole(["admin"]);
  const code = parseDocumentCode(readFormValue(formData, "code"));

  await onboardingRepository.setDocumentTemplatePath(
    {
      code,
      templateStoragePath: null
    },
    actorFromSession(user)
  );

  revalidatePath("/portal-settings");
}
