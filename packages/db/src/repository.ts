import {
  ActionHistoryEntry,
  CaseActionType,
  CaseSourceChannel,
  CaseStatus,
  CreateCaseInput,
  DocumentCode,
  DocumentDefinition,
  DocumentDefinitionCreateInput,
  DocumentDefinitionStatusInput,
  DocumentDefinitionUpdateInput,
  DocumentTemplatePathUpdateInput,
  FundingType,
  DocumentSubmission,
  IntegrationEvent,
  InternalUser,
  RequirementLevel,
  RequirementMatrixEntry,
  RequirementMatrixUpdateInput,
  RequirementPreviewRow,
  UploadedDocumentFile,
  SupplierCategoryCreateInput,
  SupplierCategoryDefinition,
  SupplierCategoryStatusInput,
  OnboardingCase,
  PortalSettings,
  SupplierCategoryCode,
  SupplierSession,
  SupplierSubmissionInput,
  SupplierDraftSaveInput,
  SupplierOtpRequestInput,
  SupplierOtpVerifyInput,
  SupplierBankAccount,
  SupplierTypeCreateInput,
  SupplierTypeDefinition,
  SupplierTypeStatusInput,
  UpdateSupplierInfoInput,
  UserUpsertInput,
  ValidateDocumentInput
} from "@openchip/shared";
import { evaluateCompliance, transitionCaseStatus } from "@openchip/workflow";
import { randomUUID } from "node:crypto";
import { Pool, PoolClient } from "pg";
import { getSupplierConfigStore, SupplierConfigStore } from "./supplier-config-store";

const INVITATION_TTL_DAYS = 14;
const DEFAULT_INVITATION_OPEN_HOURS = 48;
const DEFAULT_ONBOARDING_COMPLETION_DAYS = 14;
const DEFAULT_SAP_BASE_URL = "https://sap.example.local/api";
const DEFAULT_SAP_API_KEY = "test-sap-key";
const DEFAULT_DOCUWARE_BASE_URL = "https://docuware.example.local/api";
const DEFAULT_DOCUWARE_API_KEY = "test-docuware-key";
const SUPPLIER_OTP_TTL_MINUTES = 10;
const SUPPLIER_OTP_MAX_ATTEMPTS = 5;

type PortalSettingsUpdateInput = Omit<PortalSettings, "updatedAt" | "updatedBy">;

function nowIso(): string {
  return new Date().toISOString();
}

