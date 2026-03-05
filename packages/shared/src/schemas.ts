import { z } from "zod";
import { documentCodes, internalRoles, supplierCategoryCodes, supportedLocales, validationDecisions } from "./domain";

const supplierCategoryCodeSchema = z.enum(supplierCategoryCodes);

const documentCodeSchema = z.enum(documentCodes);

const validationDecisionSchema = z.enum(validationDecisions);

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
