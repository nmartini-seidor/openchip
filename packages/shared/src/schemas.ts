import { z } from "zod";
import {
  caseSourceChannels,
  documentCodes,
  fundingTypes,
  internalRoles,
  locationTypes,
  requirementLevels,
  supportedLocales,
  validationDecisions
} from "./domain";

const supplierCategoryCodeSchema = z
  .string()
  .trim()
  .min(3)
  .max(48)
  .regex(/^[A-Z0-9-]+$/, "Category code must use uppercase letters, numbers, and hyphen.");

const documentCodeSchema = z.enum(documentCodes);

const validationDecisionSchema = z.enum(validationDecisions);

export const requirementLevelSchema = z.enum(requirementLevels);

export const internalRoleSchema = z.enum(internalRoles);

export const localeSchema = z.enum(supportedLocales);

export const createCaseInputSchema = z.object({
  supplierName: z.string().trim().min(2).max(120),
  supplierVat: z.string().trim().min(3).max(64),
  supplierContactName: z.string().trim().min(2).max(120),
  supplierContactEmail: z.string().trim().email().max(160),
  requester: z.string().trim().min(2).max(120),
  categoryCode: supplierCategoryCodeSchema
});

export const caseSourceChannelSchema = z.enum(caseSourceChannels);

export const sapPurchaseRequestNewSupplierSchema = z.object({
  sapPrId: z.string().trim().min(1).max(80),
  sapSystem: z.string().trim().min(1).max(80),
  requesterSapUserId: z.string().trim().min(1).max(120),
  requesterDisplayName: z.string().trim().min(2).max(120),
  supplierName: z.string().trim().min(2).max(120),
  supplierVat: z.string().trim().min(3).max(64),
  supplierContactName: z.string().trim().min(2).max(120),
  supplierContactEmail: z.string().trim().email().max(160),
  categoryCode: supplierCategoryCodeSchema,
  requestedAt: z.string().trim().datetime({ offset: true }),
  costCenter: z.string().trim().min(1).max(80).optional(),
  companyCode: z.string().trim().min(1).max(80).optional(),
  purchasingOrg: z.string().trim().min(1).max(80).optional(),
  notes: z.string().trim().max(500).optional()
});

export const supplierSubmissionSchema = z.object({
  token: z.string().trim().uuid(),
  address: z.string().trim().min(3).max(240),
  country: z.string().trim().min(2).max(80)
});

export const validateDocumentSchema = z.object({
  caseId: z.string().trim().uuid(),
  code: documentCodeSchema,
  decision: validationDecisionSchema,
  approver: z.string().trim().min(2).max(120),
  comments: z.string().trim().max(240)
});

export const identifierSchema = z.string().trim().uuid();

export const invitationTokenSchema = z.string().trim().uuid();

export const loginInputSchema = z.object({
  email: z.string().trim().email().max(160),
  locale: localeSchema.optional()
});

export const portalSettingsSchema = z.object({
  invitationOpenHours: z.coerce.number().int().min(1).max(168),
  onboardingCompletionDays: z.coerce.number().int().min(1).max(90)
});

export const userUpsertSchema = z.object({
  id: z.string().trim().uuid().optional(),
  email: z.string().trim().email().max(160),
  displayName: z.string().trim().min(2).max(120),
  role: internalRoleSchema,
  active: z.coerce.boolean()
});

export const supplierTypeCreateSchema = z.object({
  label: z.string().trim().min(2).max(80)
});

export const supplierTypeStatusSchema = z.object({
  typeId: z.string().trim().min(2).max(120),
  active: z.coerce.boolean()
});

export const supplierCategoryCreateSchema = z.object({
  funding: z.enum(fundingTypes),
  typeId: z.string().trim().min(2).max(120),
  location: z.enum(locationTypes),
  label: z.string().trim().min(2).max(160)
});

export const supplierCategoryStatusSchema = z.object({
  categoryCode: supplierCategoryCodeSchema,
  active: z.coerce.boolean()
});

export const requirementMatrixUpdateSchema = z.object({
  categoryCode: supplierCategoryCodeSchema,
  documentCode: documentCodeSchema,
  requirementLevel: requirementLevelSchema
});
