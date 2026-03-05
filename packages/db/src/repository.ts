import {
  CaseStatus,
  CreateCaseInput,
  DocumentCode,
  DocumentSubmission,
  IntegrationEvent,
  InternalUser,
  OnboardingCase,
  PortalSettings,
  SupplierCategoryCode,
  SupplierSession,
  SupplierSubmissionInput,
  UserUpsertInput,
  ValidateDocumentInput
} from "@openchip/shared";
import { evaluateCompliance, resolveRequirementsForCategory, transitionCaseStatus } from "@openchip/workflow";
import { randomUUID } from "node:crypto";

const INVITATION_TTL_DAYS = 14;
const DEFAULT_INVITATION_OPEN_HOURS = 48;
const DEFAULT_ONBOARDING_COMPLETION_DAYS = 14;

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

function cloneCase(onboardingCase: OnboardingCase): OnboardingCase {
  return {
    ...onboardingCase,
    slaSnapshot: { ...onboardingCase.slaSnapshot },
    statusHistory: onboardingCase.statusHistory.map((entry) => ({ ...entry })),
    documents: onboardingCase.documents.map((document) => ({ ...document }))
  };
}

function cloneUser(user: InternalUser): InternalUser {
  return { ...user };
}

function clonePortalSettings(settings: PortalSettings): PortalSettings {
  return { ...settings };
}

function createDocumentSubmission(code: DocumentCode, requirementLevel: "mandatory" | "optional"): DocumentSubmission {
  return {
    code,
    requirementLevel,
    status: "pending_validation",
    version: 1,
    uploadedAt: nowIso(),
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

function createDefaultPortalSettings(): PortalSettings {
  return {
    invitationOpenHours: DEFAULT_INVITATION_OPEN_HOURS,
    onboardingCompletionDays: DEFAULT_ONBOARDING_COMPLETION_DAYS,
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

interface Store {
  cases: Map<string, OnboardingCase>;
  integrationEvents: IntegrationEvent[];
  users: Map<string, InternalUser>;
  portalSettings: PortalSettings;
}

export interface OnboardingRepository {
  listCases(): Promise<OnboardingCase[]>;
  getCase(caseId: string): Promise<OnboardingCase | null>;
  createCase(input: CreateCaseInput, actor?: string): Promise<OnboardingCase>;
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
  setDocumentExpiry(caseId: string, code: DocumentCode, validTo: string | null): Promise<OnboardingCase>;
  listUsers(): Promise<InternalUser[]>;
  getUser(userId: string): Promise<InternalUser | null>;
  getUserByEmail(email: string): Promise<InternalUser | null>;
  upsertUser(input: UserUpsertInput, actor: string): Promise<InternalUser>;
  getPortalSettings(): Promise<PortalSettings>;
  updatePortalSettings(
    input: Pick<PortalSettings, "invitationOpenHours" | "onboardingCompletionDays">,
    actor: string
  ): Promise<PortalSettings>;
  recordWorkflowTrigger(
    caseId: string,
    actor: string,
    workflowName: "invitation_open_sla" | "onboarding_completion_sla" | "document_expiry",
    runId: string | null,
    mode: "workflow" | "fallback"
  ): Promise<OnboardingCase>;
}

class InMemoryOnboardingRepository implements OnboardingRepository {
  constructor(private readonly store: Store) {}

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

  async createCase(input: CreateCaseInput, actor = "system"): Promise<OnboardingCase> {
    const existingCase = [...this.store.cases.values()].find(
      (candidate) => candidate.supplierVat.toLowerCase() === input.supplierVat.toLowerCase() && candidate.status !== "cancelled"
    );

    if (existingCase !== undefined) {
      throw new Error("A supplier with the same VAT already exists in onboarding.");
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
      documents: []
    };

    this.store.cases.set(onboardingCase.id, onboardingCase);
    this.pushEvent(onboardingCase, "case_created", actor, {
      categoryCode: onboardingCase.categoryCode
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
      expiresAt: onboardingCase.invitationExpiresAt
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

    onboardingCase.supplierAddress = input.address;
    onboardingCase.supplierCountry = input.country;

    const requirements = resolveRequirementsForCategory(onboardingCase.categoryCode);
    onboardingCase.documents = requirements.map((row) => {
      if (!isApplicableRequirement(row.requirementLevel)) {
        throw new Error(`Unexpected non-applicable requirement for ${row.documentCode}`);
      }

      return createDocumentSubmission(row.documentCode, row.requirementLevel);
    });

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
      document.uploadedAt = null;
      document.validFrom = null;
      document.validTo = null;
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
        document.comments = "Supplier uploaded a new version";
      }
    }

    if (!hasRejectedDocument) {
      throw new Error("No rejected documents available for resubmission.");
    }

    this.pushEvent(onboardingCase, "documents_resubmitted", actor, {});
    return cloneCase(onboardingCase);
  }

  async setDocumentExpiry(caseId: string, code: DocumentCode, validTo: string | null): Promise<OnboardingCase> {
    const onboardingCase = assertCaseExists(this.store.cases.get(caseId), caseId);
    const document = onboardingCase.documents.find((item) => item.code === code);

    if (document === undefined) {
      throw new Error(`Document ${code} is not present in case ${caseId}.`);
    }

    document.validTo = validTo;
    onboardingCase.updatedAt = nowIso();
    this.pushEvent(onboardingCase, "document_expiry_set", "test.agent", {
      documentCode: code,
      validTo: validTo ?? "null"
    });

    return cloneCase(onboardingCase);
  }

  async listIntegrationEvents(): Promise<IntegrationEvent[]> {
    return this.store.integrationEvents.map((event) => ({ ...event, payload: { ...event.payload } }));
  }

  async getRequirementSummary(categoryCode: SupplierCategoryCode): Promise<DocumentSubmission[]> {
    return resolveRequirementsForCategory(categoryCode)
      .filter((row) => row.requirementLevel !== "not_applicable")
      .map((row) => ({
        code: row.documentCode,
        requirementLevel: row.requirementLevel,
        status: "pending_reception",
        version: 1,
        uploadedAt: null,
        approver: null,
        validationDate: null,
        validFrom: null,
        validTo: null,
        comments: null
      }));
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
    input: Pick<PortalSettings, "invitationOpenHours" | "onboardingCompletionDays">,
    actor: string
  ): Promise<PortalSettings> {
    this.store.portalSettings = {
      invitationOpenHours: input.invitationOpenHours,
      onboardingCompletionDays: input.onboardingCompletionDays,
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
        onboardingCompletionDays: this.store.portalSettings.onboardingCompletionDays.toString()
      },
      deliveryStatus: "pending"
    });

    return clonePortalSettings(this.store.portalSettings);
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
}

declare global {
  // eslint-disable-next-line no-var
  var __openchipStore: Store | undefined;
  // eslint-disable-next-line no-var
  var __openchipRepository: InMemoryOnboardingRepository | undefined;
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
  if (globalThis.__openchipStore === undefined) {
    globalThis.__openchipStore = createStore();
  }

  if (globalThis.__openchipRepository === undefined) {
    globalThis.__openchipRepository = new InMemoryOnboardingRepository(globalThis.__openchipStore);
  }

  return globalThis.__openchipRepository;
}