function addDays(base: Date, days: number): Date {
  const copy = new Date(base);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function addHours(base: Date, hours: number): Date {
  const copy = new Date(base);
  copy.setHours(copy.getHours() + hours);
  return copy;
}

function addMinutes(base: Date, minutes: number): Date {
  const copy = new Date(base);
  copy.setMinutes(copy.getMinutes() + minutes);
  return copy;
}

function createOtpCode(): string {
  return `${Math.floor(100000 + Math.random() * 900000)}`;
}

function cloneCase(onboardingCase: OnboardingCase): OnboardingCase {
  return {
    ...onboardingCase,
    slaSnapshot: { ...onboardingCase.slaSnapshot },
    supplierAddress: onboardingCase.supplierAddress === null ? null : { ...onboardingCase.supplierAddress },
    supplierBankAccount: onboardingCase.supplierBankAccount === null ? null : { ...onboardingCase.supplierBankAccount },
    supplierDraft:
      onboardingCase.supplierDraft === null
        ? null
        : {
            supplierIdentity: { ...onboardingCase.supplierDraft.supplierIdentity },
            address: { ...onboardingCase.supplierDraft.address },
            bankAccount: { ...onboardingCase.supplierDraft.bankAccount },
            uploadedDocuments: onboardingCase.supplierDraft.uploadedDocuments.map((item) => ({
              code: item.code,
              files: item.files.map((file) => ({ ...file }))
            })),
            updatedAt: onboardingCase.supplierDraft.updatedAt
          },
    supplierOtpState: { ...onboardingCase.supplierOtpState },
    statusHistory: onboardingCase.statusHistory.map((entry) => ({ ...entry })),
    actionHistory: (onboardingCase.actionHistory ?? []).map((entry) => ({ ...entry })),
    documents: onboardingCase.documents.map((document) => ({
      ...document,
      files: document.files.map((file) => ({ ...file }))
    }))
  };
}

function cloneUser(user: InternalUser): InternalUser {
  return { ...user };
}

function clonePortalSettings(settings: PortalSettings): PortalSettings {
  return { ...settings };
}

function createDocumentSubmission(
  code: DocumentCode,
  requirementLevel: "mandatory" | "optional",
  files: UploadedDocumentFile[]
): DocumentSubmission {
  const uploadedAt = files.length > 0 ? files[files.length - 1]?.uploadedAt ?? nowIso() : null;

  return {
    code,
    requirementLevel,
    status: files.length > 0 ? "pending_validation" : "pending_reception",
    version: 1,
    uploadedAt,
    files,
    approver: null,
    validationDate: null,
    validFrom: null,
    validTo: null,
    comments: null
  };
}

function canSupplierEditResponse(status: CaseStatus): boolean {
  return status === "invitation_sent" || status === "portal_accessed" || status === "response_in_progress";
}

function toRequirementSummarySubmission(row: RequirementPreviewRow): DocumentSubmission {
  return {
    code: row.code,
    requirementLevel: row.requirementLevel,
    status: "pending_reception",
    version: 1,
    uploadedAt: null,
    files: [],
    approver: null,
    validationDate: null,
    validFrom: null,
    validTo: null,
    comments: null
  };
}

function isApplicableRequirement(
  requirementLevel: DocumentSubmission["requirementLevel"]
): requirementLevel is "mandatory" | "optional" {
  return requirementLevel === "mandatory" || requirementLevel === "optional";
}

function assertCaseExists(onboardingCase: OnboardingCase | undefined, caseId: string): OnboardingCase {
  if (onboardingCase === undefined) {
    throw new Error(`Case ${caseId} not found.`);
  }

  return onboardingCase;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function cloneBankAccount(bankAccount: SupplierBankAccount): SupplierBankAccount {
  return { ...bankAccount };
}

function createDefaultPortalSettings(): PortalSettings {
  return {
    invitationOpenHours: DEFAULT_INVITATION_OPEN_HOURS,
    onboardingCompletionDays: DEFAULT_ONBOARDING_COMPLETION_DAYS,
    sapBaseUrl: process.env.SAP_BASE_URL ?? DEFAULT_SAP_BASE_URL,
    sapApiKey: process.env.SAP_INTEGRATION_API_KEY ?? DEFAULT_SAP_API_KEY,
    docuwareBaseUrl: process.env.DOCUWARE_BASE_URL ?? DEFAULT_DOCUWARE_BASE_URL,
    docuwareApiKey: process.env.DOCUWARE_API_KEY ?? DEFAULT_DOCUWARE_API_KEY,
    updatedAt: nowIso(),
    updatedBy: "system.bootstrap"
  };
}

function createDefaultUsers(): InternalUser[] {
  const timestamp = nowIso();

  return [
    {
      id: "user-finance-001",
      email: "finance@openchip.local",
      displayName: "Finance User",
      role: "finance",
      active: true,
      createdAt: timestamp,
      updatedAt: timestamp
    },
    {
      id: "user-purchasing-001",
      email: "purchasing@openchip.local",
      displayName: "Purchasing User",
      role: "purchasing",
      active: true,
      createdAt: timestamp,
      updatedAt: timestamp
    },
    {
      id: "user-requester-001",
      email: "requester@openchip.local",
      displayName: "Requester User",
      role: "requester",
      active: true,
      createdAt: timestamp,
      updatedAt: timestamp
    },
    {
      id: "user-admin-001",
      email: "admin@openchip.local",
      displayName: "Openchip Admin",
      role: "admin",
      active: true,
      createdAt: timestamp,
      updatedAt: timestamp
    },
    {
      id: "user-compliance-001",
      email: "compliance@openchip.local",
      displayName: "Compliance User",
      role: "compliance",
      active: true,
      createdAt: timestamp,
      updatedAt: timestamp
    }
  ];
}

interface CreateCaseOptions {
  sourceChannel?: CaseSourceChannel | undefined;
  sourceSystem?: string | null | undefined;
  sourceReference?: string | null | undefined;
  requestedBySapUser?: string | null | undefined;
  sourceRequestedAt?: string | null | undefined;
  integrationPayload?: Record<string, string> | undefined;
}

interface Store {
  cases: Map<string, OnboardingCase>;
  integrationEvents: IntegrationEvent[];
  users: Map<string, InternalUser>;
  portalSettings: PortalSettings;
}

interface PersistedStorePayload {
  cases: OnboardingCase[];
  integrationEvents: IntegrationEvent[];
  users: InternalUser[];
  portalSettings: PortalSettings;
}

export interface OnboardingRepository {
  listCases(): Promise<OnboardingCase[]>;
  getCase(caseId: string): Promise<OnboardingCase | null>;
  getCaseBySourceReference(
    sourceChannel: CaseSourceChannel,
    sourceSystem: string,
    sourceReference: string
  ): Promise<OnboardingCase | null>;
  createCase(input: CreateCaseInput, actor?: string, options?: CreateCaseOptions): Promise<OnboardingCase>;
  updateSupplierInfo(input: UpdateSupplierInfoInput, actor: string): Promise<OnboardingCase>;
  sendInvitation(caseId: string, actor: string): Promise<OnboardingCase>;
  getCaseByInvitationToken(token: string): Promise<OnboardingCase | null>;
  getSupplierSession(token: string): Promise<SupplierSession | null>;
  registerPortalAccess(token: string, actor: string): Promise<OnboardingCase>;
  submitSupplierResponse(input: SupplierSubmissionInput, actor: string): Promise<OnboardingCase>;
  validateDocument(input: ValidateDocumentInput): Promise<OnboardingCase>;
  approveAllMandatoryDocuments(caseId: string, approver: string): Promise<OnboardingCase>;
  completeValidation(caseId: string, actor: string): Promise<OnboardingCase>;
  createSupplierInSap(caseId: string, actor: string): Promise<OnboardingCase>;
  cancelCase(caseId: string, actor: string, reason: string): Promise<OnboardingCase>;
  listIntegrationEvents(): Promise<IntegrationEvent[]>;
  getRequirementSummary(categoryCode: SupplierCategoryCode): Promise<DocumentSubmission[]>;
  resetStore(): Promise<void>;
  forceExpireInvitation(caseId: string): Promise<OnboardingCase>;
  resubmitRejectedDocuments(caseId: string, actor: string): Promise<OnboardingCase>;
  setDocumentExpiry(caseId: string, code: DocumentCode, validTo: string | null, actor?: string): Promise<OnboardingCase>;
  listUsers(): Promise<InternalUser[]>;
  getUser(userId: string): Promise<InternalUser | null>;
  getUserByEmail(email: string): Promise<InternalUser | null>;
  upsertUser(input: UserUpsertInput, actor: string): Promise<InternalUser>;
  getPortalSettings(): Promise<PortalSettings>;
  listSupplierTypes(includeInactive?: boolean): Promise<SupplierTypeDefinition[]>;
  createSupplierType(input: SupplierTypeCreateInput, actor: string): Promise<SupplierTypeDefinition>;
  setSupplierTypeStatus(input: SupplierTypeStatusInput, actor: string): Promise<SupplierTypeDefinition>;
  listSupplierCategories(includeInactive?: boolean): Promise<SupplierCategoryDefinition[]>;
  getSupplierCategory(categoryCode: SupplierCategoryCode): Promise<SupplierCategoryDefinition | null>;
  createSupplierCategory(input: SupplierCategoryCreateInput, actor: string): Promise<SupplierCategoryDefinition>;
  setSupplierCategoryStatus(input: SupplierCategoryStatusInput, actor: string): Promise<SupplierCategoryDefinition>;
  listDocumentDefinitions(includeInactive?: boolean): Promise<DocumentDefinition[]>;
  getDocumentDefinition(code: DocumentCode): Promise<DocumentDefinition | null>;
  createDocumentDefinition(input: DocumentDefinitionCreateInput, actor: string): Promise<DocumentDefinition>;
  updateDocumentDefinition(input: DocumentDefinitionUpdateInput, actor: string): Promise<DocumentDefinition>;
  setDocumentDefinitionStatus(input: DocumentDefinitionStatusInput, actor: string): Promise<DocumentDefinition>;
  setDocumentTemplatePath(input: DocumentTemplatePathUpdateInput, actor: string): Promise<DocumentDefinition>;
  listRequirementMatrixEntries(categoryCode: SupplierCategoryCode): Promise<RequirementMatrixEntry[]>;
  updateRequirementMatrixEntry(input: RequirementMatrixUpdateInput, actor: string): Promise<RequirementMatrixEntry>;
  getRequirementPreview(categoryCode: SupplierCategoryCode): Promise<RequirementPreviewRow[]>;
  listRequirementPreviewsForActiveCategories(): Promise<Record<string, RequirementPreviewRow[]>>;
  updatePortalSettings(
    input: PortalSettingsUpdateInput,
    actor: string
  ): Promise<PortalSettings>;
  recordWorkflowTrigger(
    caseId: string,
    actor: string,
    workflowName: "invitation_open_sla" | "onboarding_completion_sla" | "document_expiry",
    runId: string | null,
    mode: "workflow" | "fallback"
  ): Promise<OnboardingCase>;
  recordCaseAction(caseId: string, actor: string, actionType: CaseActionType, note: string): Promise<OnboardingCase>;
  requestSupplierOtp(input: SupplierOtpRequestInput, actor: string): Promise<OnboardingCase>;
  verifySupplierOtp(input: SupplierOtpVerifyInput, actor: string): Promise<OnboardingCase>;
  saveSupplierDraft(input: SupplierDraftSaveInput, actor: string): Promise<OnboardingCase>;
  upsertSupplierDraftDocuments(token: string, documents: SupplierSubmissionInput["uploadedDocuments"], actor: string): Promise<OnboardingCase>;
}

class InMemoryOnboardingRepository implements OnboardingRepository {
  constructor(
    private readonly store: Store,
    private readonly supplierConfigStore: SupplierConfigStore
  ) {}

  private pushHistory(onboardingCase: OnboardingCase, status: CaseStatus, actor: string, note: string): void {
    onboardingCase.status = status;
    onboardingCase.updatedAt = nowIso();
    onboardingCase.statusHistory.push({
      status,
      changedAt: onboardingCase.updatedAt,
      actor,
      note
    });
  }

  private pushEvent(onboardingCase: OnboardingCase, eventType: string, actor: string, payload: Record<string, string>): void {
    this.store.integrationEvents.push({
      eventType,
      caseId: onboardingCase.id,
      supplierVat: onboardingCase.supplierVat,
      timestamp: nowIso(),
      actor,
      payload,
      deliveryStatus: "pending"
    });
  }

  async listCases(): Promise<OnboardingCase[]> {
    return [...this.store.cases.values()]
      .map((onboardingCase) => cloneCase(onboardingCase))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async getCase(caseId: string): Promise<OnboardingCase | null> {
    const onboardingCase = this.store.cases.get(caseId);
    return onboardingCase === undefined ? null : cloneCase(onboardingCase);
  }

  async getCaseBySourceReference(
    sourceChannel: CaseSourceChannel,
    sourceSystem: string,
    sourceReference: string
  ): Promise<OnboardingCase | null> {
    const onboardingCase = [...this.store.cases.values()].find(
      (candidate) =>
        candidate.sourceChannel === sourceChannel &&
        candidate.sourceSystem === sourceSystem &&
        candidate.sourceReference === sourceReference
    );

    return onboardingCase === undefined ? null : cloneCase(onboardingCase);
  }

  async createCase(input: CreateCaseInput, actor = "system", options: CreateCaseOptions = {}): Promise<OnboardingCase> {
    const existingCase = [...this.store.cases.values()].find(
      (candidate) => candidate.supplierVat.toLowerCase() === input.supplierVat.toLowerCase() && candidate.status !== "cancelled"
    );

    if (existingCase !== undefined) {
      throw new Error("A supplier with the same VAT already exists in onboarding.");
    }

    const category = await this.supplierConfigStore.getSupplierCategory(input.categoryCode);
    if (category === null || !category.active) {
      throw new Error("Selected supplier category is invalid or inactive.");
    }

    const id = randomUUID();
    const createdAt = nowIso();
    const settings = this.store.portalSettings;

    const onboardingCase: OnboardingCase = {
      id,
      supplierName: input.supplierName,
      supplierVat: input.supplierVat,
      supplierContactName: input.supplierContactName,
      supplierContactEmail: input.supplierContactEmail,
      requester: input.requester,
      createdBy: actor,
      sourceChannel: options.sourceChannel ?? "manual",
      sourceSystem: options.sourceSystem ?? null,
      sourceReference: options.sourceReference ?? null,
      requestedBySapUser: options.requestedBySapUser ?? null,
      sourceRequestedAt: options.sourceRequestedAt ?? null,
      categoryCode: input.categoryCode,
      status: "onboarding_initiated",
      invitationToken: null,
      invitationExpiresAt: null,
      invitationSentAt: null,
      portalFirstAccessAt: null,
      invitationOpenDeadlineAt: null,
      onboardingCompletionDeadlineAt: null,
      slaSnapshot: {
        invitationOpenHours: settings.invitationOpenHours,
        onboardingCompletionDays: settings.onboardingCompletionDays
      },
      supplierAddress: null,
      supplierCountry: null,
      supplierBankAccount: null,
      supplierDraft: null,
      supplierOtpState: {
        code: null,
        expiresAt: null,
        attemptsRemaining: SUPPLIER_OTP_MAX_ATTEMPTS,
        requestedAt: null,
        verifiedAt: null
      },
      createdAt,
      updatedAt: createdAt,
      statusHistory: [
        {
          status: "onboarding_initiated",
          changedAt: createdAt,
          actor,
          note: "Onboarding case created"
        }
      ],
      actionHistory: [],
      documents: []
    };

    this.store.cases.set(onboardingCase.id, onboardingCase);
    this.pushEvent(onboardingCase, "case_created", actor, {
      categoryCode: onboardingCase.categoryCode,
      sourceChannel: onboardingCase.sourceChannel
    });

    if (onboardingCase.sourceChannel === "sap_pr") {
      this.pushEvent(onboardingCase, "sap_pr_new_supplier_received", actor, {
        sapPrId: onboardingCase.sourceReference ?? "unknown",
        sapSystem: onboardingCase.sourceSystem ?? "unknown",
        requesterSapUserId: onboardingCase.requestedBySapUser ?? "unknown",
        requestedAt: onboardingCase.sourceRequestedAt ?? onboardingCase.createdAt,
        ...options.integrationPayload
      });
    }

    return cloneCase(onboardingCase);
  }

  async updateSupplierInfo(input: UpdateSupplierInfoInput, actor: string): Promise<OnboardingCase> {
    const onboardingCase = assertCaseExists(this.store.cases.get(input.caseId), input.caseId);

    if (onboardingCase.status === "supplier_created_in_sap" || onboardingCase.status === "cancelled") {
      throw new Error("Supplier information can only be edited before SAP creation or cancellation.");
    }

    const duplicateCase = [...this.store.cases.values()].find(
      (candidate) =>
        candidate.id !== input.caseId &&
        candidate.status !== "cancelled" &&
        candidate.supplierVat.toLowerCase() === input.supplierVat.toLowerCase()
    );

    if (duplicateCase !== undefined) {
      throw new Error("A supplier with the same VAT already exists in onboarding.");
    }

    const changedFields: string[] = [];

    if (onboardingCase.supplierName !== input.supplierName) {
      onboardingCase.supplierName = input.supplierName;
      changedFields.push("supplierName");
    }

    if (onboardingCase.supplierVat !== input.supplierVat) {
      onboardingCase.supplierVat = input.supplierVat;
      changedFields.push("supplierVat");
    }

    if (onboardingCase.supplierContactName !== input.supplierContactName) {
      onboardingCase.supplierContactName = input.supplierContactName;
      changedFields.push("supplierContactName");
    }

    if (onboardingCase.supplierContactEmail !== input.supplierContactEmail) {
      onboardingCase.supplierContactEmail = input.supplierContactEmail;
      changedFields.push("supplierContactEmail");
    }

    if (changedFields.length === 0) {
      return cloneCase(onboardingCase);
    }

    const changedAt = nowIso();
    onboardingCase.updatedAt = changedAt;
    onboardingCase.actionHistory.push({
      actionType: "supplier_info_updated",
      changedAt,
      actor,
      note: `Updated supplier fields: ${changedFields.join(", ")}`
    });

    this.pushEvent(onboardingCase, "supplier_info_updated", actor, {
      changedFields: changedFields.join(",")
    });

    return cloneCase(onboardingCase);
  }

  async sendInvitation(caseId: string, actor: string): Promise<OnboardingCase> {
    const onboardingCase = assertCaseExists(this.store.cases.get(caseId), caseId);

    if (onboardingCase.status !== "onboarding_initiated") {
      throw new Error("Invitation can only be sent from onboarding_initiated status.");
    }

    const nextStatus = transitionCaseStatus(onboardingCase.status, "invitation_sent");
    const invitationSentAt = nowIso();
    const invitationDate = new Date(invitationSentAt);
    onboardingCase.invitationToken = randomUUID();
    onboardingCase.invitationExpiresAt = addDays(invitationDate, INVITATION_TTL_DAYS).toISOString();
    onboardingCase.invitationSentAt = invitationSentAt;
    onboardingCase.invitationOpenDeadlineAt = addHours(
      invitationDate,
      onboardingCase.slaSnapshot.invitationOpenHours
    ).toISOString();
    onboardingCase.onboardingCompletionDeadlineAt = addDays(
      invitationDate,
      onboardingCase.slaSnapshot.onboardingCompletionDays
    ).toISOString();

    this.pushHistory(onboardingCase, nextStatus, actor, "Invitation sent to supplier");
    this.pushEvent(onboardingCase, "invitation_sent", actor, {
      invitationToken: onboardingCase.invitationToken,
      invitationOpenDeadlineAt: onboardingCase.invitationOpenDeadlineAt,
      onboardingCompletionDeadlineAt: onboardingCase.onboardingCompletionDeadlineAt
    });

    return cloneCase(onboardingCase);
  }

  async getCaseByInvitationToken(token: string): Promise<OnboardingCase | null> {
    const onboardingCase = [...this.store.cases.values()].find((candidate) => candidate.invitationToken === token);
    return onboardingCase === undefined ? null : cloneCase(onboardingCase);
  }

  async getSupplierSession(token: string): Promise<SupplierSession | null> {
    const onboardingCase = [...this.store.cases.values()].find((candidate) => candidate.invitationToken === token);

    if (onboardingCase === undefined || onboardingCase.invitationExpiresAt === null) {
      return null;
    }

    if (new Date(onboardingCase.invitationExpiresAt).getTime() < Date.now()) {
      return null;
    }

    return {
      token,
      caseId: onboardingCase.id,
      expiresAt: onboardingCase.invitationExpiresAt,
      otpVerified: onboardingCase.supplierOtpState.verifiedAt !== null,
      supplierContactEmail: onboardingCase.supplierContactEmail
    };
  }

  async registerPortalAccess(token: string, actor: string): Promise<OnboardingCase> {
    const onboardingCase = [...this.store.cases.values()].find((candidate) => candidate.invitationToken === token);

    if (onboardingCase === undefined) {
      throw new Error("Invalid supplier invitation token.");
    }

    if (onboardingCase.portalFirstAccessAt === null) {
      onboardingCase.portalFirstAccessAt = nowIso();
    }

    if (onboardingCase.status === "invitation_sent") {
      const nextStatus = transitionCaseStatus(onboardingCase.status, "portal_accessed");
      this.pushHistory(onboardingCase, nextStatus, actor, "Supplier accessed the portal");
      this.pushEvent(onboardingCase, "portal_accessed", actor, {});
    }

    return cloneCase(onboardingCase);
  }

  async requestSupplierOtp(input: SupplierOtpRequestInput, actor: string): Promise<OnboardingCase> {
    const onboardingCase = [...this.store.cases.values()].find((candidate) => candidate.invitationToken === input.token);
    if (onboardingCase === undefined || onboardingCase.invitationExpiresAt === null) {
      throw new Error("Invalid supplier invitation token.");
    }

    if (new Date(onboardingCase.invitationExpiresAt).getTime() < Date.now()) {
      throw new Error("Supplier invitation has expired.");
    }

    const requestedAt = nowIso();
    onboardingCase.supplierOtpState = {
      code: createOtpCode(),
      expiresAt: addMinutes(new Date(requestedAt), SUPPLIER_OTP_TTL_MINUTES).toISOString(),
      attemptsRemaining: SUPPLIER_OTP_MAX_ATTEMPTS,
      requestedAt,
      verifiedAt: null
    };
    onboardingCase.updatedAt = requestedAt;

    this.pushEvent(onboardingCase, "supplier_otp_requested", actor, {
      expiresAt: onboardingCase.supplierOtpState.expiresAt ?? "unknown"
    });

    return cloneCase(onboardingCase);
  }

  async verifySupplierOtp(input: SupplierOtpVerifyInput, actor: string): Promise<OnboardingCase> {
    const onboardingCase = [...this.store.cases.values()].find((candidate) => candidate.invitationToken === input.token);
    if (onboardingCase === undefined || onboardingCase.invitationExpiresAt === null) {
      throw new Error("Invalid supplier invitation token.");
    }

    if (new Date(onboardingCase.invitationExpiresAt).getTime() < Date.now()) {
      throw new Error("Supplier invitation has expired.");
    }

    const otpState = onboardingCase.supplierOtpState;
    if (otpState.code === null || otpState.expiresAt === null) {
      throw new Error("OTP has not been requested.");
    }
    if (new Date(otpState.expiresAt).getTime() < Date.now()) {
      throw new Error("OTP has expired.");
    }
    if (otpState.attemptsRemaining <= 0) {
      throw new Error("OTP attempts exceeded.");
    }

    if (otpState.code !== input.otpCode) {
      otpState.attemptsRemaining -= 1;
      onboardingCase.updatedAt = nowIso();
      this.pushEvent(onboardingCase, "supplier_otp_failed", actor, {
        attemptsRemaining: otpState.attemptsRemaining.toString()
      });
      throw new Error("Invalid OTP.");
    }

    const verifiedAt = nowIso();
    onboardingCase.supplierOtpState = {
      ...otpState,
      code: null,
      verifiedAt
    };
    onboardingCase.updatedAt = verifiedAt;
    this.pushEvent(onboardingCase, "supplier_otp_verified", actor, {});
    return cloneCase(onboardingCase);
  }

  async saveSupplierDraft(input: SupplierDraftSaveInput, actor: string): Promise<OnboardingCase> {
    const onboardingCase = [...this.store.cases.values()].find((candidate) => candidate.invitationToken === input.token);
    if (onboardingCase === undefined || onboardingCase.invitationExpiresAt === null) {
      throw new Error("Invalid supplier invitation token.");
    }
    if (!canSupplierEditResponse(onboardingCase.status)) {
      throw new Error("Supplier draft can only be edited while the response is open.");
    }

    if (onboardingCase.status === "invitation_sent") {
      const accessedStatus = transitionCaseStatus(onboardingCase.status, "portal_accessed");
      this.pushHistory(onboardingCase, accessedStatus, actor, "Supplier accessed portal during draft save");
    }
    if (onboardingCase.status === "portal_accessed") {
      const progressStatus = transitionCaseStatus(onboardingCase.status, "response_in_progress");
      this.pushHistory(onboardingCase, progressStatus, actor, "Supplier started response");
    }

    const currentDraft = onboardingCase.supplierDraft ?? {
      supplierIdentity: {},
      address: {},
      bankAccount: {},
      uploadedDocuments: [],
      updatedAt: nowIso()
    };

    onboardingCase.supplierDraft = {
      supplierIdentity: {
        ...currentDraft.supplierIdentity,
        ...input.supplierIdentity
      },
      address: {
        ...currentDraft.address,
        ...input.address
      },
      bankAccount: {
        ...currentDraft.bankAccount,
        ...input.bankAccount
      },
      uploadedDocuments: currentDraft.uploadedDocuments.map((entry) => ({
        code: entry.code,
        files: entry.files.map((file) => ({ ...file }))
      })),
      updatedAt: nowIso()
    };
    onboardingCase.updatedAt = onboardingCase.supplierDraft.updatedAt;
    this.pushEvent(onboardingCase, "supplier_draft_saved", actor, {});
    return cloneCase(onboardingCase);
  }

  async upsertSupplierDraftDocuments(
    token: string,
    documents: SupplierSubmissionInput["uploadedDocuments"],
    actor: string
  ): Promise<OnboardingCase> {
    const onboardingCase = [...this.store.cases.values()].find((candidate) => candidate.invitationToken === token);
    if (onboardingCase === undefined || onboardingCase.invitationExpiresAt === null) {
      throw new Error("Invalid supplier invitation token.");
    }
    if (!canSupplierEditResponse(onboardingCase.status)) {
      throw new Error("Supplier documents can only be uploaded while the response is open.");
    }

    const currentDraft = onboardingCase.supplierDraft ?? {
      supplierIdentity: {},
      address: {},
      bankAccount: {},
      uploadedDocuments: [],
      updatedAt: nowIso()
    };

    const mapByCode = new Map<string, UploadedDocumentFile[]>();
    for (const existing of currentDraft.uploadedDocuments) {
      mapByCode.set(existing.code, [...existing.files]);
    }
    for (const incoming of documents) {
      const currentFiles = mapByCode.get(incoming.code) ?? [];
      currentFiles.push(...incoming.files.map((file) => ({ ...file })));
      mapByCode.set(incoming.code, currentFiles);
    }

    onboardingCase.supplierDraft = {
      ...currentDraft,
      uploadedDocuments: [...mapByCode.entries()].map(([code, files]) => ({
        code,
        files
      })),
      updatedAt: nowIso()
    };
    onboardingCase.updatedAt = onboardingCase.supplierDraft.updatedAt;

    if (onboardingCase.status === "invitation_sent") {
      const accessedStatus = transitionCaseStatus(onboardingCase.status, "portal_accessed");
      this.pushHistory(onboardingCase, accessedStatus, actor, "Supplier accessed portal during document upload");
    }
    if (onboardingCase.status === "portal_accessed") {
      const progressStatus = transitionCaseStatus(onboardingCase.status, "response_in_progress");
      this.pushHistory(onboardingCase, progressStatus, actor, "Supplier started response");
    }

    this.pushEvent(onboardingCase, "supplier_draft_documents_upserted", actor, {
      documentCount: onboardingCase.supplierDraft.uploadedDocuments.length.toString()
    });

    return cloneCase(onboardingCase);
  }

  async submitSupplierResponse(input: SupplierSubmissionInput, actor: string): Promise<OnboardingCase> {
    const onboardingCase = [...this.store.cases.values()].find((candidate) => candidate.invitationToken === input.token);

    if (onboardingCase === undefined) {
      throw new Error("Invalid supplier invitation token.");
    }

    if (onboardingCase.portalFirstAccessAt === null) {
      onboardingCase.portalFirstAccessAt = nowIso();
    }

    if (onboardingCase.status === "invitation_sent") {
      const accessedStatus = transitionCaseStatus(onboardingCase.status, "portal_accessed");
      this.pushHistory(onboardingCase, accessedStatus, actor, "Supplier accessed portal during submission");
    }

    if (onboardingCase.status === "portal_accessed") {
      const progressStatus = transitionCaseStatus(onboardingCase.status, "response_in_progress");
      this.pushHistory(onboardingCase, progressStatus, actor, "Supplier started response");
    }

    if (onboardingCase.status !== "response_in_progress") {
      throw new Error("Supplier response can only be submitted from response_in_progress status.");
    }

    onboardingCase.supplierAddress = { ...input.address };
    onboardingCase.supplierCountry = input.address.country;
    onboardingCase.supplierBankAccount = cloneBankAccount(input.bankAccount);
    const changedIdentityFields: string[] = [];
    if (onboardingCase.supplierName !== input.supplierIdentity.supplierName) {
      onboardingCase.supplierName = input.supplierIdentity.supplierName;
      changedIdentityFields.push("supplierName");
    }
    if (onboardingCase.supplierVat !== input.supplierIdentity.supplierVat) {
      const duplicateCase = [...this.store.cases.values()].find(
        (candidate) =>
          candidate.id !== onboardingCase.id &&
          candidate.status !== "cancelled" &&
          candidate.supplierVat.toLowerCase() === input.supplierIdentity.supplierVat.toLowerCase()
      );
      if (duplicateCase !== undefined) {
        throw new Error("A supplier with the same VAT already exists in onboarding.");
      }
      onboardingCase.supplierVat = input.supplierIdentity.supplierVat;
      changedIdentityFields.push("supplierVat");
    }
    if (onboardingCase.supplierContactName !== input.supplierIdentity.supplierContactName) {
      onboardingCase.supplierContactName = input.supplierIdentity.supplierContactName;
      changedIdentityFields.push("supplierContactName");
    }
    if (changedIdentityFields.length > 0) {
      const changedAt = nowIso();
      onboardingCase.actionHistory.push({
        actionType: "supplier_info_updated",
        changedAt,
        actor,
        note: `Supplier confirmed identity and updated fields: ${changedIdentityFields.join(", ")}`
      });
      this.pushEvent(onboardingCase, "supplier_identity_confirmed", actor, {
        changedFields: changedIdentityFields.join(",")
      });
    }

    const requirements = await this.supplierConfigStore.listRequirementPreviewRows(onboardingCase.categoryCode);
    const uploadedDocumentsByCode = new Map<DocumentCode, UploadedDocumentFile[]>();
    const existingDocumentsByCode = new Map(onboardingCase.documents.map((document) => [document.code, document]));
    const allUploadedDocuments =
      input.uploadedDocuments.length > 0
        ? input.uploadedDocuments
        : onboardingCase.supplierDraft?.uploadedDocuments ?? [];

    for (const uploadedDocument of allUploadedDocuments) {
      const existing = uploadedDocumentsByCode.get(uploadedDocument.code);
      if (existing === undefined) {
        uploadedDocumentsByCode.set(uploadedDocument.code, [...uploadedDocument.files]);
      } else {
        existing.push(...uploadedDocument.files);
      }
    }

    const documents: DocumentSubmission[] = [];
    for (const row of requirements) {
      if (!isApplicableRequirement(row.requirementLevel)) {
        continue;
      }

      const incomingFiles = uploadedDocumentsByCode.get(row.code) ?? [];
      const existingDocument = existingDocumentsByCode.get(row.code);

      if (existingDocument !== undefined) {
        const mergedFiles = [...existingDocument.files, ...incomingFiles];

        if (existingDocument.status === "rejected") {
          if (incomingFiles.length === 0) {
            throw new Error(`Rejected requirement ${row.code} is missing uploaded files.`);
          }

          documents.push({
            ...existingDocument,
            requirementLevel: row.requirementLevel,
            status: "pending_validation",
            uploadedAt: incomingFiles.at(-1)?.uploadedAt ?? nowIso(),
            files: mergedFiles,
            approver: null,
            validationDate: null,
            validFrom: null,
            validTo: null,
            comments: null
          });
          continue;
        }

        if (incomingFiles.length > 0) {
          documents.push({
            ...existingDocument,
            requirementLevel: row.requirementLevel,
            status: "pending_validation",
            uploadedAt: incomingFiles.at(-1)?.uploadedAt ?? existingDocument.uploadedAt ?? nowIso(),
            files: mergedFiles,
            approver: null,
            validationDate: null,
            validFrom: null,
            validTo: null,
            comments: null
          });
          continue;
        }

        documents.push({
          ...existingDocument,
          requirementLevel: row.requirementLevel
        });
        continue;
      }

      if (row.requirementLevel === "mandatory" && incomingFiles.length === 0) {
        throw new Error(`Mandatory requirement ${row.code} is missing uploaded files.`);
      }

      documents.push(createDocumentSubmission(row.code, row.requirementLevel, incomingFiles));
    }

    onboardingCase.documents = documents;
    onboardingCase.supplierDraft = null;

    const nextStatus = transitionCaseStatus(onboardingCase.status, "submission_completed");
    this.pushHistory(onboardingCase, nextStatus, actor, "Supplier submission completed");
    this.pushEvent(onboardingCase, "submission_completed", actor, {
      documentCount: onboardingCase.documents.length.toString()
    });

    return cloneCase(onboardingCase);
  }

  async validateDocument(input: ValidateDocumentInput): Promise<OnboardingCase> {
    const onboardingCase = assertCaseExists(this.store.cases.get(input.caseId), input.caseId);

    if (onboardingCase.status !== "submission_completed") {
      throw new Error("Documents can only be validated after supplier submission is completed.");
    }

    const document = onboardingCase.documents.find((item) => item.code === input.code);
    if (document === undefined) {
      throw new Error(`Document ${input.code} is not required for this case.`);
    }

    const validationDate = nowIso();
    document.approver = input.approver;
    document.validationDate = validationDate;
    document.validFrom = validationDate;
    document.comments = input.comments;

    if (input.decision === "approve") {
      document.status = "approved";
    }

    if (input.decision === "approve_provisionally") {
      document.status = "approved_provisionally";
    }

    if (input.decision === "reject") {
      document.status = "rejected";
      document.version += 1;
      document.validFrom = null;
      document.validTo = null;
      const reopenedStatus = transitionCaseStatus(onboardingCase.status, "response_in_progress");
      this.pushHistory(onboardingCase, reopenedStatus, input.approver, `Document ${document.code} rejected; supplier response reopened`);
      this.pushEvent(onboardingCase, "supplier_rework_requested", input.approver, {
        documentCode: document.code
      });
    }

    this.pushEvent(onboardingCase, "document_validated", input.approver, {
      documentCode: document.code,
      decision: input.decision
    });

    return cloneCase(onboardingCase);
  }

  async approveAllMandatoryDocuments(caseId: string, approver: string): Promise<OnboardingCase> {
    const onboardingCase = assertCaseExists(this.store.cases.get(caseId), caseId);

    if (onboardingCase.status !== "submission_completed") {
      throw new Error("Bulk approval is only available in submission_completed status.");
    }

    for (const document of onboardingCase.documents) {
      if (document.requirementLevel === "mandatory") {
        const validationDate = nowIso();
        document.status = "approved";
        document.approver = approver;
        document.validationDate = validationDate;
        document.validFrom = validationDate;
      }
    }

    this.pushEvent(onboardingCase, "mandatory_documents_bulk_approved", approver, {});
    return cloneCase(onboardingCase);
  }

  async completeValidation(caseId: string, actor: string): Promise<OnboardingCase> {
    const onboardingCase = assertCaseExists(this.store.cases.get(caseId), caseId);

    if (onboardingCase.status !== "submission_completed") {
      throw new Error("Case can only move to validation_completed_pending_supplier_creation from submission_completed.");
    }

    const complianceResult = evaluateCompliance(onboardingCase.documents);
    if (complianceResult.blocked) {
      throw new Error("Validation is not complete. Mandatory blocking documents are still pending or expired.");
    }

    const nextStatus = transitionCaseStatus(onboardingCase.status, "validation_completed_pending_supplier_creation");
    this.pushHistory(onboardingCase, nextStatus, actor, "Validation completed and SAP creation is pending");
    this.pushEvent(onboardingCase, "validation_completed", actor, {
      mandatoryPendingCount: complianceResult.mandatoryPendingCount.toString()
    });

    return cloneCase(onboardingCase);
  }

  async createSupplierInSap(caseId: string, actor: string): Promise<OnboardingCase> {
    const onboardingCase = assertCaseExists(this.store.cases.get(caseId), caseId);

    if (onboardingCase.status !== "validation_completed_pending_supplier_creation") {
      throw new Error("Supplier can only be created in SAP after validation completion.");
    }

    const duplicateVat = [...this.store.cases.values()].find(
      (candidate) =>
        candidate.id !== onboardingCase.id &&
        candidate.supplierVat.toLowerCase() === onboardingCase.supplierVat.toLowerCase() &&
        candidate.status === "supplier_created_in_sap"
    );

    if (duplicateVat !== undefined) {
      throw new Error("A supplier with this VAT already exists in SAP-ready records.");
    }

    const nextStatus = transitionCaseStatus(onboardingCase.status, "supplier_created_in_sap");
    this.pushHistory(onboardingCase, nextStatus, actor, "Supplier created in SAP");
    this.pushEvent(onboardingCase, "supplier_created_in_sap", actor, {});

    return cloneCase(onboardingCase);
  }

  async cancelCase(caseId: string, actor: string, reason: string): Promise<OnboardingCase> {
    const onboardingCase = assertCaseExists(this.store.cases.get(caseId), caseId);

    if (onboardingCase.status === "supplier_created_in_sap" || onboardingCase.status === "cancelled") {
      throw new Error("This case can no longer be cancelled.");
    }

    const nextStatus = transitionCaseStatus(onboardingCase.status, "cancelled");
    this.pushHistory(onboardingCase, nextStatus, actor, reason);
    this.pushEvent(onboardingCase, "case_cancelled", actor, { reason });
    return cloneCase(onboardingCase);
  }

  async resetStore(): Promise<void> {
    this.store.cases.clear();
    this.store.integrationEvents.splice(0, this.store.integrationEvents.length);

    this.store.users.clear();
    for (const user of createDefaultUsers()) {
      this.store.users.set(user.id, user);
    }

    this.store.portalSettings = createDefaultPortalSettings();
    await this.supplierConfigStore.resetToDefaults("test.agent");
  }

  async forceExpireInvitation(caseId: string): Promise<OnboardingCase> {
    const onboardingCase = assertCaseExists(this.store.cases.get(caseId), caseId);

    if (onboardingCase.invitationToken === null) {
      throw new Error("Invitation token has not been generated yet.");
    }

    onboardingCase.invitationExpiresAt = new Date(Date.now() - 60_000).toISOString();
    onboardingCase.updatedAt = nowIso();
    this.pushEvent(onboardingCase, "invitation_expired_forced", "test.agent", {});

    return cloneCase(onboardingCase);
  }

  async resubmitRejectedDocuments(caseId: string, actor: string): Promise<OnboardingCase> {
    const onboardingCase = assertCaseExists(this.store.cases.get(caseId), caseId);

    if (onboardingCase.status !== "submission_completed") {
      throw new Error("Rejected documents can only be resubmitted in submission_completed status.");
    }

    let hasRejectedDocument = false;
    for (const document of onboardingCase.documents) {
      if (document.status === "rejected") {
        hasRejectedDocument = true;
        document.status = "pending_validation";
        document.uploadedAt = nowIso();
        if (document.files.length === 0) {
          document.files.push({
            id: randomUUID(),
            fileName: `resubmitted-${document.code.toLowerCase()}-v${document.version + 1}.pdf`,
            mimeType: "application/pdf",
            sizeBytes: 1024,
            storagePath: `/mock-storage/resubmissions/${caseId}/${document.code}/${randomUUID()}.pdf`,
            uploadedAt: document.uploadedAt,
            uploadedBy: actor
          });
        }
        document.comments = "Supplier uploaded a new version";
      }
    }

    if (!hasRejectedDocument) {
      throw new Error("No rejected documents available for resubmission.");
    }

    this.pushEvent(onboardingCase, "documents_resubmitted", actor, {});
    return cloneCase(onboardingCase);
  }

  async setDocumentExpiry(caseId: string, code: DocumentCode, validTo: string | null, actor = "test.agent"): Promise<OnboardingCase> {
    const onboardingCase = assertCaseExists(this.store.cases.get(caseId), caseId);
    const document = onboardingCase.documents.find((item) => item.code === code);

    if (document === undefined) {
      throw new Error(`Document ${code} is not present in case ${caseId}.`);
    }

    document.validTo = validTo;
    onboardingCase.updatedAt = nowIso();
    this.pushEvent(onboardingCase, "document_expiry_set", actor, {
      documentCode: code,
      validTo: validTo ?? "null"
    });

    return cloneCase(onboardingCase);
  }

  async listIntegrationEvents(): Promise<IntegrationEvent[]> {
    return this.store.integrationEvents.map((event) => ({ ...event, payload: { ...event.payload } }));
  }

  async getRequirementSummary(categoryCode: SupplierCategoryCode): Promise<DocumentSubmission[]> {
    const rows = await this.supplierConfigStore.listRequirementPreviewRows(categoryCode);
    return rows
      .filter((row) => row.requirementLevel !== "not_applicable")
      .map((row) => toRequirementSummarySubmission(row));
  }

  async listUsers(): Promise<InternalUser[]> {
    return [...this.store.users.values()].map(cloneUser).sort((a, b) => a.displayName.localeCompare(b.displayName));
  }

  async getUser(userId: string): Promise<InternalUser | null> {
    const user = this.store.users.get(userId);
    return user === undefined ? null : cloneUser(user);
  }

  async getUserByEmail(email: string): Promise<InternalUser | null> {
    const normalized = normalizeEmail(email);
    const user = [...this.store.users.values()].find((candidate) => normalizeEmail(candidate.email) === normalized);
    return user === undefined ? null : cloneUser(user);
  }

  async upsertUser(input: UserUpsertInput, actor: string): Promise<InternalUser> {
    const normalizedEmail = normalizeEmail(input.email);
    const now = nowIso();

    const duplicateByEmail = [...this.store.users.values()].find(
      (candidate) => normalizeEmail(candidate.email) === normalizedEmail && candidate.id !== input.id
    );

    if (duplicateByEmail !== undefined) {
      throw new Error("A user with this email already exists.");
    }

    if (input.id !== undefined) {
      const existing = this.store.users.get(input.id);
      if (existing === undefined) {
        throw new Error(`User ${input.id} not found.`);
      }

      const updated: InternalUser = {
        ...existing,
        email: normalizedEmail,
        displayName: input.displayName,
        role: input.role,
        active: input.active,
        updatedAt: now
      };

      this.store.users.set(updated.id, updated);
      this.store.integrationEvents.push({
        eventType: "user_updated",
        caseId: "n/a",
        supplierVat: "n/a",
        timestamp: now,
        actor,
        payload: { userId: updated.id, role: updated.role },
        deliveryStatus: "pending"
      });

      return cloneUser(updated);
    }

    const created: InternalUser = {
      id: randomUUID(),
      email: normalizedEmail,
      displayName: input.displayName,
      role: input.role,
      active: input.active,
      createdAt: now,
      updatedAt: now
    };

    this.store.users.set(created.id, created);
    this.store.integrationEvents.push({
      eventType: "user_created",
      caseId: "n/a",
      supplierVat: "n/a",
      timestamp: now,
      actor,
      payload: { userId: created.id, role: created.role },
      deliveryStatus: "pending"
    });

    return cloneUser(created);
  }

  async getPortalSettings(): Promise<PortalSettings> {
    return clonePortalSettings(this.store.portalSettings);
  }

  async updatePortalSettings(
    input: PortalSettingsUpdateInput,
    actor: string
  ): Promise<PortalSettings> {
    this.store.portalSettings = {
      invitationOpenHours: input.invitationOpenHours,
      onboardingCompletionDays: input.onboardingCompletionDays,
      sapBaseUrl: input.sapBaseUrl,
      sapApiKey: input.sapApiKey,
      docuwareBaseUrl: input.docuwareBaseUrl,
      docuwareApiKey: input.docuwareApiKey,
      updatedAt: nowIso(),
      updatedBy: actor
    };

    this.store.integrationEvents.push({
      eventType: "portal_settings_updated",
      caseId: "n/a",
      supplierVat: "n/a",
      timestamp: nowIso(),
      actor,
      payload: {
        invitationOpenHours: this.store.portalSettings.invitationOpenHours.toString(),
        onboardingCompletionDays: this.store.portalSettings.onboardingCompletionDays.toString(),
        sapBaseUrl: this.store.portalSettings.sapBaseUrl,
        sapApiKeyConfigured: this.store.portalSettings.sapApiKey.length > 0 ? "true" : "false",
        docuwareBaseUrl: this.store.portalSettings.docuwareBaseUrl,
        docuwareApiKeyConfigured: this.store.portalSettings.docuwareApiKey.length > 0 ? "true" : "false"
      },
      deliveryStatus: "pending"
    });

    return clonePortalSettings(this.store.portalSettings);
  }

  async listSupplierTypes(includeInactive = false): Promise<SupplierTypeDefinition[]> {
    return this.supplierConfigStore.listSupplierTypes(includeInactive);
  }

  async createSupplierType(input: SupplierTypeCreateInput, actor: string): Promise<SupplierTypeDefinition> {
    return this.supplierConfigStore.createSupplierType(input, actor);
  }

  async setSupplierTypeStatus(input: SupplierTypeStatusInput, actor: string): Promise<SupplierTypeDefinition> {
    return this.supplierConfigStore.setSupplierTypeStatus(input, actor);
  }

  async listSupplierCategories(includeInactive = false): Promise<SupplierCategoryDefinition[]> {
    return this.supplierConfigStore.listSupplierCategories(includeInactive);
  }

  async getSupplierCategory(categoryCode: SupplierCategoryCode): Promise<SupplierCategoryDefinition | null> {
    return this.supplierConfigStore.getSupplierCategory(categoryCode);
  }

  async createSupplierCategory(input: SupplierCategoryCreateInput, actor: string): Promise<SupplierCategoryDefinition> {
    return this.supplierConfigStore.createSupplierCategory(input, actor);
  }

  async setSupplierCategoryStatus(input: SupplierCategoryStatusInput, actor: string): Promise<SupplierCategoryDefinition> {
    return this.supplierConfigStore.setSupplierCategoryStatus(input, actor);
  }

  async listDocumentDefinitions(includeInactive?: boolean): Promise<DocumentDefinition[]> {
    return this.supplierConfigStore.listDocumentDefinitions(includeInactive);
  }

  async getDocumentDefinition(code: DocumentCode): Promise<DocumentDefinition | null> {
    return this.supplierConfigStore.getDocumentDefinition(code);
  }

  async createDocumentDefinition(input: DocumentDefinitionCreateInput, actor: string): Promise<DocumentDefinition> {
    return this.supplierConfigStore.createDocumentDefinition(input, actor);
  }

  async updateDocumentDefinition(input: DocumentDefinitionUpdateInput, actor: string): Promise<DocumentDefinition> {
    return this.supplierConfigStore.updateDocumentDefinition(input, actor);
  }

  async setDocumentDefinitionStatus(input: DocumentDefinitionStatusInput, actor: string): Promise<DocumentDefinition> {
    return this.supplierConfigStore.setDocumentDefinitionStatus(input, actor);
  }

  async setDocumentTemplatePath(input: DocumentTemplatePathUpdateInput, actor: string): Promise<DocumentDefinition> {
    return this.supplierConfigStore.setDocumentTemplatePath(input, actor);
  }

  async listRequirementMatrixEntries(categoryCode: SupplierCategoryCode): Promise<RequirementMatrixEntry[]> {
    return this.supplierConfigStore.listRequirementMatrixEntries(categoryCode);
  }

  async updateRequirementMatrixEntry(input: RequirementMatrixUpdateInput, actor: string): Promise<RequirementMatrixEntry> {
    return this.supplierConfigStore.updateRequirementMatrixEntry(input, actor);
  }

  async getRequirementPreview(categoryCode: SupplierCategoryCode): Promise<RequirementPreviewRow[]> {
    return this.supplierConfigStore.listRequirementPreviewRows(categoryCode);
  }

  async listRequirementPreviewsForActiveCategories(): Promise<Record<string, RequirementPreviewRow[]>> {
    const categories = await this.supplierConfigStore.listSupplierCategories(false);
    return this.supplierConfigStore.listRequirementPreviewByCategoryCodes(categories.map((category) => category.code));
  }

  async recordWorkflowTrigger(
    caseId: string,
    actor: string,
    workflowName: "invitation_open_sla" | "onboarding_completion_sla" | "document_expiry",
    runId: string | null,
    mode: "workflow" | "fallback"
  ): Promise<OnboardingCase> {
    const onboardingCase = assertCaseExists(this.store.cases.get(caseId), caseId);

    this.pushEvent(onboardingCase, "workflow_triggered", actor, {
      workflowName,
      mode,
      runId: runId ?? "fallback"
    });

    return cloneCase(onboardingCase);
  }

  async recordCaseAction(caseId: string, actor: string, actionType: CaseActionType, note: string): Promise<OnboardingCase> {
    const onboardingCase = assertCaseExists(this.store.cases.get(caseId), caseId);

    if (onboardingCase.actionHistory === undefined) {
      onboardingCase.actionHistory = [];
    }
    const changedAt = nowIso();
    onboardingCase.actionHistory.push({
      actionType,
      changedAt,
      actor,
      note
    });
    onboardingCase.updatedAt = changedAt;

    return cloneCase(onboardingCase);
  }
}

const stateRowId = "singleton";

function toPersistedStorePayload(store: Store): PersistedStorePayload {
  return {
    cases: [...store.cases.values()],
    integrationEvents: [...store.integrationEvents],
    users: [...store.users.values()],
    portalSettings: store.portalSettings
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizePersistedCase(rawCase: OnboardingCase): OnboardingCase {
  const rawAddress = rawCase.supplierAddress;
  const normalizedAddress =
    rawAddress !== null &&
    typeof rawAddress === "object" &&
    "street" in rawAddress &&
    "city" in rawAddress &&
    "postalCode" in rawAddress &&
    "country" in rawAddress
      ? {
          street: String(rawAddress.street),
          city: String(rawAddress.city),
          postalCode: String(rawAddress.postalCode),
          country: String(rawAddress.country)
        }
      : null;

  return {
    ...rawCase,
    supplierAddress: normalizedAddress,
    supplierDraft:
      rawCase.supplierDraft === undefined || rawCase.supplierDraft === null
        ? null
        : {
            supplierIdentity: rawCase.supplierDraft.supplierIdentity ?? {},
            address: rawCase.supplierDraft.address ?? {},
            bankAccount: rawCase.supplierDraft.bankAccount ?? {},
            uploadedDocuments: (rawCase.supplierDraft.uploadedDocuments ?? []).map((entry) => ({
              code: entry.code,
              files: entry.files ?? []
            })),
            updatedAt: rawCase.supplierDraft.updatedAt ?? nowIso()
          },
    supplierOtpState:
      rawCase.supplierOtpState === undefined
        ? {
            code: null,
            expiresAt: null,
            attemptsRemaining: SUPPLIER_OTP_MAX_ATTEMPTS,
            requestedAt: null,
            verifiedAt: null
          }
        : {
            code: rawCase.supplierOtpState.code ?? null,
            expiresAt: rawCase.supplierOtpState.expiresAt ?? null,
            attemptsRemaining: rawCase.supplierOtpState.attemptsRemaining ?? SUPPLIER_OTP_MAX_ATTEMPTS,
            requestedAt: rawCase.supplierOtpState.requestedAt ?? null,
            verifiedAt: rawCase.supplierOtpState.verifiedAt ?? null
          }
  };
}

function fromPersistedStorePayload(payload: unknown): Store {
  if (!isRecord(payload)) {
    return createStore();
  }

  const rawCases = payload.cases;
  const rawEvents = payload.integrationEvents;
  const rawUsers = payload.users;
  const rawPortalSettings = payload.portalSettings;

  if (!Array.isArray(rawCases) || !Array.isArray(rawEvents) || !Array.isArray(rawUsers) || !isRecord(rawPortalSettings)) {
    return createStore();
  }

  const cases = new Map<string, OnboardingCase>();
  for (const onboardingCase of rawCases) {
    if (isRecord(onboardingCase) && typeof onboardingCase.id === "string") {
      cases.set(onboardingCase.id, normalizePersistedCase(onboardingCase as unknown as OnboardingCase));
    }
  }

  const users = new Map<string, InternalUser>();
  for (const user of rawUsers) {
    if (isRecord(user) && typeof user.id === "string") {
      users.set(user.id, user as unknown as InternalUser);
    }
  }

  return {
    cases,
    integrationEvents: rawEvents as IntegrationEvent[],
    users,
    portalSettings: normalizePortalSettings(rawPortalSettings)
  };
}

function normalizePortalSettings(rawPortalSettings: Record<string, unknown>): PortalSettings {
  const defaults = createDefaultPortalSettings();

  const invitationOpenHours =
    typeof rawPortalSettings.invitationOpenHours === "number" && Number.isFinite(rawPortalSettings.invitationOpenHours)
      ? rawPortalSettings.invitationOpenHours
      : defaults.invitationOpenHours;
  const onboardingCompletionDays =
    typeof rawPortalSettings.onboardingCompletionDays === "number" &&
    Number.isFinite(rawPortalSettings.onboardingCompletionDays)
      ? rawPortalSettings.onboardingCompletionDays
      : defaults.onboardingCompletionDays;
  const sapBaseUrl =
    typeof rawPortalSettings.sapBaseUrl === "string" && rawPortalSettings.sapBaseUrl.trim().length > 0
      ? rawPortalSettings.sapBaseUrl
      : defaults.sapBaseUrl;
  const sapApiKey =
    typeof rawPortalSettings.sapApiKey === "string" && rawPortalSettings.sapApiKey.trim().length > 0
      ? rawPortalSettings.sapApiKey
      : defaults.sapApiKey;
  const docuwareBaseUrl =
    typeof rawPortalSettings.docuwareBaseUrl === "string" && rawPortalSettings.docuwareBaseUrl.trim().length > 0
      ? rawPortalSettings.docuwareBaseUrl
      : defaults.docuwareBaseUrl;
  const docuwareApiKey =
    typeof rawPortalSettings.docuwareApiKey === "string" && rawPortalSettings.docuwareApiKey.trim().length > 0
      ? rawPortalSettings.docuwareApiKey
      : defaults.docuwareApiKey;
  const updatedAt =
    typeof rawPortalSettings.updatedAt === "string" && rawPortalSettings.updatedAt.trim().length > 0
      ? rawPortalSettings.updatedAt
      : defaults.updatedAt;
  const updatedBy =
    typeof rawPortalSettings.updatedBy === "string" && rawPortalSettings.updatedBy.trim().length > 0
      ? rawPortalSettings.updatedBy
      : defaults.updatedBy;

  return {
    invitationOpenHours,
    onboardingCompletionDays,
    sapBaseUrl,
    sapApiKey,
    docuwareBaseUrl,
    docuwareApiKey,
    updatedAt,
    updatedBy
  };
}

class PostgresOnboardingRepository implements OnboardingRepository {
  private initPromise: Promise<void> | null = null;

  constructor(
    private readonly pool: Pool,
    private readonly supplierConfigStore: SupplierConfigStore
  ) {}

  private async ensureInitialized(): Promise<void> {
    if (this.initPromise !== null) {
      await this.initPromise;
      return;
    }

    this.initPromise = this.initialize();
    await this.initPromise;
  }

  private async initialize(): Promise<void> {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS openchip_onboarding_state (
        id TEXT PRIMARY KEY,
        payload JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL
      );
    `);

    const existing = await this.pool.query<{ id: string }>(
      `SELECT id FROM openchip_onboarding_state WHERE id = $1 LIMIT 1`,
      [stateRowId]
    );

    if (existing.rows.length === 0) {
      await this.pool.query(
        `
        INSERT INTO openchip_onboarding_state (id, payload, updated_at)
        VALUES ($1, $2::jsonb, $3)
        `,
        [stateRowId, JSON.stringify(toPersistedStorePayload(createStore())), nowIso()]
      );
    }
  }

  private async loadStore(client: Pool | PoolClient, lockForUpdate: boolean): Promise<Store> {
    const query = lockForUpdate
      ? `SELECT payload FROM openchip_onboarding_state WHERE id = $1 FOR UPDATE`
      : `SELECT payload FROM openchip_onboarding_state WHERE id = $1`;

    const result = await client.query<{ payload: unknown }>(query, [stateRowId]);
    const payload = result.rows[0]?.payload;
    return fromPersistedStorePayload(payload);
  }

  private async persistStore(client: PoolClient, store: Store): Promise<void> {
    await client.query(
      `
      UPDATE openchip_onboarding_state
      SET payload = $2::jsonb,
          updated_at = $3
      WHERE id = $1
      `,
      [stateRowId, JSON.stringify(toPersistedStorePayload(store)), nowIso()]
    );
  }

  private async withReadStore<T>(callback: (repository: InMemoryOnboardingRepository) => Promise<T>): Promise<T> {
    await this.ensureInitialized();
    const store = await this.loadStore(this.pool, false);
    const repository = new InMemoryOnboardingRepository(store, this.supplierConfigStore);
    return callback(repository);
  }

  private async withWriteStore<T>(callback: (repository: InMemoryOnboardingRepository) => Promise<T>): Promise<T> {
    await this.ensureInitialized();
    const client = await this.pool.connect();

    try {
      await client.query("BEGIN");
      const store = await this.loadStore(client, true);
      const repository = new InMemoryOnboardingRepository(store, this.supplierConfigStore);
      const result = await callback(repository);
      await this.persistStore(client, store);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async listCases(): Promise<OnboardingCase[]> {
    return this.withReadStore((repository) => repository.listCases());
  }

  async getCase(caseId: string): Promise<OnboardingCase | null> {
    return this.withReadStore((repository) => repository.getCase(caseId));
  }

  async getCaseBySourceReference(
    sourceChannel: CaseSourceChannel,
    sourceSystem: string,
    sourceReference: string
  ): Promise<OnboardingCase | null> {
    return this.withReadStore((repository) => repository.getCaseBySourceReference(sourceChannel, sourceSystem, sourceReference));
  }

  async createCase(input: CreateCaseInput, actor?: string, options?: CreateCaseOptions): Promise<OnboardingCase> {
    return this.withWriteStore((repository) => repository.createCase(input, actor, options));
  }

  async updateSupplierInfo(input: UpdateSupplierInfoInput, actor: string): Promise<OnboardingCase> {
    return this.withWriteStore((repository) => repository.updateSupplierInfo(input, actor));
  }

  async sendInvitation(caseId: string, actor: string): Promise<OnboardingCase> {
    return this.withWriteStore((repository) => repository.sendInvitation(caseId, actor));
  }

  async getCaseByInvitationToken(token: string): Promise<OnboardingCase | null> {
    return this.withReadStore((repository) => repository.getCaseByInvitationToken(token));
  }

  async getSupplierSession(token: string): Promise<SupplierSession | null> {
    return this.withReadStore((repository) => repository.getSupplierSession(token));
  }

  async registerPortalAccess(token: string, actor: string): Promise<OnboardingCase> {
    return this.withWriteStore((repository) => repository.registerPortalAccess(token, actor));
  }

  async submitSupplierResponse(input: SupplierSubmissionInput, actor: string): Promise<OnboardingCase> {
    return this.withWriteStore((repository) => repository.submitSupplierResponse(input, actor));
  }

  async validateDocument(input: ValidateDocumentInput): Promise<OnboardingCase> {
    return this.withWriteStore((repository) => repository.validateDocument(input));
  }

  async approveAllMandatoryDocuments(caseId: string, approver: string): Promise<OnboardingCase> {
    return this.withWriteStore((repository) => repository.approveAllMandatoryDocuments(caseId, approver));
  }

  async completeValidation(caseId: string, actor: string): Promise<OnboardingCase> {
    return this.withWriteStore((repository) => repository.completeValidation(caseId, actor));
  }

  async createSupplierInSap(caseId: string, actor: string): Promise<OnboardingCase> {
    return this.withWriteStore((repository) => repository.createSupplierInSap(caseId, actor));
  }

  async cancelCase(caseId: string, actor: string, reason: string): Promise<OnboardingCase> {
    return this.withWriteStore((repository) => repository.cancelCase(caseId, actor, reason));
  }

  async listIntegrationEvents(): Promise<IntegrationEvent[]> {
    return this.withReadStore((repository) => repository.listIntegrationEvents());
  }

  async getRequirementSummary(categoryCode: SupplierCategoryCode): Promise<DocumentSubmission[]> {
    return this.withReadStore((repository) => repository.getRequirementSummary(categoryCode));
  }

  async resetStore(): Promise<void> {
    await this.withWriteStore((repository) => repository.resetStore());
  }

  async forceExpireInvitation(caseId: string): Promise<OnboardingCase> {
    return this.withWriteStore((repository) => repository.forceExpireInvitation(caseId));
  }

  async resubmitRejectedDocuments(caseId: string, actor: string): Promise<OnboardingCase> {
    return this.withWriteStore((repository) => repository.resubmitRejectedDocuments(caseId, actor));
  }

  async setDocumentExpiry(caseId: string, code: DocumentCode, validTo: string | null, actor?: string): Promise<OnboardingCase> {
    return this.withWriteStore((repository) => repository.setDocumentExpiry(caseId, code, validTo, actor));
  }

  async listUsers(): Promise<InternalUser[]> {
    return this.withReadStore((repository) => repository.listUsers());
  }

  async getUser(userId: string): Promise<InternalUser | null> {
    return this.withReadStore((repository) => repository.getUser(userId));
  }

  async getUserByEmail(email: string): Promise<InternalUser | null> {
    return this.withReadStore((repository) => repository.getUserByEmail(email));
  }

  async upsertUser(input: UserUpsertInput, actor: string): Promise<InternalUser> {
    return this.withWriteStore((repository) => repository.upsertUser(input, actor));
  }

  async getPortalSettings(): Promise<PortalSettings> {
    return this.withReadStore((repository) => repository.getPortalSettings());
  }

  async listSupplierTypes(includeInactive?: boolean): Promise<SupplierTypeDefinition[]> {
    return this.supplierConfigStore.listSupplierTypes(includeInactive);
  }

  async createSupplierType(input: SupplierTypeCreateInput, actor: string): Promise<SupplierTypeDefinition> {
    return this.supplierConfigStore.createSupplierType(input, actor);
  }

  async setSupplierTypeStatus(input: SupplierTypeStatusInput, actor: string): Promise<SupplierTypeDefinition> {
    return this.supplierConfigStore.setSupplierTypeStatus(input, actor);
  }

  async listSupplierCategories(includeInactive?: boolean): Promise<SupplierCategoryDefinition[]> {
    return this.supplierConfigStore.listSupplierCategories(includeInactive);
  }

  async getSupplierCategory(categoryCode: SupplierCategoryCode): Promise<SupplierCategoryDefinition | null> {
    return this.supplierConfigStore.getSupplierCategory(categoryCode);
  }

  async createSupplierCategory(input: SupplierCategoryCreateInput, actor: string): Promise<SupplierCategoryDefinition> {
    return this.supplierConfigStore.createSupplierCategory(input, actor);
  }

  async setSupplierCategoryStatus(input: SupplierCategoryStatusInput, actor: string): Promise<SupplierCategoryDefinition> {
    return this.supplierConfigStore.setSupplierCategoryStatus(input, actor);
  }

  async listDocumentDefinitions(includeInactive?: boolean): Promise<DocumentDefinition[]> {
    return this.supplierConfigStore.listDocumentDefinitions(includeInactive);
  }

  async getDocumentDefinition(code: DocumentCode): Promise<DocumentDefinition | null> {
    return this.supplierConfigStore.getDocumentDefinition(code);
  }

  async createDocumentDefinition(input: DocumentDefinitionCreateInput, actor: string): Promise<DocumentDefinition> {
    return this.supplierConfigStore.createDocumentDefinition(input, actor);
  }

  async updateDocumentDefinition(input: DocumentDefinitionUpdateInput, actor: string): Promise<DocumentDefinition> {
    return this.supplierConfigStore.updateDocumentDefinition(input, actor);
  }

  async setDocumentDefinitionStatus(input: DocumentDefinitionStatusInput, actor: string): Promise<DocumentDefinition> {
    return this.supplierConfigStore.setDocumentDefinitionStatus(input, actor);
  }

  async setDocumentTemplatePath(input: DocumentTemplatePathUpdateInput, actor: string): Promise<DocumentDefinition> {
    return this.supplierConfigStore.setDocumentTemplatePath(input, actor);
  }

  async listRequirementMatrixEntries(categoryCode: SupplierCategoryCode): Promise<RequirementMatrixEntry[]> {
    return this.supplierConfigStore.listRequirementMatrixEntries(categoryCode);
  }

  async updateRequirementMatrixEntry(input: RequirementMatrixUpdateInput, actor: string): Promise<RequirementMatrixEntry> {
    return this.supplierConfigStore.updateRequirementMatrixEntry(input, actor);
  }

  async getRequirementPreview(categoryCode: SupplierCategoryCode): Promise<RequirementPreviewRow[]> {
    return this.supplierConfigStore.listRequirementPreviewRows(categoryCode);
  }

  async listRequirementPreviewsForActiveCategories(): Promise<Record<string, RequirementPreviewRow[]>> {
    const categories = await this.supplierConfigStore.listSupplierCategories(false);
    return this.supplierConfigStore.listRequirementPreviewByCategoryCodes(categories.map((category) => category.code));
  }

  async updatePortalSettings(
    input: PortalSettingsUpdateInput,
    actor: string
  ): Promise<PortalSettings> {
    return this.withWriteStore((repository) => repository.updatePortalSettings(input, actor));
  }

  async recordWorkflowTrigger(
    caseId: string,
    actor: string,
    workflowName: "invitation_open_sla" | "onboarding_completion_sla" | "document_expiry",
    runId: string | null,
    mode: "workflow" | "fallback"
  ): Promise<OnboardingCase> {
    return this.withWriteStore((repository) => repository.recordWorkflowTrigger(caseId, actor, workflowName, runId, mode));
  }

  async recordCaseAction(caseId: string, actor: string, actionType: CaseActionType, note: string): Promise<OnboardingCase> {
    return this.withWriteStore((repository) => repository.recordCaseAction(caseId, actor, actionType, note));
  }

  async requestSupplierOtp(input: SupplierOtpRequestInput, actor: string): Promise<OnboardingCase> {
    return this.withWriteStore((repository) => repository.requestSupplierOtp(input, actor));
  }

  async verifySupplierOtp(input: SupplierOtpVerifyInput, actor: string): Promise<OnboardingCase> {
    return this.withWriteStore((repository) => repository.verifySupplierOtp(input, actor));
  }

  async saveSupplierDraft(input: SupplierDraftSaveInput, actor: string): Promise<OnboardingCase> {
    return this.withWriteStore((repository) => repository.saveSupplierDraft(input, actor));
  }

  async upsertSupplierDraftDocuments(
    token: string,
    documents: SupplierSubmissionInput["uploadedDocuments"],
    actor: string
  ): Promise<OnboardingCase> {
    return this.withWriteStore((repository) => repository.upsertSupplierDraftDocuments(token, documents, actor));
  }
}

declare global {
  // eslint-disable-next-line no-var
  var __openchipStore: Store | undefined;
  // eslint-disable-next-line no-var
  var __openchipRepository: OnboardingRepository | undefined;
}

function createStore(): Store {
  const users = new Map<string, InternalUser>();
  for (const user of createDefaultUsers()) {
    users.set(user.id, user);
  }

  return {
    cases: new Map<string, OnboardingCase>(),
    integrationEvents: [],
    users,
    portalSettings: createDefaultPortalSettings()
  };
}

export function getOnboardingRepository(): OnboardingRepository {
  if (globalThis.__openchipRepository !== undefined) {
    return globalThis.__openchipRepository;
  }

  const supplierConfigStore = getSupplierConfigStore();
  const databaseUrl = process.env.DATABASE_URL;

  if (databaseUrl !== undefined && databaseUrl.length > 0) {
    const pool = new Pool({
      connectionString: databaseUrl
    });

    globalThis.__openchipRepository = new PostgresOnboardingRepository(pool, supplierConfigStore);
    return globalThis.__openchipRepository;
  }

  if (globalThis.__openchipStore === undefined) {
    globalThis.__openchipStore = createStore();
  }

  globalThis.__openchipRepository = new InMemoryOnboardingRepository(globalThis.__openchipStore, supplierConfigStore);
  return globalThis.__openchipRepository;
}
