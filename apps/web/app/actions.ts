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
  requirementLevelSchema,
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
import { getAppBaseUrl } from "@/lib/app-base-url";
import { sendSupplierInvitation } from "@/lib/invitation";
import { onboardingRepository } from "@/lib/repository";
import {
  clearSupplierPortalSession,
  createSupplierPortalSession,
  hasSupplierPortalSession
} from "@/lib/supplier-session";

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

function readCheckboxValue(formData: FormData, key: string): boolean {
  const value = formData.get(key);
  return value === "on" || value === "true" || value === "1";
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

function buildSupplierSubmitErrorHref(
  token: string,
  error: string,
  details: { fields?: string[]; docs?: string[] } = {}
): string {
  const params = new URLSearchParams();
  params.set("error", error);
  if (details.fields !== undefined && details.fields.length > 0) {
    params.set("fields", details.fields.join(","));
  }
  if (details.docs !== undefined && details.docs.length > 0) {
    params.set("docs", details.docs.join(","));
  }
  return `/supplier/${token}?${params.toString()}`;
}

function getSupplierPortalLink(token: string): string {
  const appBaseUrl = getAppBaseUrl();
  return new URL(`/supplier/${token}`, appBaseUrl).toString();
}

function collectSupplierValidationFields(paths: ReadonlyArray<readonly (string | number)[]>): string[] {
  const allowedFields = new Set([
    "supplierName",
    "supplierContactName",
    "supplierVat",
    "identityConfirmed",
    "street",
    "city",
    "postalCode",
    "country",
    "banks",
    "bankn",
    "accname",
    "iban"
  ]);
  const discoveredFields = new Set<string>();

  for (const path of paths) {
    if (path.length === 0) {
      continue;
    }

    let candidate: string | null = null;
    if ((path[0] === "address" || path[0] === "bankAccount") && typeof path[1] === "string") {
      candidate = path[1];
    } else if (path[0] === "supplierIdentity" && typeof path[1] === "string") {
      candidate = path[1];
    } else if (typeof path[0] === "string") {
      candidate = path[0];
    }

    if (candidate !== null && allowedFields.has(candidate)) {
      discoveredFields.add(candidate);
    }
  }

  const fieldOrder = [
    "supplierName",
    "supplierContactName",
    "supplierVat",
    "identityConfirmed",
    "street",
    "city",
    "postalCode",
    "country",
    "banks",
    "bankn",
    "accname",
    "iban"
  ] as const;
  return fieldOrder.filter((field) => discoveredFields.has(field));
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
  await sendSupplierInvitation(caseId, actorFromSession(user));

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
    supplierIdentity: {
      supplierName: readFormValueOrEmpty(formData, "supplierName"),
      supplierVat: readFormValueOrEmpty(formData, "supplierVat"),
      supplierContactName: readFormValueOrEmpty(formData, "supplierContactName")
    },
    identityConfirmed: readCheckboxValue(formData, "identityConfirmed"),
    address: {
      street: readFormValueOrEmpty(formData, "street"),
      city: readFormValueOrEmpty(formData, "city"),
      postalCode: readFormValueOrEmpty(formData, "postalCode"),
      country: readFormValueOrEmpty(formData, "country")
    },
    bankAccount: {
      bkvid: readFormValueOrEmpty(formData, "bkvid"),
      banks: readFormValueOrEmpty(formData, "banks"),
      bankl: readOptionalFormValue(formData, "bankl"),
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
    const invalidFields = collectSupplierValidationFields(baseSubmission.error.issues.map((issue) => issue.path));
    redirect(buildSupplierSubmitErrorHref(token, "validation", { fields: invalidFields }));
  }

  const onboardingCase = await onboardingRepository.getCase(session.caseId);
  if (onboardingCase === null) {
    redirect(`/supplier/${token}?error=not-found`);
  }

  const requirements = await onboardingRepository.getRequirementPreview(onboardingCase.categoryCode);
  const uploadedDocuments = onboardingCase.supplierDraft?.uploadedDocuments ?? [];
  const uploadedByCode = new Map(uploadedDocuments.map((entry) => [entry.code, entry.files.length]));
  const existingDocumentsByCode = new Map(onboardingCase.documents.map((document) => [document.code, document.files.length]));
  const missingMandatoryDocumentCodes = requirements
    .filter((row) => row.requirementLevel === "mandatory")
    .filter((row) => (uploadedByCode.get(row.code) ?? 0) + (existingDocumentsByCode.get(row.code) ?? 0) === 0)
    .map((row) => row.code);

  if (missingMandatoryDocumentCodes.length > 0) {
    redirect(buildSupplierSubmitErrorHref(token, "missing-mandatory-documents", { docs: missingMandatoryDocumentCodes }));
  }

  const missingRejectedDocumentCodes = onboardingCase.documents
    .filter((document) => document.status === "rejected")
    .filter((document) => (uploadedByCode.get(document.code) ?? 0) === 0)
    .map((document) => document.code);

  if (missingRejectedDocumentCodes.length > 0) {
    redirect(buildSupplierSubmitErrorHref(token, "missing-rejected-documents", { docs: missingRejectedDocumentCodes }));
  }

  try {
    const updatedCase = await onboardingRepository.submitSupplierResponse(
      {
        token,
        supplierIdentity: baseSubmission.data.supplierIdentity,
        identityConfirmed: baseSubmission.data.identityConfirmed,
        address: baseSubmission.data.address,
        bankAccount: baseSubmission.data.bankAccount,
        uploadedDocuments: []
      },
      "supplier.portal"
    );
    revalidatePath(`/supplier/${token}`);
    revalidatePath(`/cases/${updatedCase.id}`);
    revalidatePath("/");
  } catch (error) {
    if (error instanceof Error) {
      const missingRequirementMatch = error.message.match(/Mandatory requirement\s+([A-Z0-9-]+)\s+is missing/i);
      if (missingRequirementMatch?.[1] !== undefined) {
        redirect(buildSupplierSubmitErrorHref(token, "missing-mandatory-documents", { docs: [missingRequirementMatch[1]] }));
      }
      const rejectedRequirementMatch = error.message.match(/Rejected requirement\s+([A-Z0-9-]+)\s+is missing/i);
      if (rejectedRequirementMatch?.[1] !== undefined) {
        redirect(buildSupplierSubmitErrorHref(token, "missing-rejected-documents", { docs: [rejectedRequirementMatch[1]] }));
      }
    }
    redirect(buildSupplierSubmitErrorHref(token, "validation"));
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

  const onboardingCase = await onboardingRepository.getCase(session.caseId);
  if (onboardingCase !== null && onboardingCase.supplierOtpState.requestedAt !== null) {
    const elapsedSeconds = Math.floor((Date.now() - new Date(onboardingCase.supplierOtpState.requestedAt).getTime()) / 1000);
    if (Number.isFinite(elapsedSeconds) && elapsedSeconds < 60) {
      redirect(`/supplier/${parsed.token}?otpError=cooldown`);
    }
  }

  try {
    const updatedCase = await onboardingRepository.requestSupplierOtp(parsed, "supplier.portal");
    if (updatedCase.supplierOtpState.code !== null && updatedCase.supplierOtpState.expiresAt !== null) {
      try {
        const emailAdapter = getEmailAdapter();
        await emailAdapter.sendSupplierOtpEmail({
          to: session.supplierContactEmail,
          supplierName: updatedCase.supplierName,
          otpCode: updatedCase.supplierOtpState.code,
          expiresAt: updatedCase.supplierOtpState.expiresAt
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
    supplierIdentity: {
      supplierName: readOptionalFormValue(formData, "supplierName"),
      supplierVat: readOptionalFormValue(formData, "supplierVat"),
      supplierContactName: readOptionalFormValue(formData, "supplierContactName")
    },
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
    supplierIdentity: omitUndefined(parsed.supplierIdentity),
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

  const updatedCase = await onboardingRepository.validateDocument(payload);
  if (payload.decision === "reject") {
    await onboardingRepository.recordCaseAction(
      payload.caseId,
      payload.approver,
      "supplier_rework_requested",
      `Supplier correction requested for document ${payload.code}`
    );

    if (updatedCase.invitationToken !== null) {
      try {
        const emailAdapter = getEmailAdapter();
        await emailAdapter.sendDocumentRejectedEmail({
          to: updatedCase.supplierContactEmail,
          supplierName: updatedCase.supplierName,
          invitationLink: getSupplierPortalLink(updatedCase.invitationToken),
          documentCodes: [payload.code]
        });
      } catch {
        // Keep validation flow available if supplier notification email fails.
      }
      revalidatePath(`/supplier/${updatedCase.invitationToken}`);
    }
    revalidatePath("/");
  }
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

export async function saveDocumentExpiryChangesAction(formData: FormData): Promise<void> {
  const user = await requireSessionUser();
  if (!hasRole(user.role, ["finance", "compliance", "admin"])) {
    throw new Error("You do not have permission to set document expiry.");
  }

  const caseId = identifierSchema.parse(readFormValue(formData, "caseId"));
  const actor = actorFromSession(user);
  const expiryUpdates: { code: DocumentCode; validTo: string | null }[] = [];

  for (const [key, rawValue] of formData.entries()) {
    if (!key.startsWith("validTo__") || typeof rawValue !== "string") {
      continue;
    }

    const codeRaw = key.slice("validTo__".length);
    const code = parseDocumentCode(codeRaw);
    const initialKey = `initialValidTo__${codeRaw}`;
    const initialRaw = formData.get(initialKey);
    const initialValue = typeof initialRaw === "string" && initialRaw.trim().length > 0 ? initialRaw.trim() : null;
    const nextValue = rawValue.trim().length > 0 ? rawValue.trim() : null;

    if (initialValue === nextValue) {
      continue;
    }

    expiryUpdates.push({ code, validTo: nextValue });
  }

  if (expiryUpdates.length === 0) {
    redirect(`/cases/${caseId}`);
  }

  const onboardingCase = await onboardingRepository.getCase(caseId);
  if (onboardingCase === null) {
    throw new Error("Case not found.");
  }

  const editableDocumentCodes = new Set(
    onboardingCase.documents
      .filter((document) => document.files.length > 0)
      .map((document) => document.code)
  );

  const safeUpdates = expiryUpdates.filter((update) => editableDocumentCodes.has(update.code));
  if (safeUpdates.length === 0) {
    redirect(`/cases/${caseId}`);
  }

  for (const update of safeUpdates) {
    await onboardingRepository.setDocumentExpiry(caseId, update.code, update.validTo, actor);
  }

  const note = `Updated expiry for ${safeUpdates.length} document(s): ${safeUpdates
    .map((update) => `${update.code}=${update.validTo ?? "clear"}`)
    .join(", ")}`;
  await onboardingRepository.recordCaseAction(caseId, actor, "document_expiry_updated", note);

  revalidatePath(`/cases/${caseId}`);
  revalidatePath("/");
  redirect(`/cases/${caseId}?toast=document_expiry_updated`);
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

export async function saveRequirementMatrixChangesAction(formData: FormData): Promise<void> {
  const user = await requireSessionRole(["admin"]);

  const categoryCode = readFormValue(formData, "categoryCode");
  const actor = actorFromSession(user);
  const changes: { documentCode: string; requirementLevel: "mandatory" | "optional" | "not_applicable" }[] = [];

  for (const [key, rawValue] of formData.entries()) {
    if (!key.startsWith("requirementLevel__") || typeof rawValue !== "string") {
      continue;
    }

    const documentCode = key.slice("requirementLevel__".length);
    const initialKey = `initialRequirementLevel__${documentCode}`;
    const initialRaw = formData.get(initialKey);
    const initialValue = typeof initialRaw === "string" ? initialRaw : "";
    const nextValue = requirementLevelSchema.parse(rawValue);

    if (initialValue === nextValue) {
      continue;
    }

    changes.push({ documentCode, requirementLevel: nextValue });
  }

  if (changes.length > 0) {
    for (const change of changes) {
      const parsed = requirementMatrixUpdateSchema.parse({
        categoryCode,
        documentCode: change.documentCode,
        requirementLevel: change.requirementLevel
      });
      await onboardingRepository.updateRequirementMatrixEntry(parsed, actor);
    }
  }

  revalidatePath("/portal-settings");
  revalidatePath("/cases/new");
  redirect(`/portal-settings?tab=matrix&category=${encodeURIComponent(categoryCode)}`);
}

export async function updatePortalSettingsAction(formData: FormData): Promise<void> {
  const user = await requireSessionRole(["admin"]);

  const parsed = portalSettingsSchema.parse({
    invitationOpenHours: readFormValue(formData, "invitationOpenHours"),
    onboardingCompletionDays: readFormValue(formData, "onboardingCompletionDays"),
    sapBaseUrl: readFormValue(formData, "sapBaseUrl"),
    sapApiKey: readFormValue(formData, "sapApiKey"),
    docuwareBaseUrl: readFormValue(formData, "docuwareBaseUrl"),
    docuwareApiKey: readFormValue(formData, "docuwareApiKey")
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
