export const supplierCategoryCodes = [
  "SUB-SC-NAT",
  "SUB-SC-INT",
  "SUB-STD-NAT",
  "SUB-STD-INT",
  "NSUB-SC-NAT",
  "NSUB-SC-INT",
  "NSUB-STD-NAT",
  "NSUB-STD-INT",
  "NSUB-ECOM-NAT",
  "NSUB-ECOM-INT",
  "NSUB-ONE-NAT",
  "NSUB-ONE-INT"
] as const;

export type SupplierCategoryCode = string;

export const supportedLocales = ["en", "es"] as const;

export type SupportedLocale = (typeof supportedLocales)[number];

export const fundingTypes = ["subsidized", "non_subsidized"] as const;

export type FundingType = (typeof fundingTypes)[number];

export type SupplierType = string;

export const locationTypes = ["national", "international"] as const;

export type LocationType = (typeof locationTypes)[number];

export interface SupplierTypeDefinition {
  id: string;
  key: SupplierType;
  label: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SupplierCategory {
  code: SupplierCategoryCode;
  funding: FundingType;
  type: SupplierType;
  location: LocationType;
  label: string;
}

export const supplierCategories: readonly SupplierCategory[] = [
  { code: "SUB-SC-NAT", funding: "subsidized", type: "subcontractor", location: "national", label: "Subsidized / Subcontractor / National" },
  { code: "SUB-SC-INT", funding: "subsidized", type: "subcontractor", location: "international", label: "Subsidized / Subcontractor / International" },
  { code: "SUB-STD-NAT", funding: "subsidized", type: "standard", location: "national", label: "Subsidized / Standard / National" },
  { code: "SUB-STD-INT", funding: "subsidized", type: "standard", location: "international", label: "Subsidized / Standard / International" },
  { code: "NSUB-SC-NAT", funding: "non_subsidized", type: "subcontractor", location: "national", label: "Non-Subsidized / Subcontractor / National" },
  { code: "NSUB-SC-INT", funding: "non_subsidized", type: "subcontractor", location: "international", label: "Non-Subsidized / Subcontractor / International" },
  { code: "NSUB-STD-NAT", funding: "non_subsidized", type: "standard", location: "national", label: "Non-Subsidized / Standard / National" },
  { code: "NSUB-STD-INT", funding: "non_subsidized", type: "standard", location: "international", label: "Non-Subsidized / Standard / International" },
  { code: "NSUB-ECOM-NAT", funding: "non_subsidized", type: "ecommerce", location: "national", label: "Non-Subsidized / E-Commerce / National" },
  { code: "NSUB-ECOM-INT", funding: "non_subsidized", type: "ecommerce", location: "international", label: "Non-Subsidized / E-Commerce / International" },
  { code: "NSUB-ONE-NAT", funding: "non_subsidized", type: "one_time", location: "national", label: "Non-Subsidized / One-Time / National" },
  { code: "NSUB-ONE-INT", funding: "non_subsidized", type: "one_time", location: "international", label: "Non-Subsidized / One-Time / International" }
] as const;

export interface SupplierCategoryDefinition {
  code: SupplierCategoryCode;
  funding: FundingType;
  typeId: string;
  typeKey: SupplierType;
  typeLabel: string;
  location: LocationType;
  label: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export const documentCodes = [
  "FIN-01",
  "FIN-02",
  "FIN-03",
  "TAX-01",
  "TAX-02",
  "SS-01",
  "TAX-03",
  "LEG-01",
  "SUB-01",
  "SUB-02",
  "SUS-01",
  "DPO-01",
  "DPO-02"
] as const;

export type DocumentCode = (typeof documentCodes)[number];

export const requirementLevels = ["mandatory", "optional", "not_applicable"] as const;

export type RequirementLevel = (typeof requirementLevels)[number];

export type DocumentType = "internal" | "external" | "internal_or_external";

export type ExpiryPolicy = "no_expiry" | "annual" | "monthly";

export type OwnerDepartment = "finance" | "contracts_justifications" | "compliance" | "sustainability";

export interface DocumentDefinition {
  code: DocumentCode;
  name: string;
  type: DocumentType;
  expiryPolicy: ExpiryPolicy;
  owner: OwnerDepartment;
  blocksPurchaseOrders: boolean;
}

export const documentCatalog: readonly DocumentDefinition[] = [
  { code: "FIN-01", name: "Standard Supplier Onboarding Form", type: "internal", expiryPolicy: "no_expiry", owner: "finance", blocksPurchaseOrders: true },
  { code: "FIN-02", name: "Bank Account Ownership Certificate", type: "external", expiryPolicy: "no_expiry", owner: "finance", blocksPurchaseOrders: true },
  { code: "FIN-03", name: "Proforma Invoice", type: "external", expiryPolicy: "no_expiry", owner: "finance", blocksPurchaseOrders: false },
  { code: "TAX-01", name: "Tax Residency Certificate (Double Taxation)", type: "external", expiryPolicy: "annual", owner: "finance", blocksPurchaseOrders: true },
  { code: "TAX-02", name: "Tax Compliance Certificate - Subcontractors", type: "external", expiryPolicy: "monthly", owner: "finance", blocksPurchaseOrders: true },
  { code: "SS-01", name: "Social Security Compliance Certificate - Subcontractors", type: "external", expiryPolicy: "monthly", owner: "finance", blocksPurchaseOrders: true },
  { code: "TAX-03", name: "Tax Registration Certificate", type: "external", expiryPolicy: "annual", owner: "contracts_justifications", blocksPurchaseOrders: true },
  { code: "LEG-01", name: "Code of Conduct", type: "internal_or_external", expiryPolicy: "no_expiry", owner: "contracts_justifications", blocksPurchaseOrders: false },
  { code: "SUB-01", name: "Subsidized Project Communication", type: "internal", expiryPolicy: "annual", owner: "contracts_justifications", blocksPurchaseOrders: false },
  { code: "SUB-02", name: "Subsidized Project Declarations", type: "internal", expiryPolicy: "annual", owner: "contracts_justifications", blocksPurchaseOrders: false },
  { code: "SUS-01", name: "Sustainability Form", type: "internal", expiryPolicy: "no_expiry", owner: "sustainability", blocksPurchaseOrders: false },
  { code: "DPO-01", name: "Data Processing Questionnaire", type: "internal", expiryPolicy: "no_expiry", owner: "compliance", blocksPurchaseOrders: false },
  { code: "DPO-02", name: "Data Questionnaire 2", type: "internal", expiryPolicy: "no_expiry", owner: "compliance", blocksPurchaseOrders: false }
] as const;

export const internalRoles = [
  "finance",
  "purchasing",
  "requester",
  "contracts_justifications",
  "compliance",
  "sustainability",
  "admin"
] as const;

export type InternalRole = (typeof internalRoles)[number];

export const onboardingInitiatorRoles = ["finance", "purchasing", "requester", "admin"] as const;

export type OnboardingInitiatorRole = (typeof onboardingInitiatorRoles)[number];

export const caseStatuses = [
  "onboarding_initiated",
  "invitation_sent",
  "portal_accessed",
  "response_in_progress",
  "submission_completed",
  "validation_completed_pending_supplier_creation",
  "supplier_created_in_sap",
  "cancelled"
] as const;

export type CaseStatus = (typeof caseStatuses)[number];

export const caseSourceChannels = ["manual", "sap_pr"] as const;

export type CaseSourceChannel = (typeof caseSourceChannels)[number];

export const validationDecisions = ["approve", "reject", "approve_provisionally"] as const;

export type ValidationDecision = (typeof validationDecisions)[number];

export const documentValidationStatuses = [
  "pending_reception",
  "pending_validation",
  "approved",
  "rejected",
  "approved_provisionally"
] as const;

export type DocumentValidationStatus = (typeof documentValidationStatuses)[number];

export interface RequirementRow {
  categoryCode: SupplierCategoryCode;
  documentCode: DocumentCode;
  requirementLevel: RequirementLevel;
}

export interface RequirementMatrixEntry {
  categoryCode: SupplierCategoryCode;
  documentCode: DocumentCode;
  requirementLevel: RequirementLevel;
  updatedAt: string;
  updatedBy: string;
}

export interface RequirementPreviewRow extends DocumentDefinition {
  requirementLevel: RequirementLevel;
}

export interface StatusHistoryEntry {
  status: CaseStatus;
  changedAt: string;
  actor: string;
  note: string;
}

export const caseActionTypes = ["expiration_reminder_sent"] as const;

export type CaseActionType = (typeof caseActionTypes)[number];

export interface ActionHistoryEntry {
  actionType: CaseActionType;
  changedAt: string;
  actor: string;
  note: string;
}

export interface SlaSnapshot {
  invitationOpenHours: number;
  onboardingCompletionDays: number;
}

export interface DocumentSubmission {
  code: DocumentCode;
  requirementLevel: RequirementLevel;
  status: DocumentValidationStatus;
  version: number;
  uploadedAt: string | null;
  approver: string | null;
  validationDate: string | null;
  validFrom: string | null;
  validTo: string | null;
  comments: string | null;
}

export interface OnboardingCase {
  id: string;
  supplierName: string;
  supplierVat: string;
  supplierContactName: string;
  supplierContactEmail: string;
  requester: string;
  createdBy: string;
  sourceChannel: CaseSourceChannel;
  sourceSystem: string | null;
  sourceReference: string | null;
  requestedBySapUser: string | null;
  sourceRequestedAt: string | null;
  categoryCode: SupplierCategoryCode;
  status: CaseStatus;
  invitationToken: string | null;
  invitationExpiresAt: string | null;
  invitationSentAt: string | null;
  portalFirstAccessAt: string | null;
  invitationOpenDeadlineAt: string | null;
  onboardingCompletionDeadlineAt: string | null;
  slaSnapshot: SlaSnapshot;
  supplierAddress: string | null;
  supplierCountry: string | null;
  createdAt: string;
  updatedAt: string;
  statusHistory: StatusHistoryEntry[];
  actionHistory: ActionHistoryEntry[];
  documents: DocumentSubmission[];
}

export interface InternalUser {
  id: string;
  email: string;
  displayName: string;
  role: InternalRole;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UserUpsertInput {
  id?: string | undefined;
  email: string;
  displayName: string;
  role: InternalRole;
  active: boolean;
}

export interface PortalSettings {
  invitationOpenHours: number;
  onboardingCompletionDays: number;
  updatedAt: string;
  updatedBy: string;
}

export interface SupplierTypeCreateInput {
  label: string;
}

export interface SupplierTypeStatusInput {
  typeId: string;
  active: boolean;
}

export interface SupplierCategoryCreateInput {
  funding: FundingType;
  typeId: string;
  location: LocationType;
  label: string;
}

export interface SupplierCategoryStatusInput {
  categoryCode: SupplierCategoryCode;
  active: boolean;
}

export interface RequirementMatrixUpdateInput {
  categoryCode: SupplierCategoryCode;
  documentCode: DocumentCode;
  requirementLevel: RequirementLevel;
}

export interface CreateCaseInput {
  supplierName: string;
  supplierVat: string;
  supplierContactName: string;
  supplierContactEmail: string;
  requester: string;
  categoryCode: SupplierCategoryCode;
}

export interface SapPurchaseRequestNewSupplierInput {
  sapPrId: string;
  sapSystem: string;
  requesterSapUserId: string;
  requesterDisplayName: string;
  supplierName: string;
  supplierVat: string;
  supplierContactName: string;
  supplierContactEmail: string;
  categoryCode: SupplierCategoryCode;
  requestedAt: string;
  costCenter?: string | undefined;
  companyCode?: string | undefined;
  purchasingOrg?: string | undefined;
  notes?: string | undefined;
}

export interface SupplierSubmissionInput {
  token: string;
  address: string;
  country: string;
}

export interface ValidateDocumentInput {
  caseId: string;
  code: DocumentCode;
  decision: ValidationDecision;
  approver: string;
  comments: string;
}

export interface SupplierSession {
  token: string;
  caseId: string;
  expiresAt: string;
}

export interface IntegrationEvent {
  eventType: string;
  caseId: string;
  supplierVat: string;
  timestamp: string;
  actor: string;
  payload: Record<string, string>;
  deliveryStatus: "pending" | "delivered";
}
