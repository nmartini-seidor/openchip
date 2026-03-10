import { z } from "zod";
import {
  caseSourceChannels,
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

export const documentCodeSchema = z
  .string()
  .trim()
  .min(3)
  .max(24)
  .regex(/^[A-Z0-9]+-[A-Z0-9]+$/u, "Document code must follow pattern AREA-01.");

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

export const updateSupplierInfoInputSchema = createCaseInputSchema
  .pick({
    supplierName: true,
    supplierVat: true,
    supplierContactName: true,
    supplierContactEmail: true
  })
  .extend({
    caseId: z.string().trim().uuid()
  });

export const caseSourceChannelSchema = z.enum(caseSourceChannels);

function normalizeIban(value: string): string {
  return value.replace(/\s+/g, "").toUpperCase();
}

function isValidIbanChecksum(value: string): boolean {
  const normalized = normalizeIban(value);
  if (!/^[A-Z]{2}[0-9]{2}[A-Z0-9]{8,30}$/.test(normalized)) {
    return false;
  }

  const rearranged = `${normalized.slice(4)}${normalized.slice(0, 4)}`;
  let remainder = 0;
  for (const character of rearranged) {
    const numericChunk =
      character >= "A" && character <= "Z"
        ? (character.charCodeAt(0) - 55).toString()
        : character;

    for (const digit of numericChunk) {
      remainder = (remainder * 10 + Number(digit)) % 97;
    }
  }

  return remainder === 1;
}

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

export const supplierBankAccountSchema = z
  .object({
    bkvid: z.string().trim().regex(/^\d{4}$/),
    banks: z.string().trim().min(2).max(3).regex(/^[A-Z]{2,3}$/),
    bankl: z.string().trim().max(15).optional().nullable(),
    bankn: z.string().trim().max(18).optional().nullable(),
    bkont: z.string().trim().max(2).optional().nullable(),
    accname: z.string().trim().min(2).max(40),
    bkValidFrom: z.string().trim().date().optional(),
    bkValidTo: z.string().trim().date().optional(),
    iban: z.string().trim().max(34).optional().nullable()
  })
  .superRefine((value, ctx) => {
    const iban = value.iban === null ? undefined : value.iban?.trim();
    const hasIban = iban !== undefined && iban.length > 0;

    if (hasIban) {
      if (!isValidIbanChecksum(iban)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["iban"],
          message: "Invalid IBAN."
        });
      }
    } else {
      const bankn = value.bankn === null ? undefined : value.bankn?.trim();
      if (bankn === undefined || bankn.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["bankn"],
          message: "Bank account number is required when IBAN is not provided."
        });
      }
    }

    if (
      value.bkValidFrom !== undefined &&
      value.bkValidTo !== undefined &&
      new Date(value.bkValidFrom).getTime() > new Date(value.bkValidTo).getTime()
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["bkValidTo"],
        message: "Bank validity end date must be on or after validity start date."
      });
    }
  })
  .transform((value) => {
    const iban = value.iban === null ? undefined : value.iban?.trim();
    const bankn = value.bankn === null ? undefined : value.bankn?.trim();
    const bankl = value.bankl === null ? undefined : value.bankl?.trim();
    const bkont = value.bkont === null ? undefined : value.bkont?.trim();

    return {
      bkvid: value.bkvid,
      banks: value.banks.toUpperCase(),
      bankl: bankl !== undefined && bankl.length > 0 ? bankl : "",
      bankn: bankn !== undefined && bankn.length > 0 ? bankn : null,
      bkont: bkont !== undefined && bkont.length > 0 ? bkont : null,
      accname: value.accname,
      bkValidFrom: value.bkValidFrom ?? new Date().toISOString().slice(0, 10),
      bkValidTo: value.bkValidTo ?? "9999-12-31",
      iban: iban !== undefined && iban.length > 0 ? normalizeIban(iban) : null
    };
  });

export const uploadedDocumentFileSchema = z.object({
  id: z.string().trim().uuid(),
  fileName: z.string().trim().min(1).max(240),
  mimeType: z.string().trim().min(1).max(120),
  sizeBytes: z.number().int().min(1),
  storagePath: z.string().trim().min(1).max(500),
  uploadedAt: z.string().trim().datetime({ offset: true }),
  uploadedBy: z.string().trim().min(2).max(120)
});

export const uploadedDocumentInputSchema = z.object({
  code: documentCodeSchema,
  files: z.array(uploadedDocumentFileSchema).min(1)
});

export const supplierSubmissionSchema = z.object({
  token: z.string().trim().uuid(),
  address: z.object({
    street: z.string().trim().min(2).max(180),
    city: z.string().trim().min(2).max(120),
    postalCode: z.string().trim().min(2).max(32),
    country: z.string().trim().min(2).max(80)
  }),
  bankAccount: supplierBankAccountSchema,
  uploadedDocuments: z.array(uploadedDocumentInputSchema)
});

export const supplierDraftSaveSchema = z.object({
  token: z.string().trim().uuid(),
  address: z
    .object({
      street: z.string().trim().max(180).optional(),
      city: z.string().trim().max(120).optional(),
      postalCode: z.string().trim().max(32).optional(),
      country: z.string().trim().max(80).optional()
    })
    .default({}),
  bankAccount: z
    .object({
      banks: z.string().trim().max(3).optional(),
      bankl: z.string().trim().max(15).optional(),
      bankn: z.string().trim().max(18).optional(),
      bkont: z.string().trim().max(2).optional(),
      accname: z.string().trim().max(40).optional(),
      iban: z.string().trim().max(34).optional()
    })
    .default({})
});

export const supplierOtpRequestSchema = z.object({
  token: z.string().trim().uuid()
});

export const supplierOtpVerifySchema = z.object({
  token: z.string().trim().uuid(),
  otpCode: z.string().trim().regex(/^\d{6}$/)
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
  onboardingCompletionDays: z.coerce.number().int().min(1).max(90),
  sapBaseUrl: z.string().trim().url().max(300),
  sapApiKey: z.string().trim().min(1).max(300),
  docuwareBaseUrl: z.string().trim().url().max(300),
  docuwareApiKey: z.string().trim().min(1).max(300)
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

export const documentDefinitionCreateSchema = z.object({
  code: documentCodeSchema,
  labelEn: z.string().trim().min(2).max(160),
  labelEs: z.string().trim().min(2).max(160),
  type: z.enum(["internal", "external", "internal_or_external"]),
  expiryPolicy: z.enum(["no_expiry", "annual", "monthly"]),
  owner: z.enum(["finance", "contracts_justifications", "compliance", "sustainability"]),
  blocksPurchaseOrders: z.coerce.boolean()
});

export const documentDefinitionUpdateSchema = documentDefinitionCreateSchema;

export const documentDefinitionStatusSchema = z.object({
  code: documentCodeSchema,
  active: z.coerce.boolean()
});
